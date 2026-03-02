import Link from "next/link";
import PageShell from "@/components/PageShell";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";

function toRuDate(ts: string) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HomePage() {
  const page = await getSitePage("home");
  const supabase = await createSupabaseServerClient();

  const { data: upcoming } = await supabase
    .from("tournaments")
    .select("id, title, start_at, prize_pool, mode, games(name)")
    .eq("status", "upcoming")
    .order("start_at", { ascending: true })
    .limit(6);

  return (
    <PageShell
      title="CYBERHUB"
      subtitle="Турниры. Рейтинги. Поддержка. Всё в одном месте."
      right={
        <div className="flex gap-2">
          <Link href="/tournaments" className="btn-primary">Перейти к турнирам</Link>
          <Link href="/help" className="btn-ghost">Как это работает</Link>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            ⚡ Кибер-режим включён
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-wide">
            Играй. Побеждай. Забирай призы.
          </h2>
          <p className="mt-3 text-sm text-white/60">
            Регистрация за секунды, прозрачные правила, честная поддержка.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Турниры</div>
              <div className="mt-1 text-lg font-bold text-cyan-200">Ежедневно</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Поддержка</div>
              <div className="mt-1 text-lg font-bold text-fuchsia-200">24/7</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Игры</div>
              <div className="mt-1 text-lg font-bold text-sky-200">Мобайл + PC</div>
            </div>
          </div>

          <div className="mt-6">
            <Markdown content={page.content_md} />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Ближайшие</h3>
            <Link href="/tournaments" className="text-sm text-cyan-300 hover:text-cyan-200">
              Все →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {(upcoming ?? []).map((t: any) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
              >
                <div className="text-xs text-white/50">
                  {t.games?.name ?? "—"} • {t.mode.toUpperCase()} • {toRuDate(t.start_at)}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold">{t.title}</div>
                <div className="mt-2 text-sm font-bold text-cyan-200">
                  {Number(t.prize_pool ?? 0).toLocaleString("ru-RU")} ₽
                </div>
              </Link>
            ))}

            {(upcoming?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                Пока нет ближайших турниров.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}