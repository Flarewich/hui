import brawlstarsPng from "@/png/brawlstars.png";
import cs2Png from "@/png/cs2.png";
import dota2Jpg from "@/png/dota-2.jpg";
import freefirePng from "@/png/freefire.png";
import mobileLegendsPng from "@/png/mobile-legends.png";
import pubgPng from "@/png/pubg.png";
import pubgMobilePng from "@/png/pubg-mobile.png";
import standoff2Png from "@/png/standoff-2.png";

const GAME_ICON_BY_SLUG: Record<string, string> = {
  "brawl-stars": brawlstarsPng.src,
  brawlstars: brawlstarsPng.src,
  cs2: cs2Png.src,
  "counter-strike-2": cs2Png.src,
  "dota-2": dota2Jpg.src,
  dota2: dota2Jpg.src,
  freefire: freefirePng.src,
  "free-fire": freefirePng.src,
  "mobile-legends": mobileLegendsPng.src,
  mobilelegends: mobileLegendsPng.src,
  pubg: pubgPng.src,
  "pubg-mobile": pubgMobilePng.src,
  standoff2: standoff2Png.src,
  "standoff-2": standoff2Png.src,
};

function normalizeGameKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getLocalGameIcon(gameSlugOrName?: string | null) {
  if (!gameSlugOrName) return null;
  return GAME_ICON_BY_SLUG[normalizeGameKey(gameSlugOrName)] ?? null;
}
