import { getCurrentSession } from "@/lib/sessionAuth";
import {
  countUnreadNotifications,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    listUserNotifications(session.user.id, 8),
    countUnreadNotifications(session.user.id),
  ]);

  return Response.json({ notifications, unreadCount });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action === "markAllRead") {
    await markAllNotificationsRead(session.user.id);
  }
  if (body?.action === "markRead" && typeof (body as { notificationId?: unknown }).notificationId === "string") {
    await markNotificationRead(session.user.id, (body as { notificationId: string }).notificationId);
  }

  const [notifications, unreadCount] = await Promise.all([
    listUserNotifications(session.user.id, 8),
    countUnreadNotifications(session.user.id),
  ]);

  return Response.json({ notifications, unreadCount });
}
