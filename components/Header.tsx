import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import AvatarMenu from "./AvatarMenu";
import TournamentsMenu from "./TournamentsMenu";

export default async function Header() {
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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-widest">
          <span className="inline-block h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500" />
          <span>CYBERHUB</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex text-sm text-white/80">
          <Link href="/" className="hover:text-white">Главная</Link>

          {/* ✅ ВОТ ТУТ dropdown */}
          <TournamentsMenu />

          <Link href="/sponsors" className="hover:text-white">Партнёры</Link>
          <Link href="/help" className="hover:text-white">Помощь</Link>
        </nav>

        <div className="flex items-center gap-3">
          {!user ? (
            <Link
              href="/login"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Войти
            </Link>
          ) : (
            <AvatarMenu
              username={profile?.username ?? user.email ?? "User"}
              avatarUrl={profile?.avatar_url ?? null}
              isAdmin={profile?.role === "admin"}
            />
          )}
        </div>
      </div>
    </header>
  );
}