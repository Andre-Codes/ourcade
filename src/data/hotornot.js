/* Hot or Not — the 💧 Water Cooler's interactive 2000s-web staple. Each subject is
   normalized to the POLL shape ({ id, options: [{id,label}] }) so it reuses the exact
   vote/tally/Firebase infra (src/lib/votes.js + realTally/pollSeed in polls.js) with
   ZERO new backend. We hard-code the two options here so vote ids are ALWAYS exactly
   "hot" / "not" regardless of what the manual/generated data provides. Hand-curated
   leads the pool; the generated supplement layers in when it lands. Pure JS. */

import { rotateDailyN } from "../lib/daily.js";
import generated from "./generated/hotornot.js";
import { MANUAL_HOTORNOT } from "./manual/content.js";

// The fixed verdict options — every Hot-or-Not subject votes on these exact ids.
export const HOT_OR_NOT_OPTIONS = [
  { id: "hot", label: "🔥 HOT" },
  { id: "not", label: "🧊 NOT" },
];

// Normalize a raw subject ({ id, subject, emoji }) into the poll shape the vote
// infra expects. `question` mirrors the subject so realTally/ShareButton read well.
function toSubject(s) {
  return {
    id: s.id,
    subject: s.subject,
    emoji: s.emoji,
    question: s.subject,
    options: HOT_OR_NOT_OPTIONS,
  };
}

// Minimal safety net if MANUAL_HOTORNOT is ever emptied.
const FALLBACK = [
  { id: "hon-fallback-low-rise", subject: "Low-rise jeans (the sequel)", emoji: "👖" },
  { id: "hon-fallback-flip", subject: "Carrying a flip phone in 2026", emoji: "📱" },
  { id: "hon-fallback-dvd", subject: "Owning physical DVDs again", emoji: "📀" },
  { id: "hon-fallback-frosted", subject: "Frosted tips, unironically", emoji: "💇" },
  { id: "hon-fallback-top8", subject: "Ranking your friends in a Top 8", emoji: "🏆" },
];

export const HOT_OR_NOT = [
  ...MANUAL_HOTORNOT,
  ...(Array.isArray(generated) && generated.length ? generated : []),
].map(toSubject);

const SALT = 1212; // independent of all other pools (see src/lib/daily.js)

// Today's Hot-or-Not slate — N distinct subjects, cycling the pool with no early repeats.
export function getTodaysHotOrNot(key, n = 5) {
  const base = HOT_OR_NOT.length ? HOT_OR_NOT : FALLBACK.map(toSubject);
  return rotateDailyN(base, key, n, SALT);
}
