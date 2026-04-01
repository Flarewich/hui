import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { defaultSitePages } from "@/lib/defaultSitePages";
import { getRequestLocale } from "@/lib/i18nServer";
import { ensureDefaultGames } from "@/lib/defaultGames";
import { getGameTournamentSettings } from "@/lib/tournamentLimits";
import { pgMaybeOne, pgQuery, pgRows } from "@/lib/postgres";
import { formatEuro } from "@/lib/currency";


type Game = {
  id: string;
  name: string;
  is_active?: boolean | null;
};

function gameKey(game: Game) {
  return String(game.name ?? "").trim().toLowerCase();
}

type Tournament = {
  id: string;
  title: string;
  status: string;
  mode: string;
  max_teams: number | null;
  start_at: string;
  prize_pool: number | null;
  game_id: string | null;
  room_code: string | null;
  room_password: string | null;
  room_instructions: string | null;
};

type SitePage = {
  slug: string;
  title: string;
  content_md: string;
};

type ScheduleItem = {
  id: string;
  tournament_id: string;
  stage: string;
  match_title: string;
  start_at: string;
  end_at: string | null;
  stream_url: string | null;
};

type TournamentRegistration = {
  tournament_id: string;
  user_id: string;
  team_id: string | null;
  profiles: { username: string | null } | null;
  teams: { name: string | null; captain_id?: string | null } | null;
};

type TournamentResult = {
  id: string;
  tournament_id: string;
  place: number;
  team_id: string | null;
  captain_user_id: string;
  prize_amount: number;
};

type PrizeClaim = {
  id: string;
  tournament_id: string;
  place: number;
  team_id: string | null;
  winner_user_id: string;
  amount: number;
  status: "awaiting_details" | "pending_review" | "approved" | "rejected" | "paid" | "cancelled" | string;
  payout_method: string | null;
  recipient_name: string | null;
  payment_details: string | null;
  request_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
};

function toInputDateTime(ts: string) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeTournamentStatus(status: string, startAtIso: string, liveToken: "live" | "current") {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized !== "upcoming") return normalized || "upcoming";
  const startTs = new Date(startAtIso).getTime();
  if (!Number.isNaN(startTs) && startTs <= Date.now()) {
    return liveToken;
  }
  return "upcoming";
}

async function resolveModeByGame(gameId: string, modeRaw: string) {
  const mode = (modeRaw || "solo").trim();
  if (!gameId) return mode;

  const game = await pgMaybeOne<{ slug?: string | null; name?: string | null }>(
    `
      select slug, name
      from games
      where id = $1
      limit 1
    `,
    [gameId]
  );

  const settings = getGameTournamentSettings(game?.slug ?? null, game?.name ?? null);
  if (settings.team_size <= 1) return "solo";
  if (settings.team_size === 2) return "duo";
  return "squad";
}

