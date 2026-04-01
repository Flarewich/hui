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
## 1. Общие положения
- Используя платформу, пользователь подтверждает согласие с правилами сайта, турниров и решениями администрации.
- Платформа предназначена для честного участия в турнирах, общения в рамках сервиса и использования встроенных функций по назначению.
- Администрация вправе обновлять правила, интерфейс, структуру разделов и функциональность сайта без отдельного персонального уведомления.

## 2. Аккаунт и доступ
- Один пользователь должен использовать один основной аккаунт.
- Запрещено создавать дополнительные аккаунты для обхода блокировок, ограничений, лимитов или наказаний.
- Пользователь обязан указывать достоверные данные, если они требуются для участия, связи с поддержкой или получения выплат.
- Передача аккаунта третьим лицам, совместное использование аккаунта и вход от имени другого пользователя запрещены.
- Пользователь отвечает за безопасность пароля, почты и доступа к своему аккаунту.

## 3. Профиль, никнейм и контент
- Никнейм, аватар, описание и любые загружаемые материалы не должны содержать оскорбления, угрозы, дискриминацию, порнографию, экстремистские материалы, незаконную рекламу или чужие товарные знаки без оснований.
- Запрещено выдавать себя за администратора, модератора, спонсора, бренд, команду или другого пользователя.
- Администрация может скрыть, изменить или потребовать заменить контент профиля, если он нарушает правила, законодательство или деловую репутацию платформы.
- Пользователь не должен публиковать в сервисе вредоносные ссылки, вредоносные файлы, фишинговые материалы или инструкции по обходу защиты платформы.

## 4. Общение и поведение
- Внутренние чаты, поддержка, комментарии и обращения должны вестись уважительно и по существу.
- Запрещены спам, флуд, травля, провокации, токсичное поведение, дискриминационные высказывания, навязчивая реклама и угрозы.
- Запрещено намеренно мешать работе администрации, поддержки или другим пользователям через поток бессмысленных обращений.
- При споре пользователь обязан вести коммуникацию спокойно и предоставлять информацию без подделки и давления на администрацию.

## 5. Техническая безопасность
- Запрещены попытки взлома, перебора паролей, поиска и эксплуатации уязвимостей без согласования с администрацией.
- Запрещено вмешиваться в работу сайта, API, матч-румов, уведомлений, платёжных и служебных процессов.
- Нельзя использовать ботов, автоматические скрипты, макросы, парсинг или иные средства, создающие чрезмерную нагрузку или дающие нечестное преимущество.
- Обнаруженные ошибки и уязвимости нужно сообщать администрации, а не использовать в своих интересах.

## 6. Поддержка и обращения
- Все вопросы по аккаунту, турнирам, матчам, техническим ошибкам и санкциям подаются через встроенную поддержку.
- Для рассмотрения спорных ситуаций пользователь должен предоставить доказательства: скриншоты, видео, таймкоды, переписку или иные материалы по запросу администрации.
- Отсутствие ответа пользователя, отказ предоставить материалы или подача заведомо ложной информации могут привести к отказу в рассмотрении обращения.
- Оскорбительное поведение в адрес поддержки рассматривается как отдельное нарушение правил.

## 7. Финансовые и призовые вопросы
- Для получения выплат пользователь обязан предоставить корректные и актуальные реквизиты.
- Платформа вправе отклонить или приостановить выплату до уточнения личности, данных или обстоятельств победы.
- Попытка получить выплату обманным способом, за чужой результат или по поддельным данным ведёт к отмене выплаты и санкциям.
- Сроки обработки выплат зависят от внутренних проверок, нагрузки и технической готовности.

## 8. Ограничения и санкции
- За нарушение правил могут применяться предупреждение, скрытие контента, ограничение функций, временная блокировка, снятие с турнира, аннулирование результата, отказ в выплате или постоянная блокировка.
- Повторные, умышленные или тяжёлые нарушения наказываются строже.
- Попытка обхода ограничений считается отдельным нарушением.
- Администрация вправе принимать меры без предварительного предупреждения, если нарушение связано с безопасностью, мошенничеством или риском для пользователей и платформы.

## 9. Итоговые положения
- Не все спорные ситуации могут быть описаны в правилах заранее, поэтому администрация вправе принимать решения исходя из принципов честной игры, безопасности и интересов платформы.
- Использование сайта после обновления правил означает согласие с их актуальной редакцией.
- Во всех спорных случаях окончательное решение по платформенным вопросам остаётся за администрацией.
`,
    },
    rules: {
      title: "Правила турниров",
      content_md: `
## 1. Допуск к участию
- К турниру допускаются только зарегистрированные и не ограниченные аккаунты.
- Пользователь должен участвовать под тем аккаунтом и с теми данными, которые указаны при регистрации.
- Перед началом турнира игрок обязан проверить корректность заявки, состава, режима и данных команды.
- Участие в турнире означает полное согласие с текущими правилами платформы и регламентом турнира.

