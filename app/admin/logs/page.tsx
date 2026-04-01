import { countAuditLogsSince, ensureAuditLogTable, listAuditLogs } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";
import AdminAuditLogView from "@/components/AdminAuditLogView";

export default async function AdminLogsPage() {
  await requireAdmin();
  await ensureAuditLogTable();

  const locale = await getRequestLocale();
  const isEn = locale === "en";

  const [logs, last24h, last7d] = await Promise.all([
    listAuditLogs(200),
    countAuditLogsSince("24 hours"),
    countAuditLogsSince("7 days"),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-xl font-bold sm:text-2xl">{isEn ? "User activity logs" : "Логи действий пользователей"}</h1>
        <p className="mt-2 text-sm text-white/70">
          {isEn ? "Recent actions across the site in real time." : "Последние действия пользователей на сайте в реальном времени."}
        </p>
      </div>

      <AdminAuditLogView
        locale={locale}
        initialLogs={logs}
        initialLast24h={last24h}
        initialLast7d={last7d}
      />
    </div>
  );
}
