/* Blackjack (vs. dealer) — pure game logic (no React, no DOM).
   Classic single-player-against-the-house rules, documented defaults:
     • 6-deck shoe, reshuffled when low.
     • Blackjack pays 3:2.
     • Dealer STANDS on all 17s (including soft 17 — the "S17" rule).
     • Player may HIT, STAND, or DOUBLE on the first two cards.
     • (Split is intentionally omitted for v1; see handValue notes.)
   Uses the shared deck (cards/deck.js). View-free + unit-testable. */

import { freshDeck, shuffle } from "../cards/deck.js";

export const DECKS = 6;
export const BLACKJACK_PAYS = 1.5; // 3:2
export const RESHUFFLE_AT = 15; // cards remaining → reshuffle before next deal

// Build & shuffle a fresh N-deck shoe (face-up flags set as cards are dealt).
export function freshShoe(rng = Math.random, decks = DECKS) {
  let cards = [];
  for (let d = 0; d < decks; d++) cards = cards.concat(freshDeck());
  return shuffle(cards, rng);
}

// Hand value with soft/hard aces. Aces count 11 until that would bust, then 1.
// Returns { total, soft } — soft = an ace is currently counted as 11.
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) { aces++; total += 11; }
    else total += Math.min(c.rank, 10); // J/Q/K = 10
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export const isBust = (cards) => handValue(cards).total > 21;
// A "blackjack" = exactly two cards totalling 21 (Ace + ten-value).
export const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

// Pop one card off the shoe face-up. Mutates `shoe` (caller owns it); returns the
// card, or undefined if the shoe is empty (callers reshuffle before dealing).
export function drawCard(shoe, faceUp = true) {
  const c = shoe.pop();
  return c ? { ...c, faceUp } : undefined;
}

/* Initial deal: two cards to player (face-up) and dealer (first up, hole down).
   Returns { player: Card[2], dealer: Card[2], shoe } (shoe mutated). */
export function deal(shoe) {
  const player = [drawCard(shoe), drawCard(shoe)];
  const dealer = [drawCard(shoe), drawCard(shoe, false)]; // second card is the hole
  return { player, dealer, shoe };
}

// Reveal the dealer's hole card (all face-up) — used when the player's turn ends.
export function revealDealer(dealer) {
  return dealer.map((c) => ({ ...c, faceUp: true }));
}

// Dealer plays out: hit until total ≥ 17 (stands on soft 17 too). Returns the
// completed dealer hand. Mutates `shoe`.
export function dealerPlay(dealer, shoe) {
  const hand = revealDealer(dealer);
  while (handValue(hand).total < 17) hand.push(drawCard(shoe));
  return hand;
}

/* Settle a finished round. `doubled` doubles the wagered amount for payout.
   Returns { outcome, delta } where outcome is one of
     "blackjack" | "win" | "push" | "lose" | "bust" | "dealer-bust"
   and delta is the net chip change for a base `bet` (negative = loss). */
export function settle(player, dealer, bet, doubled = false) {
  const wager = doubled ? bet * 2 : bet;
  const pv = handValue(player).total;
  const dv = handValue(dealer).total;
  const pBJ = isBlackjack(player);
  const dBJ = isBlackjack(dealer);

  if (pv > 21) return { outcome: "bust", delta: -wager };
  if (pBJ && !dBJ) return { outcome: "blackjack", delta: Math.round(bet * BLACKJACK_PAYS) };
  if (pBJ && dBJ) return { outcome: "push", delta: 0 };
  if (dBJ) return { outcome: "lose", delta: -wager };
  if (dv > 21) return { outcome: "dealer-bust", delta: wager };
  if (pv > dv) return { outcome: "win", delta: wager };
  if (pv < dv) return { outcome: "lose", delta: -wager };
  return { outcome: "push", delta: 0 };
}