## 2. Состав и команды
- Капитан отвечает за регистрацию команды, корректность состава и коммуникацию с администрацией.
- Замены, дозаявки и изменения состава допускаются только если это прямо разрешено текущим регламентом.
- Участие незаявленных игроков, подмена участников, игра за другую команду или передача слота запрещены.
- Если формат турнира предполагает фиксированный состав, команда обязана сыграть в утверждённой конфигурации.

## 3. Fair Play
- Читы, скрипты, макросы, сторонний софт для преимущества, договорные матчи и умышленный слив результатов строго запрещены.
- Запрещены любые действия, искажающие честный результат матча, включая подставные аккаунты и передачу управления.
- Любые подозрения в нечестной игре могут стать основанием для проверки, временного ограничения или дисквалификации до выяснения обстоятельств.

## 4. Расписание и явка
- Матчи проводятся по времени, указанному в карточке турнира, расписании или дополнительном объявлении администрации.
- Команда или игрок должны быть готовы к старту заранее, а не в момент истечения лимита ожидания.
- Опоздание, отсутствие связи или неявка могут привести к техническому поражению.
- Если соперник не выходит на матч, это необходимо зафиксировать и сразу обратиться в поддержку.

## 5. Матч-рум и проведение игры
- Код комнаты, пароль, сервер, карта, режим и иные параметры матча используются только для конкретной игры и не должны распространяться вне команды без необходимости.
- Участники обязаны соблюдать инструкции по входу в матч-рум и требования конкретной игры.
- Самовольное изменение договорённого формата, карты, правил лобби или количества раундов без согласования запрещено.
- Технические проблемы должны фиксироваться сразу, до продолжения матча или сразу после инцидента.

## 6. Подтверждение результатов
- Результат матча должен быть подтверждён по установленному порядку: скриншотами, записью, официальным отчётом или иными доказательствами.
- Администрация вправе запросить дополнительные материалы, если результат вызывает сомнения.
- Подделка доказательств, монтаж, обрезка важных фрагментов или сокрытие информации рассматриваются как тяжёлое нарушение.
- Если доказательства не представлены вовремя, решение принимается администрацией на основании имеющихся данных.

## 7. Споры и протесты
- Все спорные ситуации подаются через поддержку без затягивания.
- Протест должен содержать конкретное описание проблемы, время инцидента и подтверждающие материалы.
- Эмоциональные заявления без доказательств не являются основанием для пересмотра результата.
- До решения администрации участники обязаны не публиковать ложные обвинения от имени платформы.

## 8. Технические поражения и дисквалификация
- Техническое поражение может быть назначено за неявку, опоздание, неверный состав, нарушение регламента, отказ продолжать матч или отсутствие подтверждения результата.
- Дисквалификация возможна за читы, подмену игроков, грубые нарушения поведения, мошенничество и повторные нарушения регламента.
- При тяжёлом нарушении администрация вправе удалить участника или команду из текущего и будущих турниров.

## 9. Призы и итоговые решения
- Призовые начисляются только при подтверждённом результате и соблюдении правил турнира.
- Администрация вправе задержать или отменить выплату, если есть основания считать результат спорным, недобросовестным или полученным с нарушением правил.
- Регламент турнира, структура сетки, лимиты и условия участия могут корректироваться по организационной необходимости.
- Во всех спорных ситуациях окончательное решение по турниру принимает администрация платформы.
`,
    },
  },
  en: {
    help: {
      title: "General platform rules",
      content_md: `
## 1. General provisions
- By using the platform, you confirm acceptance of platform rules, tournament rules, and administration decisions.
- The platform is intended for fair tournament participation, in-service communication, and proper use of built-in features.
- Administration may update rules, interface structure, and functionality without separate personal notice.

## 2. Account and access
- One user should use one primary account.
- Creating extra accounts to bypass bans, restrictions, limits, or penalties is prohibited.
- Users must provide accurate data when required for participation, support, or payouts.
- Account sharing, access transfer, or logging in on behalf of another person is prohibited.
- Each user is responsible for the security of password, email, and access to their account.

## 3. Profile, username, and content
- Username, avatar, description, and uploaded materials must not contain abuse, threats, discrimination, pornography, extremist content, illegal advertising, or unauthorized use of third-party brands.
- Impersonating an administrator, moderator, sponsor, brand, team, or another user is prohibited.
- Administration may hide, edit, or require changes to profile content that violates rules, law, or platform reputation.
- Users must not publish malicious links, harmful files, phishing materials, or platform abuse instructions.

## 4. Communication and behavior
- Internal chats, support messages, and user communication must remain respectful and relevant.
- Spam, flooding, harassment, provocation, toxic behavior, discriminatory language, aggressive advertising, and threats are prohibited.
- Users must not intentionally overload support or administration with meaningless or abusive requests.
- In disputes, users must communicate calmly and provide information without falsification or pressure.

