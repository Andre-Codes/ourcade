/* ============================================================
   GEN-SPELLDOWN — builds the daily "Spelldown" boards and writes them to
   src/data/generated/spelldown.js.

   Spelldown is Ourcade's daily word-finder (a Spelling-Bee-shaped cabinet,
   src/games/Spelldown.jsx). Each board is SEVEN distinct letters with one
   REQUIRED center letter; the player makes as many real words (4+ letters) as
   they can using only those seven letters — repeats allowed — and every word
   must include the center. A word that uses all seven distinct letters is the
   PANGRAM (the jackpot).

   Like gen-solve-puzzles.js and fetch-draw-guides.js this is a BUILD-TIME
   emitter: the heavy lifting (enumerating every valid word, finding pangrams)
   happens here against the committed ENABLE word lists, and the browser ships
   only finished, vetted data — it never sees the 173k-word list and never
   validates words at runtime, it just checks membership in the day's precomputed
   word arrays (logic.js).

   TWO-TIER WORD LISTS. Each board ships TWO lists:
       • required[] — the GOAL: up to 40 common words (google-10000-english
         intersection). Completing the day = finding these; ranks/progress and
         "n/max" all measure against required (maxWords = required.length).
       • accepted[] — the broader pool: EVERY valid ENABLE word for the set +
         center (the required set PLUS the obscure tail). judge() accepts against
         THIS, so a player who happens to know an unusual word (e.g. PRETTIER on
         EINOPRT·E) is credited even though it isn't one of the required 40.
   pangrams[] are sourced from accepted (any pangram, common or not, lights the
   🐝), but at least one pangram is guaranteed to also be in required so the goal
   set always contains the jackpot.

   HOW BOARDS ARE CHOSEN. Board LETTER-SETS are discovered against the exhaustive
   ENABLE list (below). The REQUIRED list is CURATED — intersected with a
   common-words set (google-10000-english, common-10k.txt) so the goal never
   depends on obscure words and reads friendly; the ACCEPTED list is the full
   ENABLE membership so nothing valid is wrongly rejected. On top of
   that we make the SHAPE of each board friendly: (1) the PANGRAM is the
   centerpiece, so we require every board to have one (in the curated set) and
   surface boards whose pangrams read as everyday words; (2) rank thresholds in
   logic.js are a PERCENT of the day's max, so "Genius" never needs an obscure
   tail. Concretely we sweep every 7-distinct-letter set that appears in the
   dictionary, then keep only sets that are:
       • vowel-friendly  (≥ 2 vowels, ≤ 1 of J/Q/X/Z),
       • a comfortable size  (BOARD band below — not thin, not demoralizing),
       • have ≥ 1 pangram with a NON-exotic required center,
   pick the friendliest center (common letter, size near the band's middle), and
   keep the best TARGET_BOARDS by a "niceness" rank (more pangrams, more vowels,
   size near target). That yields a large, pleasant rotation pool with no
   hand-maintained word lists.

   Determinism: the OUTPUT order is the rank order (stable for a fixed dictionary
   + tuning). The game's rotateDaily picks today's board from this pool, the same
   date-seeded layer everything else uses.

   Word source: assets-src/wordlists/<n>.txt (4.txt..7.txt), same loader idiom as
   gen-solve-puzzles.js.

   Run:  npm run gen:spelldown     (no network, no API key)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDLIST_DIR = path.join(ROOT, "assets-src", "wordlists");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "spelldown.js";

// Board tuning. The REQUIRED (goal) set is 4–7 letters — 4 = classic
// Spelling-Bee minimum; 7 is the natural pangram length for a 7-distinct-letter
// set. The ACCEPTED pool goes LONGER (up to ACCEPT_MAX_LEN): a word that repeats
// the set's letters can exceed 7 (e.g. PRETTIER, 8, on EINOPRT·E), and we don't
// want to wrongly reject those at play time even though they're never the goal.
const MIN_WORD = 4;
const REQUIRED_LENS = [4, 5, 6, 7]; // lengths eligible for the common goal set
const ACCEPT_MAX_LEN = 15; // longest word we consider for the accepted pool
// Comfortable board sizes, measured against the REQUIRED (common-words) goal set.
// English 7-letter sets rarely yield 40+ *common* words, so MIN stays modest to
// keep a healthy rotation pool; the broader ACCEPTED pool (below) carries the
// obscure tail without being required.
const MIN_BOARD = 28; // min required (common) goal words per board
const MAX_BOARD = 60; // pre-cap sanity bound on required before the 40-cap
const TARGET_BOARD = 40; // the day's goal; required is capped here
const REQUIRED_CAP = 40; // hard cap on the required goal set ("40 to finish")
// The accepted pool must be a meaningful superset of the goal set, else the two
// tiers add nothing — require at least this many extra accepted words.
const MIN_ACCEPTED_EXTRA = 8;
// Prefer a required (center) letter that's common, so the constraint feels fair.
const COMMON_CENTER = "ETAOINSRL".split("");
const VOWELS = new Set("AEIOU".split(""));
const EXOTIC = new Set("JQXZ".split(""));
// How many boards to ship (the rotation pool). The sweep finds far more; we keep
// the nicest this many.
const TARGET_BOARDS = 180;

// A curated allowlist of everyday pangram words. A board that CAN show one of
// these as its pangram is ranked ahead of one whose only pangrams are obscure
// (GLAIKET, TAGLIKE…), so the most-played early days land on friendly boards.
// This only reorders/selects — every board is still fully dictionary-validated.
// (Each must be a 7-distinct-letter word to be a pangram; non-pangrams here are
// simply ignored.)
const NICE_PANGRAMS = new Set([
  "PAINTED", "NOTICED", "PLANETS", "CAPTURE", "PICTURE", "MACHINE", "KITCHEN",
  "JOURNEY", "DOLPHIN", "MONSTER", "DIAMOND", "GARDENS", "FIGHTER", "FREIGHT",
  "AUCTION", "CAUTION", "BAILOUT", "OUTWARD", "OUTDRAW", "WALKOUT", "WASHOUT",
  "BACKOUT", "OUTBACK", "GROWNUP", "PINHEAD", "HEADPIN", "CARVING", "CRAVING",
  "BLOWING", "BOWLING", "FLOWING", "DUSTPAN", "STANDUP", "CERTIFY", "RECTIFY",
  "GROUPIE", "POURING", "VARIOUS", "SAVIOUR", "TEQUILA", "UTOPIAN", "CONDUIT",
  "CARDINAL", "RAINCOAT", "PREDATOR", "TADPOLES", "ELEVATOR", "MAGNETIC",
  "TRIANGLE", "CREATOR", "REASONED", "ISOLATE", "OUTSIDER", "GANGSTER",
  "DAYDREAM", "STRANGLE", "WEAPONS", "ANOTHER", "BEHINDS", "TANGLED", "FLANKER",
  "BEDROCK", "HUSBAND", "PROBLEMS",
  // verified to also produce an in-band board with themselves as the pangram:
  "THUNDER", "FACTORY", "VICTORY", "WALNUTS", "CAMPING", "JUMPING", "PARKING",
  "WALKING", "KINGDOM", "VIBRANT", "JACKPOT", "WIZARDS", "ZEPHYRS", "BEDROOM",
  "MORNING", "PAINTER", "SHELTER", "BRACKET", "CHAMBER", "FORWARD", "HAMSTER",
  "LEOPARD", "PANTHER", "SPIDERS", "TROUBLE", "UNICORN", "HARVEST", "MUSTARD",
  "ORGANIC", "READING", "FISHING", "DANCING",
]);
const hasNicePangram = (pangrams) => pangrams.some((p) => NICE_PANGRAMS.has(p));

// ── word list loading (same idiom as gen-solve-puzzles.js) ────────────────────
function loadWords(len) {
  const file = path.join(WORDLIST_DIR, `${len}.txt`);
  if (!fs.existsSync(file)) {
    console.warn(`  ⚠ word list ${len}.txt not found — skipping that length`);
    return [];
  }
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length === len && /^[A-Z]+$/.test(w));
}

// The curated common-words set (google-10000-english, no-swears). Board LETTER-SETS
// are still discovered against the exhaustive ENABLE list above, but each board's
// shipped ANSWER list is intersected with this set so the obscure ENABLE tail never
// pads a day's word list (or the prior-day reveal). Flat file (frequency order, not
// length-sorted); we keep only the 4–7-letter Spelldown band as a Set for O(1)
// membership. ENABLE stays authoritative for quantity games / other generators.
function loadCommonSet() {
  const file = path.join(WORDLIST_DIR, "common-10k.txt");
  if (!fs.existsSync(file)) {
    throw new Error(
      "common-10k.txt not found in assets-src/wordlists — Spelldown answers are " +
        "curated against it. Fetch google-10000-english-no-swears.txt into that path."
    );
  }
  const set = new Set();
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const w = raw.trim().toUpperCase();
    if (w.length >= MIN_WORD && w.length <= 7 && /^[A-Z]+$/.test(w)) set.add(w);
  }
  return set;
}
const COMMON = loadCommonSet();

// ── letter-set bitmask helpers ────────────────────────────────────────────────
const A = "A".charCodeAt(0);
const maskOf = (w) => {
  let m = 0;
  for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - A);
  return m;
};
const distinct = (s) => new Set(s.split("")).size;
const sortedSet = (s) => [...new Set(s.split(""))].sort().join("");
const letterRank = (c) => {
  const i = COMMON_CENTER.indexOf(c);
  return i < 0 ? 99 : i;
};

// Build the full word pool once, each tagged with its set-mask. The pool spans
// 4..ACCEPT_MAX_LEN so long words (PRETTIER, 8) are eligible for `accepted`;
// only 4..7-letter words can enter the common `required` goal set (below).
const POOL = [];
for (let len = MIN_WORD; len <= ACCEPT_MAX_LEN; len++) {
  for (const w of loadWords(len)) {
    if (w.length >= MIN_WORD) POOL.push([w, maskOf(w)]);
  }
}

// Every word for a 7-letter set `letters` with required `center`: word uses only
// those letters (mask subset) AND contains the center. Pangram = all seven.
// Returns two tiers: `accepted` (full ENABLE membership) and `required` (the
// curated common-words subset, capped at REQUIRED_CAP). Pangram = all seven.
function boardFor(letters, center) {
  const Lmask = maskOf(letters);
  const cbit = 1 << (center.charCodeAt(0) - A);
  const accepted = [];
  let required = [];
  const pangrams = [];
  for (const [w, m] of POOL) {
    if ((m & ~Lmask) !== 0) continue; // contains a letter outside the set
    if ((m & cbit) === 0) continue; // missing the required center
    accepted.push(w); // every valid word (any length) is accepted at play time
    // Goal set: common words, 4..7 letters only (keeps the goal tidy/familiar).
    if (w.length <= 7 && COMMON.has(w)) required.push(w);
    // Pangram = uses all seven distinct board letters. m === Lmask means every
    // board letter appears (mask is per-distinct-letter), so a longer word that
    // repeats a letter still counts (e.g. DEGENERATE uses all of ADEGNRT).
    if (m === Lmask) pangrams.push(w);
  }
  // Cap the goal set at REQUIRED_CAP. Pin any pangram that's already common so
  // the jackpot never gets trimmed out, then fill with the shortest/most
  // approachable words, then store alphabetically.
  if (required.length > REQUIRED_CAP) {
    const pinned = required.filter((w) => pangrams.includes(w));
    const rest = required
      .filter((w) => !pinned.includes(w))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
    required = [...pinned, ...rest].slice(0, REQUIRED_CAP);
  }
  accepted.sort();
  required.sort();
  pangrams.sort();
  return { accepted, required, pangrams };
}

// ── candidate letter-sets ─────────────────────────────────────────────────────
// Every distinct 7-letter set that occurs as a real 7-distinct-letter word (so
// each set is guaranteed to have at least one pangram — that word). Dedupe by the
// sorted-letter signature.
const candidateSets = new Set();
for (const w of loadWords(7)) {
  if (distinct(w) !== 7) continue;
  candidateSets.add(sortedSet(w));
}

// ── score one set → its best playable board (or null) ─────────────────────────
function bestBoardForSet(letters) {
  const vowels = [...letters].filter((c) => VOWELS.has(c)).length;
  if (vowels < 2) return null; // need a couple of vowels to be friendly
  if ([...letters].filter((c) => EXOTIC.has(c)).length > 1) return null; // ≤1 exotic

  let best = null;
  for (const center of letters) {
    if (EXOTIC.has(center)) continue; // never force J/Q/X/Z as the required letter
    const b = boardFor(letters, center);
    if (b.pangrams.length < 1) continue;
    // The goal set must contain the jackpot — at least one pangram is common.
    if (!b.pangrams.some((p) => b.required.includes(p))) continue;
    // Band is measured against the REQUIRED (goal) size.
    if (b.required.length < MIN_BOARD || b.required.length > MAX_BOARD) continue;
    // Accepted must be a meaningful superset of the goal set.
    if (b.accepted.length < b.required.length + MIN_ACCEPTED_EXTRA) continue;
    // Prefer a common center, then a goal size near the target.
    const key = [letterRank(center), Math.abs(b.required.length - TARGET_BOARD)];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) {
      best = { center, board: b, key, vowels };
    }
  }
  if (!best) return null;
  return {
    id: `spd-${letters.toLowerCase()}-${best.center.toLowerCase()}`,
    letters, // 7 distinct, sorted
    center: best.center, // required letter
    required: best.board.required, // the goal: <=40 common words (UPPER), sorted
    accepted: best.board.accepted, // every valid ENABLE word (superset), sorted
    pangrams: best.board.pangrams, // subset using all 7 (from accepted)
    maxWords: best.board.required.length, // ranks/progress measure the goal set
    _vowels: best.vowels, // ranking only (stripped before output)
  };
}

// ── run ───────────────────────────────────────────────────────────────────────
console.log("\nGEN-SPELLDOWN — building the daily Spelldown boards\n");
console.log(`  pool: ${POOL.length} words (lengths ${MIN_WORD}..${ACCEPT_MAX_LEN})`);
console.log(`  candidate 7-letter sets: ${candidateSets.size}`);

const all = [];
for (const letters of candidateSets) {
  const b = bestBoardForSet(letters);
  if (b) all.push(b);
}

// Every playable board is already friendly: its answer list — pangram included —
// is curated to the common-words set, so no day can land on an obscure pangram
// like GLAIKET (that whole tail is gone). NICE_PANGRAMS is therefore a RANKING
// preference now, not a hard filter: boards whose pangram is a hand-picked
// everyday word (AUCTION, THUNDER…) sort to the front, but the rest still fill out
// a healthy rotation pool instead of collapsing it to a handful.
const niceCount = all.filter((b) => hasNicePangram(b.pangrams)).length;

// Rank: hand-picked everyday pangram first, then more pangrams, more vowels, then
// size near the target — and keep the best TARGET_BOARDS.
all.sort(
  (a, b) =>
    Number(hasNicePangram(b.pangrams)) - Number(hasNicePangram(a.pangrams)) ||
    b.pangrams.length - a.pangrams.length ||
    b._vowels - a._vowels ||
    Math.abs(a.maxWords - TARGET_BOARD) - Math.abs(b.maxWords - TARGET_BOARD)
);

const boards = all.slice(0, TARGET_BOARDS).map(({ _vowels, ...keep }) => keep);
console.log(
  `  ${all.length} playable boards; ${niceCount} with a hand-picked everyday pangram.`
);

for (const b of boards) {
  console.log(
    `  ${b.letters} ·${b.center}  ${String(b.maxWords).padStart(2)}r/${String(b.accepted.length).padStart(2)}a  ` +
      `${b.pangrams.length}p  [${b.pangrams.slice(0, 3).join(", ")}]`
  );
}
console.log(`\n  ${all.length} playable boards found; shipped the best ${boards.length}.`);

if (boards.length < 14) {
  console.warn(
    `\n  ⚠ only ${boards.length} boards — the rotation pool is small; loosen the band.`
  );
}

const banner =
  "// AUTO-GENERATED by scripts/gen-spelldown.js — do not edit by hand.\n" +
  "// Daily Spelldown boards (7 letters, 1 required center) for the cabinet at\n" +
  "// #/play/spelldown. Each board has required[] (the <=40 common goal words) and\n" +
  "// accepted[] (the broader ENABLE pool judged at play time). Run\n" +
  "// `npm run gen:spelldown` to regenerate from assets-src/wordlists/.\n";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, OUT_FILE),
  `${banner}export default ${JSON.stringify(boards, null, 2)};\n`
);

console.log(`\n✓ wrote ${boards.length} boards → src/data/generated/${OUT_FILE}\n`);
