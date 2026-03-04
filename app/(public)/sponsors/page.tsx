import Link from "next/link";
import PageShell from "@/components/PageShell";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getRequestLocale } from "@/lib/i18nServer";

type Sponsor = {
  id: string;
  name: string;
  href: string | null;
  tier: string | null;
  logo_url: string | null;
};

function tierMeta(rawTier: string | null) {
  const tier = (rawTier ?? "partner").toLowerCase();
  if (tier === "title" || tier === "platinum") return { key: "title", label: "Title Partner", chip: "s-chip-title", card: "s-tier-title" };
  if (tier === "gold") return { key: "gold", label: "Gold", chip: "s-chip-gold", card: "s-tier-gold" };
  if (tier === "silver") return { key: "silver", label: "Silver", chip: "s-chip-silver", card: "s-tier-silver" };
  return { key: "partner", label: "Partner", chip: "s-chip-partner", card: "s-tier-partner" };
}

function countByTier(items: Sponsor[]) {
  const stats = { title: 0, gold: 0, silver: 0, partner: 0 };
  for (const item of items) {
    const tier = (item.tier ?? "partner").toLowerCase();
    if (tier === "title" || tier === "platinum") stats.title += 1;
    else if (tier === "gold") stats.gold += 1;
    else if (tier === "silver") stats.silver += 1;
    else stats.partner += 1;
  }
  return stats;
}

