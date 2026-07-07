/* DICTIONARY DUNGEON — dictionary + rarity (node-pure).

   Wraps the build-time payload (src/data/generated/dungeon-dict.js) behind two
   tiny functions the rest of the game uses:

     isWord(w)      — is this a real, playable word? (ENABLE membership)
     rarityTier(w)  — "common" | "familiar" | "obscure" | "goblin"

   No React, no DOM: shared by the cabinet (DictionaryDungeon.jsx) AND the
   headless validator (scripts/dungeon-check.js), so both agree on exactly which
   words are legal and how rare each one is.

   The heavy Set/Map are built LAZILY on first use so importing this module in a
   check script (or having the cabinet import it before the player types) is
   cheap, and so bundlers can defer the ~1 MB generated payload. */

import {
  DICT_PACKED,
  COMMON_TOP2K,
  COMMON_TOP10K,
} from "../../data/generated/dungeon-dict.js";

let _dict = null; // Set<string> of all playable words (UPPERCASE)
let _rank = null; // Map<string, number> word → 1-based common rank (top-10k only)

function dict() {
  if (!_dict) _dict = new Set(DICT_PACKED.split("\n"));
  return _dict;
}

function rankMap() {
  if (!_rank) {
    _rank = new Map();
    // COMMON_TOP10K is frequency-ordered; rank = index+1. (top2k is its prefix,
    // so one map covers both cutoffs.)
    for (let i = 0; i < COMMON_TOP10K.length; i++) _rank.set(COMMON_TOP10K[i], i + 1);
  }
  return _rank;
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const EXOTIC = new Set(["J", "Q", "X", "Z", "K", "V", "W"]);

/* Is a word real / playable? Case-insensitive. */
export function isWord(word) {
  const w = (word || "").toUpperCase();
  return dict().has(w);
}

/* A weird-looking word: exotic-letter-heavy or vowel-starved. Only meaningful
   for words already known to be obscure; kept in sync with the note in
   gen-dungeon-dict.js. */
export function isGoblinShape(word) {
  const w = (word || "").toUpperCase();
  if (!w) return false;
  let exotic = 0;
  let vowels = 0;
  for (const ch of w) {
    if (EXOTIC.has(ch)) exotic++;
    if (VOWELS.has(ch)) vowels++;
  }
  // Two+ exotic letters, or a 5+ letter word with at most one vowel.
  return exotic >= 2 || (w.length >= 5 && vowels <= 1);
}

/* Rarity tier of a word (frequency-based). Assumes the word is valid; callers
   gate on isWord first. */
export function rarityTier(word) {
  const w = (word || "").toUpperCase();
  const r = rankMap().get(w);
  if (r != null && r <= COMMON_TOP2K.length) return "common";
  if (r != null) return "familiar";
  // Not in the common list at all → obscure, and "goblin" if it also looks weird.
  return isGoblinShape(w) ? "goblin" : "obscure";
}

/* 1-based common-frequency rank (or null if outside the top-10k). Handy for
   tie-breaks / "rarest word" recaps. */
export function commonRank(word) {
  return rankMap().get((word || "").toUpperCase()) ?? null;
}

/* The full playable set, for build-time answer counting in the check script.
   (The cabinet never needs this — it only asks isWord/rarityTier.) */
export function allWords() {
  return dict();
}
