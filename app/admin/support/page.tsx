import { revalidatePath } from "next/cache";
import SupportChat from "@/components/SupportChat";
import { requireAdmin } from "@/lib/auth";
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

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { supabase, user } = await requireAdmin();
  const sp = await searchParams;

  const { data: threads } = await supabase
    .from("support_threads")
    .select("id, user_id, status, updated_at")
    .order("updated_at", { ascending: false })
    .returns<Thread[]>();

  const userIds = [...new Set((threads ?? []).map((t) => t.user_id))];
  const { data: users } = userIds.length
    ? await supabase.from("profiles").select("id, username, role").in("id", userIds).returns<Profile[]>()
    : { data: [] as Profile[] };

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const selectedThread = (threads ?? []).find((t) => t.id === sp.thread) || (threads ?? [])[0] || null;

  const { data: rawMessages } = selectedThread
    ? await supabase
        .from("support_messages")
        .select("id, thread_id, sender_id, body, created_at")
        .eq("thread_id", selectedThread.id)
        .order("created_at", { ascending: true })
        .returns<Message[]>()
    : { data: [] as Message[] };

  const senderIds = [...new Set((rawMessages ?? []).map((m) => m.sender_id).filter(Boolean))];
  const { data: senderProfiles } = senderIds.length
    ? await supabase.from("profiles").select("id, username, role").in("id", senderIds).returns<Profile[]>()
    : { data: [] as Profile[] };

  const senderMap = new Map((senderProfiles ?? []).map((p) => [p.id, p]));

  async function sendReply(formData: FormData) {
    "use server";

    const { supabase, user } = await requireAdmin();

    const threadId = String(formData.get("thread_id") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();

    if (!threadId || !body) return;

    await supabase.from("support_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      body,
    });

    await supabase
      .from("support_threads")
      .update({ updated_at: new Date().toISOString(), status: "open" })
      .eq("id", threadId);

    revalidatePath(`/admin/support?thread=${threadId}`);
    revalidatePath("/support");
  }

  async function setThreadStatus(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();

    const threadId = String(formData.get("thread_id") ?? "").trim();
    const status = String(formData.get("status") ?? "open").trim();

    if (!threadId) return;

    await supabase
      .from("support_threads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", threadId);

    revalidatePath(`/admin/support?thread=${threadId}`);
    revalidatePath("/support");
  }

  return (
    <div className="space-y-4">
      {selectedThread && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
          <div className="text-sm text-white/70">
            {isEn ? "User" : "Пользователь"}: {userMap.get(selectedThread.user_id)?.username ?? selectedThread.user_id.slice(0, 8)} • {isEn ? "Status" : "Статус"}: {selectedThread.status}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={setThreadStatus}>
              <input type="hidden" name="thread_id" value={selectedThread.id} />
              <input type="hidden" name="status" value="open" />
              <button type="submit" className="rounded-xl border border-white/20 bg-black/20 px-3 py-1.5 text-xs hover:bg-white/5">
                {isEn ? "Open" : "Открыть"}
              </button>
            </form>
            <form action={setThreadStatus}>
              <input type="hidden" name="thread_id" value={selectedThread.id} />
              <input type="hidden" name="status" value="closed" />
              <button type="submit" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20">
                {isEn ? "Close" : "Закрыть"}
              </button>
            </form>
          </div>
        </div>
      )}

      <SupportChat
        locale={locale}
        title={isEn ? "Support (admin)" : "Поддержка (админ)"}
        subtitle={isEn ? "User conversations" : "Диалоги с пользователями"}
        threads={(threads ?? []).map((t) => ({
          id: t.id,
          label: userMap.get(t.user_id)?.username || `${isEn ? "User" : "Пользователь"} ${t.user_id.slice(0, 8)}`,
          status: t.status,
          updated_at: t.updated_at,
        }))}
        activeThreadId={selectedThread?.id}
        messages={(rawMessages ?? []).map((m) => {
          const p = senderMap.get(m.sender_id);
          const isMine = m.sender_id === user.id;

          return {
            id: m.id,
            body: m.body,
            created_at: m.created_at,
            senderName: isMine ? (isEn ? "Admin" : "Админ") : p?.username || (isEn ? "User" : "Пользователь"),
            isMine,
          };
        })}
        emptyText={isEn ? "No messages in this thread yet." : "Для выбранного диалога пока нет сообщений."}
        sendAction={sendReply}
      />
    </div>
  );
}
