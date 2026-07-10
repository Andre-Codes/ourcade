/* ============================================================
   GEN-CHAIN — builds the daily "Chain" puzzles and writes them to
   src/data/generated/chain.js.

   Chain is a timed last-first word game: each word starts with the LAST letter of
   the previous word, no repeats, and — new — obeys the day's extra RULE (and on
   some days a CATEGORY). Build the longest chain you can from the day's seed in
   60 seconds.

   BUILD-TIME emitter: each puzzle picks
     • a SEED word,
     • one RULE from the shared pool (src/games/chain/rules.js), weighted so most
       days are approachable and the pool-shrinking rules are rarer,
     • optionally a CATEGORY (~1 in 3): a themed word list (assets-src/categories/
       <name>.txt) that becomes the day's accept-dictionary,
   then computes a PAR by greedily building a long valid chain UNDER those exact
   constraints, so par is always achievable. Category days ship the category word
   list inline (it's the runtime accept-set); plain days validate against the
   shipped common-words set in the browser.

   Run:  npm run gen:chain     (no network, no API key)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allRules, ruleMeta } from "../src/games/chain/rules.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDLIST_DIR = path.join(ROOT, "assets-src", "wordlists");
const CATEGORY_DIR = path.join(ROOT, "assets-src", "categories");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "chain.js";

const SEED = 2026;
const TARGET = 180; // rotation pool size
const MIN_LEN = 4; // seed / chain words are 4–8 letters (matches the runtime dict)
const MAX_LEN = 8;
const PAR_CAP = 9; // cap the target chain so par stays fun, not a grind
const CATEGORY_EVERY = 3; // ~1 in N puzzles carries a category
const MIN_PAR = 4; // ship only seeds that afford at least this many links

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const randInt = (n) => Math.floor(rng() * n);
const pick = (arr) => arr[randInt(arr.length)];

// Weighted pick over rule instances (LIGHT rules have higher weight).
function pickRule(rules) {
  const total = rules.reduce((s, r) => s + r.weight, 0);
  let t = rng() * total;
  for (const r of rules) {
    t -= r.weight;
    if (t <= 0) return r;
  }
  return rules[rules.length - 1];
}

// ── word pools ────────────────────────────────────────────────────────────────
function loadCommon() {
  const file = path.join(WORDLIST_DIR, "common-10k.txt");
  if (!fs.existsSync(file)) throw new Error("common-10k.txt not found in assets-src/wordlists.");
  const words = [];
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const w = raw.trim().toUpperCase();
    if (w.length >= MIN_LEN && w.length <= MAX_LEN && /^[A-Z]+$/.test(w)) words.push(w);
  }
  return words;
}
const COMMON = loadCommon();

// Categories: { id, label, words:[…], byFirst:{…} }. Words are 4–8 letters, real
// (the .txt is hand-curated + validated against ENABLE). The list itself is the
// runtime accept-set on a category day, so we don't intersect with common-10k.
const CATEGORY_LABELS = {
  animals: "🐾 Animals",
  food: "🍎 Food & Drink",
  nature: "🌲 Nature & Places",
  body: "🤸 Body & Actions",
};
function loadCategories() {
  if (!fs.existsSync(CATEGORY_DIR)) return [];
  const cats = [];
  for (const fname of fs.readdirSync(CATEGORY_DIR)) {
    if (!fname.endsWith(".txt")) continue;
    const id = fname.replace(/\.txt$/, "");
    const words = [
      ...new Set(
        fs
          .readFileSync(path.join(CATEGORY_DIR, fname), "utf8")
          .split(/\r?\n/)
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length >= MIN_LEN && w.length <= MAX_LEN && /^[A-Z]+$/.test(w))
      ),
    ];
    cats.push({ id, label: CATEGORY_LABELS[id] || id, words });
  }
  return cats;
}
const CATEGORIES = loadCategories();

const RULES = allRules();

// Index a word pool by first letter (for chain jumps).
function indexByFirst(words) {
  const idx = {};
  for (const w of words) (idx[w[0]] ||= []).push(w);
  return idx;
}
const COMMON_BY_FIRST = indexByFirst(COMMON);

// Greedy chain from `seed` over `pool` (indexed by first letter in `byFirst`),
// where every added word must pass rule.test against the chain built so far.
// Prefers next words whose tail still has continuations so we don't strand early.
function greedyChain(seed, pool, byFirst, rule) {
  const used = new Set([seed]);
  const chain = [seed];
  let cur = seed;
  while (chain.length < PAR_CAP) {
    const letter = cur[cur.length - 1];
    let opts = (byFirst[letter] || []).filter(
      (w) => !used.has(w) && rule.test(w, { prevWord: cur, chain: chain.slice() })
    );
    if (!opts.length) break;
    // Prefer words whose LAST letter still leads somewhere (avoid dead-ending).
    const viable = opts.filter((w) => (byFirst[w[w.length - 1]]?.length || 0) > 0);
    const chosen = viable.length ? viable : opts;
    const next = chosen[randInt(chosen.length)];
    used.add(next);
    chain.push(next);
    cur = next;
  }
  return chain;
}

console.log("\nGEN-CHAIN — building the daily Chain puzzles\n");
console.log(`  common pool: ${COMMON.length} words (${MIN_LEN}–${MAX_LEN} letters)`);
console.log(`  categories:  ${CATEGORIES.map((c) => `${c.id}(${c.words.length})`).join(", ") || "none"}`);
console.log(`  rules:       ${RULES.length} instances`);

const puzzles = [];
let guard = 0;
const ruleCounts = {};
const catCounts = {};
while (puzzles.length < TARGET && guard < TARGET * 120) {
  guard++;
  const rule = pickRule(RULES);

  // Roughly every CATEGORY_EVERY-th puzzle gets a category (deterministic-ish via
  // rng); the rest are plain common-dict chains.
  const useCat = CATEGORIES.length > 0 && randInt(CATEGORY_EVERY) === 0;
  const category = useCat ? pick(CATEGORIES) : null;

  const pool = category ? category.words : COMMON;
  const byFirst = category ? indexByFirst(category.words) : COMMON_BY_FIRST;

  // Seed must satisfy the rule as the chain's first word (chain so far = []).
  const seedCandidates = pool.filter((w) => rule.test(w, { prevWord: "", chain: [] }));
  if (!seedCandidates.length) continue;
  const seed = pick(seedCandidates);
  // Skip S-tail seeds on PLAIN days (they funnel into the S-plural super-cluster,
  // making samples look identical). Category pools are small, so allow them there.
  if (!category && seed.endsWith("S")) continue;

  const chain = greedyChain(seed, pool, byFirst, rule);
  if (chain.length - 1 < MIN_PAR) continue; // not enough of a target — try again

  const puzzle = {
    id: `chain-${String(puzzles.length + 1).padStart(3, "0")}`,
    seed,
    par: chain.length - 1,
    sample: chain,
    rule: ruleMeta(rule),
  };
  // Reference the category by id only — the word lists ship ONCE in a shared map
  // (below) so we don't repeat ~150 words on every category puzzle.
  if (category) puzzle.category = category.id;
  puzzles.push(puzzle);

  ruleCounts[rule.id] = (ruleCounts[rule.id] || 0) + 1;
  if (category) catCounts[category.id] = (catCounts[category.id] || 0) + 1;
}

for (const p of puzzles.slice(0, 12)) {
  const cat = p.category ? ` {${p.category}}` : "";
  console.log(`  ${p.seed} par ${p.par}${cat} [${p.rule.id}] ${p.sample.join(" → ")}`);
}
console.log(`\n  built ${puzzles.length} puzzles.`);
console.log(`  rule spread: ${Object.entries(ruleCounts).map(([k, v]) => `${k}:${v}`).join(" ")}`);
console.log(`  category days: ${Object.entries(catCounts).map(([k, v]) => `${k}:${v}`).join(" ") || "none"}`);

// Ship the category word lists ONCE, keyed by id + carrying the display label.
// A puzzle's `category` field is just the id; the runtime resolves the words.
const categoryMap = {};
for (const c of CATEGORIES) categoryMap[c.id] = { label: c.label, words: c.words };

const banner =
  "// AUTO-GENERATED by scripts/gen-chain.js — do not edit by hand.\n" +
  "// Daily Chain puzzles (seed + par + a rule, sometimes a category id) for the\n" +
  "// cabinet at #/play/chain. Plain days validate against the common-words dict;\n" +
  "// category days use the shared `categories` map below as their accept-set.\n" +
  "// Run `npm run gen:chain` to regenerate.\n";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, OUT_FILE),
  `${banner}export const categories = ${JSON.stringify(categoryMap, null, 2)};\n\n` +
    `export default ${JSON.stringify(puzzles, null, 2)};\n`
);

console.log(`\n✓ wrote ${puzzles.length} puzzles → src/data/generated/${OUT_FILE}\n`);
