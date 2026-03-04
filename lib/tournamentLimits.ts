type GameKey = "pubg" | "pubg_mobile" | "freefire" | "dota2" | "brawl_stars" | "cs2" | "other";

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

  if (text.includes("pubg-mobile") || text.includes("pubgm") || text.includes("pubg mobile")) return "pubg_mobile";
  if (text.includes("pubg")) return "pubg";
  if (text.includes("freefire") || text.includes("free-fire") || text.includes("free fire")) return "freefire";
  if (text.includes("dota-2") || text.includes("dota2") || text.includes("dota 2")) return "dota2";
  if (text.includes("brawl-stars") || text.includes("brawlstars") || text.includes("brawl stars")) return "brawl_stars";
  if (text.includes("cs2") || text.includes("counter-strike-2") || text.includes("counter strike 2")) return "cs2";
  return "other";
}

export function getTeamSizeLimit(mode: string, gameSlug?: string | null, gameName?: string | null) {
  if (mode === "solo") return 1;
  if (mode === "duo") return 2;
  if (mode !== "squad") return 5;

  const game = resolveGameKey(gameSlug, gameName);
  if (game === "pubg" || game === "pubg_mobile" || game === "freefire") return 4;
  return 5;
}

export function getTournamentCapacity(mode: string, gameSlug?: string | null, gameName?: string | null) {
  if (mode === "solo") return 100;

  const game = resolveGameKey(gameSlug, gameName);
  if (game === "pubg" || game === "pubg_mobile") return 25;
  if (game === "brawl_stars") return 12;

  const teamSize = getTeamSizeLimit(mode, gameSlug, gameName);
  if (teamSize === 5) return 24;

  // Fallback for non-5-player games not covered by explicit rules.
  if (mode === "duo") return 50;
  if (mode === "squad") return 25;
  return 100;
}

export function isStartingInFiveMinutes(startAt: string) {
  const now = Date.now();
  const start = new Date(startAt).getTime();
  const diff = start - now;
  return diff > 0 && diff <= 5 * 60 * 1000;
}
