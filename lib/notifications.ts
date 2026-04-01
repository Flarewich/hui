import { randomUUID } from "crypto";
import { pgQuery, pgRows, pgOne } from "@/lib/postgres";

export type AppNotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

let ensuredNotificationTables = false;

export async function ensureNotificationTables() {
  if (ensuredNotificationTables) return;

  await pgQuery(`
    create table if not exists app_notifications (
      id uuid primary key,
      user_id uuid not null references profiles(id) on delete cascade,
      type text not null,
      title text not null,
      body text,
      href text,
      is_read boolean not null default false,
      created_at timestamptz not null default now(),
      read_at timestamptz
    )
  `);

  await pgQuery(`
    create index if not exists idx_app_notifications_user_created_at
    on app_notifications (user_id, created_at desc)
  `);

  await pgQuery(`
    create index if not exists idx_app_notifications_user_is_read
    on app_notifications (user_id, is_read, created_at desc)
  `);

  ensuredNotificationTables = true;
}

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
}) {
  await ensureNotificationTables();
  await pgQuery(
    `
      insert into app_notifications (id, user_id, type, title, body, href)
      values ($1, $2, $3, $4, $5, $6)
    `,
    [randomUUID(), params.userId, params.type, params.title, params.body ?? null, params.href ?? null]
  );
}

export async function createNotifications(params: Array<{
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
}>) {
  for (const item of params) {
    await createNotification(item);
  }
}

export async function listUserNotifications(userId: string, limit = 20) {
  await ensureNotificationTables();
  return pgRows<AppNotificationRow>(
    `
      select id, type, title, body, href, is_read, created_at
      from app_notifications
      where user_id = $1
      order by created_at desc
      limit $2
    `,
    [userId, limit]
  );
}

export async function countUnreadNotifications(userId: string) {
  await ensureNotificationTables();
  const row = await pgOne<{ count: string }>(
    `
      select count(*)::text as count
      from app_notifications
      where user_id = $1 and is_read = false
    `,
    [userId]
  );
  return Number(row.count ?? 0);
}

export async function markAllNotificationsRead(userId: string) {
  await ensureNotificationTables();
  await pgQuery(
    `
      update app_notifications
      set is_read = true, read_at = now()
      where user_id = $1 and is_read = false
    `,
    [userId]
  );
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await ensureNotificationTables();
  await pgQuery(
    `
      update app_notifications
      set is_read = true, read_at = now()
      where user_id = $1 and id = $2
    `,
    [userId, notificationId]
  );
}

export async function listAdminUserIds() {
  await ensureNotificationTables();
  const rows = await pgRows<{ id: string }>(
    `
      select id
      from profiles
      where role = 'admin'
    `
  );
  return rows.map((row) => row.id);
}
