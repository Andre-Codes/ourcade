/* ============================================================
   LANE-TIMER SIM — headless bust-pressure prototype #2 for High
   Card Bust (chip-panic). Measures a PROPOSED redesign of the
   bust trigger: keep the current TRAY model (place one drawn card
   per turn into 4 lanes), but add a per-lane RESOLUTION TIMER.

   THE MECHANIC BEING MODELED
     * Current tray loop: one drawn card per turn, placed into an
       open lane (or discarded). Ante to open a lane; rising ante.
     * NEW: each open lane carries a countdown of LANE_TIMER draws.
       Every draw ticks all open-lane timers. When a lane's timer
       hits 0 it FORCE-RESOLVES with whatever cards it holds (2..5),
       even before reaching 5. The player can still fill a lane to 5
       to resolve it voluntarily first.
     * Resolution (the reframed bust rule):
         - <5 cards: read via bestMadeHand (pairs/trips/quads only —
           no straights/flushes below 5).
         - HIGH CARD (no made hand)  -> BUST + LOCK  (the surviving
           hard penalty — this is the thing that finally happens
           because the timer removes the player's ability to dodge).
         - PAIR                      -> save if a token remains,
           else bust + lock (as today).
         - TWO PAIR+                 -> SCORE; chips paid scale by
           hand strength (weak hand = few chips).
     * The pressure: the timer forces you to commit to lanes before
       they're ready; a rushed lane force-resolves weak/high-card,
       so you eat a lock or earn little.

   Reuses evaluate/bestMadeHand + economy constants from the real
   code so numbers are comparable to the prior save-token diagnosis
   (~1.29 total busts/run, ~14% zero-bust, ~92 draws/run post-fix).

   Run:
     node scripts/lane-timer-sim.js [--runs 500] [--seed 1] [--sweep] [--timer 6]
   ============================================================ */

