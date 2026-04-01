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
  labels,
  unreadNotifications = 0,
  adminChatUnreadCount = 0,
}: {
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  unreadNotifications?: number;
  adminChatUnreadCount?: number;
  labels: {
    profile: string;
    notifications: string;
    support: string;
    adminMenu: string;
    dashboard: string;
    createTournament: string;
    editTournaments: string;
    rulesAndSchedule: string;
    supportChat: string;
    adminChat: string;
    activityLogs: string;
    usersAndRoles: string;
    sponsors: string;
    emails: string;
    logout: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdminOpen(false);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setAdminOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl px-2 py-1.5 text-cyan-50/90 outline outline-1 outline-cyan-300/30 bg-white/6 transition hover:bg-white/10"
        aria-label={username}
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
        {unreadNotifications > 0 && (
          <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-bold text-black">
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl bg-[#060d1f]/90 outline outline-1 outline-cyan-300/35 backdrop-blur-xl">
          <Link className="block px-4 py-3 text-sm hover:bg-white/5" href="/profile" onClick={closeAll}>
            {labels.profile}
          </Link>
          <Link className="flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5" href="/profile" onClick={closeAll}>
            <span>{labels.notifications}</span>
            {unreadNotifications > 0 && (
              <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-bold text-black">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            )}
          </Link>
          <Link className="block px-4 py-3 text-sm hover:bg-white/5" href="/support" onClick={closeAll}>
            {labels.support}
          </Link>

          {isAdmin && (
            <>
              <div className="h-px bg-white/10" />
              <button
                onClick={() => setAdminOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-white/5"
              >
                <span>{labels.adminMenu}</span>
                <span className="text-xs text-white/60">{adminOpen ? "▲" : "▼"}</span>
              </button>

              {adminOpen && (
                <div className="border-t border-white/10 bg-black/20 py-1">
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin" onClick={closeAll}>
                    {labels.dashboard}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/tournaments#create" onClick={closeAll}>
                    {labels.createTournament}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/tournaments#edit" onClick={closeAll}>
                    {labels.editTournaments}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/tournaments#content" onClick={closeAll}>
                    {labels.rulesAndSchedule}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/support" onClick={closeAll}>
                    {labels.supportChat}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/chat" onClick={closeAll}>
                    <span className="flex items-center justify-between">
                      <span>{labels.adminChat}</span>
                      {adminChatUnreadCount > 0 && (
                        <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[10px] font-bold text-black">
                          {adminChatUnreadCount > 99 ? "99+" : adminChatUnreadCount}
                        </span>
                      )}
                    </span>
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/logs" onClick={closeAll}>
                    {labels.activityLogs}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/users" onClick={closeAll}>
                    {labels.usersAndRoles}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/sponsors" onClick={closeAll}>
                    {labels.sponsors}
                  </Link>
                  <Link className="block px-5 py-2 text-xs text-white/80 hover:bg-white/5" href="/admin/emails" onClick={closeAll}>
                    {labels.emails}
                  </Link>
                </div>
              )}
            </>
          )}

          <div className="h-px bg-white/10" />
          <form action="/logout" method="post">
            <button className="w-full px-4 py-3 text-left text-sm hover:bg-white/5">{labels.logout}</button>
          </form>
        </div>
      )}
    </div>
  );
}


