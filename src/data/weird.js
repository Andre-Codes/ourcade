/* Today's Weird Thing — the 🔍 card, and the homepage's "this site is alive"
   signal. Tied to the day-parts (src/lib/daily.js): the daytime parts
   (morning/afternoon/evening) each show a different pick from the main pool —
   so a visitor who comes back after lunch sees a different weird thing than at
   breakfast — and the 🌙 LATE-NIGHT part swaps to a separate, dreamier pool
   that day-folk never see (a small reward for night owls).

   Hand-curated seeds live in manual.js; the generated pool (refreshed by the
   Phase 2 cron with genuinely-current finds) layers on top of the day pool.
   Pure JS — importable by the home UI and by scripts/daily-check.js. */

import { rotateIntraday, rotateDaily, dayPart, DAY_PART_COUNT } from "../lib/daily.js";
import generated from "./generated/weird.js";
import { MANUAL_WEIRD, MANUAL_WEIRD_NIGHT } from "./manual.js";

// Minimal safety net if both pools are ever emptied.
const FALLBACK = [
  {
    id: "fallback-useless-web",
    title: "The Useless Web",
    blurb:
      "One button: 'take me to a useless website, please.' It has been faithfully delivering pointless masterpieces for over a decade.",
    url: "https://theuselessweb.com",
  },
];

// Daytime pool (manual seeds + generated current finds).
export const WEIRD = [
  ...MANUAL_WEIRD,
  ...(Array.isArray(generated) && generated.length ? generated : []),
];

// Late-night-only pool (the 🌙 secret). Hand-curated for now.
export const WEIRD_NIGHT = MANUAL_WEIRD_NIGHT;

const SALT = 707; // independent of every other rotation
const NIGHT_SALT = 717; // the night pool rotates on its own order

// The current weird thing for this part of the day.
//   • night  → a fresh pick from the dreamy night pool, changing each night.
//   • else   → the main pool indexed by the day-part (so morning/afternoon/
//              evening each differ), reusing rotateIntraday's headless block arg.
// `part` defaults to the live local part; scripts pass an explicit one.
export function getCurrentWeirdThing(key, part = dayPart()) {
  if (part?.id === "night") {
    const pool = WEIRD_NIGHT.length ? WEIRD_NIGHT : FALLBACK;
    return rotateDaily(pool, key, NIGHT_SALT);
  }
  const pool = WEIRD.length ? WEIRD : FALLBACK;
  return rotateIntraday(pool, key, DAY_PART_COUNT, SALT, part?.index ?? 0);
}
