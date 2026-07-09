/* ============================================================
   ECONOMY-BUST SIM — headless economy tuner for Deadlock Poker
   (chip-panic). Models the SHIPPED redesign: 4 lanes, tray model,
   a lane resolves ONLY at 5 cards, and a hand BELOW Two Pair (High
   Card OR any Pair) BUSTS + locks the lane. There is no timer and no
   save token. The pressure is the ECONOMY: a steep rising ante keeps
   chips scarce, and a bust forfeits the ante — so running out of
   chips to open lanes is the usual way a run ends.

   This sim exists to TUNE that economy: the ante steepness is a config
   (ANTE_STEP, ANTE_EVERY_SCORES, START_CHIPS) that it sweeps, so the
   numbers are chosen from data, not feel. It reuses the real deck +
   evaluator + hand points; the ante formula mirrors logic.js `anteFor`.

   Baseline note: the OLD game had a pair-SAVE valve (~1.29 busts/run).
   That valve is REMOVED here (a pair busts), so busts rise — the ante
   must make that survivable, not fatal. The shipped tuning
   (ANTE_STEP=2, EVERY_SCORES=4, START_CHIPS=12) lands ~3 busts/run
   with ~84% of runs ending by chip starvation.

   Run:
     node scripts/economy-bust-sim.js [--runs 500] [--seed 1] [--sweep]
                                      [--step 2] [--every 4] [--chips 12]
   ============================================================ */

import { freshDeck, shuffle } from "../src/games/cards/deck.js";
import { evaluate, bestMadeHand, HAND } from "../src/games/poker/handEval.js";
import {
  HAND_POINTS, SCORE_MIN, BASE_ANTE, ANTE_PROFIT_BY_HAND,
  WANTED_HITS_PER_ANTE, DRAWS_PER_ANTE, LANES as DEFAULT_LANES,
} from "../src/games/chip-panic/logic.js";

/* ---------- rng + fmt ---------- */
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

const profitFor = (rank) => ANTE_PROFIT_BY_HAND[rank] ?? 1;

/* ---------- config ---------- */
const LANE_CAP = 5;
const HARD_GUARD = 6000;

function makeCfg(over = {}) {
  return {
    LANES: DEFAULT_LANES, // 4
    START_CHIPS: 12,
    ANTE_STEP: 2, // chips the ante climbs per score/wanted threshold
    ANTE_EVERY_SCORES: 4, // scoring hands per ante bump
    WANTED_HITS_PER_ANTE, // keep the wanted term from the real economy
    DRAWS_PER_ANTE, // keep the every-20-draws term
    archetype: "sensible", // "sensible" | "greedy"
    ...over,
  };
}

// Config-driven ante — mirrors logic.js anteFor but with the swept knobs so the
// steepness actually changes across the sweep.
function anteOf(s) {
  const c = s.cfg;
  return BASE_ANTE
    + c.ANTE_STEP * Math.floor(s.scoreHands / c.ANTE_EVERY_SCORES)
    + c.ANTE_STEP * Math.floor(s.wantedHits / c.WANTED_HITS_PER_ANTE)
    + Math.floor(s.draws / c.DRAWS_PER_ANTE);
}

/* ---------- state + helpers ---------- */
function makeState(cfg, rng) {
  return {
    cfg, rng,
    deck: shuffle(freshDeck(), rng),
    tray: null,
    lanes: Array.from({ length: cfg.LANES }, () => ({ cards: [], open: false, locked: false, antePaid: 0 })),
    chips: cfg.START_CHIPS,
    discard: true,
    score: 0, scoreHands: 0, wantedHits: 0, draws: 0,
    // metrics
    busts: 0, placements: 0, resolvedMix: {}, endReason: null, over: false,
  };
}
const openPlaceable = (s) => s.lanes.map((l, i) => ({ l, i })).filter(({ l }) => l.open && !l.locked && l.cards.length < LANE_CAP);
const closedUnlocked = (s) => s.lanes.findIndex((l) => !l.open && !l.locked);
const canOpen = (s) => closedUnlocked(s) !== -1 && s.chips >= anteOf(s);
function drawCard(s) { if (s.deck.length === 0) s.deck = shuffle(freshDeck(), s.rng); return s.deck.shift(); }

/* ---------- reducer (lane resolves ONLY at 5) ---------- */
function resolveLane(s, i) {
  const lane = s.lanes[i];
  const h = evaluate(lane.cards); // exactly 5
  s.resolvedMix[h.rank] = (s.resolvedMix[h.rank] || 0) + 1;
  if (h.rank >= SCORE_MIN) {
    s.score += HAND_POINTS[h.rank] || 0;
    s.scoreHands += 1;
    s.chips += lane.antePaid + profitFor(h.rank);
    s.discard = true;
    lane.cards = []; lane.open = false; lane.antePaid = 0;
  } else {
    lane.locked = true; s.busts += 1; // below two pair (high card OR pair) → bust+lock
  }
}
function openLane(s, i) { const a = anteOf(s); s.chips -= a; s.lanes[i].open = true; s.lanes[i].antePaid = a; }
function placeCard(s, i) {
  s.lanes[i].cards.push(s.tray); s.draws += 1; s.placements += 1;
  if (s.lanes[i].cards.length === LANE_CAP) resolveLane(s, i);
  s.tray = drawCard(s);
}

