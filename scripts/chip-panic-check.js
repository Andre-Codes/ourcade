/* ============================================================
   CHIP-PANIC-CHECK — headless verifier for Chip Panic logic
   (src/games/chip-panic/logic.js). Drives the real reducer with
   crafted cards to confirm: a full column scores + clears by poker
   hand, a chipped paying column multiplies, a chipped whiff costs a
   life, and a forced overflow ends the game.
   Run:  node scripts/chip-panic-check.js
   ============================================================ */

import {
  newGame, placeCard, toggleChip, useDiscard, columnFull, levelFor, fallIntervalMs,
  HAND_POINTS, CHIP_MULTIPLIER, ROWS,
} from "../src/games/chip-panic/logic.js";
import { HAND } from "../src/games/poker/handEval.js";

const R = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
const card = (s) => {
  const suit = s.slice(-1);
  const rs = s.slice(0, -1);
  const rank = R[rs] ?? Number(rs);
  return { rank, suit, faceUp: true, id: suit + rank };
};

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) pass++;
  else { fail++; console.error(`  ✗ ${label}: got ${got}, want ${want}`); }
}

// Drop a sequence of cards into the SAME column 0 and return the final result.
function fillCol0(state, cards, { chip = false } = {}) {
  let s = state;
  if (chip) s = toggleChip(s, 0);
  let event = null;
  for (const cstr of cards) {
    const r = placeCard(s, 0, card(cstr));
    s = r.state;
    if (r.event) event = r.event;
  }
  return { state: s, event };
}

// ── a full column of a flush scores FLUSH points and clears ───────────────────
console.log("Column clear + scoring:");
{
  const g = newGame(() => 0); // rng unused for crafted placements
  const { state, event } = fillCol0(g, ["AD", "JD", "8D", "5D", "2D"]);
  eq("flush detected", event && event.hand.rank, HAND.FLUSH);
  eq("flush points", event && event.points, HAND_POINTS[HAND.FLUSH]);
  eq("column cleared", state.cols[0].length, 0);
  eq("cleared counter", state.cleared, 1);
  eq("not over", state.over, false);
}

// ── un-chipped junk (high card) does NOT clear — the lane locks dead ───────────
console.log("Dead lanes (High Card never clears):");
{
  const g = newGame(() => 0);
  const { state, event } = fillCol0(g, ["AD", "JC", "8D", "5S", "2D"]); // high card
  eq("high card", event && event.hand.rank, HAND.HIGH_CARD);
  eq("dead event flag", event && event.dead, true);
  eq("zero points", event && event.points, 0);
  eq("lane NOT cleared", state.cols[0].length, ROWS);
  eq("lane marked dead", state.dead[0], true);
  eq("cleared counter unchanged", state.cleared, 0);
  eq("lives intact (un-chipped junk)", state.lives, 3);
}

// ── chipped PAYING column multiplies the score ────────────────────────────────
console.log("Chip bets:");
{
  const g = newGame(() => 0);
  const { state, event } = fillCol0(g, ["KS", "KH", "8D", "5S", "2D"], { chip: true }); // pair
  eq("pair detected", event && event.hand.rank, HAND.PAIR);
  eq("chipped flag", event && event.chipped, true);
  eq("paying flag", event && event.paying, true);
  eq("multiplied points", event && event.points, HAND_POINTS[HAND.PAIR] * CHIP_MULTIPLIER);
  eq("score multiplied", state.score, HAND_POINTS[HAND.PAIR] * CHIP_MULTIPLIER);
  eq("chip spent", state.chips[0], false);
  eq("no life lost", state.lives, 3);
}

// ── chipped WHIFF (high card) costs a life AND locks the lane dead ─────────────
{
  const g = newGame(() => 0);
  const { state, event } = fillCol0(g, ["AD", "JC", "8D", "5S", "2D"], { chip: true }); // junk
  eq("whiff not paying", event && event.paying, false);
  eq("whiff lost life", event && event.lostLife, true);
  eq("whiff lane dead", event && event.dead, true);
  eq("whiff lane not cleared", state.cols[0].length, ROWS);
  eq("lives decremented", state.lives, 2);
}

// ── discard: charged at start, spent by useDiscard, recharged by a clear ───────
console.log("Discard charge:");
{
  let g = newGame(() => 0);
  eq("starts charged", g.discard, true);
  g = useDiscard(g);
  eq("spent → uncharged", g.discard, false);
  eq("spending again is a no-op", useDiscard(g).discard, false);
  // a paying clear recharges it
  const { state } = fillCol0(g, ["KS", "KH", "8D", "5S", "2D"]); // pair
  eq("clear recharges discard", state.discard, true);
}

// ── a dead lane reads as full → overflow if a card targets it ─────────────────
{
  const g = newGame(() => 0);
  const { state } = fillCol0(g, ["AD", "JC", "8D", "5S", "2D"]); // dead lane 0
  eq("dead lane is full", columnFull(state.cols[0]), true);
  const r = placeCard(state, 0, card("7C")); // no room → overflow
  eq("drop on dead lane → over", r.state.over, true);
}

// ── overflow on a full column → game over ─────────────────────────────────────
console.log("Overflow:");
{
  // Fill a column with a hand that pays so it clears, then we re-fill and push a
  // 6th into a deliberately-full column by NOT clearing: use a manual full state.
  let g = newGame(() => 0);
  // Manually stuff column 0 to ROWS without triggering the clear path by poking
  // the reducer: place 4, then check the 5th clears; instead force a full col.
  g = { ...g, cols: g.cols.map((c, i) => (i === 0 ? [card("2C"), card("3C"), card("4C"), card("5C"), card("6C")] : c)) };
  eq("column is full", columnFull(g.cols[0]), true);
  const r = placeCard(g, 0, card("7C")); // no room → overflow
  eq("overflow → over", r.state.over, true);
}

// ── level + speed ramp ────────────────────────────────────────────────────────
console.log("Level/speed:");
eq("level at 0 cleared", levelFor(0), 1);
eq("level at 5 cleared", levelFor(5), 2);
eq("speed decreases with level", fallIntervalMs(0) > fallIntervalMs(25), true);
eq("speed floored", fallIntervalMs(1000) >= 140, true);

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
