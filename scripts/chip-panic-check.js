/* ============================================================
   CHIP-PANIC-CHECK — headless verifier for High Card Bust logic
   (src/games/chip-panic/logic.js). Drives the real reducer with
   crafted cards to confirm the ante economy, the three-way lane
   resolution (high card busts+locks; any pair is a 0-point SAVE
   that clears the lane and burns the ante; two pair+ truly scores),
   optional raises, and the Wanted Hands + streak system.

   The drawn `tray` is engine-owned and random, so each test STUBS
   `state.tray = card(...)` before a placeCard; `wanted` is stubbed
   where a deterministic objective is needed. Plain state objects make
   that safe and keep placements deterministic.
   Run:  node scripts/chip-panic-check.js
   ============================================================ */

import {
  newGame, placeCard, useDiscard, burnCard, cycleRaise, canRaise, canPlace, isGameOver,
  pickWanted, streakBonus, completesWanted,
  HAND_POINTS, TIERS, START_CHIPS, ANTE_COST, ANTE_PROFIT, BET_EXPIRY_DRAWS, NO_RAISE, LANES,
} from "../src/games/chip-panic/logic.js";
import { HAND } from "../src/games/poker/handEval.js";

const R = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
const card = (s) => {
  const suit = s.slice(-1);
  const rs = s.slice(0, -1);
  const rank = R[rs] ?? Number(rs);
  return { rank, suit, faceUp: true, id: suit + rank };
};
const cards = (...ss) => ss.map(card);

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) pass++;
  else { fail++; console.error(`  ✗ ${label}: got ${got}, want ${want}`); }
}

const TIER = Object.fromEntries(TIERS.map((t, i) => [t.key, i]));

// Place a stubbed card into lane `l`. Returns { state, result }.
function play(state, cstr, l) {
  return placeCard({ ...state, tray: card(cstr) }, l);
}
// Fill lane `l` with a sequence (stubbing the tray each time). Returns the final
// { state, result } where result is the resolving placement's result.
function fillLane(state, seq, l = 0) {
  let s = state;
  let result = null;
  for (const cstr of seq) {
    const r = play(s, cstr, l);
    s = r.state;
    if (r.result.resolution) result = r.result;
  }
  return { state: s, result };
}
// Disable the wanted objective so resolution tests aren't perturbed by a chance hit.
const noWanted = (g) => ({ ...g, wanted: { hand: -1, name: "", bonusPts: 0, bonusChips: 0 } });

// ── ante: opening a lane costs a chip; an open lane is then free to fill ───────
console.log("Ante / opening lanes:");
{
  const g = noWanted(newGame());
  eq("starts with START_CHIPS", g.chips, START_CHIPS);
  const r1 = play(g, "2C", 0); // opens lane 0
  eq("ante deducted on first card", r1.state.chips, START_CHIPS - ANTE_COST);
  eq("lane marked anted", r1.state.anted[0], true);
  eq("antePaid flag", r1.result.antePaid, true);
  const r2 = play(r1.state, "7D", 0); // second card, already anted
  eq("no further ante on 2nd card", r2.state.chips, START_CHIPS - ANTE_COST);
  eq("2nd card not flagged ante", r2.result.antePaid, false);
}
{
  // 0 chips: empty lane not placeable, but an already-anted lane is.
  let g = noWanted(newGame());
  g = play(g, "2C", 0).state; // open lane 0 (now anted, 1 card)
  g = { ...g, chips: 0 };
  eq("0 chips: anted lane still placeable", canPlace({ ...g, tray: card("3C") }, 0), true);
  eq("0 chips: empty lane NOT placeable", canPlace({ ...g, tray: card("3C") }, 1), false);
}

