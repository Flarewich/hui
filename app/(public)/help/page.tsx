import Link from "next/link";
import Markdown from "@/components/Markdown";
import { getSitePage } from "@/lib/pages";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function HelpPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const page = await getSitePage("help", locale);

  const faqItems = isEn
    ? [
        {
          q: "How do I start participating in tournaments?",
          a: "Open tournaments, choose a suitable format, and open a tournament card. Then follow the schedule and rules.",
        },
        {
          q: "Where can I find rules and dispute guidance?",
          a: "General rules are in Help, and tournament-specific rules are on tournament pages. Contact support for disputes.",
        },
        {
          q: "How can I contact administration?",
          a: "Use the built-in support chat. For authenticated users, route /support is available.",
        },
        {
          q: "Why can't I access admin panel?",
          a: "Access to /admin is only for accounts with role admin in profiles table.",
        },
      ]
    : [
        {
          q: "Как начать участвовать в турнирах?",
          a: "Зайдите в раздел турниров, выберите подходящий формат и откройте карточку турнира. Далее следуйте расписанию и правилам.",
        },
        {
          q: "Где смотреть правила и спорные ситуации?",
          a: "Общие правила доступны в разделе помощи, а турнирные правила на странице турниров. При споре пишите в поддержку.",
        },
        {
          q: "Как связаться с администрацией?",
          a: "Используйте встроенный чат поддержки. Для авторизованных пользователей доступен маршрут /support.",
        },
        {
          q: "Почему меня не пускает в админку?",
          a: "Доступ в /admin только для аккаунтов с ролью admin в таблице profiles.",
        },
      ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 p-4 sm:p-6 md:p-8">
        <div className="relative max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{page.title}</h1>
          <p className="mt-3 text-sm text-white/75 md:text-base">
            {isEn
              ? "Help center: quick answers, platform rules, and support access."
              : "Центр помощи: базовые ответы, правила платформы и быстрый доступ к поддержке."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/support" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
              {isEn ? "Contact support" : "Написать в поддержку"}
            </Link>
            <Link href="/tournaments" className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
              {isEn ? "Open tournaments" : "Открыть турниры"}
            </Link>
            <Link href="/profile" className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
              {isEn ? "Profile" : "Личный кабинет"}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {faqItems.map((item) => (
          <article key={item.q} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">{item.q}</h2>
            <p className="mt-2 text-sm text-white/70">{item.a}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-xl font-bold">{isEn ? "Platform rules" : "Правила платформы"}</h2>
        <div className="mt-4 text-sm text-white/85">
          <Markdown content={page.content_md} />
        </div>
      </section>
    </div>
  );
}
