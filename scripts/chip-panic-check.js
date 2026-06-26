/* ============================================================
   CHIP-PANIC-CHECK — headless verifier for High Card Bust logic
   (src/games/chip-panic/logic.js). Drives the real reducer with
   crafted cards to confirm the doc's rules: a full lane scores +
   clears on pair+, busts + locks on high card, the run ends when
   all five lanes are locked, the discard refreshes on a score (not
   a bust), and the tiered chip bets commit on the next draw, win/
   fail/expire correctly, and respect eligibility.

   The drawn `tray` card is engine-owned and random, so each test
   STUBS `state.tray = card(...)` right before a placeCard — plain
   state objects make that safe and keeps placements deterministic.
   Run:  node scripts/chip-panic-check.js
   ============================================================ */

import {
  newGame, placeCard, useDiscard, burnCard, cycleBet, canBet, canPlace, isGameOver,
  HAND_POINTS, BET_TIERS, START_CHIPS, BET_EXPIRY_DRAWS, NO_BET, LANES,
} from "../src/games/chip-panic/logic.js";
import { HAND, bestMadeHand } from "../src/games/poker/handEval.js";

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

const TIER = Object.fromEntries(BET_TIERS.map((t, i) => [t.key, i]));

// Stub the tray then place into lane `l`. Returns { state, result }.
function play(state, cstr, l) {
  const s = { ...state, tray: card(cstr) };
  return placeCard(s, l);
}
// Fill lane `l` with a sequence of cards (stubbing the tray each time) and return
// the final { state, result-of-the-resolving-placement }.
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

// ── bestMadeHand (the bet-eligibility helper) ─────────────────────────────────
console.log("bestMadeHand:");
eq("empty → high card", bestMadeHand([]), HAND.HIGH_CARD);
eq("single → high card", bestMadeHand(cards("7C")), HAND.HIGH_CARD);
eq("pair", bestMadeHand(cards("7C", "7D")), HAND.PAIR);
eq("pair + kicker", bestMadeHand(cards("9C", "9D", "KS")), HAND.PAIR);
eq("trips", bestMadeHand(cards("5C", "5D", "5H")), HAND.THREE);
eq("draw is not a made hand", bestMadeHand(cards("8C", "9C", "TC")), HAND.HIGH_CARD);
eq("three singles → high card", bestMadeHand(cards("2S", "6H", "QD")), HAND.HIGH_CARD);
eq("quads", bestMadeHand(cards("7C", "7D", "7H", "7S")), HAND.FOUR);
eq("full house", bestMadeHand(cards("KC", "KD", "KH", "2S", "2D")), HAND.FULL_HOUSE);

// ── a full lane that makes a flush scores + clears ────────────────────────────
console.log("Lane clear + scoring:");
{
  const g = newGame();
  const { state, result } = fillLane(g, ["AD", "JD", "8D", "5D", "2D"]);
  eq("flush detected", result.resolution.hand.rank, HAND.FLUSH);
  eq("flush points", result.resolution.points, HAND_POINTS[HAND.FLUSH]);
  eq("score updated", state.score, HAND_POINTS[HAND.FLUSH]);
  eq("lane cleared", state.lanes[0].length, 0);
  eq("lane not locked", state.locked[0], false);
}
{
  const g = newGame();
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "5S", "2D"]); // pair
  eq("pair scores base", result.resolution.points, HAND_POINTS[HAND.PAIR]);
  eq("pair clears lane", state.lanes[0].length, 0);
  eq("no lives field exists", "lives" in state, false);
}

// ── a full lane of junk busts + locks (no clear, no score) ────────────────────
console.log("High Card bust + lock:");
{
  const g = newGame();
  const { state, result } = fillLane(g, ["AD", "JC", "8D", "5S", "2D"]); // high card
  eq("high card", result.resolution.hand.rank, HAND.HIGH_CARD);
  eq("busted flag", result.resolution.busted, true);
  eq("zero points", result.resolution.points, 0);
  eq("score unchanged", state.score, 0);
  eq("lane NOT cleared", state.lanes[0].length, 5);
  eq("lane locked", state.locked[0], true);
}

