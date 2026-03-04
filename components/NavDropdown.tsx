"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavDropdownProps = {
  isAdmin: boolean;
  labels: {
    menu: string;
    home: string;
    tournaments: string;
    sponsors: string;
    help: string;
    admin: string;
    schedule: string;
    watch: string;
  };
};

export default function NavDropdown({ isAdmin, labels }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const linkCls = "block rounded-xl px-4 py-2.5 text-sm text-cyan-50/90 transition hover:bg-white/8 hover:text-white";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-cyan-50/90 outline outline-1 outline-cyan-300/30 bg-white/6 transition hover:bg-white/10"
      >
        {labels.menu}
        <span className="text-xs opacity-80">v</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-56 overflow-hidden rounded-2xl bg-[#060d1f]/90 outline outline-1 outline-cyan-300/35 backdrop-blur-xl">
          <Link className={linkCls} href="/" onClick={() => setOpen(false)}>
            {labels.home}
          </Link>
          <Link className={linkCls} href="/tournaments" onClick={() => setOpen(false)}>
            {labels.tournaments}
          </Link>
          <Link className={linkCls} href="/schedule" onClick={() => setOpen(false)}>
            {labels.schedule}
          </Link>
          <Link className={linkCls} href="/watch" onClick={() => setOpen(false)}>
            {labels.watch}
          </Link>
          <Link className={linkCls} href="/sponsors" onClick={() => setOpen(false)}>
            {labels.sponsors}
          </Link>
          <Link className={linkCls} href="/help" onClick={() => setOpen(false)}>
            {labels.help}
          </Link>
          {isAdmin && (
            <>
              <div className="h-px bg-white/10" />
              <Link className={linkCls} href="/admin" onClick={() => setOpen(false)}>
                {labels.admin}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}


