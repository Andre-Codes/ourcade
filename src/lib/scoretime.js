/* ─────────────────────────────────────────────────────────────────────────
   SCORETIME — fold "how fast" into a single leaderboard number.

   The Arcade Score Standard stores ONE integer per game and sorts it by the
   registry's `dir` ("asc" = lower better, "desc" = higher better). To rank by a
   primary skill metric AND break ties by speed, we pack both into that one
   integer: the skill value is the high-order part, elapsed seconds the low.

     • asc  (fewer-is-better, e.g. Laddergram steps): faster ADDS a little, so
       equal skill → fewer seconds sorts first.
     • desc (more-is-better, e.g. Chain length): faster is stored as
       (CAP − seconds), so equal skill → fewer seconds sorts higher.

   Seconds are clamped to TIME_CAP; anyone slower than that just ties on the
   time component (it's only a tiebreaker). Pure math — no window/DOM — so the
   browser-only registry (games.js) can import the `format` decoders freely.
   ───────────────────────────────────────────────────────────────────────── */

export const TIME_CAP = 5999; // 99:59 — beyond this the clock stops mattering
const BASE = TIME_CAP + 1; // 6000 — one slot per representable second

export function clampSecs(secs) {
  const s = Math.floor(Number(secs) || 0);
  return s < 0 ? 0 : s > TIME_CAP ? TIME_CAP : s;
}

// Pack (skill value, seconds) → one integer that sorts correctly for `dir`.
export function encodeScore(value, secs, dir) {
  const v = Math.max(0, Math.floor(Number(value) || 0));
  const t = clampSecs(secs);
  return dir === "asc" ? v * BASE + t : v * BASE + (TIME_CAP - t);
}

// Unpack an encoded score back into { value, secs }.
export function decodeScore(code, dir) {
  const c = Math.max(0, Math.floor(Number(code) || 0));
  const value = Math.floor(c / BASE);
  const rem = c % BASE;
  return { value, secs: dir === "asc" ? rem : TIME_CAP - rem };
}

// Seconds → "m:ss" (minutes uncapped, e.g. "0:07", "1:42", "12:03").
export function fmtClock(secs) {
  const s = clampSecs(secs);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
