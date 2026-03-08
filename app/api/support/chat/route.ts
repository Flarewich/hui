import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";

type Thread = {
  id: string;
  user_id: string;
  status: string;
  updated_at: string;
};

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  role: string | null;
  is_banned?: boolean | null;
  banned_until?: string | null;
  restricted_until?: string | null;
};

async function ensureLegacyTicketId(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  userId: string
) {
  const { data: existing } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from("support_tickets")
    .insert({ user_id: userId, status: "open" })
    .select("id")
    .single<{ id: string }>();

  return created?.id ?? null;
}

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

async function ensureUserThread(supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>, userId: string) {
  const { data: existing } = await supabase
    .from("support_threads")
    .select("id, user_id, status, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<Thread>();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("support_threads")
    .insert({ user_id: userId, status: "open" })
    .select("id, user_id, status, updated_at")
    .single<Thread>();

  if (error || !created) return null;
  return created;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("id, username, role, is_banned, banned_until, restricted_until")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (isBlocked(me ?? null)) {
    return NextResponse.json({ error: "Blocked" }, { status: 403 });
  }

  const isAdmin =
    me?.role === "admin" ||
    (user.app_metadata && typeof user.app_metadata === "object" && user.app_metadata.role === "admin");

  if (!isAdmin) {
    const thread = await ensureUserThread(supabase, user.id);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

    const { data: messages } = await supabase
      .from("support_messages")
      .select("id, thread_id, sender_id, body, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .returns<Message[]>();

    return NextResponse.json({
      role: "user",
      threads: [{ ...thread, label: me?.username ?? user.email ?? "You" }],
      activeThreadId: thread.id,
      messages: messages ?? [],
      me: { id: user.id, username: me?.username ?? null },
    });
  }

  const url = new URL(request.url);
  const requestedThreadId = url.searchParams.get("thread");

  const { data: threads } = await supabase
    .from("support_threads")
    .select("id, user_id, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100)
    .returns<Thread[]>();

  const activeThread =
    (threads ?? []).find((x) => x.id === requestedThreadId) ?? (threads ?? [])[0] ?? null;
  const activeThreadId = activeThread?.id ?? null;

  const userIds = [...new Set((threads ?? []).map((t) => t.user_id))];
  const { data: users } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds)
        .returns<Array<{ id: string; username: string | null }>>()
    : { data: [] as Array<{ id: string; username: string | null }> };

  const userMap = new Map((users ?? []).map((u) => [u.id, u.username]));

  const { data: messages } = activeThreadId
    ? await supabase
        .from("support_messages")
        .select("id, thread_id, sender_id, body, created_at")
        .eq("thread_id", activeThreadId)
        .order("created_at", { ascending: true })
        .returns<Message[]>()
    : { data: [] as Message[] };

  return NextResponse.json({
    role: "admin",
    threads: (threads ?? []).map((t) => ({
      ...t,
      label: userMap.get(t.user_id) ?? `User ${t.user_id.slice(0, 8)}`,
    })),
    activeThreadId,
    messages: messages ?? [],
    me: { id: user.id, username: me?.username ?? null },
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, is_banned, banned_until, restricted_until")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (isBlocked(me ?? null)) {
    return NextResponse.json({ error: "Blocked" }, { status: 403 });
  }

  const bodyData = (await request.json().catch(() => null)) as
    | { body?: string; threadId?: string }
    | null;
  const body = String(bodyData?.body ?? "").trim();
  const incomingThreadId = String(bodyData?.threadId ?? "").trim();

  if (!body) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  if (body.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const isAdmin =
    me?.role === "admin" ||
    (user.app_metadata && typeof user.app_metadata === "object" && user.app_metadata.role === "admin");

  let threadId = incomingThreadId;
  let targetUserId = user.id;
  if (!isAdmin) {
    const thread = await ensureUserThread(supabase, user.id);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    threadId = thread.id;
  } else {
    if (!threadId) {
      return NextResponse.json({ error: "Thread is required for admin reply" }, { status: 400 });
    }
    const { data: selectedThread } = await supabase
      .from("support_threads")
      .select("id, user_id")
      .eq("id", threadId)
      .maybeSingle<{ id: string; user_id: string }>();
    if (!selectedThread?.user_id) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    targetUserId = selectedThread.user_id;
  }

  const legacyTicketId = await ensureLegacyTicketId(supabase, targetUserId);

  const { error: insertError } = await supabase.from("support_messages").insert({
    thread_id: threadId,
    ticket_id: legacyTicketId,
    sender_id: user.id,
    body,
    message: body,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  await supabase
    .from("support_threads")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", threadId);

  if (legacyTicketId) {
    await supabase
      .from("support_tickets")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", legacyTicketId);
  }

  return NextResponse.json({ ok: true, threadId });
}
