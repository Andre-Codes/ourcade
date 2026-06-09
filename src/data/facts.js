/* Daily game facts. Hand-curated for now — the pool is the MANUAL_FACTS list in
   manual.js (all hand-verified). The AI/API generation is DISABLED (see
   GENERATE_FACTS in scripts/generate-content.js): real-world facts can't be
   web-grounded during structured output, so we'd rather run a known-true set.

   The pick changes every 3 days (not daily), so a fact lingers a little. Pure JS
   — importable by the home UI and by scripts/daily-check.js.

   To re-enable the AI supplement: flip GENERATE_FACTS, run `npm run generate`,
   then restore the `generated/facts.js` import + spread below.

   FIREBASE SEAM: today this is a date-seeded pick. When a real fact source /
   per-device "seen" tracking lands, getTodaysFact gains an optional reshuffle
   path (the deferred "🎲 another fact" button). */

import { rotateEvery } from "../lib/daily.js";
import { MANUAL_FACTS } from "./manual.js";
// import generated from "./generated/facts.js"; // AI pool — disabled for now

// Minimal safety net if MANUAL_FACTS is ever emptied.
const FALLBACK = [
  "'Pac-Man' was originally named 'Puck Man' in Japan, after the Japanese phrase 'paku paku' for chomping.",
  "'Tetris' is the first video game ever played in space — a Game Boy copy flew aboard a 1993 Russian mission.",
];

// Hand-curated only. (Re-enable the AI supplement by spreading `generated` here.)
export const FACTS = MANUAL_FACTS.length ? MANUAL_FACTS : FALLBACK;

const SALT = 202; // keeps fact rotation independent of polls(101)/tips(303)/news(404)
const PERIOD_DAYS = 3; // a fresh fact every 3 days

// Cycles the whole pool with no repeats, advancing once every 3 days.
export function getTodaysFact(key) {
  return rotateEvery(FACTS, key, PERIOD_DAYS, SALT);
}
