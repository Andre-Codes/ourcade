/* SPELLDOWN — pure day logic.

   No React, no DOM: the same module decides the day's board, grades a guess, and
   computes ranks/share text for BOTH the playable cabinet (Spelldown.jsx) and
   any headless runner (scripts/spelldown-check.js, a future Byte-Badger texter),
   exactly like quarter/logic.js is shared with quarter-text.js. That guarantees
   every surface talks about the SAME daily board.

   The board pool is precomputed at build time (scripts/gen-spelldown.js) — each
   entry is { letters (7 distinct), center (required), required[], accepted[],
   pangrams[], maxWords }. Two tiers: `required` is the up-to-40 common GOAL set
   (ranks / "n/max" / share all measure against it, maxWords = required.length);
   `accepted` is the broader ENABLE pool that judge() credits at play time, so a
   valid-but-obscure word (PRETTIER on EINOPRT·E) is never wrongly rejected. The
   browser never enumerates or dictionary-validates anything; it just checks
   membership in these lists. The solution rotates with rotateDaily so every
   device sees one shared board per local day and the whole pool cycles before
   any repeat. */

import { rotateDaily, dayNumberFromKey, daySeed, seededShuffle } from "../../lib/daily.js";
import BOARDS from "../../data/generated/spelldown.js";

export const MIN_LEN = 4; // shortest word that scores

// A salt unique to this feature so its rotation order is independent of every
// other daily pick (polls, quizzes, Quarter, …). Any stable constant works.
const SPELLDOWN_SALT = 0x5350; // "SP"

// A safe fallback board so the cabinet never hard-crashes if the generated pool
// is somehow empty (mirrors the FALLBACK patterns elsewhere). "AUCTION" set.
const FALLBACK_BOARD = {
  id: "spd-fallback",
  letters: "ACINOTU",
  center: "U",
  required: ["AUCTION", "CAUTION", "COUNT", "UNTO", "UNIT", "AUTO", "TUNA"],
  // Fallback only ever runs if the generated pool is empty; accepted == required
  // here (a valid superset, trivially) so the safety net stays well-formed.
  accepted: ["AUCTION", "CAUTION", "COUNT", "UNTO", "UNIT", "AUTO", "TUNA"],
  pangrams: ["AUCTION", "CAUTION"],
  maxWords: 7,
};

// The board for a given local day key ("YYYY-MM-DD"). Deterministic; same for
// everyone that day.
export function boardFor(dayKey) {
  return rotateDaily(BOARDS, dayKey, SPELLDOWN_SALT) || FALLBACK_BOARD;
}

// A 1-based "Spelldown #" for display/sharing, anchored at the site's launch day
// so the number reads small and human (#1, #2, …) rather than a huge epoch int.
const EPOCH_KEY = "2026-06-01";
export function spelldownNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

// ── scoring ────────────────────────────────────────────────────────────────
// Spelling-Bee-style: 4-letter word = 1 point; any longer word scores its
// length; a pangram earns a +7 bonus on top. (Points are for flavor/share; the
// rank + leaderboard below rank by WORDS FOUND, which is the simpler shared
// number.) Pure given the board.
export function wordScore(word, board) {
  const w = (word || "").toUpperCase();
  if (w.length < MIN_LEN) return 0;
  const base = w.length === 4 ? 1 : w.length;
  const isPangram = board.pangrams.includes(w);
  return base + (isPangram ? 7 : 0);
}

// Why a typed word is or isn't accepted — the cabinet turns this into a toast.
// Returns one of: "ok" | "short" | "badletter" | "nocenter" | "notword" |
// "already". `found` is the Set/array of words already accepted this session.
export function judge(word, board, found) {
  const w = (word || "").toUpperCase();
  if (w.length < MIN_LEN) return "short";
  const letters = new Set(board.letters.split(""));
  for (const ch of w) if (!letters.has(ch)) return "badletter";
  if (!w.includes(board.center)) return "nocenter";
  const has = found instanceof Set ? found.has(w) : (found || []).includes(w);
  if (has) return "already";
  // Membership in the ACCEPTED pool IS the dictionary check — the broad ENABLE
  // list, not just the common goal set, so a valid-but-uncommon word counts.
  if (!board.accepted.includes(w)) return "notword";
  return "ok";
}

