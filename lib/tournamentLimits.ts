type GameKey =
  | "brawl_stars"
  | "cs2"
  | "dota2"
  | "freefire"
  | "mobile_legends"
  | "pubg"
  | "pubg_mobile"
  | "standoff2"
  | "other";

export type GameTournamentSettings = {
  team_size: number;
  max_teams?: number;
  teams_per_match?: number;
  match_format?: string;
  semifinal_format?: string;
  final_format?: string;
  rounds?: number;
  map_veto?: boolean;
  maps?: string[];
  scoring?: string;
};

export const UNIVERSAL_TOURNAMENT_SETTINGS = {
  min_teams: 4,
  max_teams: 128,
  formats: ["Single Elimination", "Double Elimination", "Round Robin", "Swiss"] as const,
  match_formats: ["BO1", "BO3", "BO5", "BO7"] as const,
};

const SETTINGS_BY_GAME: Record<GameKey, GameTournamentSettings> = {
  brawl_stars: {
    team_size: 3,
    max_teams: 64,
    match_format: "BO3",
    final_format: "BO5",
  },
  cs2: {
    team_size: 5,
    max_teams: 128,
    match_format: "BO3",
    final_format: "BO5",
    rounds: 24,
    map_veto: true,
  },
  dota2: {
    team_size: 5,
    max_teams: 32,
    match_format: "BO3",
    final_format: "BO5",
  },
  freefire: {
    team_size: 4,
    teams_per_match: 12,
    rounds: 6,
    scoring: "placement + kills",
  },
  mobile_legends: {
    team_size: 5,
    max_teams: 64,
    match_format: "BO3",
    semifinal_format: "BO5",
    final_format: "BO7",
  },
  pubg: {
    team_size: 4,
    teams_per_match: 16,
    rounds: 6,
    scoring: "placement + kills",
  },
  pubg_mobile: {
    team_size: 4,
    teams_per_match: 16,
    rounds: 6,
    maps: ["Erangel", "Miramar", "Sanhok"],
  },
  standoff2: {
    team_size: 5,
    max_teams: 64,
    match_format: "BO3",
    final_format: "BO5",
    rounds: 24,
  },
  other: {
    team_size: 5,
    max_teams: 24,
  },
};

function normalize(v: string | null | undefined) {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .trim();
}

function resolveGameKey(gameSlug?: string | null, gameName?: string | null): GameKey {
  const slug = normalize(gameSlug);
  const name = normalize(gameName);
  const text = `${slug} ${name}`;

  if (text.includes("standoff-2") || text.includes("standoff2")) return "standoff2";
  if (text.includes("mobile-legends") || text.includes("mobile legends")) return "mobile_legends";
  if (text.includes("pubg-mobile") || text.includes("pubgm") || text.includes("pubg mobile")) return "pubg_mobile";
  if (text.includes("pubg")) return "pubg";
  if (text.includes("freefire") || text.includes("free-fire") || text.includes("free fire")) return "freefire";
  if (text.includes("dota-2") || text.includes("dota2") || text.includes("dota 2")) return "dota2";
  if (text.includes("brawl-stars") || text.includes("brawlstars") || text.includes("brawl stars")) return "brawl_stars";
  if (text.includes("cs2") || text.includes("counter-strike-2") || text.includes("counter strike 2")) return "cs2";
  return "other";
}

export function getGameTournamentSettings(gameSlug?: string | null, gameName?: string | null): GameTournamentSettings {
  const game = resolveGameKey(gameSlug, gameName);
  return SETTINGS_BY_GAME[game] ?? SETTINGS_BY_GAME.other;
}

export function getTeamSizeLimit(mode: string, gameSlug?: string | null, gameName?: string | null) {
  if (mode === "solo") return 1;
  if (mode === "duo") return 2;
  if (mode !== "squad") return SETTINGS_BY_GAME.other.team_size;
  return getGameTournamentSettings(gameSlug, gameName).team_size;
}

export function getTournamentCapacity(mode: string, gameSlug?: string | null, gameName?: string | null) {
  if (mode === "solo") return 100;
  const settings = getGameTournamentSettings(gameSlug, gameName);
  const raw =
    typeof settings.max_teams === "number"
      ? settings.max_teams
      : typeof settings.teams_per_match === "number"
        ? settings.teams_per_match
        : mode === "duo"
          ? 50
          : mode === "squad"
            ? 24
            : 100;
  return Math.min(raw, UNIVERSAL_TOURNAMENT_SETTINGS.max_teams);
}

export function isStartingInFiveMinutes(startAt: string) {
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const diff = start - now;
  return diff > 0 && diff <= 5 * 60 * 1000;
}
