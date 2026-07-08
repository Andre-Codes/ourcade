/* ============================================================
   REVERSE-POKER SIM — headless bust-pressure prototype for a
   PROPOSED redesign of High Card Bust (chip-panic). This is a
   MEASUREMENT TOOL, not the game: it models the "reverse poker"
   loop and reports whether high-card-bust tension survives, so we
   can decide (from data) whether to commit to a full engine rebuild.

   THE MECHANIC BEING MODELED
     * The player holds a 5-card HAND, refilled from the deck to
       HAND_SIZE after every placement.
     * LANES lanes start closed/unlocked. Opening a lane pays the
       rising ANTE (reused anteFor curve) and deals SEED_COUNT fixed
       "seed" cards into it.
     * A lane holds SEED_COUNT + PLACED_CAP = 5 cards and resolves at
       5, evaluated as a 5-card poker hand (evaluate needs exactly 5).
     * Each turn the player MUST place one hand card into an open lane
       (no stalling); then draws back up to HAND_SIZE. When the hand
       fits no open lane well, the forced placement POISONS a lane
       toward a high-card bust — that's the tension we're measuring.
     * Resolution is HCB's three-way: HIGH CARD -> bust+lock; PAIR ->
       save if a token remains (spends one) else bust+lock; TWO_PAIR+
       -> score. Save-token pool + earn-back reused from chip-panic.

   WHAT'S STRIPPED (on purpose, to keep the bust number clean/comparable):
     raises, Wanted objectives, jackpots. Economy CONSTANTS + evaluate
     are imported from the real code so results are apples-to-apples
     with the prior save-token diagnosis (~0.33 pre / 1.29 post-fix
     high-card busts/run, 65%/14% zero-bust runs, ~92 draws/run).

   Run:
     node scripts/reverse-poker-sim.js [--runs 500] [--seed 1] [--sweep] [--oneDeck]
   ============================================================ */

import { freshDeck, shuffle } from "../src/games/cards/deck.js";
import { evaluate, bestMadeHand, HAND } from "../src/games/poker/handEval.js";
import {
  anteFor, BASE_ANTE, START_CHIPS, HAND_POINTS, SCORE_MIN, SAVE_HAND, ANTE_PROFIT,
  START_SAVE_TOKENS, SCORES_PER_SAVE_TOKEN, SAVE_TOKEN_CAP, LANES as DEFAULT_LANES,
} from "../src/games/chip-panic/logic.js";

/* ---------- rng + formatting (no deps) ---------- */
// Deterministic per-run rng so batches + sweeps are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n, d) => (d ? (100 * n) / d : 0);
const f1 = (x) => x.toFixed(1);
const f2 = (x) => x.toFixed(2);

/* ---------- config ---------- */
const HARD_GUARD = 8000; // per-run turn cap (safety; a real run ends far sooner)

function makeCfg(over = {}) {
  const cfg = {
    LANES: DEFAULT_LANES, // 4
    HAND_SIZE: 5,
    SEED_COUNT: 2,
    PLACED_CAP: 3,
    oneDeck: false,
    ...over,
  };
  // evaluate() needs exactly 5 cards, so a lane MUST total 5.
  const cap = cfg.SEED_COUNT + cfg.PLACED_CAP;
  if (cap !== 5) {
    console.error(`FATAL: SEED_COUNT(${cfg.SEED_COUNT}) + PLACED_CAP(${cfg.PLACED_CAP}) = ${cap}, must equal 5.`);
    process.exit(1);
  }
  return cfg;
}
const laneCap = (cfg) => cfg.SEED_COUNT + cfg.PLACED_CAP; // == 5

/* ---------- state + deck helpers ---------- */
function makeState(cfg, rng) {
  return {
    cfg, rng,
    deck: shuffle(freshDeck(), rng),
    hand: [],
    lanes: Array.from({ length: cfg.LANES }, () => ({ cards: [], open: false, locked: false, antePaid: 0 })),
    chips: START_CHIPS,
    saveTokens: START_SAVE_TOKENS,
    score: 0,
    scoreHands: 0,
    wantedHits: 0, // no Wanted system here — placeholder so anteFor signature matches
    draws: 0,
    // metrics
    highCardBusts: 0,
    pairBusts: 0,
    totalBusts: 0,
    placements: 0,
    resolvedMix: {}, // HAND.rank -> count
    endReason: null,
    over: false,
  };
}

