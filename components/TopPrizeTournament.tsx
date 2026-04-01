"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEuro } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";

type TopPrizeTournamentProps = {
  id: string;
  title: string;
  startAt: string;
  prizePool: number;
  mode: string;
  gameName: string;
  locale: string;
};

function getTier(prize: number) {
  if (prize >= 200000) return { label: "LEGEND", accent: "text-amber-200", ring: "border-amber-300/40" };
  if (prize >= 100000) return { label: "EPIC", accent: "text-cyan-200", ring: "border-cyan-300/40" };
  return { label: "TOP", accent: "text-fuchsia-200", ring: "border-fuchsia-300/40" };
}

function formatLeft(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TopPrizeTournament(props: TopPrizeTournamentProps) {
  const isEn = props.locale.startsWith("en");
  const tier = useMemo(() => getTier(props.prizePool), [props.prizePool]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startTs = new Date(props.startAt).getTime();
  const left = startTs - now;
  const hydrated = now > 0;
  const isStarted = hydrated && left <= 0;
  const currencyLocale: Locale = isEn ? "en" : "ru";
  const prizeText = formatEuro(props.prizePool, currencyLocale);
  const prizeLen = Math.max(prizeText.length - 1, 1);

  return (
    <section className="ws-top-wrap relative overflow-hidden p-4 sm:p-6">
      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${tier.ring} ${tier.accent}`}>
              {isEn ? "Top Tournament" : "Топ турнир"}
            </span>
            <span className="inline-flex rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
              {tier.label}
            </span>
          </div>

          <h2 className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">
            {isEn ? "Top Prize Tournament" : "Топ турнир по призовому"}
          </h2>

          <p className="mt-2 text-sm text-white/80 sm:text-base">
            {props.title}
          </p>

          <p className="mt-1 text-xs text-white/60 sm:text-sm">
            {props.gameName} • {props.mode.toUpperCase()} • {new Date(props.startAt).toLocaleString(props.locale)}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/75">{isEn ? "Start status:" : "Статус старта:"}</span>
            <span className="ws-timer font-mono">
              {hydrated ? (isStarted ? (isEn ? "LIVE" : "ЛАЙВ") : formatLeft(left)) : "--:--:--"}
            </span>
          </div>
        </div>

        <div className="order-3 mt-1 flex w-full justify-center lg:order-2 lg:mt-0 lg:justify-self-center">
          <div className="inline-flex flex-col items-center gap-2 rounded-2xl border border-cyan-300/35 px-4 py-3 sm:px-6 sm:py-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/90">
              {isEn ? "Prize Pool" : "Призовой фонд"}
            </span>
            <span className="text-2xl font-black sm:text-4xl md:text-5xl">
              {prizeText.split("").map((ch, idx) => {
                const isDigit = ch >= "0" && ch <= "9";
                const ratio = idx / prizeLen;
                const hue = 190 + ratio * 130;
                return (
                  <span
                    key={`${ch}-${idx}`}
                    className={isDigit ? "inline-block ws-digit-bounce" : ""}
                    style={{
                      color: `hsl(${hue}, 100%, 72%)`,
                      textShadow: "0 0 10px rgba(56,189,248,.26)",
                      ...(isDigit ? { animationDelay: `${idx * 0.06}s` } : {}),
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          </div>
        </div>

        <div className="order-2 flex flex-col items-stretch gap-2 sm:min-w-[240px] lg:order-3 lg:justify-self-end">
          <Link
            href={`/tournaments/${props.id}`}
            className="ws-open-link text-center text-sm"
          >
            {isEn ? "Open tournament" : "Открыть турнир"}
          </Link>

          <span className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-center text-xs text-white/75">
            {isStarted
              ? (isEn ? "Registration closed" : "Регистрация закрыта")
              : (isEn ? "Hurry up before start" : "Успейте до старта")}
          </span>
        </div>
      </div>
      
      <style jsx>{`
        section.ws-top-wrap {
          border-radius: 18px !important;
          border: 1px solid rgba(34, 211, 238, 0.6) !important;
          box-shadow:
            0 0 22px rgba(34, 211, 238, 0.2),
            0 0 38px rgba(59, 130, 246, 0.12),
            inset 0 0 14px rgba(34, 211, 238, 0.1) !important;
        }
        @keyframes wsDigitBounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        .ws-digit-bounce {
          animation: wsDigitBounce 1.3s ease-in-out infinite;
          will-change: transform;
        }
        .ws-timer {
          display: inline-block;
          padding: 10px 18px;
          border-radius: 8px !important;
          background: rgba(0, 120, 255, 0.08) !important;
          border: 1px solid rgba(0, 120, 255, 0.2) !important;
          font-weight: 600;
          color: #7fd3ff !important;
        }
        .ws-open-link {
          padding: 14px 28px !important;
          border-radius: 10px !important;
          background: linear-gradient(90deg, #3a7bfd, #00c6ff) !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border: none !important;
          cursor: pointer;
          transition: 0.3s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ws-open-link:hover {
          filter: brightness(1.06);
        }
      `}</style>
    </section>
  );
}
