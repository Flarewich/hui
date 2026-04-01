import { NextResponse } from "next/server";
import { getUserEmail, listAdminRecipients, queueEmail } from "@/lib/email";
import { createNotification, createNotifications } from "@/lib/notifications";
import { getCurrentSession } from "@/lib/sessionAuth";
import { appendSupportMessage, ensureUserThread, getProfilesByIds, getThreadMessages, type SupportThread } from "@/lib/support";
import { pgMaybeOne, pgQuery, pgRows } from "@/lib/postgres";
import { assertSameOriginRequest, consumeRateLimit, getRequestIp, sanitizeTextInput } from "@/lib/security";

export const runtime = "nodejs";

type Profile = {
  id: string;
  username: string | null;
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

export async function GET(request: Request) {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await pgMaybeOne<Profile>(
    `
      select id, username, role, is_banned, banned_until, restricted_until
      from profiles
      where id = $1
      limit 1
    `,
    [user.id]
  );
  if (isBlocked(me ?? null)) {
    return NextResponse.json({ error: "Blocked" }, { status: 403 });
  }

  const isAdmin = me?.role === "admin" || user.app_metadata.role === "admin";
  if (!isAdmin) {
    const thread = await ensureUserThread(user.id);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    const messages = await getThreadMessages(thread.id);

    return NextResponse.json({
      role: "user",
      threads: [{ ...thread, label: me?.username ?? user.email ?? "You" }],
      activeThreadId: thread.id,
      messages,
      me: { id: user.id, username: me?.username ?? null },
    });
  }

  const url = new URL(request.url);
  const requestedThreadId = url.searchParams.get("thread");
  const threads = await pgRows<SupportThread>(
    `
      select id, user_id, status, updated_at
      from support_threads
      order by updated_at desc
      limit 100
    `
  );
  const activeThread = threads.find((x) => x.id === requestedThreadId) ?? threads[0] ?? null;
  const activeThreadId = activeThread?.id ?? null;

  const userIds = [...new Set(threads.map((t) => t.user_id))];
  const users = userIds.length ? await getProfilesByIds(userIds) : [];
  const userMap = new Map(users.map((u) => [u.id, u.username]));
  const messages = activeThreadId ? await getThreadMessages(activeThreadId) : [];

  return NextResponse.json({
    role: "admin",
    threads: threads.map((t) => ({
      ...t,
      label: userMap.get(t.user_id) ?? `User ${t.user_id.slice(0, 8)}`,
    })),
    activeThreadId,
    messages,
    me: { id: user.id, username: me?.username ?? null },
  });
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Blocked" }, { status: 403 });
  }

  const bodyData = (await request.json().catch(() => null)) as
    | { body?: string; threadId?: string }
    | null;
  const body = sanitizeTextInput(bodyData?.body, { maxLength: 2000, multiline: true });
  const incomingThreadId = sanitizeTextInput(bodyData?.threadId, { maxLength: 120 });
  if (!body) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const isAdmin = me?.role === "admin" || user.app_metadata.role === "admin";
  const ip = getRequestIp(request);

  const ipRate = await consumeRateLimit({
    action: isAdmin ? "support:admin-message:ip" : "support:user-message:ip",
    key: ip,
    limit: isAdmin ? 60 : 20,
    windowSeconds: 60,
  });
  if (!ipRate.allowed) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  const userRate = await consumeRateLimit({
    action: isAdmin ? "support:admin-message:user" : "support:user-message:user",
    key: user.id,
    limit: isAdmin ? 60 : 15,
    windowSeconds: 60,
  });
  if (!userRate.allowed) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  let threadId = incomingThreadId;
  let targetUserId = user.id;

  if (!isAdmin) {
    const thread = await ensureUserThread(user.id);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    threadId = thread.id;
  } else {
    if (!threadId) {
      return NextResponse.json({ error: "Thread is required for admin reply" }, { status: 400 });
    }
    const selectedThread = await pgMaybeOne<{ id: string; user_id: string }>(
      `
        select id, user_id
        from support_threads
        where id = $1
        limit 1
      `,
      [threadId]
    );
    if (!selectedThread?.user_id) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    targetUserId = selectedThread.user_id;
  }

  await appendSupportMessage({
    threadId,
    senderId: user.id,
    targetUserId,
    body,
  });

  if (isAdmin) {
    await createNotification({
      userId: targetUserId,
      type: "support_reply",
      title: "New support reply",
      body: body.slice(0, 180),
      href: "/support",
    });

    const userEmail = await getUserEmail(targetUserId);
    if (userEmail) {
      await queueEmail({
        toEmail: userEmail,
        subject: "New support reply",
        textBody: `Support replied to your request:\n\n${body}\n\nOpen: /support`,
        kind: "support_reply",
        userId: targetUserId,
        meta: { threadId },
      });
    }
  } else {
    const admins = await listAdminRecipients();
    await createNotifications(
      admins.map((admin) => ({
        userId: admin.user_id,
        type: "support_message",
        title: "New support message",
        body: body.slice(0, 180),
        href: "/admin/support",
      }))
    );
  }

  return NextResponse.json({ ok: true, threadId });
}

export async function PATCH(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Blocked" }, { status: 403 });
  }

  const isAdmin = me?.role === "admin" || user.app_metadata.role === "admin";
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminRate = await consumeRateLimit({
    action: "support:admin-status:user",
    key: user.id,
    limit: 40,
    windowSeconds: 60,
  });
  if (!adminRate.allowed) {
    return NextResponse.json({ error: "Too many status changes. Please slow down." }, { status: 429 });
  }

  const bodyData = (await request.json().catch(() => null)) as
    | { threadId?: string; status?: string }
    | null;
  const threadId = sanitizeTextInput(bodyData?.threadId, { maxLength: 120 });
  const status = sanitizeTextInput(bodyData?.status, { maxLength: 16 });
  if (!threadId || (status !== "open" && status !== "closed")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await pgQuery(
    `
      update support_threads
      set status = $2, updated_at = now()
      where id = $1
    `,
    [threadId, status]
  );

  return NextResponse.json({ ok: true, threadId, status });
}
