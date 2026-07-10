/* RANK IT — pure day logic.

   No React, no DOM: the same module decides the day's five words, their display
   shuffle, and grades an ordering for BOTH the cabinet (RankIt.jsx) and any
   headless runner, exactly like spelldown/logic.js. Every surface talks about the
   SAME daily puzzle and scores it identically.

   The puzzle pool is precomputed at build time (scripts/gen-rankit.js). Each entry
   is { id, words: [{ w, rank }] } stored in TRUE order (most→least common). The
   cabinet shows them shuffled (a day-seeded shuffle so it's stable for everyone)
   and the player drags them back into true order. */

import { rotateDaily, dayNumberFromKey, daySeed, seededShuffle } from "../../lib/daily.js";
import PUZZLES from "../../data/generated/rankit.js";

export const WORDS_PER = 5;

// A salt unique to this feature so its rotation order is independent of every
// other daily pick. "Ra" → 0x5261.
const RANKIT_SALT = 0x5261;

// A safe fallback so the cabinet never hard-crashes if the pool is empty.
const FALLBACK = {
  id: "rankit-fallback",
  words: [
    { w: "TIME", rank: 60 }, { w: "HOUSE", rank: 400 }, { w: "MUSIC", rank: 800 },
    { w: "OCEAN", rank: 2600 }, { w: "VELVET", rank: 3900 },
  ],
};

// The puzzle for a given local day key ("YYYY-MM-DD"). Deterministic.
export function puzzleFor(dayKey) {
  return rotateDaily(PUZZLES, dayKey, RANKIT_SALT) || FALLBACK;
}

// A 1-based "Rank It #" for display/sharing, anchored at the site's launch day.
const EPOCH_KEY = "2026-06-01";
export function rankitNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

// The words to SHOW, shuffled deterministically for the day (same for everyone)
// so the puzzle never opens already-solved. Returns just the display words in
// shuffled order (the ranks/truth stay in the puzzle object).
export function displayWords(puzzle, dayKey) {
  const seed = (daySeed(dayKey) ^ 0x5261) >>> 0;
  let shuffled = seededShuffle(puzzle.words, seed);
  // Guard against the rare shuffle that lands already in true order — nudge it.
  if (shuffled.every((x, i) => x.w === puzzle.words[i].w) && shuffled.length > 1) {
    shuffled = [shuffled[shuffled.length - 1], ...shuffled.slice(0, -1)];
  }
  return shuffled.map((x) => x.w);
}

// The true order (most→least common) as a plain word array — the answer.
export function trueOrder(puzzle) {
  return puzzle.words.map((x) => x.w);
}

// ── scoring ──────────────────────────────────────────────────────────────────
// Per-slot correctness plus a closeness score with PARTIAL credit. `guess` is the
// player's ordered word array. We report:
//   exact   — how many slots are in exactly the right position (the 🟩 count)
//   inversions — # of out-of-order adjacent-in-truth pairs (Kendall-tau distance)
//   score   — 0..100 closeness: 100 = perfect order, scaled by 1 - inv/maxInv
// so a near-miss still scores well and only a fully-reversed guess scores ~0.
export function scoreOrder(guess, puzzle) {
  const truth = trueOrder(puzzle);
  const pos = new Map(truth.map((w, i) => [w, i])); // word → its true index
  const n = truth.length;

  let exact = 0;
  for (let i = 0; i < n; i++) if (guess[i] === truth[i]) exact++;

  // Count inversions among the guessed order's true-index sequence.
  const idx = guess.map((w) => pos.get(w));
  let inversions = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (idx[i] > idx[j]) inversions++;
    }
  }
  const maxInv = (n * (n - 1)) / 2; // fully reversed
  const score = Math.round((1 - inversions / maxInv) * 100);

  // Per-slot closeness marks, by distance from the word's true slot — the SAME
  // three buckets the share grid uses, so the in-game reveal and the shared
  // squares always agree: exact (right slot) / near (one off) / far (2+ off).
  const marks = guess.map((w, i) => {
    const d = Math.abs(pos.get(w) - i);
    return d === 0 ? "exact" : d === 1 ? "near" : "far";
  });

  return { exact, inversions, maxInv, score, marks, perfect: exact === n };
}

// ── share ────────────────────────────────────────────────────────────────────
// Spoiler-free share line — the "#n" header sits on its own line above the
// closeness squares, e.g.
//   OURCADE Rank It #14
//   🟩🟩🟨🟩🟥  92 — 4/5 in place
// 🟩 = exact slot, 🟨 = one away, 🟥 = further off. The squares are derived from
// the SAME per-slot marks the in-game reveal uses (scoreOrder.marks).
const MARK_SQUARE = { exact: "🟩", near: "🟨", far: "🟥" };
export function shareLine(dayKey, guess, puzzle) {
  const n = rankitNumber(dayKey);
  const truth = trueOrder(puzzle);
  const { score, exact, marks } = scoreOrder(guess, puzzle);
  const row = marks.map((m) => MARK_SQUARE[m]).join("");
  return `OURCADE Rank It #${n}\n${row}  ${score} — ${exact}/${truth.length} in place`;
}
