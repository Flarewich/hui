import { pgMaybeOne, pgQuery, pgRows } from "@/lib/postgres";
import { notifySupportEvent } from "@/lib/supportRealtime";

export type SupportThread = {
  id: string;
  user_id: string;
  status: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  attachment_kind: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  created_at: string;
};

export type SupportProfile = {
  id: string;
  username: string | null;
  role: string | null;
};

let ensuredSupportAttachmentColumns = false;

export async function ensureSupportAttachmentColumns() {
  if (ensuredSupportAttachmentColumns) return;

  await pgQuery(`
    alter table if exists support_messages
      add column if not exists attachment_url text,
      add column if not exists attachment_kind text,
      add column if not exists attachment_name text,
      add column if not exists attachment_mime text
  `);

  await pgQuery(`
    do $$
    begin
      alter table public.support_messages
        drop constraint if exists support_messages_body_check;
      alter table public.support_messages
        add constraint support_messages_body_check check (
          (
            char_length(btrim(coalesce(body, ''))) between 1 and 2000
          )
          or attachment_url is not null
        );
    exception when undefined_table then
      null;
    end $$;
  `);

  ensuredSupportAttachmentColumns = true;
}

async function normalizeUserThreads(userId: string) {
  const threads = await pgRows<SupportThread>(
    `
      select id, user_id, status, updated_at
      from support_threads
      where user_id = $1
        and status = 'open'
      order by updated_at desc, id desc
    `,
    [userId]
  );

  const primary = threads[0] ?? null;
  if (!primary || threads.length === 1) {
    return primary;
  }

  const duplicateIds = threads.slice(1).map((thread) => thread.id);
  await pgQuery(
    `
      update support_messages
      set thread_id = $1
      where thread_id = any($2::uuid[])
    `,
    [primary.id, duplicateIds]
  );
  await pgQuery(`delete from support_threads where id = any($1::uuid[])`, [duplicateIds]);

  return primary;
}

export async function ensureLegacyTicketId(userId: string) {
  const existing = await pgMaybeOne<{ id: string }>(
    `
      select id
      from support_tickets
      where user_id = $1
        and status = 'open'
      order by updated_at desc
      limit 1
    `,
    [userId]
  );

  if (existing?.id) return existing.id;

  const created = await pgMaybeOne<{ id: string }>(
    `
      insert into support_tickets (user_id, status)
      values ($1, 'open')
      returning id
    `,
    [userId]
  );

  return created?.id ?? null;
}

export async function ensureUserThread(userId: string) {
  const existing = await normalizeUserThreads(userId);

  if (existing) return existing;

  return pgMaybeOne<SupportThread>(
    `
      insert into support_threads (user_id, status)
      values ($1, 'open')
      returning id, user_id, status, updated_at
    `,
    [userId]
  );
}

export async function resetUserSupportSession(userId: string) {
  await pgQuery(
    `
      update support_threads
      set status = 'closed', updated_at = now()
      where user_id = $1
        and status = 'open'
    `,
    [userId]
  );
  await pgQuery(
    `
      update support_tickets
      set status = 'closed', updated_at = now()
      where user_id = $1
        and status = 'open'
    `,
    [userId]
  );
}

export async function getThreadMessages(threadId: string) {
  await ensureSupportAttachmentColumns();
  return pgRows<SupportMessage>(
    `
      select
        id,
        thread_id,
        sender_id,
        body,
        attachment_url,
        attachment_kind,
        attachment_name,
        attachment_mime,
        created_at
      from support_messages
      where thread_id = $1
      order by created_at asc
    `,
    [threadId]
  );
}

export async function getProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [] as SupportProfile[];
  return pgRows<SupportProfile>(
    `
      select id, username, role
      from profiles
      where id = any($1::uuid[])
    `,
    [ids]
  );
}

export async function appendSupportMessage(params: {
  threadId: string;
  senderId: string;
  targetUserId: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentKind?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}) {
  await ensureSupportAttachmentColumns();

  const { threadId, senderId, targetUserId, body, attachmentUrl, attachmentKind, attachmentName, attachmentMime } = params;
  const legacyTicketId = await ensureLegacyTicketId(targetUserId);

  await pgQuery(
    `
      insert into support_messages (
        thread_id,
        ticket_id,
        sender_id,
        body,
        message,
        attachment_url,
        attachment_kind,
        attachment_name,
        attachment_mime
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      threadId,
      legacyTicketId,
      senderId,
      body,
      body || null,
      attachmentUrl ?? null,
      attachmentKind ?? null,
      attachmentName ?? null,
      attachmentMime ?? null,
    ]
  );

  await pgQuery(
    `
      update support_threads
      set updated_at = now(), status = 'open'
      where id = $1
    `,
    [threadId]
  );

  if (legacyTicketId) {
    await pgQuery(
      `
        update support_tickets
        set updated_at = now(), status = 'open'
        where id = $1
      `,
      [legacyTicketId]
    );
  }

  await notifySupportEvent({
    threadId,
    senderId,
    targetUserId,
  });
}
