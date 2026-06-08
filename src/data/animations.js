/* Flash animations from archive.org. Reads the build-time pull (see
   scripts/fetch-flash.js). Two tiers, split for bundle size:
   - FEATURED (~dozens) is imported EAGERLY — it drives the daily pick that
     shows on the homepage, so it must be there on first paint.
   - The full POOL (thousands) is imported LAZILY on the first stumble / on the
     /flash page, so the homepage doesn't ship ~290KB of ids nobody asked for. */

import { rotateDaily } from "../lib/daily.js";
import featured from "./generated/flash-featured.js";

// Each animation: { id, title, creator, year, featured? }. Optional `aspect`
// (a CSS aspect-ratio string like "4 / 3", "1 / 1", "16 / 9") overrides the
// default flash-screen shape for shorts that would otherwise crop — see
// FlashTheater/FlashChannel and .arcade-flash-screen in arcade.css.
// Tiny safety net so the daily pick works even if the generated module is empty.
const FALLBACK = [
  { id: "endoftheworld_flash", title: "The End of the World", creator: "Jason Windsor", year: "2003", featured: true },
  { id: "flash_badger", title: "Badger", creator: "John Picking (Albino Blacksheep)", year: "2003", featured: true },
  { id: "flash_salad-fingers", title: "Salad Fingers #1: Spoons", creator: "David Firth", year: "2004", featured: true },
];

export const FEATURED =
  Array.isArray(featured) && featured.length ? featured : FALLBACK;

const SALT = 505; // independent rotation order (games 0, polls 101, quizzes 202…)

export const embedUrl = (a) => `https://archive.org/embed/${a.id}`;

// Today's featured animation — deterministic & date-seeded, like Game of the Day.
export function getTodaysAnimation(key) {
  return rotateDaily(FEATURED, key, SALT);
}

// The full pool is a separate chunk, fetched once on demand and cached.
let poolPromise = null;
export function loadPool() {
  if (!poolPromise) {
    poolPromise = import("./generated/animations.js")
      .then((m) => (Array.isArray(m.default) && m.default.length ? m.default : FEATURED))
      .catch(() => FEATURED); // worst case, stumble within the featured set
  }
  return poolPromise;
}

// Pure-random pick for the stumble button — roams the WHOLE pool, optionally
// skipping the one already on screen so a swap always changes something.
export async function randomAnimation(excludeId) {
  const pool = await loadPool();
  const list =
    excludeId && pool.length > 1 ? pool.filter((a) => a.id !== excludeId) : pool;
  return list[Math.floor(Math.random() * list.length)];
}
