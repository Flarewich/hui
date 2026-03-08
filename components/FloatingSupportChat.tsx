"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

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
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FloatingSupportChat({ locale }: { locale: Locale }) {
  const isEn = locale === "en";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>("");
  const [text, setText] = useState("");
  const [hasUnread, setHasUnread] = useState(false);
  const [data, setData] = useState<ChatPayload | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const activeThread = useMemo(
    () => data?.threads.find((t) => t.id === activeThreadId) ?? null,
    [data?.threads, activeThreadId]
  );

  const load = useCallback(
    async (threadId?: string | null) => {
      setLoading(true);
      setError("");
      try {
        const query = threadId ? `?thread=${encodeURIComponent(threadId)}` : "";
        const res = await fetch(`/api/support/chat${query}`, { cache: "no-store" });
        const payload = (await res.json()) as ChatPayload | { error?: string };
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || "Failed to load chat");
        }
        const okPayload = payload as ChatPayload;
        setData(okPayload);
        setActiveThreadId(okPayload.activeThreadId);
      } catch (e) {
        setError(e instanceof Error ? e.message : isEn ? "Chat load error" : "Ошибка загрузки чата");
      } finally {
        setLoading(false);
      }
    },
    [isEn]
  );

  useEffect(() => {
    if (!open) return;
    setHasUnread(false);
    void load(activeThreadId);
  }, [open, load, activeThreadId]);

  useEffect(() => {
    if (!open || !data?.role) return;

    const channel = supabase.channel(`support-chat-${data.role}-${activeThreadId ?? "none"}`);

    if (data.role === "user" && activeThreadId) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${activeThreadId}`,
        },
        () => {
          if (open) {
            void load(activeThreadId);
          } else {
            setHasUnread(true);
          }
        }
      );
    } else if (data.role === "admin") {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
        },
        () => {
          if (open) {
            void load(activeThreadId);
          } else {
            setHasUnread(true);
          }
        }
      );
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_threads",
        },
        () => {
          if (open) {
            void load(activeThreadId);
          } else {
            setHasUnread(true);
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, data?.role, activeThreadId, load, supabase]);

  async function sendMessage() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, threadId: data?.role === "admin" ? activeThreadId : undefined }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to send");
      }
      setText("");
      await load(activeThreadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Send error" : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      {open && (
        <div className="mb-3 w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#040b1a]/95 shadow-2xl shadow-cyan-900/30 backdrop-blur-xl sm:w-[390px]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold">{isEn ? "Support chat" : "Чат поддержки"}</div>
              <div className="text-[11px] text-white/60">
                {data?.role === "admin" ? (isEn ? "Admin mode" : "Режим админа") : isEn ? "User mode" : "Режим пользователя"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              {isEn ? "Close" : "Закрыть"}
            </button>
          </div>

          {data?.role === "admin" && (data.threads?.length ?? 0) > 0 && (
            <div className="border-b border-white/10 px-3 py-2">
              <select
                className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs outline-none"
                value={activeThreadId ?? ""}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  setActiveThreadId(nextId);
                  void load(nextId);
                }}
              >
                {(data.threads ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} [{t.status}]
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="h-[340px] space-y-2 overflow-y-auto px-3 py-3">
            {loading && <div className="text-xs text-white/60">{isEn ? "Loading..." : "Загрузка..."}</div>}
            {!loading && (data?.messages?.length ?? 0) === 0 && (
              <div className="text-xs text-white/60">{isEn ? "No messages yet." : "Пока нет сообщений."}</div>
            )}
            {(data?.messages ?? []).map((m) => {
              const mine = m.sender_id === data?.me?.id;
              const label = mine
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
                <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[88%] border px-2.5 py-2 text-xs",
                      mine
                        ? "rounded-xl rounded-br-sm border-cyan-400/30 bg-cyan-500/15 text-right"
                        : "rounded-xl rounded-bl-sm border-white/10 bg-black/30 text-left",
                    ].join(" ")}
                  >
                    <div className="text-[10px] text-white/50">{label}</div>
                    <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                    <div className="mt-1 text-[10px] text-white/40">{toDate(m.created_at, locale)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

          <div className="border-t border-white/10 p-3">
            {data?.role === "admin" && !activeThread && (
              <div className="text-xs text-white/60">{isEn ? "No thread selected." : "Диалог не выбран."}</div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={isEn ? "Type message..." : "Введите сообщение..."}
                className="min-h-[58px] flex-1 resize-none rounded-xl border border-white/15 bg-black/30 px-2.5 py-2 text-xs outline-none focus:border-cyan-400/50"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={sending || !text.trim() || (data?.role === "admin" && !activeThreadId)}
                className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (isEn ? "Sending" : "Отправка") : isEn ? "Send" : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/45 bg-cyan-500/20 text-lg text-cyan-50 shadow-xl shadow-cyan-900/40 transition hover:bg-cyan-500/30"
        aria-label={isEn ? "Open support chat" : "Открыть чат поддержки"}
      >
        {hasUnread && !open && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-[#040b1a]" />
        )}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
          <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5v2h12V9H6Zm0 4v2h8v-2H6Z" />
        </svg>
      </button>
    </div>
  );
}
