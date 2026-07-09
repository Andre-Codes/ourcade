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
  pickWanted, streakBonus, completesWanted, anteFor, currentAnte, blackjackTotal,
  HAND_POINTS, TIERS, START_CHIPS, BASE_ANTE, ANTE_PROFIT, ANTE_STEP, SCORE_HANDS_PER_ANTE,
  WANTED_HITS_PER_ANTE, BET_EXPIRY_DRAWS, NO_RAISE, LANES,
  WANTED_CONDS, WANTED_COND_REWARDS, JACKPOT_HANDS, JACKPOT_REWARDS,
  serializeGame, hydrateGame, SAVE_VERSION,
  ANTE_PROFIT_BY_HAND, MIN_ANTE_PROFIT, anteProfitFor, laneStake,
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
const noWanted = (g) => ({ ...g, wanted: { kind: "hand", hand: -1, name: "", bonusPts: 0, bonusChips: 0 } });
// A hand-wanted stub.
const wantHand = (hand, bonusPts = 50, bonusChips = 1) => ({ kind: "hand", hand, name: "", bonusPts, bonusChips });
// A condition-wanted stub.
const wantCond = (cond) => ({
  kind: "cond", cond, name: WANTED_CONDS[cond].name,
  bonusPts: WANTED_COND_REWARDS[cond].pts, bonusChips: WANTED_COND_REWARDS[cond].chips,
});

// ── ante: opening a lane costs a chip; an open lane is then free to fill ───────
console.log("Ante / opening lanes:");
{
  const g = noWanted(newGame());
  eq("starts with START_CHIPS", g.chips, START_CHIPS);
  const r1 = play(g, "2C", 0); // opens lane 0
  eq("ante deducted on first card", r1.state.chips, START_CHIPS - BASE_ANTE);
  eq("lane marked anted", r1.state.anted[0], true);
  eq("antePaid flag", r1.result.antePaid, true);
  const r2 = play(r1.state, "7D", 0); // second card, already anted
  eq("no further ante on 2nd card", r2.state.chips, START_CHIPS - BASE_ANTE);
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

// ── two-way resolution: score (Two Pair+) vs bust (below it) ──────────────────
console.log("Resolution — score / bust:");
{
  // High card → bust + lock, no score, ante lost.
  const g = noWanted(newGame());
  const { state, result } = fillLane(g, ["AD", "JC", "8D", "5S", "2D"]);
  eq("high card busts", result.resolution.bust, true);
  eq("locked", state.locked[0], true);
  eq("no points", result.resolution.points, 0);
  eq("score unchanged", state.score, 0);
  eq("lane NOT cleared", state.lanes[0].length, 5);
  eq("ante lost (down 1)", state.chips, START_CHIPS - BASE_ANTE);
}
{
  // Any pair → BUST + LOCK (no save token system): 0 points, ante lost, lane kept.
  let g = noWanted(newGame());
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "5S", "2D"]); // pair of kings
  eq("pair busts", result.resolution.bust, true);
  eq("pair does NOT score", result.resolution.scored, false);
  eq("pair bust: 0 points", result.resolution.points, 0);
  eq("pair bust: lane locked", state.locked[0], true);
  eq("pair bust: lane NOT cleared", state.lanes[0].length, 5);
  eq("pair bust: ante lost", state.chips, START_CHIPS - BASE_ANTE);
  eq("pair bust: bustNow flag", result.bustNow, true);
  // handStats tallies the pair by its ACTUAL rank (PAIR), not as HIGH_CARD.
  eq("pair tallies as PAIR", state.handStats[HAND.PAIR], 1);
  eq("pair not tallied as HIGH_CARD", !!state.handStats[HAND.HIGH_CARD], false);
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

// ── pairs bust (no save tokens) ───────────────────────────────────────────────
console.log("Pairs bust the board:");
{
  // A pair in every lane → every lane locks → game over.
  let g = noWanted(newGame());
  for (let l = 0; l < LANES; l++) g = fillLane(g, ["KS", "KH", "8D", "5S", "2D"], l).state;
  eq("a pair in each lane locks the board → over", g.over, true);
}
{
  // A pair NEVER claims a wanted (a pair never scores; it busts).
  let g = { ...newGame(), wanted: wantHand(HAND.PAIR, 999, 9), streak: 2 };
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "5S", "2D"]); // pair
  eq("pair does not claim a wanted", !!(result.wanted && result.wanted.hit), false);
  eq("pair bust resets the streak", state.streak, 0);
  eq("pair bust: streakReset flag", result.streakReset, true);
}

