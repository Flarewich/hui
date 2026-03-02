"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TournamentsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const sp = useSearchParams();

  // Подсветка, если мы на /tournaments
  const isActive = pathname === "/tournaments";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  // чтобы закрывалось при смене query
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, sp?.toString()]);

  const linkCls =
    "block px-4 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
          isActive ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
        ].join(" ")}
      >
        Турниры
        <span className="text-xs opacity-80">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-[0_0_40px_rgba(0,255,255,0.08)] backdrop-blur">
          <Link className={linkCls} href="/tournaments?tab=schedule">
            Расписание
          </Link>
          <Link className={linkCls} href="/tournaments?tab=watch">
            Смотреть
          </Link>
          <Link className={linkCls} href="/tournaments?sort=top">
            Топ турниры
          </Link>
          <div className="h-px bg-white/10" />
          <Link className={linkCls} href="/tournaments?tab=rules">
            Правила
          </Link>
          <Link className={linkCls} href="/tournaments?tab=info">
            Описание
          </Link>
        </div>
      )}
    </div>
  );
}