"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getLocalGameIcon } from "@/lib/gameIcons";

type TournamentStatus = "upcoming" | "live" | "finished";

type TournamentCardProps = {
  registerLabel: string;
  numberLocale: string;
  currencyLabel: string;
  locale?: "ru" | "en";
  startsInFiveMinutes?: boolean;
  t: {
    id: string;
    game: string;
    gameSlug: string | null;
    gameIconUrl?: string | null;
    title: string;
    start: string;
    startAtRaw?: string;
    prize: number;
    status: string;
    mode: string;
  };
};

function resolveStatus(baseStatus: string, startAtRaw?: string): TournamentStatus {
  if (baseStatus === "finished") return "finished";
  if (!startAtRaw) return baseStatus === "live" ? "live" : "upcoming";
  return Date.now() >= new Date(startAtRaw).getTime() ? "live" : "upcoming";
}

function statusMeta(status: TournamentStatus, locale: "ru" | "en") {
  const labels = locale === "en"
    ? { live: "LIVE", finished: "FINISHED", soon: "SOON" }
    : { live: "LIVE", finished: "ЗАВЕРШЕН", soon: "СКОРО" };
  if (status === "live") {
    return {
      label: labels.live,
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
    };
  }
  if (status === "finished") {
    return {
      label: labels.finished,
      badge: "bg-zinc-500/20 text-zinc-200 border-zinc-400/40",
    };
  }
  return {
    label: labels.soon,
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
  };
}

export default function TournamentCard({ registerLabel, numberLocale, currencyLabel, locale = "ru", startsInFiveMinutes, t }: TournamentCardProps) {
  const [effectiveStatus, setEffectiveStatus] = useState<TournamentStatus>(() => resolveStatus(t.status, t.startAtRaw));
  const iconSrc = t.gameIconUrl || getLocalGameIcon(t.gameSlug) || getLocalGameIcon(t.game);

  useEffect(() => {
    const updateStatus = () => setEffectiveStatus(resolveStatus(t.status, t.startAtRaw));
    updateStatus();
    const interval = window.setInterval(updateStatus, 15000);
    return () => window.clearInterval(interval);
  }, [t.status, t.startAtRaw]);

  const meta = useMemo(() => statusMeta(effectiveStatus, locale), [effectiveStatus, locale]);

  return (
    <article className="card tournament-glow p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconSrc} alt={t.game} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/60">GAME</div>
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                <span>{t.game}</span>
                <span>-</span>
                <span>{t.mode.toUpperCase()}</span>
              </div>
              <h3 className="text-lg font-semibold text-white sm:text-xl">{t.title}</h3>
              <p className="text-sm text-white/70">{t.start}</p>
              <p className="text-base font-semibold text-cyan-300">
                {t.prize.toLocaleString(numberLocale)} {currencyLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${meta.badge}`}>
            {meta.label}
          </span>
          {startsInFiveMinutes && effectiveStatus === "upcoming" ? (
            <span className="text-xs font-medium text-amber-300">{locale === "en" ? "Starts in less than 5 min" : "До старта меньше 5 мин"}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/tournaments/${t.id}`} className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm">
          {registerLabel}
        </Link>
        <Link
          href={`/tournaments/${t.id}/room`}
          className="inline-flex items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-sm text-white/85 transition hover:border-cyan-300/40 hover:text-white"
        >
          {locale === "en" ? "Match room" : "Матч-рум"}
        </Link>
      </div>
    </article>
  );
}
