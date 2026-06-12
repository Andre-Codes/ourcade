/* Today's Weird Thing — the 🔍 card, and the homepage's "this site is alive"
   signal. Rotates EVERY FEW HOURS (not daily): rotateIntraday steps the same
   no-repeat order BLOCKS_PER_DAY times per local day, so a visitor who comes
   back after lunch sees a different weird thing than they saw at breakfast.

   Hand-curated seeds live in manual.js; the generated pool (refreshed by the
   Phase 2 cron with genuinely-current finds) layers on top. Pure JS —
   importable by the home UI and by scripts/daily-check.js. */

import { rotateIntraday } from "../lib/daily.js";
import generated from "./generated/weird.js";
import { MANUAL_WEIRD } from "./manual.js";

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

export const WEIRD = [
  ...MANUAL_WEIRD,
  ...(Array.isArray(generated) && generated.length ? generated : []),
];

const SALT = 707; // independent of every other rotation
export const BLOCKS_PER_DAY = 3; // a fresh weird thing roughly every 8 hours

// The current block's weird thing — same item for everyone in the same block.
// `block` is the headless override for scripts/daily-check.js.
export function getCurrentWeirdThing(key, block) {
  const pool = WEIRD.length ? WEIRD : FALLBACK;
  return rotateIntraday(pool, key, BLOCKS_PER_DAY, SALT, block);
}