const currentAnte = (s) => anteFor(s.scoreHands, s.wantedHits, s.draws);
const openPlaceableLanes = (s) =>
  s.lanes.map((l, i) => ({ l, i })).filter(({ l }) => l.open && !l.locked && l.cards.length < laneCap(s.cfg));
const closedUnlockedLane = (s) => s.lanes.findIndex((l) => !l.open && !l.locked);
const canOpenNew = (s) => closedUnlockedLane(s) !== -1 && s.chips >= currentAnte(s);

// Pull one card off the deck; reshuffle a fresh 52 on empty unless one-deck.
// Returns null only in one-deck mode when the deck is truly spent.
function drawCard(s) {
  if (s.deck.length === 0) {
    if (s.cfg.oneDeck) return null;
    s.deck = shuffle(freshDeck(), s.rng);
  }
  return s.deck.shift();
}
function fillHand(s) {
  while (s.hand.length < s.cfg.HAND_SIZE) {
    const c = drawCard(s);
    if (!c) break;
    s.hand.push(c);
  }
}

/* ---------- reducer: open / place / resolve ---------- */
function openLane(s, i) {
  const lane = s.lanes[i];
  const ante = currentAnte(s);
  s.chips -= ante;
  lane.open = true;
  lane.antePaid = ante;
  for (let k = 0; k < s.cfg.SEED_COUNT; k++) {
    const c = drawCard(s);
    if (!c) { s.endReason = "deckOut"; s.over = true; return; }
    lane.cards.push(c);
  }
}

function resolveLane(s, i) {
  const lane = s.lanes[i];
  const h = evaluate(lane.cards); // exactly 5
  s.resolvedMix[h.rank] = (s.resolvedMix[h.rank] || 0) + 1;

  if (h.rank >= SCORE_MIN) {
    // SCORE: base points, ante back + flat profit, token earn-back, lane clears.
    s.score += HAND_POINTS[h.rank] || 0;
    s.scoreHands += 1;
    if (s.scoreHands % SCORES_PER_SAVE_TOKEN === 0 && s.saveTokens < SAVE_TOKEN_CAP) s.saveTokens += 1;
    s.chips += lane.antePaid + ANTE_PROFIT;
    lane.cards = []; lane.open = false; lane.antePaid = 0;
  } else if (h.rank === SAVE_HAND) {
    // PAIR: honored save if a token remains, else bust + lock.
    if (s.saveTokens > 0) {
      s.saveTokens -= 1;
      lane.cards = []; lane.open = false; lane.antePaid = 0;
    } else {
      lane.locked = true;
      s.pairBusts += 1; s.totalBusts += 1;
    }
  } else {
    // HIGH CARD: bust + lock.
    lane.locked = true;
    s.highCardBusts += 1; s.totalBusts += 1;
  }
}

// Place hand[handIdx] into lane i; draw back to HAND_SIZE; resolve if full.
function placeCard(s, i, handIdx) {
  const [card] = s.hand.splice(handIdx, 1);
  s.lanes[i].cards.push(card);
  s.draws += 1;
  s.placements += 1;
  fillHand(s);
  if (s.lanes[i].cards.length === laneCap(s.cfg)) resolveLane(s, i);
}

/* ---------- AI: read a partial lane + score a placement ---------- */
const TIER = { SCORE: "score", DRAW: "draw", PAIR: "pair", BUST: "bust" };

// Draw potential of a partial 5-card lane with `slotsLeft` empty slots.
function drawPotential(cards, slotsLeft) {
  const suitCount = {};
  for (const c of cards) suitCount[c.suit] = (suitCount[c.suit] || 0) + 1;
  const maxSuit = Math.max(0, ...Object.values(suitCount));
  const flushDraw = maxSuit + slotsLeft >= 5;

  // Straight potential: any 5-rank window we can still fill within slotsLeft.
  const hiOf = (r) => (r === 1 ? 14 : r);
  const present = new Set(cards.map((c) => hiOf(c.rank)));
  if (present.has(14)) present.add(1); // ace also plays low
  let straightDraw = false;
  for (let lo = 1; lo <= 10; lo++) {
    let inWindow = 0;
    for (let r = lo; r < lo + 5; r++) if (present.has(r)) inWindow++;
    // need 5 distinct in the window; we hold `inWindow`, must add (5-inWindow) via slots
    if (inWindow >= 1 && 5 - inWindow <= slotsLeft) { straightDraw = true; break; }
  }

  const made = bestMadeHand(cards);
  const pairPath = made >= HAND.PAIR;
  return { flushDraw, straightDraw, pairPath, made };
}

