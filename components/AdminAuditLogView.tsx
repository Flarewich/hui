"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditLogRow } from "@/lib/audit";

function toDate(ts: string, locale: "ru" | "en") {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMetadata(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) return "-";
  return JSON.stringify(value, null, 2);
}

export default function AdminAuditLogView({
  locale,
  initialLogs,
  initialLast24h,
  initialLast7d,
}: {
  locale: "ru" | "en";
  initialLogs: AuditLogRow[];
  initialLast24h: number;
  initialLast7d: number;
}) {
  const isEn = locale === "en";
  const [logs, setLogs] = useState(initialLogs);
  const [last24h, setLast24h] = useState(initialLast24h);
  const [last7d, setLast7d] = useState(initialLast7d);

  useEffect(() => {
    const eventSource = new EventSource("/api/audit/stream");
    eventSource.addEventListener("message", (event) => {
      const parsed = JSON.parse((event as MessageEvent).data) as AuditLogRow;
      setLogs((prev) => {
        const next = [parsed, ...prev.filter((item) => item.id !== parsed.id)];
        return next.slice(0, 200);
      });
      setLast24h((prev) => prev + 1);
      setLast7d((prev) => prev + 1);
    });
    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const loadedRows = useMemo(() => logs.length, [logs.length]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">{isEn ? "Last 24 hours" : "За 24 часа"}</div>
          <div className="mt-2 text-2xl font-bold">{last24h}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">{isEn ? "Last 7 days" : "За 7 дней"}</div>
          <div className="mt-2 text-2xl font-bold">{last7d}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">{isEn ? "Loaded rows" : "Загружено строк"}</div>
          <div className="mt-2 text-2xl font-bold">{loadedRows}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/20 text-left text-white/60">
              <tr>
                <th className="px-4 py-3 font-medium">{isEn ? "Time" : "Время"}</th>
                <th className="px-4 py-3 font-medium">{isEn ? "User" : "Пользователь"}</th>
                <th className="px-4 py-3 font-medium">{isEn ? "Action" : "Действие"}</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">{isEn ? "Details" : "Детали"}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-white/10 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-white/75">{toDate(log.created_at, locale)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{log.username ?? log.email ?? (isEn ? "Unknown user" : "Неизвестный пользователь")}</div>
                    <div className="text-xs text-white/50">{log.email ?? log.user_id ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">{log.ip_address ?? "-"}</td>
                  <td className="px-4 py-3">
                    <pre className="max-w-[560px] whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                      {formatMetadata(log.metadata)}
                    </pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/60">
                    {isEn ? "No logs yet." : "Логов пока нет."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
