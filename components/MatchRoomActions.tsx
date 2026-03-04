"use client";

import { useMemo, useState } from "react";

function detectMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function gameDeepLink(gameSlug?: string | null) {
  const slug = (gameSlug ?? "").toLowerCase();
  if (slug === "pubg-mobile" || slug === "pubgm") return "pubgmobile://";
  if (slug === "mobile-legends" || slug === "mlbb") return "mobilelegends://";
  if (slug === "standoff-2" || slug === "standoff2") return "standoff2://";
  return null;
}

export default function MatchRoomActions({
  tournamentId,
  gameSlug,
  roomCode,
  roomPassword,
  locale = "ru",
}: {
  tournamentId: string;
  gameSlug?: string | null;
  roomCode: string | null;
  roomPassword: string | null;
  locale?: "ru" | "en";
}) {
  const [ready, setReady] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`ready_${tournamentId}`) === "1";
  });
  const [copyState, setCopyState] = useState<"" | "code" | "password">("");
  const isMobile = useMemo(() => detectMobile(), []);
  const deeplink = useMemo(() => gameDeepLink(gameSlug), [gameSlug]);
  const isEn = locale === "en";

  async function copy(text: string, kind: "code" | "password") {
    await navigator.clipboard.writeText(text);
    setCopyState(kind);
    window.setTimeout(() => setCopyState(""), 1200);
  }

  function toggleReady() {
    const next = !ready;
    setReady(next);
    localStorage.setItem(`ready_${tournamentId}`, next ? "1" : "0");
  }

  function openGame() {
    if (isMobile && deeplink) {
      window.location.href = deeplink;
      return;
    }
    window.alert(
      isEn
        ? "Open Steam/launcher, start the game, then join the lobby with the code."
        : "Откройте Steam/лаунчер и запустите игру, затем зайдите в лобби по коду."
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggleReady}
        className={`w-full rounded-xl border px-4 py-2 text-sm font-semibold ${
          ready ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-100" : "border-white/15 bg-black/20 text-white hover:bg-white/5"
        }`}
      >
        {ready ? (isEn ? "I'm ready (confirmed)" : "Я готов (подтверждено)") : isEn ? "I'm ready" : "Я готов"}
      </button>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => roomCode && copy(roomCode, "code")}
          disabled={!roomCode}
          className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copyState === "code" ? (isEn ? "Code copied" : "Код скопирован") : isEn ? "Copy code" : "Скопировать код"}
        </button>
        <button
          type="button"
          onClick={() => roomPassword && copy(roomPassword, "password")}
          disabled={!roomPassword}
          className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-sm hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copyState === "password" ? (isEn ? "Password copied" : "Пароль скопирован") : isEn ? "Copy password" : "Скопировать пароль"}
        </button>
      </div>

      <button type="button" onClick={openGame} className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
        {isEn ? "Open game" : "Открыть игру"}
      </button>
      <p className="text-xs text-white/60">
        {isMobile
          ? deeplink
            ? isEn
              ? "On mobile, the app will try to open the game via deeplink."
              : "На мобильном будет попытка открыть игру через deeplink."
            : isEn
              ? "No deeplink configured for this game. Open the game manually."
              : "Для этой игры deeplink не настроен. Откройте игру вручную."
          : isEn
            ? "On desktop, open Steam/launcher and run the game manually."
            : "На ПК откройте Steam/лаунчер и запустите игру вручную."}
      </p>
    </div>
  );
}
