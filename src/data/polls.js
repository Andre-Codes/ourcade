/* Daily polls. Reads the Claude-generated pool and layers it over a tiny
   built-in fallback so the page works even if the generated batch is missing or
   empty. Pure JS — importable by the home UI and by scripts/daily-check.js. */

import { rotateDaily, daySeed } from "../lib/daily.js";
import generated from "./generated/polls.js";

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

export const POLLS =
  Array.isArray(generated) && generated.length ? generated : FALLBACK;

const SALT = 101; // keeps poll rotation independent of games & quizzes

// Today's poll — cycles the whole pool with no repeats until exhausted.
export function getTodaysPoll(key) {
  return rotateDaily(POLLS, key, SALT);
}

// No backend yet: build believable per-option counts from the day + poll +
// option, then add this device's real vote (+1). Honest "fake-but-real" — same
// spirit as the visitor odometer. Swapped for true tallies in Phase 3.
export function simulatedTally(poll, myVote, key = "") {
  const counts = poll.options.map((o) => {
    const base = 40 + (daySeed(`${key}:${poll.id}:${o.id}`) % 460); // 40..499
    const count = base + (myVote === o.id ? 1 : 0);
    return { id: o.id, label: o.label, count };
  });
  const total = counts.reduce((s, c) => s + c.count, 0) || 1;
  return counts.map((c) => ({ ...c, pct: Math.round((c.count / total) * 100) }));
}
