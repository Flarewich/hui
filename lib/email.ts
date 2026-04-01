import { randomUUID } from "crypto";
import { pgMaybeOne, pgQuery, pgRows } from "@/lib/postgres";

export type EmailOutboxRow = {
  id: string;
  user_id: string | null;
  to_email: string;
  subject: string;
  text_body: string;
  html_body: string | null;
  kind: string | null;
  delivery_status: string;
  created_at: string;
};

let ensuredEmailTables = false;

export async function ensureEmailTables() {
  if (ensuredEmailTables) return;

  await pgQuery(`
    create table if not exists email_outbox (
      id uuid primary key,
      user_id uuid references profiles(id) on delete set null,
      to_email text not null,
      subject text not null,
      text_body text not null,
      html_body text,
      kind text,
      meta jsonb not null default '{}'::jsonb,
      delivery_status text not null default 'queued',
      created_at timestamptz not null default now(),
      sent_at timestamptz
    )
  `);

  await pgQuery(`
    create index if not exists idx_email_outbox_created_at
    on email_outbox (created_at desc)
  `);

  await pgQuery(`
    create index if not exists idx_email_outbox_user_id_created_at
    on email_outbox (user_id, created_at desc)
  `);

  ensuredEmailTables = true;
}

export async function queueEmail(params: {
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  kind?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await ensureEmailTables();

  const id = randomUUID();
  await pgQuery(
    `
      insert into email_outbox (
        id,
        user_id,
        to_email,
        subject,
        text_body,
        html_body,
        kind,
        meta
      )
      values ($1, $2, lower($3), $4, $5, $6, $7, $8::jsonb)
    `,
    [
      id,
      params.userId ?? null,
      params.toEmail,
      params.subject,
      params.textBody,
      params.htmlBody ?? null,
      params.kind ?? null,
      JSON.stringify(params.meta ?? {}),
    ]
  );

  return id;
}

export async function listRecentOutbox(limit = 100) {
  await ensureEmailTables();
  return pgRows<EmailOutboxRow>(
    `
      select id, user_id, to_email, subject, text_body, html_body, kind, delivery_status, created_at
      from email_outbox
      order by created_at desc
      limit $1
    `,
    [limit]
  );
}

export async function getUserEmail(userId: string) {
  await ensureEmailTables();
  const row = await pgMaybeOne<{ email: string | null }>(
    `
      select email
      from user_accounts
      where user_id = $1
      limit 1
    `,
    [userId]
  );
  return row?.email ?? null;
}

export async function listAdminRecipients() {
  await ensureEmailTables();
  return pgRows<{ user_id: string; email: string }>(
    `
      select p.id as user_id, ua.email
      from profiles p
      join user_accounts ua on ua.user_id = p.id
      where p.role = 'admin'
      order by ua.email asc
    `
  );
}

export function getAppBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
}
