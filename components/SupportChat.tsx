"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Thread = {
  id: string;
  user_id: string;
  label: string;
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

type ChatPayload = {
  role: "user" | "admin";
  threads: Thread[];
  activeThreadId: string | null;
  messages: Message[];
  me: { id: string; username: string | null };
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
  emptyText,
  locale = "ru",
}: {
  title: string;
  subtitle: string;
  emptyText: string;
  locale?: Locale;
}) {
  const isEn = locale === "en";
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [data, setData] = useState<ChatPayload | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const activeThread = useMemo(
    () => data?.threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, data?.threads]
  );

  const load = useCallback(
    async (threadId?: string | null, background = false) => {
      if (!background) {
        setLoading(true);
        setError("");
      }

      try {
        const query = threadId ? `?thread=${encodeURIComponent(threadId)}` : "";
        const res = await fetch(`/api/support/chat${query}`, { cache: "no-store" });
        const payload = (await res.json()) as ChatPayload | { error?: string };
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || "Failed to load chat");
        }

        const okPayload = payload as ChatPayload;
        setData(okPayload);
        setActiveThreadId((prev) => {
          if (prev && okPayload.threads.some((thread) => thread.id === prev)) {
            return prev;
          }
          return okPayload.activeThreadId;
        });
      } catch (e) {
        if (!background) {
          setError(e instanceof Error ? e.message : isEn ? "Failed to load chat" : "Не удалось загрузить чат");
        }
      } finally {
        if (!background) setLoading(false);
      }
    },
    [isEn]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.role) return;

    const eventSource = new EventSource("/api/support/stream");
    eventSource.addEventListener("message", () => {
      void load(activeThreadId, true);
    });
    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    const fallback = window.setInterval(() => {
      void load(activeThreadId, true);
    }, 30000);

    return () => {
      window.clearInterval(fallback);
      eventSource.close();
    };
  }, [activeThreadId, data?.role, load]);

  async function sendMessage() {
    const body = text.trim();
    if (!body) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          threadId: data?.role === "admin" ? activeThreadId : undefined,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to send");
      }

      setText("");
      await load(activeThreadId, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to send" : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  }

  async function setThreadStatus(status: "open" | "closed") {
    if (!activeThreadId) return;

    setError("");
    try {
      const res = await fetch("/api/support/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeThreadId, status }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update thread");
      }
      await load(activeThreadId, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to update status" : "Не удалось обновить статус");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-white/70">{subtitle}</p>
      </div>

      {data?.role === "admin" && activeThread && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
          <div className="text-sm text-white/70">
            {isEn ? "User" : "Пользователь"}: {activeThread.label} • {isEn ? "Status" : "Статус"}: {activeThread.status}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void setThreadStatus("open")}
              className="rounded-xl border border-white/20 bg-black/20 px-3 py-1.5 text-xs hover:bg-white/5"
            >
              {isEn ? "Open" : "Открыть"}
            </button>
            <button
              type="button"
              onClick={() => void setThreadStatus("closed")}
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
            >
              {isEn ? "Close" : "Закрыть"}
            </button>
          </div>
        </div>
      )}

      {data?.threads && data.threads.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold">{isEn ? "Threads" : "Диалоги"}</div>
          <div className="grid gap-2 md:grid-cols-2">
            {data.threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => {
                  setActiveThreadId(thread.id);
                  void load(thread.id);
                }}
                className={[
                  "rounded-2xl border p-3 text-left text-sm transition",
                  thread.id === activeThreadId ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:bg-white/5",
                ].join(" ")}
              >
                <div className="font-medium">{thread.label}</div>
                <div className="mt-1 text-xs text-white/60">
                  {isEn ? "Status" : "Статус"}: {thread.status} • {isEn ? "Updated" : "Обновлен"}: {toDate(thread.updated_at, locale)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[420px]">
          {loading && <div className="text-sm text-white/60">{isEn ? "Loading..." : "Загрузка..."}</div>}

          {!loading && (data?.messages.length ?? 0) === 0 && (
            <div className="text-sm text-white/60">{emptyText}</div>
          )}

          {(data?.messages ?? []).map((message) => {
            const isMine = message.sender_id === data?.me.id;
            const senderName = isMine
              ? isEn
                ? "You"
                : "Вы"
              : data?.role === "admin"
                ? isEn
                  ? "User"
                  : "Пользователь"
                : isEn
                  ? "Support"
                  : "Поддержка";

            return (
              <div key={message.id} className={isMine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={[
                    "max-w-[94%] border px-3 py-2 text-sm sm:max-w-[85%]",
                    isMine
                      ? "rounded-2xl rounded-br-sm border-cyan-400/20 bg-cyan-500/10 text-right"
                      : "rounded-2xl rounded-bl-sm border-white/10 bg-black/20 text-left",
                  ].join(" ")}
                >
                  <div className="text-[11px] text-white/50">{senderName}</div>
                  <div className="mt-1 whitespace-pre-wrap">{message.body}</div>
                  <div className="mt-1 text-[11px] text-white/40">{toDate(message.created_at, locale)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="mt-4 space-y-3">
          {data?.role === "admin" && !activeThreadId && (
            <div className="text-sm text-white/60">{isEn ? "No thread selected." : "Диалог не выбран."}</div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
            placeholder={isEn ? "Enter message" : "Введите сообщение"}
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !text.trim() || (data?.role === "admin" && !activeThreadId)}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (isEn ? "Sending..." : "Отправка...") : isEn ? "Send" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
