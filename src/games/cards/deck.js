/* Shared playing-card primitives — pure, no React, no DOM.
   The single source of truth for the deck across every card cabinet (Solitaire,
   Video Poker, Blackjack, Chip Panic). Kept view-free and unit-testable.

   A card: { rank:1..13, suit:"S|H|D|C", faceUp:bool, id:"H7" }.
   `id` is the engine's canonical "<suit><rank>" — the same string the Kenney
   card art is named by — so a view renders cardImg(card.id) directly. */

export const SUITS = ["S", "H", "D", "C"]; // spades, hearts, diamonds, clubs
export const RED = new Set(["H", "D"]);
export const RANKS = 13; // A=1 … K=13

export const isRed = (suit) => RED.has(suit);
export const rankLabel = (r) =>
  ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[r] || String(r));

export function makeCard(rank, suit) {
  return { rank, suit, faceUp: false, id: suit + rank };
}

// Full 52-card deck (ordered; caller shuffles).
export function freshDeck() {
  const deck = [];
  for (const suit of SUITS) for (let r = 1; r <= RANKS; r++) deck.push(makeCard(r, suit));
  return deck;
}

// Fisher–Yates with an optional rng (defaults to Math.random) — passing a seeded
// rng enables deterministic deals (and a future "Daily Deal" mode) without
// touching callers.
export function shuffle(deck, rng = Math.random) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
