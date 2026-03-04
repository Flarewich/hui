import type { Locale } from "@/lib/i18n";

type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  senderName: string;
  isMine: boolean;
};

type ChatThread = {
  id: string;
  label: string;
  status: string;
  updated_at: string;
};

function toDate(ts: string, locale: Locale) {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportChat({
  title,
  subtitle,
  messages,
  threads,
  activeThreadId,
  emptyText,
  sendAction,
  locale = "ru",
}: {
  title: string;
  subtitle: string;
  messages: ChatMessage[];
  threads?: ChatThread[];
  activeThreadId?: string;
  emptyText: string;
  sendAction: (formData: FormData) => Promise<void>;
  locale?: Locale;
}) {
  const isEn = locale === "en";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-white/70">{subtitle}</p>
      </div>

      {threads && threads.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold">{isEn ? "Threads" : "Диалоги"}</div>
          <div className="grid gap-2 md:grid-cols-2">
            {threads.map((thread) => (
              <a
                key={thread.id}
                href={`?thread=${thread.id}`}
                className={[
                  "rounded-2xl border p-3 text-sm transition",
                  thread.id === activeThreadId ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:bg-white/5",
                ].join(" ")}
              >
                <div className="font-medium">{thread.label}</div>
                <div className="mt-1 text-xs text-white/60">
                  {isEn ? "Status" : "Статус"}: {thread.status} • {isEn ? "Updated" : "Обновлен"}: {toDate(thread.updated_at, locale)}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[420px]">
          {messages.map((m) => (
            <div key={m.id} className={m.isMine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={[
                  "max-w-[94%] rounded-2xl border px-3 py-2 text-sm sm:max-w-[85%]",
                  m.isMine ? "border-cyan-400/20 bg-cyan-500/10" : "border-white/10 bg-black/20",
                ].join(" ")}
              >
                <div className="text-[11px] text-white/50">{m.senderName}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                <div className="mt-1 text-[11px] text-white/40">{toDate(m.created_at, locale)}</div>
              </div>
            </div>
          ))}

          {messages.length === 0 && <div className="text-sm text-white/60">{emptyText}</div>}
        </div>

        <form action={sendAction} className="mt-4 space-y-3">
          {activeThreadId && <input type="hidden" name="thread_id" value={activeThreadId} />}
          <textarea
            name="body"
            required
            minLength={2}
            maxLength={2000}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
            placeholder={isEn ? "Enter message" : "Введите сообщение"}
          />
          <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            {isEn ? "Send" : "Отправить"}
          </button>
        </form>
      </div>
    </div>
  );
}
