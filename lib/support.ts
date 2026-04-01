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
  created_at: string;
};

export type SupportProfile = {
  id: string;
  username: string | null;
  role: string | null;
};

export async function ensureLegacyTicketId(userId: string) {
  const existing = await pgMaybeOne<{ id: string }>(
    `
      select id
      from support_tickets
      where user_id = $1
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
  const existing = await pgMaybeOne<SupportThread>(
    `
      select id, user_id, status, updated_at
      from support_threads
      where user_id = $1
      order by updated_at desc
      limit 1
    `,
    [userId]
  );

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

export async function getThreadMessages(threadId: string) {
  return pgRows<SupportMessage>(
    `
      select id, thread_id, sender_id, body, created_at
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
}) {
  const { threadId, senderId, targetUserId, body } = params;
  const legacyTicketId = await ensureLegacyTicketId(targetUserId);

  await pgQuery(
    `
      insert into support_messages (thread_id, ticket_id, sender_id, body, message)
      values ($1, $2, $3, $4, $4)
    `,
    [threadId, legacyTicketId, senderId, body]
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
