import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function AdminPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { supabase } = await requireAdmin();

  const [{ count: tournamentsCount }, { count: openThreadsCount }, { count: usersCount }, { count: activeGamesCount }, { count: sponsorsCount }] =
    await Promise.all([
      supabase.from("tournaments").select("id", { count: "exact", head: true }),
      supabase.from("support_threads").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("games").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("sponsors").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Tournaments" : "Турниры"}</div>
          <div className="mt-2 text-2xl font-bold">{tournamentsCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Open tickets" : "Открытые обращения"}</div>
          <div className="mt-2 text-2xl font-bold">{openThreadsCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Users" : "Пользователи"}</div>
          <div className="mt-2 text-2xl font-bold">{usersCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Active games" : "Активные игры"}</div>
          <div className="mt-2 text-2xl font-bold">{activeGamesCount ?? 0}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="text-xs text-white/60">{isEn ? "Sponsors" : "Спонсоры"}</div>
          <div className="mt-2 text-2xl font-bold">{sponsorsCount ?? 0}</div>
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
          <div className="mt-1 text-sm text-white/60">{isEn ? "Manage sponsors and sponsor role assignment." : "Управление списком спонсоров и выдачей роли sponsor."}</div>
        </Link>
      </div>
    </div>
  );
}
