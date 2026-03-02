"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function AvatarMenu({
  username,
  avatarUrl,
  isAdmin,
}: {
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-1.5 hover:bg-white/10"
      >
        <div className="h-8 w-8 overflow-hidden rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-black">
              {initials(username)}
            </div>
          )}
        </div>
        <span className="hidden text-sm text-white/80 md:block">{username}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-[0_0_40px_rgba(0,255,255,0.08)] backdrop-blur">
          <Link className="block px-4 py-3 text-sm hover:bg-white/5" href="/profile" onClick={() => setOpen(false)}>
            Профиль
          </Link>
          <Link className="block px-4 py-3 text-sm hover:bg-white/5" href="/support" onClick={() => setOpen(false)}>
            Поддержка
          </Link>
          {isAdmin && (
            <Link className="block px-4 py-3 text-sm hover:bg-white/5" href="/admin" onClick={() => setOpen(false)}>
              Админка
            </Link>
          )}
          <form action="/logout" method="post">
            <button className="w-full px-4 py-3 text-left text-sm hover:bg-white/5">
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}