export function isPangram(word, board) {
  return board.pangrams.includes((word || "").toUpperCase());
}

// ── ranks ──────────────────────────────────────────────────────────────────
// Ranks are a PERCENT of the day's max word count, so a board's obscure tail is
// never required to reach the top tier. Thresholds loosely follow the familiar
// Spelling-Bee ladder. `pct` is the fraction (0..1) of words found.
const RANKS = [
  { id: "beginner", label: "Beginner", at: 0.0 },
  { id: "moving-up", label: "Moving Up", at: 0.05 },
  { id: "good", label: "Good", at: 0.2 },
  { id: "solid", label: "Solid", at: 0.3 },
  { id: "great", label: "Great", at: 0.45 },
  { id: "amazing", label: "Amazing", at: 0.6 },
  { id: "genius", label: "Genius", at: 0.8 },
];

// The rank for a given found-count on a board. Returns the rank object plus the
// fraction and the next rank (for the progress bar). At/after the top threshold
// the next rank is null. NOTE: foundCount can exceed maxWords now (a player may
// find accepted-but-not-required words), so pct is clamped to 1.
export function rankFor(foundCount, board) {
  const max = Math.max(1, board.maxWords);
  const pct = Math.min(1, foundCount / max);
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (pct >= RANKS[i].at) idx = i;
  return {
    ...RANKS[idx],
    index: idx,
    count: RANKS.length,
    pct,
    next: RANKS[idx + 1] || null,
  };
}

export const TOP_RANK = RANKS[RANKS.length - 1]; // "Genius"

// ── share ──────────────────────────────────────────────────────────────────
// A compact, no-spoiler share line (no words revealed), e.g.
//   OURCADE Spelldown #14  ▘ 28/41 — Great 🐝
// The 🐝 only appears if the player found a pangram.
export function shareLine(dayKey, foundCount, board, foundPangram) {
  const n = spelldownNumber(dayKey);
  const rank = rankFor(foundCount, board);
  const bee = foundPangram ? " 🐝" : "";
  // Clamp to the goal set so a share never reads "43/40" when extra accepted
  // words push the count past the required max.
  const shown = Math.min(foundCount, board.maxWords);
  return `OURCADE Spelldown #${n}  ${shown}/${board.maxWords} — ${rank.label}${bee}`;
}

// ── prior-day reveal ─────────────────────────────────────────────────────────
// One possible answer set for a board: a DETERMINISTIC per-day sample of up to
// 40 words, COMMON-WEIGHTED so the reveal reads friendly (recognizable words),
// not a wall of obscure ENABLE tail. We fill from the curated `required` (common)
// set first, then top up from the extra `accepted` words only if needed to reach
// 40 — each layer seed-shuffled so the sample still varies day to day but always
// leads with words a player would actually know. Seeded by the day key so it's
// identical across reloads and devices (same idiom as rotateDaily). Pure given
// (board, dayKey). Returned alphabetically for a tidy reveal.
const REVEAL_SIZE = 40;
export function revealWords(board, dayKey) {
  const seed = daySeed(`${dayKey}|spd-reveal`);
  const required = board.required || [];
  const requiredSet = new Set(required);
  const extras = (board.accepted || []).filter((w) => !requiredSet.has(w));
  // Common words first, then obscure extras only to reach the target size.
  const picked = [
    ...seededShuffle(required, seed),
    ...seededShuffle(extras, seed ^ 0x9e3779b9),
  ].slice(0, REVEAL_SIZE);
  return picked.sort();
}