import { freshDeck, shuffle } from "../src/games/cards/deck.js";
import { evaluate, bestMadeHand, HAND } from "../src/games/poker/handEval.js";
import {
  anteFor, START_CHIPS, HAND_POINTS, SCORE_MIN, SAVE_HAND,
  START_SAVE_TOKENS, SCORES_PER_SAVE_TOKEN, SAVE_TOKEN_CAP, LANES as DEFAULT_LANES,
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

/* ---------- profit-by-hand (the new "hands have weight" payout) ---------- */
// Chips returned ABOVE the ante on a true score, scaled by hand. A weak scoring
// hand pays the floor; strong hands pay a premium. (High card / pair don't score.)
const PROFIT_BY_HAND = {
  [HAND.TWO_PAIR]: 1, [HAND.THREE]: 2, [HAND.STRAIGHT]: 3, [HAND.FLUSH]: 4,
  [HAND.FULL_HOUSE]: 6, [HAND.FOUR]: 10, [HAND.STRAIGHT_FLUSH]: 14, [HAND.ROYAL_FLUSH]: 20,
};
const profitFor = (rank) => PROFIT_BY_HAND[rank] ?? 1;

/* ---------- config ---------- */
const HARD_GUARD = 8000;
function makeCfg(over = {}) {
  return {
    LANES: DEFAULT_LANES,
    LANE_CAP: 5,
    LANE_TIMER: 6, // draws an open lane may live before force-resolving
    lockOnHighCard: true, // true: high-card timeout LOCKS the lane; false: pay-and-clear
    startDiscard: true,
    oneDeck: false,
    ...over,
  };
}

/* ---------- resolution of a lane's current cards (2..5) ---------- */
// Returns { rank, bust, saved, scored }. <5 cards use bestMadeHand (no straights/
// flushes possible); exactly 5 use the full evaluate.
function readLane(cards) {
  const rank = cards.length === 5 ? evaluate(cards).rank : bestMadeHand(cards);
  return {
    rank,
    bust: rank === HAND.HIGH_CARD,
    saved: rank === SAVE_HAND,
    scored: rank >= SCORE_MIN,
  };
}

/* ---------- state ---------- */
function makeState(cfg, rng) {
  return {
    cfg, rng,
    deck: shuffle(freshDeck(), rng),
    tray: null,
    lanes: Array.from({ length: cfg.LANES }, () => ({ cards: [], open: false, locked: false, antePaid: 0, timer: 0 })),
    chips: START_CHIPS,
    saveTokens: START_SAVE_TOKENS,
    discard: cfg.startDiscard,
    score: 0,
    scoreHands: 0,
    wantedHits: 0,
    draws: 0,
    // metrics
    highCardBusts: 0,
    pairBusts: 0,
    totalBusts: 0,
    timedOutResolutions: 0, // lanes that force-resolved on the clock
    voluntaryResolutions: 0, // lanes filled to 5 and resolved
    placements: 0,
    resolvedMix: {},
    endReason: null,
    over: false,
  };
}

const currentAnte = (s) => anteFor(s.scoreHands, s.wantedHits, s.draws);
const openPlaceable = (s) => s.lanes.map((l, i) => ({ l, i })).filter(({ l }) => l.open && !l.locked && l.cards.length < s.cfg.LANE_CAP);
const closedUnlocked = (s) => s.lanes.findIndex((l) => !l.open && !l.locked);
const canOpen = (s) => closedUnlocked(s) !== -1 && s.chips >= currentAnte(s);

function drawCard(s) {
  if (s.deck.length === 0) {
    if (s.cfg.oneDeck) return null;
    s.deck = shuffle(freshDeck(), s.rng);
  }
  return s.deck.shift();
}

/* ---------- resolve one lane (voluntary at 5, or forced by timer) ---------- */
function resolveLane(s, i, timedOut) {
  const lane = s.lanes[i];
  const r = readLane(lane.cards);
  s.resolvedMix[r.rank] = (s.resolvedMix[r.rank] || 0) + 1;
  if (timedOut) s.timedOutResolutions += 1; else s.voluntaryResolutions += 1;

  const clear = () => { lane.cards = []; lane.open = false; lane.antePaid = 0; lane.timer = 0; };

  if (r.scored) {
    s.score += HAND_POINTS[r.rank] || 0;
    s.scoreHands += 1;
    if (s.scoreHands % SCORES_PER_SAVE_TOKEN === 0 && s.saveTokens < SAVE_TOKEN_CAP) s.saveTokens += 1;
    s.chips += lane.antePaid + profitFor(r.rank);
    clear();
  } else if (r.saved) {
    if (s.saveTokens > 0) { s.saveTokens -= 1; clear(); }
    else if (s.cfg.lockOnHighCard) { lane.locked = true; s.pairBusts += 1; s.totalBusts += 1; }
    else { clear(); } // pay-and-clear model: a pair returns nothing but frees the lane
  } else {
    // HIGH CARD (or an under-filled lane forced to nothing).
    if (s.cfg.lockOnHighCard) {
      lane.locked = true; s.highCardBusts += 1; s.totalBusts += 1;
    } else {
      // pay-and-clear model: no lock. The lane pays a small chip FLOOR (returns
      // part of the ante) and clears — the punishment is the poor payout, not a
      // permanent lane loss. We still TALLY it as a high-card "bust" event so the
      // metric is comparable, but the board recovers.
      s.chips += Math.max(0, lane.antePaid - 1); // ante mostly lost — weak payout
      s.highCardBusts += 1; // tally the event (not a lock)
      clear();
    }
  }
}

// Tick every open lane's timer by one draw; force-resolve any that hit 0.
function tickTimers(s) {
  for (let i = 0; i < s.lanes.length; i++) {
    const lane = s.lanes[i];
    if (!lane.open || lane.locked) continue;
    lane.timer -= 1;
    if (lane.timer <= 0) resolveLane(s, i, true);
  }
}

function openLane(s, i) {
  const lane = s.lanes[i];
  const ante = currentAnte(s);
  s.chips -= ante;
  lane.open = true;
  lane.antePaid = ante;
  lane.timer = s.cfg.LANE_TIMER;
}

// Place the tray card into lane i. Opening handled by caller. Ticks timers +
// draws a fresh tray (the draw that advances the clock). The timer is "draws
// since this lane was last FED" — feeding a lane refreshes it, so only NEGLECTED
// lanes time out. This matches the intuition: keep working a lane and it stays
// alive; ignore it and the clock runs out.
function placeCard(s, i) {
  s.lanes[i].cards.push(s.tray);
  s.draws += 1;
  s.placements += 1;
  // A full lane resolves immediately (voluntary) before any timer tick.
  if (s.lanes[i].cards.length === s.cfg.LANE_CAP) resolveLane(s, i, false);
  else s.lanes[i].timer = s.cfg.LANE_TIMER; // feeding refreshes the fed lane's clock
  // The draw advances every OTHER open lane's clock.
  tickTimers(s);
  s.tray = drawCard(s);
}

/* ---------- AI placement (tray model), competent version ----------
   A good player under a per-lane timer: keep FEW lanes active, focus-feed the lane
   nearest to completing so it resolves at 5 (voluntary score) BEFORE its timer
   fires, and only open a fresh lane when there's spare feed capacity. Score a
   placement by (a) completing at 5 = big reward scaled by hand, (b) how urgently
   the lane needs THIS card to survive its timer, (c) hand improvement, minus
   wasting the card on a lane that can't be finished in time. */
function scoreTrayInto(s, lane) {
  const after = [...lane.cards, s.tray];
  const cap = s.cfg.LANE_CAP;
  const slotsLeft = cap - after.length;

  if (after.length === cap) {
    const r = evaluate(after).rank;
    if (r >= SCORE_MIN) return 200 + (HAND_POINTS[r] || 0) / 5 + profitFor(r) * 3; // finish + score
    if (r === SAVE_HAND) return s.saveTokens > 0 ? 5 : -60; // pair at 5: save if token
    return -60; // completing a high card at 5 (rare when we control it)
  }

  const made = bestMadeHand(after);
  const madeBonus = { [HAND.HIGH_CARD]: 0, [HAND.PAIR]: 14, [HAND.TWO_PAIR]: 45, [HAND.THREE]: 50, [HAND.FOUR]: 65 };
  const suitCount = {};
  for (const c of after) suitCount[c.suit] = (suitCount[c.suit] || 0) + 1;
  const maxSuit = Math.max(...Object.values(suitCount));
  const flushDraw = maxSuit + slotsLeft >= 5 ? 12 : 0;
  // straight affinity: cards within a 5-window
  let v = (madeBonus[made] || 0) + flushDraw;

  // URGENCY: after this feed the lane has `lane.timer - 1` draws (the tick) before it
  // must resolve, but needs `slotsLeft` more cards. If it can't reach 5 in time it will
  // time out — prefer feeding lanes we CAN still finish, and prioritize the most urgent
  // finishable lane so it scores voluntarily.
  const drawsLeftAfter = lane.timer - 1;
  const canFinishInTime = slotsLeft <= drawsLeftAfter;
  if (!canFinishInTime) {
    // This lane is going to time out no matter what — only worth a card if the card
    // meaningfully raises the timed-out hand (a pair to save, or building two-pair).
    v -= 15;
  } else {
    // Reward feeding an urgent-but-finishable lane (finish it before the clock).
    v += Math.max(0, 8 - drawsLeftAfter) * 4;
  }
  return v;
}

function pickPlacement(s) {
  const open = openPlaceable(s);
  if (open.length === 0) return null;
  let best = null;
  for (const { l, i } of open) {
    const v = scoreTrayInto(s, l);
    if (!best || v > best.v) best = { v, i };
  }
  return best;
}

// Open a fresh lane only when we have FEED CAPACITY: keep few lanes active so each
// gets fed often enough to finish before timing out. Heuristic: don't exceed a
// target of ceil(LANE_TIMER / cards-needed) concurrent lanes, and require the
// current best placement to be weak (nothing urgent to do) before opening.
function activeLanes(s) {
  return s.lanes.filter((l) => l.open && !l.locked).length;
}
function wantsToOpen(s) {
  if (!canOpen(s)) return false;
  const open = openPlaceable(s);
  if (open.length === 0) return true; // nowhere to place — must open
  // Concurrency cap: a lane needs ~ (CAP - avg fill) feeds within LANE_TIMER draws;
  // we can sustain about floor(LANE_TIMER / 2) lanes (feeding ~1 every other draw).
  const cap = Math.max(1, Math.floor(s.cfg.LANE_TIMER / 2));
  if (activeLanes(s) >= cap) return false;
  // Only open if there's nothing pressing to do this turn (best placement is weak).
  const best = pickPlacement(s);
  return best ? best.v < 20 : true;
}

/* ---------- one run ---------- */
function playRun(cfg, seed) {
  const s = makeState(cfg, mulberry32(seed));
  s.tray = drawCard(s);
  openLane(s, 0);

  let guard = 0;
  while (!s.over && guard++ < HARD_GUARD) {
    if (s.tray == null) { s.endReason = "deckOut"; s.over = true; break; }
    if (wantsToOpen(s)) openLane(s, closedUnlocked(s));

    let open = openPlaceable(s);
    if (open.length === 0) {
      if (canOpen(s)) openLane(s, closedUnlocked(s));
      else {
        // No room and can't open. Discard if possible (advances the clock),
        // else stuck.
        if (s.discard) { s.discard = false; s.draws += 1; tickTimers(s); s.tray = drawCard(s); continue; }
        s.endReason = "stuck"; s.over = true; break;
      }
      open = openPlaceable(s);
      if (open.length === 0) { s.endReason = "stuck"; s.over = true; break; }
    }

    const mv = pickPlacement(s);
    if (!mv) { s.endReason = "stuck"; s.over = true; break; }
    placeCard(s, mv.i);

    if (s.lanes.every((l) => l.locked)) { s.endReason = "allLocked"; s.over = true; }
  }
  if (!s.endReason) s.endReason = "guard";
  return metricsOf(s);
}

function metricsOf(s) {
  return {
    highCardBusts: s.highCardBusts,
    pairBusts: s.pairBusts,
    totalBusts: s.totalBusts,
    zeroHighCardBust: s.highCardBusts === 0,
    timedOut: s.timedOutResolutions,
    voluntary: s.voluntaryResolutions,
    placements: s.placements,
    score: s.score,
    lanesLocked: s.lanes.filter((l) => l.locked).length,
    chipsAtEnd: s.chips,
    endReason: s.endReason,
    resolvedMix: s.resolvedMix,
  };
}

/* ---------- batch + report ---------- */
function runBatch(cfg, N, seed0) {
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(playRun(cfg, seed0 + i * 2654435761));
  const ends = {};
  const mix = {}; let mixTotal = 0;
  for (const r of runs) {
    ends[r.endReason] = (ends[r.endReason] || 0) + 1;
    for (const [rk, n] of Object.entries(r.resolvedMix)) { mix[rk] = (mix[rk] || 0) + n; mixTotal += n; }
  }
  return {
    n: N,
    hcBust: avg(runs.map((r) => r.highCardBusts)),
    zeroHc: pct(runs.filter((r) => r.zeroHighCardBust).length, N),
    totBust: avg(runs.map((r) => r.totalBusts)),
    timedOut: avg(runs.map((r) => r.timedOut)),
    voluntary: avg(runs.map((r) => r.voluntary)),
    draws: avg(runs.map((r) => r.placements)),
    score: avg(runs.map((r) => r.score)),
    lanesLocked: avg(runs.map((r) => r.lanesLocked)),
    chips: avg(runs.map((r) => r.chipsAtEnd)),
    ends,
    mix: {
      highPct: pct(mix[HAND.HIGH_CARD] || 0, mixTotal),
      pairPct: pct(mix[HAND.PAIR] || 0, mixTotal),
      scorePct: 100 - pct(mix[HAND.HIGH_CARD] || 0, mixTotal) - pct(mix[HAND.PAIR] || 0, mixTotal),
    },
  };
}

function printReport(cfg, r) {
  console.log(`\nLANE_TIMER = ${cfg.LANE_TIMER}   (N=${r.n})`);
  console.log(`  avg high-card busts / run      ${f2(r.hcBust)}`);
  console.log(`  % runs zero high-card bust     ${f1(r.zeroHc)}%`);
  console.log(`  avg total busts / run          ${f2(r.totBust)}   (pair-busts included)`);
  console.log(`  avg lanes locked at end        ${f2(r.lanesLocked)}`);
  console.log(`  timed-out vs voluntary resolves ${f1(r.timedOut)} / ${f1(r.voluntary)}`);
  console.log(`  avg draws (placements) / run   ${f1(r.draws)}`);
  console.log(`  avg score / run                ${Math.round(r.score)}`);
  console.log(`  avg chips at end               ${f1(r.chips)}`);
  const e = r.ends;
  const ep = (k) => `${k} ${f1(pct(e[k] || 0, r.n))}%`;
  console.log(`  end reasons   ${["allLocked", "stuck", "deckOut", "guard"].filter((k) => e[k]).map(ep).join("  ")}`);
  console.log(`  resolved mix  high ${f1(r.mix.highPct)}%  pair ${f1(r.mix.pairPct)}%  twoPair+ ${f1(r.mix.scorePct)}%`);
}

function verdict(r) {
  if (r.hcBust >= 1.5 && r.hcBust <= 3.0 && r.zeroHc < 25) return ["GOOD", "high-card lock pressure is in the target band and runs still progress."];
  if (r.hcBust < 1.0 || r.zeroHc > 40) return ["TOO SOFT", "timer too generous — bump it down (fewer draws per lane)."];
  if (r.hcBust > 4 || r.draws < 30) return ["TOO HARSH", "timer too tight — lanes lock faster than they build; raise it."];
  return ["BORDERLINE", "near the band — sweep the timer to dial it in."];
}

function runSweep(N, seed) {
  for (const lock of [true, false]) {
    console.log(`\n=== LANES x TIMER SWEEP — ${lock ? "LOCK-ON-HIGH-CARD" : "PAY-AND-CLEAR (no lock)"} (N=${N}) ===`);
    console.log(" lanes timer | hcEvt/run zeroHc% timedOut draws/run score  chipsEnd  end(allLocked/stuck/deckOut)");
    for (const L of [3, 4]) {
      for (const t of [4, 6, 8, 10]) {
        const r = runBatch(makeCfg({ LANES: L, LANE_TIMER: t, lockOnHighCard: lock }), N, seed);
        const al = f1(pct(r.ends.allLocked || 0, r.n));
        const st = f1(pct(r.ends.stuck || 0, r.n));
        const dk = f1(pct(r.ends.deckOut || 0, r.n));
        console.log(
          `  ${String(L).padStart(2)}   ${String(t).padStart(3)}   |   ${f2(r.hcBust).padStart(5)}    ${f1(r.zeroHc).padStart(4)}%   ` +
          `${f1(r.timedOut).padStart(5)}   ${f1(r.draws).padStart(5)}  ${String(Math.round(r.score)).padStart(6)}   ${f1(r.chips).padStart(5)}   ${al}%/${st}%/${dk}%`
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
  const timer = getNum("--timer", 6);
  const sweep = args.includes("--sweep");
  const oneDeck = args.includes("--oneDeck");

  console.log("========================================================");
  console.log("LANE-TIMER SIM — timer-driven bust pressure (tray model)");
  console.log(`config: LANES=${DEFAULT_LANES} CAP=5 TIMER=${timer}${oneDeck ? " oneDeck" : ""}  runs=${N} seed=${seed}`);
  console.log("========================================================");
  console.log("BASELINE (current game post save-token fix): ~1.29 total busts/run, ~14% zero-bust, ~92 draws.");
  console.log("TARGET: high-card LOCKS/run ~1.5-3.0, zero-bust < 25%, runs still progress.");

  const cfg = makeCfg({ LANE_TIMER: timer, oneDeck });
  const r = runBatch(cfg, N, seed);
  printReport(cfg, r);
  const [tag, why] = verdict(r);
  console.log(`\nVERDICT (timer ${timer}): ${tag}`);
  console.log(`  ${why}`);

  if (sweep) runSweep(Math.min(N, 300), seed);
  process.exit(0);
}

main();
