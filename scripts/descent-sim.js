/* ============================================================
   THE DESCENT — headless balance simulator
   Drives the real engine (no React) to measure generation
   difficulty and the ember economy, so constants are tuned from
   data rather than feel. Run:  node scripts/descent-sim.js
   ============================================================ */

import {
  EM, STYLE, styleRank, BOSS_EVERY, VESSELS, RELIC_EVERY, PREMIUM_COST, PREMIUM_DRAW,
  generateFloor, withIntents, resolve, enumActions, cleanSolution, stateKey, regionFrom, key,
} from "../src/games/descent/engine.js";

const MAXDEPTH = 25;
const TRIALS = 60;          // runs per archetype
const INVARIANT_FLOORS = 6000;

/* ---------- shortest hitless action path (for the speedrunner + fallback) ---------- */
function bfsPath(pits, stairs, player0, enemies0, nodeCap = 20000) {
  const start = { player: player0, enemies: withIntents(player0, enemies0, pits, []) };
  const visited = new Set([stateKey(start.player, start.enemies)]);
  const queue = [{ player: start.player, enemies: start.enemies, path: [] }];
  let head = 0, explored = 0;
  while (head < queue.length) {
    if (++explored > nodeCap) return null;
    const node = queue[head++];
    for (const a of enumActions(node.player, node.enemies, pits)) {
      const pv = resolve({ pits, stairs, player: node.player, enemies: node.enemies, walls: [] }, a);
      if (pv.descend) return [...node.path, a];
      if (pv.dmg > 0) continue;
      const ne = withIntents(pv.player, pv.enemies, pits, []);
      const k = stateKey(pv.player, ne);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ player: pv.player, enemies: ne, path: [...node.path, a] });
    }
  }
  return null;
}

/* ---------- play one floor with an archetype, threading style across floors ----------
   "speed" = follow the shortest hitless line (economy floor).
   "greedy" = take any safe pit-kill that keeps the floor solvable, else advance.
   Both stay hitless (every floor is solver-guaranteed), so they never die — the
   run simply ends at MAXDEPTH. Returns this floor's ember gains + updated style. */
function playFloor(fs, ai, style0) {
  const { pits, stairs } = fs;
  let player = fs.player;
  let enemies = fs.enemies; // already withIntents
  let walls = [];
  let style = style0;
  let runKE = 0, kills = 0, pkills = 0, dmg = 0, waits = 0, safeSum = 0, safeTurns = 0;
  let path = null;

  for (let t = 0; t < 250; t++) {
    const acts = enumActions(player, enemies, pits);
    const safe = [];
    for (const a of acts) {
      const pv = resolve({ pits, stairs, player, enemies, walls }, a);
      if (pv.dmg === 0 || pv.descend) safe.push({ a, pv });
    }
    safeSum += safe.length; safeTurns++;

    let choice = safe.find((s) => s.pv.descend) || null;
    if (!choice && ai === "greedy") {
      let best = null, bestK = -1;
      for (const s of safe) {
        const k = s.pv.events.filter((e) => e.kind === "kill").length;
        if (k <= 0) continue;
        if (cleanSolution(pits, stairs, s.pv.player, s.pv.enemies, 8000).ok && k > bestK) { bestK = k; best = s; }
      }
      if (best) choice = best;
    }
    if (choice) {
      path = null; // greedy detour taken — recompute the line next time
    } else {
      if (!path || path.length === 0) path = bfsPath(pits, stairs, player, enemies);
      if (!path) break; // unreachable on a solvable floor — caught by invariants
      const a = path.shift();
      choice = { a, pv: resolve({ pits, stairs, player, enemies, walls }, a) };
    }

    const { a, pv } = choice;
    if (a.type === "wait") waits++;
    dmg += pv.dmg;

    let ke = 0, kt = 0, pk = 0, boss = 0;
    for (const e of pv.events) if (e.kind === "kill") { ke += e.boss ? EM.boss : EM.kill; kt++; if (e.byPlayer) pk++; if (e.boss) boss++; }
    // style (hitless: a hit never happens here)
    if (pk > 0) style = style + pk + (boss > 0 ? 2 : 0);
    else if (a.type === "wait") style = Math.max(0, style - 1);
    runKE += Math.round(ke * STYLE.mult[styleRank(style)]);
    kills += kt; pkills += pk;

    player = pv.player; walls = pv.walls;
    if (pv.descend) {
      const clean = dmg === 0;
      const purge = pv.enemies.length === 0;
      if (purge) runKE += EM.purge;
      if (fs.modifier) runKE += EM.mod;
      return { runKE, clean, purge, style, kills, pkills, waits, safeAvg: safeSum / safeTurns, turns: t + 1 };
    }
    enemies = withIntents(pv.player, pv.enemies, pits, pv.walls);
  }
  return { runKE, clean: dmg === 0, purge: false, style, kills, pkills, waits, safeAvg: safeSum / Math.max(1, safeTurns), turns: 250, stuck: true };
}

/* ---------- one full run to MAXDEPTH ---------- */
function playRun(ai) {
  let style = 0, cleanClears = 0, runKE = 0;
  let kills = 0, pkills = 0, waits = 0, stuck = false;
  const emberAt = {};       // cumulative embers snapshot at each depth
  const safeByDepth = {};   // tightness sample at each depth
  let topStyle = 0;
  for (let depth = 1; depth <= MAXDEPTH; depth++) {
    const floor = generateFloor(depth);
    const r = playFloor(floor, ai, style);
    style = r.style; topStyle = Math.max(topStyle, styleRank(style));
    if (r.clean) cleanClears++;
    runKE += r.runKE; kills += r.kills; pkills += r.pkills; waits += r.waits;
    if (r.stuck) stuck = true;
    safeByDepth[depth] = r.safeAvg;
    emberAt[depth] = depth * EM.depth + cleanClears * EM.clean + runKE;
  }
  return { emberAt, safeByDepth, kills, pkills, waits, topStyle, stuck };
}

