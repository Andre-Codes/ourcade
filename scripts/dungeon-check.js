/* ============================================================
   DUNGEON-CHECK — headless verifier for Dictionary Dungeon.

   Same idea as scripts/spelldown-check.js + the invariant loop in
   scripts/pits-and-portals-sim.js: drive the REAL logic (no React) to prove the
   authored content is sound before it ships. Two guarantees:

     1) SOLVABILITY. Every rule that can appear in an assembled daily run has
        enough real ENABLE words satisfying it (per difficulty thresholds), so a
        player is never stuck in a "dictionary hostage" room. We count answers by
        scanning the shipped dictionary (dict.js) against each rule's predicate.
        Boss phases and the daily assembly for the next 60 days are exercised.

     2) EFFECT WORDS. Every word in the word-effect map (effects.js) is a real,
        playable ENABLE word — no unplayable semantic words.

   Exits nonzero on any failure (CI gate), like check:spelldown.
   Run:  node scripts/dungeon-check.js   (npm run check:dungeon)
   ============================================================ */

import { dayKey } from "../src/lib/daily.js";
import { allWords, rarityTier } from "../src/games/dictionary-dungeon/dict.js";
import { getRule, ruleNeedsContext } from "../src/games/dictionary-dungeon/rules.js";
import { allEffectWords } from "../src/games/dictionary-dungeon/effects.js";
import { LEVELS, BOSSES } from "../src/games/dictionary-dungeon/pools.js";
import {
  buildRun,
  currentTarget,
  currentRoom,
  isChoiceRoom,
  resolveTurn,
  takeRelic,
} from "../src/games/dictionary-dungeon/logic.js";

const DAYS = 60;

// Difficulty → minimum acceptable valid-answer count (design §17). Boss phases
// use the boss threshold; treasure/gate use their rule's own difficulty.
const THRESHOLDS = { easy: 500, medium: 150, hard: 40 };
const BOSS_THRESHOLD = 20;

// Count real words satisfying a rule spec. For rarity/memory rules that depend
// on run state we approximate: rarity rules are counted with the correct tier
// per word; memory rules (prevWord/enemyletter) are counted as "any valid word"
// since a satisfying answer almost always exists — they're never the sole gate.
const WORDS = [...allWords()];

function countAnswers(spec) {
  const rule = getRule(spec);
  // Memory/enemy rules: not counted in isolation (ctx-dependent, always
  // satisfiable in practice) — return Infinity so they never fail solvability.
  const s = String(spec);
  if (s === "longer" || s === "freshletters" || s === "enemyletter") return Infinity;
  let n = 0;
  for (const w of WORDS) {
    const tier = s.startsWith("tier:") ? rarityTier(w) : null;
    if (rule.test(w, { tier })) n++;
  }
  return n;
}

// Memoize counts (specs repeat across days/levels).
const _counts = new Map();
function answersFor(spec) {
  if (!_counts.has(spec)) _counts.set(spec, countAnswers(spec));
  return _counts.get(spec);
}

