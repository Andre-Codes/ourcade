/* Chip Panic — pure game logic (no React, no DOM).
   Tetris-meets-Video-Poker. A grid COLS wide × ROWS tall. Cards fall one at a
   time and land on top of the stack in the player's chosen column. Before a
   column fills, the player can drop a CHIP on it to "bet" that column. When a
   column fills with exactly ROWS=5 cards, those five are scored as a poker hand
   (shared poker/handEval.js) and cleared; a chipped column that makes a PAYING
   hand scores a multiplier, a chipped column that whiffs costs a life.

   The board overflows (game over) if a card would land in a column that's
   already full when it can't be placed. Speed ramps up over time.

   Decided line rule: COLUMNS of 5 (a natural five-card poker hand). Kept
   view-free + unit-testable; the React view drives it with a falling animation. */

import { freshDeck, shuffle } from "../cards/deck.js";
import { evaluate, HAND } from "../poker/handEval.js";

export const COLS = 5;
export const ROWS = 5; // a full column = 5 cards = one poker hand

// Base points per hand category when a column clears (un-chipped). Tuned so the
// poker ladder feels right: junk barely pays, premium hands are events.
export const HAND_POINTS = {
  [HAND.HIGH_CARD]: 5,
  [HAND.PAIR]: 10,
  [HAND.TWO_PAIR]: 25,
  [HAND.THREE]: 50,
  [HAND.STRAIGHT]: 90,
  [HAND.FLUSH]: 130,
  [HAND.FULL_HOUSE]: 200,
  [HAND.FOUR]: 400,
  [HAND.STRAIGHT_FLUSH]: 800,
  [HAND.ROYAL_FLUSH]: 2000,
};

// A chipped column that makes a PAYING hand (pair or better) scores ×this.
export const CHIP_MULTIPLIER = 3;
// A chipped column that clears as a non-paying High Card costs a life (a bad bet).
export const PAYING_MIN = HAND.PAIR;

export const START_LIVES = 3;

/* Fresh game state.
   {
     cols:  Card[][]   COLS columns, each 0..ROWS cards (index 0 = bottom)
     chips: bool[COLS] which columns are currently bet
     dead:  bool[COLS] columns that filled as junk (locked, never clear)
     discard: bool     is the single discard charged? (recharges per clear)
     bag:   Card[]     shuffled draw source (refilled from fresh decks)
     score, lives, cleared, over
   }
*/
export function newGame(rng = Math.random) {
  return {
    cols: Array.from({ length: COLS }, () => []),
    chips: Array(COLS).fill(false),
    dead: Array(COLS).fill(false),
    discard: true, // starts charged
    bag: shuffle(freshDeck(), rng),
    rng,
    score: 0,
    lives: START_LIVES,
    cleared: 0, // columns cleared (drives speed/level)
    over: false,
  };
}

// Draw the next card to fall, refilling the bag from fresh shuffled decks so the
// stream never runs dry. Returns { card, state } (state.bag advanced).
export function nextCard(state) {
  const s = state;
  if (s.bag.length === 0) s.bag = shuffle(freshDeck(), s.rng);
  const card = { ...s.bag[0], faceUp: true };
  s.bag = s.bag.slice(1);
  return card;
}

export const columnFull = (col) => col.length >= ROWS;
export const canPlace = (state, c) => !columnFull(state.cols[c]);

// Toggle a chip bet on a column (only if not full/dead and not already cleared).
export function toggleChip(state, c) {
  if (columnFull(state.cols[c])) return state;
  const chips = state.chips.slice();
  chips[c] = !chips[c];
  return { ...state, chips };
}

/* Spend the single discard (throw the held card away). No-op if not charged.
   The view owns the held card; this only tracks the charge. Recharges whenever a
   lane clears (see placeCard). */
export function useDiscard(state) {
  if (!state.discard) return state;
  return { ...state, discard: false };
}

/* Place `card` on column `c`. If that fills the column (5 cards), evaluate the
   poker hand:
     - PAYING (pair+) → score, clear the column, recharge the discard.
     - HIGH CARD      → the lane does NOT clear; it locks as a DEAD lane (dead
                        weight crowding the board). A chipped junk lane also
                        costs a life (a bad bet), same as before.
   Returns { state, event }; event (null unless the lane resolved) =
     { col, hand, points, chipped, paying, lostLife, dead }
   If the column is already full/dead, it's an overflow → game over. */
export function placeCard(state, c, card) {
  const cols = state.cols.map((col) => col.slice());
  if (columnFull(cols[c])) {
    return { state: { ...state, over: true }, event: null };
  }
  cols[c].push(card);

  let event = null;
  let { score, lives, cleared, discard } = state;
  const chips = state.chips.slice();
  const dead = state.dead.slice();

  if (cols[c].length === ROWS) {
    const hand = evaluate(cols[c]);
    const chipped = chips[c];
    const paying = hand.rank >= PAYING_MIN;
    let points = 0;
    let lostLife = false;
    let isDead = false;

    if (paying) {
      points = HAND_POINTS[hand.rank] || 0;
      if (chipped) points *= CHIP_MULTIPLIER;
      score += points;
      cleared += 1;
      cols[c] = []; // clear the column
      discard = true; // a scored hand recharges the discard
    } else {
      // High card: the lane dies (locked). Chipped junk still costs a life.
      isDead = true;
      dead[c] = true;
      if (chipped) { lostLife = true; lives -= 1; }
    }
    chips[c] = false; // spend the chip either way
    event = { col: c, hand, points, chipped, paying, lostLife, dead: isDead };
  }

  const over = lives <= 0;
  return {
    state: { ...state, cols, chips, dead, score, lives, cleared, discard, over },
    event,
  };
}

// Level / speed: ramps with columns cleared. Drives the view's fall interval.
export function levelFor(cleared) {
  return Math.floor(cleared / 5) + 1;
}
// ms a card takes to fall one row; faster as the level climbs. Floored so it
// stays humane. (The view multiplies rows × this for the drop tween.)
export function fallIntervalMs(cleared) {
  const lvl = levelFor(cleared);
  return Math.max(140, 620 - (lvl - 1) * 48);
}
