import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";
import { ensureProfilePayoutColumns } from "@/lib/profilePayouts";
import { getTeamSizeLimit } from "@/lib/tournamentLimits";
import { pgMaybeOne, pgQuery, pgRows } from "@/lib/postgres";
import { formatEuro } from "@/lib/currency";

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

type PrizeClaim = {
  id: string;
  tournament_id: string;
  place: number;
  team_id: string | null;
  amount: number;
  status: "awaiting_details" | "pending_review" | "approved" | "rejected" | "paid" | "cancelled" | string;
  payout_method: string | null;
  recipient_name: string | null;
  payment_details: string | null;
  request_comment: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  tournaments: { title: string | null } | null;
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
  const { user, profile } = await requireUser();
  await ensureProfilePayoutColumns();

  const profilePayout = await pgMaybeOne<{ payout_iban: string | null }>(
    `
      select payout_iban
      from profiles
      where id = $1
      limit 1
    `,
    [user.id]
  );

  const registrations = await pgRows<Registration>(
    `
      select tournament_id, created_at
      from registrations
      where user_id = $1
      order by created_at desc
      limit 30
    `,
    [user.id]
  );

  const [nextTournament, openSupportThreads] = await Promise.all([
    pgMaybeOne<{ id: string; title: string; start_at: string }>(
      `
        select t.id, t.title, t.start_at
        from registrations r
        join tournaments t on t.id = r.tournament_id
        where r.user_id = $1 and t.start_at >= now()
        order by t.start_at asc
        limit 1
      `,
      [user.id]
    ),
    pgMaybeOne<{ count: string }>(
      `
        select count(*)::text as count
        from support_threads
        where user_id = $1 and status = 'open'
      `,
      [user.id]
    ),
  ]);

  let myMemberships: TeamMember[] = [];
  let allTeams: Team[] = [];
  let teamsTableMissing = false;
  try {
    const [memberships, teams] = await Promise.all([
      pgRows<TeamMember>(
        `
          select team_id, user_id
          from team_members
          where user_id = $1
        `,
        [user.id]
      ),
      pgRows<Team>(
        `
          select id, name, mode, captain_id, created_at, join_type
          from teams
          order by created_at desc
          limit 50
        `
      ),
    ]);
    myMemberships = memberships;
    allTeams = teams;
  } catch {
    teamsTableMissing = true;
  }

  const prizeClaims = await pgRows<PrizeClaim>(
    `
      select
        pc.id,
        pc.tournament_id,
        pc.place,
        pc.team_id,
        pc.amount,
        pc.status,
        pc.payout_method,
        pc.recipient_name,
        pc.payment_details,
        pc.request_comment,
        pc.submitted_at,
        pc.rejection_reason,
        pc.reviewed_at,
        pc.paid_at,
        json_build_object('title', t.title) as tournaments
      from prize_claims pc
      left join tournaments t on t.id = pc.tournament_id
      where pc.winner_user_id = $1
      order by pc.created_at desc
    `,
    [user.id]
  );

  const myTeamIds = [...new Set(myMemberships.map((m) => m.team_id))];
  const myTeams = allTeams.filter((t) => myTeamIds.includes(t.id) || t.captain_id === user.id);
  const openTeams = allTeams.filter((t) => !myTeams.some((mt) => mt.id === t.id));
  const allTeamIds = allTeams.map((t) => t.id);

  const members = allTeamIds.length
    ? await pgRows<TeamMember>(
        `
          select team_id, user_id
          from team_members
          where team_id = any($1::uuid[])
        `,
        [allTeamIds]
      )
    : [];

  const membersCountByTeam = new Map<string, number>();
  for (const m of members) membersCountByTeam.set(m.team_id, (membersCountByTeam.get(m.team_id) ?? 0) + 1);

  const teamRegistrationRows = allTeamIds.length
    ? await pgRows<Array<{ team_id: string; slug: string | null; name: string | null }>[number]>(
        `
          select distinct on (r.team_id)
            r.team_id,
            g.slug,
            g.name
          from registrations r
          left join tournaments t on t.id = r.tournament_id
          left join games g on g.id = t.game_id
          where r.team_id = any($1::uuid[])
        `,
        [allTeamIds]
      )
    : [];

  const teamGameById = new Map<string, { slug: string | null; name: string | null }>();
  for (const row of teamRegistrationRows) {
    teamGameById.set(row.team_id, { slug: row.slug, name: row.name });
  }

  const tournamentIds = [...new Set(registrations.map((x) => x.tournament_id).filter(Boolean))] as string[];
  const tournaments = tournamentIds.length
    ? await pgRows<Tournament>(
        `
          select id, title, status, start_at
          from tournaments
          where id = any($1::uuid[])
        `,
        [tournamentIds]
      )
    : [];
  const tournamentsById = new Map(tournaments.map((t) => [t.id, t]));

  async function submitPrizeDetails(formData: FormData) {
    "use server";

    const { user } = await requireUser();
    const claimId = String(formData.get("claim_id") ?? "").trim();
    const payoutMethod = String(formData.get("payout_method") ?? "").trim();
    const recipientName = String(formData.get("recipient_name") ?? "").trim();
    const paymentDetails = String(formData.get("payment_details") ?? "").trim();
    const requestComment = String(formData.get("request_comment") ?? "").trim();
    if (!claimId || !payoutMethod || recipientName.length < 2 || paymentDetails.length < 5 || paymentDetails.length > 2000) {
      redirect(`/profile?error=${encodeURIComponent(isEn ? "Invalid payment details" : "Некорректные реквизиты")}`);
    }

    const claim = await pgMaybeOne<{ id: string; status: string }>(
      `
        select id, status
        from prize_claims
        where id = $1 and winner_user_id = $2
        limit 1
      `,
      [claimId, user.id]
    );

    if (!claim?.id || claim.status === "paid" || claim.status === "cancelled") {
      redirect(`/profile?error=${encodeURIComponent(isEn ? "Prize claim not available" : "Заявка на приз недоступна")}`);
    }

    await pgQuery(
      `
        update prize_claims
        set
          payout_method = $3,
          recipient_name = $4,
          payment_details = $5,
          request_comment = $6,
          status = 'pending_review',
          submitted_at = now()
        where id = $1 and winner_user_id = $2
      `,
      [claimId, user.id, payoutMethod, recipientName, paymentDetails, requestComment || null]
    );

    revalidatePath("/profile");
    redirect(`/profile?ok=${encodeURIComponent(isEn ? "Payment details sent" : "Реквизиты отправлены")}`);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 p-4 sm:p-6">
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
              <div className="mt-3 inline-flex rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/80">
                {isEn ? "Role" : "Роль"}: {profile?.role ?? "user"}
              </div>
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 text-sm text-white/80">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Email: {user.email}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">IBAN: {profilePayout?.payout_iban ?? "-"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{isEn ? "Current username" : "Текущий ник"}: {profile?.username ?? (isEn ? "Not set" : "Не указан")}</div>
          </div>
        </div>

        <form action="/profile/update" method="post" encType="multipart/form-data" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{isEn ? "Edit profile" : "Редактирование профиля"}</h2>

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

            <label className="grid gap-2">
              <span className="text-xs text-white/60">IBAN</span>
              <input
                name="payout_iban"
                maxLength={34}
                defaultValue={profilePayout?.payout_iban ?? ""}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm uppercase outline-none focus:border-cyan-400/50"
                placeholder="DE89 3704 0044 0532 0130 00"
              />
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">{isEn ? "Open support threads" : "Открытые обращения"}</div>
          <div className="mt-2 text-2xl font-bold">{Number(openSupportThreads?.count ?? 0)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">{isEn ? "Pending payouts" : "Ожидающие выплаты"}</div>
          <div className="mt-2 text-2xl font-bold">{prizeClaims.filter((claim) => claim.status !== "paid" && claim.status !== "cancelled").length}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60">{isEn ? "Next tournament" : "Ближайший турнир"}</div>
          <div className="mt-2 text-sm font-semibold">{nextTournament?.title ?? (isEn ? "Not scheduled" : "Не запланирован")}</div>
          <div className="mt-1 text-xs text-white/60">{nextTournament?.start_at ? toDate(nextTournament.start_at, locale) : "-"}</div>
        </div>
      </div>

      <div id="teams" className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{isEn ? "My teams" : "Мои команды"}</h2>

        {teamsTableMissing && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            {isEn
              ? "Teams table is not configured in DB yet. Apply SQL migration for teams and team_members."
              : "Таблица команд еще не настроена в базе. Примените SQL-миграцию для teams и team_members."}
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
                      {isEn ? "Mode" : "Режим"}: {modeLabel(team.mode)} / {isEn ? "Members" : "Участников"}: {count}/{limit}
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

          {myTeams.length === 0 && !teamsTableMissing && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{isEn ? "You are not in any teams yet." : "Вы пока не состоите в командах."}</div>
          )}
        </div>
      </div>

      {!teamsTableMissing && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{isEn ? "Open teams" : "Открытые команды"}</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {openTeams.map((team) => {
              const count = membersCountByTeam.get(team.id) ?? 1;
              const teamGame = teamGameById.get(team.id);
              const limit = getTeamSizeLimit(team.mode, teamGame?.slug ?? null, teamGame?.name ?? null);
              const full = count >= limit;
              return (
                <div key={team.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold">{team.name}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {isEn ? "Mode" : "Режим"}: {modeLabel(team.mode)} / {isEn ? "Members" : "Участников"}: {count}/{limit}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {isEn ? "Access" : "Доступ"}: {team.join_type === "password" ? (isEn ? "password" : "по паролю") : (isEn ? "open" : "открытый")}
                  </div>

                  <div className="mt-3">
                    {full ? (
                      <div className="rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 text-xs text-white/60">{isEn ? "Team is full" : "Команда заполнена"}</div>
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

            {openTeams.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{isEn ? "No available teams to join now." : "Сейчас нет доступных команд для вступления."}</div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{isEn ? "My prizes" : "Мои призы"}</h2>

        <div className="mt-4 space-y-3">
          {prizeClaims.map((claim) => (
            <div key={claim.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-medium">
                {claim.tournaments?.title ?? (isEn ? "Tournament" : "Турнир")}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {isEn ? "Place" : "Место"}: {claim.place}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {isEn ? "Prize" : "Приз"}: {formatEuro(claim.amount, locale)}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {isEn ? "Status" : "Статус"}: {claim.status}
              </div>

              {claim.status === "awaiting_details" && (
                <details className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-cyan-100">
                    {isEn ? "Send payment details" : "Отправить реквизиты"}
                  </summary>
                  <form action={submitPrizeDetails} className="mt-3 space-y-2">
                    <input type="hidden" name="claim_id" value={claim.id} />
                    <select
                      name="payout_method"
                      required
                      defaultValue="card"
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                    >
                      <option value="card">card</option>
                      <option value="crypto">crypto</option>
                      <option value="paypal">paypal</option>
                      <option value="manual">manual</option>
                    </select>
                    <input
                      name="recipient_name"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder={isEn ? "Recipient name" : "ФИО / имя получателя"}
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                    />
                    <textarea
                      name="payment_details"
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={4}
                      placeholder={isEn ? "Payment details" : "Реквизиты"}
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                    />
                    <textarea
                      name="request_comment"
                      rows={2}
                      maxLength={400}
                      placeholder={isEn ? "Comment (optional)" : "Комментарий (необязательно)"}
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                    />
                    <button type="submit" className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20">
                      {isEn ? "Submit" : "Отправить"}
                    </button>
                  </form>
                </details>
              )}

              {claim.status === "pending_review" && (
                <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  {isEn ? "Payment details sent. Waiting for admin review." : "Реквизиты отправлены. Ожидайте проверки администратором."}
                </div>
              )}

              {claim.status === "approved" && (
                <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  {isEn ? "Approved. Waiting for manual payment." : "Одобрено. Ожидайте ручную выплату."}
                </div>
              )}

              {claim.status === "rejected" && (
                <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {isEn ? "Rejected" : "Отклонено"}
                  {claim.rejection_reason ? `: ${claim.rejection_reason}` : ""}
                </div>
              )}

              {claim.status === "paid" && (
                <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  {isEn ? "Prize paid" : "Приз выплачен"}
                  {claim.paid_at ? `: ${toDate(claim.paid_at, locale)}` : ""}
                </div>
              )}
            </div>
          ))}

          {prizeClaims.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              {isEn ? "No prize claims yet." : "Пока нет заявок на приз."}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{isEn ? "My tournaments" : "Мои турниры"}</h2>

        <div className="mt-4 space-y-3">
          {registrations.map((r, idx) => {
            const t = r.tournament_id ? tournamentsById.get(r.tournament_id) : null;

            return (
              <div key={`${r.tournament_id ?? "x"}-${idx}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium">{t?.title ?? (isEn ? "Tournament not found" : "Турнир не найден")}</div>
                <div className="mt-1 text-xs text-white/60">
                  {t?.start_at ? toDate(t.start_at, locale) : isEn ? "Date not set" : "Дата не указана"} / {isEn ? "Status" : "Статус"}: {t?.status ?? "-"}
                </div>
                <div className="mt-1 text-xs text-white/60">{isEn ? "Registered" : "Регистрация"}: {toDate(r.created_at, locale)}</div>
                {t?.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/tournaments/${t.id}`} className="inline-block text-xs text-cyan-300 hover:text-cyan-200">
                      {isEn ? "Open tournament" : "Открыть турнир"} {"->"}
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

          {registrations.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{isEn ? "You are not registered in any tournament yet." : "Вы еще не зарегистрированы ни на один турнир."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
