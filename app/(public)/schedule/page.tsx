import Link from "next/link";
import { getDateLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18nServer";
import { pgRows } from "@/lib/postgres";
import { getTournamentCapacity } from "@/lib/tournamentLimits";
import { formatEuro } from "@/lib/currency";
import PageShell from "@/components/PageShell";

type ScheduleTournament = {
  id: string;
  title: string;
  status: string;
  mode: string;
  start_at: string;
  prize_pool: number | null;
  participants?: number | null;
  games: { name: string; slug: string } | null;
};

type EnrichedTournament = ScheduleTournament & {
  effectiveStatus: "upcoming" | "live" | "finished";
  isRegistrationOpen: boolean;
  capacity: number;
};

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function effectiveStatus(status: string, startAt: string): "upcoming" | "live" | "finished" {
  if (status === "finished") return "finished";
  return new Date(startAt).getTime() <= Date.now() ? "live" : "upcoming";
}

function getSortWeight(item: EnrichedTournament) {
  if (item.effectiveStatus === "live") return 0;
  if (item.effectiveStatus === "upcoming" && item.isRegistrationOpen) return 1;
  return 2;
}

function statusLabel(status: "upcoming" | "live" | "finished", locale: string) {
  if (locale === "en") {
    if (status === "live") return "Live";
    if (status === "finished") return "Finished";
    return "Soon";
  }
  if (status === "live") return "Лайв";
  if (status === "finished") return "Завершен";
  return "Скоро";
}

function statusClass(status: "upcoming" | "live" | "finished") {
  if (status === "live") return "text-emerald-300";
  if (status === "finished") return "text-white/50";
  return "text-cyan-300";
}

export default async function SchedulePage() {
  const locale = await getRequestLocale();
  const dateLocale = getDateLocale(locale);

  const data = await pgRows<ScheduleTournament & { max_teams: number | null }>(
    `
      select
        t.id,
        t.title,
        t.status,
        t.mode,
        t.start_at,
        t.prize_pool,
        t.max_teams,
        coalesce(tc.participants, 0) as participants,
        json_build_object('name', g.name, 'slug', g.slug) as games
      from tournaments t
      left join games g on g.id = t.game_id
      left join (
        select tournament_id, count(distinct coalesce(team_id, user_id))::int as participants
        from registrations
        group by tournament_id
      ) tc on tc.tournament_id = t.id
      order by t.start_at asc
      limit 200
    `
  );

  const rows: EnrichedTournament[] = data.map((item) => {
    const dynamicStatus = effectiveStatus(item.status, item.start_at);
    const capacity = getTournamentCapacity(
      item.mode,
      item.games?.slug ?? null,
      item.games?.name ?? null,
      item.max_teams
    );
    const participants = item.participants ?? 0;
    const isRegistrationOpen = dynamicStatus === "upcoming" && participants < capacity;

    return {
      ...item,
      effectiveStatus: dynamicStatus,
      isRegistrationOpen,
      capacity,
    };
  });

  rows.sort((a, b) => {
    const weightDiff = getSortWeight(a) - getSortWeight(b);
    if (weightDiff !== 0) return weightDiff;

    const prizeDiff = (b.prize_pool ?? 0) - (a.prize_pool ?? 0);
    if (prizeDiff !== 0) return prizeDiff;

    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  });

  const isEn = locale === "en";
  const title = isEn ? "Schedule" : "Расписание турниров";
  const subtitle = isEn
    ? "Live first, then open-registration tournaments sorted by prize pool."
    : "Сначала лайв, затем турниры с открытым набором по убыванию призового.";

  return (
    <PageShell title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <div className="card p-6 text-sm text-white/70">{isEn ? "No tournaments yet." : "Турниров пока нет."}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <ul className="divide-y divide-white/10">
            {rows.map((item) => {
              const participants = item.participants ?? 0;
              const spotsLeft = Math.max(item.capacity - participants, 0);
              const shortDescription = isEn
                ? `${item.games?.name ?? "Game"} ${item.mode.toUpperCase()}, ${item.capacity} max players, ${spotsLeft} spots left.`
                : `${item.games?.name ?? "Игра"} ${item.mode.toUpperCase()}, максимум ${item.capacity} игроков, свободно ${spotsLeft}.`;

              return (
                <li key={item.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/tournaments/${item.id}`} className="truncate text-base font-semibold text-white hover:text-cyan-300">
                        {item.title}
                      </Link>
                      <p className="mt-1 text-xs text-white/60">{shortDescription}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                        <span>{formatDate(item.start_at, dateLocale)}</span>
                        <span>•</span>
                        <span>{item.games?.name ?? "-"}</span>
                        <span>•</span>
                        <span>{item.mode.toUpperCase()}</span>
                        <span>•</span>
                        <span>{isEn ? "Participants" : "Участники"}: {participants}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                      <span className={`font-semibold uppercase ${statusClass(item.effectiveStatus)}`}>
                        {statusLabel(item.effectiveStatus, locale)}
                      </span>
                      <span className="font-semibold text-cyan-200">{formatEuro(item.prize_pool, locale)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
