"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicRegistrationRow } from "@/lib/registrationTable";

function toDate(ts: string, locale: "ru" | "en") {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDisplayedTotal(rows: PublicRegistrationRow[]) {
  const teamCountMap = new Map<string, number>();
  let soloCount = 0;

  for (const row of rows) {
    if (!row.team_id) {
      soloCount += 1;
      continue;
    }
    const membersCount = Math.max(1, Number(row.team_members_count ?? 1));
    const prev = teamCountMap.get(row.team_id) ?? 0;
    teamCountMap.set(row.team_id, Math.max(prev, membersCount));
  }

  const teamsTotal = [...teamCountMap.values()].reduce((sum, value) => sum + value, 0);
  return soloCount + teamsTotal;
}

export default function TournamentParticipantsTable({
  tournamentId,
  initialRows,
  locale = "ru",
}: {
  tournamentId: string;
  initialRows: PublicRegistrationRow[];
  locale?: "ru" | "en";
}) {
  const [rows, setRows] = useState<PublicRegistrationRow[]>(initialRows);
  const displayedTotal = useMemo(() => getDisplayedTotal(rows), [rows]);
  const isEn = locale === "en";

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const response = await fetch(`/api/tournaments/${tournamentId}/registrations`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { rows?: PublicRegistrationRow[] };
      if (!cancelled && Array.isArray(payload.rows)) setRows(payload.rows);
    }

    const timer = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tournamentId]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{isEn ? "Registration table" : "Таблица регистрации"}</h2>
        <div className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs text-white/70">
          {isEn ? "Total players" : "Игроков всего"}: {displayedTotal}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
          {isEn ? "No registered players yet." : "Пока нет зарегистрированных участников."}
        </div>
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            {rows.map((row, idx) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{row.username}</div>
                  <div className="text-xs text-white/60">#{idx + 1}</div>
                </div>
                <div className="mt-2 text-xs text-white/70">
                  <div>{isEn ? "Team" : "Команда"}: {row.team_name ?? "-"}</div>
                  {row.team_name && (
                    <div className="mt-1">
                      {isEn ? "Members" : "Состав"}: {row.team_members_count ?? 1}
                      {row.team_other_players.length > 0
                        ? ` • ${isEn ? "Players" : "Игроки"}: ${row.team_other_players.join(", ")}`
                        : ""}
                    </div>
                  )}
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
                  <th className="px-3 py-2">{isEn ? "Registration time" : "Время регистрации"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-3 py-2 text-white/70">{idx + 1}</td>
                    <td className="px-3 py-2">{row.username}</td>
                    <td className="px-3 py-2 text-white/80">
                      {row.team_name ? (
                        <div>
                          <div>{row.team_name}</div>
                          <div className="text-xs text-white/60">
                            {isEn ? "Members" : "Состав"}: {row.team_members_count ?? 1}
                            {row.team_other_players.length > 0
                              ? ` • ${isEn ? "Other players" : "Другие игроки"}: ${row.team_other_players.join(", ")}`
                              : ""}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-white/70">{toDate(row.created_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