// ── three-way resolution ──────────────────────────────────────────────────────
console.log("Resolution — bust / save / score:");
{
  // High card → bust + lock, no score, ante lost.
  const g = noWanted(newGame());
  const { state, result } = fillLane(g, ["AD", "JC", "8D", "5S", "2D"]);
  eq("high card busts", result.resolution.bust, true);
  eq("locked", state.locked[0], true);
  eq("no points", result.resolution.points, 0);
  eq("score unchanged", state.score, 0);
  eq("lane NOT cleared", state.lanes[0].length, 5);
  eq("ante lost (down 1)", state.chips, START_CHIPS - ANTE_COST);
}
{
  // Any pair → SAVE: clears the lane, 0 points, ante lost, NO discard refresh.
  let g = noWanted(newGame());
  g = { ...g, discard: false }; // pre-spent, to prove a save does NOT refresh
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "5S", "2D"]); // pair of kings
  eq("pair is a save", result.resolution.saved, true);
  eq("pair does NOT score", result.resolution.scored, false);
  eq("save: 0 points", result.resolution.points, 0);
  eq("save: lane cleared", state.lanes[0].length, 0);
  eq("save: not locked", state.locked[0], false);
  eq("save: discard NOT refreshed", state.discard, false);
  eq("save: ante lost", state.chips, START_CHIPS - ANTE_COST);
}
{
  // Two pair → SCORE: base points, lane clears, discard refreshes, ante returns+profit.
  let g = noWanted(newGame());
  g = { ...g, discard: false };
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "8S", "2D"]); // two pair
  eq("two pair scores", result.resolution.scored, true);
  eq("two pair base points", result.resolution.points, HAND_POINTS[HAND.TWO_PAIR]);
  eq("score updated", state.score, HAND_POINTS[HAND.TWO_PAIR]);
  eq("lane cleared", state.lanes[0].length, 0);
  eq("discard refreshed on score", state.discard, true);
  // chips: -ante on open, +ante+profit on score → net +profit
  eq("ante returned with profit", state.chips, START_CHIPS + ANTE_PROFIT);
}
{
  // Flush scores its base too.
  const g = noWanted(newGame());
  const { result } = fillLane(g, ["AD", "JD", "8D", "5D", "2D"]);
  eq("flush scores base", result.resolution.points, HAND_POINTS[HAND.FLUSH]);
}

// ── raises ────────────────────────────────────────────────────────────────────
console.log("Raises:");
{
  // Open + preview a Red raise; it commits on the next draw (extra chips deducted).
  let g = noWanted(newGame());
  g = play(g, "2C", 0).state; // open lane 0 (anted, 1 card, no made hand)
  g = cycleRaise(g, 0);
  eq("preview is Red", g.raiseSel[0], TIER.red);
  eq("no extra chips reserved yet", g.chips, START_CHIPS - ANTE_COST);
  const r = play(g, "9H", 0); // draw commits the raise
  eq("raise extra deducted on commit", r.state.chips, START_CHIPS - ANTE_COST - TIERS[TIER.red].extra);
  eq("raise committed", r.state.raise[0] != null, true);
  eq("full expiry window", r.state.raise[0].draws, BET_EXPIRY_DRAWS);
}
{
  // Red raise (needs trips+) that lands as trips → wins: mult applied, stake+profit back.
  let g = noWanted(newGame());
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("KS", "8D") : l)), anted: g.anted.map((a, i) => i === 0 ? true : a) };
  g = cycleRaise(g, 0); // Red
  const { state, result } = fillLane(g, ["KH", "KD", "2C"]); // → trips of kings
  const tier = TIERS[TIER.red];
  eq("raise won", result.resolution.raise.won, true);
  eq("score multiplied", result.resolution.points, HAND_POINTS[HAND.THREE] * tier.mult);
}
{
  // Red raise that only makes two pair → fails the raise but still SCORES base.
  let g = noWanted(newGame());
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("KS", "8D") : l)), anted: g.anted.map((a, i) => i === 0 ? true : a) };
  g = cycleRaise(g, 0); // Red needs trips+
  const { state, result } = fillLane(g, ["KH", "8S", "2C"]); // two pair (K,8)
  eq("raise failed-low", result.resolution.raise.won, false);
  eq("still scores base (no mult)", result.resolution.points, HAND_POINTS[HAND.TWO_PAIR]);
  eq("lane cleared", state.lanes[0].length, 0);
}
{
  // Raise expiry: commit, then BET_EXPIRY_DRAWS more draws without resolving → expires.
  let g = noWanted(newGame());
  g = play(g, "2C", 0).state; // open lane 0
  g = cycleRaise(g, 0); // Red
  let expiredHit = null;
  for (let i = 0; i < BET_EXPIRY_DRAWS + 1; i++) {
    // place into OTHER lanes (open them first as needed) to advance draws
    const lane = 1 + (i % 4);
    const r = play(g, "3" + "SHDC"[i % 4], lane);
    g = r.state;
    if (r.result.expired && r.result.expired.length) expiredHit = r.result.expired[0];
  }
  eq("raise expired on lane 0", expiredHit && expiredHit.laneIndex, 0);
  eq("raise cleared after expiry", g.raise[0], null);
}

