/* CHAIN — pure day logic.

   No React, no DOM: picks the day's seed, judges the next word, and formats the
   share line for BOTH the cabinet (Chain.jsx) and any headless check. Same
   shared-truth pattern as spelldown/logic.js.

   Puzzles are precomputed at build time (scripts/gen-chain.js): each is
   { id, seed, par, sample }. The rule is last-first: each new word must START with
   the LAST letter of the previous word, be a common word (shipped common-words
   dict), and not repeat one already used. `par` is a target chain length. */

import { rotateDaily, dayNumberFromKey } from "../../lib/daily.js";
import PUZZLES, { categories as CATEGORIES } from "../../data/generated/chain.js";
import COMMON_WORDS from "../../data/generated/common-words.js";
import { ruleById } from "./rules.js";

const DICT = new Set(COMMON_WORDS);

// The category record ({ label, words, set }) for a puzzle, or null on a plain
// day. The Set is memoized per id so we build each accept-set only once.
const CATEGORY_SETS = {};
export function categoryFor(puzzle) {
  const id = puzzle && puzzle.category;
  if (!id || !CATEGORIES || !CATEGORIES[id]) return null;
  if (!CATEGORY_SETS[id]) {
    CATEGORY_SETS[id] = new Set(CATEGORIES[id].words.map((w) => w.toUpperCase()));
  }
  return { id, label: CATEGORIES[id].label, words: CATEGORIES[id].words, set: CATEGORY_SETS[id] };
}

// "Ch" → 0x4368.
const CHAIN_SALT = 0x4368;

// One 60-second run per day: the timer starts on the first word and freezes the
// chain at zero. Build the longest chain you can before it runs out.
export const RUN_SECONDS = 60;

const PLAIN_RULE = { id: "plain", label: "just chain — last letter to first", hint: "" };
const FALLBACK = {
  id: "chain-fallback", seed: "APPLE", par: 6, sample: ["APPLE"], rule: PLAIN_RULE,
};

export function puzzleFor(dayKey) {
  return rotateDaily(PUZZLES, dayKey, CHAIN_SALT) || FALLBACK;
}

const EPOCH_KEY = "2026-06-01";
export function chainNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

/* The accept-set for a puzzle. On a plain day it's the common-words dict; on a
   CATEGORY day the day's category word list IS the dictionary (so only real
   category members count, and members outside common-10k are still fair). */
export function acceptSetFor(puzzle) {
  const cat = categoryFor(puzzle);
  return cat ? cat.set : DICT;
}

/* Judge a proposed next word following `prevWord`, given the words already laid
   (`chain` — Set or array) and the day's `puzzle` (for its rule + category).
   Returns "ok" | "badstart" | "notword" | "already" | "badrule". Pure and
   case-insensitive; the last-first link is the previous word's final letter.

   Check order: non-empty → last-first link → in the accept-set → not repeated →
   the day's extra rule. `puzzle` is optional (legacy 3-arg calls still work as a
   plain, ruleless chain against the common dict). */
export function judge(word, prevWord, chain, puzzle) {
  const w = (word || "").toUpperCase();
  const prev = (prevWord || "").toUpperCase();
  if (!w) return "notword";
  const link = prev[prev.length - 1];
  if (w[0] !== link) return "badstart";
  const dict = acceptSetFor(puzzle);
  if (!dict.has(w)) return "notword";
  const arr = chain instanceof Set ? [...chain] : (chain || []);
  if (arr.some((x) => x.toUpperCase() === w)) return "already";
  // The day's extra rule (applied to the chain WITHOUT this word yet).
  if (puzzle && puzzle.rule && puzzle.rule.id !== "plain") {
    const rule = ruleById(puzzle.rule.id);
    if (!rule.test(w, { prevWord: prev, chain: arr.map((x) => x.toUpperCase()) })) {
      return "badrule";
    }
  }
  return "ok";
}

// The letter the next word must start with, given the current chain tail.
export function nextLetter(prevWord) {
  const p = (prevWord || "").toUpperCase();
  return p[p.length - 1] || "";
}

// ── share ────────────────────────────────────────────────────────────────────
// Spoiler-free: links built in 60s vs par, plus the day's twist, e.g.
//   OURCADE Chain #14
//   from RIDGE · 🐾 Animals · 8 links in 60s (par 7) 🔗
export function shareLine(dayKey, links, puzzle) {
  const n = chainNumber(dayKey);
  const beat = links >= puzzle.par ? " 🔗" : "";
  const category = categoryFor(puzzle);
  const cat = category ? ` · ${category.label}` : "";
  return `OURCADE Chain #${n}\nfrom ${puzzle.seed}${cat} · ${links} link${links === 1 ? "" : "s"} in ${RUN_SECONDS}s (par ${puzzle.par})${beat}`;
}
