"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationPayload = {
  notifications: NotificationItem[];
  unreadCount: number;
};

type NotificationBellLabels = {
  open: string;
  title: string;
  empty: string;
  markAllRead: string;
  viewAll: string;
  openItem: string;
  newLabel: string;
  readLabel: string;
};

type NotificationEvent = {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
};

function formatCount(value: number) {
  return value > 99 ? "99+" : String(value);
}

export default function NotificationBell({
  locale,
  initialNotifications,
  initialUnreadCount,
  labels,
}: {
  locale: "ru" | "en";
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  labels: NotificationBellLabels;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const animationTimeoutRef = useRef<number | null>(null);

  const pulse = () => {
    if (animationTimeoutRef.current) {
      window.clearTimeout(animationTimeoutRef.current);
    }
    setIsAnimating(true);
    animationTimeoutRef.current = window.setTimeout(() => {
      setIsAnimating(false);
    }, 1400);
  };

  const playSound = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const oscillator2 = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator2.type = "triangle";
      oscillator.frequency.setValueAtTime(988, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(740, context.currentTime + 0.22);
      oscillator2.frequency.setValueAtTime(1318, context.currentTime + 0.04);
      oscillator2.frequency.exponentialRampToValueAtTime(988, context.currentTime + 0.22);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

      oscillator.connect(gain);
      oscillator2.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator2.start(context.currentTime + 0.02);
      oscillator.stop(context.currentTime + 0.3);
      oscillator2.stop(context.currentTime + 0.3);
      oscillator.onended = () => {
        void context.close().catch(() => undefined);
      };
    } catch {}
  };

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const eventSource = new EventSource("/api/notifications/stream");

    eventSource.addEventListener("notification", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as NotificationEvent;
      setNotifications((current) => [
        {
          id: payload.id,
          title: payload.title,
          body: payload.body,
          href: payload.href,
          is_read: false,
          created_at: payload.createdAt,
        },
        ...current.filter((item) => item.id !== payload.id).slice(0, 7),
      ]);
      setUnreadCount((current) => current + 1);
      pulse();
      if (!openRef.current) {
        playSound();
      }
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  async function refreshNotifications() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json()) as NotificationPayload | { error?: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to load notifications");
      }

      const data = payload as NotificationPayload;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    setMarkingRead(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      const payload = (await response.json()) as NotificationPayload | { error?: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to update notifications");
      }

      const data = payload as NotificationPayload;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : "Failed to update notifications");
    } finally {
      setMarkingRead(false);
    }
  }

  async function markOneRead(notificationId: string) {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", notificationId }),
      });
      const payload = (await response.json()) as NotificationPayload | { error?: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to update notification");
      }

      const data = payload as NotificationPayload;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : "Failed to update notification");
    }
  }

  const openPanel = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void refreshNotifications();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPanel}
        className={[
          "relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/6 text-cyan-50/90 outline outline-1 outline-cyan-300/30 transition hover:bg-white/10",
          isAnimating ? "scale-110 bg-cyan-400/15 outline-cyan-300/60" : "",
        ].join(" ")}
        aria-label={labels.open}
      >
        {isAnimating && <span className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-300/70 animate-ping" />}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-cyan-300 px-1.5 py-0.5 text-center text-[10px] font-bold text-black">
            {formatCount(unreadCount)}
          </span>
        )}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
          <path d="M12 2a6 6 0 0 0-6 6v2.48c0 .72-.2 1.42-.58 2.02L4 15v2h16v-2l-1.42-2.5A4.1 4.1 0 0 1 18 10.48V8a6 6 0 0 0-6-6Zm0 20a3.24 3.24 0 0 0 3-2H9a3.24 3.24 0 0 0 3 2Z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl bg-[#060d1f]/95 outline outline-1 outline-cyan-300/35 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">{labels.title}</div>
              <div className="text-[11px] text-white/55">{unreadCount > 0 ? formatCount(unreadCount) : 0}</div>
            </div>
            <button
              onClick={() => void markAllRead()}
              disabled={markingRead || unreadCount === 0}
              className="rounded-xl border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {labels.markAllRead}
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto px-3 py-3">
            {loading && <div className="px-1 py-2 text-xs text-white/50">Loading...</div>}
            {error && <div className="px-1 py-2 text-xs text-red-200">{error}</div>}

            {!loading && notifications.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                {labels.empty}
              </div>
            )}

            <div className="space-y-2">
              {notifications.map((item) => {
                const href = item.href || "/profile#notifications";
                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() => {
                      setOpen(false);
                      if (!item.is_read) {
                        void markOneRead(item.id);
                      }
                    }}
                    className="block rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                        {item.body && <div className="mt-1 line-clamp-2 text-xs text-white/70">{item.body}</div>}
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] text-white/60">
                        {item.is_read ? labels.readLabel : labels.newLabel}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-white/45">
                      <span>
                        {new Date(item.created_at).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-cyan-300">{labels.openItem}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <Link
              href="/profile#notifications"
              onClick={() => setOpen(false)}
              className="block rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-center text-sm text-white/80 transition hover:bg-white/5"
            >
              {labels.viewAll}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
