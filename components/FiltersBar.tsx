"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type Status = "all" | "live" | "upcoming" | "finished";
type Mode = "all" | "solo" | "duo" | "squad";
type Sort = "time" | "prize" | "popular";

function pill(active: boolean) {
  return active
    ? "bg-cyan-400/20 text-cyan-100 border-cyan-400/30 shadow-[0_0_25px_rgba(0,255,255,0.08)]"
    : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10";
}

const labelsByLocale: Record<Locale, Record<string, string>> = {
  ru: {
    all: "Все статусы",
    live: "Текущие",
    upcoming: "Предстоящие",
    finished: "Прошедшие",
    searchPlaceholder: "Найти турнир...",
    search: "Найти",
    sortTime: "По времени",
    sortPrize: "По призу",
    sortPopular: "По популярности",
    modeSquad: "Команды",
  },
  en: {
    all: "All statuses",
    live: "Live",
    upcoming: "Upcoming",
    finished: "Finished",
    searchPlaceholder: "Search tournament...",
    search: "Search",
    sortTime: "By time",
    sortPrize: "By prize",
    sortPopular: "By popularity",
    modeSquad: "Squad",
  },
};

export default function FiltersBar({ locale = "ru" }: { locale?: Locale }) {
  const labels = labelsByLocale[locale];

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const current = useMemo(() => {
    const status = (sp.get("status") as Status) ?? "all";
    const mode = (sp.get("mode") as Mode) ?? "all";
    const q = sp.get("q") ?? "";
    const sort = (sp.get("sort") as Sort) ?? "time";
    return { status, mode, q, sort };
  }, [sp]);

  const [qLocal, setQLocal] = useState(current.q);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());

    if (!value || value === "all" || (key === "sort" && value === "time")) next.delete(key);
    else next.set(key, value);

    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function applySearch() {
    setParam("q", qLocal.trim());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={`rounded-xl border px-4 py-2 text-sm ${pill(current.status === "all")}`} onClick={() => setParam("status", "all")}>
          {labels.all}
        </button>
        <button className={`rounded-xl border px-4 py-2 text-sm ${pill(current.status === "live")}`} onClick={() => setParam("status", "live")}>
          {labels.live}
        </button>
        <button className={`rounded-xl border px-4 py-2 text-sm ${pill(current.status === "upcoming")}`} onClick={() => setParam("status", "upcoming")}>
          {labels.upcoming}
        </button>
        <button className={`rounded-xl border px-4 py-2 text-sm ${pill(current.status === "finished")}`} onClick={() => setParam("status", "finished")}>
          {labels.finished}
        </button>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <input
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder={labels.searchPlaceholder}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none focus:border-cyan-400/40 sm:w-[220px]"
          />
          <button onClick={applySearch} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
            {labels.search}
          </button>

          <select
            value={current.sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/80 outline-none"
          >
            <option value="time">{labels.sortTime}</option>
            <option value="prize">{labels.sortPrize}</option>
            <option value="popular">{labels.sortPopular}</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={`rounded-xl border px-4 py-2 text-sm ${pill(current.mode === "solo")}`} onClick={() => setParam("mode", "solo")}>
          Solo
        </button>
        <button className={`rounded-xl border px-4 py-2 text-sm ${pill(current.mode === "duo")}`} onClick={() => setParam("mode", "duo")}>
          Duo
        </button>
        <button className={`rounded-xl border px-4 py-2 text-sm ${pill(current.mode === "squad")}`} onClick={() => setParam("mode", "squad")}>
          {labels.modeSquad}
        </button>
      </div>
    </div>
  );
}
