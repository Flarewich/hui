import { createPgClient, pgOne, pgQuery, pgRows } from "@/lib/postgres";

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  username: string | null;
  email: string | null;
};

export type AuditLogEvent = {
  id: string;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  username: string | null;
  email: string | null;
};

let ensuredAuditLogTable = false;
const AUDIT_LOGS_CHANNEL = "app_audit_log_events";

export async function ensureAuditLogTable() {
  if (ensuredAuditLogTable) return;

  await pgQuery(`
    create table if not exists app_audit_logs (
      id bigserial primary key,
      user_id uuid null references profiles(id) on delete set null,
      action text not null,
      ip_address text null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await pgQuery(`
    create index if not exists idx_app_audit_logs_created_at
      on app_audit_logs (created_at desc)
  `);

  await pgQuery(`
    create index if not exists idx_app_audit_logs_user_id_created_at
      on app_audit_logs (user_id, created_at desc)
  `);

  await pgQuery(`
    create index if not exists idx_app_audit_logs_action_created_at
      on app_audit_logs (action, created_at desc)
  `);

  ensuredAuditLogTable = true;
}

function normalizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return {};
  return JSON.parse(JSON.stringify(metadata));
}

export async function logAuditEvent(params: {
  userId?: string | null;
  action: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await ensureAuditLogTable();
  const metadataJson = JSON.stringify(normalizeMetadata(params.metadata));

  const row = await pgOne<{ id: string }>(
    `
      insert into app_audit_logs (user_id, action, ip_address, metadata)
      values ($1, $2, $3, $4::jsonb)
      returning id::text as id
    `,
    [params.userId ?? null, params.action, params.ipAddress ?? null, metadataJson]
  );

  const created = await pgOne<AuditLogEvent>(
    `
      select
        l.id::text,
        l.user_id::text,
        l.action,
        l.ip_address,
        l.metadata,
        l.created_at,
        p.username,
        a.email
      from app_audit_logs l
      left join profiles p on p.id = l.user_id
      left join user_accounts a on a.user_id = l.user_id
      where l.id = $1::bigint
      limit 1
    `,
    [row.id]
  );

  await pgQuery("select pg_notify($1, $2)", [AUDIT_LOGS_CHANNEL, JSON.stringify(created)]);
}

export async function listAuditLogs(limit = 200) {
  await ensureAuditLogTable();

  return pgRows<AuditLogRow>(
    `
      select
        l.id::text,
        l.user_id::text,
        l.action,
        l.ip_address,
        l.metadata,
        l.created_at,
        p.username,
        a.email
      from app_audit_logs l
      left join profiles p on p.id = l.user_id
      left join user_accounts a on a.user_id = l.user_id
      order by l.created_at desc
      limit $1
    `,
    [limit]
  );
}

export async function countAuditLogsSince(intervalText: string) {
  await ensureAuditLogTable();
  const row = await pgOne<{ count: string }>(
    `
      select count(*)::text as count
      from app_audit_logs
      where created_at >= now() - ($1::text)::interval
    `,
    [intervalText]
  );
  return Number(row.count ?? 0);
}

function isAuditLogEvent(value: unknown): value is AuditLogEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.action === "string" &&
    typeof item.created_at === "string" &&
    ("user_id" in item) &&
    ("ip_address" in item)
  );
}

export async function subscribeAuditLogChannel(listener: (event: AuditLogEvent) => void) {
  const client = createPgClient();
  await client.connect();
  await client.query(`listen ${AUDIT_LOGS_CHANNEL}`);

  const handleNotification = (msg: { payload?: string }) => {
    if (!msg.payload) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(msg.payload);
    } catch {
      return;
    }

    if (!isAuditLogEvent(parsed)) return;
    listener(parsed);
  };

  client.on("notification", handleNotification);

  return async () => {
    client.off("notification", handleNotification);
    try {
      await client.query(`unlisten ${AUDIT_LOGS_CHANNEL}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  };
}