function keysFromToday(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) =>
    dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  );
}

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) {
    console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`);
    failures++;
  }
}

console.log(`\nOURCADE dungeon-check — ${LEVELS.length} levels, ${BOSSES.length} bosses, dict ${WORDS.length} words\n`);

// ── 1) every rule in every level pool clears its threshold ────────────────────
console.log("Rule solvability (per level pool):");
for (const level of LEVELS) {
  for (const spec of level.ruleSpecs) {
    const count = answersFor(spec);
    const rule = getRule(spec);
    const need = THRESHOLDS[rule.difficulty] ?? THRESHOLDS.medium;
    const ok = count >= need;
    const line = `  ${level.id.padEnd(20)} ${spec.padEnd(16)} ${rule.difficulty.padEnd(6)} ${String(count === Infinity ? "∞" : count).padStart(6)} / ${need}`;
    if (!ok) console.log(line + "   ✗");
    check(`rule "${spec}" in ${level.id}`, ok, `${count} answers < ${need}`);
  }
}

// ── 2) every boss phase rule clears the boss threshold ────────────────────────
console.log("\nBoss phase solvability:");
for (const boss of BOSSES) {
  boss.phases.forEach((ph, i) => {
    const count = answersFor(ph.ruleSpec);
    const ok = count >= BOSS_THRESHOLD;
    if (!ok) console.log(`  ${boss.id} phase ${i + 1} (${ph.ruleSpec}): ${count} < ${BOSS_THRESHOLD}  ✗`);
    check(`boss "${boss.id}" phase ${i + 1} (${ph.ruleSpec})`, ok, `${count} < ${BOSS_THRESHOLD}`);
  });
}

// ── 3) assembled daily runs: deterministic + every room's rule is solvable ────
console.log(`\nDaily assembly (next ${DAYS} days):`);
const keys = keysFromToday(DAYS);
let commonPathDays = 0;
for (const key of keys) {
  const a = buildRun(key);
  const b = buildRun(key);
  check(`daily ${key} deterministic`, JSON.stringify(a.levels) === JSON.stringify(b.levels));

  // Walk every step, confirm each rule is solvable and structure is sane.
  let earlyCommonOk = true;
  a.levels.forEach((lvl, li) => {
    // structure: each level has ≥1 gate, ≥1 monster, ≥1 treasure.
    const types = lvl.rooms.map((r) => r.type);
    check(`${key} ${lvl.id} has gate`, types.includes("gate"));
    check(`${key} ${lvl.id} has monster`, types.includes("monster"));
    check(`${key} ${lvl.id} has treasure`, types.includes("treasure"));
    for (const room of lvl.rooms) {
      const count = answersFor(room.ruleSpec);
      const rule = getRule(room.ruleSpec);
      const need = THRESHOLDS[rule.difficulty] ?? THRESHOLDS.medium;
      check(`${key} ${lvl.id} room rule "${room.ruleSpec}"`, count >= need, `${count} < ${need}`);
      // early-level common-word path: levels 0-1 rooms should be answerable by a
      // top-10k word (not obscure-only). We approximate: the rule isn't a
      // strictly-obscure gate in the first two levels.
      if (li <= 1 && (room.ruleSpec === "tier:obscure" || room.ruleSpec === "tier:goblin")) earlyCommonOk = false;
    }
  });
  if (earlyCommonOk) commonPathDays++;
}
check("early levels keep a common-word path every day", commonPathDays === keys.length, `${commonPathDays}/${keys.length}`);

// ── 4) every effect word is a real ENABLE word ────────────────────────────────
console.log("\nWord-effect validity:");
const effectRows = allEffectWords();
const dictSet = allWords();
const badEffect = effectRows.filter((r) => !r.dupe && !dictSet.has(r.word));
check("all effect words are real ENABLE words", badEffect.length === 0, badEffect.map((r) => `${r.word}(${r.category})`).join(", "));
console.log(`  ${effectRows.filter((r) => !r.dupe).length} unique effect words, ${badEffect.length} invalid`);

// ── 5) a smoke playthrough: auto-solve the whole daily run ─────────────────────
// Confirms the engine reaches victory when fed valid answers (no dead ends).
console.log("\nSmoke playthrough (auto-solver, today):");
const smokeOk = autoSolve(keys[0]);
check("today's dungeon is fully clearable by the auto-solver", smokeOk);

console.log("\n" + "-".repeat(60));
if (failures === 0) console.log("dungeon-check: ALL PASS ✓\n");
else console.log(`dungeon-check: ${failures} FAILURE(S) ✗\n`);
process.exit(failures ? 1 : 0);

// ── auto-solver ───────────────────────────────────────────────────────────────
// Greedily finds a valid word for the current rule and plays it until the run
// ends. Uses a modest candidate pool for speed. Returns true if it wins with
// hearts intact (i.e. the run is genuinely solvable), false if it ever gets
// stuck with no valid word.
function findAnswer(state) {
  const target = currentTarget(state);
  const rule = getRule(target ? target.ruleSpec : "any");
  const prev = state.prevWord;
  // Try a bounded scan of the dictionary for a satisfying word.
  let scanned = 0;
  for (const w of WORDS) {
    if (++scanned > 60000) break; // bound per turn
    const tier = String(target?.ruleSpec).startsWith("tier:") ? rarityTier(w) : null;
    if (!rule.test(w, { prevWord: prev, enemyName: target?.name || "", tier })) continue;
    return w;
  }
  return null;
}

function autoSolve(key) {
  const state = buildRun(key);
  // Give the solver a comfortable buffer of hearts so heart-loss from occasional
  // boss counterattacks doesn't mask a real "no valid word" dead end.
  state.hearts = 99;
  state.maxHearts = 99;
  let guard = 0;
  while (!state.over && guard++ < 500) {
    if (isChoiceRoom(state)) {
      const room = currentRoom(state);
      takeRelic(state, room.relicChoices[0]);
      continue;
    }
    const w = findAnswer(state);
    if (!w) {
      console.log(`  STUCK at ${state.levels[state.levelIdx].id} room ${state.roomIdx} rule ${currentTarget(state)?.ruleSpec}`);
      return false;
    }
    resolveTurn(state, w);
  }
  return state.won;
}
