/* The Countdown — the 💧 Water Cooler's TRL/Billboard top-5. A whole chart SET
   is the unit of rotation (the ranking IS the content), so we rotate finished
   sets day-to-day rather than assembling a chart from loose entries. Pure JS —
   importable by the UI and by scripts/daily-check.js.

   TWO TIERS, same as src/data/buzz.js: generated charts name real titles AND
   real artists (and carry era: "now" | "retro"), so they're what rotates.
   MANUAL_COUNTDOWNS is the safety net only — a chart whose rows are "the one
   from the show everyone's watching" is a chart of blank rows, fine as a
   never-empty guarantee, not fine as a third of the rotation. */

import { rotateDaily } from "../lib/daily.js";
import generated from "./generated/countdowns.js";
import { MANUAL_COUNTDOWNS } from "./manual/content.js";

// Minimal safety net if MANUAL_COUNTDOWNS is ever emptied.
const FALLBACK = [
  {
    id: "ctd-fallback",
    title: "TOP 5 THINGS THE INTERNET IS ARGUING ABOUT",
    unit: "show",
    blurb: "the eternal countdown",
    entries: [
      { rank: 1, title: "the show with the twist", note: "no spoilers in the replies. they show no mercy.", trend: "same" },
      { rank: 2, title: "the song you can't stop humming", note: "you're doing it right now.", trend: "up" },
      { rank: 3, title: "the movie everyone saw twice", note: "let's not pretend you didn't.", trend: "down" },
      { rank: 4, title: "the throwback that came back", note: "a video unearthed it. the cycle is complete.", trend: "new" },
      { rank: 5, title: "the thing that shouldn't be popular", note: "it's popular. respect the chaos.", trend: "up" },
    ],
  },
];

export const COUNTDOWNS_GENERATED = Array.isArray(generated) ? generated : [];
export const COUNTDOWNS_MANUAL = MANUAL_COUNTDOWNS;

// Every tier — for tooling and validators. NOT what the page rotates.
export const COUNTDOWNS = [...COUNTDOWNS_GENERATED, ...COUNTDOWNS_MANUAL];

// Roughly a week and a half of charts before the placeholders would be needed.
const MIN_GENERATED = 8;

export const COUNTDOWN_POOL =
  COUNTDOWNS_GENERATED.length >= MIN_GENERATED ? COUNTDOWNS_GENERATED
  : COUNTDOWNS.length ? COUNTDOWNS
  : FALLBACK;

const SALT = 909; // independent of all other pools (see src/lib/daily.js)

// Today's countdown — cycles the pool of chart sets with no early repeats.
export function getTodaysCountdown(key) {
  return rotateDaily(COUNTDOWN_POOL, key, SALT);
}
