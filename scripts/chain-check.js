/* ============================================================
   CHAIN-CHECK — headless verifier for the daily Chain.
   Drives the real selection + judge logic (no React) to confirm every upcoming
   day yields a deterministic, non-fallback puzzle whose OWN sample chain is fully
   legal under its rule + category — the same discipline as spelldown-check.js.
   Run:  node scripts/chain-check.js   (npm run check:chain)
   ============================================================ */

import { dayKey } from "../src/lib/daily.js";
import PUZZLES from "../src/data/generated/chain.js";
import { puzzleFor, judge, chainNumber, categoryFor, RUN_SECONDS } from "../src/games/chain/logic.js";

const DAYS = 90; // upcoming days to audit for determinism / fallback / legality

function keysFromToday(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) =>
    dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  );
}

// Replay a sample chain through judge(): every step after the seed must be "ok".
function verifySample(puzzle) {
  const chain = [puzzle.sample[0]];
  for (let i = 1; i < puzzle.sample.length; i++) {
    const w = puzzle.sample[i];
    const verdict = judge(w, chain[chain.length - 1], chain, puzzle);
    if (verdict !== "ok") return { ok: false, at: i, word: w, verdict };
    chain.push(w);
  }
  return { ok: true };
}

const keys = keysFromToday(DAYS);
let failures = 0;

console.log(`\nOURCADE chain-check — ${PUZZLES.length} puzzles, next ${DAYS} days (${RUN_SECONDS}s runs)\n`);
console.log("date       |  #  | seed     | par | rule                | category");
console.log("-".repeat(84));

for (const key of keys) {
  const p = puzzleFor(key);
  const isFallback = p.id === "chain-fallback";
  const res = verifySample(p);
  const bad = isFallback || !res.ok || p.par < 1;
  if (bad) failures++;
  if (bad || keys.indexOf(key) < 16) {
    const catRec = categoryFor(p);
    const cat = catRec ? catRec.label : "—";
    const flag = isFallback ? " (FALLBACK!)" : !res.ok ? ` (BAD@${res.at}:${res.word}/${res.verdict})` : "";
    console.log(
      `${key} | ${String(chainNumber(key)).padStart(3)} | ${String(p.seed).padEnd(8)} | ` +
        `${String(p.par).padStart(3)} | ${String(p.rule?.label || "plain").slice(0, 19).padEnd(19)} | ${cat}${flag}`
    );
  }
}

// Determinism: same key → same puzzle id, twice.
let nondet = 0;
for (const key of keys) {
  if (puzzleFor(key).id !== puzzleFor(key).id) nondet++;
}

// Structural sanity across the whole pool.
let structBad = 0;
for (const p of PUZZLES) {
  if (!p.rule || !p.rule.id) structBad++;
  // A category puzzle must reference a real category (id resolves to a word set).
  if (p.category && !categoryFor(p)) structBad++;
  const r = verifySample(p);
  if (!r.ok) structBad++;
}

console.log("-".repeat(84));
console.log(`  day failures (fallback / illegal sample): ${failures}`);
console.log(`  non-deterministic days: ${nondet}`);
console.log(`  pool structural / sample failures: ${structBad}`);

const catCount = PUZZLES.filter((p) => p.category).length;
console.log(`  category puzzles: ${catCount}/${PUZZLES.length} (${Math.round((catCount / PUZZLES.length) * 100)}%)`);

if (failures || nondet || structBad) {
  console.error("\n✗ chain-check FAILED\n");
  process.exit(1);
}
console.log("\n✓ chain-check passed\n");
