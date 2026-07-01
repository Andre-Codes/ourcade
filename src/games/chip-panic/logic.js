/* High Card Bust — pure game logic (no React, no DOM).
   A turn-based poker solitaire with a chip economy and rotating objectives.

   Four lanes, each holding up to five cards. The player draws ONE card at a time
   into a tray, then places it into a lane (or spends a discard to throw it away).

   ECONOMY — chips are survival:
     * Opening an empty lane costs a Blue ANTE, paid on the first card placed there.
       An "anted" lane is active until it resolves. The ante RISES over the run
       (poker-blinds pressure): every few scoring hands / Wanted completions it
       climbs by 1 and never drops, so late lanes cost more to open.
     * You only need chips to OPEN a new lane or RAISE; an already-anted lane is
       always playable, even at 0 chips. The run ends only when all four lanes are
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

   WANTED — one rotating target, either a HAND (resolve as exactly that category,
   capped at Four of a Kind) or a CONDITION (a predicate over the 5 cards — All Red,
   No Faces, Blackjack 21, … — that still requires a true Two-Pair+ score). Completing
   it pays bonus points + chips and advances the Wanted Streak (milestones at 2/3/4/5,
   which resets when a lane busts). Difficulty pool escalates with the streak.

   JACKPOT — an always-on side goal: resolving ANY lane as a Straight Flush or Royal
   Flush (regardless of the current wanted) pays a huge reward and advances the streak
   like a wanted. SF/Royal are no longer wanted targets.

   Kept view-free + unit-testable: every function returns NEW state and the view
   holds it. The drawn `tray` lives in engine state so ante/raise commitment and
   expiry happen in a single deterministic draw transition. Shares deck.js /
   handEval.js with the other card cabinets. */

import { freshDeck, shuffle, isRed } from "../cards/deck.js";
import { evaluate, bestMadeHand, HAND, HAND_NAME } from "../poker/handEval.js";

export const LANES = 4;
export const LANE_CAP = 5; // a full lane = 5 cards = one poker hand
export const START_CHIPS = 12;
export const BET_EXPIRY_DRAWS = 5; // a committed raise must land within this many draws
export const RAISE_MAX_CARDS = 3; // a lane can only be newly raised at <= this many cards

export const ANTE_TIER = 1; // index into TIERS — Blue is the ante baseline
export const BASE_ANTE = 1; // chips to open a lane at the start of a run
export const ANTE_PROFIT = 1; // FLAT chips returned ABOVE the (paid) ante on a true score
// Rising ante (poker-blinds pressure): the cost to open a lane climbs as the run
// goes. Every SCORE_HANDS_PER_ANTE scoring hands, every WANTED_HITS_PER_ANTE
// Wanted completions, AND every DRAWS_PER_ANTE cards drawn each add 1, stacking
// additively. It never goes back down.
export const SCORE_HANDS_PER_ANTE = 5;
export const WANTED_HITS_PER_ANTE = 2;
export const DRAWS_PER_ANTE = 20; // every 20 cards drawn, ante +1

