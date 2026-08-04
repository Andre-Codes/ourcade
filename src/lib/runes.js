/* RUNES — a hand-drawn A–Z rune alphabet, as stroke data.

   Used by the Word Sprint rack (src/components/SolvePuzzle.jsx): the seven
   letters show as runes until you press start, so you can't pre-solve the board
   before the clock is running.

   Drawn rather than typed on purpose. The Unicode Runic block (U+16A0–16FF) has
   no font on iOS and patchy coverage on Android, so ᚠᚢᚦᚨ would render as tofu
   boxes on a lot of phones — the one thing worse than showing the letters.

   Shapes are Elder Futhark forms where a letter has one (fehu for F, ansuz for
   A, gebo for G…) and a plausible variant where it doesn't (C/Q/V/X/Y). They're
   decorative: nothing reads them back, they only have to look carved and stay
   distinct from each other.

   Each entry is a list of polylines; each polyline is a list of [x, y] points on
   a 12 × 20 grid, origin top-left, inset ~1.5 units so a 1.5-wide stroke doesn't
   clip at the viewBox edge. Node-pure data — no React, no DOM. */

export const RUNES = {
  A: [[[3.5, 1.5], [3.5, 18.5]], [[3.5, 3], [10, 7]], [[3.5, 9], [10, 13]]],
  B: [[[3.5, 1.5], [3.5, 18.5]], [[3.5, 2], [9.5, 5.5], [3.5, 9.5]], [[3.5, 10], [9.5, 14], [3.5, 18]]],
  C: [[[2, 2], [9.5, 10], [2, 18]]],
  D: [[[2, 2], [2, 18]], [[10, 2], [10, 18]], [[2, 2], [10, 18]], [[2, 18], [10, 2]]],
  E: [[[2, 18.5], [2, 3]], [[10, 18.5], [10, 3]], [[2, 3], [6, 8], [10, 3]]],
  F: [[[3.5, 1.5], [3.5, 18.5]], [[3.5, 5], [10, 1.8]], [[3.5, 10.5], [10, 7.3]]],
  G: [[[2, 2], [10, 18]], [[10, 2], [2, 18]]],
  H: [[[3, 1.5], [3, 18.5]], [[10, 1.5], [10, 18.5]], [[3, 7], [10, 12]]],
  I: [[[6, 1.5], [6, 18.5]]],
  J: [[[3, 2], [8, 6], [3, 10]], [[9, 10], [4, 14], [9, 18]]],
  K: [[[10, 2], [3, 10], [10, 18]]],
  L: [[[3.5, 1.5], [3.5, 18.5]], [[3.5, 2.5], [9.5, 7.5]]],
  M: [[[2, 1.5], [2, 18.5]], [[10, 1.5], [10, 18.5]], [[2, 3], [10, 10]], [[10, 3], [2, 10]]],
  N: [[[6, 1.5], [6, 18.5]], [[2, 13], [10, 7]]],
  O: [[[6, 1.5], [10.5, 6.5], [6, 11.5], [1.5, 6.5], [6, 1.5]], [[4.2, 9.5], [1.5, 18.5]], [[7.8, 9.5], [10.5, 18.5]]],
  P: [[[9.5, 1.5], [3.5, 4.5], [3.5, 15.5], [9.5, 18.5]]],
  Q: [[[6, 1.5], [10.5, 10], [6, 18.5], [1.5, 10], [6, 1.5]]],
  R: [[[3.5, 1.5], [3.5, 18.5]], [[3.5, 1.5], [10, 5], [3.5, 9.5], [10, 18.5]]],
  S: [[[9.5, 1.5], [3.5, 6.5], [9.5, 12], [3.5, 18.5]]],
  T: [[[6, 18.5], [6, 4]], [[2, 9], [6, 4], [10, 9]]],
  U: [[[3, 18.5], [3, 3], [10, 7.5], [10, 18.5]]],
  V: [[[3.5, 1.5], [3.5, 18.5]], [[3.5, 9], [10, 13], [3.5, 17.5]]],
  W: [[[3.5, 1.5], [3.5, 18.5]], [[3.5, 2.5], [10, 6.5], [3.5, 10.5]]],
  X: [[[6, 1.5], [6, 18.5]], [[1.5, 18.5], [6, 11], [10.5, 18.5]]],
  Y: [[[5, 3.5], [5, 16.5]], [[5, 3.5], [9.5, 1.5]], [[5, 16.5], [1.5, 18.5]]],
  Z: [[[6, 18.5], [6, 3]], [[1.5, 3], [6, 9], [10.5, 3]]],
};
