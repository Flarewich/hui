import Link from "next/link";
import { countUnreadAdminChat } from "@/lib/adminChat";
import { requireAdmin } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const unreadAdminChat = await countUnreadAdminChat(user.id);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <h1 className="text-lg font-bold">{isEn ? "Admin panel" : "Админка"}</h1>
        <p className="text-sm text-white/60">{isEn ? "Access only for admin role" : "Доступ только для роли admin"}</p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <Link href="/admin" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Dashboard" : "Дашборд"}
          </Link>
          <Link href="/admin/tournaments" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Tournaments" : "Турниры"}
          </Link>
          <Link href="/admin/support" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Support" : "Поддержка"}
          </Link>
          <Link href="/admin/chat" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            <span className="inline-flex items-center gap-2">
              <span>{isEn ? "Admin chat" : "Чат админов"}</span>
              {unreadAdminChat > 0 && (
                <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-bold text-black">
                  {unreadAdminChat > 99 ? "99+" : unreadAdminChat}
                </span>
              )}
            </span>
          </Link>
          <Link href="/admin/logs" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Logs" : "Логи"}
          </Link>
          <Link href="/admin/users" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Users" : "Пользователи"}
          </Link>
          <Link href="/admin/payments" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Payments" : "Выплаты"}
          </Link>
          <Link href="/admin/sponsors" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Sponsors" : "Спонсоры"}
          </Link>
          <Link href="/admin/emails" className="rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/5">
            {isEn ? "Emails" : "Письма"}
          </Link>
        </div>
      </div>

      {children}
    </div>
  );
}
