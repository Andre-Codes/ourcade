/* ============================================================
   RELIC-RUN-CHECK — headless verifier for Daily Relic Run.
   Same idea as scripts/daily-check.js: drive the real selection
   logic (no React) to confirm the node graph is sound and that
   every upcoming day yields a deterministic, solvable, in-par
   challenge — without ever falling through to the fallback.
   Run:  node scripts/relic-run-check.js   (npm run check:relic)
   ============================================================ */

import { dayKey } from "../src/lib/daily.js";
import { RELIC_NODES, RELIC_NODE_IDS, validateRelicNodes } from "../src/data/relicNodes.js";
import {
  dailyChallenge, shortestPath, runNumber, shareText,
  MIN_CLICKS, MAX_CLICKS,
} from "../src/games/relic-run/logic.js";

const DAYS = 60; // how many upcoming days to audit for solvability

// N consecutive local-date keys starting today (mirrors daily-check.js).
function keysFromToday(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) =>
    dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  );
}

const keys = keysFromToday(DAYS);

console.log(`\nOURCADE relic-run-check — next ${DAYS} days (par ${MIN_CLICKS}–${MAX_CLICKS})\n`);
console.log("date       | run | start                       | target                      | par");
console.log("-".repeat(96));
for (const key of keys.slice(0, 14)) {
  const c = dailyChallenge(key);
  const s = RELIC_NODES[c.start]?.title || c.start;
  const t = RELIC_NODES[c.target]?.title || c.target;
  console.log(
    `${key} | #${String(runNumber(key)).padStart(2)} | ${s.slice(0, 27).padEnd(27)} | ` +
      `${t.slice(0, 27).padEnd(27)} | ${c.par}${c.fallback ? " (FALLBACK!)" : ""}`
  );
}

// ---- assertions ----
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

console.log("");

// 1) Graph integrity — reuse the data file's own validator (ids, ≥4 links, no
//    dangling/self links, full connectivity).
{
  const r = validateRelicNodes();
  check("graph well-formed (validateRelicNodes)", r.ok,
    r.ok ? `${r.nodeCount} nodes, all reachable` : r.errors.slice(0, 6).join(" · "));
}

// 2) Determinism — the same day must always resolve to the same challenge, on
//    repeated calls (independent RNG walks from the same seed).
{
  const k = keys[0];
  const a = dailyChallenge(k);
  const b = dailyChallenge(k);
  check("daily challenge deterministic",
    a.start === b.start && a.target === b.target && a.par === b.par,
    `${a.start} → ${a.target} (par ${a.par})`);
}

// 3) Solvability & quality — over the audited window every day must produce a
//    distinct start/target, a par in range, an optimalPath that actually
//    connects them, and NEVER the fallback (which would mean the RNG couldn't
//    find an in-range pair — a graph-too-sparse smell).
{
  let bad = 0, fellBack = 0, parBad = 0, pathBad = 0, sameNode = 0;
  const parHist = {};
  for (const key of keys) {
    const c = dailyChallenge(key);
    if (!c) { bad++; continue; }
    if (c.fallback) fellBack++;
    if (c.start === c.target) sameNode++;
    if (c.par < MIN_CLICKS || c.par > MAX_CLICKS) parBad++;
    parHist[c.par] = (parHist[c.par] || 0) + 1;
    // The advertised optimalPath must be a real shortest path of length par.
    const sp = shortestPath(c.start, c.target);
    if (!sp || sp.length - 1 !== c.par || c.optimalPath.length - 1 !== c.par) pathBad++;
  }
  check(`all ${DAYS} days produce a challenge`, bad === 0, `${bad} null`);
  check(`no day falls through to fallback`, fellBack === 0, `${fellBack} fell back`);
  check(`no day has start === target`, sameNode === 0, `${sameNode} degenerate`);
  check(`every par in [${MIN_CLICKS}, ${MAX_CLICKS}]`, parBad === 0, `${parBad} out of range`);
  check(`optimalPath matches BFS shortest length`, pathBad === 0, `${pathBad} mismatched`);
  console.log("      par spread: " +
    Object.keys(parHist).sort().map((p) => `${p}:${parHist[p]}`).join(" "));
}

// 4) Reachability sanity — a full all-pairs BFS sweep confirms the graph isn't
//    fragmented into islands that would starve the picker (belt-and-suspenders
//    on top of validateRelicNodes' single-source check).
{
  const ids = RELIC_NODE_IDS;
  let connected = 0, total = 0, maxDist = 0, inRange = 0;
  for (const s of ids) {
    const dist = { [s]: 0 };
    const q = [s];
    while (q.length) {
      const cur = q.shift();
      for (const nx of RELIC_NODES[cur].links) {
        if (dist[nx] == null) { dist[nx] = dist[cur] + 1; q.push(nx); }
      }
    }
    for (const t of ids) {
      if (s === t) continue;
      total++;
      const d = dist[t];
      if (d != null) {
        connected++;
        if (d > maxDist) maxDist = d;
        if (d >= MIN_CLICKS && d <= MAX_CLICKS) inRange++;
      }
    }
  }
  const pct = (100 * connected / total).toFixed(1);
  const inRangePct = (100 * inRange / total).toFixed(1);
  check("graph is strongly connected (all ordered pairs reachable)",
    connected === total, `${pct}% of ${total} pairs · max dist ${maxDist}`);
  check("enough in-range pairs to feed the daily picker",
    inRange > 0, `${inRange} pairs in [${MIN_CLICKS},${MAX_CLICKS}] (${inRangePct}%)`);
}

// 5) Share text is well-formed (no NaN run #, contains the click + par lines).
{
  const k = keys[0];
  const c = dailyChallenge(k);
  const txt = shareText(k, c.par, c.par);
  check("share text well-formed",
    /Ourcade Web Run #\d+/.test(txt) && txt.includes(`Par: ${c.par}`),
    txt.split("\n")[0]);
}

console.log(`\n${failures === 0 ? "✓ all checks passed" : "✗ " + failures + " check(s) failed"}\n`);
process.exit(failures === 0 ? 0 : 1);
