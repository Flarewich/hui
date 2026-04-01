import { pgQuery, pgRows } from "@/lib/postgres";

type GameSeed = {
  slug: string;
  name: string;
  icon_url: string | null;
};

type DbGame = {
  id: string;
  slug: string;
  name: string | null;
  is_active: boolean | null;
};

const DEFAULT_GAMES: GameSeed[] = [
  { slug: "brawl-stars", name: "Brawl Stars", icon_url: "/games/brawlstars.png" },
  { slug: "cs2", name: "CS2", icon_url: "/games/cs2.png" },
  { slug: "dota-2", name: "Dota 2", icon_url: "/games/dota-2.jpg" },
  { slug: "free-fire", name: "Free Fire", icon_url: "/games/freefire.png" },
  { slug: "mobile-legends", name: "Mobile Legends", icon_url: "/games/mobile-legends.png" },
  { slug: "pubg", name: "PUBG", icon_url: "/games/pubg.png" },
  { slug: "pubg-mobile", name: "PUBG Mobile", icon_url: "/games/pubg-mobile.png" },
  { slug: "standoff-2", name: "Standoff 2", icon_url: "/games/standoff-2.png" },
];

function norm(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function canonicalSlug(slug: string | null | undefined, name: string | null | undefined) {
  const text = `${norm(slug)} ${norm(name)}`;
  if (text.includes("brawlstars") || text.includes("brawl-stars")) return "brawl-stars";
  if (text.includes("dota2") || text.includes("dota-2")) return "dota-2";
  if (text.includes("freefire") || text.includes("free-fire")) return "free-fire";
  if (text.includes("mobilelegends") || text.includes("mobile-legends")) return "mobile-legends";
  if (text.includes("pubg-mobile") || text.includes("pubgm")) return "pubg-mobile";
  if (text.includes("standoff2") || text.includes("standoff-2")) return "standoff-2";
  if (text.includes("pubg")) return "pubg";
  if (text.includes("cs2") || text.includes("counter-strike-2") || text.includes("counter-strike2")) return "cs2";
  return null;
}

export async function ensureDefaultGames() {
  const slugs = DEFAULT_GAMES.map((g) => g.slug);
  const existing = await pgRows<{ id: string; slug: string }>(
    `
      select id, slug
      from games
      where slug = any($1::text[])
    `,
    [slugs]
  );

  const existingSlugs = new Set(existing.map((g) => g.slug));
  const missing = DEFAULT_GAMES.filter((g) => !existingSlugs.has(g.slug));

  if (missing.length > 0) {
    for (const game of missing) {
      await pgQuery(
        `
          insert into games (slug, name, icon_url, is_active)
          values ($1, $2, $3, true)
        `,
        [game.slug, game.name, game.icon_url]
      );
    }
  }

  // Keep names/icons in sync with local assets.
  for (const game of DEFAULT_GAMES) {
    await pgQuery(
      `
        update games
        set name = $2, icon_url = $3, is_active = true
        where slug = $1
      `,
      [game.slug, game.name, game.icon_url]
    );
  }

  // Deactivate duplicate aliases (e.g. dota2/dota-2, standoff2/standoff-2).
  const allGames = await pgRows<DbGame>(
    `
      select id, slug, name, is_active
      from games
    `
  );

  if (allGames.length === 0) return;

  const byCanonical = new Map<string, DbGame[]>();
  for (const game of allGames) {
    const key = canonicalSlug(game.slug, game.name);
    if (!key) continue;
    const list = byCanonical.get(key) ?? [];
    list.push(game);
    byCanonical.set(key, list);
  }

  for (const [key, list] of byCanonical) {
    const preferred = list.find((g) => norm(g.slug) === key) ?? list[0];
    const preferredMeta = DEFAULT_GAMES.find((g) => g.slug === key);

    await pgQuery(
      `
        update games
        set name = $2, icon_url = $3, is_active = true
        where id = $1
      `,
      [preferred.id, preferredMeta?.name ?? preferred.name ?? key, preferredMeta?.icon_url ?? null]
    );

    const duplicateIds = list.filter((g) => g.id !== preferred.id).map((g) => g.id);
    if (duplicateIds.length > 0) {
      await pgQuery(
        `
          update games
          set is_active = false
          where id = any($1::uuid[])
        `,
        [duplicateIds]
      );
    }
  }
}
