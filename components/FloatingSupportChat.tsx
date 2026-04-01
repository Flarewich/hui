"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  attachment_url: string | null;
  attachment_kind: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
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

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M21 11.5 12.9 19.6a5 5 0 1 1-7.1-7.1l9.2-9.2a3.5 3.5 0 1 1 5 5L9.8 18.5a2 2 0 1 1-2.8-2.8l8.5-8.5" />
    </svg>
  );
}

function renderAttachment(message: Message) {
  if (!message.attachment_url) return null;

  if (message.attachment_kind === "image") {
    return (
      <a href={message.attachment_url} target="_blank" rel="noreferrer" className="mt-2 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.attachment_url}
          alt={message.attachment_name ?? "attachment"}
          className="max-h-52 w-full rounded-lg border border-white/10 object-cover"
        />
      </a>
    );
  }

  if (message.attachment_kind === "video") {
    return (
      <video controls preload="metadata" className="mt-2 max-h-52 w-full rounded-lg border border-white/10">
        <source src={message.attachment_url} type={message.attachment_mime ?? "video/mp4"} />
      </video>
    );
  }

  return null;
}

export default function FloatingSupportChat({ locale }: { locale: Locale }) {
  const isEn = locale === "en";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [data, setData] = useState<ChatPayload | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

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
        setData((prev) => {
          const previousCount = prev?.messages.length ?? 0;
          if (background && previousCount < okPayload.messages.length && !open) {
            setHasUnread(true);
          }
          return okPayload;
        });
        setActiveThreadId((prev) => {
          if (prev && okPayload.threads.some((thread) => thread.id === prev)) {
            return prev;
          }
          return okPayload.activeThreadId;
        });
      } catch (e) {
        if (!background) {
          setError(e instanceof Error ? e.message : isEn ? "Chat load error" : "Ошибка загрузки чата");
        }
      } finally {
        if (!background) setLoading(false);
      }
    },
    [isEn, open]
  );

  useEffect(() => {
    if (!open) return;
    setHasUnread(false);
    void load(activeThreadId);
  }, [activeThreadId, load, open]);

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
    if (!body && !attachment) return;

    setSending(true);
    setError("");
    try {
      let res: Response;
      if (attachment) {
        const formData = new FormData();
        formData.set("body", body);
        if (data?.role === "admin" && activeThreadId) {
          formData.set("threadId", activeThreadId);
        }
        formData.set("attachment", attachment);
        res = await fetch("/api/support/chat", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/support/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, threadId: data?.role === "admin" ? activeThreadId : undefined }),
        });
      }

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to send");
      }

      setText("");
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await load(activeThreadId, true);
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
            <div className="text-sm font-semibold">{isEn ? "Support chat" : "Чат поддержки"}</div>
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
                {(data.threads ?? []).map((thread) => (
                  <option key={thread.id} value={thread.id}>
                    {thread.label} [{thread.status}]
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="h-[340px] space-y-2 overflow-y-auto px-3 py-3">
            {loading && <div className="text-xs text-white/60">{isEn ? "Loading..." : "Загрузка..."}</div>}
            {!loading && (data?.messages?.length ?? 0) === 0 && (
              <div className="text-xs text-white/60">{isEn ? "No messages yet." : "Сообщений пока нет."}</div>
            )}
            {(data?.messages ?? []).map((message) => {
              const mine = message.sender_id === data?.me?.id;
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
                <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[88%] border px-2.5 py-2 text-xs",
                      mine
                        ? "rounded-xl rounded-br-sm border-cyan-400/30 bg-cyan-500/15 text-right"
                        : "rounded-xl rounded-bl-sm border-white/10 bg-black/30 text-left",
                    ].join(" ")}
                  >
                    <div className="text-[10px] text-white/50">{label}</div>
                    {message.body ? <div className="mt-1 whitespace-pre-wrap">{message.body}</div> : null}
                    {renderAttachment(message)}
                    {message.attachment_url && (
                      <div className="mt-2">
                        <a href={message.attachment_url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                          {message.attachment_name ?? (isEn ? "Open attachment" : "Открыть вложение")}
                        </a>
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-white/40">{toDate(message.created_at, locale)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

          <div className="border-t border-white/10 p-3">
            {attachment && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-white/70">
                <span className="truncate">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAttachment(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="rounded-lg border border-white/15 px-2 py-1 hover:bg-white/5"
                >
                  {isEn ? "Remove" : "Убрать"}
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={isEn ? "Enter message" : "Введите сообщение..."}
                className="min-h-[58px] flex-1 resize-none rounded-xl border border-white/15 bg-black/30 px-2.5 py-2 text-xs outline-none focus:border-cyan-400/50"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-white/80 hover:bg-white/5"
                aria-label={isEn ? "Attach file" : "Прикрепить файл"}
                title={isEn ? "Attach file" : "Прикрепить файл"}
              >
                <PaperclipIcon />
              </button>
              <button
                onClick={() => void sendMessage()}
                disabled={sending || (!text.trim() && !attachment) || (data?.role === "admin" && !activeThreadId)}
                className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (isEn ? "Sending" : "Отправка") : isEn ? "Send" : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
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
