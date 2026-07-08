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
import { LEVELS, BOSSES, RELICS, SCROLLS, EVENTS, MERCHANT_STOCK } from "../src/games/dictionary-dungeon/pools.js";
import {
  buildRun,
  currentTarget,
  currentRoom,
  isChoiceRoom,
  isMerchantRoom,
  isEventRoom,
  resolveTurn,
  takeRelic,
  leaveMerchant,
  resolveEvent,
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
  const s = String(spec);
  // A pure memory/enemy rule (or a combo whose ONLY constraint is one of those)
  // is ctx-dependent and always satisfiable in practice — never the sole gate.
  const parts = s.split("&").map((p) => p.trim());
  const memoryOnly = parts.every((p) => p === "longer" || p === "freshletters");
  if (memoryOnly) return Infinity;
  // Count real words satisfying the (possibly combined) predicate. Pass a tier
  // whenever any sub-rule is rarity-based; give memory sub-rules a neutral ctx
  // (no prevWord / enemyName) so they don't over-restrict the count.
  const needsTier = parts.some((p) => p.startsWith("tier:"));
  let n = 0;
  for (const w of WORDS) {
    const ctx = { tier: needsTier ? rarityTier(w) : null, prevWord: null, enemyName: "" };
    if (rule.test(w, ctx)) n++;
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
    // structure: each level has ≥1 gate, ≥1 monster, ≥1 treasure; and no more
    // than 1 merchant / 1 event / 1 trap (assembler caps).
    const types = lvl.rooms.map((r) => r.type);
    const countType = (t) => types.filter((x) => x === t).length;
    check(`${key} ${lvl.id} has gate`, types.includes("gate"));
    check(`${key} ${lvl.id} has monster`, types.includes("monster"));
    check(`${key} ${lvl.id} has treasure`, types.includes("treasure"));
    check(`${key} ${lvl.id} ≤1 merchant`, countType("merchant") <= 1, `${countType("merchant")}`);
    check(`${key} ${lvl.id} ≤1 event`, countType("event") <= 1, `${countType("event")}`);
    check(`${key} ${lvl.id} ≤1 trap`, countType("trap") <= 1, `${countType("trap")}`);
    // Merchant/event only appear from Level 2 on.
    if (li === 0) check(`${key} entry-hall has no merchant/event`, !types.includes("merchant") && !types.includes("event"));
    for (const room of lvl.rooms) {
      if (room.type === "merchant") {
        check(`${key} ${lvl.id} merchant has offers`, Array.isArray(room.offers) && room.offers.length >= 2);
        for (const o of room.offers) check(`${key} merchant offer priced`, typeof o.price === "number" && o.price > 0);
        continue;
      }
      if (room.type === "event") {
        check(`${key} ${lvl.id} event has choices`, !!room.event && room.event.choices.length >= 2);
        continue;
      }
      if (room.type === "treasure") {
        check(`${key} ${lvl.id} treasure has relics`, Array.isArray(room.relicChoices) && room.relicChoices.length >= 1);
        continue;
      }
      // gate / monster / trap → word rooms with a solvable rule
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

// ── 3b) event outcomes reference real relics/scrolls ──────────────────────────
console.log("Event / merchant catalog validity:");
const relicIds = new Set(RELICS.map((r) => r.id));
const scrollIds = new Set(SCROLLS.map((s) => s.id));
for (const ev of EVENTS) {
  check(`event "${ev.id}" has body + choices`, !!ev.bodyText && ev.choices.length >= 2);
  for (const c of ev.choices) {
    const o = c.outcome || {};
    if (o.relic) check(`event "${ev.id}" relic "${o.relic}" exists`, relicIds.has(o.relic));
    if (o.scroll) check(`event "${ev.id}" scroll "${o.scroll}" exists`, scrollIds.has(o.scroll));
  }
}
for (const m of MERCHANT_STOCK) {
  if (m.kind === "relic") check(`merchant "${m.id}" relic "${m.grant}" exists`, relicIds.has(m.grant));
  if (m.kind === "scroll") check(`merchant "${m.id}" scroll "${m.grant}" exists`, scrollIds.has(m.grant));
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
  const spec = target ? target.ruleSpec : "any";
  const rule = getRule(spec);
  const prev = state.prevWord;
  const needsTier = String(spec).includes("tier:");
  // Scan the whole dictionary for a satisfying word not already used. (WORDS is
  // alphabetically sorted, so a per-turn cap would make late-alphabet rules like
  // "starts:S" unsolvable for the solver even though real players can answer
  // them — a full scan of 154k words per turn is still sub-second.)
  const used = new Set(state.used || []);
  for (const w of WORDS) {
    if (used.has(w)) continue;
    const tier = needsTier ? rarityTier(w) : null;
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
    if (isMerchantRoom(state)) {
      leaveMerchant(state); // solver doesn't need to shop
      continue;
    }
    if (isEventRoom(state)) {
      // Pick the first choice the solver can afford (or the last as fallback).
      const room = currentRoom(state);
      let idx = room.event.choices.findIndex(
        (c) => c.requires?.coins == null || state.coins >= c.requires.coins
      );
      if (idx < 0) idx = room.event.choices.length - 1;
      resolveEvent(state, idx);
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