export default async function SponsorsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("sponsors")
    .select("id, name, href, tier, logo_url")
    .eq("is_active", true)
    .order("tier", { ascending: true })
    .order("name", { ascending: true })
    .returns<Sponsor[]>();

  const sponsors = data ?? [];
  const stats = countByTier(sponsors);

  return (
    <PageShell
      title={isEn ? "Sponsors" : "Спонсоры"}
      subtitle={
        isEn
          ? "Partners who help grow WinStrike tournaments and prize pools."
          : "Партнёры, которые помогают развивать турниры WinStrike и усиливают призовые фонды."
      }
    >
      <div className="sponsors-restore space-y-6">
        <section className="s-card s-hero relative overflow-hidden p-4 sm:p-6">
          <div className="s-glow-cyan pointer-events-none absolute -left-14 -top-14 h-44 w-44" />
          <div className="s-glow-pink pointer-events-none absolute -bottom-16 right-0 h-52 w-52" />

          <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="s-pill inline-flex px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">Sponsor Network</div>
              <h2 className="mt-3 text-xl font-extrabold sm:text-2xl md:text-3xl">
                {isEn ? "WinStrike Partner Ecosystem" : "Экосистема партнёров WinStrike"}
              </h2>
              <p className="mt-2 text-sm text-white/75">
                {isEn
                  ? "Brands, streaming platforms, and gaming services that support tournaments and community."
                  : "Бренды, стрим-платформы и игровые сервисы, которые поддерживают киберспортивные турниры и комьюнити."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="s-card s-stat px-3 py-2">
                <div className="text-[11px] text-white/60">{isEn ? "Total" : "Всего"}</div>
                <div className="mt-0.5 text-lg font-bold">{sponsors.length}</div>
              </div>
              <div className="s-card s-stat-title px-3 py-2">
                <div className="text-[11px] text-amber-100/80">Title</div>
                <div className="mt-0.5 text-lg font-bold text-amber-100">{stats.title}</div>
              </div>
              <div className="s-card s-stat-gold px-3 py-2">
                <div className="text-[11px] text-cyan-100/80">Gold</div>
                <div className="mt-0.5 text-lg font-bold text-cyan-100">{stats.gold}</div>
              </div>
              <div className="s-card s-stat-silver px-3 py-2">
                <div className="text-[11px] text-slate-100/80">Silver</div>
                <div className="mt-0.5 text-lg font-bold text-slate-100">{stats.silver}</div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="s-card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {isEn ? "Failed to load sponsors" : "Ошибка загрузки спонсоров"}: {error.message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor) => {
            const tier = tierMeta(sponsor.tier);
            const isLink = Boolean(sponsor.href);
            const CardTag = isLink ? "a" : "div";
            const cardProps = isLink ? { href: sponsor.href ?? "#", target: "_blank", rel: "noreferrer" as const } : {};

            return (
              <CardTag key={sponsor.id} {...cardProps} className={`s-card s-tier-card ${tier.card} group relative overflow-hidden p-5 transition hover:-translate-y-0.5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`s-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tier.chip}`}>
                    {isEn ? tier.label : tier.key === "partner" ? "Партнер" : tier.label}
                  </div>
                  {isLink && <span className="text-xs text-white/45 transition group-hover:text-cyan-200">visit</span>}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="s-logo-wrap flex h-14 w-14 items-center justify-center overflow-hidden">
                    {sponsor.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sponsor.logo_url} alt={sponsor.name} className="h-full w-full object-contain p-1.5" />
                    ) : (
                      <span className="text-xs font-bold text-white/50">{sponsor.name.slice(0, 3).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold">{sponsor.name}</div>
                    <div className="mt-1 text-xs text-white/55">
                      {isEn ? (isLink ? "Official tournament partner" : "Partner profile without external link") : isLink ? "Официальный партнёр турниров" : "Профиль партнёра без внешней ссылки"}
                    </div>
                  </div>
                </div>
              </CardTag>
            );
          })}

          {sponsors.length === 0 && !error && (
            <div className="s-card p-6 text-sm text-white/60">{isEn ? "No active sponsors yet." : "Пока нет активных спонсоров."}</div>
          )}
        </section>

        <section className="s-card s-hero p-4 sm:p-6">
          <h3 className="text-xl font-bold">{isEn ? "How to become our sponsor" : "Как стать нашим спонсором"}</h3>
          <p className="mt-2 max-w-3xl text-sm text-white/75">
            {isEn
              ? "Tell us about your brand and collaboration format. We support prize, media and seasonal partnerships."
              : "Расскажите о вашем бренде и формате сотрудничества. Мы открыты к партнёрствам по призовым фондам, медийным интеграциям, спонсорству турнирных сезонов и совместным активностям."}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="s-card p-4">
              <div className="text-xs text-white/60">{isEn ? "Step 1" : "Шаг 1"}</div>
              <div className="mt-1 text-sm font-semibold">{isEn ? "Send request" : "Отправьте запрос"}</div>
              <div className="mt-1 text-xs text-white/60">
                {isEn ? "Describe your brand, goals and expected format." : "Кратко опишите бренд, цели и формат присутствия на турнирах."}
              </div>
            </div>
            <div className="s-card p-4">
              <div className="text-xs text-white/60">{isEn ? "Step 2" : "Шаг 2"}</div>
              <div className="mt-1 text-sm font-semibold">{isEn ? "Align package" : "Согласуем пакет"}</div>
              <div className="mt-1 text-xs text-white/60">
                {isEn ? "Define partnership tier, audience and integrations." : "Подберём уровень партнёрства, охват и ключевые точки интеграции."}
              </div>
            </div>
            <div className="s-card p-4">
              <div className="text-xs text-white/60">{isEn ? "Step 3" : "Шаг 3"}</div>
              <div className="mt-1 text-sm font-semibold">{isEn ? "Launch campaign" : "Запуск кампании"}</div>
              <div className="mt-1 text-xs text-white/60">
                {isEn ? "Fix KPI, timeline and launch together." : "Фиксируем KPI, сроки и запускаем совместные активности."}
              </div>
            </div>
          </div>

          <div className="mt-5 s-card p-4">
            <h4 className="text-sm font-semibold">{isEn ? "Sponsor benefits" : "Преимущества для спонсора"}</h4>
            <div className="mt-3 grid gap-2 text-sm text-white/80 md:grid-cols-2">
              <div className="s-card px-3 py-2">{isEn ? "Access to active gaming audience." : "Доступ к активной игровой аудитории и комьюнити."}</div>
              <div className="s-card px-3 py-2">{isEn ? "Tournament and page branding." : "Брендирование турниров, страниц и промо-материалов."}</div>
              <div className="s-card px-3 py-2">{isEn ? "Stream and content integrations." : "Интеграции в трансляции, посты и специальные активности."}</div>
              <div className="s-card px-3 py-2">{isEn ? "Flexible formats for your KPI." : "Гибкие форматы сотрудничества под ваш бюджет и KPI."}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`mailto:support@tournaments?subject=${encodeURIComponent(isEn ? "Partnership with WinStrike" : "Партнерство с WinStrike")}`} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90">
              {isEn ? "Become sponsor" : "Стать спонсором"}
            </a>
            <Link href="/support" className="rounded-xl border border-white/15 bg-black/25 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/5">
              {isEn ? "Contact support" : "Написать в поддержку"}
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
