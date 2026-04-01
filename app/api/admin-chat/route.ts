import { NextResponse } from "next/server";
import { countUnreadAdminChat, createAdminChatMessage, listAdminChatMessages, markAdminChatRead } from "@/lib/adminChat";
import { getCurrentSession } from "@/lib/sessionAuth";
import { pgMaybeOne } from "@/lib/postgres";
import { sanitizeTextInput } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminContext() {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) return null;

  const profile = await pgMaybeOne<{ username: string | null; role: string | null }>(
    `
      select username, role
      from profiles
      where id = $1
      limit 1
    `,
    [user.id]
  );

  const isAdmin = profile?.role === "admin" || user.app_metadata.role === "admin";
  if (!isAdmin) return null;
  return { user, profile };
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, profile } = context;
  const [messages, unreadCount] = await Promise.all([
    listAdminChatMessages(120),
    countUnreadAdminChat(user.id),
  ]);

  return NextResponse.json({
    messages,
    me: { id: user.id, username: profile?.username ?? null },
    unreadCount,
  });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = context;
  const bodyData = (await request.json().catch(() => null)) as { body?: string } | null;
  const body = sanitizeTextInput(bodyData?.body, { maxLength: 2000, multiline: true });

  if (!body) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  await createAdminChatMessage(user.id, body);
  return NextResponse.json({ ok: true });
}

export async function PATCH() {
  const context = await getAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await markAdminChatRead(context.user.id);
  return NextResponse.json({ ok: true });
}
