import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import TournamentParticipantsTable from "@/components/TournamentParticipantsTable";
import TournamentRegistrationModal from "@/components/TournamentRegistrationModal";
import TeamSizeLive from "@/components/TeamSizeLive";
import { getSitePage } from "@/lib/pages";
import { getTournamentRegistrationRows } from "@/lib/registrationTable";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTeamSizeLimit, getTournamentCapacity, isStartingInFiveMinutes } from "@/lib/tournamentLimits";
import { getRequestLocale } from "@/lib/i18nServer";

type Tournament = {
  id: string;
  title: string;
  status: "upcoming" | "live" | "finished" | string;
  mode: "solo" | "duo" | "squad" | string;
  start_at: string;
  prize_pool: number | null;
  game_id: string | null;
  games: { id?: string; name: string; slug?: string | null } | null;
};

type BracketTeam = {
  id: string;
  name: string;
};

type BracketMatch = {
  id: string;
  leftLabel: string;
  rightLabel: string;
};

type BracketRound = {
  title: string;
  matches: BracketMatch[];
};

function toDate(ts: string, locale: "ru" | "en") {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function effectiveStatus(status: string, startAt: string) {
  if (status === "finished") return "finished";
  return new Date(startAt).getTime() <= Date.now() ? "live" : "upcoming";
}

function modeLabel(mode: string) {
  if (mode === "solo") return "Solo";
  if (mode === "duo") return "Duo";
  if (mode === "squad") return "Squad";
  return mode;
}

function statusMeta(status: string, locale: "ru" | "en") {
  if (status === "live") return { label: "LIVE", cls: "border-red-400/30 bg-red-500/15 text-red-100" };
  if (status === "finished") return { label: locale === "en" ? "FINISHED" : "Завершен", cls: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100" };
  return { label: locale === "en" ? "SOON" : "Скоро", cls: "border-cyan-400/30 bg-cyan-500/15 text-cyan-100" };
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .trim();
}

function isBracketGame(gameSlug?: string | null, gameName?: string | null) {
  const slug = normalize(gameSlug);
  const name = normalize(gameName);
  const text = `${slug} ${name}`;
  return text.includes("cs2") || text.includes("dota-2") || text.includes("dota2") || text.includes("mobile-legends") || text.includes("mobile legends") || text.includes("standoff-2") || text.includes("standoff2");
}

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(items: T[], seed: string) {
  const random = seededRandom(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextPowerOfTwo(value: number) {
  let v = 1;
  while (v < value) v *= 2;
  return v;
}

function getRoundTitle(matchCount: number, locale: "ru" | "en") {
  if (matchCount === 1) return locale === "en" ? "Final" : "Финал";
  if (matchCount === 2) return locale === "en" ? "Semifinals" : "Полуфинал";
  if (matchCount === 4) return locale === "en" ? "Quarterfinals" : "Четвертьфинал";
  if (matchCount === 8) return locale === "en" ? "Round of 16" : "1/8 финала";
  if (matchCount === 16) return locale === "en" ? "Round of 32" : "1/16 финала";
  return locale === "en" ? `Round (${matchCount})` : `Раунд (${matchCount})`;
}

function buildBracketRounds(teams: BracketTeam[], maxTeams: number, locale: "ru" | "en", seed: string): BracketRound[] {
  const slots = nextPowerOfTwo(Math.max(2, maxTeams));
  const seeded = shuffleSeeded(teams, seed);
  const labels = seeded.map((t) => t.name);

  while (labels.length < maxTeams) {
    labels.push(locale === "en" ? "TBD" : "Ожидается");
  }
  while (labels.length < slots) {
    labels.push("BYE");
  }

  const rounds: BracketRound[] = [];
  const firstMatches: BracketMatch[] = [];
  for (let i = 0; i < slots; i += 2) {
    firstMatches.push({
      id: `R1M${Math.floor(i / 2) + 1}`,
      leftLabel: labels[i] ?? "BYE",
      rightLabel: labels[i + 1] ?? "BYE",
    });
  }
  rounds.push({ title: getRoundTitle(firstMatches.length, locale), matches: firstMatches });

  let prev = firstMatches;
  let roundNo = 2;
  while (prev.length > 1) {
    const cur: BracketMatch[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const leftSrc = prev[i]?.id ?? `R${roundNo - 1}M${i + 1}`;
      const rightSrc = prev[i + 1]?.id ?? `R${roundNo - 1}M${i + 2}`;
      cur.push({
        id: `R${roundNo}M${Math.floor(i / 2) + 1}`,
        leftLabel: locale === "en" ? `Winner ${leftSrc}` : `Победитель ${leftSrc}`,
        rightLabel: locale === "en" ? `Winner ${rightSrc}` : `Победитель ${rightSrc}`,
      });
    }
    rounds.push({ title: getRoundTitle(cur.length, locale), matches: cur });
    prev = cur;
    roundNo += 1;
  }

  return rounds;
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const supabase = await createSupabaseServerClient();

  const [tournamentResult, rulesPage, authResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, title, status, mode, start_at, prize_pool, game_id, games(id, name, slug)")
      .eq("id", id)
      .maybeSingle<Tournament>(),
    getSitePage("rules", locale).catch(() => null),
    supabase.auth.getUser(),
  ]);

  const tournament = tournamentResult.data;
  if (!tournament) notFound();

  const [relatedResult, registrationCountResult, initialRegistrationRows] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, title, start_at, prize_pool, mode")
      .eq("status", "upcoming")
      .eq("game_id", tournament.game_id)
      .neq("id", tournament.id)
      .order("start_at", { ascending: true })
      .limit(3),
    supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id),
    getTournamentRegistrationRows(id),
  ]);

  const related = relatedResult.data;
  const dynamicStatus = effectiveStatus(tournament.status, tournament.start_at);
  const status = statusMeta(dynamicStatus, locale);
  const user = authResult.data.user;

  const myRegistration = user
    ? await supabaseAdmin.from("registrations").select("id, created_at, team_id, teams(name)").eq("tournament_id", id).eq("user_id", user.id).maybeSingle()
    : null;

  const isRegistered = !!myRegistration?.data?.id;
  const registrationDate = myRegistration?.data?.created_at ?? null;
  const myTeamName =
    myRegistration?.data && "teams" in myRegistration.data && typeof myRegistration.data.teams === "object" && myRegistration.data.teams && "name" in myRegistration.data.teams
      ? String(myRegistration.data.teams.name ?? "")
      : "";
  const myTeamId = myRegistration?.data && "team_id" in myRegistration.data && myRegistration.data.team_id ? String(myRegistration.data.team_id) : null;

  const myTeamMembersCountResult = myTeamId ? await supabaseAdmin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", myTeamId) : null;
  const myTeamMembersCount = myTeamMembersCountResult?.count ?? 0;
  const teamLimit = getTeamSizeLimit(tournament.mode, tournament.games?.slug ?? null, tournament.games?.name ?? null);

  const isClosed = dynamicStatus !== "upcoming";
  const capacity = getTournamentCapacity(tournament.mode, tournament.games?.slug ?? null, tournament.games?.name ?? null);
  const currentRegistrations = registrationCountResult.count ?? 0;
  const isFull = currentRegistrations >= capacity;
  const startsInFiveMinutes = isStartingInFiveMinutes(tournament.start_at);
  const needsTeam = tournament.mode === "duo" || tournament.mode === "squad";
  const loginHref = `/login?ok=${encodeURIComponent(isEn ? "Sign in to register for tournament" : "Войдите, чтобы зарегистрироваться на турнир")}`;
  const isTargetBracketGame = isBracketGame(tournament.games?.slug ?? null, tournament.games?.name ?? null);
  const isLobbyMode = needsTeam && teamLimit === 5;
  const shouldShowBracket = isTargetBracketGame && isLobbyMode && isFull && (startsInFiveMinutes || dynamicStatus === "live");

  const bracketTeams: BracketTeam[] = shouldShowBracket
    ? await (async () => {
        const { data } = await supabaseAdmin
          .from("registrations")
          .select("team_id, teams(name)")
          .eq("tournament_id", id)
          .not("team_id", "is", null)
          .returns<Array<{ team_id: string | null; teams: { name?: string | null } | null }>>();

        const unique = new Map<string, BracketTeam>();
        for (const row of data ?? []) {
          const teamId = String(row.team_id ?? "").trim();
          if (!teamId || unique.has(teamId)) continue;
          const teamName = String(row.teams?.name ?? "").trim() || (isEn ? `Team ${unique.size + 1}` : `Команда ${unique.size + 1}`);
          unique.set(teamId, { id: teamId, name: teamName });
        }

        return Array.from(unique.values());
      })()
    : [];
  const bracketRounds = shouldShowBracket ? buildBracketRounds(bracketTeams, capacity, locale, `${id}:${tournament.start_at}:bracket-v2`) : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 p-4 sm:p-6 md:p-8">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
              <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/80">{modeLabel(tournament.mode)}</span>
              <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/80">{tournament.games?.name ?? (isEn ? "Game not specified" : "Игра не указана")}</span>
            </div>

            <h1 className="break-words text-xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">{tournament.title}</h1>

            <div className="mt-4 grid gap-2 text-sm text-white/80 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{isEn ? "Start" : "Старт"}: {toDate(tournament.start_at, locale)}</div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                {isEn ? "Prize pool" : "Призовой фонд"}: {Number(tournament.prize_pool ?? 0).toLocaleString(locale === "en" ? "en-US" : "ru-RU")} RUB
              </div>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-white/10 bg-black/25 p-4 sm:max-w-sm">
            <div className="text-sm font-semibold">{isEn ? "Tournament registration" : "Регистрация на турнир"}</div>
            <p className="mt-2 text-xs text-white/65">
              {needsTeam
                ? isEn
                  ? `For ${modeLabel(tournament.mode)} format, create a team in registration modal.`
                  : `Для формата ${modeLabel(tournament.mode)} создайте команду во всплывающем окне регистрации.`
                : isEn
                  ? "After registration, you will appear in participants list."
                  : "После регистрации вы попадете в список участников и получите доступ к деталям участия."}
            </p>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/75">
              {isEn ? "Participants now" : "Участников сейчас"}: {currentRegistrations} / {capacity}
            </div>

            {startsInFiveMinutes && (
              <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {isEn ? "Less than 5 minutes left before start." : "До начала турнира осталось меньше 5 минут."}
              </div>
            )}

            <div className="mt-4">
              <TournamentRegistrationModal
                tournamentId={id}
                isLoggedIn={Boolean(user)}
                needsTeam={needsTeam}
                modeLabel={modeLabel(tournament.mode)}
                blockedByTeamMembership={false}
                isClosed={isClosed}
                isFull={isFull}
                isRegistered={isRegistered}
                loginHref={loginHref}
                registrationDateText={registrationDate ? toDate(registrationDate, locale) : null}
                myTeamName={myTeamName}
                errorMessage={sp.error}
                okMessage={sp.ok}
                locale={locale}
              />
            </div>

            {isRegistered && myTeamId && (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                <TeamSizeLive teamId={myTeamId} initialCount={myTeamMembersCount} limit={teamLimit} locale={locale} />
              </div>
            )}

            <div className="mt-3 grid gap-2">
              <Link href="/profile" className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-center text-sm hover:bg-white/5">
                {isEn ? "Profile" : "Личный кабинет"}
              </Link>
              <Link href={`/tournaments/${id}/room`} className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-center text-sm text-cyan-100 hover:bg-cyan-500/20">
                {isEn ? "Match room" : "Матч-рум"}
              </Link>
              <Link href="/support" className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-center text-sm hover:bg-white/5">
                {isEn ? "Contact support" : "Написать в поддержку"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TournamentParticipantsTable tournamentId={id} initialRows={initialRegistrationRows} locale={locale} />

      {shouldShowBracket && (
        <section className="rounded-3xl border border-cyan-400/30 bg-white/5 p-4 md:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{isEn ? "Tournament Bracket" : "Турнирная сетка"}</h2>
            <span className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
              {isEn ? "Lobby 10 players (5v5)" : "Лобби 10 игроков (5v5)"}
            </span>
          </div>
          <p className="text-sm text-white/70">
            {isEn
              ? "Teams are paired randomly when tournament is full and start is in 5 minutes."
              : "Команды рандомно распределяются по матчам, когда турнир заполнен и до старта осталось 5 минут."}
          </p>

          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-max gap-4 pb-2">
              {bracketRounds.map((round) => (
                <div key={round.title} className="min-w-[220px] space-y-3 sm:min-w-[260px]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">{round.title}</div>
                  {round.matches.map((match, idx) => (
                    <div key={match.id} className="rounded-2xl border border-white/12 bg-black/20 p-3">
                      <div className="mb-2 text-xs uppercase tracking-wide text-white/60">
                        {isEn ? "Match" : "Матч"} {idx + 1}
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-sm font-semibold">{match.leftLabel}</span>
                        <span className="text-xs text-cyan-100">VS</span>
                        <span className="text-sm font-semibold">{match.rightLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {bracketRounds.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/65">
                {isEn ? "Not enough teams to build bracket." : "Недостаточно команд для построения сетки."}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
            <h2 className="text-xl font-bold">{isEn ? "Tournament description" : "Описание турнира"}</h2>
            <p className="mt-3 text-sm text-white/75">
              {isEn ? "Mode" : "Формат"}: <span className="font-semibold text-white">{modeLabel(tournament.mode)}</span>. {isEn ? "Game" : "Игра"}:{" "}
              <span className="font-semibold text-white">{tournament.games?.name ?? (isEn ? "Not specified" : "Не указана")}</span>.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
            <h2 className="text-xl font-bold">{isEn ? "Tournament rules" : "Правила турнира"}</h2>
            {rulesPage ? <div className="mt-4 text-sm text-white/85"><Markdown content={rulesPage.content_md} /></div> : <p className="mt-3 text-sm text-white/65">{isEn ? "Rules will be added by admin." : "Правила будут добавлены администратором."}</p>}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
            <h3 className="text-lg font-semibold">{isEn ? "Related tournaments" : "Связанные турниры"}</h3>
            <div className="mt-4 space-y-3">
              {(related ?? []).map((t) => (
                <Link key={t.id} href={`/tournaments/${t.id}`} className="block rounded-2xl border border-white/10 bg-black/20 p-3 hover:bg-white/5">
                  <div className="text-xs text-white/60">{toDate(t.start_at, locale)} • {String(t.mode).toUpperCase()}</div>
                  <div className="mt-1 text-sm font-semibold">{t.title}</div>
                  <div className="mt-1 text-xs text-cyan-200">{Number(t.prize_pool ?? 0).toLocaleString(locale === "en" ? "en-US" : "ru-RU")} RUB</div>
                </Link>
              ))}
              {(related?.length ?? 0) === 0 && <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">{isEn ? "No related tournaments yet." : "Пока нет других турниров по этой игре."}</div>}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
            <h3 className="text-lg font-semibold">{isEn ? "Match organization" : "Организация матча"}</h3>
            <div className="mt-3 space-y-3 text-sm text-white/80">
              <p>
                {isEn
                  ? "Register first, then open match room before start to get lobby code and password."
                  : "Сначала зарегистрируйтесь на турнир, затем откройте матч-рум перед стартом для получения кода лобби и пароля."}
              </p>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-wide text-white/60">{isEn ? "Participation flow" : "Порядок участия"}</div>
                <ul className="mt-2 space-y-1.5 text-sm text-white/80">
                  <li>{isEn ? "1. Register for tournament." : "1. Зарегистрируйтесь на турнир."}</li>
                  <li>{isEn ? "2. Get room details 10 minutes before start." : "2. Получите данные комнаты за 10 минут до старта."}</li>
                  <li>{isEn ? "3. Join match and confirm readiness." : "3. Зайдите в матч и подтвердите готовность."}</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-wide text-white/60">{isEn ? "Disputes and support" : "Споры и поддержка"}</div>
                <p className="mt-2 text-sm text-white/75">
                  {isEn
                    ? "If you have issues joining the match, contact support and attach screenshots/video."
                    : "При проблемах с входом в матч сразу пишите в поддержку и приложите скриншоты или видео."}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}


