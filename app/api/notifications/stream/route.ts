import { getCurrentSession } from "@/lib/sessionAuth";
import { subscribeNotificationChannel } from "@/lib/notificationsRealtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const unsubscribe = await subscribeNotificationChannel(session.user.id, (event) => {
        push(sseMessage("notification", event));
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