// Can this partial lane still reach TWO_PAIR+ given slotsLeft? If not → poisoned.
function canStillScore(cards, slotsLeft) {
  const dp = drawPotential(cards, slotsLeft);
  if (dp.made >= HAND.TWO_PAIR) return true;
  if (dp.flushDraw || dp.straightDraw) return true;
  // A single made pair can still become two-pair/trips with >=1 slot.
  if (dp.made === HAND.PAIR && slotsLeft >= 1) return true;
  // No pair yet but distinct ranks that could still pair up within the slots.
  if (dp.made === HAND.HIGH_CARD && slotsLeft >= 2) return true; // room to build a pair+
  return false;
}

// Score placing `card` into `lane`. Higher = better. Resolving placements return
// the EXACT outcome; partials are scored by made-hand + draws minus a poison penalty.
function scorePlacement(s, lane, card) {
  const after = [...lane.cards, card];
  const cap = laneCap(s.cfg);
  if (after.length === cap) {
    const r = evaluate(after).rank;
    if (r >= SCORE_MIN) return { tier: TIER.SCORE, value: 100 + (HAND_POINTS[r] || 0) / 10 };
    if (r === SAVE_HAND) return { tier: TIER.PAIR, value: s.saveTokens > 0 ? -5 : -80 };
    return { tier: TIER.BUST, value: -100 };
  }
  const slotsLeft = cap - after.length;
  const dp = drawPotential(after, slotsLeft);
  const madeBonus = { [HAND.HIGH_CARD]: 0, [HAND.PAIR]: 8, [HAND.TWO_PAIR]: 40, [HAND.THREE]: 45, [HAND.FOUR]: 60 };
  let v = (madeBonus[dp.made] || 0)
    + (dp.flushDraw ? 10 : 0)
    + (dp.straightDraw ? 8 : 0);
  if (!canStillScore(after, slotsLeft)) v -= 60; // poisoned-lane penalty
  return { tier: TIER.DRAW, value: v };
}

// Best achievable placement into a given lane over all current hand cards.
function bestIntoLane(s, lane) {
  let best = null;
  for (let h = 0; h < s.hand.length; h++) {
    const sc = scorePlacement(s, lane, s.hand[h]);
    if (!best || sc.value > best.value) best = { ...sc, handIdx: h };
  }
  return best;
}

// Argmax over every (handCard, openLane). ALWAYS returns a move (least-bad if all
// bad) — single-ply, no perfect solver. This is where natural busts come from.
function pickPlacement(s) {
  const open = openPlaceableLanes(s);
  let best = null;
  for (const { l, i } of open) {
    for (let h = 0; h < s.hand.length; h++) {
      const sc = scorePlacement(s, l, s.hand[h]);
      // Tie-break: prefer NOT resolving (keep optionality) at equal value.
      const resolves = l.cards.length + 1 === laneCap(s.cfg);
      const key = sc.value - (resolves ? 0.01 : 0);
      if (!best || key > best.key) best = { key, laneIdx: i, handIdx: h, tier: sc.tier };
    }
  }
  return best;
}

/* ---------- AI archetypes: differ only in the OPEN threshold ---------- */
// SENSIBLE: open a fresh lane when the current best placement is a bust / token-less
//   pair / poisoned draw AND we can afford it — but don't lane-spam when a good
//   placement already exists.
// GREEDY-SAFE: open whenever affordable and the current best placement is a BUST
//   (strictly dodge completing a high card if a fresh lane is available) → lower
//   bust bound.
function bestOpenTier(s) {
  const open = openPlaceableLanes(s);
  if (open.length === 0) return null;
  let best = null;
  for (const { l } of open) {
    const b = bestIntoLane(s, l);
    if (!best || b.value > best.value) best = b;
  }
  return best; // { tier, value, handIdx }
}

const AIS = {
  sensible: {
    name: "SENSIBLE",
    wantsToOpen(s) {
      if (!canOpenNew(s)) return false;
      const b = bestOpenTier(s);
      if (!b) return true; // nowhere to place → must open
      if (b.tier === TIER.SCORE) return false;
      if (b.tier === TIER.DRAW && b.value >= 0) return false; // a live draw exists — take it
      return true; // best is a bust / token-pair / poisoned draw → get fresh options
    },
  },
  greedySafe: {
    name: "GREEDY-SAFE",
    wantsToOpen(s) {
      if (!canOpenNew(s)) return false;
      const b = bestOpenTier(s);
      if (!b) return true;
      return b.tier === TIER.BUST; // only dodge an outright high-card completion
    },
  },
};
const pickLaneToOpen = (s) => closedUnlockedLane(s);

