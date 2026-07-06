/* CHAIN — pure day logic.

   No React, no DOM: picks the day's seed, judges the next word, and formats the
   share line for BOTH the cabinet (Chain.jsx) and any headless check. Same
   shared-truth pattern as spelldown/logic.js.

   Puzzles are precomputed at build time (scripts/gen-chain.js): each is
   { id, seed, par, sample }. The rule is last-first: each new word must START with
   the LAST letter of the previous word, be a common word (shipped common-words
   dict), and not repeat one already used. `par` is a target chain length. */

import { rotateDaily, dayNumberFromKey } from "../../lib/daily.js";
import PUZZLES from "../../data/generated/chain.js";
import COMMON_WORDS from "../../data/generated/common-words.js";

const DICT = new Set(COMMON_WORDS);

// "Ch" → 0x4368.
const CHAIN_SALT = 0x4368;

const FALLBACK = { id: "chain-fallback", seed: "APPLE", par: 6, sample: ["APPLE"] };

export function puzzleFor(dayKey) {
  return rotateDaily(PUZZLES, dayKey, CHAIN_SALT) || FALLBACK;
}

const EPOCH_KEY = "2026-06-01";
export function chainNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

/* Judge a proposed next word following `prevWord`, given the words already used
   (`usedSet` — Set or array). Returns "ok" | "badstart" | "notword" | "already".
   Pure. Case-insensitive; the last-first link is the previous word's final letter. */
export function judge(word, prevWord, usedSet) {
  const w = (word || "").toUpperCase();
  const prev = (prevWord || "").toUpperCase();
  if (!w) return "notword";
  const link = prev[prev.length - 1];
  if (w[0] !== link) return "badstart";
  if (!DICT.has(w)) return "notword";
  const has = usedSet instanceof Set ? usedSet.has(w) : (usedSet || []).includes(w);
  if (has) return "already";
  return "ok";
}

// The letter the next word must start with, given the current chain tail.
export function nextLetter(prevWord) {
  const p = (prevWord || "").toUpperCase();
  return p[p.length - 1] || "";
}

// ── share ────────────────────────────────────────────────────────────────────
// Spoiler-free: chain length vs par, e.g.
//   OURCADE Chain #14  from RIDGE  8 links (par 7) 🔗
export function shareLine(dayKey, links, puzzle) {
  const n = chainNumber(dayKey);
  const beat = links >= puzzle.par ? " 🔗" : "";
  return `OURCADE Chain #${n}  from ${puzzle.seed}  ${links} link${links === 1 ? "" : "s"} (par ${puzzle.par})${beat}`;
}
