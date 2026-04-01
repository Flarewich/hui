import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ensureEmailTables } from "@/lib/email";
import { getRequestLocale } from "@/lib/i18nServer";
import { ensureNotificationTables } from "@/lib/notifications";
import { pgOne } from "@/lib/postgres";

async function getCount(query: string, params: unknown[] = []) {
  const row = await pgOne<{ count: string }>(query, params);
  return Number(row.count ?? 0);
}

export default async function AdminPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  await requireAdmin();
  await ensureNotificationTables();
  await ensureEmailTables();

  const [
    tournamentsCount,
    openThreadsCount,
    usersCount,
    activeGamesCount,
    sponsorsCount,
    payoutRequestsCount,
    unreadNotificationsCount,
    queuedEmailsCount,
  ] = await Promise.all([
    getCount("select count(*)::text as count from tournaments"),
    getCount("select count(*)::text as count from support_threads where status = $1", ["open"]),
    getCount("select count(*)::text as count from profiles"),
    getCount("select count(*)::text as count from games where is_active = true"),
    getCount("select count(*)::text as count from sponsors where is_active = true"),
    getCount("select count(*)::text as count from prize_claims where status = any($1::text[])", [["pending_review", "approved"]]),
    getCount("select count(*)::text as count from app_notifications where is_read = false"),
    getCount("select count(*)::text as count from email_outbox where delivery_status = $1", ["queued"]),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Tournaments" : "Турниры"}</div>
          <div className="mt-2 text-2xl font-bold">{tournamentsCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Open tickets" : "Открытые обращения"}</div>
          <div className="mt-2 text-2xl font-bold">{openThreadsCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Users" : "Пользователи"}</div>
          <div className="mt-2 text-2xl font-bold">{usersCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Active games" : "Активные игры"}</div>
          <div className="mt-2 text-2xl font-bold">{activeGamesCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Sponsors" : "Спонсоры"}</div>
          <div className="mt-2 text-2xl font-bold">{sponsorsCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Payout requests" : "Заявки на выплаты"}</div>
          <div className="mt-2 text-2xl font-bold">{payoutRequestsCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Unread notifications" : "Непрочитанные уведомления"}</div>
          <div className="mt-2 text-2xl font-bold">{unreadNotificationsCount}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Queued emails" : "Писем в очереди"}</div>
          <div className="mt-2 text-2xl font-bold">{queuedEmailsCount}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/tournaments" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 hover:bg-white/10">
          <div className="text-lg font-semibold">{isEn ? "Tournament management" : "Управление турнирами"}</div>
          <div className="mt-1 text-sm text-white/60">{isEn ? "CRUD, rules and schedule." : "CRUD, правила и расписание."}</div>
        </Link>

        <Link href="/admin/support" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 hover:bg-white/10">
          <div className="text-lg font-semibold">{isEn ? "Support" : "Поддержка"}</div>
          <div className="mt-1 text-sm text-white/60">{isEn ? "Reply to users and manage ticket status." : "Ответы пользователям и статусы обращений."}</div>
        </Link>

        <Link href="/admin/users" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 hover:bg-white/10">
          <div className="text-lg font-semibold">{isEn ? "Users and roles" : "Пользователи и роли"}</div>
          <div className="mt-1 text-sm text-white/60">{isEn ? "Assign user/sponsor/admin roles." : "Назначение ролей user/sponsor/admin."}</div>
        </Link>

        <Link href="/admin/sponsors" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 hover:bg-white/10">
          <div className="text-lg font-semibold">{isEn ? "Sponsors" : "Спонсоры"}</div>
          <div className="mt-1 text-sm text-white/60">{isEn ? "Manage sponsors and sponsor role assignment." : "Управление спонсорами и ролью sponsor."}</div>
        </Link>

        <Link href="/admin/payments" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 hover:bg-white/10">
          <div className="text-lg font-semibold">{isEn ? "Payments" : "Выплаты"}</div>
          <div className="mt-1 text-sm text-white/60">{isEn ? "Review payout requests and mark manual payouts." : "Проверка заявок на выплаты и отметка ручных выплат."}</div>
        </Link>

        <Link href="/admin/emails" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 hover:bg-white/10">
          <div className="text-lg font-semibold">{isEn ? "Emails" : "Письма"}</div>
          <div className="mt-1 text-sm text-white/60">{isEn ? "Review reset links and queued platform emails." : "Просмотр ссылок сброса и системных писем в очереди."}</div>
        </Link>
      </div>
    </div>
  );
}
