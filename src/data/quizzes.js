/* Personality quizzes ("Which X are you?"). Reads the Claude-generated pool over
   a built-in fallback. Scoring is client-side and deterministic. Pure JS. */

import { rotateDaily, rotateDailyN } from "../lib/daily.js";
import generated from "./generated/quizzes.js";
import { MANUAL_QUIZZES } from "./manual/content.js";

const FALLBACK = [
  {
    id: "fallback-which-game",
    title: "Which Ourcade Game Are You?",
    intro: "Six quick questions. No wrong answers, only vibes.",
    results: [
      { id: "pits", title: "Pits and Portals", emoji: "🕯️", blurb: "Careful and calculating. You read the room before you make a move.", gameId: "pits-and-portals" },
      { id: "tap", title: "Tap Surge", emoji: "⚡", blurb: "Pure reflex, zero patience. You're already three moves ahead while everyone else loads.", gameId: "tap-surge" },
      { id: "crawler", title: "Crypt Crawler", emoji: "🗝️", blurb: "Grindy and relentless. You'd rather earn the win the long way and remember every step.", gameId: "crypt-crawler" },
    ],
    questions: [
      {
        q: "Pick a vibe:",
        answers: [
          { label: "Quiet and tense", weights: { pits: 3 } },
          { label: "Loud and fast", weights: { tap: 3 } },
          { label: "Slow and stubborn", weights: { crawler: 3 } },
        ],
      },
      {
        q: "It's the weekend. You're...",
        answers: [
          { label: "Planning the whole thing on paper", weights: { pits: 2, crawler: 1 } },
          { label: "Out the door before the plan finishes", weights: { tap: 2, pits: 1 } },
          { label: "Doing the same thing you always do, perfectly", weights: { crawler: 2 } },
        ],
      },
      {
        q: "Pick a snack:",
        answers: [
          { label: "Whatever's closest, eaten in two bites", weights: { tap: 2 } },
          { label: "A careful little plate, arranged", weights: { pits: 2, crawler: 1 } },
          { label: "The economy-size bag, rationed for hours", weights: { crawler: 2 } },
        ],
      },
      {
        q: "Something breaks. First instinct?",
        answers: [
          { label: "Stop, breathe, diagnose", weights: { pits: 2 } },
          { label: "Smack it and try again immediately", weights: { tap: 2, crawler: 1 } },
          { label: "Start over from the very beginning", weights: { crawler: 2, pits: 1 } },
        ],
      },
      {
        q: "Pick a color:",
        answers: [
          { label: "Candle-lit amber", weights: { pits: 2 } },
          { label: "Electric blue", weights: { tap: 2 } },
          { label: "Mossy dungeon green", weights: { crawler: 2 } },
        ],
      },
      {
        q: "Your idea of a win?",
        answers: [
          { label: "A clean run, no mistakes", weights: { pits: 2, crawler: 1 } },
          { label: "A new high score by 0.2 seconds", weights: { tap: 3 } },
          { label: "Finally clearing the floor that's haunted you", weights: { crawler: 3 } },
        ],
      },
    ],
  },
];

// Manual entries (hand-edited, persist across regeneration) lead the pool, then
// the generated batch — or the fallback if generation is missing/empty.
export const QUIZZES = [
  ...MANUAL_QUIZZES,
  ...(Array.isArray(generated) && generated.length ? generated : FALLBACK),
];

const SALT = 202; // independent rotation from games & polls
const SALT_TOPICAL = 717; // own order for the guaranteed trend pick

export function getQuiz(id) {
  return QUIZZES.find((q) => q.id === id);
}

export function getTodaysQuiz(key) {
  return rotateDaily(QUIZZES, key, SALT);
}

// A handful of quizzes a visitor can take today (default 3), drawn from the same
// no-repeat rotation so the set is fresh each day. If the day's set happens to be
// all-evergreen, we swap the last slot for today's trend-linked quiz so there's
// always at least one "ripped from the headlines" pick (when any exist). Graceful
// no-op on older data that predates the `topical` flag.
export function getTodaysQuizzes(key, n = 3) {
  const set = rotateDailyN(QUIZZES, key, n, SALT);
  if (set.some((q) => q.topical)) return set;
  const topicalPool = QUIZZES.filter((q) => q.topical);
  if (!topicalPool.length) return set;
  const pick = rotateDaily(topicalPool, key, SALT_TOPICAL);
  if (!pick || set.some((q) => q.id === pick.id)) return set;
  return [...set.slice(0, Math.max(0, set.length - 1)), pick];
}

// Tally each chosen answer's weights into result buckets; highest total wins.
// `answerIdxs[i]` is the selected answer index for question i. Deterministic, so
// the same answers always yield the same result. Ties break by: (1) breadth —
// the result that drew points from the most distinct questions (rewards a
// consistent through-line over one big spike), then (2) a small hash of the
// answer pattern, so a dead-even tie isn't always handed to the first result.
export function scoreQuiz(quiz, answerIdxs) {
  const totals = Object.fromEntries(quiz.results.map((r) => [r.id, 0]));
  const breadth = Object.fromEntries(quiz.results.map((r) => [r.id, 0]));
  quiz.questions.forEach((question, i) => {
    const ans = question.answers[answerIdxs[i]];
    if (!ans || !ans.weights) return;
    for (const [rid, w] of Object.entries(ans.weights)) {
      if (rid in totals) {
        totals[rid] += w;
        if (w > 0) breadth[rid] += 1;
      }
    }
  });
  // Deterministic offset from the answer pattern to break exact ties without
  // always favoring results[0]. Just needs to be stable for a given answer set.
  const seed = answerIdxs.reduce((a, v, i) => a + (v + 1) * (i + 1), 0);
  let best = quiz.results[0];
  let bestRank = -1;
  quiz.results.forEach((r, i) => {
    const rank =
      totals[r.id] * 1000 + breadth[r.id] * 10 + ((seed + i) % 7);
    if (rank > bestRank) {
      bestRank = rank;
      best = r;
    }
  });
  return best;
}
