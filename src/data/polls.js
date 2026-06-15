/* Daily polls. Reads the Claude-generated pool and layers it over a tiny
   built-in fallback so the page works even if the generated batch is missing or
   empty. Pure JS — importable by the home UI and by scripts/daily-check.js. */

import { rotateDaily, daySeed } from "../lib/daily.js";
import generated from "./generated/polls.js";
import { MANUAL_POLLS } from "./manual/content.js";

// Minimal safety net — the real variety lives in generated/polls.js.
const FALLBACK = [
  {
    id: "fallback-snack",
    question: "Correct arcade fuel?",
    options: [
      { id: "chips", label: "Hot chips 🔥" },
      { id: "soda", label: "Warm flat soda 🥤" },
      { id: "focus", label: "Nothing. Pure focus 🧘" },
    ],
  },
];

// Manual entries (hand-edited, persist across regeneration) lead the pool, then
// the generated batch — or the fallback if generation is missing/empty.
export const POLLS = [
  ...MANUAL_POLLS,
  ...(Array.isArray(generated) && generated.length ? generated : FALLBACK),
];

const SALT = 101; // keeps poll rotation independent of games & quizzes

// Today's poll — cycles the whole pool with no repeats until exhausted.
export function getTodaysPoll(key) {
  return rotateDaily(POLLS, key, SALT);
}

// A tiny per-option vanity seed so a brand-new poll never renders as all-zeros.
// Small (3..12) and deterministic, so REAL votes quickly dominate — the bars
// move as actual people vote. `counts` is the live Firestore tally map.
export function pollSeed(poll, optionId) {
  return 3 + (daySeed(`seed:${poll.id}:${optionId}`) % 10); // 3..12
}

// REAL tally: live shared counts (from polls/{id}.counts) + the vanity seed,
// turned into per-option totals and percentages.
export function realTally(poll, counts = {}) {
  const rows = poll.options.map((o) => ({
    id: o.id,
    label: o.label,
    count: pollSeed(poll, o.id) + (Number(counts?.[o.id]) || 0),
  }));
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return rows.map((r) => ({ ...r, pct: Math.round((r.count / total) * 100) }));
}