// ── the run ends when all five lanes are locked ───────────────────────────────
console.log("Game over when all locked:");
{
  let g = newGame();
  for (let l = 0; l < LANES; l++) {
    const r = fillLane(g, ["AD", "JC", "8D", "5S", "2D"], l); // junk → lock lane l
    g = r.state;
  }
  eq("all five locked", g.locked.every(Boolean), true);
  eq("isGameOver true", isGameOver(g), true);
  eq("state.over set", g.over, true);
}

// ── discard: charged at start, spent, refreshed by a score (not a bust) ───────
console.log("Discard:");
{
  let g = newGame();
  eq("starts charged", g.discard, true);
  const d = useDiscard(g);
  eq("spent → uncharged", d.state.discard, false);
  eq("discard drew a fresh tray", d.state.tray != null, true);
  eq("spending again is a no-op", useDiscard(d.state).state.discard, false);
  // a scoring hand recharges it…
  const scored = fillLane(d.state, ["KS", "KH", "8D", "5S", "2D"]); // pair
  eq("score refreshes discard", scored.state.discard, true);
  // …but a bust does not.
  let g2 = useDiscard(newGame()).state;
  const busted = fillLane(g2, ["AD", "JC", "8D", "5S", "2D"]); // high card
  eq("bust does NOT refresh discard", busted.state.discard, false);
}

// ── bet commitment timing (preview is free; commit on the next draw) ──────────
console.log("Bet commit timing:");
{
  let g = newGame();
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("2C", "7D") : l)) }; // eligible
  g = cycleBet(g, 0);
  eq("preview is Blue", g.betSel[0], TIER.blue);
  eq("no chips reserved yet", g.chips, START_CHIPS);
  eq("not committed yet", g.bet[0], null);
  // any draw commits it — place an unrelated card into lane 0
  const r = play(g, "9H", 0);
  eq("chips spent on commit", r.state.chips, START_CHIPS - BET_TIERS[TIER.blue].cost);
  eq("bet committed", r.state.bet[0] != null, true);
  eq("full expiry window", r.state.bet[0].draws, BET_EXPIRY_DRAWS);
}

// ── successful bet: multiply score + return stake + profit ────────────────────
console.log("Bet win / fail-low / fail-bust:");
{
  let g = newGame();
  // Seed a NO-hand draw (so it's bettable), bet Blue, then complete it to a pair.
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("KS", "8D") : l)) };
  g = cycleBet(g, 0); // Blue (pair+)
  const { state, result } = fillLane(g, ["KH", "5S", "2D"]); // → pair of kings
  const tier = BET_TIERS[TIER.blue];
  eq("bet won", result.resolution.bet.won, true);
  eq("score multiplied", result.resolution.points, HAND_POINTS[HAND.PAIR] * tier.mult);
  eq("chips back = stake+profit", result.resolution.chipsReturned, tier.cost + tier.profit);
  // net chip change across the run: -cost at commit, +cost+profit on win = +profit
  eq("net chips = +profit", state.chips, START_CHIPS + tier.profit);
  eq("lane cleared on win", state.lanes[0].length, 0);
  eq("discard refreshed on win", state.discard, true);
}
{
  // Gold needs Straight+; resolving as a mere pair fails the bet but still scores.
  let g = newGame();
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("KS", "8D") : l)) };
  // cycle up to Gold
  while (g.betSel[0] !== TIER.gold) g = cycleBet(g, 0);
  eq("previewing Gold", g.betSel[0], TIER.gold);
  const { state, result } = fillLane(g, ["KH", "5S", "2D"]); // pair, below Straight
  const tier = BET_TIERS[TIER.gold];
  eq("bet failed-low", result.resolution.bet.won, false);
  eq("still scores base (no mult)", result.resolution.points, HAND_POINTS[HAND.PAIR]);
  eq("stake forfeited", result.resolution.chipsLost, tier.cost);
  eq("net chips = -cost", state.chips, START_CHIPS - tier.cost);
  eq("lane cleared (still made a hand)", state.lanes[0].length, 0);
  eq("discard refreshed (scored)", state.discard, true);
}
{
  // Blue bet that busts as high card: no score, lane locks, stake lost, no refresh.
  let g = newGame();
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("AD", "JC") : l)) };
  g = cycleBet(g, 0); // Blue
  const { state, result } = fillLane(g, ["8D", "5S", "2D"]); // high card
  eq("bet failed on bust", result.resolution.bet.won, false);
  eq("no points", result.resolution.points, 0);
  eq("stake lost", result.resolution.chipsLost, BET_TIERS[TIER.blue].cost);
  eq("lane locked", state.locked[0], true);
  eq("net chips = -1", state.chips, START_CHIPS - 1);
  // (discard-not-refreshed-on-bust is asserted in the Discard section above)
}

