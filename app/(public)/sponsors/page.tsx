import PageShell from "@/components/PageShell";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function SponsorsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sponsors")
    .select("id, name, href, tier, logo_url")
    .eq("is_active", true)
    .order("tier", { ascending: true });

  return (
    <PageShell title="Спонсоры" subtitle="Партнёры, которые поддерживают турниры и призовые фонды.">
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Ошибка: {error.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((s: any) => (
          <a
            key={s.id}
            href={s.href ?? "#"}
            target="_blank"
            className="card-soft p-6 hover:bg-white/10"
          >
            <div className="text-xs text-white/50">{String(s.tier).toUpperCase()}</div>
            <div className="mt-2 text-lg font-bold">{s.name}</div>
            <div className="mt-3 text-sm text-cyan-300">Перейти →</div>
          </a>
        ))}

        {(data?.length ?? 0) === 0 && !error && (
          <div className="card p-6 text-sm text-white/60">
            Пока нет активных спонсоров.
          </div>
        )}
      </div>
    </PageShell>
  );
}