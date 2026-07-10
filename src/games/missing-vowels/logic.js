/* MISSING VOWELS — pure day logic.

   No React, no DOM: picks the day's themed set, judges a restored word, and formats
   the share line for BOTH the cabinet (MissingVowels.jsx) and any headless check.
   Same shared-truth idea as spelldown/logic.js.

   Puzzles are precomputed at build time (scripts/gen-vowels.js): each is
   { id, theme, items: [{ clue, answer }] } where `clue` is the vowel-stripped
   skeleton. A guess is accepted if it's a common word (shipped wide-words dict)
   whose own skeleton matches the clue — so the authored answer isn't the ONLY
   solution; any common word with that consonant skeleton counts. */

import { rotateDaily, dayNumberFromKey } from "../../lib/daily.js";
import PUZZLES from "../../data/generated/vowels.js";
import WIDE_WORDS from "../../data/generated/wide-words.js";

// The wider 20k accept-set (scripts/gen-wide-words.js) — a guess counts if it's
// in here and its skeleton matches the clue, so more valid everyday words are
// accepted (not just the authored answer).
const DICT = new Set(WIDE_WORDS);

// "Mv" → 0x4d76.
const VOWELS_SALT = 0x4d76;

// Same skeleton rule as the generator (strip AEIOU, keep the rest).
export const skeleton = (w) => (w || "").toUpperCase().replace(/[AEIOU]/g, "");

const FALLBACK = {
  id: "vowels-fallback",
  theme: "Kitchen",
  items: [
    { clue: "KNF", answer: "KNIFE" }, { clue: "PLT", answer: "PLATE" },
    { clue: "TBL", answer: "TABLE" }, { clue: "BWL", answer: "BOWL" },
  ],
};

export function puzzleFor(dayKey) {
  return rotateDaily(PUZZLES, dayKey, VOWELS_SALT) || FALLBACK;
}

const EPOCH_KEY = "2026-06-01";
export function vowelsNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

/* Judge a guess for the item with the given `clue` (its consonant skeleton).
   Returns "ok" | "wrong" | "notword". A guess is OK if it's a common word whose
   skeleton matches the clue. (The authored answer always satisfies this, but so
   does any other common word with the same skeleton.) */
export function judge(guess, clue) {
  const w = (guess || "").toUpperCase();
  if (skeleton(w) !== clue.toUpperCase()) return "wrong";
  if (!DICT.has(w)) return "notword";
  return "ok";
}

// One revealed vowel for a hint: the first vowel of the authored answer, at its
// position — enough of a nudge without giving the whole word.
export function vowelHint(item) {
  const a = item.answer.toUpperCase();
  for (let i = 0; i < a.length; i++) {
    if ("AEIOU".includes(a[i])) return { pos: i, ch: a[i] };
  }
  return null;
}

// ── share ────────────────────────────────────────────────────────────────────
// Spoiler-free: theme + solved count, e.g.
//   OURCADE Missing Vowels #14  Kitchen 5/6 🔤
export function shareLine(dayKey, solvedCount, puzzle) {
  const n = vowelsNumber(dayKey);
  const total = puzzle.items.length;
  const done = solvedCount === total ? " 🔤" : "";
  return `OURCADE Missing Vowels #${n}  ${puzzle.theme} ${solvedCount}/${total}${done}`;
}
