/* WORD LADDER — the one-letter-change word graph, as pure helpers.

   No React, no DOM, no Node APIs: this module is imported by BOTH build-time
   generators (scripts/gen-solve-puzzles.js for the static Solve-This minis,
   scripts/gen-laddergram.js for the daily cabinet) AND the browser cabinet
   (src/games/laddergram/logic.js) so the SAME hop rule and BFS define a ladder
   everywhere. Same "shared engine" idea as spelldown/logic.js / quarter/logic.js.

   A "hop" is a single-letter substitution between two same-length words; a
   "ladder" is a chain of hops from START to END where every rung is a real word
   (membership in whatever `dict` Set the caller passes — ENABLE for the exhaustive
   minis, the curated common-words set for the friendly daily cabinet). */

// Are `a` and `b` real one-letter-substitution neighbors (same length, differ in
// exactly one position)? Case-insensitive; the caller owns dictionary membership.
export function isOneAway(a, b) {
  a = (a || "").toUpperCase();
  b = (b || "").toUpperCase();
  if (a.length !== b.length || a === b) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && ++diff > 1) return false;
  }
  return diff === 1;
}

// Shortest ladder from `start` to `end` (inclusive), or null if none exists whose
// total length is <= maxLen. Standard BFS over the one-letter-change graph, so the
// first path that reaches `end` is guaranteed shortest. `dict` is a Set of
// UPPERCASE words that bounds which rungs are legal.
export function wordLadder(start, end, dict, maxLen) {
  start = (start || "").toUpperCase();
  end = (end || "").toUpperCase();
  if (start.length !== end.length || !dict.has(start) || !dict.has(end)) return null;
  if (start === end) return null;

  const queue = [[start]];
  const seen = new Set([start]);
  while (queue.length) {
    const pathArr = queue.shift();
    if (pathArr.length > maxLen) return null; // BFS → first hit is shortest
    const last = pathArr[pathArr.length - 1];
    for (let i = 0; i < last.length; i++) {
      for (let c = 65; c <= 90; c++) {
        const ch = String.fromCharCode(c);
        if (ch === last[i]) continue;
        const next = last.slice(0, i) + ch + last.slice(i + 1);
        if (!dict.has(next) || seen.has(next)) continue;
        if (next === end) return [...pathArr, next];
        seen.add(next);
        queue.push([...pathArr, next]);
      }
    }
  }
  return null;
}