// ── raises ────────────────────────────────────────────────────────────────────
console.log("Raises:");
{
  // Open + preview a Red raise; it commits on the next draw (extra chips deducted).
  let g = noWanted(newGame());
  g = play(g, "2C", 0).state; // open lane 0 (anted, 1 card, no made hand)
  g = cycleRaise(g, 0);
  eq("preview is Red", g.raiseSel[0], TIER.red);
  eq("no extra chips reserved yet", g.chips, START_CHIPS - BASE_ANTE);
  const r = play(g, "9H", 0); // draw commits the raise
  eq("raise extra deducted on commit", r.state.chips, START_CHIPS - BASE_ANTE - TIERS[TIER.red].extra);
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
    const lane = 1 + (i % (LANES - 1));
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
  // a true score (Two Pair+) recharges the discard; a bust does not
  const scored = fillLane(d.state, ["KS", "KH", "8D", "8S", "2D"]); // two pair
  eq("score refreshes discard", scored.state.discard, true);
}

// ── Wanted Hands ──────────────────────────────────────────────────────────────
console.log("Wanted Hands:");
{
  // Exact match completes; bonus pts+chips added; streak +1.
  let g = newGame();
  g = { ...g, wanted: wantHand(HAND.TWO_PAIR), streak: 0 };
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
  g = { ...g, wanted: wantHand(HAND.TWO_PAIR), streak: 0 };
  const { state, result } = fillLane(g, ["KS", "KH", "KD", "8S", "2D"]); // trips, not two pair
  eq("higher hand does NOT complete lower wanted", !!(result.wanted && result.wanted.hit), false);
  eq("streak not advanced", state.streak, 0);
}
{
  // completesWanted: hand target = exact category match (cards arg unused for hands).
  eq("hand wanted exact match", completesWanted(HAND.TWO_PAIR, wantHand(HAND.TWO_PAIR), []), true);
  eq("hand wanted non-match", completesWanted(HAND.THREE, wantHand(HAND.TWO_PAIR), []), false);
}
{
  // A pair does NOT complete a wanted (it busts) and RESETS the streak.
  let g = newGame();
  g = { ...g, wanted: wantHand(HAND.TWO_PAIR), streak: 2 };
  const { state, result } = fillLane(g, ["KS", "KH", "8D", "5S", "2D"]); // pair
  eq("pair does not hit wanted", !!(result.wanted && result.wanted.hit), false);
  eq("pair bust resets streak", state.streak, 0);
}
{
  // A bust resets the streak.
  let g = newGame();
  g = { ...g, wanted: wantHand(HAND.FLUSH, 175, 3), streak: 3 };
  const { state, result } = fillLane(g, ["AD", "JC", "8D", "5S", "2D"]); // high card
  eq("bust resets streak", state.streak, 0);
  eq("streakReset flag", result.streakReset, true);
}
{
  // Milestone at streak 5 unlocks a locked lane.
  let g = newGame();
  g = {
    ...g,
    wanted: wantHand(HAND.TWO_PAIR),
    streak: 4, // completion makes it 5
    locked: Array.from({ length: LANES }, (_, i) => i === LANES - 1), // last lane is locked
  };
  const { state } = fillLane(g, ["KS", "KH", "8D", "8S", "2D"], 0); // two pair → streak 5
  eq("streak reached 5", state.streak, 5);
  eq("a locked lane was unlocked", state.locked[LANES - 1], false);
}
// streakBonus unit checks
eq("streakBonus 2 → +25% pts", streakBonus(2).ptsMult, 1.25);
eq("streakBonus 3 → +1 chip", streakBonus(3).chipAdd, 1);
eq("streakBonus 4 → +50% pts", streakBonus(4).ptsMult, 1.5);
eq("streakBonus 5 → unlock", streakBonus(5).unlockLane, true);
// pickWanted draws a tagged hand-or-condition from the streak-appropriate pool.
{
  // Every result is well-formed (kind + name + rewards), regardless of streak.
  let badShape = false;
  for (let s = 0; s <= 6; s++) for (let k = 0; k < 40; k++) {
    const w = pickWanted(s, Math.random);
    const okKind = w.kind === "hand" || w.kind === "cond";
    const okTarget = w.kind === "hand" ? typeof w.hand === "number" : !!WANTED_CONDS[w.cond];
    if (!okKind || !okTarget || typeof w.bonusPts !== "number" || typeof w.bonusChips !== "number") badShape = true;
  }
  eq("pickWanted always returns a tagged, rewarded target", badShape, false);

  // A hand target is never a pair AND never a jackpot hand (SF/Royal left the pool).
  let sawPair = false, sawJackpot = false, sawCond = false, sawFour = false;
  for (let s = 0; s <= 6; s++) for (let k = 0; k < 60; k++) {
    const w = pickWanted(s, Math.random);
    if (w.kind === "cond") { sawCond = true; continue; }
    if (w.hand === HAND.PAIR) sawPair = true;
    if (JACKPOT_HANDS.has(w.hand)) sawJackpot = true;
    if (w.hand === HAND.FOUR) sawFour = true;
  }
  eq("wanted hand is never a pair", sawPair, false);
  eq("wanted hand never a jackpot (SF/Royal)", sawJackpot, false);
  eq("conditions do appear in the rotation", sawCond, true);
  eq("hand targets cap reaches Four of a Kind", sawFour, true);
}

