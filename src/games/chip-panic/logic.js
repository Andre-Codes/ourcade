/* High Card Bust — pure game logic (no React, no DOM).
   A turn-based poker solitaire. Five lanes, each holding up to five cards. The
   player draws ONE card at a time into a tray, then places it into an unlocked
   lane (or spends a discard to throw it away). When a lane reaches five cards it
   RESOLVES:
     - Pair or better → SCORES and CLEARS (the lane empties, ready to reuse).
     - High Card only → BUSTS and LOCKS permanently (dead weight on the board).
   There is no life counter — locked lanes are the lives. The run ends when all
   five lanes are locked (or, in One-Deck mode, when the deck is exhausted).

   Push-your-luck betting: tap a lane's chip to PREVIEW a wager tier (Blue/Red/
   Gold/Black). The bet COMMITS — reserving chips and starting a countdown — when
   the next card is drawn. A committed bet must succeed within BET_EXPIRY_DRAWS
   draws or it fails. Winning a bet multiplies the lane's score and returns the
   stake plus profit; any failure forfeits the stake.

   Kept view-free and unit-testable: every function returns NEW state and the
   view holds it. The drawn `tray` card lives in engine state (not the view) so
   that bet commitment + expiry happen in a single deterministic draw transition.
   Shares deck.js / handEval.js with the other card cabinets. */

import { freshDeck, shuffle } from "../cards/deck.js";
import { evaluate, bestMadeHand, HAND } from "../poker/handEval.js";

export const LANES = 5;
export const LANE_CAP = 5; // a full lane = 5 cards = one poker hand
export const START_CHIPS = 10;
export const BET_EXPIRY_DRAWS = 5; // a committed bet must land within this many draws
export const BET_MAX_CARDS = 3; // a lane can only be newly bet at <= this many cards
export const NO_BET = 0;
export const PAYING_MIN = HAND.PAIR; // pair or better scores

// Base points per hand category when a lane scores (design doc §6).
export const HAND_POINTS = {
  [HAND.PAIR]: 10,
  [HAND.TWO_PAIR]: 25,
  [HAND.THREE]: 40,
  [HAND.STRAIGHT]: 60,
  [HAND.FLUSH]: 75,
  [HAND.FULL_HOUSE]: 100,
  [HAND.FOUR]: 200,
  [HAND.STRAIGHT_FLUSH]: 500,
  [HAND.ROYAL_FLUSH]: 1000,
};

/* Wager tiers, in tap-cycle order (index 0 = No Bet). A tier wins if the lane
   resolves with a hand of rank >= `min`. `mult` multiplies the base points;
   `profit` is the chips returned ABOVE the stake on a win (doc §9 + §12).
   `color` is the Kenney chip art name — Gold maps to the green chip (no gold art
   exists; matches VideoPoker's chip mapping). */
export const BET_TIERS = [
  { key: "none", label: "No Bet", color: null, cost: 0, min: PAYING_MIN, mult: 1, profit: 0 },
  { key: "blue", label: "Blue", color: "blue", cost: 1, min: HAND.PAIR, mult: 2, profit: 1 },
  { key: "red", label: "Red", color: "red", cost: 2, min: HAND.TWO_PAIR, mult: 3, profit: 1 },
  { key: "gold", label: "Gold", color: "green", cost: 3, min: HAND.STRAIGHT, mult: 5, profit: 2 },
  { key: "black", label: "Black", color: "black", cost: 5, min: HAND.FULL_HOUSE, mult: 8, profit: 3 },
];

/* Fresh game state.
   {
     lanes:   Card[][]          LANES lanes, each 0..LANE_CAP cards (push order)
     locked:  bool[LANES]       lanes that busted as High Card (permanent)
     betSel:  int[LANES]        currently-previewed tier index (free to cycle)
     bet:     (Bet|null)[LANES] committed bet { tier, draws } | null
     tray:    Card|null         the drawn card awaiting placement/discard
     bag:     Card[]            draw source
     oneDeck: bool              false = infinite reshuffle (default)
     rng:     () => number
     chips, discard, score, draws, over
   }
   Bet: { tier:int (index into BET_TIERS), draws:int (draws remaining) } */
export function newGame({ oneDeck = false, rng = Math.random } = {}) {
  const state = {
    lanes: Array.from({ length: LANES }, () => []),
    locked: Array(LANES).fill(false),
    betSel: Array(LANES).fill(NO_BET),
    bet: Array(LANES).fill(null),
    tray: null,
    bag: shuffle(freshDeck(), rng),
    oneDeck,
    rng,
    chips: START_CHIPS,
    discard: true, // starts charged
    score: 0,
    draws: 0,
    over: false,
  };
  // Deal the opening card so PLAY always has something in the tray. No bets can
  // be pending yet, so this draw never commits or ticks anything.
  drawInto(state, null);
  return state;
}

