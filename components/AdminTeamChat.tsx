"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  username: string | null;
};

type Payload = {
  messages: Message[];
  me: { id: string; username: string | null };
  unreadCount: number;
};

function toDate(ts: string, locale: Locale) {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTeamChat({
  locale,
  title,
  subtitle,
}: {
  locale: Locale;
  title: string;
  subtitle: string;
}) {
  const isEn = locale === "en";
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [data, setData] = useState<Payload | null>(null);

  const markRead = useCallback(async () => {
    await fetch("/api/admin-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead" }),
    });
  }, []);

  const load = useCallback(
    async (background = false) => {
      if (!background) {
        setLoading(true);
        setError("");
      }

      try {
        const res = await fetch("/api/admin-chat", { cache: "no-store" });
        const payload = (await res.json()) as Payload | { error?: string };
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || "Failed to load admin chat");
        }
        setData(payload as Payload);
        await markRead();
      } catch (e) {
        if (!background) {
          setError(e instanceof Error ? e.message : isEn ? "Failed to load admin chat" : "Не удалось загрузить чат админов");
        }
      } finally {
        if (!background) setLoading(false);
      }
    },
    [isEn, markRead]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const eventSource = new EventSource("/api/admin-chat/stream");
    eventSource.addEventListener("message", () => {
      void load(true);
    });
    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [load]);

  async function sendMessage() {
    const body = text.trim();
    if (!body) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to send");
      }

      setText("");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to send" : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-white/70">{subtitle}</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[520px]">
          {loading && <div className="text-sm text-white/60">{isEn ? "Loading..." : "Загрузка..."}</div>}
          {!loading && (data?.messages.length ?? 0) === 0 && (
            <div className="text-sm text-white/60">{isEn ? "No messages yet." : "Пока нет сообщений."}</div>
          )}

          {(data?.messages ?? []).map((message) => {
            const mine = message.sender_id === data?.me.id;
            return (
              <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={[
                    "max-w-[94%] border px-3 py-2 text-sm sm:max-w-[85%]",
                    mine
                      ? "rounded-2xl rounded-br-sm border-cyan-400/20 bg-cyan-500/10 text-right"
                      : "rounded-2xl rounded-bl-sm border-white/10 bg-black/20 text-left",
                  ].join(" ")}
                >
                  <div className="text-[11px] text-white/50">{mine ? (isEn ? "You" : "Вы") : message.username ?? "Admin"}</div>
                  <div className="mt-1 whitespace-pre-wrap">{message.body}</div>
                  <div className="mt-1 text-[11px] text-white/40">{toDate(message.created_at, locale)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="mt-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
            placeholder={isEn ? "Message for the admin team" : "Сообщение для команды админов"}
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !text.trim()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (isEn ? "Sending..." : "Отправка...") : isEn ? "Send" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
