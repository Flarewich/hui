import Link from "next/link";
import { notFound } from "next/navigation";
import MatchRoomActions from "@/components/MatchRoomActions";
import { getTournamentRegistrationRows } from "@/lib/registrationTable";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getRequestLocale } from "@/lib/i18nServer";

type Tournament = {
  id: string;
  title: string;
  status: "upcoming" | "live" | "finished" | string;
  mode: "solo" | "duo" | "squad" | string;
  start_at: string;
  room_code: string | null;
  room_password: string | null;
  room_instructions: string | null;
  games: { name: string; slug?: string | null } | null;
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

function statusMeta(status: string, locale: "ru" | "en") {
  if (status === "live") return { label: "LIVE", cls: "border-red-400/30 bg-red-500/15 text-red-100" };
  if (status === "finished") return { label: locale === "en" ? "FINISHED" : "Завершен", cls: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100" };
  return { label: locale === "en" ? "SOON" : "Скоро", cls: "border-cyan-400/30 bg-cyan-500/15 text-cyan-100" };
}

function canRevealRoom(startAt: string, status: string) {
  if (status === "finished") return false;
  const startTs = new Date(startAt).getTime();
  if (Number.isNaN(startTs)) return status === "live";
  const msLeft = startTs - Date.now();
  return msLeft <= 10 * 60 * 1000;
}

export default async function TournamentRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  const supabase = await createSupabaseServerClient();
  const [tournamentResult, authResult, registrationRows] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, title, status, mode, start_at, room_code, room_password, room_instructions, games(name, slug)")
      .eq("id", id)
      .maybeSingle<Tournament>(),
    supabase.auth.getUser(),
    getTournamentRegistrationRows(id),
  ]);

  const tournament = tournamentResult.data;
  if (!tournament) notFound();

  const user = authResult.data.user;
  const myRegistration = user ? await supabaseAdmin.from("registrations").select("id").eq("tournament_id", id).eq("user_id", user.id).maybeSingle() : null;

  const isRegistered = !!myRegistration?.data?.id;
  const dynamicStatus = effectiveStatus(tournament.status, tournament.start_at);
  const status = statusMeta(dynamicStatus, locale);
  const reveal = canRevealRoom(tournament.start_at, dynamicStatus);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-3xl border border-cyan-400/20 p-4 sm:p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">{isEn ? "Match room" : "Матч-рум"}</h1>
            <p className="mt-2 text-sm text-white/75">
              {tournament.title} • {tournament.games?.name ?? (isEn ? "Game not specified" : "Игра не указана")} • {isEn ? "start" : "старт"} {toDate(tournament.start_at, locale)}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 md:p-6">
        <h2 className="text-lg font-semibold">{isEn ? "Participants" : "Участники"}</h2>
        {(registrationRows ?? []).length === 0 ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
            {isEn ? "No registered participants yet." : "Пока нет зарегистрированных участников."}
          </div>
        ) : (
          <div className="mt-3">
            <div className="space-y-2 sm:hidden">
              {registrationRows.map((row, idx) => (
                <article key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{row.username}</div>
                    <div className="text-xs text-white/60">#{idx + 1}</div>
                  </div>
                  <div className="mt-2 text-xs text-white/70">
                    <div>{isEn ? "Team" : "Команда"}: {row.team_name ?? "-"}</div>
                    <div className="mt-1">{isEn ? "Registered" : "Регистрация"}: {toDate(row.created_at, locale)}</div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="text-white/60">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{isEn ? "Player" : "Игрок"}</th>
                    <th className="px-3 py-2">{isEn ? "Team" : "Команда"}</th>
                    <th className="px-3 py-2">{isEn ? "Registration" : "Регистрация"}</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationRows.map((row, idx) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="px-3 py-2 text-white/70">{idx + 1}</td>
                      <td className="px-3 py-2">{row.username}</td>
                      <td className="px-3 py-2 text-white/80">{row.team_name ?? "-"}</td>
                      <td className="px-3 py-2 text-white/70">{toDate(row.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5 md:p-6">
        <h2 className="text-lg font-semibold">{isEn ? "How to join the game" : "Как зайти в игру"}</h2>

        {!isRegistered ? (
          <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {isEn ? "Register for this tournament first to access match room details." : "Сначала зарегистрируйся на турнир, чтобы получить доступ к матч-руму."}
            <div className="mt-3">
              <Link href={`/tournaments/${id}`} className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                {isEn ? "Go to registration" : "Перейти к регистрации"}
              </Link>
            </div>
          </div>
        ) : !reveal ? (
          <div className="mt-3 rounded-2xl border border-white/15 bg-black/20 p-4 text-sm text-white/70">
            {isEn ? "Room details will be shown 10 minutes before start." : "Данные входа откроются за 10 минут до старта турнира."}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/60">Room ID / Lobby code</div>
                <div className="mt-1 break-all text-lg font-bold">{tournament.room_code ?? (isEn ? "Not specified" : "Не указан")}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/60">Password</div>
                <div className="mt-1 break-all text-lg font-bold">{tournament.room_password ?? (isEn ? "Not specified" : "Не указан")}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
              <div className="mb-1 text-xs uppercase tracking-wide text-white/60">{isEn ? "Instructions" : "Инструкция"}</div>
              {tournament.room_instructions?.trim() ? (
                <pre className="whitespace-pre-wrap break-words font-sans">{tournament.room_instructions}</pre>
              ) : (
                <p>
                  {isEn
                    ? "1) Open the game. 2) Join lobby with code and password. 3) Press “I’m ready” below."
                    : "1) Откройте игру. 2) Войдите в лобби по коду и паролю. 3) Нажмите «Я готов» внизу."}
                </p>
              )}
            </div>

            <MatchRoomActions tournamentId={id} gameSlug={tournament.games?.slug ?? null} roomCode={tournament.room_code} roomPassword={tournament.room_password} locale={locale} />
          </div>
        )}
      </section>
    </div>
  );
}
