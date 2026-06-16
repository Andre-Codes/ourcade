/* THE DAILY QUARTER — pure puzzle logic.

   No React, no DOM: the same module decides the day's word and grades a guess
   for BOTH the playable game (QuarterGame.jsx) and the headless NPC texter
   (scripts/quarter-text.js), exactly like pits-and-portals/engine.js is shared
   with its sim. That guarantees the "Byte Badger texted you today's Quarter"
   message and the board you actually play are the SAME puzzle.

   The solution rotates with rotateDaily so every device sees one shared word per
   local day and the whole answer pool cycles before any repeat. */

import { rotateDaily, dayNumberFromKey } from "../../lib/daily.js";
import { ANSWERS, VALID } from "../../data/quarterWords.js";

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;

// A salt unique to this feature so its rotation order is independent of every
// other daily pick (polls, quizzes, …). Any stable constant works.
const QUARTER_SALT = 0x5175; // "Qu"

// The solution for a given local day key ("YYYY-MM-DD"). Deterministic.
export function answerFor(dayKey) {
  return (rotateDaily(ANSWERS, dayKey, QUARTER_SALT) || ANSWERS[0]).toLowerCase();
}

// A 1-based "Quarter #" for display/sharing, anchored at the site's launch day
// so the number reads small and human (#1, #2, …) rather than a huge epoch int.
const EPOCH_KEY = "2026-06-01";
export function quarterNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

export function isValidGuess(word) {
  return typeof word === "string" && word.length === WORD_LEN && VALID.has(word.toLowerCase());
}

/* Grade a guess against the answer, Wordle-style, handling duplicate letters
   correctly: a letter is "present" only as many times as it appears in the
   answer beyond the exact ("correct") matches. Returns an array of WORD_LEN
   marks, each "correct" | "present" | "absent". */
export function grade(guess, answer) {
  const g = guess.toLowerCase().split("");
  const a = answer.toLowerCase().split("");
  const marks = new Array(WORD_LEN).fill("absent");

  // Tally answer letters, then consume exact matches first.
  const remaining = {};
  for (const ch of a) remaining[ch] = (remaining[ch] || 0) + 1;
  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === a[i]) {
      marks[i] = "correct";
      remaining[g[i]]--;
    }
  }
  // Then present (right letter, wrong spot) while that letter still has budget.
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] === "correct") continue;
    if (remaining[g[i]] > 0) {
      marks[i] = "present";
      remaining[g[i]]--;
    }
  }
  return marks;
}

// Compact emoji row for the share grid. 🟩 correct · 🟨 present · ⬛ absent.
const EMOJI = { correct: "🟩", present: "🟨", absent: "⬛" };
export function emojiRow(marks) {
  return marks.map((m) => EMOJI[m]).join("");
}

// Full shareable result block (Wordle-style), e.g.
//   OURCADE Quarter #12  4/6
//   ⬛🟨⬛⬛⬛
//   …
export function shareGrid(dayKey, guessRows /* array of mark-arrays */, won) {
  const n = quarterNumber(dayKey);
  const score = won ? `${guessRows.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const grid = guessRows.map(emojiRow).join("\n");
  return `OURCADE Quarter #${n}  ${score}\n${grid}`;
}