export const laneFull = (lane) => lane.length >= LANE_CAP;
export const canPlace = (state, l) =>
  !state.over && !state.locked[l] && !laneFull(state.lanes[l]) && state.tray != null;

// All five lanes locked → main end condition. One-Deck also ends when the deck
// is spent (no tray left to place).
export function isGameOver(state) {
  if (state.locked.every(Boolean)) return true;
  if (state.oneDeck && state.bag.length === 0 && state.tray == null) return true;
  return false;
}

/* Can lane `l` be newly bet at tier `tierIndex`? (doc §8)
   No Bet is always selectable; a real tier needs the lane unlocked, not full,
   holding 1..BET_MAX_CARDS cards with NO made hand yet, and enough chips. The
   `>= 1` rules out blind bets on empty lanes. */
export function canBet(state, l, tierIndex) {
  if (state.over || state.locked[l]) return false;
  if (tierIndex === NO_BET) return true;
  const tier = BET_TIERS[tierIndex];
  if (!tier) return false;
  const lane = state.lanes[l];
  if (lane.length < 1 || lane.length > BET_MAX_CARDS) return false;
  if (bestMadeHand(lane) !== HAND.HIGH_CARD) return false;
  if (state.chips < tier.cost) return false;
  return true;
}

/* Cycle the previewed tier on lane `l` to the next affordable+eligible one,
   wrapping back to No Bet (doc §9, §10). Reserves NO chips — commitment happens
   on the next draw. No-op if the lane can't take any real bet. */
export function cycleBet(state, l) {
  if (!canBet(state, l, BET_TIERS.length - 1) && !affordsAnyTier(state, l)) {
    // Lane is ineligible for every real tier (locked/full/made-hand/too many
    // cards) — only No Bet is valid, so there's nothing to cycle.
    if (state.betSel[l] === NO_BET) return state;
    const betSel = state.betSel.slice();
    betSel[l] = NO_BET;
    return { ...state, betSel };
  }
  const betSel = state.betSel.slice();
  let next = betSel[l];
  for (let step = 0; step < BET_TIERS.length; step++) {
    next = (next + 1) % BET_TIERS.length;
    if (next === NO_BET || canBet(state, l, next)) break;
  }
  betSel[l] = next;
  return { ...state, betSel };
}

function affordsAnyTier(state, l) {
  for (let t = 1; t < BET_TIERS.length; t++) if (canBet(state, l, t)) return true;
  return false;
}

/* Place the tray card into lane `l`. If the lane fills to LANE_CAP it resolves
   (scores+clears, or busts+locks). Then the draw transition runs (commits
   pending bets, ticks expiry, deals the next tray). Returns { state, result }.
   Invalid placement (locked/full/no tray) returns the state unchanged with
   result.type === "invalid". */
export function placeCard(state, l) {
  if (!canPlace(state, l)) {
    return { state, result: { type: "invalid", laneIndex: l } };
  }
  const lanes = state.lanes.map((lane) => lane.slice());
  const locked = state.locked.slice();
  const bet = state.bet.slice();
  const betSel = state.betSel.slice();
  let { chips, score, discard } = state;

  lanes[l].push(state.tray);

  let resolution = null;
  if (lanes[l].length === LANE_CAP) {
    resolution = resolveLane({ lane: lanes[l], committed: bet[l], l });
    score += resolution.points;
    chips += resolution.chipsReturned;
    if (resolution.scored) {
      lanes[l] = []; // clear
      discard = true; // any scoring hand refreshes the discard (§5/§13)
    } else {
      locked[l] = true; // bust: lane locks; keep the cards for the cracked visual
    }
    bet[l] = null;
    betSel[l] = NO_BET;
  }

  let next = { ...state, lanes, locked, bet, betSel, chips, score, discard };
  const expired = [];
  drawInto(next, expired);
  next.over = isGameOver(next);

  const chipsDelta = next.chips - state.chips;
  return {
    state: next,
    result: {
      type: "place",
      laneIndex: l,
      resolution,
      expired,
      discarded: false,
      burned: false,
      chipsDelta,
      discardRefreshed: !state.discard && next.discard,
    },
  };
}

/* Spend the single discard to throw the tray card away (doc §5). Requires the
   discard to be charged; does NOT place the card or resolve a lane, but the
   draw it triggers can still commit/expire bets. No-op if uncharged. */
export function useDiscard(state) {
  if (state.over || !state.discard || state.tray == null) {
    return { state, result: { type: "invalid", laneIndex: -1 } };
  }
  let next = { ...state, discard: false };
  const expired = [];
  drawInto(next, expired);
  next.over = isGameOver(next);
  return {
    state: next,
    result: {
      type: "discard",
      laneIndex: -1,
      resolution: null,
      expired,
      discarded: true,
      burned: false,
      chipsDelta: 0,
      discardRefreshed: false,
    },
  };
}

