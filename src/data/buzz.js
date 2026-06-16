/* The Buzz — the 💧 Water Cooler's tabloid/water-cooler blurbs. A handful surface
   per day (rotateDailyN, like Site News shows 3). Hand-curated leads the pool; the
   generated supplement layers in when it lands. Pure JS — importable by the UI and
   by scripts/daily-check.js. */

import { rotateDailyN } from "../lib/daily.js";
import generated from "./generated/buzz.js";
import { MANUAL_BUZZ } from "./manual/content.js";

// Minimal safety net if MANUAL_BUZZ is ever emptied.
const FALLBACK = [
  { id: "bz-fallback-1", text: "A beloved franchise is getting rebooted. The original cast is 'in talks,' which is Hollywood for 'we asked, they're thinking about the check.'", tag: "RUMOR" },
  { id: "bz-fallback-2", text: "Two pop stars are 'not feuding,' per a statement nobody asked them for, which is how you know they absolutely are.", tag: "GOSSIP" },
  { id: "bz-fallback-3", text: "Your streaming service raised its price and added ads. It is slowly, confidently reinventing cable. Welcome home.", tag: "HOT TAKE" },
];

export const BUZZ = [
  ...MANUAL_BUZZ,
  ...(Array.isArray(generated) && generated.length ? generated : []),
];

const SALT = 1111; // independent of all other pools (see src/lib/daily.js)

// Today's buzz — N distinct blurbs, cycling the whole pool with no early repeats.
export function getTodaysBuzz(key, n = 3) {
  const base = BUZZ.length ? BUZZ : FALLBACK;
  return rotateDailyN(base, key, n, SALT);
}
