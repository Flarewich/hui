import { createPgClient, pgQuery } from "@/lib/postgres";

export type SupportEvent = {
  threadId: string;
  sentAt: string;
};

const SUPPORT_CHANNEL = "support_events";

function isSupportEvent(value: unknown): value is SupportEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.threadId === "string" && typeof item.sentAt === "string";
}

export async function notifySupportEvent(params: {
  threadId: string;
  senderId: string;
  targetUserId: string;
}) {
  const payload = JSON.stringify({
    threadId: params.threadId,
    senderId: params.senderId,
    targetUserId: params.targetUserId,
    sentAt: new Date().toISOString(),
  });

  await pgQuery("select pg_notify($1, $2)", [SUPPORT_CHANNEL, payload]);
}

export async function subscribeSupportChannel(
  channel: string,
  listener: (event: SupportEvent) => void
) {
  const client = createPgClient();
  await client.connect();
  await client.query(`listen ${SUPPORT_CHANNEL}`);

  const handleNotification = (msg: { payload?: string }) => {
    if (!msg.payload) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(msg.payload);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object") return;
    const item = parsed as Record<string, unknown>;
    const channels = new Set<string>(["admin"]);
    if (typeof item.senderId === "string") channels.add(item.senderId);
    if (typeof item.targetUserId === "string") channels.add(item.targetUserId);
    if (!channels.has(channel)) return;

    const event = {
      threadId: typeof item.threadId === "string" ? item.threadId : "",
      sentAt: typeof item.sentAt === "string" ? item.sentAt : "",
    };

    if (isSupportEvent(event)) {
      listener(event);
    }
  };

  client.on("notification", handleNotification);

  return async () => {
    client.off("notification", handleNotification);
    try {
      await client.query(`unlisten ${SUPPORT_CHANNEL}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  };
}
