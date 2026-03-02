import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";

export default async function AboutPage() {
  const page = await getSitePage("about");
  return (
    <PageShell title={page.title} subtitle="Информация о проекте.">
      <div className="card p-6">
        <Markdown content={page.content_md} />
      </div>
    </PageShell>
  );
}