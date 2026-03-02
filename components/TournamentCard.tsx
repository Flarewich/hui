import Link from "next/link";

export default function TournamentCard({
  t,
}: {
  t: { id: string; game: string; title: string; start: string; prize: number; status: string; mode: string };
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="absolute inset-0 opacity-40 blur-2xl"
           style={{ background: "radial-gradient(600px circle at 10% 30%, rgba(0,255,255,0.12), transparent 40%), radial-gradient(600px circle at 90% 20%, rgba(255,0,255,0.10), transparent 40%)" }} />

      <div className="relative flex items-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-white/10" />

        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2">
            <span className="rounded-full bg-lime-400/20 px-3 py-1 text-xs font-semibold text-lime-200">
              {t.start}
            </span>
            <span className="text-xs text-white/40">{t.mode.toUpperCase()}</span>
          </div>

          <div className="mt-2 truncate text-lg font-extrabold">{t.title}</div>

          <div className="mt-3 flex items-center gap-3">
            <Link
              href={`/tournaments/${t.id}`}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Регистрация
            </Link>
            <span className="text-xs text-white/50">{t.game}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-extrabold text-cyan-300">
            {t.prize.toLocaleString("ru-RU")} ₽
          </div>
        </div>
      </div>
    </div>
  );
}