// ── discard ─────────────────────────────────────────────────────────────────
console.log("Discard:");
{
  let g = noWanted(newGame());
  eq("starts charged", g.discard, true);
  const d = useDiscard(g);
  eq("spent → uncharged", d.state.discard, false);
  eq("discard drew a fresh tray", d.state.tray != null, true);
  // a true score recharges; (save not refreshing is covered above)
  const scored = fillLane(d.state, ["KS", "KH", "8D", "8S", "2D"]); // two pair
  eq("score refreshes discard", scored.state.discard, true);
}

// ── Wanted Hands ──────────────────────────────────────────────────────────────
console.log("Wanted Hands:");
{
  // Exact match completes; bonus pts+chips added; streak +1.
  let g = newGame();
  g = { ...g, wanted: { hand: HAND.TWO_PAIR, name: "Two Pair", bonusPts: 50, bonusChips: 1 }, streak: 0 };
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "8S", "2D"]); // two pair
  eq("wanted hit", result.wanted && result.wanted.hit, true);
  eq("bonus points added", result.wanted.totalPts, 50);
  eq("score = base + bonus", state.score, HAND_POINTS[HAND.TWO_PAIR] + 50);
  eq("streak advanced", state.streak, 1);
  // chips: -ante +ante+profit (score) +bonusChips
  eq("bonus chips added", state.chips, START_CHIPS + ANTE_PROFIT + 1);
}
{
  // Exact-only: a higher hand does NOT complete a lower wanted.
  let g = newGame();
  g = { ...g, wanted: { hand: HAND.TWO_PAIR, name: "Two Pair", bonusPts: 50, bonusChips: 1 }, streak: 0 };
  const { state, result } = fillLane(g, ["KS", "KH", "KD", "8S", "2D"]); // trips, not two pair
  eq("higher hand does NOT complete lower wanted", !!(result.wanted && result.wanted.hit), false);
  eq("streak not advanced", state.streak, 0);
}
{
  // Royal completes a Straight-Flush wanted (special case).
  eq("royal completes straight-flush wanted", completesWanted(HAND.ROYAL_FLUSH, HAND.STRAIGHT_FLUSH), true);
  eq("straight flush does NOT complete royal wanted", completesWanted(HAND.STRAIGHT_FLUSH, HAND.ROYAL_FLUSH), false);
}
{
  // A pair save does NOT complete or advance a wanted, and does not reset streak.
  let g = newGame();
  g = { ...g, wanted: { hand: HAND.TWO_PAIR, name: "Two Pair", bonusPts: 50, bonusChips: 1 }, streak: 2 };
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "5S", "2D"]); // pair
  eq("pair does not hit wanted", !!(result.wanted && result.wanted.hit), false);
  eq("pair save keeps streak", state.streak, 2);
}
{
  // A bust resets the streak.
  let g = newGame();
  g = { ...g, wanted: { hand: HAND.FLUSH, name: "Flush", bonusPts: 175, bonusChips: 3 }, streak: 3 };
  const { state, result } = fillLane(g, ["AD", "JC", "8D", "5S", "2D"]); // high card
  eq("bust resets streak", state.streak, 0);
  eq("streakReset flag", result.streakReset, true);
}
{
  // Milestone at streak 5 unlocks a locked lane.
  let g = newGame();
  g = {
    ...g,
    wanted: { hand: HAND.TWO_PAIR, name: "Two Pair", bonusPts: 50, bonusChips: 1 },
    streak: 4, // completion makes it 5
    locked: [false, false, false, false, true], // lane 4 is locked
  };
  const { state } = fillLane(g, ["KS", "KH", "8D", "8S", "2D"], 0); // two pair → streak 5
  eq("streak reached 5", state.streak, 5);
  eq("a locked lane was unlocked", state.locked[4], false);
}
// streakBonus unit checks
eq("streakBonus 2 → +25% pts", streakBonus(2).ptsMult, 1.25);
eq("streakBonus 3 → +1 chip", streakBonus(3).chipAdd, 1);
eq("streakBonus 4 → +50% pts", streakBonus(4).ptsMult, 1.5);
eq("streakBonus 5 → unlock", streakBonus(5).unlockLane, true);
// pickWanted draws from the streak-appropriate pool. Use rng=0.5 so the jackpot
// roll (rng < 0.08) never fires and the pool index lands mid-pool deterministically.
{
  const mid = () => 0.5;
  const early = [HAND.TWO_PAIR, HAND.THREE];
  const midPool = [HAND.STRAIGHT, HAND.FLUSH, HAND.FULL_HOUSE];
  const latePool = [HAND.FULL_HOUSE, HAND.FOUR];
  eq("streak 0 → early pool", early.includes(pickWanted(0, mid).hand), true);
  eq("streak 1 → early pool", early.includes(pickWanted(1, mid).hand), true);
  eq("streak 2 → mid pool", midPool.includes(pickWanted(2, mid).hand), true);
  eq("streak 4 → late pool", latePool.includes(pickWanted(4, mid).hand), true);
  // jackpot CAN appear past the early game (rng below the chance)
  const jack = () => 0.0; // forces jackpot branch at streak >= 2
  eq("streak 5 jackpot possible", [HAND.STRAIGHT_FLUSH, HAND.ROYAL_FLUSH].includes(pickWanted(5, jack).hand), true);
  // never a pair, across the pools
  let sawPair = false;
  for (let s = 0; s <= 6; s++) for (let k = 0; k < 12; k++) if (pickWanted(s, Math.random).hand === HAND.PAIR) sawPair = true;
  eq("wanted is never a pair", sawPair, false);
}

// ── game over ─────────────────────────────────────────────────────────────────
console.log("Game over:");
{
  // All lanes locked → over.
  let g = noWanted(newGame());
  for (let l = 0; l < LANES; l++) g = fillLane(g, ["AD", "JC", "8D", "5S", "2D"], l).state;
  eq("all locked → over", g.over, true);
  eq("isGameOver agrees", isGameOver(g), true);
}
{
  // 0 chips with only empty unaffordable lanes and no anted lane → stuck → over.
  let g = noWanted(newGame());
  g = { ...g, chips: 0, tray: card("7C") }; // no lane opened, can't afford any ante
  eq("stuck at 0 chips → game over", isGameOver(g), true);
}

// ── One-Deck mode ends on exhaustion ──────────────────────────────────────────
console.log("One-Deck exhaustion:");
{
  let g = noWanted(newGame({ oneDeck: true }));
  let guard = 0;
  while (!g.over && guard < 300) {
    let placed = false;
    for (let l = 0; l < LANES; l++) {
      if (canPlace(g, l)) { g = placeCard(g, l).state; placed = true; break; }
    }
    if (!placed) g = burnCard(g).state;
    guard++;
  }
  eq("one-deck run ends", g.over, true);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
