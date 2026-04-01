import { createPgClient, pgQuery } from "@/lib/postgres";

export type NotificationEvent = {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
};

const NOTIFICATIONS_CHANNEL = "app_notification_events";

function isNotificationEvent(value: unknown): value is NotificationEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.userId === "string" &&
    typeof item.title === "string" &&
    (typeof item.body === "string" || item.body === null) &&
    (typeof item.href === "string" || item.href === null) &&
    typeof item.createdAt === "string"
  );
}

export async function notifyNotificationEvent(event: NotificationEvent) {
  await pgQuery("select pg_notify($1, $2)", [NOTIFICATIONS_CHANNEL, JSON.stringify(event)]);
}

export async function subscribeNotificationChannel(
  userId: string,
  listener: (event: NotificationEvent) => void
) {
  const client = createPgClient();
  await client.connect();
  await client.query(`listen ${NOTIFICATIONS_CHANNEL}`);

  const handleNotification = (msg: { payload?: string }) => {
    if (!msg.payload) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(msg.payload);
    } catch {
      return;
    }

    if (!isNotificationEvent(parsed) || parsed.userId !== userId) {
      return;
    }

    listener(parsed);
  };

  client.on("notification", handleNotification);

  return async () => {
    client.off("notification", handleNotification);
    try {
      await client.query(`unlisten ${NOTIFICATIONS_CHANNEL}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  };
}
