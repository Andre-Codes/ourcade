/* ============================================================
   GEN-RANKIT — builds the daily "Rank It" puzzles and writes them to
   src/data/generated/rankit.js.

   Rank It is an Ourcade original that only a FREQUENCY-ORDERED word list can
   power: each day shows five common words and the player drags them into their
   true order of commonness (most-used → least-used in English). A word's line
   number in google-10000-english (assets-src/wordlists/common-10k.txt) IS its
   frequency rank, so "the answer" is objective and defensible.

   BUILD-TIME emitter (like gen-spelldown.js): we pick the daily five here and
   ship finished puzzles; the browser never sees the 10k list. Each puzzle stores
   the five words WITH their ranks in true (most→least common) order; the cabinet
   shuffles them for display with a day-seeded shuffle and scores the player's
   ordering against this truth.

   HOW THE FIVE ARE CHOSEN. To be fair and fun every word must be (a) genuinely
   familiar — we draw only from the top FAMILIAR_MAX ranks and require length ≥ 4
   (drops most function words / abbreviations), skipping a small stoplist of
   proper-noun / abbreviation noise; (b) spread out — the five are drawn one from
   each of five contiguous frequency BANDS so there's a clear commonness gradient;
   (c) unambiguous — a minimum rank gap between adjacent picks so no two are a
   coin-flip. A seeded RNG (mulberry32) makes the whole pool reproducible.

   Run:  npm run gen:rankit     (no network, no API key)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDLIST_DIR = path.join(ROOT, "assets-src", "wordlists");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "rankit.js";

const SEED = 2026; // bump to reshuffle the whole pool
const WORDS_PER = 5; // five words to rank each day
const FAMILIAR_MAX = 4000; // only draw from the top N ranks (all genuinely known)
const MIN_LEN = 4; // drops "the/of/and" and most abbreviations
const MIN_GAP = 40; // min rank distance between adjacent picks (no coin-flips)
const TARGET_PUZZLES = 240; // ~8 months of no-repeat rotation

// Abbreviations, tech jargon, and proper-noun-ish noise that slip through the
// length filter and don't read as fair "words to rank" (a place or brand isn't
// obviously more/less "common" than a plain noun). Small and hand-kept from
// eyeballing the generated pool; extend as needed.
const STOP = new Set([
  // web / tech / file jargon
  "http", "https", "html", "xhtml", "mailto", "wiki", "mediawiki", "faq", "url",
  "asp", "aspx", "php", "www", "dvd", "cdt", "gmt", "jpg", "jpeg", "gif", "png",
  "ent", "unix", "linux", "html", "xml", "http", "epinions", "ebay", "amazon",
  "google", "yahoo", "microsoft", "apple", "adobe", "cisco", "intel", "sony",
  "blog", "blogs", "email", "online", "website", "internet", "server", "servers",
  "login", "username", "database", "software", "download", "downloads", "upload",
  // names
  "johnson", "smith", "jones", "david", "james", "john", "michael", "eric",
  "robert", "richard", "thomas", "william", "george", "mary", "susan", "linda",
  "peter", "paul", "mark", "steve", "chris", "brian", "kevin", "jason", "potter",
  "christ", "jesus", "christian", "christians",
  // months / days / abbreviations
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov",
  "dec", "mon", "tue", "wed", "thu", "fri", "sat", "sun",
  // places (a sample of the frequent ones in this corpus)
  "arkansas", "berlin", "america", "american", "africa", "african", "europe",
  "european", "canada", "canadian", "australia", "england", "london", "paris",
  "texas", "california", "florida", "york", "chicago", "boston", "russia",
  "china", "chinese", "japan", "japanese", "india", "indian", "mexico", "german",
  "germany", "france", "french", "british", "britain", "spain", "spanish",
  "italy", "italian", "washington", "virginia", "carolina", "georgia",
  "indonesia", "brazil", "argentina", "egypt", "israel", "ireland", "scotland",
  "wales", "greece", "greek", "turkey", "poland", "sweden", "norway", "denmark",
  "finland", "portugal", "austria", "belgium", "holland", "dutch", "korea",
  "korean", "vietnam", "thailand", "pakistan", "iran", "iraq", "africa", "asia",
  "asian", "roman", "rome", "athens", "moscow", "tokyo", "beijing", "sydney",
  "ontario", "quebec", "seattle", "denver", "dallas", "houston", "atlanta",
  "miami", "phoenix", "vegas", "oregon", "nevada", "kansas", "ohio", "iowa",
  "utah", "idaho", "montana", "alabama", "alaska", "hawaii",
]);

// ── seeded RNG (mulberry32) — same idiom as gen-solve-puzzles.js ──────────────
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

// ── load common-10k PRESERVING ORDER (line index → frequency rank) ────────────
const file = path.join(WORDLIST_DIR, "common-10k.txt");
if (!fs.existsSync(file)) {
  throw new Error(
    "common-10k.txt not found in assets-src/wordlists — fetch " +
      "google-10000-english-no-swears.txt into that path first."
  );
}
// [{ w, rank }] where rank is the 1-based line number, filtered to familiar,
// long-enough, non-stoplisted words. Rank is preserved from the ORIGINAL line
// (not the filtered index) so it stays a true frequency measure.
const RANKED = [];
{
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const rank = i + 1;
    if (rank > FAMILIAR_MAX) break;
    const w = lines[i].trim().toUpperCase();
    if (w.length < MIN_LEN || !/^[A-Z]+$/.test(w)) continue;
    if (STOP.has(w.toLowerCase())) continue;
    RANKED.push({ w, rank });
  }
}

// Five contiguous frequency bands across RANKED (by position in the familiar
// list, so each band is roughly equal-sized). We draw one word from each band —
// guaranteeing a commonness gradient — then enforce the MIN_GAP between adjacent
// picks so no pair is a coin-flip.
const N = RANKED.length;
const BAND = Math.floor(N / WORDS_PER);

function makePuzzle() {
  const picks = [];
  for (let b = 0; b < WORDS_PER; b++) {
    const lo = b * BAND;
    const hi = b === WORDS_PER - 1 ? N : (b + 1) * BAND;
    // try a handful of times to satisfy the MIN_GAP vs the previous pick
    let chosen = null;
    for (let t = 0; t < 24; t++) {
      const cand = RANKED[lo + randInt(hi - lo)];
      if (picks.length === 0 || cand.rank - picks[picks.length - 1].rank >= MIN_GAP) {
        chosen = cand;
        break;
      }
    }
    if (!chosen) return null; // couldn't space them; caller retries
    picks.push(chosen);
  }
  return picks; // already in ascending rank = most→least common (the truth order)
}

// ── build the pool ────────────────────────────────────────────────────────────
console.log("\nGEN-RANKIT — building the daily Rank It puzzles\n");
console.log(`  familiar pool: ${N} words (top ${FAMILIAR_MAX} ranks, ≥${MIN_LEN} letters)`);

const seen = new Set(); // dedupe identical word-sets
const puzzles = [];
let guard = 0;
while (puzzles.length < TARGET_PUZZLES && guard < TARGET_PUZZLES * 50) {
  guard++;
  const picks = makePuzzle();
  if (!picks) continue;
  const key = picks.map((p) => p.w).sort().join("|");
  if (seen.has(key)) continue;
  seen.add(key);
  puzzles.push({
    id: `rankit-${String(puzzles.length + 1).padStart(3, "0")}`,
    // stored in TRUE order (most common first); ranks kept for scoring/reveal
    words: picks.map((p) => ({ w: p.w, rank: p.rank })),
  });
}

for (const p of puzzles.slice(0, 10)) {
  console.log(`  ${p.words.map((x) => `${x.w}(${x.rank})`).join("  ")}`);
}
console.log(`\n  built ${puzzles.length} puzzles.`);
if (puzzles.length < 30) {
  console.warn(`  ⚠ only ${puzzles.length} puzzles — loosen MIN_GAP or widen FAMILIAR_MAX.`);
}

const banner =
  "// AUTO-GENERATED by scripts/gen-rankit.js — do not edit by hand.\n" +
  "// Daily Rank It puzzles: five common words in TRUE frequency order\n" +
  "// (most→least common), with ranks, for the cabinet at #/play/rank-it.\n" +
  "// Run `npm run gen:rankit` to regenerate from assets-src/wordlists/common-10k.txt.\n";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, OUT_FILE),
  `${banner}export default ${JSON.stringify(puzzles, null, 2)};\n`
);

console.log(`\n✓ wrote ${puzzles.length} puzzles → src/data/generated/${OUT_FILE}\n`);
