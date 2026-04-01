import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getUserEmail, queueEmail } from "@/lib/email";
import { getRequestLocale } from "@/lib/i18nServer";
import { createNotification } from "@/lib/notifications";
import { ensureProfilePayoutColumns } from "@/lib/profilePayouts";
import { pgQuery, pgRows } from "@/lib/postgres";
import { formatEuro } from "@/lib/currency";

type ClaimRow = {
  id: string;
  tournament_id: string;
  place: number;
  amount: number;
  status: string;
  payout_method: string | null;
  recipient_name: string | null;
  payment_details: string | null;
  payout_iban: string | null;
  request_comment: string | null;
  winner_user_id: string;
  team_id: string | null;
  submitted_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  rejection_reason: string | null;
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

export default async function AdminPaymentsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  await requireAdmin();
  await ensureProfilePayoutColumns();

  const claims = await pgRows<ClaimRow>(
    `
      select
        prize_claims.id,
        prize_claims.tournament_id,
        prize_claims.place,
        prize_claims.amount,
        prize_claims.status,
        prize_claims.payout_method,
        prize_claims.recipient_name,
        prize_claims.payment_details,
        p.payout_iban,
        prize_claims.request_comment,
        prize_claims.winner_user_id,
        prize_claims.team_id,
        prize_claims.submitted_at,
        prize_claims.created_at,
        prize_claims.reviewed_at,
        prize_claims.paid_at,
        prize_claims.rejection_reason
      from prize_claims
      left join profiles p on p.id = prize_claims.winner_user_id
      order by prize_claims.created_at desc
    `
  );

  const tournamentIds = [...new Set(claims.map((x) => x.tournament_id))];
  const teamIds = [...new Set(claims.map((x) => x.team_id).filter(Boolean))] as string[];
  const winnerIds = [...new Set(claims.map((x) => x.winner_user_id))];

  const [tournaments, teams, winners] = await Promise.all([
    tournamentIds.length
      ? pgRows<{ id: string; title: string }>(
          `
            select id, title
            from tournaments
            where id = any($1::uuid[])
          `,
          [tournamentIds]
        )
      : Promise.resolve([] as Array<{ id: string; title: string }>),
    teamIds.length
      ? pgRows<{ id: string; name: string }>(
          `
            select id, name
            from teams
            where id = any($1::uuid[])
          `,
          [teamIds]
        )
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    winnerIds.length
      ? pgRows<{ id: string; username: string | null }>(
          `
            select id, username
            from profiles
            where id = any($1::uuid[])
          `,
          [winnerIds]
        )
      : Promise.resolve([] as Array<{ id: string; username: string | null }>),
  ]);

  const tournamentById = new Map(tournaments.map((x) => [x.id, x.title]));
  const teamById = new Map(teams.map((x) => [x.id, x.name]));
  const winnerById = new Map(winners.map((x) => [x.id, x.username ?? x.id]));

  async function approveClaim(formData: FormData) {
    "use server";
    const claimId = String(formData.get("claim_id") ?? "").trim();
    if (!claimId) return;
    const { user } = await requireAdmin();
    await pgQuery(
      `
        update prize_claims
        set status = 'approved',
            reviewed_at = $2,
            reviewed_by = $3,
            rejection_reason = null
        where id = $1
      `,
      [claimId, new Date().toISOString(), user.id]
    );
    const claim = claims.find((item) => item.id === claimId);
    if (claim) {
      await createNotification({
        userId: claim.winner_user_id,
        type: "payout_approved",
        title: isEn ? "Payout request approved" : "Заявка на выплату одобрена",
        body: isEn ? "Your payout details were approved." : "Ваши реквизиты на выплату одобрены.",
        href: "/profile",
      });
      const email = await getUserEmail(claim.winner_user_id);
      if (email) {
        await queueEmail({
          toEmail: email,
          subject: isEn ? "Payout request approved" : "Заявка на выплату одобрена",
          textBody: isEn ? "Your payout request was approved. Open /profile for details." : "Ваша заявка на выплату одобрена. Откройте /profile для деталей.",
          kind: "payout_approved",
          userId: claim.winner_user_id,
          meta: { claimId },
        });
      }
    }
    revalidatePath("/admin/payments");
    revalidatePath("/profile");
  }

  async function rejectClaim(formData: FormData) {
    "use server";
    const claimId = String(formData.get("claim_id") ?? "").trim();
    const reason = String(formData.get("rejection_reason") ?? "").trim();
    if (!claimId) return;
    const { user } = await requireAdmin();
    await pgQuery(
      `
        update prize_claims
        set status = 'rejected',
            reviewed_at = $2,
            reviewed_by = $3,
            rejection_reason = $4
        where id = $1
      `,
      [claimId, new Date().toISOString(), user.id, reason || null]
    );
    const claim = claims.find((item) => item.id === claimId);
    if (claim) {
      await createNotification({
        userId: claim.winner_user_id,
        type: "payout_rejected",
        title: isEn ? "Payout request rejected" : "Заявка на выплату отклонена",
        body: reason || (isEn ? "Please update your payout details." : "Пожалуйста, обновите реквизиты."),
        href: "/profile",
      });
    }
    revalidatePath("/admin/payments");
    revalidatePath("/profile");
  }

  async function markClaimPaid(formData: FormData) {
    "use server";
    const claimId = String(formData.get("claim_id") ?? "").trim();
    if (!claimId) return;
    const { user } = await requireAdmin();
    await pgQuery(
      `
        update prize_claims
        set status = 'paid',
            paid_at = $2,
            paid_by = $3
        where id = $1
      `,
      [claimId, new Date().toISOString(), user.id]
    );
    const claim = claims.find((item) => item.id === claimId);
    if (claim) {
      await createNotification({
        userId: claim.winner_user_id,
        type: "payout_paid",
        title: isEn ? "Prize paid" : "Приз выплачен",
        body: isEn ? "Your payout was marked as paid." : "Выплата отмечена как завершенная.",
        href: "/profile",
      });
    }
    revalidatePath("/admin/payments");
    revalidatePath("/profile");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h1 className="text-xl font-bold">{isEn ? "Payouts" : "Выплаты"}</h1>
        <p className="mt-1 text-sm text-white/60">
          {isEn ? "Approve payout requests and mark manual payments as paid." : "Проверяйте заявки и отмечайте ручные выплаты."}
        </p>
      </div>

      <div className="space-y-3">
        {claims.map((claim) => (
          <form key={claim.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <input type="hidden" name="claim_id" value={claim.id} />
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div>{isEn ? "Tournament" : "Турнир"}: {tournamentById.get(claim.tournament_id) ?? claim.tournament_id}</div>
              <div>{isEn ? "Team / user" : "Команда / пользователь"}: {claim.team_id ? (teamById.get(claim.team_id) ?? claim.team_id) : "-"} / {winnerById.get(claim.winner_user_id) ?? claim.winner_user_id}</div>
              <div>{isEn ? "Place" : "Место"}: {claim.place}</div>
              <div>{isEn ? "Amount" : "Сумма"}: {formatEuro(claim.amount, locale)}</div>
              <div>{isEn ? "Status" : "Статус"}: {claim.status}</div>
              <div>{isEn ? "Requested" : "Дата заявки"}: {toDate(claim.submitted_at ?? claim.created_at, locale)}</div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/75">
              <div>{isEn ? "Method" : "Способ"}: {claim.payout_method ?? "-"}</div>
              <div>{isEn ? "Recipient" : "Получатель"}: {claim.recipient_name ?? "-"}</div>
              <div>IBAN: {claim.payout_iban ?? "-"}</div>
              <div className="mt-1">
                {isEn ? "Details" : "Реквизиты"}:
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans">{claim.payment_details ?? "-"}</pre>
              </div>
              <div className="mt-1">{isEn ? "Comment" : "Комментарий"}: {claim.request_comment ?? "-"}</div>
              {claim.rejection_reason && <div className="mt-1 text-red-300">{isEn ? "Reject reason" : "Причина отклонения"}: {claim.rejection_reason}</div>}
              {claim.paid_at && <div className="mt-1 text-emerald-300">{isEn ? "Paid at" : "Выплачено"}: {toDate(claim.paid_at, locale)}</div>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button formAction={approveClaim} className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20">
                approve
              </button>
              <input
                type="text"
                name="rejection_reason"
                placeholder={isEn ? "Reject reason (optional)" : "Причина отклонения (необязательно)"}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs"
              />
              <button formAction={rejectClaim} className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/20">
                reject
              </button>
              <button formAction={markClaimPaid} className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20">
                paid
              </button>
            </div>
          </form>
        ))}

        {claims.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            {isEn ? "No payout requests yet." : "Пока нет заявок на выплаты."}
          </div>
        )}
      </div>
    </div>
  );
}
