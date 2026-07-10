/* LADDERGRAM — pure day logic.

   No React, no DOM: the same module picks the day's ladder, judges a rung, and
   formats the share line for BOTH the cabinet (Laddergram.jsx) and any headless
   check, exactly like spelldown/logic.js. The hop rule + membership come from the
   shared word-ladder engine (src/lib/wordladder.js) and the shipped wide-words
   dict, so a rung legal here is legal everywhere.

   Puzzles are precomputed at build time (scripts/gen-laddergram.js): each is
   { id, start, end, par, solution }. The browser validates the player's OWN rungs
   against the wide-words Set — it never runs BFS at play time (the solution is
   shipped only for the hint + the headless check). */

import { rotateDaily, dayNumberFromKey } from "../../lib/daily.js";
import { isOneAway } from "../../lib/wordladder.js";
import PUZZLES from "../../data/generated/laddergram.js";
import WIDE_WORDS from "../../data/generated/wide-words.js";

// The runtime dictionary: build the Set once (membership check for each rung).
// The wider 20k accept-set (scripts/gen-wide-words.js) — matches the pool the
// generator built the ladders/pars against, so a rung legal here is legal there.
export const DICT = new Set(WIDE_WORDS);

// A salt unique to this feature. "La" → 0x4c61.
const LADDER_SALT = 0x4c61;

const FALLBACK = {
  id: "laddergram-fallback",
  start: "COLD",
  end: "WARM",
  par: 4,
  solution: ["COLD", "CORD", "WORD", "WARD", "WARM"],
};

// The puzzle for a given local day key ("YYYY-MM-DD"). Deterministic.
export function puzzleFor(dayKey) {
  return rotateDaily(PUZZLES, dayKey, LADDER_SALT) || FALLBACK;
}

const EPOCH_KEY = "2026-06-01";
export function laddergramNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

/* Judge a proposed next rung `word` following `prevWord`, given the words already
   used this run (`usedSet` — a Set or array). Returns one of:
   "ok" | "badlen" | "notword" | "nothop" | "already". Pure. `end` is optional; a
   correct END rung still returns "ok" (the caller detects the win separately). */
export function judgeStep(word, prevWord, usedSet) {
  const w = (word || "").toUpperCase();
  const prev = (prevWord || "").toUpperCase();
  if (w.length !== prev.length) return "badlen";
  if (!isOneAway(prev, w)) return "nothop";
  if (!DICT.has(w)) return "notword";
  const has = usedSet instanceof Set ? usedSet.has(w) : (usedSet || []).includes(w);
  if (has) return "already";
  return "ok";
}

// Did this chain solve the puzzle? (Last rung equals END and every hop is legal.)
export function isSolved(chain, puzzle) {
  if (!chain.length) return false;
  return chain[chain.length - 1].toUpperCase() === puzzle.end.toUpperCase();
}

// The next optimal rung after `prevWord` along the shipped solution, or null if
// prevWord isn't on that path (used by the hint). Case-insensitive.
export function nextHint(prevWord, puzzle) {
  const sol = puzzle.solution.map((w) => w.toUpperCase());
  const i = sol.indexOf((prevWord || "").toUpperCase());
  if (i < 0 || i + 1 >= sol.length) return null;
  return sol[i + 1];
}

// ── share ────────────────────────────────────────────────────────────────────
// Spoiler-free line: rung count vs par, no words revealed, e.g.
//   OURCADE Laddergram #14  COLD→WARM  4 steps (par 4) 🪜
export function shareLine(dayKey, steps, puzzle) {
  const n = laddergramNumber(dayKey);
  const onPar = steps <= puzzle.par;
  return `OURCADE Laddergram #${n}  ${puzzle.start}→${puzzle.end}  ${steps} step${steps === 1 ? "" : "s"} (par ${puzzle.par})${onPar ? " 🪜" : ""}`;
}
