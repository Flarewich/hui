import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";
import { formatEuro } from "@/lib/currency";
import { pgMaybeOne, pgRows } from "@/lib/postgres";
import { ensureProfilePayoutColumns } from "@/lib/profilePayouts";

type UserProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string | null;
  is_banned: boolean | null;
  banned_until: string | null;
  restricted_until: string | null;
  payout_iban: string | null;
  email: string | null;
};

type Registration = {
  tournament_id: string | null;
  created_at: string;
  title: string | null;
  status: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  mode: string;
  captain_id: string;
  created_at: string;
};

type PrizeClaim = {
  id: string;
  tournament_id: string;
  place: number;
  amount: number;
  status: string;
  payout_method: string | null;
  recipient_name: string | null;
  payment_details: string | null;
  paid_at: string | null;
  title: string | null;
};

function toDate(ts: string | null | undefined, locale: "ru" | "en") {
  if (!ts) return "-";
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activeStatus(user: Pick<UserProfile, "is_banned" | "banned_until" | "restricted_until">, locale: "ru" | "en") {
  const now = Date.now();
  const banned =
    Boolean(user.is_banned) || (user.banned_until ? new Date(user.banned_until).getTime() > now : false);
  if (banned) return locale === "en" ? "Banned" : "Забанен";

  const restricted = user.restricted_until ? new Date(user.restricted_until).getTime() > now : false;
  if (restricted) return locale === "en" ? "Restricted" : "Ограничен";

  return locale === "en" ? "Active" : "Активен";
}

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  await requireAdmin();
  await ensureProfilePayoutColumns();

  const { id } = await params;

  const profile = await pgMaybeOne<UserProfile>(
    `
      select
        p.id,
        p.username,
        p.avatar_url,
        p.role,
        p.created_at,
        p.is_banned,
        p.banned_until,
        p.restricted_until,
        p.payout_iban,
        ua.email
      from profiles p
      left join user_accounts ua on ua.user_id = p.id
      where p.id = $1
      limit 1
    `,
    [id]
  );

  if (!profile) notFound();

  const [registrations, teams, prizeClaims] = await Promise.all([
    pgRows<Registration>(
      `
        select r.tournament_id, r.created_at, t.title, t.status
        from registrations r
        left join tournaments t on t.id = r.tournament_id
        where r.user_id = $1
        order by r.created_at desc
        limit 30
      `,
      [id]
    ),
    pgRows<TeamRow>(
      `
        select distinct t.id, t.name, t.mode, t.captain_id, t.created_at
        from teams t
        left join team_members tm on tm.team_id = t.id
        where t.captain_id = $1 or tm.user_id = $1
        order by t.created_at desc
        limit 20
      `,
      [id]
    ).catch(() => [] as TeamRow[]),
    pgRows<PrizeClaim>(
      `
        select
          pc.id,
          pc.tournament_id,
          pc.place,
          pc.amount,
          pc.status,
          pc.payout_method,
          pc.recipient_name,
          pc.payment_details,
          pc.paid_at,
          t.title
        from prize_claims pc
        left join tournaments t on t.id = pc.tournament_id
        where pc.winner_user_id = $1
        order by pc.created_at desc
        limit 20
      `,
      [id]
    ).catch(() => [] as PrizeClaim[]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? "User profile" : "Профиль пользователя"}</h1>
          <p className="mt-1 text-sm text-white/60">{isEn ? "Admin read-only view of the user account." : "Просмотр аккаунта пользователя для администратора."}</p>
        </div>
        <Link href="/admin/users" className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-sm hover:bg-white/5">
          {isEn ? "Back to users" : "Назад к пользователям"}
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-cyan-400 to-fuchsia-500">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.username ?? profile.email ?? "user"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-black">
                  {(profile.username?.[0] ?? profile.email?.[0] ?? "U").toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="text-2xl font-extrabold">{profile.username ?? "-"}</div>
              <div className="mt-1 text-sm text-white/60">{profile.email ?? "-"}</div>
              <div className="mt-3 inline-flex rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/80">
                {isEn ? "Role" : "Роль"}: {profile.role ?? "user"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-sm text-white/80">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{isEn ? "Status" : "Статус"}: {activeStatus(profile, locale)}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{isEn ? "Created" : "Создан"}: {toDate(profile.created_at, locale)}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">IBAN: {profile.payout_iban ?? "-"}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{isEn ? "Payout details" : "Платежные данные"}</h2>
          <div className="mt-4 space-y-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/50">IBAN</div>
              <div className="mt-1 break-all">{profile.payout_iban ?? "-"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/60">
              {isEn ? "Current IBAN is stored in the user profile and can be used during manual payout review." : "Текущий IBAN хранится в профиле пользователя и может использоваться при ручной проверке выплат."}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{isEn ? "Registrations" : "Регистрации"}</h2>
        <div className="mt-4 space-y-3">
          {registrations.map((item, index) => (
            <div key={`${item.tournament_id ?? "x"}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
              <div className="font-medium">{item.title ?? (isEn ? "Tournament not found" : "Турнир не найден")}</div>
              <div className="mt-1 text-white/60">{isEn ? "Registered" : "Регистрация"}: {toDate(item.created_at, locale)}</div>
              <div className="mt-1 text-white/60">{isEn ? "Status" : "Статус"}: {item.status ?? "-"}</div>
            </div>
          ))}
          {registrations.length === 0 && <div className="text-sm text-white/60">{isEn ? "No registrations." : "Нет регистраций."}</div>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{isEn ? "Teams" : "Команды"}</h2>
          <div className="mt-4 space-y-3">
            {teams.map((team) => (
              <div key={team.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                <div className="font-medium">{team.name}</div>
                <div className="mt-1 text-white/60">{isEn ? "Mode" : "Режим"}: {team.mode}</div>
                <div className="mt-1 text-white/60">{isEn ? "Created" : "Создана"}: {toDate(team.created_at, locale)}</div>
                <div className="mt-1 text-white/60">{team.captain_id === profile.id ? (isEn ? "Captain" : "Капитан") : (isEn ? "Member" : "Участник")}</div>
              </div>
            ))}
            {teams.length === 0 && <div className="text-sm text-white/60">{isEn ? "No teams." : "Нет команд."}</div>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{isEn ? "Prize claims" : "Заявки на призы"}</h2>
          <div className="mt-4 space-y-3">
            {prizeClaims.map((claim) => (
              <div key={claim.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                <div className="font-medium">{claim.title ?? (isEn ? "Tournament" : "Турнир")}</div>
                <div className="mt-1 text-white/60">{isEn ? "Place" : "Место"}: {claim.place}</div>
                <div className="mt-1 text-white/60">{isEn ? "Amount" : "Сумма"}: {formatEuro(claim.amount, locale)}</div>
                <div className="mt-1 text-white/60">{isEn ? "Status" : "Статус"}: {claim.status}</div>
                <div className="mt-1 text-white/60">{isEn ? "Method" : "Способ"}: {claim.payout_method ?? "-"}</div>
                <div className="mt-1 text-white/60">{isEn ? "Recipient" : "Получатель"}: {claim.recipient_name ?? "-"}</div>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-white/75">
                  <div className="text-[11px] text-white/45">{isEn ? "Payment details" : "Реквизиты"}</div>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-sans">{claim.payment_details ?? "-"}</pre>
                </div>
              </div>
            ))}
            {prizeClaims.length === 0 && <div className="text-sm text-white/60">{isEn ? "No prize claims." : "Нет заявок на призы."}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