/* ---------- one run ---------- */
function playRun(cfg, ai, seed) {
  const s = makeState(cfg, mulberry32(seed));
  fillHand(s);
  openLane(s, 0); // first lane always affordable at BASE_ANTE
  if (s.over) return metricsOf(s);

  let guard = 0;
  while (!s.over && guard++ < HARD_GUARD) {
    // maybe open a fresh lane first (for options)
    if (ai.wantsToOpen(s)) {
      openLane(s, pickLaneToOpen(s));
      if (s.over) break;
    }
    let open = openPlaceableLanes(s);
    if (open.length === 0) {
      // must place but no room — open if we can, else stuck.
      if (canOpenNew(s)) { openLane(s, pickLaneToOpen(s)); if (s.over) break; }
      else { s.endReason = "stuck"; s.over = true; break; }
      open = openPlaceableLanes(s);
      if (open.length === 0) { s.endReason = "stuck"; s.over = true; break; }
    }
    const mv = pickPlacement(s);
    if (!mv) { s.endReason = "stuck"; s.over = true; break; }
    placeCard(s, mv.laneIdx, mv.handIdx);

    if (s.lanes.every((l) => l.locked)) { s.endReason = "allLocked"; s.over = true; }
    else if (cfg.oneDeck && s.deck.length === 0 && s.hand.length === 0) { s.endReason = "deckOut"; s.over = true; }
  }
  if (!s.endReason) s.endReason = "guard";
  return metricsOf(s);
}

function metricsOf(s) {
  const lanesLocked = s.lanes.filter((l) => l.locked).length;
  return {
    highCardBusts: s.highCardBusts,
    pairBusts: s.pairBusts,
    totalBusts: s.totalBusts,
    zeroHighCardBust: s.highCardBusts === 0,
    placements: s.placements,
    score: s.score,
    scoreHands: s.scoreHands,
    lanesLocked,
    chipsAtEnd: s.chips,
    endReason: s.endReason,
    resolvedMix: s.resolvedMix,
  };
}

/* ---------- batch + reporting ---------- */
function runBatch(cfg, ai, N, seed0) {
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(playRun(cfg, ai, seed0 + i * 2654435761));
  const ends = {};
  const mix = {}; // rank -> total count
  let mixTotal = 0;
  for (const r of runs) {
    ends[r.endReason] = (ends[r.endReason] || 0) + 1;
    for (const [rk, n] of Object.entries(r.resolvedMix)) { mix[rk] = (mix[rk] || 0) + n; mixTotal += n; }
  }
  const highPct = pct((mix[HAND.HIGH_CARD] || 0), mixTotal);
  const pairPct = pct((mix[HAND.PAIR] || 0), mixTotal);
  const scorePct = 100 - highPct - pairPct;
  return {
    n: N,
    hcBust: avg(runs.map((r) => r.highCardBusts)),
    zeroHc: pct(runs.filter((r) => r.zeroHighCardBust).length, N),
    totBust: avg(runs.map((r) => r.totalBusts)),
    draws: avg(runs.map((r) => r.placements)),
    score: avg(runs.map((r) => r.score)),
    lanesLocked: avg(runs.map((r) => r.lanesLocked)),
    chips: avg(runs.map((r) => r.chipsAtEnd)),
    ends, mix: { highPct, pairPct, scorePct },
  };
}

function printReport(label, r) {
  console.log(`\nAI: ${label}   (N=${r.n})`);
  console.log(`  avg high-card busts / run      ${f2(r.hcBust)}`);
  console.log(`  % runs zero high-card bust     ${f1(r.zeroHc)}%`);
  console.log(`  avg total busts / run          ${f2(r.totBust)}`);
  console.log(`  avg draws (placements) / run   ${f1(r.draws)}`);
  console.log(`  avg score / run                ${Math.round(r.score)}`);
  console.log(`  avg lanes locked at end        ${f2(r.lanesLocked)}`);
  console.log(`  avg chips at end               ${f1(r.chips)}`);
  const e = r.ends;
  const ep = (k) => `${k} ${f1(pct(e[k] || 0, r.n))}%`;
  console.log(`  end reasons   ${["allLocked", "stuck", "deckOut", "guard"].filter((k) => e[k]).map(ep).join("  ")}`);
  console.log(`  resolved mix  high ${f1(r.mix.highPct)}%  pair ${f1(r.mix.pairPct)}%  twoPair+ ${f1(r.mix.scorePct)}%`);
}

