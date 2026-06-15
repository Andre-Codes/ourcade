/* Today's Weird Thing — the 🔍 card, and the homepage's "this site is alive"
   signal. Tied to the day-parts (src/lib/daily.js): the daytime parts
   (morning/afternoon/evening) each show a different pick from the main pool —
   so a visitor who comes back after lunch sees a different weird thing than at
   breakfast — and the 🌙 LATE-NIGHT part swaps to a separate, dreamier pool
   that day-folk never see (a small reward for night owls).

   Hand-curated seeds live in manual.js; the generated pool (refreshed by the
   Phase 2 cron with genuinely-current finds) layers on top of the day pool.
   Pure JS — importable by the home UI and by scripts/daily-check.js. */

import { rotateIntraday, rotateDaily, dayPart } from "../lib/daily.js";
import generated from "./generated/weird.js";
import { MANUAL_WEIRD, MANUAL_WEIRD_NIGHT } from "./manual/content.js";
import { activeSchedule } from "./manual/schedule.js";

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
// ~every 3h — the daytime weird thing freshens through the day. Exported so the
// headless checker (scripts/daily-check.js) can drive every block deterministically.
export const WEIRD_BLOCKS_PER_DAY = 8;

// The current weird thing for this part of the day.
//   • night  → a fresh pick from the dreamy night pool, changing each night.
//   • else   → the main pool stepped through WEIRD_BLOCKS_PER_DAY ~3h blocks, so
//              a daytime visitor sees a fresh pick every few hours (not just the
//              3 day-part boundaries). rotateIntraday derives the live block from
//              the wall clock (honoring ?hour=) when no explicit block is passed.
// `part` is only used to detect night; daytime rotation is block-driven. `block`
// overrides the wall-clock block (headless QA only — scripts/daily-check.js).
export function getCurrentWeirdThing(key, part = dayPart(), block) {
  // The 🌙 late-night secret pool is sacred — dev-scheduled weird things only
  // affect the daytime parts.
  if (part?.id === "night") {
    const pool = WEIRD_NIGHT.length ? WEIRD_NIGHT : FALLBACK;
    return rotateDaily(pool, key, NIGHT_SALT);
  }
  const { pinned, pool: extra } = activeSchedule("weird", key);
  if (pinned.length) return rotateIntraday(pinned, key, WEIRD_BLOCKS_PER_DAY, SALT, block);
  const base = WEIRD.length ? WEIRD : FALLBACK;
  return rotateIntraday([...base, ...extra], key, WEIRD_BLOCKS_PER_DAY, SALT, block);
}
