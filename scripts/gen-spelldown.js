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
   word array (logic.js).

   HOW BOARDS ARE CHOSEN. The ENABLE list is exhaustive (lots of obscure but
   valid words) and the repo has no word-frequency data, so we can't rank words
   by how common they are. Instead we make the SHAPE of each board friendly and
   lean on two facts: (1) the PANGRAM is the centerpiece, so we require every
   board to have one and surface boards whose pangrams read as real words; (2)
   obscure words are harmless — they're only ever "bonus" finds, and the rank
   thresholds in logic.js are a PERCENT of the day's max, so "Genius" never needs
   the obscure tail. Concretely we sweep every 7-distinct-letter set that appears
   in the dictionary, then keep only sets that are:
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

// Board tuning. Words are 4–7 letters (4 = classic Spelling-Bee minimum; 7 is
// the natural pangram length for a 7-distinct-letter set).
const MIN_WORD = 4;
const POOL_LENS = [4, 5, 6, 7];
// Comfortable board sizes (English 7-letter sets are productive; this keeps the
// "missed words" reveal from being demoralizing while leaving room to dig).
const MIN_BOARD = 24;
const MAX_BOARD = 52;
const TARGET_BOARD = 36; // we prefer centers landing near here
// Prefer a required (center) letter that's common, so the constraint feels fair.
const COMMON_CENTER = "ETAOINSRL".split("");
const VOWELS = new Set("AEIOU".split(""));
const EXOTIC = new Set("JQXZ".split(""));
// How many boards to ship (the rotation pool). The sweep finds far more; we keep
// the nicest this many.
const TARGET_BOARDS = 48;

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

// Build the full word pool once, each tagged with its set-mask.
const POOL = [];
for (const len of POOL_LENS) {
  for (const w of loadWords(len)) {
    if (w.length >= MIN_WORD) POOL.push([w, maskOf(w)]);
  }
}

// Every word for a 7-letter set `letters` with required `center`: word uses only
// those letters (mask subset) AND contains the center. Pangram = all seven.
function boardFor(letters, center) {
  const Lmask = maskOf(letters);
  const cbit = 1 << (center.charCodeAt(0) - A);
  const words = [];
  const pangrams = [];
  for (const [w, m] of POOL) {
    if ((m & ~Lmask) !== 0) continue; // contains a letter outside the set
    if ((m & cbit) === 0) continue; // missing the required center
    words.push(w);
    if (m === Lmask) pangrams.push(w); // uses all seven distinct letters
  }
  words.sort();
  pangrams.sort();
  return { words, pangrams };
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
    if (b.words.length < MIN_BOARD || b.words.length > MAX_BOARD) continue;
    // Prefer a common center, then a size near the target.
    const key = [letterRank(center), Math.abs(b.words.length - TARGET_BOARD)];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) {
      best = { center, board: b, key, vowels };
    }
  }
  if (!best) return null;
  return {
    id: `spd-${letters.toLowerCase()}-${best.center.toLowerCase()}`,
    letters, // 7 distinct, sorted
    center: best.center, // required letter
    words: best.board.words, // every valid word (UPPER), sorted
    pangrams: best.board.pangrams, // subset using all 7
    maxWords: best.board.words.length,
    _vowels: best.vowels, // ranking only (stripped before output)
  };
}

// ── run ───────────────────────────────────────────────────────────────────────
console.log("\nGEN-SPELLDOWN — building the daily Spelldown boards\n");
console.log(`  pool: ${POOL.length} words (lengths ${POOL_LENS.join("/")}, min ${MIN_WORD})`);
console.log(`  candidate 7-letter sets: ${candidateSets.size}`);

const all = [];
for (const letters of candidateSets) {
  const b = bestBoardForSet(letters);
  if (b) all.push(b);
}

// Keep ONLY boards whose pangram is an everyday word (NICE_PANGRAMS). Because the
// daily layer (rotateDaily) shuffles the whole pool, a board buried at the end of
// the file can still surface on day 1 — so "friendly" has to be a property of
// EVERY shipped board, not just the first few. Filtering (not just ranking)
// guarantees no day ever lands on an obscure pangram like GLAIKET.
const nice = all.filter((b) => hasNicePangram(b.pangrams));

// Among the friendly boards, prefer more pangrams, then more vowels, then size
// near the target — then take the pool.
nice.sort(
  (a, b) =>
    b.pangrams.length - a.pangrams.length ||
    b._vowels - a._vowels ||
    Math.abs(a.maxWords - TARGET_BOARD) - Math.abs(b.maxWords - TARGET_BOARD)
);

const boards = nice.slice(0, TARGET_BOARDS).map(({ _vowels, ...keep }) => keep);
console.log(
  `  ${all.length} playable boards; ${nice.length} with an everyday pangram.`
);

for (const b of boards) {
  console.log(
    `  ${b.letters} ·${b.center}  ${String(b.maxWords).padStart(2)}w  ` +
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
  "// #/play/spelldown. Run `npm run gen:spelldown` to regenerate from the\n" +
  "// committed word lists in assets-src/wordlists/.\n";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, OUT_FILE),
  `${banner}export default ${JSON.stringify(boards, null, 2)};\n`
);

console.log(`\n✓ wrote ${boards.length} boards → src/data/generated/${OUT_FILE}\n`);
