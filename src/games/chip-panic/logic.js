/* High Card Bust — pure game logic (no React, no DOM).
   A turn-based poker solitaire with a chip economy and rotating objectives.

   Five lanes, each holding up to five cards. The player draws ONE card at a time
   into a tray, then places it into a lane (or spends a discard to throw it away).

   ECONOMY — chips are survival:
     * Opening an empty lane costs a Blue ANTE, paid on the first card placed there.
       An "anted" lane is active until it resolves. The ante RISES over the run
       (poker-blinds pressure): every few scoring hands / Wanted completions it
       climbs by 1 and never drops, so late lanes cost more to open.
     * You only need chips to OPEN a new lane or RAISE; an already-anted lane is
       always playable, even at 0 chips. The run ends only when all five lanes are
       locked, or no legal placement exists for the current tray.

   RESOLUTION — a full (5-card) lane resolves three ways:
     * HIGH CARD      → BUST + LOCK (permanent). Ante + any raise lost; streak resets.
     * ANY PAIR       → a defensive SAVE: the lane CLEARS (slot freed) but scores 0,
                        the ante is lost, no chips returned, the discard does NOT
                        refresh, and the streak is unchanged.
     * TWO PAIR or +  → a true SCORE: base points, ante returned (+profit), any
                        winning raise multiplies the score and pays profit, the
                        discard refreshes, and a matching WANTED hand pays its bonus.

   RAISES — optional, on an already-anted lane: cycle Red/Gold/Black to wager more
   for a bigger multiplier. A raise commits on the next draw and must land within
   BET_EXPIRY_DRAWS draws or it's forfeited.

   WANTED HANDS — one rotating target. A lane resolving as EXACTLY the wanted hand
   (Royal also satisfies a Straight-Flush wanted) pays bonus points + chips and
   advances the Wanted Streak (milestones at 2/3/4/5). The streak resets when a lane
   busts. Difficulty pool escalates with the streak.

   Kept view-free + unit-testable: every function returns NEW state and the view
   holds it. The drawn `tray` lives in engine state so ante/raise commitment and
   expiry happen in a single deterministic draw transition. Shares deck.js /
   handEval.js with the other card cabinets. */

import { freshDeck, shuffle } from "../cards/deck.js";
import { evaluate, bestMadeHand, HAND, HAND_NAME } from "../poker/handEval.js";

export const LANES = 5;
export const LANE_CAP = 5; // a full lane = 5 cards = one poker hand
export const START_CHIPS = 12;
export const BET_EXPIRY_DRAWS = 5; // a committed raise must land within this many draws
export const RAISE_MAX_CARDS = 3; // a lane can only be newly raised at <= this many cards

export const ANTE_TIER = 1; // index into TIERS — Blue is the ante baseline
export const BASE_ANTE = 1; // chips to open a lane at the start of a run
export const ANTE_PROFIT = 1; // FLAT chips returned ABOVE the (paid) ante on a true score
// Rising ante (poker-blinds pressure): the cost to open a lane climbs as the run
// goes. Every SCORE_HANDS_PER_ANTE scoring hands AND every WANTED_HITS_PER_ANTE
// Wanted completions each add 1, stacking additively. It never goes back down.
export const SCORE_HANDS_PER_ANTE = 5;
export const WANTED_HITS_PER_ANTE = 2;

// Current cost to open a lane, derived purely from cumulative progress.
export function anteFor(scoreHands, wantedHits) {
  return BASE_ANTE
    + Math.floor(scoreHands / SCORE_HANDS_PER_ANTE)
    + Math.floor(wantedHits / WANTED_HITS_PER_ANTE);
}
export const SCORE_MIN = HAND.TWO_PAIR; // two pair or better truly scores
export const SAVE_HAND = HAND.PAIR; // any pair is a defensive save (clears, no score)

// Base points per hand category on a true score. (A pair never scores — it's only
// a save — so HAND.PAIR is intentionally absent.)
export const HAND_POINTS = {
  [HAND.TWO_PAIR]: 25,
  [HAND.THREE]: 40,
  [HAND.STRAIGHT]: 60,
  [HAND.FLUSH]: 75,
  [HAND.FULL_HOUSE]: 100,
  [HAND.FOUR]: 200,
  [HAND.STRAIGHT_FLUSH]: 500,
  [HAND.ROYAL_FLUSH]: 1000,
};

