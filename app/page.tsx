import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getDateLocale, getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18nServer";
import TopPrizeTournament from "@/components/TopPrizeTournament";

type UpcomingTournament = {
  id: string;
  title: string;
  start_at: string;
  prize_pool: number | null;
  mode: string;
  games: { name: string } | null;
};

function formatDate(ts: string, localeCode: string) {
  return new Date(ts).toLocaleString(localeCode, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HomePage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const t = getMessages(locale);
  const dateLocale = getDateLocale(locale);

  const supabase = await createSupabaseServerClient();

  const { data: upcoming } = await supabase
    .from("tournaments")
    .select("id, title, start_at, prize_pool, mode, games(name)")
    .eq("status", "upcoming")
    .order("start_at", { ascending: true })
    .limit(4)
    .returns<UpcomingTournament[]>();

  const { data: topTournament } = await supabase
    .from("tournaments")
    .select("id, title, start_at, prize_pool, mode, games(name)")
    .in("status", ["upcoming", "live"])
    .order("prize_pool", { ascending: false })
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle<UpcomingTournament>();

  return (
    <div className="home-no-block-bg relative left-1/2 right-1/2 w-screen -translate-x-1/2 space-y-5 px-3 sm:space-y-6 sm:px-4 lg:px-6 xl:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/35 px-4 py-5 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <div className="relative grid items-center gap-5 sm:gap-7 md:grid-cols-[1fr_240px]">
          <div className="max-w-4xl">
            <div className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-100">
              WinStrike
            </div>

            <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl md:text-5xl">
              {t.home.title1}
              <span className="block bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                {t.home.title2}
              </span>
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/80 md:text-base">{t.home.subtitle}</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65 md:text-base">
              {isEn
                ? "WinStrike is a tournament platform with clear brackets, transparent rules, live match rooms and quick registration for solo, duo and squad formats. We focus on fair play, stable organization and real competitive atmosphere."
                : "WinStrike — это турнирная платформа с понятной структурой матчей, прозрачными правилами, живыми матч-румами и быстрой регистрацией для форматов solo, duo и squad. Мы делаем акцент на честной игре, стабильной организации и соревновательной атмосфере."}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">
              {isEn
                ? "Choose a game, join a tournament, gather your team and compete for the prize pool with full control over schedule and match access."
                : "Выбирайте игру, вступайте в турнир, собирайте команду и соревнуйтесь за призовой фонд с полным контролем над расписанием и доступом к матчам."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/tournaments" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 sm:px-5">
                {t.home.allTournaments}
              </Link>
              <Link href="/help" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 sm:px-5">
                {t.home.rules}
              </Link>
            </div>
          </div>

          <div className="mx-auto w-32 sm:w-[185px] md:w-[230px]">
            <div className="overflow-hidden rounded-3xl border border-cyan-300/35 p-1">
              <Image src="/ava-v2.png" alt="Avatar" width={230} height={230} className="h-auto w-full rounded-[20px] object-cover" priority />
            </div>
          </div>
        </div>
      </section>

      {topTournament && (
        <TopPrizeTournament
          id={topTournament.id}
          title={topTournament.title}
          startAt={topTournament.start_at}
          prizePool={Number(topTournament.prize_pool ?? 0)}
          mode={String(topTournament.mode)}
          gameName={topTournament.games?.name ?? "-"}
          locale={dateLocale}
        />
      )}

      <section className="rounded-3xl border border-white/10 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold sm:text-xl">{t.home.upcoming}</h2>
          <Link href="/tournaments" className="text-sm text-cyan-300 hover:text-cyan-200">
            {t.home.showAll} →
          </Link>
        </div>

        <div className="space-y-3">
          {(upcoming ?? []).map((item) => (
            <Link key={item.id} href={`/tournaments/${item.id}`} className="block rounded-2xl border border-white/10 p-4 transition hover:border-cyan-300/30 hover:bg-white/5">
              <div className="text-xs text-white/55 break-words">
                {item.games?.name ?? "-"} | {String(item.mode).toUpperCase()} | {formatDate(item.start_at, dateLocale)}
              </div>
              <div className="mt-1 text-sm font-semibold break-words">{item.title}</div>
              <div className="mt-2 text-sm font-bold text-cyan-200">{Number(item.prize_pool ?? 0).toLocaleString(dateLocale)} RUB</div>
            </Link>
          ))}

          {(upcoming?.length ?? 0) === 0 && <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/60">{t.home.noUpcoming}</div>}
        </div>
      </section>
    </div>
  );
}