// Current cost to open a lane, derived purely from cumulative progress.
export function anteFor(scoreHands, wantedHits, draws = 0) {
  return BASE_ANTE
    + Math.floor(scoreHands / SCORE_HANDS_PER_ANTE)
    + Math.floor(wantedHits / WANTED_HITS_PER_ANTE)
    + Math.floor(draws / DRAWS_PER_ANTE);
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
   never wanted (they don't score). Straight Flush / Royal Flush are NOT wanted
   targets anymore — they're the always-present JACKPOT side goal (see below) — but
   their rewards stay defined here for reference / parity. */
export const WANTED_REWARDS = {
  [HAND.TWO_PAIR]: { pts: 50, chips: 1 },
  [HAND.THREE]: { pts: 100, chips: 2 },
  [HAND.STRAIGHT]: { pts: 150, chips: 3 },
  [HAND.FLUSH]: { pts: 175, chips: 3 },
  [HAND.FULL_HOUSE]: { pts: 250, chips: 4 },
  [HAND.FOUR]: { pts: 500, chips: 6 },
};

/* Wanted Conditions — predicate objectives over the 5 resolved cards. A condition
   wanted is claimed when the lane truly SCORES (Two Pair+, the same floor as a hand
   wanted — enforced by the caller) AND its `test` passes. Pure, view-free; faces are
   ranks 11/12/13 and the Ace is rank 1. */
const FACE = (r) => r === 11 || r === 12 || r === 13;

// Best blackjack total of the 5 cards: J/Q/K = 10, Ace = 11 (demoted to 1 while the
// total busts and an 11-ace remains), others face value.
export function blackjackTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) { total += 11; aces++; }
    else if (FACE(c.rank)) total += 10;
    else total += c.rank;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

const suitCounts = (cards) => {
  const m = {};
  for (const c of cards) m[c.suit] = (m[c.suit] || 0) + 1;
  return m;
};

export const WANTED_CONDS = {
  allRed:   { key: "allRed",   name: "All Red",       test: (cs) => cs.every((c) => isRed(c.suit)) },
  allBlack: { key: "allBlack", name: "All Black",     test: (cs) => cs.every((c) => !isRed(c.suit)) },
  noFaces:  { key: "noFaces",  name: "No Faces",      test: (cs) => cs.every((c) => !FACE(c.rank)) },
  faceParty:{ key: "faceParty",name: "Face Party",    test: (cs) => cs.filter((c) => FACE(c.rank)).length >= 3 },
  ace:      { key: "ace",      name: "Ace Wanted",    test: (cs) => cs.some((c) => c.rank === 1) },
  lucky7:   { key: "lucky7",   name: "Lucky 7",       test: (cs) => cs.some((c) => c.rank === 7) },
  rainbow:  { key: "rainbow",  name: "Rainbow Lane",  test: (cs) => Object.keys(suitCounts(cs)).length === 4 },
  suitMaj:  { key: "suitMaj",  name: "Suit Majority", test: (cs) => Object.values(suitCounts(cs)).some((n) => n >= 3) },
  noOdds:   { key: "noOdds",   name: "No Odds",       test: (cs) => cs.every((c) => c.rank !== 1 && c.rank % 2 === 0) },
  bj21:     { key: "bj21",     name: "Blackjack 21",  test: (cs) => blackjackTotal(cs) === 21 },
};

/* Plain-English "how to complete it" prose for each condition wanted, shown in the
   rules-status popup. Every condition still requires a true Two-Pair+ SCORE on top. */
export const WANTED_COND_HINT = {
  allRed:    "all five cards are hearts or diamonds",
  allBlack:  "all five cards are spades or clubs",
  noFaces:   "no Jacks, Queens, or Kings in the lane",
  faceParty: "at least three face cards (J/Q/K)",
  ace:       "the lane contains at least one Ace",
  lucky7:    "the lane contains at least one 7",
  rainbow:   "one of each suit appears in the lane",
  suitMaj:   "at least three cards share a suit",
  noOdds:    "every card is an even number (no aces, no odds)",
  bj21:      "the five cards total exactly 21 (blackjack)",
};

// Plain-English "how to complete it" prose for a wanted (hand or condition), for the
// rules-status popup. Falls back gracefully for older/stubbed wanted objects.
export function wantedHint(wanted) {
  if (!wanted) return "";
  if (wanted.kind === "cond") return WANTED_COND_HINT[wanted.cond] || "";
  return `resolve a lane as exactly ${(HAND_NAME[wanted.hand] || "this hand").toUpperCase()}`;
}

export const WANTED_COND_REWARDS = {
  allRed:    { pts: 75,  chips: 2 },
  allBlack:  { pts: 75,  chips: 2 },
  noFaces:   { pts: 100, chips: 2 },
  faceParty: { pts: 125, chips: 3 },
  ace:       { pts: 60,  chips: 2 },
  lucky7:    { pts: 60,  chips: 2 },
  rainbow:   { pts: 175, chips: 3 },
  suitMaj:   { pts: 100, chips: 2 },
  noOdds:    { pts: 175, chips: 3 },
  bj21:      { pts: 200, chips: 4 },
};

/* The always-present JACKPOT side goal: resolving ANY lane as a Straight Flush or
   Royal Flush — regardless of the current wanted — pays a huge reward + celebration.
   (Base points still come from HAND_POINTS; this is the bonus on top.) */
export const JACKPOT_HANDS = new Set([HAND.STRAIGHT_FLUSH, HAND.ROYAL_FLUSH]);
export const JACKPOT_REWARDS = {
  [HAND.STRAIGHT_FLUSH]: { pts: 1000, chips: 8 },
  [HAND.ROYAL_FLUSH]: { pts: 2500, chips: 10 },
};

// Difficulty pools, chosen by current streak. Each entry is a tagged candidate:
// { kind:"hand", hand } or { kind:"cond", cond }. Pairs excluded; jackpot hands
// (SF/Royal) are NOT here — they're the always-on side goal. Pools mix hands +
// conditions and cap hand targets at Four of a Kind.
const H = (hand) => ({ kind: "hand", hand });
const C = (cond) => ({ kind: "cond", cond });
const WANTED_POOLS = {
  early: [H(HAND.TWO_PAIR), H(HAND.THREE), C("ace"), C("lucky7"), C("allRed"), C("allBlack")],
  mid: [H(HAND.STRAIGHT), H(HAND.FLUSH), H(HAND.FULL_HOUSE), C("noFaces"), C("faceParty"), C("suitMaj"), C("rainbow")],
  late: [H(HAND.FULL_HOUSE), H(HAND.FOUR), C("bj21"), C("noOdds"), C("faceParty")],
};

// Resolve a tagged candidate into a full wanted object with name + reward.
function buildWanted(candidate) {
  if (candidate.kind === "cond") {
    const def = WANTED_CONDS[candidate.cond];
    const r = WANTED_COND_REWARDS[candidate.cond];
    return { kind: "cond", cond: candidate.cond, name: def.name, bonusPts: r.pts, bonusChips: r.chips };
  }
  const r = WANTED_REWARDS[candidate.hand];
  return { kind: "hand", hand: candidate.hand, name: HAND_NAME[candidate.hand], bonusPts: r.pts, bonusChips: r.chips };
}

// Pick a wanted target appropriate to the streak. 0–1 early, 2–3 mid, 4+ late.
export function pickWanted(streak, rng = Math.random) {
  let pool;
  if (streak <= 1) pool = WANTED_POOLS.early;
  else if (streak <= 3) pool = WANTED_POOLS.mid;
  else pool = WANTED_POOLS.late;
  return buildWanted(pool[Math.floor(rng() * pool.length)]);
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

// Does a resolved lane complete the wanted target? Only ever called once the lane
// has truly SCORED (Two Pair+), so conditions get their "must still score" floor for
// free. A hand wanted is an exact category match; a condition wanted runs its
// predicate over the resolved cards. `wanted` lacking a `kind` is treated as a hand
// target (back-compat for older/stubbed objects).
export function completesWanted(handRank, wanted, cards) {
  if (!wanted) return false;
  if (wanted.kind === "cond") {
    const def = WANTED_CONDS[wanted.cond];
    return !!def && def.test(cards);
  }
  return handRank === wanted.hand;
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
    handStats: {}, // hand rank (HAND.*) → count of lanes resolved as that hand this run
    draws: 0,
    over: false,
    wanted: null,
  };
  state.wanted = pickWanted(0, rng);
  // Deal the opening card so PLAY always has something in the tray.
  drawInto(state, null);
  return state;
}

/* ── save / resume ─────────────────────────────────────────────────────────────
   The state is plain-serializable EXCEPT `rng` (a function — JSON.stringify drops
   it). We strip it on save and reattach Math.random on load; runs aren't seeded,
   and `rng` is only consumed when the bag needs a reshuffle, so a fresh
   Math.random is fine. The drawn `bag` is already a snapshot array, so the deck
   order survives a round-trip. Bump SAVE_VERSION on any incompatible shape change
   so old saves are discarded rather than mis-hydrated. */
export const SAVE_VERSION = 2; // v2 adds handStats to the run snapshot

// A run worth saving: in progress and not finished.
export const isSaveable = (state) => !!state && !state.over;

/* Return a plain, JSON-safe snapshot of the run (drops the rng function). */
export function serializeGame(state) {
  if (!state) return null;
  const { rng, ...rest } = state; // eslint-disable-line no-unused-vars
  return { v: SAVE_VERSION, state: rest };
}

/* Rebuild a live game from a serialized snapshot. Returns null (→ fall back to
   New Game) on a version mismatch or any structural surprise. */
export function hydrateGame(saved) {
  if (!saved || saved.v !== SAVE_VERSION || !saved.state) return null;
  const s = saved.state;
  // Minimal structural validation — enough to reject corrupt / stale blobs.
  if (!Array.isArray(s.lanes) || s.lanes.length !== LANES) return null;
  if (!Array.isArray(s.bag) || !Array.isArray(s.locked)) return null;
  if (typeof s.chips !== "number" || typeof s.draws !== "number") return null;
  if (s.over) return null; // finished runs aren't resumable
  return { ...s, handStats: s.handStats || {}, rng: Math.random };
}

export const laneFull = (lane) => lane.length >= LANE_CAP;

// The current cost to open a new lane (rises with progress).
export const currentAnte = (state) => anteFor(state.scoreHands, state.wantedHits, state.draws);

/* Chips currently committed to lane `l` and the multiplier in play — for the
   per-lane "at stake" readout. `atStake` is what's LOST if the lane busts/saves
   (the paid ante + any committed raise stake); `mult` is the points multiplier a
   committed raise would apply on a win (1 = ante only, no raise). Returns null for
   a lane with nothing at stake (not yet anted, or locked). */
export function laneStake(state, l) {
  if (!state.anted[l] || state.locked[l]) return null;
  let atStake = state.anteAmt[l] || 0;
  let mult = 1;
  const r = state.raise[l];
  if (r) {
    const tier = TIERS[r.tier];
    if (tier) { atStake += tier.extra; mult = tier.mult; }
  }
  return { atStake, mult };
}

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
  let handStats = state.handStats;

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
  let jackpotClaim = null;
  if (lanes[l].length === LANE_CAP) {
    const r = resolveLane({ lane: lanes[l], committedRaise: raise[l], antePaidAmt: anteAmt[l], wanted, streak, l });
    resolution = r;
    score += r.points;
    chips += r.chipsReturned;

    // Tally the resolved hand type for the end-of-run breakdown.
    handStats = { ...handStats, [r.hand.rank]: (handStats[r.hand.rank] || 0) + 1 };

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

    // Apply a JACKPOT (SF/Royal) — the always-on side goal. Pays its reward, advances
    // the same streak a wanted would, counts toward the rising ante, and a milestone
    // unlock fires here. resolveLane shares one streak number between jackpot + wanted.
    const unlockOne = () => {
      const u = firstLocked(locked);
      if (u !== -1) { locked[u] = false; lanes[u] = []; anted[u] = false; anteAmt[u] = 0; }
    };
    if (r.jackpot && r.jackpot.hit) {
      jackpotClaim = r.jackpot;
      score += r.jackpot.totalPts;
      chips += r.jackpot.totalChips;
      streak = r.jackpot.streak;
      wantedHits += 1; // a jackpot also raises the ante (a triumphant score)
      if (r.jackpot.unlockLane) unlockOne();
    }

    // Apply a completed Wanted (hand or condition; only on a true score). Can co-occur
    // with a jackpot when a condition wanted also matches the SF/Royal lane.
    if (r.wanted && r.wanted.hit) {
      wantedClaim = r.wanted;
      score += r.wanted.totalPts;
      chips += r.wanted.totalChips;
      streak = r.wanted.streak;
      wantedHits += 1; // Wanted completions also raise the ante
      if (r.wanted.unlockLane) unlockOne();
    }

    // Roll a fresh wanted whenever the streak advanced (jackpot and/or wanted).
    if (jackpotClaim || wantedClaim) wanted = pickWanted(streak, state.rng);

    raise[l] = null;
    raiseSel[l] = NO_RAISE;
  }

  let next = { ...state, lanes, locked, anted, anteAmt, raise, raiseSel, chips, score, discard, streak, wanted, scoreHands, wantedHits, handStats };
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
      jackpot: jackpotClaim,
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
  // A discard deals a fresh tray but does NOT count toward the betting timer:
  // raise previews + countdowns are frozen across it (tickExpiry: false).
  drawInto(next, expired, { tickExpiry: false });
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

/* ── dev / testing ─────────────────────────────────────────────────────────────
   Stack the deck so the CURRENT tray + the next draws are exactly `ids` (canonical
   "<suit><rank>" strings, e.g. "S6","S7","S8","S9","S10"). Returns a NEW state with
   the tray set to ids[0] and ids[1..] queued at the front of the bag — so placing
   that run into one lane resolves it deterministically. View-only convenience for
   manually verifying jackpots/wanted; never called by normal play. */
export function devStackBag(state, ids) {
  if (!ids || ids.length === 0) return state;
  const toCard = (id) => {
    const suit = id[0];
    const rank = Number(id.slice(1));
    return { rank, suit, faceUp: true, id: suit + rank };
  };
  const cards = ids.map(toCard);
  return { ...state, tray: cards[0], bag: [...cards.slice(1), ...state.bag] };
}

// A ready-made straight flush in spades (6-7-8-9-10) for the jackpot celebration.
export const DEV_STRAIGHT_FLUSH = ["S6", "S7", "S8", "S9", "S10"];
// A ready-made royal flush in hearts.
export const DEV_ROYAL_FLUSH = ["H10", "H11", "H12", "H13", "H1"];

/* ── internals ─────────────────────────────────────────────────────────────── */

const firstLocked = (locked) => locked.findIndex(Boolean);

/* Resolve a full (5-card) lane three ways. Returns a rich result for the view:
   { laneIndex, hand, bust, saved, scored, basePoints, raise:{tier,won}|null,
     multiplier, points, chipsReturned, chipsLost, cleared, wanted, jackpot } where
     `wanted` (when the lane completes the current target) and `jackpot` (when the
     lane is a Straight Flush / Royal Flush — the always-on side goal) each =
     { hit, hand, bonusPts, bonusChips, totalPts, totalChips, streak, unlockLane }.
     Both share one advanced streak number; jackpot + a condition wanted can co-occur.
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

  // A jackpot (Straight Flush / Royal Flush) is an always-on side goal: it pays its
  // own huge reward independently of the current wanted. A wanted (hand or condition)
  // completes only on a true score; SF/Royal never match a wanted target (they're not
  // in the pool), but a CONDITION wanted can co-occur with a jackpot (e.g. a Royal
  // that's also All Red). Both advance the SAME streak — count it once.
  const jackpotHit = scored && JACKPOT_HANDS.has(hand.rank);
  const wantedHit = scored && completesWanted(hand.rank, wanted, lane);

  let jackpotResult = null;
  let wantedResult = null;
  if (jackpotHit || wantedHit) {
    const newStreak = streak + 1;
    const sb = streakBonus(newStreak);
    if (jackpotHit) {
      const jr = JACKPOT_REWARDS[hand.rank];
      jackpotResult = {
        hit: true,
        hand: hand.rank,
        bonusPts: jr.pts,
        bonusChips: jr.chips,
        totalPts: Math.round(jr.pts * sb.ptsMult),
        totalChips: jr.chips + sb.chipAdd,
        streak: newStreak,
        unlockLane: sb.unlockLane,
      };
    }
    if (wantedHit) {
      // If a jackpot already consumed the streak's milestone bonus this turn, don't
      // apply it twice — the wanted rides the same streak number but takes no extra
      // milestone (the jackpot is the headline). Otherwise the wanted gets it.
      const wsb = jackpotHit ? { ptsMult: 1, chipAdd: 0, unlockLane: false } : sb;
      wantedResult = {
        hit: true,
        hand: wanted.hand,
        kind: wanted.kind || "hand",
        name: wanted.name,
        bonusPts: wanted.bonusPts,
        bonusChips: wanted.bonusChips,
        totalPts: Math.round(wanted.bonusPts * wsb.ptsMult),
        totalChips: wanted.bonusChips + wsb.chipAdd,
        streak: newStreak,
        unlockLane: wsb.unlockLane,
      };
    }
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
    jackpot: jackpotResult,
  };
}

/* The draw transition — the single place where raises commit and expiry ticks.
   Mutates `state` in place (the caller already cloned what it needs). Pushes any
   raises that expire on this draw into `expired`. Order: refill/exhaust bag →
   COMMIT previews → DECREMENT older committed raises → deal the next tray. A raise
   is never decremented by the draw that created it (N subsequent draws).

   `tickExpiry` (default true) drives the betting clock: a normal draw commits
   previews and ticks countdowns. A discard passes `false` so it deals a fresh tray
   WITHOUT advancing raise expiry — the discard is "free" toward the betting timer. */
function drawInto(state, expired, { tickExpiry = true } = {}) {
  // 1. bag
  if (state.bag.length === 0) {
    if (state.oneDeck) { state.tray = null; return; }
    state.bag = shuffle(freshDeck(), state.rng);
  }

  if (!tickExpiry) {
    // Discard: just deal the next tray, leaving raise previews + countdowns frozen.
    state.tray = { ...state.bag[0], faceUp: true };
    state.bag = state.bag.slice(1);
    return;
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
