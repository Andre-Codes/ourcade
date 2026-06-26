/* Klondike Solitaire — pure game logic (no React, no DOM).
   Kept view-free and unit-testable, mirroring src/games/relic-run/logic.js.
   The component (Solitaire.jsx) renders this state and calls these helpers.

   Deck primitives (freshDeck/shuffle/card shape) now live in the shared
   src/games/cards/deck.js so every card cabinet uses one source of truth;
   they're re-exported here so existing Solitaire imports keep working. */

import { SUITS, RANKS, isRed, freshDeck, shuffle } from "../cards/deck.js";

export { SUITS, RANKS, isRed, rankLabel, freshDeck, shuffle } from "../cards/deck.js";

/* Game state shape:
   {
     tableau:    Card[][]  (7 piles; last card of each is face-up)
     foundations: Card[][] (4 piles, by suit-agnostic build A→K)
     stock:      Card[]    (face-down draw pile)
     waste:      Card[]    (face-up; top is playable)
     draw:       1 | 3     (cards flipped per stock click)
   }
*/

export function deal(rng = Math.random, draw = 1) {
  const deck = shuffle(freshDeck(), rng);
  const tableau = [[], [], [], [], [], [], []];
  let k = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[k++] };
      card.faceUp = row === col; // only the top card starts face-up
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(k).map((c) => ({ ...c, faceUp: false }));
  return {
    tableau,
    foundations: [[], [], [], []],
    stock,
    waste: [],
    draw: draw === 3 ? 3 : 1,
  };
}

// Deep-ish clone so reducers stay pure (cards themselves are replaced when mutated).
export function cloneState(s) {
  return {
    tableau: s.tableau.map((p) => p.map((c) => ({ ...c }))),
    foundations: s.foundations.map((p) => p.map((c) => ({ ...c }))),
    stock: s.stock.map((c) => ({ ...c })),
    waste: s.waste.map((c) => ({ ...c })),
    draw: s.draw,
  };
}

// ── legal-move predicates ─────────────────────────────────────────────────────

// Can `card` go onto a tableau column? (alternating color, descending rank; only
// a King onto an empty column.)
export function canStackTableau(card, destCol) {
  if (destCol.length === 0) return card.rank === RANKS; // King to empty
  const top = destCol[destCol.length - 1];
  if (!top.faceUp) return false;
  return isRed(card.suit) !== isRed(top.suit) && card.rank === top.rank - 1;
}

// Can `card` go onto this foundation pile? (same suit, ascending from Ace.)
export function canStackFoundation(card, foundationPile) {
  if (foundationPile.length === 0) return card.rank === 1; // Ace starts it
  const top = foundationPile[foundationPile.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

// A run starting at tableau[col][idx] is movable iff every card from idx down is
// face-up and forms a valid alternating-color descending sequence.
export function isMovableRun(pile, idx) {
  if (idx < 0 || idx >= pile.length) return false;
  if (!pile[idx].faceUp) return false;
  for (let i = idx; i < pile.length - 1; i++) {
    const a = pile[i];
    const b = pile[i + 1];
    if (!b.faceUp) return false;
    if (!(isRed(a.suit) !== isRed(b.suit) && b.rank === a.rank - 1)) return false;
  }
  return true;
}

export function isWon(s) {
  return s.foundations.every((p) => p.length === RANKS);
}

// All face-up + every tableau card exposed → safe to auto-complete to foundations.
export function canAutoComplete(s) {
  if (s.stock.length || s.waste.length) return false;
  return s.tableau.every((p) => p.every((c) => c.faceUp));
}

// ── moves (each returns a NEW state, or null if illegal) ──────────────────────

// Flip stock → waste (draw 1 or 3). Empty stock recycles the waste face-down.
export function drawFromStock(state) {
  const s = cloneState(state);
  if (s.stock.length === 0) {
    if (s.waste.length === 0) return null;
    s.stock = s.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    s.waste = [];
    return s;
  }
  const n = Math.min(s.draw, s.stock.length);
  for (let i = 0; i < n; i++) {
    const c = s.stock.pop();
    c.faceUp = true;
    s.waste.push(c);
  }
  return s;
}

// Turn the top tableau card face-up if it's face-down (after a move exposes it).
function flipExposed(pile) {
  if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
}

// Move the top waste card to a tableau column.
export function wasteToTableau(state, col) {
  if (!state.waste.length) return null;
  const card = state.waste[state.waste.length - 1];
  if (!canStackTableau(card, state.tableau[col])) return null;
  const s = cloneState(state);
  s.tableau[col].push(s.waste.pop());
  return s;
}

// Move the top waste card to a foundation pile.
export function wasteToFoundation(state, fIdx) {
  if (!state.waste.length) return null;
  const card = state.waste[state.waste.length - 1];
  if (!canStackFoundation(card, state.foundations[fIdx])) return null;
  const s = cloneState(state);
  s.foundations[fIdx].push(s.waste.pop());
  return s;
}

// Move a run (cards fromCol[fromIdx..end]) onto another tableau column.
export function tableauToTableau(state, fromCol, fromIdx, toCol) {
  if (fromCol === toCol) return null;
  const src = state.tableau[fromCol];
  if (!isMovableRun(src, fromIdx)) return null;
  const moving = src[fromIdx];
  if (!canStackTableau(moving, state.tableau[toCol])) return null;
  const s = cloneState(state);
  const run = s.tableau[fromCol].splice(fromIdx);
  s.tableau[toCol].push(...run);
  flipExposed(s.tableau[fromCol]);
  return s;
}

// Move the top card of a tableau column to a foundation pile.
export function tableauToFoundation(state, fromCol, fIdx) {
  const src = state.tableau[fromCol];
  if (!src.length) return null;
  const card = src[src.length - 1];
  if (!card.faceUp || !canStackFoundation(card, state.foundations[fIdx])) return null;
  const s = cloneState(state);
  s.foundations[fIdx].push(s.tableau[fromCol].pop());
  flipExposed(s.tableau[fromCol]);
  return s;
}

// Auto-send a card to any foundation that accepts it (double-tap QoL). Returns
// { state, fIdx } or null. Tries waste-top if `fromCol` is null, else tableau top.
export function autoToFoundation(state, fromCol) {
  const card =
    fromCol == null
      ? state.waste[state.waste.length - 1]
      : state.tableau[fromCol]?.[state.tableau[fromCol].length - 1];
  if (!card || !card.faceUp) return null;
  for (let f = 0; f < 4; f++) {
    if (canStackFoundation(card, state.foundations[f])) {
      const next = fromCol == null
        ? wasteToFoundation(state, f)
        : tableauToFoundation(state, fromCol, f);
      if (next) return { state: next, fIdx: f };
    }
  }
  return null;
}

// One step of auto-complete: send the lowest-needed card up. Returns next state
// or null when nothing moved (caller loops until null).
export function autoCompleteStep(state) {
  // Try waste then every tableau top; deterministic order keeps the animation calm.
  const w = autoToFoundation(state, null);
  if (w) return w.state;
  for (let col = 0; col < 7; col++) {
    const r = autoToFoundation(state, col);
    if (r) return r.state;
  }
  return null;
}

// Share-card / result text.
export function rating(moves) {
  if (moves <= 110) return "MASTERFUL";
  if (moves <= 150) return "SHARP";
  if (moves <= 200) return "SOLID";
  return "CLEARED";
}
