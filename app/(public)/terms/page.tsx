import PageShell from "@/components/PageShell";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  return (
    <PageShell
      title={isEn ? "Terms of Service" : "Пользовательское соглашение"}
      subtitle={isEn ? "Rules for using WinStrike platform." : "Правила использования платформы WinStrike."}
    >
      <section className="card p-4 sm:p-6 space-y-4 text-sm text-white/80">
        <p>
          {isEn
            ? "By creating an account or using WinStrike services, you accept these Terms of Service."
            : "Создавая аккаунт или используя сервисы WinStrike, вы принимаете это Пользовательское соглашение."}
        </p>
        <p>
          {isEn
            ? "Users must provide accurate data, follow tournament rules, and avoid cheating, abuse, or unauthorized access."
            : "Пользователь обязан предоставлять корректные данные, соблюдать правила турниров и не допускать читов, злоупотреблений или несанкционированного доступа."}
        </p>
        <p>
          {isEn
            ? "Administration may limit, suspend, or terminate access for violations, fraud, or platform security risks."
            : "Администрация может ограничить, приостановить или прекратить доступ при нарушениях, мошенничестве или угрозе безопасности платформы."}
        </p>
        <p>
          {isEn
            ? "Tournament settings, prizes, schedules, and participant limits may change according to operational needs."
            : "Настройки турниров, призы, расписание и лимиты участников могут изменяться по операционным причинам."}
        </p>
        <p>
          {isEn
            ? "Continued use of the platform means acceptance of updated terms."
            : "Продолжение использования платформы означает согласие с актуальной версией условий."}
        </p>
      </section>
    </PageShell>
  );
}