/* Chip tiers. Index 0 ("ante") is the mandatory Blue ante every active lane pays;
   indices 1+ are optional RAISES layered on top. A raise WINS if the lane resolves
   with rank >= `min`; `mult` multiplies the base points; `profit` is chips returned
   ABOVE the raise stake on a win. `extra` is the chips a raise costs beyond the ante
   already paid. `color` is the Kenney chip art name (Gold → green; no gold art).
   The color sequence here (blue, red, green, black) is the canonical CHIP_ORDER
   (src/lib/kenney.js) that Blackjack and Video Poker also follow. */
export const TIERS = [
  { key: "ante",  label: "Ante",  color: "blue",  extra: 0, min: SCORE_MIN,      mult: 1, profit: 0, reqLabel: "TWO PAIR+" },
  { key: "red",   label: "Red",   color: "red",   extra: 1, min: HAND.THREE,     mult: 3, profit: 1, reqLabel: "TRIPS+" },
  { key: "gold",  label: "Gold",  color: "green", extra: 2, min: HAND.STRAIGHT,  mult: 5, profit: 2, reqLabel: "STRAIGHT+" },
  { key: "black", label: "Black", color: "black", extra: 4, min: HAND.FULL_HOUSE, mult: 8, profit: 3, reqLabel: "FULL HOUSE+" },
];
export const NO_RAISE = 0; // raiseSel value meaning "ante only, no raise"

/* Wanted Hands — flat bonus rewards (separate from the bet multiplier). Pairs are
   never wanted (they don't score). */
export const WANTED_REWARDS = {
  [HAND.TWO_PAIR]: { pts: 50, chips: 1 },
  [HAND.THREE]: { pts: 100, chips: 2 },
  [HAND.STRAIGHT]: { pts: 150, chips: 3 },
  [HAND.FLUSH]: { pts: 175, chips: 3 },
  [HAND.FULL_HOUSE]: { pts: 250, chips: 4 },
  [HAND.FOUR]: { pts: 500, chips: 6 },
  [HAND.STRAIGHT_FLUSH]: { pts: 1000, chips: 8 },
  [HAND.ROYAL_FLUSH]: { pts: 2500, chips: 10 },
};

// Difficulty pools, chosen by current streak. Pairs excluded.
const WANTED_POOLS = {
  early: [HAND.TWO_PAIR, HAND.THREE],
  mid: [HAND.STRAIGHT, HAND.FLUSH, HAND.FULL_HOUSE],
  late: [HAND.FULL_HOUSE, HAND.FOUR],
  jackpot: [HAND.STRAIGHT_FLUSH, HAND.ROYAL_FLUSH],
};
const JACKPOT_CHANCE = 0.08; // small chance to roll a jackpot target at higher streaks

// Pick a wanted target appropriate to the streak. 0–1 early, 2–3 mid, 4+ late, with
// a small jackpot chance once past the early game.
export function pickWanted(streak, rng = Math.random) {
  let pool;
  if (streak >= 2 && rng() < JACKPOT_CHANCE) pool = WANTED_POOLS.jackpot;
  else if (streak <= 1) pool = WANTED_POOLS.early;
  else if (streak <= 3) pool = WANTED_POOLS.mid;
  else pool = WANTED_POOLS.late;
  const hand = pool[Math.floor(rng() * pool.length)];
  const r = WANTED_REWARDS[hand];
  return { hand, name: HAND_NAME[hand], bonusPts: r.pts, bonusChips: r.chips };
}

/* Streak-milestone modifiers applied to a Wanted bonus at completion, keyed by the
   streak the completion PRODUCES (1-indexed):
     2 → +25% pts, 3 → +1 chip, 4 → +50% pts, 5 → unlock one locked lane.
   Returns { ptsMult, chipAdd, unlockLane }. */
export function streakBonus(newStreak) {
  let ptsMult = 1;
  let chipAdd = 0;
  let unlockLane = false;
  if (newStreak === 2) ptsMult = 1.25;
  else if (newStreak === 3) chipAdd = 1;
  else if (newStreak === 4) ptsMult = 1.5;
  else if (newStreak >= 5) unlockLane = true;
  return { ptsMult, chipAdd, unlockLane };
}

// Does a resolved hand complete the wanted target? Exact match, except a Royal
// Flush also satisfies a Straight-Flush wanted (it's a special straight flush).
export function completesWanted(handRank, wantedHand) {
  if (handRank === wantedHand) return true;
  if (wantedHand === HAND.STRAIGHT_FLUSH && handRank === HAND.ROYAL_FLUSH) return true;
  return false;
}