/* ---------- generation stats (no AI) ---------- */
function genStats() {
  const bands = { "1-4": [], "5-9": [], "10-14": [], "15-19": [], "20-25": [] };
  const bandOf = (d) => d <= 4 ? "1-4" : d <= 9 ? "5-9" : d <= 14 ? "10-14" : d <= 19 ? "15-19" : "20-25";
  for (let depth = 1; depth <= MAXDEPTH; depth++) {
    for (let n = 0; n < 24; n++) {
      const f = generateFloor(depth);
      const raw = f.enemies.map((e) => ({ ...e }));
      const sol = cleanSolution(f.pits, f.stairs, f.player, raw, 8000);
      bands[bandOf(depth)].push({ enemies: f.enemies.length, pits: f.pits.size, len: sol.len, boss: depth % BOSS_EVERY === 0 });
    }
  }
  return { bands };
}

/* ---------- invariants ---------- */
function checkInvariants() {
  let bad = 0, sealed = 0;
  for (let i = 0; i < INVARIANT_FLOORS; i++) {
    const depth = 1 + (i % MAXDEPTH);
    const f = generateFloor(depth);
    const raw = f.enemies.map((e) => ({ ...e }));
    const sol = cleanSolution(f.pits, f.stairs, f.player, raw, 8000);
    if (!sol.ok) { bad++; if (bad <= 3) console.log(`  ✗ unsolvable floor at depth ${depth}`); }
    const region = regionFrom(f.player, f.pits);
    for (const e of f.enemies) if (!region.has(key(e.x, e.y))) { sealed++; if (sealed <= 3) console.log(`  ✗ sealed enemy (${e.type}) at depth ${depth}`); }
  }
  return { bad, sealed };
}

/* ---------- run + report ---------- */
const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const f1 = (x) => x.toFixed(1);

console.log("THE DESCENT — balance sim  (depth cap " + MAXDEPTH + ", " + TRIALS + " runs/archetype)\n");

console.log("INVARIANTS  (" + INVARIANT_FLOORS + " floors)");
const inv = checkInvariants();
console.log(`  unsolvable floors : ${inv.bad}`);
console.log(`  sealed enemies    : ${inv.sealed}`);
console.log(inv.bad === 0 && inv.sealed === 0 ? "  ✓ all clear\n" : "  ✗ FAILURES ABOVE\n");

const gs = genStats();
console.log("GENERATION  (per depth band)");
console.log("  band     enemies  pits  hitlessLen");
for (const [band, rows] of Object.entries(gs.bands)) {
  if (!rows.length) continue;
  const lens = rows.map((r) => r.len).filter((l) => l > 0);
  console.log(`  ${band.padEnd(8)} ${f1(avg(rows.map((r) => r.enemies))).padStart(6)}  ${f1(avg(rows.map((r) => r.pits))).padStart(4)}  ${f1(avg(lens)).padStart(6)}`);
}
console.log("");

for (const ai of ["speed", "greedy"]) {
  const runs = Array.from({ length: TRIALS }, () => playRun(ai));
  const at = (d) => avg(runs.map((r) => r.emberAt[d]));
  const tight = (d) => avg(runs.map((r) => r.safeByDepth[d]));
  console.log(`ARCHETYPE: ${ai === "speed" ? "SPEEDRUNNER (min economy)" : "GREEDY HUNTER (max economy)"}`);
  console.log("  embers @ depth   5: " + f1(at(5)) + "   10: " + f1(at(10)) + "   15: " + f1(at(15)) + "   20: " + f1(at(20)));
  console.log("  tightness (safe acts/turn) d5: " + f1(tight(5)) + "  d10: " + f1(tight(10)) + "  d20: " + f1(tight(20)));
  console.log("  avg kills/run: " + f1(avg(runs.map((r) => r.kills))) + "   player-kills: " + f1(avg(runs.map((r) => r.pkills))) + "   peak style rank: " + f1(avg(runs.map((r) => r.topStyle))));
  // runs-to-afford each vessel, assuming a typical run reaches depth 10
  const e10 = at(10), e15 = at(15);
  console.log("  runs-to-afford (typical depth-10 run, " + f1(e10) + " ✦):");
  for (const v of VESSELS) if (v.cost > 0) console.log("    " + v.name.padEnd(9) + " ✦" + String(v.cost).padStart(4) + "  →  " + (e10 > 0 ? (v.cost / e10).toFixed(1) : "∞") + " runs   (depth-15: " + (e15 > 0 ? (v.cost / e15).toFixed(1) : "∞") + ")");
  console.log("");
}

console.log("KNOBS  EM=" + JSON.stringify(EM) + "  RELIC_EVERY=" + RELIC_EVERY + "  PREMIUM_COST=" + PREMIUM_COST + "  PREMIUM_DRAW=" + PREMIUM_DRAW);
console.log("       STYLE.thresh=" + JSON.stringify(STYLE.thresh) + "  vessels=" + VESSELS.filter((v) => v.cost).map((v) => v.cost).join("/"));
