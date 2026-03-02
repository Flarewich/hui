"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type Game = {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
};

export default function GameFilterRow({ games }: { games: Game[] }) {
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

  return (
    <div className="flex gap-4 overflow-auto pb-2">
      {/* ALL */}
      <button
        onClick={() => setGame("all")}
        className={[
          "min-w-[110px] rounded-2xl border p-4 text-left transition",
          current === "all"
            ? "border-cyan-400/35 bg-cyan-400/15 shadow-[0_0_40px_rgba(0,255,255,0.10)]"
            : "border-white/10 bg-white/5 hover:bg-white/10",
        ].join(" ")}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold">
          ALL
        </div>
        <div className="mt-2 text-xs font-semibold text-white/80">Все</div>
      </button>

      {games.map((g) => {
        const active = current === g.slug;
        return (
          <button
            key={g.id}
            onClick={() => setGame(g.slug)}
            className={[
              "min-w-[110px] rounded-2xl border p-4 text-left transition",
              active
                ? "border-cyan-400/35 bg-cyan-400/15 shadow-[0_0_40px_rgba(0,255,255,0.10)]"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            ].join(" ")}
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
              {g.icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.icon_url} alt={g.name} className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-[10px] font-bold text-white/60">
                  {g.name.slice(0, 6).toUpperCase()}
                </span>
              )}
            </div>
            <div className="mt-2 text-xs font-semibold text-white/80">{g.name}</div>
          </button>
        );
      })}
    </div>
  );
}