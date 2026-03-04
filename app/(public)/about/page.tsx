import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function AboutPage() {
  const locale = await getRequestLocale();
  const page = await getSitePage("about", locale);

  return (
    <PageShell title={page.title} subtitle={locale === "en" ? "Project information." : "Информация о проекте."}>
      <div className="card p-6">
        <Markdown content={page.content_md} />
      </div>
    </PageShell>
  );
}