/* ---------- AI (tray model, no timer) ----------
   Value a placement by whether it completes to two-pair+ (big reward, scaled by
   hand), keeps a live draw, or is a forced bust. Avoid CLOSING a lane below two
   pair when possible — that's a bust+lock. */
function scoreInto(s, lane) {
  const after = [...lane.cards, s.tray]; const slots = LANE_CAP - after.length;
  if (after.length === LANE_CAP) {
    const r = evaluate(after).rank;
    return r >= SCORE_MIN ? 200 + (HAND_POINTS[r] || 0) / 5 + profitFor(r) * 3 : -80; // closing < two pair busts
  }
  const made = bestMadeHand(after);
  const madeBonus = { [HAND.HIGH_CARD]: 0, [HAND.PAIR]: 16, [HAND.TWO_PAIR]: 48, [HAND.THREE]: 52, [HAND.FOUR]: 66 };
  const sc = {}; for (const c of after) sc[c.suit] = (sc[c.suit] || 0) + 1; const maxs = Math.max(...Object.values(sc));
  const flushDraw = (maxs + slots >= 5) ? 12 : 0;
  const hi = (r) => (r === 1 ? 14 : r); const present = new Set(after.map((c) => hi(c.rank))); let straightDraw = 0;
  for (let lo = 1; lo <= 10; lo++) { let inW = 0; for (let r = lo; r < lo + 5; r++) if (present.has(r)) inW++; if (inW >= 2 && 5 - inW <= slots) { straightDraw = 8; break; } }
  let v = (madeBonus[made] || 0) + flushDraw + straightDraw;
  // penalize a placement that strands the lane below two pair with little room left
  const canReachTwoPair = made >= HAND.TWO_PAIR || (made === HAND.PAIR && slots >= 1) || flushDraw > 0 || straightDraw > 0 || slots >= 2;
  if (!canReachTwoPair) v -= 40;
  return v;
}
function pickPlacement(s) {
  const open = openPlaceable(s); if (!open.length) return null;
  let best = null;
  for (const { l, i } of open) { const v = scoreInto(s, l); if (!best || v > best.v) best = { v, i }; }
  return best;
}

/* ---------- one run ---------- */
function playRun(cfg, seed) {
  const s = makeState(cfg, mulberry32(seed));
  const greedy = cfg.archetype === "greedy";
  s.tray = drawCard(s); openLane(s, 0);
  let guard = 0;
  while (!s.over && guard++ < HARD_GUARD) {
    if (s.tray == null) { s.endReason = "deckOut"; s.over = true; break; }
    // open a fresh lane if there's nothing strong to do (greedy opens more readily)
    const best = pickPlacement(s);
    const wantOpen = canOpen(s) && (openPlaceable(s).length === 0 || (best && best.v < (greedy ? 40 : 15)));
    if (wantOpen) openLane(s, closedUnlocked(s));
    let open = openPlaceable(s);
    if (open.length === 0) {
      if (canOpen(s)) openLane(s, closedUnlocked(s));
      else if (s.discard) { s.discard = false; s.draws += 1; s.tray = drawCard(s); continue; } // discard toxic tray
      else { s.endReason = "stuck-broke"; s.over = true; break; } // can't afford a lane → chip starvation
      open = openPlaceable(s); if (open.length === 0) { s.endReason = "stuck-noroom"; s.over = true; break; }
    }
    const mv = pickPlacement(s); if (!mv) { s.endReason = "stuck-noroom"; s.over = true; break; }
    placeCard(s, mv.i);
    if (s.lanes.every((l) => l.locked)) { s.endReason = "allLocked"; s.over = true; }
  }
  if (!s.endReason) s.endReason = "guard";
  return {
    busts: s.busts, zeroBust: s.busts === 0, draws: s.placements, score: s.score,
    lanesLocked: s.lanes.filter((l) => l.locked).length, chips: s.chips,
    endReason: s.endReason, resolvedMix: s.resolvedMix,
  };
}

/* ---------- batch + report ---------- */
function runBatch(cfg, N, seed0) {
  const runs = []; for (let i = 0; i < N; i++) runs.push(playRun(cfg, seed0 + i * 2654435761));
  const ends = {}; const mix = {}; let mt = 0;
  for (const r of runs) { ends[r.endReason] = (ends[r.endReason] || 0) + 1; for (const [k, n] of Object.entries(r.resolvedMix)) { mix[k] = (mix[k] || 0) + n; mt += n; } }
  return {
    n: N,
    busts: avg(runs.map((r) => r.busts)), zero: pct(runs.filter((r) => r.zeroBust).length, N),
    draws: avg(runs.map((r) => r.draws)), score: avg(runs.map((r) => r.score)),
    locked: avg(runs.map((r) => r.lanesLocked)), chips: avg(runs.map((r) => r.chips)),
    ends,
    starvePct: pct(ends["stuck-broke"] || 0, N),
    collapsePct: pct(ends.allLocked || 0, N),
    mix: { high: pct(mix[HAND.HIGH_CARD] || 0, mt), pair: pct(mix[HAND.PAIR] || 0, mt), score: 100 - pct(mix[HAND.HIGH_CARD] || 0, mt) - pct(mix[HAND.PAIR] || 0, mt) },
  };
}

