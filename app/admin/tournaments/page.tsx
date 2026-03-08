import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { defaultSitePages } from "@/lib/defaultSitePages";
import { getRequestLocale } from "@/lib/i18nServer";
import { ensureDefaultGames } from "@/lib/defaultGames";
import { getGameTournamentSettings } from "@/lib/tournamentLimits";


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

async function resolveModeByGame(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  gameId: string,
  modeRaw: string
) {
  const mode = (modeRaw || "solo").trim();
  if (!gameId) return mode;

  const { data: game } = await supabase
    .from("games")
    .select("slug, name")
    .eq("id", gameId)
    .maybeSingle<{ slug?: string | null; name?: string | null }>();

  const settings = getGameTournamentSettings(game?.slug ?? null, game?.name ?? null);
  if (settings.team_size <= 1) return "solo";
  if (settings.team_size === 2) return "duo";
  return "squad";
}

export default async function AdminTournamentsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { supabase } = await requireAdmin();
  await ensureDefaultGames();

  const [{ data: tournaments }, { data: games }, { data: contentPages }, { data: scheduleItems }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, title, status, mode, start_at, prize_pool, game_id, room_code, room_password, room_instructions")
      .order("start_at", { ascending: true })
      .returns<Tournament[]>(),
    supabase.from("games").select("id, name, is_active").order("name").returns<Game[]>(),
    supabase
      .from("site_pages")
      .select("slug, title, content_md")
      .in("slug", ["rules", "tournaments-info"])
      .returns<SitePage[]>(),
    supabase
      .from("tournament_schedule")
      .select("id, tournament_id, stage, match_title, start_at, end_at, stream_url")
      .order("start_at", { ascending: true })
      .returns<ScheduleItem[]>(),
  ]);

  const pages = new Map((contentPages ?? []).map((p) => [p.slug, p]));
  const liveToken: "live" | "current" =
    (tournaments ?? []).some((t) => String(t.status ?? "").trim().toLowerCase() === "current")
      ? "current"
      : "live";
  const uniqueGames = Array.from(
    new Map((games ?? []).map((g) => [gameKey(g), g])).values()
  );

  async function createTournament(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();

    const title = String(formData.get("title") ?? "").trim();
    const game_id = String(formData.get("game_id") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? "upcoming").trim();
    const modeRaw = String(formData.get("mode") ?? "solo").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const prize_pool = Number(formData.get("prize_pool") ?? 0);
    const room_code = String(formData.get("room_code") ?? "").trim();
    const room_password = String(formData.get("room_password") ?? "").trim();
    const room_instructions = String(formData.get("room_instructions") ?? "").trim();

    if (!title || !start_at) return;

    const mode = await resolveModeByGame(supabase, game_id, modeRaw);

    await supabase.from("tournaments").insert({
      title,
      game_id: game_id || null,
      status: statusRaw,
      mode,
      start_at: new Date(start_at).toISOString(),
      prize_pool: Number.isFinite(prize_pool) ? prize_pool : 0,
      room_code: room_code || null,
      room_password: room_password || null,
      room_instructions: room_instructions || null,
    });

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
    redirect("/admin/tournaments#edit");
  }

  async function updateTournament(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    const title = String(formData.get("title") ?? "").trim();
    const game_id = String(formData.get("game_id") ?? "").trim();
    const statusRaw = String(formData.get("status") ?? "upcoming").trim();
    const modeRaw = String(formData.get("mode") ?? "solo").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const prize_pool = Number(formData.get("prize_pool") ?? 0);
    const room_code = String(formData.get("room_code") ?? "").trim();
    const room_password = String(formData.get("room_password") ?? "").trim();
    const room_instructions = String(formData.get("room_instructions") ?? "").trim();

    const mode = await resolveModeByGame(supabase, game_id, modeRaw);

    await supabase
      .from("tournaments")
      .update({
        title,
        game_id: game_id || null,
        status: statusRaw,
        mode,
        start_at: start_at ? new Date(start_at).toISOString() : null,
        prize_pool: Number.isFinite(prize_pool) ? prize_pool : 0,
        room_code: room_code || null,
        room_password: room_password || null,
        room_instructions: room_instructions || null,
      })
      .eq("id", id);

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
    redirect("/admin/tournaments#edit");
  }

  async function deleteTournament(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    await supabase.from("tournaments").delete().eq("id", id);

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function savePage(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();

    const slug = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const content_md = String(formData.get("content_md") ?? "").trim();

    if (!slug) return;

    await supabase
      .from("site_pages")
      .upsert({ slug, title, content_md, updated_at: new Date().toISOString() }, { onConflict: "slug" });

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function createScheduleItem(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();

    const tournament_id = String(formData.get("tournament_id") ?? "").trim();
    const stage = String(formData.get("stage") ?? "group").trim();
    const match_title = String(formData.get("match_title") ?? "").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const end_at = String(formData.get("end_at") ?? "").trim();
    const stream_url = String(formData.get("stream_url") ?? "").trim();

    if (!tournament_id || !match_title || !start_at) return;

    await supabase.from("tournament_schedule").insert({
      tournament_id,
      stage,
      match_title,
      start_at: new Date(start_at).toISOString(),
      end_at: end_at ? new Date(end_at).toISOString() : null,
      stream_url: stream_url || null,
    });

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function updateScheduleItem(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    const tournament_id = String(formData.get("tournament_id") ?? "").trim();
    const stage = String(formData.get("stage") ?? "group").trim();
    const match_title = String(formData.get("match_title") ?? "").trim();
    const start_at = String(formData.get("start_at") ?? "").trim();
    const end_at = String(formData.get("end_at") ?? "").trim();
    const stream_url = String(formData.get("stream_url") ?? "").trim();

    if (!id || !tournament_id || !match_title || !start_at) return;

    await supabase
      .from("tournament_schedule")
      .update({
        tournament_id,
        stage,
        match_title,
        start_at: new Date(start_at).toISOString(),
        end_at: end_at ? new Date(end_at).toISOString() : null,
        stream_url: stream_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
  }

  async function deleteScheduleItem(formData: FormData) {
    "use server";

    const { supabase } = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    await supabase.from("tournament_schedule").delete().eq("id", id);

    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
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
          {(tournaments ?? []).map((t) => (
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
            </form>
          ))}

          {(tournaments?.length ?? 0) === 0 && <div className="text-sm text-white/60">{isEn ? "No tournaments yet." : "Турниров пока нет."}</div>}
        </div>
      </div>

      <div id="content" className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-semibold">{isEn ? "Schedule table (Supabase)" : "Таблица расписания (Supabase)"}</h3>
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











