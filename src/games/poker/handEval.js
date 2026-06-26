/* Poker hand evaluator — pure, no React, no DOM.
   Shared by Video Poker and Chip Panic. Evaluates exactly five cards (the card
   shape from src/games/cards/deck.js: { rank:1..13, suit:"S|H|D|C", ... }) into
   a category rank plus a tie-breaker key, so two same-category hands can be
   ordered. Kept view-free and unit-testable.

   Category ranks (higher = better):
     0 HIGH_CARD  1 PAIR  2 TWO_PAIR  3 THREE  4 STRAIGHT  5 FLUSH
     6 FULL_HOUSE 7 FOUR  8 STRAIGHT_FLUSH  9 ROYAL_FLUSH
   Aces are high for ranking, but also count low in the wheel A-2-3-4-5. */

export const HAND = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
};

export const HAND_NAME = {
  0: "High Card",
  1: "Pair",
  2: "Two Pair",
  3: "Three of a Kind",
  4: "Straight",
  5: "Flush",
  6: "Full House",
  7: "Four of a Kind",
  8: "Straight Flush",
  9: "Royal Flush",
};

// Ace counts as 14 for high-card ordering; rank 1 in the deck is the Ace.
const hi = (rank) => (rank === 1 ? 14 : rank);

// Are these five (already hi-mapped, sorted desc) ranks a run of five? Returns the
// straight's high card, or 0 if not a straight. Handles the A-2-3-4-5 "wheel"
// (where the Ace plays low and the straight's high card is the 5).
function straightHigh(descHi) {
  // Normal run: each step down by exactly 1, all distinct.
  let run = true;
  for (let i = 0; i < 4; i++) if (descHi[i] - 1 !== descHi[i + 1]) run = false;
  if (run) return descHi[0];
  // Wheel: A(14),5,4,3,2 → treat as 5-high.
  if (descHi[0] === 14 && descHi[1] === 5 && descHi[2] === 4 && descHi[3] === 3 && descHi[4] === 2) {
    return 5;
  }
  return 0;
}

/* Evaluate exactly five cards. Returns:
     { rank, name, tiebreak }
   `rank` is a HAND.* category; `tiebreak` is an array compared lexicographically
   (descending) against another hand's tiebreak of the SAME category to break
   ties — e.g. two pairs are ordered by pair rank then kicker. */
export function evaluate(cards) {
  if (!cards || cards.length !== 5) {
    throw new Error("evaluate() needs exactly 5 cards");
  }
  const ranksHi = cards.map((c) => hi(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const sHigh = straightHigh(ranksHi);

  // Count by rank → groups sorted by (count desc, rank desc). This single
  // structure drives pair/trips/quads and their kickers.
  const counts = new Map();
  for (const r of ranksHi) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] || b[0] - a[0]
  ); // [ [rank, count], ... ]
  const shape = groups.map((g) => g[1]).join(""); // e.g. "32", "221", "2111"
  // Tiebreak from group ranks in (count, rank) priority order.
  const groupTiebreak = groups.map((g) => g[0]);

  if (sHigh && isFlush) {
    // Royal = ace-high straight flush.
    const rank = sHigh === 14 ? HAND.ROYAL_FLUSH : HAND.STRAIGHT_FLUSH;
    return mk(rank, [sHigh]);
  }
  if (shape === "41") return mk(HAND.FOUR, groupTiebreak);
  if (shape === "32") return mk(HAND.FULL_HOUSE, groupTiebreak);
  if (isFlush) return mk(HAND.FLUSH, ranksHi);
  if (sHigh) return mk(HAND.STRAIGHT, [sHigh]);
  if (shape === "311") return mk(HAND.THREE, groupTiebreak);
  if (shape === "221") return mk(HAND.TWO_PAIR, groupTiebreak);
  if (shape === "2111") return mk(HAND.PAIR, groupTiebreak);
  return mk(HAND.HIGH_CARD, ranksHi);
}

function mk(rank, tiebreak) {
  return { rank, name: HAND_NAME[rank], tiebreak };
}

// Compare two evaluate() results: >0 if a beats b, <0 if b beats a, 0 if equal.
export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const d = (a.tiebreak[i] || 0) - (b.tiebreak[i] || 0);
    if (d) return d;
  }
  return 0;
}
