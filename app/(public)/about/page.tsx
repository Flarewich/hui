import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function AboutPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const page = await getSitePage("about", locale);

  return (
    <PageShell title={page.title} subtitle={isEn ? "Project information." : "Информация о проекте."}>
      <section className="rounded-3xl border border-cyan-400/20 p-4 sm:p-6">
        <div className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
          {isEn ? "About WinStrike" : "О проекте WinStrike"}
        </div>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl">
          {isEn ? "Tournament platform for players, teams and partners" : "Турнирная платформа для игроков, команд и партнёров"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-white/75 sm:text-base">
          {isEn
            ? "We combine clear tournament flow, convenient match rooms and transparent participation rules in one ecosystem."
            : "Мы объединяем понятную турнирную логику, удобные матч-румы и прозрачные правила участия в одной экосистеме."}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="card p-4">
          <div className="text-sm font-semibold">{isEn ? "Structured tournaments" : "Структурированные турниры"}</div>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">
            {isEn ? "Clear formats, statuses, schedule and participant table." : "Понятные форматы, статусы, расписание и таблица участников."}
          </p>
        </article>
        <article className="card p-4">
          <div className="text-sm font-semibold">{isEn ? "Quick team flow" : "Быстрый командный флоу"}</div>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">
            {isEn ? "Create and join teams directly in tournament registration." : "Создание и вступление в команды прямо во время регистрации на турнир."}
          </p>
        </article>
        <article className="card p-4 sm:col-span-2 lg:col-span-1">
          <div className="text-sm font-semibold">{isEn ? "Support and trust" : "Поддержка и доверие"}</div>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">
            {isEn ? "In-platform support, sponsor ecosystem and role-based moderation." : "Поддержка в платформе, экосистема спонсоров и ролевая модерация."}
          </p>
        </article>
      </section>

      <section className="card p-4 sm:p-6">
        <h3 className="text-lg font-semibold">{isEn ? "Detailed description" : "Подробное описание"}</h3>
        <div className="mt-3 text-sm">
          <Markdown content={page.content_md} />
        </div>
      </section>
    </PageShell>
  );
}
