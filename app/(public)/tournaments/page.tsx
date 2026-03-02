import GameFilterRow from "@/components/GameFilterRow";
import FiltersBar from "@/components/FiltersBar";
import TournamentCard from "@/components/TournamentCard";
import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
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

type Tab = "schedule" | "watch" | "rules" | "info";
type Status = "upcoming" | "live" | "finished";
type Mode = "all" | "solo" | "duo" | "squad";
type Sort = "time" | "prize" | "popular" | "top"; // поддерживаем оба варианта (prize/top)

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    game?: string;
    status?: string;
    mode?: string;
    q?: string;
    tab?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;

  const tab: Tab = (sp.tab ?? "schedule") as Tab;

  const game = sp.game ?? "all";
  const status: Status = (sp.status ?? "upcoming") as Status;
  const mode: Mode = (sp.mode ?? "all") as Mode;
  const q = (sp.q ?? "").trim();
  const sort: Sort = (sp.sort ?? "time") as Sort;

  const supabase = await createSupabaseServerClient();

  // Контент страниц (site_pages)
  // Важно: грузим только когда реально нужен таб rules/info (чтобы не делать лишних запросов).
  if (tab === "rules") {
    const rulesPage = await getSitePage("rules");
    return (
      <PageShell title="Правила турниров" subtitle="Общие правила и требования.">
        <div className="card p-6">
          <Markdown content={rulesPage.content_md} />
        </div>
      </PageShell>
    );
  }

  if (tab === "info") {
    const infoPage = await getSitePage("tournaments-info");
    return (
      <PageShell
        title="Описание турниров"
        subtitle="Как работают турниры на платформе."
      >
        <div className="card p-6">
          <Markdown content={infoPage.content_md} />
        </div>
      </PageShell>
    );
  }

  // games для иконок
  const { data: games } = await supabase
    .from("games")
    .select("id, name, slug, icon_url")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // tournaments query (schedule/watch)
  let query = supabase
    .from("tournaments")
    .select("id, title, status, mode, start_at, prize_pool, games(name, slug)")
    .eq("status", status);

  if (mode !== "all") query = query.eq("mode", mode);
  if (q) query = query.ilike("title", `%${q}%`);
  if (game !== "all") query = query.eq("games.slug", game);

  // сортировка: prize/top => по призовым, иначе по времени
  if (sort === "prize" || sort === "top") {
    query = query.order("prize_pool", { ascending: false });
  } else {
    query = query.order("start_at", { ascending: true });
  }

  const { data: tournaments, error } = await query.limit(60);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h1 className="title">
          {tab === "watch" ? "Турниры (просмотр)" : "Турниры"}
        </h1>
        <p className="mt-2 muted text-sm">
          {tab === "watch"
            ? "Список турниров (режим просмотра)"
            : "Расписание и регистрация"}
        </p>

        <div className="mt-5">
          <h2 className="title">ФИЛЬТР ПО ИГРАМ</h2>
          <div className="mt-5">
            <GameFilterRow games={games ?? []} />
          </div>
        </div>

        <div className="mt-6">
          <FiltersBar />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Ошибка загрузки турниров: {error.message}
        </div>
      )}

      <div className="space-y-4">
        {(tournaments ?? []).map((t: any) => (
          <TournamentCard
            key={t.id}
            t={{
              id: t.id,
              game: t.games?.name ?? "—",
              title: t.title,
              start: toRuDate(t.start_at),
              prize: t.prize_pool ?? 0,
              status: t.status,
              mode: t.mode,
            }}
          />
        ))}

        {!error && (tournaments?.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
            Ничего не найдено по текущим фильтрам.
          </div>
        )}
      </div>
    </div>
  );
}