// ── Wanted Conditions ─────────────────────────────────────────────────────────
console.log("Wanted Conditions:");
{
  // blackjackTotal helper: A=11 (demoted to 1 to dodge a bust), JQK=10.
  eq("bj A+K = 21", blackjackTotal(cards("AH", "KS")), 21);
  eq("bj A+A+9 = 21 (one ace low)", blackjackTotal(cards("AH", "AS", "9C")), 21);
  eq("bj K+Q = 20", blackjackTotal(cards("KH", "QS")), 20);
  eq("bj A+5+5 = 21", blackjackTotal(cards("AH", "5S", "5C")), 21);
  eq("bj K+Q+J = 30 (no aces to demote)", blackjackTotal(cards("KH", "QS", "JC")), 30);

  // Direct predicate checks over 5-card lanes.
  eq("allRed true", WANTED_CONDS.allRed.test(cards("AH", "KH", "8D", "5D", "2H")), true);
  eq("allRed false (a spade)", WANTED_CONDS.allRed.test(cards("AH", "KH", "8D", "5D", "2S")), false);
  eq("allBlack true", WANTED_CONDS.allBlack.test(cards("AS", "KC", "8S", "5C", "2S")), true);
  eq("noFaces true", WANTED_CONDS.noFaces.test(cards("2S", "9C", "8S", "5C", "TS")), true);
  eq("noFaces false (a king)", WANTED_CONDS.noFaces.test(cards("2S", "9C", "KS", "5C", "TS")), false);
  eq("faceParty true (3 faces)", WANTED_CONDS.faceParty.test(cards("JS", "QC", "KS", "5C", "2S")), true);
  eq("faceParty false (2 faces)", WANTED_CONDS.faceParty.test(cards("JS", "QC", "9S", "5C", "2S")), false);
  eq("ace true", WANTED_CONDS.ace.test(cards("AS", "9C", "8S", "5C", "2S")), true);
  eq("ace false", WANTED_CONDS.ace.test(cards("KS", "9C", "8S", "5C", "2S")), false);
  eq("lucky7 true", WANTED_CONDS.lucky7.test(cards("7S", "9C", "8S", "5C", "2S")), true);
  eq("lucky7 false", WANTED_CONDS.lucky7.test(cards("KS", "9C", "8S", "5C", "2S")), false);
  eq("rainbow true (4 suits)", WANTED_CONDS.rainbow.test(cards("2S", "3H", "4D", "5C", "9S")), true);
  eq("rainbow false (3 suits)", WANTED_CONDS.rainbow.test(cards("2S", "3H", "4D", "5H", "9S")), false);
  eq("suitMaj true (3 spades)", WANTED_CONDS.suitMaj.test(cards("2S", "3S", "4S", "5H", "9C")), true);
  eq("suitMaj false (2 max)", WANTED_CONDS.suitMaj.test(cards("2S", "3S", "4H", "5H", "9C")), false);
  eq("noOdds true (all even)", WANTED_CONDS.noOdds.test(cards("2S", "4S", "6H", "8H", "QC")), true);
  eq("noOdds false (an ace)", WANTED_CONDS.noOdds.test(cards("2S", "4S", "6H", "8H", "AC")), false);
  eq("noOdds false (a king)", WANTED_CONDS.noOdds.test(cards("2S", "4S", "6H", "8H", "KC")), false);
  eq("bj21 cond true", WANTED_CONDS.bj21.test(cards("AH", "KS", "5C", "3D", "2S")), true);  // 11+10... let total reach 21? compute below
}
{
  // A condition wanted is claimed only when the lane TRULY SCORES (Two Pair+) AND the
  // predicate passes. All-red two pair → hit. A different (non-red) two pair → miss.
  let g = newGame();
  g = { ...g, wanted: wantCond("allRed"), streak: 0 };
  const { state, result } = fillLane(g, ["KH", "KD", "8H", "8D", "2H"]); // all red, two pair
  eq("condition + score → wanted hit", !!(result.wanted && result.wanted.hit), true);
  eq("condition reward = its table value", result.wanted.bonusPts, WANTED_COND_REWARDS.allRed.pts);
  eq("condition advances streak", state.streak, 1);
  eq("condition counts toward wantedHits", state.wantedHits, 1);
}
{
  // Condition met but only a PAIR (a bust, not a score) → no hit (gated by scored).
  let g = newGame();
  g = { ...g, wanted: wantCond("allRed"), streak: 2 };
  const { state, result } = fillLane(g, ["KH", "KD", "8H", "5D", "2H"]); // all red, but only a pair
  eq("condition without a score does NOT hit", !!(result.wanted && result.wanted.hit), false);
  eq("a pair bust resets the streak", state.streak, 0);
}
{
  // Condition not met though the lane scores → no hit.
  let g = newGame();
  g = { ...g, wanted: wantCond("allRed"), streak: 0 };
  const { result } = fillLane(g, ["KH", "KD", "8S", "8C", "2H"]); // two pair, but has black cards
  eq("score without the condition does NOT hit", !!(result.wanted && result.wanted.hit), false);
}
{
  // No Faces condition with a scoring low hand.
  let g = newGame();
  g = { ...g, wanted: wantCond("noFaces"), streak: 0 };
  const { result } = fillLane(g, ["9H", "9D", "8S", "8C", "2H"]); // two pair, no faces
  eq("noFaces + score → hit", !!(result.wanted && result.wanted.hit), true);
}

