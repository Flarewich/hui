export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";
export const localeCookieName = "lang";

type Messages = {
  header: {
    home: string;
    tournaments: string;
    sponsors: string;
    help: string;
    login: string;
    admin: string;
  };
  footer: {
    brand: string;
  };
  tournamentsMenu: {
    schedule: string;
    watch: string;
    top: string;
    rules: string;
    info: string;
  };
  avatarMenu: {
    profile: string;
    notifications: string;
    support: string;
    adminMenu: string;
    dashboard: string;
    createTournament: string;
    editTournaments: string;
    rulesAndSchedule: string;
    supportChat: string;
    usersAndRoles: string;
    sponsors: string;
    emails: string;
    logout: string;
  };
  home: {
    title1: string;
    title2: string;
    subtitle: string;
    allTournaments: string;
    rules: string;
    upcoming: string;
    showAll: string;
    noUpcoming: string;
  };
  tournamentsPage: {
    title: string;
    titleWatch: string;
    subtitle: string;
    subtitleWatch: string;
    gameFilter: string;
    register: string;
    loadError: string;
    empty: string;
    rulesTitle: string;
    rulesSubtitle: string;
    infoTitle: string;
    infoSubtitle: string;
    scheduleTableTitle: string;
    scheduleTableHint: string;
    scheduleColStart: string;
    scheduleColTournament: string;
    scheduleColStage: string;
    scheduleColMatch: string;
    scheduleColMode: string;
    scheduleColStream: string;
    scheduleNoRows: string;
    scheduleNoTable: string;
  };
};

const ru: Messages = {
  header: {
    home: "Главная",
    tournaments: "Турниры",
    sponsors: "Спонсоры",
    help: "Помощь",
    login: "Войти",
    admin: "Админка",
  },
  footer: { brand: "WinStrike" },
  tournamentsMenu: {
    schedule: "Расписание",
    watch: "Смотреть",
    top: "Топ турниры",
    rules: "Правила",
    info: "Описание",
  },
  avatarMenu: {
    profile: "Профиль",
    notifications: "Уведомления",
    support: "Поддержка",
    adminMenu: "Админ-меню",
    dashboard: "Дашборд",
    createTournament: "Создать турнир",
    editTournaments: "Редактировать турниры",
    rulesAndSchedule: "Правила и расписание",
    supportChat: "Чат поддержки",
    usersAndRoles: "Пользователи и роли",
    sponsors: "Спонсоры",
    emails: "Письма",
    logout: "Выйти",
  },
  home: {
    title1: "Турнирная платформа",
    title2: "без лишнего",
    subtitle: "Выбирайте турнир, следите за расписанием и играйте за призовой фонд.",
    allTournaments: "Все турниры",
    rules: "Правила",
    upcoming: "Ближайшие турниры",
    showAll: "Смотреть все",
    noUpcoming: "Сейчас нет запланированных турниров.",
  },
  tournamentsPage: {
    title: "Турниры",
    titleWatch: "Турниры (просмотр)",
    subtitle: "Расписание и регистрация",
    subtitleWatch: "Список турниров в режиме просмотра",
    gameFilter: "Фильтр по играм",
    register: "Регистрация",
    loadError: "Ошибка загрузки турниров",
    empty: "Ничего не найдено по текущим фильтрам.",
    rulesTitle: "Правила турниров",
    rulesSubtitle: "Общие правила и требования.",
    infoTitle: "Описание турниров",
    infoSubtitle: "Как работают турниры на платформе.",
    scheduleTableTitle: "Таблица расписания",
    scheduleTableHint: "Матчи и время начала из базы данных.",
    scheduleColStart: "Старт",
    scheduleColTournament: "Турнир",
    scheduleColStage: "Стадия",
    scheduleColMatch: "Матч",
    scheduleColMode: "Режим",
    scheduleColStream: "Трансляция",
    scheduleNoRows: "В расписании пока нет матчей.",
    scheduleNoTable: "Таблица расписания не найдена. Примените SQL-миграцию tournament_schedule.",
  },
};

const en: Messages = {
  header: {
    home: "Home",
    tournaments: "Tournaments",
    sponsors: "Sponsors",
    help: "Help",
    login: "Sign in",
    admin: "Admin",
  },
  footer: { brand: "WinStrike" },
  tournamentsMenu: {
    schedule: "Schedule",
    watch: "Watch",
    top: "Top tournaments",
    rules: "Rules",
    info: "Overview",
  },
  avatarMenu: {
    profile: "Profile",
    notifications: "Notifications",
    support: "Support",
    adminMenu: "Admin menu",
    dashboard: "Dashboard",
    createTournament: "Create tournament",
    editTournaments: "Edit tournaments",
    rulesAndSchedule: "Rules and schedule",
    supportChat: "Support chat",
    usersAndRoles: "Users and roles",
    sponsors: "Sponsors",
    emails: "Emails",
    logout: "Log out",
  },
  home: {
    title1: "Tournament platform",
    title2: "without clutter",
    subtitle: "Pick a tournament, follow the schedule, and play for the prize pool.",
    allTournaments: "All tournaments",
    rules: "Rules",
    upcoming: "Upcoming tournaments",
    showAll: "See all",
    noUpcoming: "There are no upcoming tournaments right now.",
  },
  tournamentsPage: {
    title: "Tournaments",
    titleWatch: "Tournaments (watch)",
    subtitle: "Schedule and registration",
    subtitleWatch: "Tournament list in watch mode",
    gameFilter: "Filter by game",
    register: "Register",
    loadError: "Failed to load tournaments",
    empty: "No tournaments match the current filters.",
    rulesTitle: "Tournament rules",
    rulesSubtitle: "General rules and requirements.",
    infoTitle: "Tournament overview",
    infoSubtitle: "How tournaments work on the platform.",
    scheduleTableTitle: "Schedule table",
    scheduleTableHint: "Match rows and start times from the database.",
    scheduleColStart: "Start",
    scheduleColTournament: "Tournament",
    scheduleColStage: "Stage",
    scheduleColMatch: "Match",
    scheduleColMode: "Mode",
    scheduleColStream: "Stream",
    scheduleNoRows: "No matches are scheduled yet.",
    scheduleNoTable: "Schedule table was not found. Apply tournament_schedule SQL migration.",
  },
};

export function resolveLocale(raw: string | null | undefined): Locale {
  if (raw === "ru" || raw === "en") return raw;
  return defaultLocale;
}

export function getMessages(locale: Locale): Messages {
  return locale === "en" ? en : ru;
}

export function getDateLocale(locale: Locale) {
  return locale === "en" ? "en-US" : "ru-RU";
}
