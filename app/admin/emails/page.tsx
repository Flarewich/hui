import { requireAdmin } from "@/lib/auth";
import { listRecentOutbox } from "@/lib/email";
import { getRequestLocale } from "@/lib/i18nServer";

function toDate(ts: string, locale: "ru" | "en") {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminEmailsPage() {
  await requireAdmin();
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const emails = await listRecentOutbox(100);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-xl font-bold">{isEn ? "Email outbox" : "Очередь писем"}</h1>
        <p className="mt-1 text-sm text-white/60">
          {isEn
            ? "Development-safe email queue for reset links and platform notifications."
            : "Безопасная dev-очередь писем для ссылок сброса и уведомлений платформы."}
        </p>
      </div>

      <div className="space-y-3">
        {emails.map((email) => (
          <article key={email.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{email.subject}</div>
                <div className="mt-1 text-xs text-white/60">{email.to_email}</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/25 px-3 py-1 text-xs">
                {email.kind ?? "generic"} • {email.delivery_status}
              </div>
            </div>
            <div className="mt-3 text-xs text-white/50">{toDate(email.created_at, locale)}</div>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
              {email.text_body}
            </pre>
          </article>
        ))}

        {emails.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            {isEn ? "Email queue is empty." : "Очередь писем пуста."}
          </div>
        )}
      </div>
    </div>
  );
}
