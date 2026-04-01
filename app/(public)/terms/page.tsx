import PageShell from "@/components/PageShell";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  const sections = isEn
    ? [
        {
          title: "1. Acceptance of terms",
          text: "By creating an account or using WinStrike services, you accept these Terms of Service, platform rules, tournament rules, and administration decisions made within the scope of platform operation.",
        },
        {
          title: "2. Account usage",
          text: "Users must keep account data accurate, protect login credentials, and avoid account sharing, impersonation, or attempts to bypass bans, limits, or platform restrictions.",
        },
        {
          title: "3. Allowed and prohibited actions",
          text: "Users may use the platform only for legitimate participation, support communication, and related site features. Cheating, abuse, fraud, hacking attempts, automation misuse, and interference with platform operation are prohibited.",
        },
        {
          title: "4. Tournament participation",
          text: "Tournament participation requires compliance with active tournament regulations, schedule, roster requirements, and result confirmation procedures. Administration may revise brackets, timings, or operational settings when necessary.",
        },
        {
          title: "5. Content and communication",
          text: "Profile content, chat messages, support requests, and uploaded materials must remain lawful and respectful. Offensive, illegal, deceptive, or harmful content may be removed without prior notice.",
        },
        {
          title: "6. Sanctions and enforcement",
          text: "Administration may issue warnings, limit features, remove users from tournaments, cancel results, deny payouts, suspend accounts, or permanently ban users for rule violations, fraud, or platform security risks.",
        },
        {
          title: "7. Payouts and operational changes",
          text: "Prize payouts require valid payment details and successful compliance checks. Prize structure, schedules, limits, rules, or service functionality may change for operational, technical, or security reasons.",
        },
        {
          title: "8. Final provisions",
          text: "Continued use of the platform means acceptance of the current terms version. In disputes related to platform usage, moderation, tournaments, or service integrity, the final decision remains with platform administration.",
        },
      ]
    : [
        {
          title: "1. Принятие условий",
          text: "Создавая аккаунт или используя сервисы WinStrike, пользователь принимает настоящее пользовательское соглашение, правила платформы, правила турниров и решения администрации в рамках работы сервиса.",
        },
        {
          title: "2. Использование аккаунта",
          text: "Пользователь обязан указывать корректные данные, защищать доступ к аккаунту и не передавать его третьим лицам. Запрещены мультиаккаунт, выдача себя за другого пользователя и попытки обхода ограничений.",
        },
        {
          title: "3. Разрешённые и запрещённые действия",
          text: "Сайт можно использовать только для участия в турнирах, общения с поддержкой и работы с доступными функциями платформы. Запрещены мошенничество, читы, злоупотребления, взлом, вредоносная автоматизация и вмешательство в работу сервиса.",
        },
        {
          title: "4. Участие в турнирах",
          text: "Участник обязан соблюдать регламент турнира, расписание, требования к составу и порядок подтверждения результатов. Администрация вправе корректировать сетку, время матчей и иные организационные параметры при необходимости.",
        },
        {
          title: "5. Контент и коммуникация",
          text: "Никнейм, аватар, сообщения, обращения в поддержку и другие материалы должны быть законными и уважительными. Оскорбительный, вредоносный, незаконный или вводящий в заблуждение контент может быть удалён без предварительного уведомления.",
        },
        {
          title: "6. Санкции и меры воздействия",
          text: "За нарушения администрация может выносить предупреждения, ограничивать функции, снимать пользователя с турниров, аннулировать результаты, отклонять выплаты, временно блокировать или навсегда закрывать доступ к платформе.",
        },
        {
          title: "7. Выплаты и изменения сервиса",
          text: "Получение призовых возможно только при корректных реквизитах и успешной проверке. Призовые условия, расписание, лимиты, правила и функциональность сайта могут изменяться по техническим, организационным и безопасностным причинам.",
        },
        {
          title: "8. Заключительные положения",
          text: "Продолжение использования платформы означает согласие с актуальной версией условий. Во всех спорах, связанных с использованием сервиса, модерацией, турнирами и защитой платформы, окончательное решение остаётся за администрацией.",
        },
      ];

  return (
    <PageShell
      title={isEn ? "Terms of Service" : "Пользовательское соглашение"}
      subtitle={isEn ? "Rules for using WinStrike platform." : "Правила использования платформы WinStrike."}
    >
      <section className="card space-y-4 p-4 text-sm text-white/80 sm:p-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h2 className="text-base font-semibold text-white">{section.title}</h2>
            <p>{section.text}</p>
          </div>
        ))}
      </section>
    </PageShell>
  );
}
