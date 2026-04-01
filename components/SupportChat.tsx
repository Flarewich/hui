"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Thread = {
  id: string;
  user_id: string;
  label: string;
  status: string;
  updated_at: string;
  unread_count?: number;
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function threadStatusLabel(status: string, locale: Locale) {
  if (status === "open") return locale === "en" ? "Active" : "Активный";
  if (status === "closed") return locale === "en" ? "Archive" : "Архив";
  return status;
}

function threadStatusClass(status: string) {
  return status === "open"
    ? "border border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
    : "border border-amber-400/35 bg-amber-500/10 text-amber-100";
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
          className="max-h-72 w-full rounded-xl border border-white/10 object-cover"
        />
      </a>
    );
  }

  if (message.attachment_kind === "video") {
    return (
      <video controls preload="metadata" className="mt-2 max-h-72 w-full rounded-xl border border-white/10">
        <source src={message.attachment_url} type={message.attachment_mime ?? "video/mp4"} />
      </video>
    );
  }

  return null;
}

export default function SupportChat({
  title,
  subtitle,
  emptyText,
  locale = "ru",
}: {
  title: string;
  subtitle?: string;
  emptyText: string;
  locale?: Locale;
}) {
  const isEn = locale === "en";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
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
          body: JSON.stringify({
            body,
            threadId: data?.role === "admin" ? activeThreadId : undefined,
          }),
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
        {subtitle ? <p className="mt-2 text-sm text-white/70">{subtitle}</p> : null}
      </div>

      {data?.role === "admin" && activeThread && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span>{isEn ? "User" : "Пользователь"}: {activeThread.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${threadStatusClass(activeThread.status)}`}>
              {threadStatusLabel(activeThread.status, locale)}
            </span>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{thread.label}</div>
                  <div className="flex items-center gap-2">
                    {data?.role === "admin" && (thread.unread_count ?? 0) > 0 && (
                      <span className="rounded-full border border-cyan-300/45 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-100">
                        {isEn ? "New" : "Новые"}: {thread.unread_count}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${threadStatusClass(thread.status)}`}>
                      {threadStatusLabel(thread.status, locale)}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-white/60">
                  {isEn ? "Updated" : "Обновлен"}: {toDate(thread.updated_at, locale)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[420px]">
          {loading && <div className="text-sm text-white/60">{isEn ? "Loading..." : "Загрузка..."}</div>}
          {!loading && (data?.messages?.length ?? 0) === 0 && <div className="text-sm text-white/60">{emptyText}</div>}

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
                    "max-w-[92%] rounded-2xl border px-3 py-2 text-sm sm:max-w-[80%]",
                    mine
                      ? "rounded-br-sm border-cyan-400/20 bg-cyan-500/10 text-right"
                      : "rounded-bl-sm border-white/10 bg-black/20 text-left",
                  ].join(" ")}
                >
                  <div className="text-[11px] text-white/50">{label}</div>
                  {message.body ? <div className="mt-1 whitespace-pre-wrap">{message.body}</div> : null}
                  {renderAttachment(message)}
                  {message.attachment_url && (
                    <div className="mt-2 text-xs">
                      <a href={message.attachment_url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                        {message.attachment_name ?? (isEn ? "Open attachment" : "Открыть вложение")}
                      </a>
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-white/40">{toDate(message.created_at, locale)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="border-t border-white/10 p-3">
          {attachment && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
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

          <div className="flex gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={isEn ? "Enter message" : "Введите сообщение..."}
              className="min-h-[84px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
            />
            <div className="flex flex-col justify-end gap-2">
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-white/80 hover:bg-white/5"
                aria-label={isEn ? "Attach file" : "Прикрепить файл"}
                title={isEn ? "Attach file" : "Прикрепить файл"}
              >
                <PaperclipIcon />
              </button>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending || (!text.trim() && !attachment) || (data?.role === "admin" && !activeThreadId)}
                className="self-end rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (isEn ? "Sending..." : "Отправка...") : isEn ? "Send" : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