function printReport(cfg, r) {
  console.log(`\nconfig: LANES=${cfg.LANES} step=${cfg.ANTE_STEP} every=${cfg.ANTE_EVERY_SCORES} startChips=${cfg.START_CHIPS} ai=${cfg.archetype}  (N=${r.n})`);
  console.log(`  avg busts / run              ${f2(r.busts)}   (a bust = lane resolved < Two Pair)`);
  console.log(`  % runs zero bust             ${f1(r.zero)}%`);
  console.log(`  avg draws / run              ${f1(r.draws)}`);
  console.log(`  avg score / run              ${Math.round(r.score)}`);
  console.log(`  avg lanes locked at end      ${f2(r.locked)}`);
  console.log(`  avg chips at end             ${f1(r.chips)}`);
  console.log(`  chip-starvation endings      ${f1(r.starvePct)}%   (chips matter when this is high)`);
  console.log(`  board-collapse endings       ${f1(r.collapsePct)}%`);
  console.log(`  resolved mix  high ${f1(r.mix.high)}%  pair ${f1(r.mix.pair)}%  twoPair+ ${f1(r.mix.score)}%`);
}

function verdict(r) {
  // Chips are meant to be the binding resource (chips-as-lives), so a HIGH
  // chip-starvation share is the goal — the guard against over-tuning is a
  // death spiral (short runs / no score), not high starvation per se.
  if (r.draws < 35 || r.busts > 5 || r.score < 200) return ["TOO HARSH", "death spiral — ease the ante (lower step / raise start chips)."];
  if (r.starvePct < 20 && r.busts < 1.5) return ["TOO SOFT", "chips never bite — steepen the ante (raise step / lower every-scores)."];
  if (r.busts >= 1.5 && r.busts <= 4 && r.starvePct >= 40 && r.draws >= 60) return ["GOOD", "chips are the binding resource (starvation dominates endings), busts create pressure, runs progress with a score gradient."];
  return ["BORDERLINE", "near a band edge — sweep to dial it in."];
}

/* ---------- sweep ---------- */
function runSweep(N, seed) {
  for (const ai of ["sensible", "greedy"]) {
    console.log(`\n=== ANTE SWEEP — ${ai.toUpperCase()} (N=${N}) ===`);
    console.log(" step every start | busts/run zero% draws score locked chipsEnd | starve% collapse% | hi/pair/2p+");
    for (const step of [1, 2, 3]) {
      for (const every of [3, 4, 5]) {
        for (const start of [10, 12, 16]) {
          const r = runBatch(makeCfg({ ANTE_STEP: step, ANTE_EVERY_SCORES: every, START_CHIPS: start, archetype: ai }), N, seed);
          console.log(
            `  ${step}    ${String(every).padStart(2)}   ${String(start).padStart(2)}   |   ${f2(r.busts).padStart(5)}  ${f1(r.zero).padStart(4)}% ${f1(r.draws).padStart(5)} ${String(Math.round(r.score)).padStart(5)}  ${f2(r.locked).padStart(4)}  ${f1(r.chips).padStart(4)}   | ${f1(r.starvePct).padStart(5)}%  ${f1(r.collapsePct).padStart(5)}%   | ${f1(r.mix.high)}/${f1(r.mix.pair)}/${f1(r.mix.score)}`
          );
        }
      }
    }
  }
}

/* ---------- main ---------- */
function main() {
  const args = process.argv.slice(2);
  const getNum = (flag, def) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? Number(args[i + 1]) : def; };
  const N = getNum("--runs", 500);
  const seed = getNum("--seed", 1);
  const step = getNum("--step", 2);
  const every = getNum("--every", 4);
  const chips = getNum("--chips", 12);
  const sweep = args.includes("--sweep");

  console.log("========================================================");
  console.log("ECONOMY-BUST SIM — Deadlock Poker (4 lanes, bust < Two Pair, no save tokens)");
  console.log("SHIPPED tuning: step=2, every=4 scores, start=12 chips → ~3 busts/run, ~84% chip-starvation.");
  console.log("========================================================");

  for (const ai of ["sensible", "greedy"]) {
    const cfg = makeCfg({ ANTE_STEP: step, ANTE_EVERY_SCORES: every, START_CHIPS: chips, archetype: ai });
    const r = runBatch(cfg, N, seed);
    printReport(cfg, r);
    const [tag, why] = verdict(r);
    console.log(`  VERDICT: ${tag} — ${why}`);
  }

  if (sweep) runSweep(Math.min(N, 300), seed);
  process.exit(0);
}

main();