/* Panic-mode timeout: burn the tray card (doc §14). Like useDiscard but never
   touches the discard charge — the card is simply lost and a new one is drawn
   (which can still tick bets). */
export function burnCard(state) {
  if (state.over || state.tray == null) {
    return { state, result: { type: "invalid", laneIndex: -1 } };
  }
  let next = { ...state };
  const expired = [];
  drawInto(next, expired);
  next.over = isGameOver(next);
  return {
    state: next,
    result: {
      type: "discard",
      laneIndex: -1,
      resolution: null,
      expired,
      discarded: false,
      burned: true,
      chipsDelta: 0,
      discardRefreshed: false,
    },
  };
}

/* ── internals ─────────────────────────────────────────────────────────────── */

/* Resolve a full (5-card) lane. Returns a rich result the view can animate:
   { laneIndex, hand, scored, busted, basePoints, bet:{tier,won}|null,
     multiplier, points, chipsReturned, chipsLost, cleared }.
   Chips were already spent at commit time, so chipsReturned is what comes BACK
   (stake + profit on a win; 0 otherwise) and chipsLost is the forfeited stake. */
function resolveLane({ lane, committed, l }) {
  const hand = evaluate(lane);
  const scored = hand.rank >= PAYING_MIN;
  const base = scored ? HAND_POINTS[hand.rank] || 0 : 0;

  let multiplier = 1;
  let chipsReturned = 0;
  let chipsLost = 0;
  let betInfo = null;

  if (committed) {
    const tier = BET_TIERS[committed.tier];
    const won = scored && hand.rank >= tier.min;
    betInfo = { tier: committed.tier, won };
    if (won) {
      multiplier = tier.mult;
      chipsReturned = tier.cost + tier.profit; // get the stake back plus profit
    } else {
      chipsLost = tier.cost; // already spent at commit; nothing comes back
    }
  }

  return {
    laneIndex: l,
    hand,
    scored,
    busted: !scored,
    basePoints: base,
    bet: betInfo,
    multiplier,
    points: base * multiplier,
    chipsReturned,
    chipsLost,
    cleared: scored,
  };
}

/* The draw transition — the single place where bets commit and expiry ticks.
   Mutates `state` in place (the caller already cloned what it needs). Pushes any
   bets that expire on this draw into `expired` (when provided).
   Order matters:
     1. refill / exhaust the bag
     2. COMMIT pending previews (reserve chips, start their countdown)
     3. DECREMENT pre-existing committed bets (NOT the ones just committed) and
        fail any that hit 0
     4. deal the next tray
   Skipping step-2 lanes in step 3 makes "expires after N draws" mean N
   SUBSEQUENT draws — a bet is never decremented by the draw that created it. */
function drawInto(state, expired) {
  // 1. bag
  if (state.bag.length === 0) {
    if (state.oneDeck) {
      state.tray = null; // deck exhausted — One-Deck run ends
      return;
    }
    state.bag = shuffle(freshDeck(), state.rng);
  }

  // 2. commit previews. The preview was already validated against the §8 rules
  // when it was selected (cycleBet); commitment only re-checks that the wager is
  // still affordable and the lane is still alive. We deliberately do NOT re-apply
  // the made-hand / card-count rules here — the lane legitimately gains a card as
  // part of this very transition, so a bet placed on a no-hand lane must survive
  // the card that (say) pairs it.
  const justCommitted = new Set();
  const bet = state.bet.slice();
  const betSel = state.betSel.slice();
  for (let l = 0; l < LANES; l++) {
    if (betSel[l] === NO_BET || bet[l] != null) continue;
    const tier = BET_TIERS[betSel[l]];
    if (!state.locked[l] && state.chips >= tier.cost) {
      state.chips -= tier.cost;
      bet[l] = { tier: betSel[l], draws: BET_EXPIRY_DRAWS };
      justCommitted.add(l);
    } else {
      betSel[l] = NO_BET; // can no longer afford it / lane died — drop the preview
    }
  }

  // 3. tick expiry on older committed bets
  for (let l = 0; l < LANES; l++) {
    if (bet[l] == null || justCommitted.has(l)) continue;
    const draws = bet[l].draws - 1;
    if (draws <= 0) {
      if (expired) expired.push({ laneIndex: l, tier: bet[l].tier });
      bet[l] = null; // stake already lost at commit; lane stays playable
      betSel[l] = NO_BET;
    } else {
      bet[l] = { ...bet[l], draws };
    }
  }

  state.bet = bet;
  state.betSel = betSel;

  // 4. deal
  state.tray = { ...state.bag[0], faceUp: true };
  state.bag = state.bag.slice(1);
  state.draws += 1;
}
