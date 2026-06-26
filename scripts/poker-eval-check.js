/* ============================================================
   POKER-EVAL-CHECK — headless verifier for the shared poker hand
   evaluator (src/games/poker/handEval.js), used by Video Poker
   and Chip Panic. Same idea as scripts/relic-run-check.js: drive
   the real logic (no React) and assert known hands rank correctly.
   Run:  node scripts/poker-eval-check.js
   ============================================================ */

import { evaluate, compareHands, HAND, HAND_NAME } from "../src/games/poker/handEval.js";

// Build five cards from a compact "rank+suit" notation, e.g. "AS","TD","2C".
// rank: A,2..9,T,J,Q,K → 1..13 ; suit: S/H/D/C.
const R = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
const card = (s) => {
  const suit = s.slice(-1);
  const rs = s.slice(0, -1);
  const rank = R[rs] ?? Number(rs);
  return { rank, suit, id: suit + rank };
};
const hand = (...strs) => strs.map(card);

let pass = 0;
let fail = 0;
function eq(label, got, want) {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${label}: got ${got}, want ${want}`);
  }
}

// ── every category from a known hand ──────────────────────────────────────────
const cases = [
  ["Royal flush", hand("AS", "KS", "QS", "JS", "TS"), HAND.ROYAL_FLUSH],
  ["Straight flush (king-high)", hand("KH", "QH", "JH", "TH", "9H"), HAND.STRAIGHT_FLUSH],
  ["Straight flush (wheel A-5)", hand("AH", "2H", "3H", "4H", "5H"), HAND.STRAIGHT_FLUSH],
  ["Four of a kind", hand("9S", "9H", "9D", "9C", "KS"), HAND.FOUR],
  ["Full house", hand("8S", "8H", "8D", "3C", "3S"), HAND.FULL_HOUSE],
  ["Flush", hand("AD", "JD", "8D", "5D", "2D"), HAND.FLUSH],
  ["Straight (broadway)", hand("AS", "KH", "QD", "JC", "TS"), HAND.STRAIGHT],
  ["Straight (wheel A-2-3-4-5)", hand("AS", "2H", "3D", "4C", "5S"), HAND.STRAIGHT],
  ["Straight (mid)", hand("9S", "8H", "7D", "6C", "5S"), HAND.STRAIGHT],
  ["Three of a kind", hand("QS", "QH", "QD", "9C", "2S"), HAND.THREE],
  ["Two pair", hand("JS", "JH", "4D", "4C", "AS"), HAND.TWO_PAIR],
  ["Pair (jacks)", hand("JS", "JH", "9D", "5C", "2S"), HAND.PAIR],
  ["Pair (twos)", hand("2S", "2H", "KD", "9C", "5S"), HAND.PAIR],
  ["High card", hand("AS", "KH", "9D", "5C", "2S"), HAND.HIGH_CARD],
  // Negative: a 2-3-4-5-6 of mixed suits is a straight, NOT a flush/straight-flush.
  ["Not a flush (mixed)", hand("2S", "3H", "4D", "5C", "6S"), HAND.STRAIGHT],
  // Negative: K-Q-J-T-9 NOT all one suit is a plain straight.
  ["Almost-flush is straight", hand("KS", "QH", "JS", "TS", "9S"), HAND.STRAIGHT],
];
console.log("Hand categories:");
for (const [label, h, want] of cases) {
  const r = evaluate(h).rank;
  eq(label, HAND_NAME[r], HAND_NAME[want]);
}

// ── tie-breakers within a category ────────────────────────────────────────────
console.log("Tie-breakers:");
const tb = [
  // Higher pair wins.
  ["KK > QQ", hand("KS", "KH", "5D", "3C", "2S"), hand("QS", "QH", "AD", "KC", "JS"), 1],
  // Same pair, higher kicker wins.
  ["AA-K > AA-Q", hand("AS", "AH", "KD", "3C", "2S"), hand("AC", "AD", "QH", "5S", "4D"), 1],
  // Wheel straight (5-high) loses to 6-high straight.
  ["6-high > wheel", hand("6S", "5H", "4D", "3C", "2S"), hand("AS", "2H", "3D", "4C", "5S"), 1],
  // Higher flush wins by top card.
  ["A-flush > K-flush", hand("AD", "9D", "8D", "5D", "2D"), hand("KH", "QH", "8H", "5H", "2H"), 1],
  // Identical hands tie.
  ["identical ties", hand("AD", "9D", "8D", "5D", "2D"), hand("AS", "9S", "8S", "5S", "2S"), 0],
];
for (const [label, a, b, wantSign] of tb) {
  const c = compareHands(evaluate(a), evaluate(b));
  const sign = c > 0 ? 1 : c < 0 ? -1 : 0;
  eq(label, sign, wantSign);
}

// ── category ordering sanity: royal > sf > quads > ... > high card ─────────────
console.log("Category ordering:");
const ordered = [
  evaluate(hand("AS", "KS", "QS", "JS", "TS")), // royal
  evaluate(hand("9H", "8H", "7H", "6H", "5H")), // straight flush
  evaluate(hand("9S", "9H", "9D", "9C", "KS")), // quads
  evaluate(hand("8S", "8H", "8D", "3C", "3S")), // full house
  evaluate(hand("AD", "JD", "8D", "5D", "2D")), // flush
  evaluate(hand("9S", "8H", "7D", "6C", "5S")), // straight
  evaluate(hand("QS", "QH", "QD", "9C", "2S")), // trips
  evaluate(hand("JS", "JH", "4D", "4C", "AS")), // two pair
  evaluate(hand("JS", "JH", "9D", "5C", "2S")), // pair
  evaluate(hand("AS", "KH", "9D", "5C", "2S")), // high card
];
for (let i = 0; i < ordered.length - 1; i++) {
  const ok = compareHands(ordered[i], ordered[i + 1]) > 0;
  eq(`${ordered[i].name} > ${ordered[i + 1].name}`, ok, true);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
