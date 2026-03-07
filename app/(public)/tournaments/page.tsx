import GameFilterRow from "@/components/GameFilterRow";
import FiltersBar from "@/components/FiltersBar";
import TournamentCard from "@/components/TournamentCard";
import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSitePage } from "@/lib/pages";
import { getDateLocale, getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18nServer";
import { isStartingInFiveMinutes } from "@/lib/tournamentLimits";
import { ensureDefaultGames } from "@/lib/defaultGames";

function formatDate(ts: string, localeCode: string) {
  return new Date(ts).toLocaleString(localeCode, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tab = "schedule" | "watch" | "rules" | "info";
type Status = "all" | "upcoming" | "live" | "finished";
type Mode = "all" | "solo" | "duo" | "squad";
type Sort = "time" | "prize" | "popular" | "top";

type Game = {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
};

type TournamentRow = {
  id: string;
  title: string;
  status: string;
  mode: string;
  start_at: string;
  prize_pool: number | null;
  participants?: number | null;
  games: { name: string; slug: string; icon_url: string | null } | null;
};

function gameKey(game: Pick<Game, "slug" | "name">) {
  const slug = String(game.slug ?? "").trim().toLowerCase();
  const name = String(game.name ?? "").trim().toLowerCase();
  return slug || name;
}

function normalizeTab(v?: string): Tab {
  if (v === "watch" || v === "rules" || v === "info" || v === "schedule") return v;
  return "schedule";
}
function normalizeStatus(v?: string): Status {
  if (v === "all" || v === "live" || v === "finished" || v === "upcoming") return v;
  return "all";
}
function normalizeMode(v?: string): Mode {
  if (v === "solo" || v === "duo" || v === "squad" || v === "all") return v;
  return "all";
}
function normalizeSort(v?: string): Sort {
  if (v === "prize" || v === "popular" || v === "top" || v === "time") return v;
  return "time";
}

function effectiveStatus(status: string, startAt: string) {
  if (status === "finished") return "finished";
  return new Date(startAt).getTime() <= Date.now() ? "live" : "upcoming";
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    game?: string;
    status?: string;
    mode?: string;
    q?: string;
    tab?: string;
    sort?: string;
  }>;
}) {
  const locale = await getRequestLocale();
  const t = getMessages(locale);
  const dateLocale = getDateLocale(locale);
  const sp = await searchParams;

  const tab: Tab = normalizeTab(sp.tab);
  const game = sp.game ?? "all";
  const status: Status = normalizeStatus(sp.status);
  const mode: Mode = normalizeMode(sp.mode);
  const q = (sp.q ?? "").trim();
  const sort: Sort = normalizeSort(sp.sort);

  const supabase = await createSupabaseServerClient();
  await ensureDefaultGames();

  if (tab === "rules") {
    const rulesPage = await getSitePage("rules", locale);
    return (
      <PageShell title={t.tournamentsPage.rulesTitle} subtitle={t.tournamentsPage.rulesSubtitle}>
        <div className="card p-4 sm:p-6">
          <Markdown content={rulesPage.content_md} />
        </div>
      </PageShell>
    );
  }

  if (tab === "info") {
    return (
      <PageShell title={t.tournamentsPage.infoTitle} subtitle={t.tournamentsPage.infoSubtitle}>
        <section className="rounded-3xl border border-cyan-400/20 p-4 sm:p-6">
          <div className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
            {locale === "en" ? "Info" : "Инфо"}
          </div>
          <h2 className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl">
            {locale === "en" ? "How tournaments work on WinStrike" : "Как работают турниры на WinStrike"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-white/75 sm:text-base">
            {locale === "en"
              ? "Everything about formats, registration flow, match room access and tournament progression."
              : "Все о форматах, регистрации, доступе в матч-рум и турнирной логике."}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article className="card p-4">
            <div className="text-sm font-semibold">{locale === "en" ? "Registration" : "Регистрация"}</div>
            <p className="mt-1 text-xs text-white/65 sm:text-sm">
              {locale === "en"
                ? "Choose tournament, confirm participation and create team for duo/squad."
                : "Выберите турнир, подтвердите участие и создайте команду для duo/squad."}
            </p>
          </article>
          <article className="card p-4">
            <div className="text-sm font-semibold">{locale === "en" ? "Match room" : "Матч-рум"}</div>
            <p className="mt-1 text-xs text-white/65 sm:text-sm">
              {locale === "en"
                ? "Room code and password become available before start for registered players."
                : "Код комнаты и пароль открываются перед стартом для зарегистрированных участников."}
            </p>
          </article>
          <article className="card p-4 sm:col-span-2 lg:col-span-1">
            <div className="text-sm font-semibold">{locale === "en" ? "Bracket and status" : "Сетка и статусы"}</div>
            <p className="mt-1 text-xs text-white/65 sm:text-sm">
              {locale === "en"
                ? "Statuses and tournament bracket update according to start time and participants."
                : "Статусы и турнирная сетка обновляются в зависимости от времени старта и участников."}
            </p>
          </article>
        </section>

      </PageShell>
    );
  }

  const { data: games } = await supabase
    .from("games")
    .select("id, name, slug, icon_url")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Game[]>();
  const gameGroups = new Map<string, Game[]>();
  for (const gameItem of games ?? []) {
    const key = gameKey(gameItem);
    const list = gameGroups.get(key) ?? [];
    list.push(gameItem);
    gameGroups.set(key, list);
  }

  const uniqueGames = Array.from(gameGroups.values()).map((list) => list[0]);
  const gameIdsBySlug = new Map<string, string[]>();
  for (const list of gameGroups.values()) {
    const slug = String(list[0]?.slug ?? "");
    if (!slug) continue;
    gameIdsBySlug.set(
      slug,
      list.map((g) => g.id)
    );
  }

  const fromTable = sort === "popular" ? "tournaments_with_counts" : "tournaments";

  let query = supabase
    .from(fromTable)
    .select(
      sort === "popular"
        ? "id, title, status, mode, game_id, start_at, prize_pool, participants, games(name, slug, icon_url)"
        : "id, title, status, mode, game_id, start_at, prize_pool, games(name, slug, icon_url)"
    );

  if (mode !== "all") query = query.eq("mode", mode);
  if (q) query = query.ilike("title", `%${q}%`);
  if (game !== "all") {
    const selectedGameIds = gameIdsBySlug.get(game) ?? [];
    if (selectedGameIds.length === 1) query = query.eq("game_id", selectedGameIds[0]);
    if (selectedGameIds.length > 1) query = query.in("game_id", selectedGameIds);
  }

  if (sort === "prize" || sort === "top") {
    query = query.order("prize_pool", { ascending: false });
  } else if (sort === "popular") {
    query = query.order("participants", { ascending: false }).order("start_at", { ascending: true });
  } else {
    query = query.order("start_at", { ascending: true });
  }

  const { data: tournaments, error } = await query.limit(60).returns<TournamentRow[]>();
  const filteredTournaments = (tournaments ?? []).filter((item) => {
    if (status !== "all" && effectiveStatus(item.status, item.start_at) !== status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-6">
        <h1 className="title">{tab === "watch" ? t.tournamentsPage.titleWatch : t.tournamentsPage.title}</h1>
        <p className="mt-2 muted text-sm">
          {tab === "watch" ? t.tournamentsPage.subtitleWatch : t.tournamentsPage.subtitle}
        </p>

        <div className="mt-5">
          <h2 className="title">{t.tournamentsPage.gameFilter}</h2>
          <div className="mt-5">
            <GameFilterRow games={uniqueGames} locale={locale} />
          </div>
        </div>

        <div className="mt-6">
          <FiltersBar locale={locale} />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {t.tournamentsPage.loadError}: {error.message}
        </div>
      )}

      <div className="space-y-4">
        {filteredTournaments.map((item) => (
          <TournamentCard
            key={item.id}
            registerLabel={t.tournamentsPage.register}
            numberLocale={dateLocale}
            currencyLabel="RUB"
            locale={locale}
            startsInFiveMinutes={isStartingInFiveMinutes(item.start_at)}
            t={{
              id: item.id,
              game: item.games?.name ?? "-",
              gameSlug: item.games?.slug ?? null,
              gameIconUrl: item.games?.icon_url ?? null,
              title: item.title,
              start: formatDate(item.start_at, dateLocale),
              startAtRaw: item.start_at,
              prize: item.prize_pool ?? 0,
              status: effectiveStatus(item.status, item.start_at),
              mode: item.mode,
            }}
          />
        ))}

        {!error && filteredTournaments.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
            {t.tournamentsPage.empty}
          </div>
        )}
      </div>
    </div>
  );
}