export default async function AdminTournamentsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  await requireAdmin();
  await ensureDefaultGames();

  const [tournaments, games, contentPages, scheduleItems] = await Promise.all([
    pgRows<Tournament>(
      `
        select id, title, status, mode, max_teams, start_at, prize_pool, game_id, room_code, room_password, room_instructions
        from tournaments
        order by start_at asc
      `
    ),
    pgRows<Game>(
      `
        select id, name, is_active
        from games
        order by name
      `
    ),
    pgRows<SitePage>(
      `
        select slug, title, content_md
        from site_pages
        where slug = any($1::text[])
      `,
      [["rules", "tournaments-info"]]
    ),
    pgRows<ScheduleItem>(
      `
        select id, tournament_id, stage, match_title, start_at, end_at, stream_url
        from tournament_schedule
        order by start_at asc
      `
    ),
  ]);

  const pages = new Map(contentPages.map((p) => [p.slug, p]));
  const liveToken: "live" | "current" =
    tournaments.some((t) => String(t.status ?? "").trim().toLowerCase() === "current")
      ? "current"
      : "live";
  const uniqueGames = Array.from(new Map(games.map((g) => [gameKey(g), g])).values());
  const tournamentIds = tournaments.map((t) => t.id);

  const [registrations, tournamentResults, prizeClaims] =
    tournamentIds.length > 0
      ? await Promise.all([
          pgRows<TournamentRegistration>(
            `
              select
                r.tournament_id,
                r.user_id,
                r.team_id,
                json_build_object('username', p.username) as profiles,
                json_build_object('name', tm.name, 'captain_id', tm.captain_id) as teams
              from registrations r
              left join profiles p on p.id = r.user_id
              left join teams tm on tm.id = r.team_id
              where r.tournament_id = any($1::uuid[])
            `,
            [tournamentIds]
          ),
          pgRows<TournamentResult>(
            `
              select id, tournament_id, place, team_id, captain_user_id, prize_amount
              from tournament_results
              where tournament_id = any($1::uuid[])
            `,
            [tournamentIds]
          ),
          pgRows<PrizeClaim>(
            `
              select
                id,
                tournament_id,
                place,
                team_id,
                winner_user_id,
                amount,
                status,
                payout_method,
                recipient_name,
                payment_details,
                request_comment,
                submitted_at,
                reviewed_at,
                paid_at
              from prize_claims
              where tournament_id = any($1::uuid[])
            `,
            [tournamentIds]
          ),
        ])
      : [[], [], []];

  const registrationsByTournament = new Map<string, TournamentRegistration[]>();
  for (const row of registrations) {
    const list = registrationsByTournament.get(row.tournament_id) ?? [];
    list.push(row);
    registrationsByTournament.set(row.tournament_id, list);
  }

  const resultsByTournament = new Map<string, TournamentResult[]>();
  for (const row of tournamentResults) {
    const list = resultsByTournament.get(row.tournament_id) ?? [];
    list.push(row);
    resultsByTournament.set(row.tournament_id, list);
  }

  const claimsByTournament = new Map<string, PrizeClaim[]>();
  for (const claim of prizeClaims) {
    const list = claimsByTournament.get(claim.tournament_id) ?? [];
    list.push(claim);
    claimsByTournament.set(claim.tournament_id, list);
  }

  async function createTournament(formData: FormData) {
    "use server";

    await requireAdmin();

    const title = String(formData.get("title") ?? "").trim();
    const game_id = String(formData.get("game_id") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? "upcoming").trim();
    const modeRaw = String(formData.get("mode") ?? "solo").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const prize_pool = Number(formData.get("prize_pool") ?? 0);
    const maxTeamsRaw = String(formData.get("max_teams") ?? "").trim();
    const maxTeamsParsed = Number(maxTeamsRaw);
    const max_teams =
      maxTeamsRaw.length > 0 && Number.isFinite(maxTeamsParsed) && maxTeamsParsed > 0
        ? Math.floor(maxTeamsParsed)
        : null;
    const room_code = String(formData.get("room_code") ?? "").trim();
    const room_password = String(formData.get("room_password") ?? "").trim();
    const room_instructions = String(formData.get("room_instructions") ?? "").trim();

    if (!title || !start_at) return;

    const mode = await resolveModeByGame(game_id, modeRaw);

    await pgQuery(
      `
        insert into tournaments (title, game_id, status, mode, start_at, prize_pool, max_teams, room_code, room_password, room_instructions)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        title,
        game_id || null,
        statusRaw,
        mode,
        new Date(start_at).toISOString(),
        Number.isFinite(prize_pool) ? prize_pool : 0,
        max_teams,
        room_code || null,
        room_password || null,
        room_instructions || null,
      ]
    );

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
    redirect("/admin/tournaments#edit");
  }

  async function updateTournament(formData: FormData) {
    "use server";

    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    const title = String(formData.get("title") ?? "").trim();
    const game_id = String(formData.get("game_id") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? "upcoming").trim();
    const modeRaw = String(formData.get("mode") ?? "solo").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const prize_pool = Number(formData.get("prize_pool") ?? 0);
    const maxTeamsRaw = String(formData.get("max_teams") ?? "").trim();
    const maxTeamsParsed = Number(maxTeamsRaw);
    const max_teams =
      maxTeamsRaw.length > 0 && Number.isFinite(maxTeamsParsed) && maxTeamsParsed > 0
        ? Math.floor(maxTeamsParsed)
        : null;
    const room_code = String(formData.get("room_code") ?? "").trim();
    const room_password = String(formData.get("room_password") ?? "").trim();
    const room_instructions = String(formData.get("room_instructions") ?? "").trim();

    const mode = await resolveModeByGame(game_id, modeRaw);

    await pgQuery(
      `
        update tournaments
        set
          title = $2,
          game_id = $3,
          status = $4,
          mode = $5,
          start_at = $6,
          prize_pool = $7,
          max_teams = $8,
          room_code = $9,
          room_password = $10,
          room_instructions = $11
        where id = $1
      `,
      [
        id,
        title,
        game_id || null,
        statusRaw,
        mode,
        start_at ? new Date(start_at).toISOString() : null,
        Number.isFinite(prize_pool) ? prize_pool : 0,
        max_teams,
        room_code || null,
        room_password || null,
        room_instructions || null,
      ]
    );

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
    redirect("/admin/tournaments#edit");
  }

  async function deleteTournament(formData: FormData) {
    "use server";

    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    await pgQuery(`delete from tournaments where id = $1`, [id]);

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function savePage(formData: FormData) {
    "use server";

    await requireAdmin();

    const slug = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const content_md = String(formData.get("content_md") ?? "").trim();

    if (!slug) return;

    await pgQuery(
      `
        insert into site_pages (slug, title, content_md, updated_at)
        values ($1, $2, $3, now())
        on conflict (slug) do update
        set title = excluded.title,
            content_md = excluded.content_md,
            updated_at = now()
      `,
      [slug, title, content_md]
    );

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function createScheduleItem(formData: FormData) {
    "use server";

    await requireAdmin();

    const tournament_id = String(formData.get("tournament_id") ?? "").trim();
    const stage = String(formData.get("stage") ?? "group").trim();
    const match_title = String(formData.get("match_title") ?? "").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const end_at = String(formData.get("end_at") ?? "").trim();
    const stream_url = String(formData.get("stream_url") ?? "").trim();

    if (!tournament_id || !match_title || !start_at) return;

    await pgQuery(
      `
        insert into tournament_schedule (tournament_id, stage, match_title, start_at, end_at, stream_url)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        tournament_id,
        stage,
        match_title,
        new Date(start_at).toISOString(),
        end_at ? new Date(end_at).toISOString() : null,
        stream_url || null,
      ]
    );

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function updateScheduleItem(formData: FormData) {
    "use server";

    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    const tournament_id = String(formData.get("tournament_id") ?? "").trim();
    const stage = String(formData.get("stage") ?? "group").trim();
    const match_title = String(formData.get("match_title") ?? "").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const end_at = String(formData.get("end_at") ?? "").trim();
    const stream_url = String(formData.get("stream_url") ?? "").trim();

    if (!id || !tournament_id || !match_title || !start_at) return;

    await pgQuery(
      `
        update tournament_schedule
        set
          tournament_id = $2,
          stage = $3,
          match_title = $4,
          start_at = $5,
          end_at = $6,
          stream_url = $7,
          updated_at = now()
        where id = $1
      `,
      [
        id,
        tournament_id,
        stage,
        match_title,
        new Date(start_at).toISOString(),
        end_at ? new Date(end_at).toISOString() : null,
        stream_url || null,
      ]
    );

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function deleteScheduleItem(formData: FormData) {
    "use server";

    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    await pgQuery(`delete from tournament_schedule where id = $1`, [id]);

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function saveTournamentResults(formData: FormData) {
    "use server";

    const tournamentId = String(formData.get("tournament_id") ?? "").trim();
    if (!tournamentId) return;

    await requireAdmin();

    const p1TeamId = String(formData.get("place_1_team_id") ?? "").trim();
    const p2TeamId = String(formData.get("place_2_team_id") ?? "").trim();
    const p3TeamId = String(formData.get("place_3_team_id") ?? "").trim();
    const p1Amount = Math.max(0, Number(formData.get("place_1_amount") ?? 0) || 0);
    const p2Amount = Math.max(0, Number(formData.get("place_2_amount") ?? 0) || 0);
    const p3Amount = Math.max(0, Number(formData.get("place_3_amount") ?? 0) || 0);

    const rows = [
      { place: 1, teamId: p1TeamId, amount: p1Amount },
      { place: 2, teamId: p2TeamId, amount: p2Amount },
      { place: 3, teamId: p3TeamId, amount: p3Amount },
    ].filter((x) => x.teamId);

    const teamIds = [...new Set(rows.map((x) => x.teamId))];
    if (teamIds.length !== rows.length) return;

    const teams = await pgRows<Array<{ id: string; captain_id: string }>[number]>(
      `
        select id, captain_id
        from teams
        where id = any($1::uuid[])
      `,
      [teamIds]
    );

    const captainByTeam = new Map(teams.map((t) => [t.id, t.captain_id]));

    const insertRows = rows
      .map((row) => ({
        tournament_id: tournamentId,
        place: row.place,
        team_id: row.teamId,
        captain_user_id: captainByTeam.get(row.teamId) ?? null,
        prize_amount: row.amount,
      }))
      .filter((row): row is { tournament_id: string; place: number; team_id: string; captain_user_id: string; prize_amount: number } => Boolean(row.captain_user_id));

    await pgQuery(`delete from tournament_results where tournament_id = $1`, [tournamentId]);
    if (insertRows.length > 0) {
      for (const row of insertRows) {
        await pgQuery(
          `
            insert into tournament_results (tournament_id, place, team_id, captain_user_id, prize_amount)
            values ($1, $2, $3, $4, $5)
          `,
          [row.tournament_id, row.place, row.team_id, row.captain_user_id, row.prize_amount]
        );
      }
    }

    revalidatePath("/admin/tournaments");
    revalidatePath("/profile");
    redirect("/admin/tournaments#edit");
  }

  async function finishTournament(formData: FormData) {
    "use server";

    const tournamentId = String(formData.get("tournament_id") ?? "").trim();
    if (!tournamentId) return;

    await requireAdmin();

    await pgQuery(`update tournaments set status = 'finished' where id = $1`, [tournamentId]);

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
    revalidatePath("/profile");
    redirect("/admin/tournaments#edit");
  }

  async function createPrizeClaims(formData: FormData) {
    "use server";

    const tournamentId = String(formData.get("tournament_id") ?? "").trim();
    if (!tournamentId) return;

    await requireAdmin();

    const results = await pgRows<Array<{ place: number; team_id: string | null; captain_user_id: string; prize_amount: number }>[number]>(
      `
        select place, team_id, captain_user_id, prize_amount
        from tournament_results
        where tournament_id = $1
        order by place asc
      `,
      [tournamentId]
    );

    if (results.length === 0) return;

    for (const row of results) {
      await pgQuery(
        `
          insert into prize_claims (tournament_id, place, team_id, winner_user_id, amount, status, updated_at)
          values ($1, $2, $3, $4, $5, 'awaiting_details', now())
          on conflict (tournament_id, place) do update
          set team_id = excluded.team_id,
              winner_user_id = excluded.winner_user_id,
              amount = excluded.amount,
              status = 'awaiting_details',
              updated_at = now()
        `,
        [tournamentId, row.place, row.team_id, row.captain_user_id, Number(row.prize_amount ?? 0)]
      );
    }

    revalidatePath("/admin/tournaments");
    revalidatePath("/profile");
    redirect("/admin/tournaments#edit");
  }

  return (
    <div className="space-y-6">
      <details className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">{isEn ? "Quick section list" : "Быстрый список разделов"}</summary>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <a href="#create" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/5">
            {isEn ? "Create tournament" : "Создание турнира"}
          </a>
          <a href="#edit" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/5">
            {isEn ? "Edit tournaments" : "Редактирование турниров"}
          </a>
          <a href="#content" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/5">
            {isEn ? "Rules and schedule" : "Правила и расписание"}
          </a>
        </div>
      </details>

      <div id="create" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-xl font-bold">{isEn ? "Tournament CRUD" : "CRUD турниров"}</h2>
        <form action={createTournament} className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="title" required placeholder={isEn ? "Tournament title" : "Название турнира"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />

          <select name="game_id" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <option value="">{isEn ? "Game not selected" : "Игра не выбрана"}</option>
            {uniqueGames.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.is_active === false ? " (inactive)" : ""}
              </option>
            ))}
          </select>

          <select name="status" defaultValue="upcoming" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <option value="upcoming">upcoming</option>
            <option value="live">live</option>
            <option value="finished">finished</option>
          </select>

          <select name="mode" defaultValue="solo" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <option value="solo">solo</option>
            <option value="duo">duo</option>
            <option value="squad">squad</option>
          </select>

          <input name="start_at" type="datetime-local" required className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          <input name="prize_pool" type="number" min={0} defaultValue={0} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          <input
            name="max_teams"
            type="number"
            min={1}
            placeholder={isEn ? "Max registered teams (optional)" : "Макс. команд (необязательно)"}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <input name="room_code" placeholder="Room ID / Lobby code" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          <input name="room_password" placeholder="Room password" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          <textarea
            name="room_instructions"
            rows={3}
            placeholder={isEn ? "Join instructions (2-3 lines)" : "Инструкция для входа (2-3 строки)"}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm md:col-span-2"
          />

          <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            {isEn ? "Create tournament" : "Создать турнир"}
          </button>
        </form>
      </div>

      <div id="edit" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{isEn ? "Tournament list" : "Список турниров"}</h2>
        <div className="mt-4 space-y-4">
          {(tournaments ?? []).map((t) => {
            const registrationOptions = registrationsByTournament.get(t.id) ?? [];
            const teamOptions = Array.from(
              new Map(
                registrationOptions
                  .filter((r) => r.team_id)
                  .map((r) => [
                    String(r.team_id),
                    {
                      teamId: String(r.team_id),
                      teamName: String(r.teams?.name ?? r.team_id),
                    },
                  ])
              ).values()
            );
            const tournamentResults = (resultsByTournament.get(t.id) ?? []).sort((a, b) => a.place - b.place);
            const prizeClaims = (claimsByTournament.get(t.id) ?? []).sort((a, b) => a.place - b.place);
            const resultByPlace = new Map(tournamentResults.map((r) => [r.place, r]));

            return (
            <form key={t.id} action={updateTournament} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <input type="hidden" name="id" value={t.id} />

              <div className="grid gap-3 md:grid-cols-2">
                <input name="title" defaultValue={t.title} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />

                <select name="game_id" defaultValue={t.game_id ?? ""} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <option value="">{isEn ? "Game not selected" : "Игра не выбрана"}</option>
                  {uniqueGames.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}{g.is_active === false ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>

                <select
                  name="status"
                  defaultValue={normalizeTournamentStatus(t.status, t.start_at, liveToken)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                >
                  <option value="upcoming">upcoming</option>
                  <option value={liveToken}>{liveToken}</option>
                  <option value="finished">finished</option>
                </select>

                <select name="mode" defaultValue={t.mode} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  <option value="solo">solo</option>
                  <option value="duo">duo</option>
                  <option value="squad">squad</option>
                </select>

                <input name="start_at" type="datetime-local" defaultValue={toInputDateTime(t.start_at)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />

                <input
                  name="prize_pool"
                  type="number"
                  min={0}
                  defaultValue={Number(t.prize_pool ?? 0)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                />
                <input
                  name="max_teams"
                  type="number"
                  min={1}
                  defaultValue={t.max_teams ?? ""}
                  placeholder={isEn ? "Max registered teams (optional)" : "Макс. команд (необязательно)"}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                />

                <input
                  name="room_code"
                  defaultValue={t.room_code ?? ""}
                  placeholder="Room ID / Lobby code"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                />

                <input
                  name="room_password"
                  defaultValue={t.room_password ?? ""}
                  placeholder="Room password"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                />

                <textarea
                  name="room_instructions"
                  rows={3}
                  defaultValue={t.room_instructions ?? ""}
                  placeholder={isEn ? "Join instructions (2-3 lines)" : "Инструкция для входа (2-3 строки)"}
                  className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2"
                />
              </div>

              <div className="mt-3 flex gap-2">
                <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                  {isEn ? "Save" : "Сохранить"}
                </button>
                <button formAction={deleteTournament} className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">
                  {isEn ? "Delete" : "Удалить"}
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  {isEn ? "Results and payouts" : "Результаты и выплаты"}
                </div>
                <input type="hidden" name="tournament_id" value={t.id} />
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select name="place_1_team_id" defaultValue={resultByPlace.get(1)?.team_id ?? ""} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
                    <option value="">{isEn ? "1st place team" : "Команда 1 места"}</option>
                    {teamOptions.map((team) => (
                      <option key={`p1-${team.teamId}`} value={team.teamId}>
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                  <select name="place_2_team_id" defaultValue={resultByPlace.get(2)?.team_id ?? ""} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
                    <option value="">{isEn ? "2nd place team" : "Команда 2 места"}</option>
                    {teamOptions.map((team) => (
                      <option key={`p2-${team.teamId}`} value={team.teamId}>
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                  <select name="place_3_team_id" defaultValue={resultByPlace.get(3)?.team_id ?? ""} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
                    <option value="">{isEn ? "3rd place team" : "Команда 3 места"}</option>
                    {teamOptions.map((team) => (
                      <option key={`p3-${team.teamId}`} value={team.teamId}>
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                  <input name="place_1_amount" type="number" min={0} defaultValue={Number(resultByPlace.get(1)?.prize_amount ?? 0)} placeholder={isEn ? "1st place amount" : "Сумма 1 места"} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
                  <input name="place_2_amount" type="number" min={0} defaultValue={Number(resultByPlace.get(2)?.prize_amount ?? 0)} placeholder={isEn ? "2nd place amount" : "Сумма 2 места"} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
                  <input name="place_3_amount" type="number" min={0} defaultValue={Number(resultByPlace.get(3)?.prize_amount ?? 0)} placeholder={isEn ? "3rd place amount" : "Сумма 3 места"} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button formAction={saveTournamentResults} className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20">
                    {isEn ? "Save podium" : "Сохранить призовые места"}
                  </button>
                  <button formAction={finishTournament} className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/20">
                    {isEn ? "Finish tournament" : "Завершить турнир"}
                  </button>
                  <button formAction={createPrizeClaims} className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20">
                    {isEn ? "Create prize claims" : "Создать призовые заявки"}
                  </button>
                </div>
                {prizeClaims.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-white/70">
                    {prizeClaims.map((claim) => (
                      <div key={claim.id}>
                        {claim.place}. {isEn ? "place" : "место"} • {formatEuro(claim.amount, locale)} • {isEn ? "status" : "статус"}: {claim.status}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
            );
          })}

          {(tournaments?.length ?? 0) === 0 && <div className="text-sm text-white/60">{isEn ? "No tournaments yet." : "Турниров пока нет."}</div>}
        </div>
      </div>

      <div id="content" className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-semibold">{isEn ? "Schedule table" : "Таблица расписания"}</h3>
          <form action={createScheduleItem} className="mt-3 grid gap-3 md:grid-cols-2">
            <select name="tournament_id" required className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="">{isEn ? "Select tournament" : "Выберите турнир"}</option>
              {(tournaments ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <input name="stage" defaultValue="group" placeholder={isEn ? "Stage (group/playoff/final)" : "Стадия (group/playoff/final)"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <input name="match_title" required placeholder={isEn ? "Match title" : "Название матча"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm md:col-span-2" />
            <input name="start_at" type="datetime-local" required className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <input name="end_at" type="datetime-local" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <input name="stream_url" placeholder="https://..." className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm md:col-span-2" />
            <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
              {isEn ? "Add to schedule" : "Добавить в расписание"}
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {(scheduleItems ?? []).map((s) => (
              <form key={s.id} action={updateScheduleItem} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <input type="hidden" name="id" value={s.id} />
                <div className="grid gap-2 md:grid-cols-2">
                  <select name="tournament_id" defaultValue={s.tournament_id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                    {(tournaments ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <input name="stage" defaultValue={s.stage} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
                  <input name="match_title" defaultValue={s.match_title} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2" />
                  <input name="start_at" type="datetime-local" defaultValue={toInputDateTime(s.start_at)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
                  <input name="end_at" type="datetime-local" defaultValue={s.end_at ? toInputDateTime(s.end_at) : ""} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
                  <input name="stream_url" defaultValue={s.stream_url ?? ""} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2" />
                </div>
                <div className="mt-2 flex gap-2">
                  <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                    {isEn ? "Save" : "Сохранить"}
                  </button>
                  <button formAction={deleteScheduleItem} className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">
                    {isEn ? "Delete" : "Удалить"}
                  </button>
                </div>
              </form>
            ))}

            {(scheduleItems?.length ?? 0) === 0 && <div className="text-sm text-white/60">{isEn ? "No schedule rows yet." : "Пока нет строк расписания."}</div>}
          </div>
        </div>

        <form action={savePage} className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-semibold">{isEn ? "Tournament rules" : "Правила турниров"}</h3>
          <input type="hidden" name="slug" value="rules" />
          <input
            name="title"
            defaultValue={pages.get("rules")?.title ?? defaultSitePages.rules.title}
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <textarea
            name="content_md"
            defaultValue={pages.get("rules")?.content_md ?? defaultSitePages.rules.content_md}
            rows={12}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <button type="submit" className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            {isEn ? "Save rules" : "Сохранить правила"}
          </button>
        </form>

        <form action={savePage} className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-semibold">{isEn ? "Schedule / info" : "Расписание / инфо"}</h3>
          <input type="hidden" name="slug" value="tournaments-info" />
          <input
            name="title"
            defaultValue={pages.get("tournaments-info")?.title ?? (isEn ? "Tournament schedule" : "Расписание турниров")}
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <textarea
            name="content_md"
            defaultValue={pages.get("tournaments-info")?.content_md ?? ""}
            rows={12}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <button type="submit" className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            {isEn ? "Save schedule" : "Сохранить расписание"}
          </button>
        </form>
      </div>
    </div>
  );
}











