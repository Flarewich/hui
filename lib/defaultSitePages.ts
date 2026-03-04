import type { Locale } from "@/lib/i18n";

type DefaultPage = {
  title: string;
  content_md: string;
};

type DefaultPagesByLocale = Record<Locale, Record<string, DefaultPage>>;

export const defaultSitePagesByLocale: DefaultPagesByLocale = {
  ru: {
    help: {
      title: "Общие правила сайта",
      content_md: `
## 1. Базовые условия
- Используя платформу, вы соглашаетесь с правилами сайта и турниров.
- Один пользователь - один аккаунт. Мультиаккаунт для обхода ограничений запрещен.
- Пользователь отвечает за сохранность данных входа.

## 2. Коммуникация и поведение
- Уважайте других участников и команду проекта.
- Запрещены оскорбления, дискриминация, угрозы, спам и навязчивая реклама.
- Любые попытки нарушить работу платформы (флуд, взлом, злоупотребление уязвимостями) запрещены.

## 3. Профиль и контент
- Ник и аватар должны соответствовать нормам общения и законам.
- Администрация может потребовать изменить неподходящий контент профиля.
- Запрещено выдавать себя за другого пользователя, администратора или бренд.

## 4. Поддержка и споры
- Все обращения принимаются через внутренний чат поддержки.
- Время ответа зависит от нагрузки и сложности вопроса.
- При спорных кейсах итоговое решение остается за администрацией платформы.

## 5. Меры воздействия
- За нарушения применяются: предупреждение, ограничение функций, временная блокировка, перманентный бан.
- Повторные и тяжелые нарушения наказываются строже.
- Попытка обхода санкций считается отдельным нарушением.
`,
    },
    rules: {
      title: "Правила турниров",
      content_md: `
## 1. Допуск к участию
- К турниру допускаются только зарегистрированные аккаунты.
- Участник обязан играть с теми данными, которые указаны при регистрации.
- Перед стартом проверьте корректность состава и готовность команды.

## 2. Fair Play
- Читы, макросы, скрипты и любые сторонние преимущества запрещены.
- Передача аккаунта, подмена игрока и участие за другого пользователя запрещены.
- Договорные матчи и намеренный слив результатов запрещены.

## 3. Тайминг и расписание
- Матчи проходят по времени, указанному в карточке турнира.
- Опоздание сверх лимита может привести к техническому поражению.
- Если соперник не выходит на связь, фиксируйте это и пишите в поддержку.

## 4. Фиксация результатов
- Результаты подтверждаются по регламенту турнира (скриншот, запись, отчет).
- При конфликте администрация вправе запросить дополнительные доказательства.
- При отсутствии подтверждения в срок решение принимается администрацией.

## 5. Команды и составы
- Капитан команды отвечает за связь с администрацией.
- Изменения состава разрешены только в рамках регламента конкретного турнира.
- Систематические неявки могут привести к исключению из текущих и следующих турниров.

## 6. Административные решения
- Администрация может оперативно обновлять регламент при необходимости.
- Участие в турнире означает согласие с актуальной версией правил.
- В спорных ситуациях решение администрации является окончательным.
`,
    },
  },
  en: {
    help: {
      title: "General platform rules",
      content_md: `
## 1. Basic terms
- By using the platform, you agree to platform and tournament rules.
- One user - one account. Multi-accounting to bypass restrictions is prohibited.
- You are responsible for keeping your login credentials secure.

## 2. Communication and behavior
- Respect other participants and the project team.
- Insults, discrimination, threats, spam, and aggressive advertising are prohibited.
- Any attempts to disrupt the platform (flooding, hacking, exploit abuse) are prohibited.

## 3. Profile and content
- Username and avatar must comply with communication standards and laws.
- Administration may require you to change inappropriate profile content.
- Impersonating another user, administrator, or brand is prohibited.

## 4. Support and disputes
- All requests are handled through the internal support chat.
- Response time depends on queue load and issue complexity.
- In disputed cases, the final decision remains with platform administration.

## 5. Enforcement
- Violations may lead to warning, feature restrictions, temporary suspension, or permanent ban.
- Repeated and severe violations are penalized more strictly.
- Attempting to bypass sanctions is considered a separate violation.
`,
    },
    rules: {
      title: "Tournament rules",
      content_md: `
## 1. Participation eligibility
- Only registered accounts can participate.
- Participants must play with the account data provided during registration.
- Before start, verify roster correctness and team readiness.

## 2. Fair Play
- Cheats, macros, scripts, and any third-party competitive advantage are prohibited.
- Account sharing, player substitution, and playing on behalf of others are prohibited.
- Match-fixing and intentional throwing are prohibited.

## 3. Timing and schedule
- Matches are played according to tournament card time.
- Being late beyond the allowed limit may result in a technical loss.
- If the opponent is unavailable, document it and contact support.

## 4. Result confirmation
- Results are confirmed according to tournament regulation (screenshot, recording, report).
- In conflicts, administration may request additional evidence.
- If proof is not provided in time, administration makes the final decision.

## 5. Teams and rosters
- Team captain is responsible for communication with administration.
- Roster changes are allowed only within the specific tournament regulation.
- Repeated no-shows may lead to exclusion from current and upcoming tournaments.

## 6. Administrative decisions
- Administration may update regulations when necessary.
- Participation in a tournament means acceptance of the current rules version.
- In disputed situations, administration decision is final.
`,
    },
  },
};

export const defaultSitePages: Record<string, DefaultPage> = defaultSitePagesByLocale.ru;

export function getDefaultSitePage(slug: string, locale: Locale): DefaultPage | undefined {
  return defaultSitePagesByLocale[locale][slug] ?? defaultSitePagesByLocale.ru[slug];
}
