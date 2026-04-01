import { subscribeAuditLogChannel } from "@/lib/audit";
import { getCurrentSession } from "@/lib/sessionAuth";
import { pgMaybeOne } from "@/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await pgMaybeOne<{ role: string | null }>(
    `
      select role
      from profiles
      where id = $1
      limit 1
    `,
    [user.id]
  );
  const isAdmin = profile?.role === "admin" || user.app_metadata.role === "admin";
  if (!isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const unsubscribe = await subscribeAuditLogChannel((event) => {
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
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
