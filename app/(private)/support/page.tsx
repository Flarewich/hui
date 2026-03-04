import { revalidatePath } from "next/cache";
import SupportChat from "@/components/SupportChat";
import { requireUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";

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
};

async function ensureUserThread(userId: string) {
  const { supabase } = await requireUser();

  const { data: existing } = await supabase
    .from("support_threads")
    .select("id, user_id, status, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<Thread[]>();

  if (existing && existing.length > 0) return existing[0];

  const { data: created } = await supabase
    .from("support_threads")
    .insert({ user_id: userId, status: "open" })
    .select("id, user_id, status, updated_at")
    .single<Thread>();

  return created ?? null;
}

export default async function SupportPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { supabase, user, profile } = await requireUser();
  const thread = await ensureUserThread(user.id);

  const { data: rawMessages } = thread
    ? await supabase
        .from("support_messages")
        .select("id, thread_id, sender_id, body, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
        .returns<Message[]>()
    : { data: [] as Message[] };

  const senderIds = [...new Set((rawMessages ?? []).map((m) => m.sender_id).filter(Boolean))];
  const { data: senderProfiles } = senderIds.length
    ? await supabase.from("profiles").select("id, username, role").in("id", senderIds).returns<Profile[]>()
    : { data: [] as Profile[] };

  const profileMap = new Map((senderProfiles ?? []).map((p) => [p.id, p]));

  async function sendMessage(formData: FormData) {
    "use server";

    const { supabase, user } = await requireUser();
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    const currentThread = await ensureUserThread(user.id);
    if (!currentThread?.id) return;

    await supabase.from("support_messages").insert({
      thread_id: currentThread.id,
      sender_id: user.id,
      body,
    });

    await supabase
      .from("support_threads")
      .update({ updated_at: new Date().toISOString(), status: "open" })
      .eq("id", currentThread.id);

    revalidatePath("/support");
  }

  return (
    <SupportChat
      locale={locale}
      title={isEn ? "Support" : "Поддержка"}
      subtitle={isEn ? "Describe your issue and we will reply in this chat." : "Опишите проблему, и мы ответим в этом чате."}
      activeThreadId={thread?.id}
      messages={(rawMessages ?? []).map((m) => {
        const sender = profileMap.get(m.sender_id);
        const isMine = m.sender_id === user.id;
        const senderName = isMine
          ? profile?.username || user.email || (isEn ? "You" : "Вы")
          : sender?.role === "admin"
            ? (isEn ? "Support" : "Поддержка")
            : sender?.username || (isEn ? "User" : "Пользователь");

        return {
          id: m.id,
          body: m.body,
          created_at: m.created_at,
          senderName,
          isMine,
        };
      })}
      emptyText={isEn ? "This thread is empty. Send the first message." : "Диалог пока пуст. Напишите первое сообщение."}
      sendAction={sendMessage}
    />
  );
}
