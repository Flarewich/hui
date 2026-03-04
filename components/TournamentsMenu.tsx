"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type TournamentsMenuLabels = {
  schedule: string;
  watch: string;
  top: string;
  rules: string;
  info: string;
};

export default function TournamentsMenu({
  labels,
  buttonLabel,
}: {
  labels: TournamentsMenuLabels;
  buttonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = pathname === "/tournaments";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const linkCls = "block rounded-xl px-4 py-3 text-sm text-cyan-50/90 transition hover:bg-white/8 hover:text-white";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        onDoubleClick={() => router.push("/tournaments")}
        className={[
          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
          isActive ? "outline outline-1 outline-cyan-300/55 bg-cyan-400/12 text-cyan-100" : "outline outline-1 outline-cyan-300/25 bg-white/5 text-cyan-50/85 hover:bg-white/10",
        ].join(" ")}
      >
        {buttonLabel}
        <span className="text-xs opacity-80">v</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 overflow-hidden rounded-2xl bg-[#060d1f]/90 outline outline-1 outline-cyan-300/35 backdrop-blur-xl">
          <Link className={linkCls} href="/schedule">
            {labels.schedule}
          </Link>
          <Link className={linkCls} href="/watch">
            {labels.watch}
          </Link>
          <Link className={linkCls} href="/tournaments?sort=top">
            {labels.top}
          </Link>
          <div className="h-px bg-white/10" />
          <Link className={linkCls} href="/tournaments?tab=rules">
            {labels.rules}
          </Link>
          <Link className={linkCls} href="/tournaments?tab=info">
            {labels.info}
          </Link>
        </div>
      )}
    </div>
  );
}


