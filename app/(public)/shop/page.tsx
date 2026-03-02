import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";

export default async function ShopPage() {
  const page = await getSitePage("shop");
  return (
    <PageShell title={page.title} subtitle="Магазин (расширим позже).">
      <div className="card p-6">
        <Markdown content={page.content_md} />
      </div>
    </PageShell>
  );
}