## 5. Technical security
- Hacking attempts, password brute force, vulnerability exploitation, or unauthorized security testing are prohibited.
- Users must not interfere with the website, API, match rooms, notifications, payment flows, or internal service processes.
- Bots, automation scripts, macros, scraping, or tools that create excessive load or unfair advantage are prohibited.
- Discovered bugs or vulnerabilities must be reported to administration rather than exploited.

## 6. Support and disputes
- All issues related to accounts, tournaments, matches, technical errors, or sanctions must be submitted through the built-in support channel.
- To review disputes, users may be required to provide screenshots, videos, timestamps, chat logs, or other evidence.
- Refusal to provide materials, failure to reply, or knowingly false information may result in rejection of the request.
- Abusive behavior toward support is treated as a separate violation.

## 7. Financial and payout matters
- To receive payouts, users must provide valid and current payment details.
- The platform may reject or delay payouts until identity, payment data, or winning circumstances are clarified.
- Attempts to obtain payouts fraudulently, for another person, or with false data may lead to payout cancellation and sanctions.
- Payout timing depends on internal checks, workload, and technical readiness.

## 8. Restrictions and enforcement
- Violations may lead to warning, content removal, feature restrictions, temporary suspension, tournament removal, result cancellation, payout denial, or permanent ban.
- Repeated, intentional, or severe violations are penalized more strictly.
- Attempts to bypass sanctions are treated as separate violations.
- Administration may act without prior warning in cases involving security, fraud, or risk to users and the platform.

## 9. Final provisions
- Not every dispute can be described in advance, so administration may make decisions based on fair play, safety, and platform integrity principles.
- Continued use of the site after rule updates means acceptance of the current version.
- In all platform-related disputes, the final decision remains with platform administration.
`,
    },
    rules: {
      title: "Tournament rules",
      content_md: `
## 1. Eligibility
- Only registered and unrestricted accounts may participate in tournaments.
- Users must compete with the account and data used during registration.
- Before tournament start, participants must verify roster, mode, and team details.
- Participation means full acceptance of current platform rules and the active tournament regulation.

## 2. Teams and rosters
- The captain is responsible for registration, roster accuracy, and communication with administration.
- Replacements, roster edits, and late additions are allowed only when explicitly permitted by the current regulation.
- Unregistered players, player substitution, slot transfer, or playing for another team are prohibited.
- If a tournament requires a locked roster, the approved lineup must be used.

## 3. Fair Play
- Cheats, scripts, macros, third-party competitive advantages, match-fixing, and intentional throwing are strictly prohibited.
- Any action that distorts the fair competitive outcome, including account lending or control transfer, is prohibited.
- Suspicion of unfair play may result in review, temporary restriction, or disqualification while the case is investigated.

## 4. Schedule and attendance
- Matches are played according to the time listed in the tournament card, schedule, or official administration announcement.
- Teams and players must be ready in advance, not only at the end of the waiting limit.
- Late arrival, lack of communication, or no-show may result in a technical loss.
- If the opponent fails to appear, participants should document it and contact support immediately.

## 5. Match room and gameplay
- Room code, password, server, map, mode, and other match parameters are intended only for the relevant match and should not be shared outside the team without necessity.
- Participants must follow the game-specific match room instructions and technical requirements.
- Changing agreed match settings, map, format, lobby rules, or round count without approval is prohibited.
- Technical problems must be documented immediately before continuing the match whenever possible.

## 6. Result confirmation
- Match results must be confirmed according to the required process: screenshots, recordings, official reports, or other approved evidence.
- Administration may request additional material when the result is unclear or disputed.
- Edited, incomplete, or falsified evidence is treated as a serious violation.
- If proof is not provided in time, administration will decide based on available information.

## 7. Disputes and protests
- All disputed situations must be submitted through support without unnecessary delay.
- A protest must include a clear description of the issue, incident timing, and supporting evidence.
- Emotional claims without evidence are not sufficient grounds to overturn a result.
- Until a decision is made, participants must not publicly present false accusations as official platform conclusions.

## 8. Technical losses and disqualification
- A technical loss may be assigned for no-show, late arrival, invalid roster, regulation breach, refusal to continue, or missing result confirmation.
- Disqualification may be applied for cheating, player substitution, serious misconduct, fraud, or repeated regulation breaches.
- In severe cases, administration may remove a player or team from the current and future tournaments.

## 9. Prizes and final decisions
- Prize eligibility exists only for properly confirmed results achieved in compliance with rules.
- Administration may delay or cancel a payout if the result appears disputed, dishonest, or obtained through rule violations.
- Tournament regulation, bracket structure, participation limits, and conditions may be adjusted for operational reasons.
- In all tournament disputes, the final decision belongs to platform administration.
`,
    },
  },
};

export const defaultSitePages: Record<string, DefaultPage> = defaultSitePagesByLocale.ru;

export function getDefaultSitePage(slug: string, locale: Locale): DefaultPage | undefined {
  return defaultSitePagesByLocale[locale][slug] ?? defaultSitePagesByLocale.ru[slug];
}
