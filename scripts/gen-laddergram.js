/* ============================================================
   GEN-LADDERGRAM — builds the daily "Laddergram" puzzles and writes them to
   src/data/generated/laddergram.js.

   Laddergram is a playable daily word ladder: START → END, change ONE letter at a
   time, every rung a real (common) word, reach END in as few steps as possible.
   The static Solve-This "Word Ladder" minis (scripts/gen-solve-puzzles.js) stay
   as they are for quick perusers; this is the full cabinet version, scored and
   streaked.

   BUILD-TIME emitter: we pre-solve each daily pair here against the CURATED
   common-words dict (so every rung is a familiar word), storing the shortest
   solution and its length as PAR. The browser validates the player's own rungs
   against the shipped common-words set (src/data/generated/common-words.js) using
   the SAME shared BFS/hop rule (src/lib/wordladder.js).

   Run:  npm run gen:laddergram     (no network, no API key)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wordLadder } from "../src/lib/wordladder.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDLIST_DIR = path.join(ROOT, "assets-src", "wordlists");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "laddergram.js";

const MAX_BFS = 8; // don't consider ladders longer than this
const MIN_STEPS = 3; // at least 3 changes (4 rungs) — trivial hops are boring
const MAX_STEPS = 5; // at most 5 changes — keeps the daily solvable in a sitting
const TARGET = 140; // rotation pool size
const LENS = [4, 5]; // endpoint lengths to mine (4 = friendly, 5 = denser graph)
const SEED = 2026; // reproducible auto-mining

// ── seeded RNG (mulberry32) ───────────────────────────────────────────────────
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

// ── wider common-words dict, split by length (the runtime dict's source) ──────
// Reads the SAME 20k list the runtime validates against (wide-words.js), so the
// ladders/pars we build here match what the browser will accept.
function loadCommonByLen() {
  const file = path.join(WORDLIST_DIR, "common-20k.txt");
  if (!fs.existsSync(file)) {
    throw new Error(
      "common-20k.txt not found in assets-src/wordlists — fetch " +
        "https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt into that path first."
    );
  }
  const byLen = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const w = raw.trim().toUpperCase();
    // Match the runtime wide-words slice exactly (4–8 letters, A–Z only) so a
    // rung the solver uses is always one the browser will accept.
    if (w.length < 4 || w.length > 8 || !/^[A-Z]+$/.test(w)) continue;
    (byLen[w.length] ||= new Set()).add(w);
  }
  return byLen;
}
const DICT = loadCommonByLen();

// On-brand endpoint pairs (nostalgic / arcade flavored). We try each; only those
// that resolve to a satisfying MIN_STEPS..MAX_STEPS ladder against the COMMON dict
// ship. Mix of 4- and 5-letter endpoints; the solver picks the dict by length.
const PAIRS = [
  ["COLD", "WARM"], ["HEAD", "TAIL"], ["LOVE", "HATE"], ["WORK", "PLAY"],
  ["DARK", "LAMP"], ["FIRE", "WIND"], ["LOAD", "SAVE"], ["MOON", "STAR"],
  ["BOOK", "WORD"], ["SHIP", "PORT"], ["DICE", "LUCK"], ["WAVE", "FOAM"],
  ["DUSK", "DAWN"], ["CARD", "DECK"], ["DOOR", "KEYS"], ["GROW", "SEED"],
  ["STAR", "DUST"], ["GAME", "CODE"], ["PLAY", "QUIT"], ["WORD", "GAME"],
  ["FROG", "TOAD"], ["CAVE", "GOLD"], ["COIN", "GOLD"], ["RACE", "LAPS"],
  ["SLOW", "FAST"], ["RICH", "POOR"], ["EAST", "WEST"], ["LOST", "FIND"],
  ["RAIN", "SNOW"], ["MILK", "MEAL"], ["FOOT", "HAND"], ["BEST", "WORST"],
  ["SICK", "WELL"], ["OPEN", "SHUT"], ["TRUE", "FALSE"], ["HARD", "SOFT"],
  ["WOLF", "HOWL"], ["KING", "PAWN"], ["BOSS", "WINS"], ["JUMP", "DASH"],
  // ── 5-letter (denser graph) ──
  ["SNAKE", "SCORE"], ["FLAME", "SPARK"], ["HEART", "BEATS"], ["TOKEN", "COINS"],
  ["SCORE", "BOARD"], ["BLACK", "WHITE"], ["SMALL", "LARGE"], ["NIGHT", "LIGHT"],
  ["BREAD", "TOAST"], ["STONE", "BRICK"], ["RIVER", "OCEAN"], ["GREEN", "GRASS"],
  ["MONEY", "BANKS"], ["MUSIC", "SOUND"], ["PLANT", "BLOOM"], ["QUICK", "SPEED"],
  ["BRAVE", "HERO"], ["SLEEP", "DREAM"], ["FRESH", "CLEAN"], ["POWER", "PLANT"],
  ["WATER", "WINES"], ["EARTH", "SPACE"], ["TRAIN", "TRACK"], ["CLOUD", "STORM"],
  ["FLOOR", "ROOMS"], ["CHESS", "MOVES"], ["PIXEL", "BYTES"], ["MAZES", "PATHS"],
];

console.log("\nGEN-LADDERGRAM — building the daily Laddergram puzzles\n");

const puzzles = [];
const seen = new Set();

// Try a candidate START→END: keep it if it resolves to a MIN..MAX-step ladder.
function tryPair(start, end) {
  if (puzzles.length >= TARGET) return;
  if (start === end) return;
  const key = start < end ? `${start}|${end}` : `${end}|${start}`;
  if (seen.has(key)) return;
  const dict = DICT[start.length];
  if (!dict || !dict.has(start) || !dict.has(end)) return;
  const sol = wordLadder(start, end, dict, MAX_BFS);
  if (!sol) return;
  const steps = sol.length - 1;
  if (steps < MIN_STEPS || steps > MAX_STEPS) return;
  seen.add(key);
  puzzles.push({
    id: `laddergram-${String(puzzles.length + 1).padStart(3, "0")}`,
    start,
    end,
    par: steps,
    solution: sol,
  });
}

// 1) Prefer the curated on-brand pairs that actually connect in the common dict.
for (const [s, e] of PAIRS) tryPair(s, e);
const curated = puzzles.length;
console.log(`  ${curated} curated pairs connected.`);

// 2) Auto-mine the rest: pick a random common word, BFS outward, and keep a
//    target at a good distance. Guarantees a solvable, varied pool.
for (const len of LENS) {
  const words = [...(DICT[len] || [])];
  if (!words.length) continue;
  let attempts = 0;
  while (puzzles.length < TARGET && attempts < words.length * 40) {
    attempts++;
    const a = words[randInt(words.length)];
    const b = words[randInt(words.length)];
    tryPair(a, b);
  }
}

for (const p of puzzles.slice(0, 12)) {
  console.log(`  ${p.start} → ${p.end}  par ${p.par}  [${p.solution.join(" ")}]`);
}
console.log(`\n  built ${puzzles.length} puzzles (${curated} curated + auto-mined).`);
if (puzzles.length < 20) {
  console.warn(`  ⚠ only ${puzzles.length} — widen the step band or add lengths.`);
}

const banner =
  "// AUTO-GENERATED by scripts/gen-laddergram.js — do not edit by hand.\n" +
  "// Daily Laddergram puzzles (START→END word ladders over the common-words\n" +
  "// dict) for the cabinet at #/play/laddergram. `par` = fewest changes.\n" +
  "// Run `npm run gen:laddergram` to regenerate.\n";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, OUT_FILE),
  `${banner}export default ${JSON.stringify(puzzles, null, 2)};\n`
);

console.log(`\n✓ wrote ${puzzles.length} puzzles → src/data/generated/${OUT_FILE}\n`);