/* Fresh game state. */
export function newGame({ oneDeck = false, rng = Math.random } = {}) {
  const state = {
    lanes: Array.from({ length: LANES }, () => []),
    locked: Array(LANES).fill(false),
    anted: Array(LANES).fill(false), // lane has paid its ante (is open/active)
    anteAmt: Array(LANES).fill(0), // chips actually paid to open each lane (for refund)
    raise: Array(LANES).fill(null), // committed raise { tier, draws } | null
    raiseSel: Array(LANES).fill(NO_RAISE), // previewed raise tier (cycles among affordable)
    tray: null,
    bag: shuffle(freshDeck(), rng),
    oneDeck,
    rng,
    chips: START_CHIPS,
    discard: true, // starts charged
    score: 0,
    streak: 0,
    scoreHands: 0, // cumulative true scores (drives the rising ante)
    wantedHits: 0, // cumulative Wanted completions (drives the rising ante)
    draws: 0,
    over: false,
    wanted: null,
  };
  state.wanted = pickWanted(0, rng);
  // Deal the opening card so PLAY always has something in the tray.
  drawInto(state, null);
  return state;
}

export const laneFull = (lane) => lane.length >= LANE_CAP;

// The current cost to open a new lane (rises with progress).
export const currentAnte = (state) => anteFor(state.scoreHands, state.wantedHits);

// Can the current tray be placed into lane `l`? An empty lane requires either an
// ante already paid or enough chips to pay it now; a non-empty anted lane is always
// playable. Locked/full/no-tray block.
export function canPlace(state, l) {
  if (state.over || state.locked[l] || state.tray == null) return false;
  if (laneFull(state.lanes[l])) return false;
  if (state.lanes[l].length === 0 && !state.anted[l]) {
    return state.chips >= currentAnte(state); // need to afford the ante to open it
  }
  return true;
}

// Is there ANY lane the current tray can legally go into?
export function anyPlacement(state) {
  if (state.tray == null) return false;
  for (let l = 0; l < LANES; l++) if (canPlace(state, l)) return true;
  return false;
}

// The run ends when every lane is locked, the One-Deck bag is spent, or the player
// is stuck — a tray with nowhere legal to place it (e.g. 0 chips and only empty,
// unaffordable lanes left).
export function isGameOver(state) {
  if (state.locked.every(Boolean)) return true;
  if (state.oneDeck && state.bag.length === 0 && state.tray == null) return true;
  if (state.tray != null && !anyPlacement(state)) return true;
  return false;
}

/* Can lane `l` take a new RAISE at tier `tierIndex`? A raise needs the lane already
   anted (open), unlocked, holding 1..RAISE_MAX_CARDS cards with no made hand yet,
   and enough chips for the extra cost. Tier 0 (ante) is not a raise. */
export function canRaise(state, l, tierIndex) {
  if (state.over || state.locked[l]) return false;
  if (tierIndex === NO_RAISE) return true;
  const tier = TIERS[tierIndex];
  if (!tier) return false;
  if (!state.anted[l]) return false; // must open the lane (ante) before raising
  const lane = state.lanes[l];
  if (lane.length < 1 || lane.length > RAISE_MAX_CARDS) return false;
  if (bestMadeHand(lane) !== HAND.HIGH_CARD) return false;
  if (state.chips < tier.extra) return false;
  return true;
}

// Cycle the previewed raise on lane `l` to the next affordable+eligible tier,
// wrapping back to NO_RAISE. Reserves no chips (commit happens on the next draw).
export function cycleRaise(state, l) {
  if (!affordsAnyRaise(state, l)) {
    if (state.raiseSel[l] === NO_RAISE) return state;
    const raiseSel = state.raiseSel.slice();
    raiseSel[l] = NO_RAISE;
    return { ...state, raiseSel };
  }
  const raiseSel = state.raiseSel.slice();
  let next = raiseSel[l];
  for (let step = 0; step < TIERS.length; step++) {
    next = (next + 1) % TIERS.length;
    if (next === NO_RAISE || canRaise(state, l, next)) break;
  }
  raiseSel[l] = next;
  return { ...state, raiseSel };
}

function affordsAnyRaise(state, l) {
  for (let t = 1; t < TIERS.length; t++) if (canRaise(state, l, t)) return true;
  return false;
}

/* Place the tray card into lane `l`. Opening an empty lane pays the ante. If the
   lane fills to LANE_CAP it resolves (three-way). Then the draw transition runs
   (commits pending raises, ticks expiry, deals the next tray). Returns
   { state, result }. Invalid placement returns the state unchanged. */
