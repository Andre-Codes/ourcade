/* The Countdown — the 💧 Water Cooler's TRL/Billboard top-5. A whole chart SET
   is the unit of rotation (the ranking IS the content), so we rotate finished
   sets day-to-day rather than assembling a chart from loose entries. Hand-curated
   sets lead the pool; the generated supplement layers in when it lands. Pure JS —
   importable by the UI and by scripts/daily-check.js. */

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

export const COUNTDOWNS = [
  ...MANUAL_COUNTDOWNS,
  ...(Array.isArray(generated) && generated.length ? generated : []),
];

const SALT = 909; // independent of all other pools (see src/lib/daily.js)

// Today's countdown — cycles the whole pool of chart sets with no early repeats.
export function getTodaysCountdown(key) {
  const base = COUNTDOWNS.length ? COUNTDOWNS : FALLBACK;
  return rotateDaily(base, key, SALT);
}
