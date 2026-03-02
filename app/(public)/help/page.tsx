import PageShell from "@/components/PageShell";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";

export default async function HelpPage() {
  const page = await getSitePage("help");
  return (
    <PageShell title={page.title} subtitle="FAQ и помощь пользователям.">
      <div className="card p-6">
        <Markdown content={page.content_md} />
      </div>
    </PageShell>
  );
}