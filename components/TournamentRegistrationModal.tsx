"use client";

import Link from "next/link";
import { useState } from "react";

export default function TournamentRegistrationModal({
  tournamentId,
  isLoggedIn,
  needsTeam,
  modeLabel,
  blockedByTeamMembership,
  isClosed,
  isFull,
  isRegistered,
  loginHref,
  registrationDateText,
  myTeamName,
  errorMessage,
  okMessage,
  locale = "ru",
}: {
  tournamentId: string;
  isLoggedIn: boolean;
  needsTeam: boolean;
  modeLabel: string;
  blockedByTeamMembership: boolean;
  isClosed: boolean;
  isFull: boolean;
  isRegistered: boolean;
  loginHref: string;
  registrationDateText: string | null;
  myTeamName: string;
  errorMessage?: string;
  okMessage?: string;
  locale?: "ru" | "en";
}) {
  const [open, setOpen] = useState(false);
  const [teamAccess, setTeamAccess] = useState<"open" | "password">("open");
  const isEn = locale === "en";

  if (!loginHref) return null;

  return (
    <div className="space-y-2">
      {errorMessage && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{errorMessage}</div>}
      {okMessage && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{okMessage}</div>}

      {!isRegistered ? (
        !isLoggedIn ? (
          <Link href={loginHref} className="block rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-black hover:bg-white/90">
            {isEn ? "Sign in and register" : "Войти и зарегистрироваться"}
          </Link>
        ) : blockedByTeamMembership ? (
          <div className="rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-center text-sm text-white/70">
            {isEn
              ? `You are already in a ${modeLabel} team. Registration is hidden.`
              : `Вы уже состоите в команде режима ${modeLabel}. Регистрация скрыта.`}
          </div>
        ) : isClosed ? (
          <div className="rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-center text-sm text-white/70">
            {isEn ? "Registration is closed" : "Регистрация закрыта"}
          </div>
        ) : isFull ? (
          <div className="rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-center text-sm text-white/70">
            {isEn ? "All slots are taken. Registration is closed." : "Все слоты заняты. Регистрация закрыта."}
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold text-black hover:bg-white/90">
              {isEn ? "Register" : "Зарегистрироваться"}
            </button>

            {open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0b1020] p-5 shadow-[0_0_50px_rgba(34,211,238,0.14)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{isEn ? "Tournament registration" : "Регистрация на турнир"}</h3>
                      <p className="mt-1 text-xs text-white/60">
                        {needsTeam
                          ? isEn
                            ? `Mode ${modeLabel}: create your team now.`
                            : `Формат ${modeLabel}: создайте команду прямо сейчас.`
                          : isEn
                            ? "Confirm your participation in the tournament."
                            : "Подтвердите участие в турнире."}
                      </p>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/5">
                      {isEn ? "Close" : "Закрыть"}
                    </button>
                  </div>

                  <form action={`/tournaments/${tournamentId}/register`} method="post" className="mt-4 grid gap-3">
                    {needsTeam && (
                      <>
                        <input
                          name="team_name"
                          required
                          minLength={2}
                          maxLength={64}
                          placeholder={isEn ? `Team name (${modeLabel})` : `Название команды (${modeLabel})`}
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                        />
                        <select
                          name="team_access"
                          value={teamAccess}
                          onChange={(e) => setTeamAccess(e.target.value as "open" | "password")}
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                        >
                          <option value="open">{isEn ? "Open team (no password)" : "Открытая команда (без пароля)"}</option>
                          <option value="password">{isEn ? "Password protected team" : "Команда по паролю"}</option>
                        </select>
                        {teamAccess === "password" && (
                          <input
                            name="team_password"
                            required
                            minLength={4}
                            maxLength={32}
                            placeholder={isEn ? "Team password" : "Пароль команды"}
                            className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                          />
                        )}
                      </>
                    )}
                    <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                      {isEn ? "Confirm registration" : "Подтвердить регистрацию"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )
      ) : (
        <>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-center text-sm font-semibold text-emerald-100">
            {isEn ? "You are already registered" : "Вы уже зарегистрированы"}
            {registrationDateText ? <div className="mt-1 text-[11px] font-normal text-emerald-200/80">{isEn ? "since" : "с"} {registrationDateText}</div> : null}
            {myTeamName ? <div className="mt-1 text-[11px] font-normal text-emerald-200/80">{isEn ? "Team" : "Команда"}: {myTeamName}</div> : null}
          </div>
          <form action={`/tournaments/${tournamentId}/unregister`} method="post">
            <button type="submit" className="w-full rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2 text-center text-sm font-semibold text-red-100 hover:bg-red-500/20">
              {isEn ? "Cancel registration" : "Отменить регистрацию"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