export function placeCard(state, l) {
  if (!canPlace(state, l)) {
    return { state, result: { type: "invalid", laneIndex: l } };
  }
  const lanes = state.lanes.map((lane) => lane.slice());
  const locked = state.locked.slice();
  const anted = state.anted.slice();
  const anteAmt = state.anteAmt.slice();
  const raise = state.raise.slice();
  const raiseSel = state.raiseSel.slice();
  let { chips, score, discard, streak, wanted, scoreHands, wantedHits } = state;

  // Opening an empty lane pays the current (rising) ante; remember what was paid so
  // it can be refunded on a true score / forfeited on a loss.
  let antePaid = false;
  if (lanes[l].length === 0 && !anted[l]) {
    const ante = currentAnte(state);
    chips -= ante;
    anted[l] = true;
    anteAmt[l] = ante;
    antePaid = true;
  }

  lanes[l].push(state.tray);

  let resolution = null;
  let wantedClaim = null;
  if (lanes[l].length === LANE_CAP) {
    const r = resolveLane({ lane: lanes[l], committedRaise: raise[l], antePaidAmt: anteAmt[l], wanted, streak, l });
    resolution = r;
    score += r.points;
    chips += r.chipsReturned;

    if (r.bust) {
      locked[l] = true; // keep cards for the cracked visual
      streak = 0; // a bust resets the wanted streak
    } else {
      // SAVE or SCORE both clear the lane.
      lanes[l] = [];
      anted[l] = false;
      if (r.scored) { discard = true; scoreHands += 1; } // a true score refreshes discard + counts toward the rising ante
    }
    anteAmt[l] = 0;

    // Apply a completed Wanted (only on a true score; resolveLane decided it).
    if (r.wanted && r.wanted.hit) {
      wantedClaim = r.wanted;
      score += r.wanted.totalPts;
      chips += r.wanted.totalChips;
      streak = r.wanted.streak;
      wantedHits += 1; // Wanted completions also raise the ante
      if (r.wanted.unlockLane) {
        const u = firstLocked(locked);
        if (u !== -1) { locked[u] = false; lanes[u] = []; anted[u] = false; anteAmt[u] = 0; }
      }
      wanted = pickWanted(streak, state.rng);
    }

    raise[l] = null;
    raiseSel[l] = NO_RAISE;
  }

  let next = { ...state, lanes, locked, anted, anteAmt, raise, raiseSel, chips, score, discard, streak, wanted, scoreHands, wantedHits };
  const expired = [];
  drawInto(next, expired);
  next.over = isGameOver(next);

  return {
    state: next,
    result: {
      type: "place",
      laneIndex: l,
      antePaid,
      resolution,
      wanted: wantedClaim,
      expired,
      discarded: false,
      burned: false,
      chipsDelta: next.chips - state.chips,
      discardRefreshed: !state.discard && next.discard,
      streakReset: resolution && resolution.bust && state.streak > 0,
    },
  };
}

/* Spend the single discard to throw the tray card away. Requires the discard to be
   charged; does NOT place a card or resolve a lane, but the draw it triggers can
   still commit/expire raises. No-op if uncharged. */
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
    result: { type: "discard", laneIndex: -1, resolution: null, wanted: null, expired, discarded: true, burned: false, chipsDelta: 0, discardRefreshed: false },
  };
}

/* Panic-mode timeout: burn the tray card. Like useDiscard but never touches the
   discard charge — the card is lost and a new one is drawn. */
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
    result: { type: "discard", laneIndex: -1, resolution: null, wanted: null, expired, discarded: false, burned: true, chipsDelta: 0, discardRefreshed: false },
  };
}

/* ── internals ─────────────────────────────────────────────────────────────── */

const firstLocked = (locked) => locked.findIndex(Boolean);

/* Resolve a full (5-card) lane three ways. Returns a rich result for the view:
   { laneIndex, hand, bust, saved, scored, basePoints, raise:{tier,won}|null,
     multiplier, points, chipsReturned, chipsLost, cleared, wanted } where wanted
     (when the hand completes the current target) =
     { hit, hand, bonusPts, bonusChips, totalPts, totalChips, streak, unlockLane }.
   Chips were spent at ante/commit time; chipsReturned is what comes BACK. */
