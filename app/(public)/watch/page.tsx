import PageShell from "@/components/PageShell";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function WatchPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  return (
    <PageShell
      title={isEn ? "Watch" : "Смотреть"}
      subtitle={isEn ? "This section is under development." : "Этот раздел пока в разработке."}
    >
      <div className="card p-4 sm:p-6 text-sm text-white/75">
        <p>{isEn ? "The broadcast page is currently in development. We are preparing live streams and match coverage." : "Страница трансляций сейчас в разработке. Мы готовим прямые эфиры и покрытие матчей."}</p>
      </div>
    </PageShell>
  );
}
