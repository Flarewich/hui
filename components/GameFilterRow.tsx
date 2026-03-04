"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { getLocalGameIcon } from "@/lib/gameIcons";
import type { Locale } from "@/lib/i18n";

export type Game = {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
};

export default function GameFilterRow({ games, locale = "ru" }: { games: Game[]; locale?: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const current = sp.get("game") ?? "all";

  function setGame(slug: string) {
    const next = new URLSearchParams(sp.toString());
    if (!slug || slug === "all") next.delete("game");
    else next.set("game", slug);
    next.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  const allLabel = locale === "en" ? "All games" : "Все игры";
  const visibleGames = games.filter((g) => g.slug !== "all" && g.name.trim().toLowerCase() !== "все");

  return (
    <div className="flex gap-4 overflow-auto pb-2">
      <button
        onClick={() => setGame("all")}
        className={[
          "min-w-[96px] rounded-2xl border p-3 text-left transition sm:min-w-[110px] sm:p-4",
          current === "all"
            ? "border-cyan-400/35 bg-cyan-400/15 shadow-[0_0_40px_rgba(0,255,255,0.10)]"
            : "border-white/10 bg-white/5 hover:bg-white/10",
        ].join(" ")}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold">*</div>
        <div className="mt-2 text-xs font-semibold text-white/80">{allLabel}</div>
      </button>

      {visibleGames.map((g) => {
        const active = current === g.slug;
        const iconSrc = g.icon_url || getLocalGameIcon(g.slug) || getLocalGameIcon(g.name);
        return (
          <button
            key={g.id}
            onClick={() => setGame(g.slug)}
            className={[
              "min-w-[96px] rounded-2xl border p-3 text-left transition sm:min-w-[110px] sm:p-4",
              active
                ? "border-cyan-400/35 bg-cyan-400/15 shadow-[0_0_40px_rgba(0,255,255,0.10)]"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            ].join(" ")}
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              {iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconSrc} alt={g.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-white/60">{g.name.slice(0, 6).toUpperCase()}</span>
              )}
            </div>
            <div className="mt-2 text-xs font-semibold text-white/80">{g.name}</div>
          </button>
        );
      })}
    </div>
  );
}
