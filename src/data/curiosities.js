/* Timeless curiosities — the 🌌 card. Things that are fascinating regardless
   of decade. Hand-curated first (same accuracy rationale as facts.js); the
   generated supplement layers in when Phase 2 generation lands. Pure JS —
   importable by the home UI and by scripts/daily-check.js. */

import { rotateDaily } from "../lib/daily.js";
import generated from "./generated/curiosities.js";
import { MANUAL_CURIOSITIES } from "./manual/content.js";
import { activeSchedule } from "./manual/schedule.js";

// Minimal safety net if MANUAL_CURIOSITIES is ever emptied.
const FALLBACK = [
  {
    id: "fallback-mandelbrot",
    title: "The Mandelbrot set",
    blurb:
      "One tiny equation — z² + c, repeated — draws an infinitely deep coastline of seahorses and spirals. Zoom forever; it never runs out.",
    url: "https://en.wikipedia.org/wiki/Mandelbrot_set",
  },
];

export const CURIOSITIES = [
  ...MANUAL_CURIOSITIES,
  ...(Array.isArray(generated) && generated.length ? generated : []),
];

const SALT = 606; // independent of games(0)/polls(101)/quizzes+facts(202)/tips(303)/news(404)/flash(505)

// Today's curiosity — a pinned dev-scheduled curiosity overrides the rotation
// for its window (rotating if several are pinned); otherwise pool-scheduled
// entries just join the normal no-repeat rotation.
export function getTodaysCuriosity(key) {
  const { pinned, pool: extra } = activeSchedule("curiosity", key);
  if (pinned.length) return rotateDaily(pinned, key, SALT);
  const base = CURIOSITIES.length ? CURIOSITIES : FALLBACK;
  return rotateDaily([...base, ...extra], key, SALT);
}