// Classify against the greenlight rubric (anchored to the tray game's post-fix
// state: ~1.29 busts/run, ~14% zero-bust, ~92 draws).
function verdict(sensible, greedy) {
  const spread = Math.abs(sensible.hcBust - greedy.hcBust);
  const green =
    sensible.hcBust >= 1.5 && sensible.hcBust <= 3.0 &&
    sensible.zeroHc < 25 && spread <= 1.0;
  const needsPressure = greedy.hcBust < 0.8 && greedy.zeroHc > 40;
  const over = greedy.hcBust > 4 && greedy.zeroHc < 5 && greedy.draws < 40;
  if (over) return ["OVER-CORRECTION", "even greedy-safe busts too fast; lanes poison faster than they build. Try smaller SEED_COUNT / more lanes / bigger hand."];
  if (needsPressure) return ["NEEDS-PRESSURE", "greedy-safe dodges nearly all busts; forced-placement isn't binding. Try fewer lanes / bigger seed / smaller hand / steeper ante."];
  if (green) return ["GREENLIGHT", "bust pressure is real, structural (narrow AI spread), and runs terminate naturally. Worth building."];
  return ["INCONCLUSIVE", "results fall between bands — read the tables and consider a --sweep."];
}

function baselineBanner() {
  console.log("BASELINE (current tray game, prior diagnosis):");
  console.log("  high-card busts/run ~0.33 pre-fix, ~1.29 total busts post-token-fix");
  console.log("  zero-bust runs 65% -> 14% post-fix   |   ~92 draws/run");
}

/* ---------- sweep ---------- */
function runSweep(N, seed) {
  console.log(`\n=== PARAM SWEEP (N=${N} per config, SENSIBLE ai) ===`);
  console.log(" LANES HAND SEED/PLACED | hcBust/run zeroBust% totBust/run draws/run lanesLock stuck%");
  const seedPlaced = [[1, 4], [2, 3], [3, 2]];
  const laneOpts = [3, 4, 5, 6];
  const handOpts = [4, 5, 6, 7];
  for (const L of laneOpts) {
    for (const [SEED, PLACED] of seedPlaced) {
      for (const H of handOpts) {
        const cfg = makeCfg({ LANES: L, HAND_SIZE: H, SEED_COUNT: SEED, PLACED_CAP: PLACED });
        const r = runBatch(cfg, AIS.sensible, N, seed);
        const stuckPct = pct(r.ends.stuck || 0, r.n);
        console.log(
          `  ${String(L).padStart(2)}   ${String(H).padStart(2)}    ${SEED}/${PLACED}     |` +
          `    ${f2(r.hcBust).padStart(5)}    ${f1(r.zeroHc).padStart(5)}%   ${f2(r.totBust).padStart(5)}     ` +
          `${f1(r.draws).padStart(5)}    ${f2(r.lanesLocked).padStart(4)}    ${f1(stuckPct).padStart(4)}%`
        );
      }
    }
  }
}

/* ---------- main ---------- */
function main() {
  const args = process.argv.slice(2);
  const getNum = (flag, def) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? Number(args[i + 1]) : def;
  };
  const N = getNum("--runs", 500);
  const seed = getNum("--seed", 1);
  const sweep = args.includes("--sweep");
  const oneDeck = args.includes("--oneDeck");

  console.log("========================================================");
  console.log("REVERSE-POKER SIM — bust-pressure prototype");
  console.log(`config: LANES=${DEFAULT_LANES} HAND=5 SEED=2 PLACED=3${oneDeck ? " oneDeck" : ""}  runs=${N} seed=${seed}`);
  console.log("========================================================");
  baselineBanner();

  const cfg = makeCfg({ oneDeck });
  const sensible = runBatch(cfg, AIS.sensible, N, seed);
  const greedy = runBatch(cfg, AIS.greedySafe, N, seed);
  printReport(AIS.sensible.name, sensible);
  printReport(AIS.greedySafe.name, greedy);

  const [tag, why] = verdict(sensible, greedy);
  console.log(`\nVERDICT: ${tag}`);
  console.log(`  ${why}`);

  if (sweep) runSweep(Math.min(N, 200), seed);
  process.exit(0);
}

main();
