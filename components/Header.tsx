import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18nServer";
import AvatarMenu from "./AvatarMenu";
import LanguageSwitcher from "./LanguageSwitcher";
import NavDropdown from "./NavDropdown";
import TournamentsMenu from "./TournamentsMenu";

export default async function Header() {
  const locale = await getRequestLocale();
  const t = getMessages(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { username: string | null; avatar_url: string | null; role: string | null } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url, role")
      .eq("id", user.id)
      .single();
    profile = data ?? null;
  }

  return (
    <header className="site-nav sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="w-full px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2 rounded-xl px-1.5 py-1 font-bold tracking-widest text-cyan-100/95 hover:bg-white/5 sm:px-2">
            <span className="inline-block h-8 w-8 overflow-hidden rounded-xl outline outline-1 outline-cyan-300/40">
              <Image src="/ava-v2.png" alt="Logo" width={32} height={32} className="h-full w-full object-cover" />
            </span>
            <span className="text-cyan-100">WinStrike</span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 text-sm text-white/80 md:flex">
            <Link href="/" className="rounded-xl px-3 py-2 text-cyan-50/90 transition hover:bg-white/5 hover:text-white">
              {t.header.home}
            </Link>
            <TournamentsMenu labels={t.tournamentsMenu} buttonLabel={t.header.tournaments} />
            <Link href="/sponsors" className="rounded-xl px-3 py-2 text-cyan-50/90 transition hover:bg-white/5 hover:text-white">
              {t.header.sponsors}
            </Link>
            <Link href="/help" className="rounded-xl px-3 py-2 text-cyan-50/90 transition hover:bg-white/5 hover:text-white">
              {t.header.help}
            </Link>
          </nav>

          <div className="md:hidden">
            <NavDropdown
              isAdmin={profile?.role === "admin"}
              labels={{
                menu: locale === "en" ? "Menu" : "Меню",
                home: t.header.home,
                tournaments: t.header.tournaments,
                sponsors: t.header.sponsors,
                help: t.header.help,
                admin: t.header.admin,
                schedule: t.tournamentsMenu.schedule,
                watch: t.tournamentsMenu.watch,
              }}
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher locale={locale} />
            {!user ? (
              <Link href="/login" className="rounded-xl bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 outline outline-1 outline-cyan-300/50 hover:bg-cyan-400/15 sm:px-4 sm:py-2 sm:text-sm">
                {t.header.login}
              </Link>
            ) : (
              <AvatarMenu
                username={profile?.username ?? user.email ?? "User"}
                avatarUrl={profile?.avatar_url ?? null}
                isAdmin={profile?.role === "admin"}
                labels={t.avatarMenu}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

