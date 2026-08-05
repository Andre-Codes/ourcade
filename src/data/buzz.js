/* The Buzz — the 💧 Water Cooler's daily dispatches. Six surface per day
   (rotateDailyN). Pure JS — importable by the UI and by scripts/daily-check.js.

   TWO TIERS, and the order matters. The generated pool is the wire copy: every
   dispatch names a real thing and cites a real outlet (enforced at write time by
   scripts/lib/buzz-quality.js). MANUAL_BUZZ is the safety net — evergreen
   archetypes ("a celebrity was photographed holding an iced coffee") that read
   fine in isolation but turn the card into a horoscope when they're most of what
   you see. So while the generated tier is healthy they never surface at all;
   they exist so a failed generation run degrades to something rather than
   nothing. */

import { rotateDailyN } from "../lib/daily.js";
import generated from "./generated/buzz.js";
import { MANUAL_BUZZ } from "./manual/content.js";

// Minimal safety net if MANUAL_BUZZ is ever emptied.
const FALLBACK = [
  { id: "bz-fallback-1", text: "A beloved franchise is getting rebooted. The original cast is 'in talks,' which is Hollywood for 'we asked, they're thinking about the check.'", tag: "RUMOR" },
  { id: "bz-fallback-2", text: "Two pop stars are 'not feuding,' per a statement nobody asked them for, which is how you know they absolutely are.", tag: "GOSSIP" },
  { id: "bz-fallback-3", text: "Your streaming service raised its price and added ads. It is slowly, confidently reinventing cable. Welcome home.", tag: "HOT TAKE" },
];

// Some generated/older entries prefix the text with their own tag ("RUMOR: …"),
// which would double up next to the tag chip in the UI. Strip a single leading
// TAG: so the chip is the only place the tag shows. Defensive — harmless on
// already-clean items.
const TAG_PREFIX = /^\s*(GOSSIP|RUMOR|SIGHTING|HOT TAKE)\s*:\s*/i;
function clean(b) {
  const text = String(b.text || "").replace(TAG_PREFIX, "").trim();
  return text === b.text ? b : { ...b, text };
}

export const BUZZ_GENERATED = (Array.isArray(generated) ? generated : []).map(clean);
export const BUZZ_MANUAL = MANUAL_BUZZ.map(clean);

// Every tier — for tooling and validators that want the whole corpus. NOT what
// the page rotates; see BUZZ_POOL.
export const BUZZ = [...BUZZ_GENERATED, ...BUZZ_MANUAL];

// Four editions of six before the archetypes would be needed at all.
const MIN_GENERATED = 24;

// The pool the page actually rotates. Healthy generated tier → the reader only
// ever sees named, sourced news. Thin one → mix in the archetypes. Nothing at
// all → the inline net above.
export const BUZZ_POOL =
  BUZZ_GENERATED.length >= MIN_GENERATED ? BUZZ_GENERATED
  : BUZZ.length ? BUZZ
  : FALLBACK;

const SALT = 1111; // independent of all other pools (see src/lib/daily.js)

// Today's buzz — N distinct dispatches, cycling the pool with no early repeats.
export function getTodaysBuzz(key, n = 3) {
  return rotateDailyN(BUZZ_POOL, key, n, SALT);
}