function resolveLane({ lane, committedRaise, antePaidAmt, wanted, streak, l }) {
  const hand = evaluate(lane);
  const bust = hand.rank === HAND.HIGH_CARD;
  const saved = hand.rank === SAVE_HAND; // any pair
  const scored = hand.rank >= SCORE_MIN; // two pair or better
  const anted = antePaidAmt > 0;

  let multiplier = 1;
  let chipsReturned = 0;
  let chipsLost = 0;
  let raiseInfo = null;
  let base = 0;

  if (scored) {
    base = HAND_POINTS[hand.rank] || 0;
    // Refund exactly what was paid to open the lane, plus a FLAT profit (the ante
    // rises over the run but the profit stays fixed — Wanted hands are the real
    // way to get ahead).
    if (anted) chipsReturned += antePaidAmt + ANTE_PROFIT;
    if (committedRaise) {
      const tier = TIERS[committedRaise.tier];
      const won = hand.rank >= tier.min;
      raiseInfo = { tier: committedRaise.tier, won };
      if (won) {
        multiplier = tier.mult;
        chipsReturned += tier.extra + tier.profit; // raise stake back + profit
      } else {
        chipsLost += tier.extra; // raise stake forfeited
      }
    }
  } else {
    // BUST or SAVE: the ante actually paid + any raise stake are forfeited.
    if (anted) chipsLost += antePaidAmt;
    if (committedRaise) {
      chipsLost += TIERS[committedRaise.tier].extra;
      raiseInfo = { tier: committedRaise.tier, won: false };
    }
  }

  const points = base * multiplier;

  // Wanted completion only on a true score (pairs/high-card can't complete; pairs
  // aren't in the pool anyway).
  let wantedResult = null;
  if (scored && wanted && completesWanted(hand.rank, wanted.hand)) {
    const newStreak = streak + 1;
    const sb = streakBonus(newStreak);
    const totalPts = Math.round(wanted.bonusPts * sb.ptsMult);
    const totalChips = wanted.bonusChips + sb.chipAdd;
    wantedResult = {
      hit: true,
      hand: wanted.hand,
      bonusPts: wanted.bonusPts,
      bonusChips: wanted.bonusChips,
      totalPts,
      totalChips,
      streak: newStreak,
      unlockLane: sb.unlockLane,
    };
  }

  return {
    laneIndex: l,
    hand,
    bust,
    saved,
    scored,
    basePoints: base,
    raise: raiseInfo,
    multiplier,
    points,
    chipsReturned,
    chipsLost,
    cleared: scored || saved,
    wanted: wantedResult,
  };
}

/* The draw transition — the single place where raises commit and expiry ticks.
   Mutates `state` in place (the caller already cloned what it needs). Pushes any
   raises that expire on this draw into `expired`. Order: refill/exhaust bag →
   COMMIT previews → DECREMENT older committed raises → deal the next tray. A raise
   is never decremented by the draw that created it (N subsequent draws). */
function drawInto(state, expired) {
  // 1. bag
  if (state.bag.length === 0) {
    if (state.oneDeck) { state.tray = null; return; }
    state.bag = shuffle(freshDeck(), state.rng);
  }

  // 2. commit previewed raises (only on still-anted, still-alive, affordable lanes)
  const justCommitted = new Set();
  const raise = state.raise.slice();
  const raiseSel = state.raiseSel.slice();
  for (let l = 0; l < LANES; l++) {
    if (raiseSel[l] === NO_RAISE || raise[l] != null) continue;
    const tier = TIERS[raiseSel[l]];
    if (!state.locked[l] && state.anted[l] && state.chips >= tier.extra) {
      state.chips -= tier.extra;
      raise[l] = { tier: raiseSel[l], draws: BET_EXPIRY_DRAWS };
      justCommitted.add(l);
    } else {
      raiseSel[l] = NO_RAISE; // can no longer afford / lane closed — drop the preview
    }
  }

  // 3. tick expiry on older committed raises
  for (let l = 0; l < LANES; l++) {
    if (raise[l] == null || justCommitted.has(l)) continue;
    const draws = raise[l].draws - 1;
    if (draws <= 0) {
      if (expired) expired.push({ laneIndex: l, tier: raise[l].tier });
      raise[l] = null; // stake already lost at commit; lane stays playable
      raiseSel[l] = NO_RAISE;
    } else {
      raise[l] = { ...raise[l], draws };
    }
  }

  state.raise = raise;
  state.raiseSel = raiseSel;

  // 4. deal
  state.tray = { ...state.bag[0], faceUp: true };
  state.bag = state.bag.slice(1);
  state.draws += 1;
}
