import { randomUUID } from "crypto";
import { createPgClient, pgQuery, pgRows } from "@/lib/postgres";
import { createNotifications, listAdminUserIds } from "@/lib/notifications";

export type AdminChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  username: string | null;
};

type AdminChatEvent = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

const ADMIN_CHAT_CHANNEL = "admin_chat_events";

let ensuredAdminChatTables = false;

export async function ensureAdminChatTables() {
  if (ensuredAdminChatTables) return;

  await pgQuery(`
    create table if not exists admin_chat_messages (
      id uuid primary key,
      sender_id uuid not null references profiles(id) on delete cascade,
      body text not null,
      created_at timestamptz not null default now()
    )
  `);

  await pgQuery(`
    create index if not exists idx_admin_chat_messages_created_at
    on admin_chat_messages (created_at desc)
  `);

  await pgQuery(`
    create table if not exists admin_chat_reads (
      user_id uuid primary key references profiles(id) on delete cascade,
      last_read_at timestamptz not null default now()
    )
  `);

  ensuredAdminChatTables = true;
}

export async function listAdminChatMessages(limit = 100) {
  await ensureAdminChatTables();
  return pgRows<AdminChatMessage>(
    `
      select
        m.id,
        m.sender_id,
        m.body,
        m.created_at,
        p.username
      from admin_chat_messages m
      left join profiles p on p.id = m.sender_id
      order by m.created_at asc
      limit $1
    `,
    [limit]
  );
}

export async function createAdminChatMessage(senderId: string, body: string) {
  await ensureAdminChatTables();

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await pgQuery(
    `
      insert into admin_chat_messages (id, sender_id, body, created_at)
      values ($1, $2, $3, $4)
    `,
    [id, senderId, body, createdAt]
  );

  await pgQuery("select pg_notify($1, $2)", [
    ADMIN_CHAT_CHANNEL,
    JSON.stringify({ id, senderId, body, createdAt } satisfies AdminChatEvent),
  ]);

  const adminIds = await listAdminUserIds();
  const recipients = adminIds.filter((userId) => userId !== senderId);
  if (recipients.length > 0) {
    await createNotifications(
      recipients.map((userId) => ({
        userId,
        type: "admin_chat_message",
        title: "New admin message",
        body: body.slice(0, 180),
        href: "/admin/chat",
      }))
    );
  }
}

export async function countUnreadAdminChat(userId: string) {
  await ensureAdminChatTables();
  const rows = await pgRows<{ count: string }>(
    `
      select count(*)::text as count
      from admin_chat_messages m
      left join admin_chat_reads r on r.user_id = $1
      where m.sender_id <> $1
        and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    `,
    [userId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function markAdminChatRead(userId: string) {
  await ensureAdminChatTables();
  await pgQuery(
    `
      insert into admin_chat_reads (user_id, last_read_at)
      values ($1, now())
      on conflict (user_id) do update
      set last_read_at = excluded.last_read_at
    `,
    [userId]
  );
}

export async function subscribeAdminChatChannel(listener: (event: AdminChatEvent) => void) {
  const client = createPgClient();
  await client.connect();
  await client.query(`listen ${ADMIN_CHAT_CHANNEL}`);

  const handleNotification = (msg: { payload?: string }) => {
    if (!msg.payload) return;
    try {
      const parsed = JSON.parse(msg.payload) as AdminChatEvent;
      if (
        typeof parsed.id === "string" &&
        typeof parsed.senderId === "string" &&
        typeof parsed.body === "string" &&
        typeof parsed.createdAt === "string"
      ) {
        listener(parsed);
      }
    } catch {}
  };

  client.on("notification", handleNotification);

  return async () => {
    client.off("notification", handleNotification);
    try {
      await client.query(`unlisten ${ADMIN_CHAT_CHANNEL}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  };
}