// ── Jackpot hands (always-on side goal) ───────────────────────────────────────
console.log("Jackpot hands:");
{
  // A Straight Flush lane fires the jackpot regardless of the current wanted, pays
  // the reward, and advances the streak + wantedHits.
  let g = newGame();
  g = { ...g, wanted: wantHand(HAND.TWO_PAIR), streak: 0 };
  const before = g.score;
  const { state, result } = fillLane(g, ["6S", "7S", "8S", "9S", "TS"]); // straight flush
  eq("jackpot hit on straight flush", !!(result.jackpot && result.jackpot.hit), true);
  eq("jackpot pays its reward pts", result.jackpot.bonusPts, JACKPOT_REWARDS[HAND.STRAIGHT_FLUSH].pts);
  eq("SF does not match the Two-Pair wanted", !!(result.wanted && result.wanted.hit), false);
  eq("jackpot advances streak", state.streak, 1);
  eq("jackpot counts toward wantedHits", state.wantedHits, 1);
  // score = base SF points + jackpot bonus
  eq("score includes base + jackpot", state.score, before + HAND_POINTS[HAND.STRAIGHT_FLUSH] + result.jackpot.totalPts);
}
{
  // A Royal Flush jackpot, with a condition wanted that ALSO matches (all spades is
  // not a defined cond, but Face Party isn't it either — use suitMaj which a royal
  // satisfies). Both fire; streak advances ONCE.
  let g = newGame();
  g = { ...g, wanted: wantCond("suitMaj"), streak: 0 };
  const { state, result } = fillLane(g, ["TS", "JS", "QS", "KS", "AS"]); // royal flush (all spades → suitMaj)
  eq("royal fires jackpot", !!(result.jackpot && result.jackpot.hit), true);
  eq("co-occurring condition wanted also hits", !!(result.wanted && result.wanted.hit), true);
  eq("streak advances exactly once", state.streak, 1);
}

