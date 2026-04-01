import { getCurrentSession } from "@/lib/sessionAuth";
import { pgMaybeOne } from "@/lib/postgres";
import { subscribeSupportChannel } from "@/lib/supportRealtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Profile = {
  id: string;
  role: string | null;
  is_banned?: boolean | null;
  banned_until?: string | null;
  restricted_until?: string | null;
};

function isBlocked(profile: Profile | null) {
  const now = Date.now();
  const isBanned =
    Boolean(profile?.is_banned) ||
    (profile?.banned_until ? new Date(profile.banned_until).getTime() > now : false);
  const isRestricted = profile?.restricted_until
    ? new Date(profile.restricted_until).getTime() > now
    : false;
  return isBanned || isRestricted;
}

function sseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const me = await pgMaybeOne<Profile>(
    `
      select id, role, is_banned, banned_until, restricted_until
      from profiles
      where id = $1
      limit 1
    `,
    [user.id]
  );
  if (isBlocked(me ?? null)) {
    return new Response("Blocked", { status: 403 });
  }

  const isAdmin = me?.role === "admin" || user.app_metadata.role === "admin";
  const channel = isAdmin ? "admin" : user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const unsubscribe = await subscribeSupportChannel(channel, (event) => {
        push(sseMessage("message", event));
      });

      push(sseMessage("ready", { ok: true }));
      const heartbeat = setInterval(() => {
        push(`: ping ${Date.now()}\n\n`);
      }, 15000);

      const abort = async () => {
        clearInterval(heartbeat);
        await unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      request.signal.addEventListener("abort", abort, { once: true });
    },
    cancel() {
      return undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
