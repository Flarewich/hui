import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";
import { getTeamSizeLimit } from "@/lib/tournamentLimits";

type Registration = {
  tournament_id: string | null;
  created_at: string;
};

type Tournament = {
  id: string;
  title: string;
  status: string;
  start_at: string;
};

type Team = {
  id: string;
  name: string;
  mode: string;
  captain_id: string;
  created_at: string;
  join_type: string | null;
};

type TeamMember = {
  team_id: string;
  user_id: string;
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

function getInitial(username?: string | null, email?: string | null) {
  return (username?.[0] ?? email?.[0] ?? "U").toUpperCase();
}

function modeLabel(mode: string) {
  if (mode === "duo") return "Duo";
  if (mode === "squad") return "Squad";
  return mode;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const sp = await searchParams;
  const { supabase, user, profile } = await requireUser();

  const [registrationsResult, membershipsResult, allTeamsResult] = await Promise.all([
    supabase
      .from("registrations")
      .select("tournament_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<Registration[]>(),
    supabase.from("team_members").select("team_id, user_id").eq("user_id", user.id).returns<TeamMember[]>(),
    supabase
      .from("teams")
      .select("id, name, mode, captain_id, created_at, join_type")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<Team[]>(),
  ]);

  const registrations = registrationsResult.data ?? [];
  const registrationsError = registrationsResult.error;

  const myMemberships = membershipsResult.data ?? [];
  const myTeamIds = [...new Set(myMemberships.map((m) => m.team_id))];

  const allTeams = allTeamsResult.data ?? [];
  const teamsTableMissing =
    !!allTeamsResult.error &&
    (allTeamsResult.error.message.includes("schema cache") || allTeamsResult.error.message.includes("teams"));

  const myTeams = allTeams.filter((t) => myTeamIds.includes(t.id) || t.captain_id === user.id);
  const openTeams = allTeams.filter((t) => !myTeams.some((mt) => mt.id === t.id));

  const allTeamIds = allTeams.map((t) => t.id);
  const membersResult = allTeamIds.length
    ? await supabase.from("team_members").select("team_id, user_id").in("team_id", allTeamIds).returns<TeamMember[]>()
    : { data: [] as TeamMember[] };

  const members = membersResult.data ?? [];
  const membersCountByTeam = new Map<string, number>();
  for (const m of members) membersCountByTeam.set(m.team_id, (membersCountByTeam.get(m.team_id) ?? 0) + 1);


  const teamRegistrationResult = allTeamIds.length
    ? await supabase
        .from("registrations")
        .select("team_id, tournaments(games(slug, name))")
        .in("team_id", allTeamIds)
        .returns<Array<{ team_id: string | null; tournaments: { games: { slug?: string | null; name?: string | null } | null } | null }>>()
    : { data: [] as Array<{ team_id: string | null; tournaments: { games: { slug?: string | null; name?: string | null } | null } | null }> };

  const teamGameById = new Map<string, { slug: string | null; name: string | null }>();
  for (const row of teamRegistrationResult.data ?? []) {
    if (!row.team_id || teamGameById.has(row.team_id)) continue;
    teamGameById.set(row.team_id, {
      slug: row.tournaments?.games?.slug ?? null,
      name: row.tournaments?.games?.name ?? null,
    });
  }
  const tournamentIds = [...new Set(registrations.map((x) => x.tournament_id).filter(Boolean))] as string[];
  const tournamentsResult = tournamentIds.length
    ? await supabase.from("tournaments").select("id, title, status, start_at").in("id", tournamentIds).returns<Tournament[]>()
    : { data: [] as Tournament[] };

  const tournaments = tournamentsResult.data ?? [];
  const tournamentsById = new Map(tournaments.map((t) => [t.id, t]));

  const myModes = new Set(myTeams.map((t) => t.mode));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 p-6">
          <div className="absolute -right-14 -top-14 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />

          <div className="relative flex flex-wrap items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-cyan-400 to-fuchsia-500">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={isEn ? "Avatar" : "Аватар"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-black">
                  {getInitial(profile?.username, user.email)}
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{isEn ? "Profile" : "Личный кабинет"}</h1>
              <p className="mt-1 text-sm text-white/70">{isEn ? "Manage username, avatar, teams and registrations." : "Управляйте ником, аватаром, командами и регистрациями."}</p>
              <div className="mt-3 inline-flex rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/80">
                {isEn ? "Role" : "Роль"}: {profile?.role ?? "user"}
              </div>
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 text-sm text-white/80">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Email: {user.email}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{isEn ? "Current username" : "Текущий ник"}: {profile?.username ?? (isEn ? "Not set" : "Не указан")}</div>
          </div>
        </div>

        <form action="/profile/update" method="post" encType="multipart/form-data" className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">{isEn ? "Edit profile" : "Редактирование профиля"}</h2>
          <p className="mt-1 text-sm text-white/60">{isEn ? "Username updates instantly, avatar uploads from file." : "Ник обновляется сразу, аватар загружается файлом."}</p>

          {sp.error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{sp.error}</div>}
          {sp.ok && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{sp.ok}</div>}

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs text-white/60">{isEn ? "Username" : "Ник"}</span>
              <input
                name="username"
                required
                minLength={2}
                maxLength={24}
                defaultValue={profile?.username ?? ""}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                placeholder={isEn ? "Your username" : "Ваш ник"}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs text-white/60">{isEn ? "Avatar file" : "Файл аватара"}</span>
              <input
                name="avatar_file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
              />
              <span className="text-[11px] text-white/50">PNG/JPG/WEBP/GIF/AVIF, {isEn ? "up to" : "до"} 5 MB</span>
            </label>

            {profile?.avatar_url && (
              <label className="inline-flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" name="remove_avatar" className="h-4 w-4" />
                {isEn ? "Remove current avatar" : "Удалить текущий аватар"}
              </label>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
              {isEn ? "Save changes" : "Сохранить изменения"}
            </button>
            <Link href="/support" className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-sm hover:bg-white/5">
              {isEn ? "Contact support" : "Написать в поддержку"}
            </Link>
          </div>
        </form>
      </div>

      <div id="teams" className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">{isEn ? "My teams" : "Мои команды"}</h2>
        <p className="mt-1 text-sm text-white/60">
          {isEn
            ? "For squad max 5 players. For duo max 2 players. Team creation is available only during tournament registration."
            : "Для squad максимум 5 игроков. Для duo максимум 2 игрока. Создание команды теперь доступно только при регистрации на турнир."}
        </p>

        {teamsTableMissing && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            {isEn
              ? "Teams table is not configured in DB yet. Apply SQL migration for teams and team_members."
              : "Таблица команд еще не настроена в базе. Примените SQL-миграцию для teams и team_members."}
          </div>
        )}

        {!teamsTableMissing && (
          <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            {isEn ? "Team is created automatically during duo/squad tournament registration." : "Команда создается автоматически во время регистрации на турнир формата duo/squad."}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {myTeams.map((team) => {
            const count = membersCountByTeam.get(team.id) ?? 1;
            const isCaptain = team.captain_id === user.id;
            const teamGame = teamGameById.get(team.id);
            const limit = getTeamSizeLimit(team.mode, teamGame?.slug ?? null, teamGame?.name ?? null);
            return (
              <div key={team.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{team.name}</div>
                    <div className="mt-1 text-xs text-white/60">
                      {isEn ? "Mode" : "Режим"}: {modeLabel(team.mode)} • {isEn ? "Members" : "Участников"}: {count}/{limit}
                    </div>
                    <div className="mt-1 text-xs text-white/55">
                      {isEn ? "Access" : "Доступ"}: {team.join_type === "password" ? (isEn ? "password" : "по паролю") : (isEn ? "open" : "открытый")}
                    </div>
                    <div className="mt-1 text-xs text-white/50">{isEn ? "Created" : "Создана"}: {toDate(team.created_at, locale)}</div>
                    <div className="mt-1 text-[11px] text-white/45">{isCaptain ? (isEn ? "You are captain" : "Вы капитан") : (isEn ? "You are member" : "Вы участник")}</div>
                  </div>

                  {isCaptain ? (
                    <form action="/teams/delete" method="post">
                      <input type="hidden" name="team_id" value={team.id} />
                      <button type="submit" className="rounded-lg border border-red-400/35 bg-red-500/10 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/20">
                        {isEn ? "Delete" : "Удалить"}
                      </button>
                    </form>
                  ) : (
                    <form action="/teams/leave" method="post">
                      <input type="hidden" name="team_id" value={team.id} />
                      <button type="submit" className="rounded-lg border border-red-400/35 bg-red-500/10 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/20">
                        {isEn ? "Leave" : "Выйти"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}

          {(myTeams.length ?? 0) === 0 && !teamsTableMissing && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{isEn ? "You are not in any teams yet." : "Вы пока не состоите в командах."}</div>
          )}
        </div>
      </div>

      {!teamsTableMissing && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">{isEn ? "Open teams" : "Открытые команды"}</h2>
          <p className="mt-1 text-sm text-white/60">{isEn ? "You can join another team if there is a free slot and you do not already have a team in that mode." : "Вы можете присоединиться к другой команде, если в ней есть место и у вас нет команды этого режима."}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {openTeams.map((team) => {
              const count = membersCountByTeam.get(team.id) ?? 1;
              const teamGame = teamGameById.get(team.id);
              const limit = getTeamSizeLimit(team.mode, teamGame?.slug ?? null, teamGame?.name ?? null);
              const full = count >= limit;
              const blockedByMode = myModes.has(team.mode);

              return (
                <div key={team.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold">{team.name}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {isEn ? "Mode" : "Режим"}: {modeLabel(team.mode)} • {isEn ? "Members" : "Участников"}: {count}/{limit}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {isEn ? "Access" : "Доступ"}: {team.join_type === "password" ? (isEn ? "password" : "по паролю") : (isEn ? "open" : "открытый")}
                  </div>

                  <div className="mt-3">
                    {full ? (
                      <div className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs text-white/60">{isEn ? "Team is full" : "Команда заполнена"}</div>
                    ) : blockedByMode ? (
                      <div className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs text-white/60">
                        {isEn ? "You already have a team for" : "У вас уже есть команда режима"} {modeLabel(team.mode)}
                      </div>
                    ) : (
                      <form action="/teams/join" method="post">
                        <input type="hidden" name="team_id" value={team.id} />
                        {team.join_type === "password" && (
                          <input
                            type="password"
                            name="team_password"
                            required
                            minLength={4}
                            maxLength={32}
                            placeholder={isEn ? "Team password" : "Пароль команды"}
                            className="mb-2 w-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs outline-none focus:border-cyan-400/50"
                          />
                        )}
                        <button type="submit" className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20">
                          {isEn ? "Join" : "Присоединиться"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}

            {(openTeams.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{isEn ? "No available teams to join now." : "Сейчас нет доступных команд для вступления."}</div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">{isEn ? "My tournaments" : "Мои турниры"}</h2>

        {registrationsError && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {isEn ? "Failed to load tournament list" : "Не удалось загрузить список турниров"}: {registrationsError.message}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {registrations.map((r, idx) => {
            const t = r.tournament_id ? tournamentsById.get(r.tournament_id) : null;

            return (
              <div key={`${r.tournament_id ?? "x"}-${idx}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium">{t?.title ?? (isEn ? "Tournament not found" : "Турнир не найден")}</div>
                <div className="mt-1 text-xs text-white/60">
                  {t?.start_at ? toDate(t.start_at, locale) : isEn ? "Date not set" : "Дата не указана"} • {isEn ? "Status" : "Статус"}: {t?.status ?? "-"}
                </div>
                <div className="mt-1 text-xs text-white/60">{isEn ? "Registered" : "Регистрация"}: {toDate(r.created_at, locale)}</div>
                {t?.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/tournaments/${t.id}`} className="inline-block text-xs text-cyan-300 hover:text-cyan-200">
                      {isEn ? "Open tournament" : "Открыть турнир"} →
                    </Link>
                    {t.status !== "finished" && (
                      <form action={`/tournaments/${t.id}/unregister`} method="post">
                        <input type="hidden" name="return_to" value="profile" />
                        <button type="submit" className="rounded-lg border border-red-400/35 bg-red-500/10 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/20">
                          {isEn ? "Cancel registration" : "Отменить регистрацию"}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!registrationsError && registrations.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{isEn ? "You are not registered in any tournament yet." : "Вы еще не зарегистрированы ни на один турнир."}</div>
          )}
        </div>
      </div>
    </div>
  );
}