// ── bet expiry: must land within BET_EXPIRY_DRAWS draws ───────────────────────
console.log("Bet expiry:");
{
  let g = newGame();
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("2C", "7D") : l)) };
  g = cycleBet(g, 0); // Blue
  // draw #1 commits it (window = BET_EXPIRY_DRAWS); then we need BET_EXPIRY_DRAWS
  // MORE draws without resolving lane 0 to expire it. Place into other lanes.
  let expiredHit = null;
  for (let i = 0; i < BET_EXPIRY_DRAWS + 1; i++) {
    const lane = 1 + (i % 4); // never lane 0
    const r = play(g, "3" + "SHDC"[i % 4], lane);
    g = r.state;
    if (r.result.expired && r.result.expired.length) expiredHit = r.result.expired[0];
  }
  eq("bet expired", expiredHit && expiredHit.laneIndex, 0);
  eq("bet cleared after expiry", g.bet[0], null);
  eq("no refund on expiry", g.chips, START_CHIPS - BET_TIERS[TIER.blue].cost);
}
{
  // A bet keeps its FULL window: it is not decremented by the draw that commits it.
  let g = newGame();
  g = { ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards("2C", "7D") : l)) };
  g = cycleBet(g, 0);
  const r = play(g, "9H", 1); // this draw commits
  eq("committed at full window", r.state.bet[0].draws, BET_EXPIRY_DRAWS);
}

// ── canBet eligibility + cycleBet affordability skipping ──────────────────────
console.log("Eligibility:");
{
  const g = newGame();
  const withLane = (cs) => ({ ...g, lanes: g.lanes.map((l, i) => (i === 0 ? cards(...cs) : l)) });
  eq("empty lane: no blind bet", canBet(withLane([]), 0, TIER.blue), false);
  eq("1-card lane: bettable", canBet(withLane(["2C"]), 0, TIER.blue), true);
  eq("draw lane: bettable", canBet(withLane(["8C", "9C", "TC"]), 0, TIER.blue), true);
  eq("4-card lane: too many", canBet(withLane(["2C", "3D", "4H", "5S"]), 0, TIER.blue), false);
  eq("made-hand lane: not bettable", canBet(withLane(["7C", "7D"]), 0, TIER.blue), false);
  // locked lane
  const locked = { ...g, locked: g.locked.map((v, i) => i === 0) };
  eq("locked lane: not bettable", canBet({ ...locked, lanes: locked.lanes.map((l, i) => (i === 0 ? cards("2C") : l)) }, 0, TIER.blue), false);
  // poor player
  const poor = { ...withLane(["2C"]), chips: 1 };
  eq("can afford Blue (cost 1)", canBet(poor, 0, TIER.blue), true);
  eq("cannot afford Red (cost 2)", canBet(poor, 0, TIER.red), false);
  // cycleBet skips unaffordable tiers: chips=1 → none → Blue → none
  let p = cycleBet(poor, 0);
  eq("cycle to Blue", p.betSel[0], TIER.blue);
  p = cycleBet(p, 0);
  eq("cycle skips to No Bet (can't afford Red+)", p.betSel[0], NO_BET);
}

// ── One-Deck mode ends on deck exhaustion ─────────────────────────────────────
console.log("One-Deck exhaustion:");
{
  let g = newGame({ oneDeck: true });
  eq("one-deck flag set", g.oneDeck, true);
  // Drain the real deck (no tray stubbing): place into the first lane that can
  // take a card; if every lane is locked/full, burn the tray to keep drawing.
  // Either path eventually empties the 52-card deck and ends the run.
  let guard = 0;
  while (!g.over && guard < 200) {
    let placed = false;
    for (let l = 0; l < LANES; l++) {
      if (canPlace(g, l)) { g = placeCard(g, l).state; placed = true; break; }
    }
    if (!placed) g = burnCard(g).state;
    guard++;
  }
  eq("one-deck run ends", g.over, true);
  eq("isGameOver agrees", isGameOver(g), true);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
