/* Video Poker (Jacks or Better) — pure game logic (no React, no DOM).
   The classic five-card draw machine: deal 5, hold any, draw to replace the
   rest, get paid by the final hand's rank. Uses the shared deck (cards/deck.js)
   and the shared hand evaluator (poker/handEval.js). View-free + unit-testable. */

import { freshDeck, shuffle } from "../cards/deck.js";
import { evaluate, HAND } from "./handEval.js";

// Jacks-or-Better paytable, credits paid per 1 credit bet. The minimum paying
// hand is a pair of Jacks+; lower pairs and high card pay nothing. These are the
// canonical "9/6" full-pay multipliers (the per-coin column; a real machine
// multiplies all but the royal by the bet, and rewards a max-bet royal — see
// payout() below). Indexed by HAND.* rank.
export const JACKS_OR_BETTER_PAYTABLE = {
  [HAND.ROYAL_FLUSH]: 250, // per coin; 800 at max bet (handled in payout)
  [HAND.STRAIGHT_FLUSH]: 50,
  [HAND.FOUR]: 25,
  [HAND.FULL_HOUSE]: 9,
  [HAND.FLUSH]: 6,
  [HAND.STRAIGHT]: 4,
  [HAND.THREE]: 3,
  [HAND.TWO_PAIR]: 2,
  [HAND.PAIR]: 1, // only counts as a paying pair if it's Jacks-or-better
  [HAND.HIGH_CARD]: 0,
};

export const MAX_BET = 5; // coins; a 5-coin royal pays the 800x bonus.

// Is a paying hand? A plain Pair only pays when it's Jacks (11), Queens (12),
// Kings (13), or Aces (rank 1 → treated high). Everything Two-Pair+ always pays.
export function isPaying(hand, cards) {
  if (hand.rank >= HAND.TWO_PAIR) return true;
  if (hand.rank === HAND.PAIR) return isJacksOrBetterPair(cards);
  return false;
}

// The pair rank in a one-pair hand; true iff it's J/Q/K/A.
function isJacksOrBetterPair(cards) {
  const counts = new Map();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  for (const [rank, n] of counts) {
    if (n === 2) return rank === 1 || rank >= 11; // Ace(1) or J/Q/K
  }
  return false;
}

/* Deal a fresh hand for a bet. Returns:
     { hand: Card[5] (faceUp), deck: Card[] (remaining draw pile), bet }
   Cards are dealt face-up (the player sees their hand) from a shuffled deck. */
export function deal(bet = 1, rng = Math.random) {
  const deck = shuffle(freshDeck(), rng).map((c) => ({ ...c, faceUp: true }));
  const hand = deck.slice(0, 5);
  const rest = deck.slice(5);
  return { hand, deck: rest, bet: clampBet(bet) };
}

const clampBet = (b) => Math.max(1, Math.min(MAX_BET, Math.floor(b) || 1));

/* Replace the non-held cards from the draw pile. `held` is a boolean[5] (true =
   keep). Returns { hand: Card[5], deck } with the new five-card hand. */
export function draw(state, held) {
  let di = 0;
  const hand = state.hand.map((card, i) =>
    held[i] ? card : { ...state.deck[di++], faceUp: true }
  );
  return { hand, deck: state.deck.slice(di) };
}

/* Settle a final hand against the paytable for a given bet. Returns:
     { hand: evalResult, paying: bool, multiplier, payout }
   payout is total credits returned (0 if non-paying). A royal flush at MAX_BET
   pays the 800x bonus instead of the linear 250×bet. */
export function payout(cards, bet = 1) {
  const hand = evaluate(cards);
  const paying = isPaying(hand, cards);
  if (!paying) return { hand, paying: false, multiplier: 0, payout: 0 };
  const perCoin = JACKS_OR_BETTER_PAYTABLE[hand.rank] || 0;
  // Royal flush gets the classic max-bet jackpot: 800/coin at MAX_BET instead of
  // the linear 250/coin. Every other hand is simply per-coin × bet.
  const royalMax = hand.rank === HAND.ROYAL_FLUSH && bet >= MAX_BET;
  const credits = royalMax ? 800 * bet : perCoin * bet;
  return { hand, paying: true, multiplier: perCoin, payout: credits };
}
