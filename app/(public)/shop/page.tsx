import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function ShopPage() {
  const locale = await getRequestLocale();
  const page = await getSitePage("shop", locale);
  return (
    <PageShell title={page.title} subtitle={locale === "en" ? "Store (will be expanded later)." : "Магазин (расширим позже)."}>
      <div className="card p-4 sm:p-6">
        <Markdown content={page.content_md} />
      </div>
    </PageShell>
  );
}