// ── rising ante (poker-blinds pressure) ───────────────────────────────────────
console.log("Rising ante:");
{
  // anteFor formula: base + ANTE_STEP*floor(scoreHands/EVERY) + ANTE_STEP*floor(wantedHits/2).
  eq("ante at start", anteFor(0, 0), BASE_ANTE);
  eq("ante after 4 scores", anteFor(SCORE_HANDS_PER_ANTE, 0), BASE_ANTE + ANTE_STEP);
  eq("ante after 8 scores", anteFor(2 * SCORE_HANDS_PER_ANTE, 0), BASE_ANTE + 2 * ANTE_STEP);
  eq("ante after 2 wanted", anteFor(0, WANTED_HITS_PER_ANTE), BASE_ANTE + ANTE_STEP);
  eq("score + wanted stack additively", anteFor(SCORE_HANDS_PER_ANTE, WANTED_HITS_PER_ANTE), BASE_ANTE + 2 * ANTE_STEP);
  eq("partial thresholds floor", anteFor(SCORE_HANDS_PER_ANTE - 1, 1), BASE_ANTE);
}
{
  // A true score increments scoreHands; ante rises after SCORE_HANDS_PER_ANTE of them.
  let g = noWanted(newGame());
  const before = g.scoreHands;
  g = fillLane(g, ["KS", "KH", "8D", "8S", "2D"]).state; // two pair → a true score
  eq("score increments scoreHands", g.scoreHands, before + 1);
  // a pair BUST does NOT count toward the ante
  let g2 = noWanted(newGame());
  g2 = fillLane(g2, ["KS", "KH", "9D", "5S", "2D"]).state; // pair → bust
  eq("pair bust does not count toward ante", g2.scoreHands, 0);
  // a high-card BUST does not count
  let g3 = noWanted(newGame());
  g3 = fillLane(g3, ["AD", "JC", "8D", "5S", "2D"]).state; // high card → bust
  eq("bust does not count toward ante", g3.scoreHands, 0);
}
{
  // A Wanted completion increments wantedHits (and scoreHands, since it's a score).
  let g = newGame();
  g = { ...g, wanted: wantHand(HAND.TWO_PAIR), streak: 0 };
  g = fillLane(g, ["KS", "KH", "8D", "8S", "2D"]).state; // two pair = the wanted
  eq("wanted increments wantedHits", g.wantedHits, 1);
  eq("wanted also counts as a score", g.scoreHands, 1);
}
{
  // The ante actually charged rises after enough scores, and the refund matches
  // what was PAID (not the current ante).
  const raisedAnte = BASE_ANTE + ANTE_STEP;
  let g = noWanted({ ...newGame(), scoreHands: SCORE_HANDS_PER_ANTE }); // ante raised one step
  eq("currentAnte reflects progress", currentAnte(g), raisedAnte);
  const chipsBefore = g.chips;
  const open = play(g, "2C", 0); // open a lane at the raised ante
  eq("charged the raised ante", open.state.chips, chipsBefore - raisedAnte);
  eq("stamped the paid ante", open.state.anteAmt[0], raisedAnte);
}
{
  // Refund = exact ante paid + hand-scaled ANTE_PROFIT, even though the ante later rises.
  let g = noWanted({ ...newGame(), scoreHands: SCORE_HANDS_PER_ANTE }); // ante raised one step
  const start = g.chips;
  // open + complete a clean two pair (2s and 7s) in lane 0
  const { state } = fillLane(g, ["2C", "2D", "7S", "7H", "9C"], 0);
  // chips: -raisedAnte on open, +raisedAnte (paid ante) +ANTE_PROFIT profit on score = net +profit
  eq("refund = paid ante + profit", state.chips, start + ANTE_PROFIT);
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

// ── save / resume — a mid-run state round-trips; the version bump discards old saves ─
console.log("Save/resume — round-trip + version:");
{
  // Play a couple of cards, then serialize → hydrate; the run must round-trip.
  let g = noWanted(newGame());
  g = play(g, "KS", 0).state;
  g = play(g, "KH", 0).state; // an in-progress, unresolved lane
  const blob = serializeGame(g);
  eq("snapshot stamped current version", blob.v, SAVE_VERSION);
  const back = hydrateGame(blob);
  eq("hydrate restores chips", back.chips, g.chips);
  eq("hydrate restores the lane", back.lanes[0].length, 2);
  eq("hydrate reattaches rng", typeof back.rng, "function");
  eq("hydrate has no stale timer field", !("timer" in back), true);
}

// ── profit scaled by hand strength ("hands have weight") ──────────────────────
console.log("Profit by hand:");
{
  eq("two pair profit floor", anteProfitFor(HAND.TWO_PAIR), 1);
  eq("trips profit", anteProfitFor(HAND.THREE), 2);
  eq("straight profit", anteProfitFor(HAND.STRAIGHT), 3);
  eq("flush profit", anteProfitFor(HAND.FLUSH), 4);
  eq("full house profit", anteProfitFor(HAND.FULL_HOUSE), 6);
  eq("quads profit", anteProfitFor(HAND.FOUR), 10);
  eq("straight flush profit", anteProfitFor(HAND.STRAIGHT_FLUSH), 14);
  eq("royal profit", anteProfitFor(HAND.ROYAL_FLUSH), 20);
  eq("MIN_ANTE_PROFIT is the two-pair floor", MIN_ANTE_PROFIT, 1);
  eq("ANTE_PROFIT alias == floor", ANTE_PROFIT, MIN_ANTE_PROFIT);
  eq("unmapped rank falls back to floor", anteProfitFor(HAND.HIGH_CARD), MIN_ANTE_PROFIT);
  eq("table matches export", ANTE_PROFIT_BY_HAND[HAND.FLUSH], 4);
}
{
  // End-to-end: a FLUSH returns paid ante + flush profit (4), not the flat 1.
  let g = noWanted(newGame());
  const start = g.chips;
  const { result, state } = fillLane(g, ["AD", "JD", "8D", "5D", "2D"]); // flush, ante 1
  eq("flush chipsReturned = ante + flush profit", result.resolution.chipsReturned, BASE_ANTE + anteProfitFor(HAND.FLUSH));
  eq("flush net chips = flush profit", state.chips, start + anteProfitFor(HAND.FLUSH));
}
{
  // A FULL HOUSE nets +6.
  let g = noWanted(newGame());
  const start = g.chips;
  const { state } = fillLane(g, ["KS", "KH", "KD", "8S", "8C"]); // full house
  eq("full house net chips = +6", state.chips, start + anteProfitFor(HAND.FULL_HOUSE));
}
{
  // laneStake shows the honest FLOOR profit before the hand is known.
  let g = noWanted(newGame());
  g = play(g, "2C", 0).state; // open lane 0, 1 card
  const st = laneStake(g, 0);
  eq("laneStake toWin = ante + floor profit", st.toWin, (g.anteAmt[0]) + MIN_ANTE_PROFIT);
}

// ── save version bump (v5: 4 lanes, no timer, no save tokens) ─────────────────
console.log("Save version v5:");
{
  eq("SAVE_VERSION is 5", SAVE_VERSION, 5);
  eq("game has 4 lanes", LANES, 4);
  // A fresh run carries no timer / saveTokens fields and round-trips at v5.
  let g = noWanted(newGame());
  eq("fresh run has no timer field", !("timer" in g), true);
  eq("fresh run has no saveTokens field", !("saveTokens" in g), true);
  const blob = serializeGame(g);
  eq("snapshot stamped v5", blob.v, 5);
  const back = hydrateGame(blob);
  eq("hydrate restores a live run", !!back && back.lanes.length === LANES, true);
}
{
  // A stale v4 blob (3 lanes + timer) is rejected → New Game fallback.
  const stale = { v: 4, state: { lanes: Array.from({ length: 3 }, () => []), bag: [], locked: Array(3).fill(false), chips: 12, draws: 0, saveTokens: 2, timer: [0, 0, 0] } };
  eq("v4 save discarded on v5 bump", hydrateGame(stale), null);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
