/* Personality quizzes ("Which X are you?"). Reads the Claude-generated pool over
   a built-in fallback. Scoring is client-side and deterministic. Pure JS. */

import { rotateDaily } from "../lib/daily.js";
import generated from "./generated/quizzes.js";

const FALLBACK = [
  {
    id: "fallback-which-game",
    title: "Which Ourcade Game Are You?",
    intro: "A quick one.",
    results: [
      { id: "descent", title: "The Descent", emoji: "🕯️", blurb: "Careful and calculating.", gameId: "descent" },
      { id: "tap", title: "Tap Surge", emoji: "⚡", blurb: "Pure reflex, zero patience.", gameId: "tap-surge" },
    ],
    questions: [
      {
        q: "Pick a vibe:",
        answers: [
          { label: "Quiet and tense", weights: { descent: 2 } },
          { label: "Loud and fast", weights: { tap: 2 } },
        ],
      },
    ],
  },
];

export const QUIZZES =
  Array.isArray(generated) && generated.length ? generated : FALLBACK;

const SALT = 202; // independent rotation from games & polls

export function getQuiz(id) {
  return QUIZZES.find((q) => q.id === id);
}

export function getTodaysQuiz(key) {
  return rotateDaily(QUIZZES, key, SALT);
}

// Tally each chosen answer's weights into result buckets; highest total wins.
// `answerIdxs[i]` is the selected answer index for question i. Ties resolve to
// the earliest-declared result (generator should list the "default" first).
export function scoreQuiz(quiz, answerIdxs) {
  const totals = Object.fromEntries(quiz.results.map((r) => [r.id, 0]));
  quiz.questions.forEach((question, i) => {
    const ans = question.answers[answerIdxs[i]];
    if (!ans || !ans.weights) return;
    for (const [rid, w] of Object.entries(ans.weights)) {
      if (rid in totals) totals[rid] += w;
    }
  });
  let best = quiz.results[0];
  for (const r of quiz.results) {
    if (totals[r.id] > totals[best.id]) best = r;
  }
  return best;
}
