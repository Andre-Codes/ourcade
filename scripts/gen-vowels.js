/* ============================================================
   GEN-VOWELS — builds the daily "Missing Vowels" puzzles and writes them to
   src/data/generated/vowels.js.

   Missing Vowels is a fast daily decode: a themed set of ~6 common words with all
   the vowels stripped out (consonant skeleton, order preserved). Restore them.
   Snappy and mobile-friendly — a one-minute daily.

   BUILD-TIME emitter: themes are small hand-authored banks of everyday words; the
   generator verifies every word is in the curated common-words list (so it reads
   familiar), strips the vowels for the shown clue, and ships finished puzzles.
   The browser judges a guess by common-dict membership + skeleton match (so any
   common word with the same consonant skeleton is accepted, not just the authored
   answer).

   Run:  npm run gen:vowels     (no network, no API key)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDLIST_DIR = path.join(ROOT, "assets-src", "wordlists");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "vowels.js";

const PER_PUZZLE = 6; // words shown per day

// Strip vowels (keep Y — it's a consonant skeleton anchor and rarely ambiguous).
const VOWELS = /[AEIOU]/g;
const skeleton = (w) => w.toUpperCase().replace(VOWELS, "");

// Curated common-words set (membership check so authored answers read familiar).
function loadCommonSet() {
  const file = path.join(WORDLIST_DIR, "common-10k.txt");
  if (!fs.existsSync(file)) {
    throw new Error("common-10k.txt not found in assets-src/wordlists.");
  }
  const set = new Set();
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const w = raw.trim().toUpperCase();
    if (/^[A-Z]+$/.test(w)) set.add(w);
  }
  return set;
}
const COMMON = loadCommonSet();

// Themed banks of everyday words. Each theme ships several puzzles by chunking its
// bank into PER_PUZZLE-sized groups. Keep words 4–8 letters and skeleton-friendly
// (avoid all-vowel-ish words like "AREA" whose skeleton is too thin).
const THEMES = {
  Kitchen: ["KNIFE", "SPOON", "PLATE", "STOVE", "TABLE", "GLASS", "BOWL", "OVEN",
    "KETTLE", "TOASTER", "BLENDER", "NAPKIN", "PANTRY", "RECIPE", "SUGAR", "FLOUR"],
  Animals: ["TIGER", "HORSE", "MOUSE", "EAGLE", "SHARK", "SNAKE", "RABBIT", "MONKEY",
    "SPIDER", "TURKEY", "DONKEY", "PANDA", "ZEBRA", "CAMEL", "PARROT", "BEAVER"],
  Weather: ["CLOUD", "STORM", "THUNDER", "BREEZE", "FROST", "SHOWER", "SUNNY",
    "WINDY", "RAINY", "FOGGY", "CHILLY", "DROUGHT", "RAINBOW", "LIGHTNING"],
  Music: ["GUITAR", "PIANO", "DRUMS", "VIOLIN", "TRUMPET", "MELODY", "RHYTHM",
    "CHORUS", "SINGER", "CONCERT", "RECORD", "STEREO", "TEMPO", "LYRICS"],
  Sports: ["SOCCER", "TENNIS", "HOCKEY", "BOXING", "RACING", "SKIING", "ROWING",
    "RUNNER", "REFEREE", "STADIUM", "JERSEY", "TROPHY", "COACH", "PLAYER"],
  Space: ["PLANET", "COMET", "GALAXY", "ROCKET", "ORBIT", "METEOR", "SHUTTLE",
    "GRAVITY", "NEBULA", "SATURN", "VENUS", "MARTIAN", "COSMIC", "STELLAR"],
  School: ["PENCIL", "ERASER", "RULER", "FOLDER", "LESSON", "TEACHER", "STUDENT",
    "LIBRARY", "HOMEWORK", "SCIENCE", "HISTORY", "RECESS", "GRADE", "MARKER"],
  Travel: ["AIRPORT", "TICKET", "SUITCASE", "PASSPORT", "HOTEL", "CAMERA", "MAPS",
    "JOURNEY", "CRUISE", "SUBWAY", "STATION", "LUGGAGE", "TOURIST", "BORDER"],
  OldWeb: ["MODEM", "PIXEL", "CURSOR", "FLOPPY", "SCREEN", "KEYBOARD", "BROWSER",
    "DIALUP", "WEBRING", "BANNER", "GADGET", "MONITOR", "TABLET", "LAPTOP"],
  Nature: ["GARDEN", "FLOWER", "FOREST", "DESERT", "ISLAND", "BRIDGE", "CASTLE",
    "CANDLE", "MIRROR", "WINDOW", "MARKET", "MEADOW", "VALLEY", "STREAM"],
  Jobs: ["DOCTOR", "NURSE", "LAWYER", "ARTIST", "WRITER", "FARMER", "BAKER",
    "PILOT", "DRIVER", "DENTIST", "BANKER", "SAILOR", "WAITER", "GARDENER"],
  Seasons: ["WINTER", "SUMMER", "SPRING", "AUTUMN", "SILVER", "GOLDEN", "PURPLE",
    "ORANGE", "YELLOW", "SHADOW", "SUNSET", "SUNRISE", "FROSTY", "BREEZY"],
  Food: ["COFFEE", "BUTTER", "CHEESE", "POTATO", "TOMATO", "BANANA", "PEPPER",
    "DINNER", "PICKLE", "COOKIE", "MUFFIN", "NOODLE", "PEANUT", "YOGURT"],
  Clothes: ["JACKET", "HELMET", "GLOVES", "ENGINE", "WHEEL", "ROCKET", "PLANET",
    "GUITAR", "POCKET", "BUTTON", "COLLAR", "SANDAL", "RIBBON", "WALLET"],
};

console.log("\nGEN-VOWELS — building the daily Missing Vowels puzzles\n");

const puzzles = [];
for (const [theme, bank] of Object.entries(THEMES)) {
  // Only keep authored words that are actually in the common list AND have a
  // non-trivial skeleton (≥2 consonants, and vowels actually removed).
  const good = [...new Set(bank.map((w) => w.toUpperCase()))].filter((w) => {
    if (!COMMON.has(w)) { console.log(`  drop ${w} (not in common list)`); return false; }
    const sk = skeleton(w);
    return sk.length >= 2 && sk.length < w.length;
  });
  // Chunk into PER_PUZZLE-sized groups (drop a trailing short remainder).
  for (let i = 0; i + PER_PUZZLE <= good.length; i += PER_PUZZLE) {
    const group = good.slice(i, i + PER_PUZZLE);
    puzzles.push({
      id: `vowels-${String(puzzles.length + 1).padStart(3, "0")}`,
      theme,
      items: group.map((w) => ({ clue: skeleton(w), answer: w })),
    });
  }
}

for (const p of puzzles) {
  console.log(`  [${p.theme}] ${p.items.map((it) => `${it.clue}=${it.answer}`).join("  ")}`);
}
console.log(`\n  built ${puzzles.length} puzzles across ${Object.keys(THEMES).length} themes.`);

const banner =
  "// AUTO-GENERATED by scripts/gen-vowels.js — do not edit by hand.\n" +
  "// Daily Missing Vowels puzzles (themed common words, vowels stripped) for\n" +
  "// the cabinet at #/play/missing-vowels. Run `npm run gen:vowels` to rebuild.\n";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, OUT_FILE),
  `${banner}export default ${JSON.stringify(puzzles, null, 2)};\n`
);

console.log(`\n✓ wrote ${puzzles.length} puzzles → src/data/generated/${OUT_FILE}\n`);
