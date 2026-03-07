import Link from "next/link";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function NotFound() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12">
      <section className="rounded-3xl border border-cyan-400/25 p-5 sm:p-8">
        <div className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
          404
        </div>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {isEn ? "Page not found" : "Страница не найдена"}
        </h1>

        <p className="mt-3 text-sm text-white/75 sm:text-base">
          {isEn
            ? "The page you requested does not exist or was moved."
            : "Запрошенная страница не существует или была перемещена."}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90">
            {isEn ? "Go home" : "На главную"}
          </Link>
          <Link href="/tournaments" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5">
            {isEn ? "Open tournaments" : "Открыть турниры"}
          </Link>
          <Link href="/support" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5">
            {isEn ? "Contact support" : "Поддержка"}
          </Link>
        </div>
      </section>
    </div>
  );
}
