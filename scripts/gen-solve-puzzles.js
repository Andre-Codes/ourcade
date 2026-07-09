/* ============================================================
   GEN-SOLVE-PUZZLES — builds the "Solve This" puzzle pool for the
   /creatives page and writes it to src/data/generated/solve-puzzles.js.

   The cereal-box / old-web brain-teaser lane: small puzzles a visitor
   solves in 1–5 minutes, then reveals/checks the answer. Two families:
     TEXT  (reveal toggle): word ladder, cipher, rebus, complete-the-pattern, mystery
     GRID  (interactive):   5×5 nonogram, 4×4 sudoku, 4×4 Latin square

   Like fetch-draw-guides.js, this is a BUILD-TIME emitter: it computes
   finished, vetted puzzles and writes plain data. The browser never does
   BFS or uniqueness-checking — it just renders. Output shape matches the
   creatives item contract (lane/title/blurb/time/difficulty/cost/action)
   so scripts/daily-check.js validates it like any other creative.

   Determinism: a seeded RNG (mulberry32) drives every random choice, so
   re-running produces the same pool (same spirit as the date-seeded daily
   layer). Bump SEED to reshuffle.

   Word source: the committed ENABLE/Words-With-Friends lists in
   assets-src/wordlists/<n>.txt (sorted by length: 3.txt = 3-letter words…).
   Word ladders are the one format the big list truly powers (BFS over the
   one-letter-change graph). Ciphers/rebuses/patterns/mysteries are
   curated (or procedurally parameterized) from small banks below — they're
   combinatorially trivial and read better hand-written.

   Run:  npm run gen:solve     (no network, no API key)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wordLadder } from "../src/lib/wordladder.js"; // shared BFS (daily cabinet reuses it too)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDLIST_DIR = path.join(ROOT, "assets-src", "wordlists");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "solve-puzzles.js";

const SEED = 2026; // bump to reshuffle the whole pool

// ── seeded RNG (mulberry32) ───────────────────────────────────────────────
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
const rand = (min, max) => min + randInt(max - min + 1); // inclusive [min, max]
const pick = (arr) => arr[randInt(arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── word list loading ─────────────────────────────────────────────────────
// Read assets-src/wordlists/<len>.txt → a Set of uppercased words of that length.
function loadWords(len) {
  const file = path.join(WORDLIST_DIR, `${len}.txt`);
  if (!fs.existsSync(file)) {
    console.warn(`  ⚠ word list ${len}.txt not found — skipping that length`);
    return new Set();
  }
  const words = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length === len && /^[A-Z]+$/.test(w));
  return new Set(words);
}

// ═══════════════════════════════════════════════════════════════════════════
// WORD LADDER — BFS over the one-letter-change graph between two real words.
// The solver (wordLadder) lives in src/lib/wordladder.js so the daily Laddergram
// cabinet and its generator share the exact same hop rule and BFS.
// ═══════════════════════════════════════════════════════════════════════════

// A few hand-picked, on-brand endpoint pairs (nostalgic / arcade flavored). We
// try each; only those that actually resolve to a clean 4–6 rung ladder ship.
// Mix of 4- and 5-letter endpoints — buildWordLadders picks the right dict by
// the start word's length, so both lengths can live in one list. (Every pair
// here was verified against the committed lists to resolve within the window.)
const LADDER_PAIRS = [
  // ── 4-letter ──
  ["GAME", "CODE", "Old-school: change one letter at a time."],
  ["PLAY", "QUIT", "From the title screen to the exit."],
  ["BYTE", "BITE", "A snack-sized hop."],
  ["WORD", "GAME", "Two of our favorite things."],
  ["COLD", "WARM", "Warm it up, one letter at a time."],
  ["HEAD", "TAIL", "Flip it, gradually."],
  ["LOSE", "WINS", "Turn a loss into a win."],
  ["DARK", "LAMP", "Light the room, one step at a time."],
  ["FIRE", "WIND", "Two of the four elements."],
  ["LOAD", "SAVE", "Don't lose your progress."],
  ["FROG", "TOAD", "Almost the same creature."],
  ["MOON", "STAR", "Across the night sky."],
  ["CAVE", "GOLD", "Dig for treasure."],
  ["BOOK", "WORD", "Inside every book."],
  ["SHIP", "PORT", "Bring it home to harbor."],
  ["COIN", "GOLD", "Pocket the treasure."],
  ["DICE", "LUCK", "Roll for it."],
  ["PONG", "GAME", "The first arcade hit."],
  ["BOSS", "WINS", "Beat the boss."],
  ["JUMP", "DASH", "Two platformer moves."],
  ["KING", "PAWN", "Both on the chessboard."],
  ["WAVE", "FOAM", "Down at the beach."],
  ["NUKE", "BOMB", "One big blast."],
  ["RACE", "LAPS", "Round and round the track."],
  ["DUSK", "DAWN", "Two ends of the day."],
  ["SLOT", "REEL", "Spin to win."],
  ["CARD", "DECK", "Shuffle the deck."],
  ["DOOR", "KEYS", "Unlock it."],
  ["GROW", "SEED", "Plant a seed."],
  ["WOLF", "HOWL", "It lets one out at the moon."],
  ["STAR", "DUST", "Sprinkled across the sky."],
  // ── 5-letter (5.txt's dense graph) ──
  ["SNAKE", "SCORE", "Old phone classic, up on the board."],
  ["PIXEL", "BYTES", "Tiny pieces of the screen."],
  ["FLAME", "SPARK", "Catch fire, one letter at a time."],
  ["HEART", "BEATS", "It beats."],
  ["TOKEN", "COINS", "Arcade currency."],
  ["MAZES", "PATHS", "Find your way through."],
  ["SCORE", "BOARD", "Up on the leaderboard."],
];

function buildWordLadders(dict4, dict5, want) {
  const out = [];
  for (const [start, end, hint] of shuffle(LADDER_PAIRS)) {
    if (out.length >= want) break;
    const dict = start.length === 5 ? dict5 : dict4;
    const sol = wordLadder(start, end, dict, 7);
    // Want a satisfying length: 4–6 words total (2–4 changes). Skip trivial/huge.
    if (!sol || sol.length < 4 || sol.length > 6) continue;
    const rungs = sol.map((w, i) => (i === 0 || i === sol.length - 1 ? w : "____"));
    // Difficulty tracks the number of blanks the player must fill (the hops
    // between the given first/last rungs): fewer blanks = easier. sol.length is
    // the whole chain incl. both ends, so blanks = sol.length - 2.
    const blanks = sol.length - 2;
    const difficulty = blanks <= 2 ? "beginner" : blanks === 3 ? "intermediate" : "advanced";
    out.push({
      kind: "word_ladder",
      prompt:
        "Change ONE letter at a time. Every step must be a real word. Fill the blanks.",
      rungs,
      answer: sol,
      difficulty,
      hint,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORD SPRINT (kind:"anagram") — a 30-second speed round: from 7 scrambled
// letters, find as MANY real words as you can (any length ≥ 4). This rebrands the
// old "unscramble one word" anagram into a fast, replayable find-'em-all game.
//
// The generator does the heavy lifting once, at build time: for each 7-letter
// seed word it enumerates every dictionary word (len 4–7) buildable from those
// letters WITHOUT reusing a letter more times than it appears, and ships that
// full valid-word set. The browser just checks membership as the player types —
// no runtime dictionary needed. Difficulty tracks how many words the board holds
// (a small board is easy to clear, a big one is a harder sprint).
// ═══════════════════════════════════════════════════════════════════════════

// Letter-count bag for a word (e.g. "TREE" → {T:1,R:1,E:2}). A candidate is
// buildable from a rack iff each of its letters fits within the rack's counts.
function letterBag(w) {
  const bag = {};
  for (const ch of w) bag[ch] = (bag[ch] || 0) + 1;
  return bag;
}
function buildableFrom(word, rackBag) {
  const need = letterBag(word);
  for (const ch in need) {
    if (!rackBag[ch] || rackBag[ch] < need[ch]) return false;
  }
  return true;
}

// Curated 7-letter seed racks with a rich set of sub-words (all common enough to
// be a fun sprint). The generator VALIDATES each is a real 7-letter word and only
// ships racks whose findable-word count lands in a playable band.
const SPRINT_SEEDS = [
  "PLANETS", "MONSTER", "CAPTURE", "DIAMOND", "PICTURE", "STRANGE", "COASTER",
  "MARINES", "PAINTER", "GARDENS", "TEACHER", "DOLPHIN", "LANTERN", "COMPASS",
  "CIRCUIT", "MACHINE", "PRETZEL", "CRIMSON", "TROUBLE", "STADIUM", "PORTALS",
  "DUNGEON", "GOBLINS", "WIZARDS", "POTIONS", "CANDLES", "SPARKLE", "THUNDER",
  "RAINBOW", "PANTHER", "STORMED", "CLEANER", "CREATES", "SILENCE", "MASTERS",
  "PLASTER", "COUNTER", "RETINAS", "TANGLES", "GRENADE",
];

// Difficulty by how many words the rack yields (more words = a harder sprint to
// meaningfully clear). Tuned against real racks below.
function sprintDifficulty(count) {
  if (count <= 22) return "beginner";
  if (count <= 40) return "intermediate";
  return "advanced";
}

function buildWordSprints(dictByLen, want) {
  const out = [];
  const seen = new Set();
  for (const seed of shuffle(SPRINT_SEEDS)) {
    if (out.length >= want) break;
    const W = seed.toUpperCase();
    if (W.length !== 7 || seen.has(W)) continue;
    const d7 = dictByLen[7];
    if (!d7 || !d7.has(W)) continue; // the rack itself must be a real 7-letter word
    seen.add(W);

    const rackBag = letterBag(W);
    // Enumerate every dictionary word of length 4–7 buildable from this rack.
    const words = [];
    for (let len = 4; len <= 7; len++) {
      const dict = dictByLen[len];
      if (!dict) continue;
      for (const cand of dict) {
        if (buildableFrom(cand, rackBag)) words.push(cand);
      }
    }
    // Need a satisfying board that isn't overwhelming.
    if (words.length < 12 || words.length > 90) continue;
    words.sort(); // stable, deterministic order in the output

    // Present the rack as a scramble (never the seed word itself in order).
    let scramble = null;
    for (let t = 0; t < 40; t++) {
      const s = shuffle(W.split("")).join("");
      if (s !== W) { scramble = s; break; }
    }
    if (!scramble) scramble = W;

    // The longest words are the "trophy" finds — surface a couple as a hint.
    const longest = words.filter((w) => w.length === 7);

    out.push({
      kind: "anagram", // keep the id/route stable; renders as the sprint game
      prompt:
        "You have 30 seconds. Make as many real words (4+ letters) as you can from these 7 letters. Any valid word counts!",
      scramble,
      letters: W,
      words, // the full valid-word set the browser checks against
      total: words.length,
      difficulty: sprintDifficulty(words.length),
      pangrams: longest, // 7-letter words that use every letter
      hint: longest.length
        ? `There's at least one word that uses all 7 letters.`
        : `Short words add up fast — don't overthink it.`,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// WORD SANDWICH — one short word completes two longer ones: LEFT___ + ___RIGHT.
// Curated for fair, gettable outer words (a player has to recognize CARTON and
// ONLY to land ON); the generator VERIFIES that LEFT+answer and answer+RIGHT are
// both real dictionary words, dropping any pair that fails — so a typo or a list
// that disagrees can never ship a broken puzzle.
// ═══════════════════════════════════════════════════════════════════════════

// { left, right, answer } — the two outer fragments and the connector word.
// The displayed clue is `${left}___  +  ___${right}` with answer the middle word.
const SANDWICHES = [
  { left: "SON", right: "WORK", answer: "NET" }, // SONNET + NETWORK
  { left: "GAR", right: "WORK", answer: "NET" }, // GARNET + NETWORK
  { left: "BON", right: "WORK", answer: "NET" }, // BONNET + NETWORK
  { left: "CABI", right: "WORK", answer: "NET" }, // CABINET + NETWORK
  { left: "CRAY", right: "CE", answer: "ON" }, // CRAYON + ONCE
  { left: "LEM", right: "CE", answer: "ON" }, // LEMON + ONCE
  { left: "BEAC", right: "CE", answer: "ON" }, // BEACON + ONCE
  { left: "FALC", right: "CE", answer: "ON" }, // FALCON + ONCE
  { left: "SEAS", right: "CE", answer: "ON" }, // SEASON + ONCE
  { left: "DRAG", right: "LY", answer: "ON" }, // DRAGON + ONLY
  { left: "CART", right: "LY", answer: "ON" }, // CARTON + ONLY
  { left: "NYL", right: "LY", answer: "ON" }, // NYLON + ONLY
  { left: "WAG", right: "WARD", answer: "ON" }, // WAGON + ONWARD
  { left: "KEY", right: "ED", answer: "BOARD" }, // KEYBOARD + BOARDED
];

function buildSandwiches(dictByLen, want) {
  const out = [];
  for (const s of shuffle(SANDWICHES)) {
    if (out.length >= want) break;
    const M = s.answer.toUpperCase();
    const leftWord = (s.left + M).toUpperCase();
    const rightWord = (M + s.right).toUpperCase();
    const lDict = dictByLen[leftWord.length];
    const rDict = dictByLen[rightWord.length];
    // Both outer words must be real, or the clue has no answer — drop it.
    if (!lDict || !lDict.has(leftWord)) continue;
    if (!rDict || !rDict.has(rightWord)) continue;
    out.push({
      kind: "middle",
      prompt: "One short word finishes both. Fill the blanks with the same word.",
      left: s.left.toUpperCase(),
      right: s.right.toUpperCase(),
      answer: M,
      hint: `It's a ${M.length}-letter word — and a word on its own.`,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// CIPHER — Caesar shift on a nostalgic phrase.
// ═══════════════════════════════════════════════════════════════════════════

const CIPHER_PHRASES = [
  "YOU FOUND THE SECRET PAGE",
  "UNDER CONSTRUCTION",
  "PRESS START TO BEGIN",
  "GAME OVER INSERT COIN",
  "WELCOME TO THE ARCADE",
  "THE CAKE IS A LIE",
  "ALL YOUR BASE ARE BELONG TO US",
  "BEST VIEWED IN NETSCAPE",
  "THANK YOU MARIO BUT OUR PRINCESS IS IN ANOTHER CASTLE",
  "DO A BARREL ROLL",
];

function caesar(text, shift) {
  return text.replace(/[A-Z]/g, (ch) => {
    const code = ((ch.charCodeAt(0) - 65 + shift) % 26 + 26) % 26;
    return String.fromCharCode(65 + code);
  });
}

function buildCiphers(want) {
  const out = [];
  for (const phrase of shuffle(CIPHER_PHRASES)) {
    if (out.length >= want) break;
    // Encoding shift is +s; the solver reverses it (shift back by s).
    const s = 1 + randInt(25);
    out.push({
      kind: "cipher",
      prompt: "Each letter was shifted forward in the alphabet. Shift it back to read the message.",
      ciphertext: caesar(phrase, s),
      shift: s, // amount the message was shifted FORWARD when encoding
      answer: phrase,
      hint: `Shift every letter back by ${s}. (A becomes ${caesar("A", -s)}.)`,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// REBUS — visual word puzzles. Curated (these don't benefit from a word list).
//   display: lines rendered in a monospace box; answer: the phrase.
// ═══════════════════════════════════════════════════════════════════════════

const REBUSES = [
  { display: ["CYCLE", "CYCLE", "CYCLE"], answer: "tricycle", hint: "Three of them." },
  { display: ["STAND", "—————", "  I  "], answer: "I understand", hint: "I, under stand." },
  { display: ["TIMING TIM ING"], answer: "split-second timing", hint: "The timing got split." },
  { display: ["    r", "    o", "ECABC", "    e"], answer: "race against the clock", hint: "Read the down word." },
  { display: ["ME ME ME ME ME", "(once)"], answer: "all about me", hint: "Nothing but me." },
  { display: ["O_ER_T_O_", "fill: P A I N"], answer: "painless operation", hint: "Operation with no PAIN in it." },
  { display: ["KNEE", "LIGHT"], answer: "neon light", hint: "Knee-on light." },
  { display: ["GAME GAME", "(in a)"], answer: "two-player game", hint: "Two games." },
  { display: ["DICE DICE"], answer: "paradise", hint: "Say a pair of these out loud." },
  { display: ["L", " O", "  V", "   E"], answer: "falling in love", hint: "Read what the letters spell, then watch what they're doing." },
];

function buildRebuses(want) {
  return shuffle(REBUSES)
    .slice(0, want)
    .map((r) => ({
      kind: "rebus",
      prompt: "Read the picture. What word or phrase does it spell?",
      ...r,
    }));
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE THE PATTERN — show the first terms of a sequence, type the next one.
// A mix of classic number sequences (procedurally parameterized) and a few
// hand-authored "invented" ones. Each entry becomes { sequence, answer, rule }.
// (Hand-authored invented patterns can also live in src/data/manual/creatives.js.)
// ═══════════════════════════════════════════════════════════════════════════

// Procedural generators for well-known sequences. Each returns a full run of
// values from which we show the first N-1 and ask for the Nth.
const PATTERN_GENERATORS = [
  // Arithmetic: start + k·step
  () => {
    const start = rand(1, 6);
    const step = rand(2, 6);
    const seq = Array.from({ length: 6 }, (_, k) => start + k * step);
    return { seq, rule: `Add ${step} each time (starts at ${start}).` };
  },
  // Geometric: start · ratio^k
  () => {
    const start = rand(1, 3);
    const ratio = rand(2, 3);
    const seq = Array.from({ length: 5 }, (_, k) => start * ratio ** k);
    return { seq, rule: `Multiply by ${ratio} each time (starts at ${start}).` };
  },
  // Fibonacci-style: each term is the sum of the two before it.
  () => {
    const a = rand(1, 3);
    const b = rand(a, a + 3);
    const seq = [a, b];
    while (seq.length < 7) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
    return { seq, rule: "Each number is the sum of the two before it (Fibonacci-style)." };
  },
  // Perfect squares starting past 1 (the 1,4,9,… run is in the curated bank).
  () => {
    const from = rand(2, 4);
    const seq = Array.from({ length: 6 }, (_, k) => (from + k) ** 2);
    return { seq, rule: `The perfect squares — ${from}², ${from + 1}², ${from + 2}², …` };
  },
  // Triangular numbers: 1,3,6,10,… (running sum of 1..n)
  () => {
    const seq = [];
    let total = 0;
    for (let n = 1; n <= 7; n++) { total += n; seq.push(total); }
    return { seq, rule: "Triangular numbers — add 1, then 2, then 3, then 4, …" };
  },
  // Doubling then +1 offset walk: alternating +k pattern that reads as invented.
  () => {
    const start = rand(2, 5);
    const seq = [start];
    for (let k = 1; k < 6; k++) seq.push(seq[k - 1] + k); // +1, +2, +3, …
    return { seq, rule: "The gap grows by one each step — +1, then +2, then +3, …" };
  },
];

// A few hand-authored patterns (numeric or lettered) that read like puzzle-book
// brain-teasers rather than pure formulas.
const PATTERN_CURATED = [
  { seq: [1, 1, 2, 3, 5, 8, 13], rule: "Fibonacci — each number is the sum of the previous two." },
  { seq: [2, 3, 5, 7, 11, 13, 17], rule: "The prime numbers in order." },
  { seq: [1, 4, 9, 16, 25, 36], rule: "The perfect squares: 1², 2², 3², 4², …" },
  { seq: [1, 8, 27, 64, 125], rule: "The perfect cubes: 1³, 2³, 3³, 4³, …" },
  { seq: ["O", "T", "T", "F", "F", "S", "S"], rule: "First letters of One, Two, Three, Four, Five, Six, Seven — next is Eight → E." },
  { seq: ["M", "T", "W", "T", "F", "S"], rule: "First letters of the days of the week — next is Sunday → S." },
  { seq: ["J", "F", "M", "A", "M", "J"], rule: "First letters of the months — next is July → J." },
];

function buildPatterns(want) {
  const out = [];
  // Half from the procedural generators, half from the curated bank (deduped by id later).
  const proc = shuffle(PATTERN_GENERATORS.slice());
  const cur = shuffle(PATTERN_CURATED.slice());
  let pi = 0;
  let ci = 0;
  while (out.length < want && (pi < proc.length || ci < cur.length)) {
    const useCurated = (out.length % 2 === 1 && ci < cur.length) || pi >= proc.length;
    let seq;
    let rule;
    if (useCurated) { ({ seq, rule } = cur[ci++]); }
    else { ({ seq, rule } = proc[pi++]()); }
    const shown = seq.slice(0, -1);
    const answer = seq[seq.length - 1];
    out.push({
      kind: "pattern",
      prompt: "Complete the pattern — what comes next?",
      sequence: shown.map(String),
      answer: String(answer),
      hint: "Look at how each term relates to the one before it.",
      rule,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// MINUTE MYSTERY — one paragraph, one contradiction. Curated, retro-computer.
// ═══════════════════════════════════════════════════════════════════════════

const MYSTERIES = [
  {
    story:
      "The gamer swore he'd been online all night chasing a high score. But the moment Detective Byte stepped into the den, she knew he was lying.",
    question: "What gave him away?",
    answer:
      "The modem was unplugged — its cable coiled on the desk. You can't be online all night with no connection.",
    hint: "Look at the hardware, not the screen.",
  },
  {
    story:
      "“I just finished the game — beat the final boss five minutes ago!” the kid grinned. The detective glanced at the cartridge slot and shook her head.",
    question: "Why didn't she believe him?",
    answer:
      "The console was powered off and cold to the touch. A machine that ran a boss fight five minutes ago would still be warm.",
    hint: "Heat takes time to fade.",
  },
  {
    story:
      "The suspect claimed he'd been typing a letter on his computer when the lights went out at 9 p.m. and never left his chair. But the screen told a different story.",
    question: "What was wrong?",
    answer:
      "With the power out, the monitor would be dark — yet he described reading his half-finished letter on it. No power, no glowing screen.",
    hint: "What needs electricity to be seen?",
  },
  {
    story:
      "She said she'd printed the report that morning, straight off the new printer. The detective picked up the page, then quietly asked her to come downtown.",
    question: "How did he know she was lying?",
    answer:
      "The printer's ink cartridge was still sealed in its wrapper inside the box. Nothing had been printed on that machine yet.",
    hint: "Check whether the tool was ever actually used.",
  },
];

function buildMysteries(want) {
  return shuffle(MYSTERIES)
    .slice(0, want)
    .map((m) => ({ kind: "mystery", prompt: "Read the case. Spot the contradiction.", ...m }));
}

// ═══════════════════════════════════════════════════════════════════════════
// NONOGRAM — 5×5 pixel-icon reveal. Clues derived from a fixed icon template.
// ═══════════════════════════════════════════════════════════════════════════

// 5×5 templates (1 = filled). Kept simple/recognizable.
const NONO_ICONS = {
  heart: [
    [0, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ],
  "a smiley face": [
    [0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  "a tiny house": [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
  ],
  "a space invader": [
    [1, 0, 1, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
  ],
  "a coffee cup": [
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0],
    [0, 1, 1, 1, 0],
  ],
  "a mushroom": [
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
  ],
};

// Run-length clues for one line (e.g. [1,1,1] for 1·0·1·0·1; [] for an empty line).
function lineClues(line) {
  const runs = [];
  let n = 0;
  for (const v of line) {
    if (v) n++;
    else if (n) {
      runs.push(n);
      n = 0;
    }
  }
  if (n) runs.push(n);
  return runs.length ? runs : [0];
}

function buildNonograms(want) {
  const names = shuffle(Object.keys(NONO_ICONS)).slice(0, want);
  return names.map((name) => {
    const sol = NONO_ICONS[name];
    const rows = sol.map(lineClues);
    const cols = sol[0].map((_, c) => lineClues(sol.map((r) => r[c])));
    return {
      kind: "nonogram",
      prompt:
        "Fill squares so each row and column matches its number clues (a clue like 2 1 means a run of 2, a gap, then a run of 1). Click a cell to fill; click again to mark it empty.",
      size: 5,
      rows,
      cols,
      solution: sol,
      reveal: name,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SUDOKU4 / LATIN4 — 4×4 grids with a UNIQUE solution.
//   Latin square: rows & cols each contain 1–4 once.
//   Sudoku: also each 2×2 box contains 1–4 once.
// ═══════════════════════════════════════════════════════════════════════════

const SUDOKU_BOX = (r, c) => Math.floor(r / 2) * 2 + Math.floor(c / 2); // 0..3

// Generate a full valid grid (backtracking) for the given variant.
function fullGrid(variant) {
  const g = Array.from({ length: 4 }, () => Array(4).fill(0));
  const boxes = variant === "sudoku4";
  function ok(r, c, v) {
    for (let i = 0; i < 4; i++) {
      if (g[r][i] === v || g[i][c] === v) return false;
    }
    if (boxes) {
      const b = SUDOKU_BOX(r, c);
      for (let rr = 0; rr < 4; rr++)
        for (let cc = 0; cc < 4; cc++)
          if (SUDOKU_BOX(rr, cc) === b && g[rr][cc] === v) return false;
    }
    return true;
  }
  function fill(pos) {
    if (pos === 16) return true;
    const r = Math.floor(pos / 4);
    const c = pos % 4;
    for (const v of shuffle([1, 2, 3, 4])) {
      if (ok(r, c, v)) {
        g[r][c] = v;
        if (fill(pos + 1)) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }
  fill(0);
  return g;
}

// Count solutions of a puzzle (capped at `cap`) — used to guarantee uniqueness.
function countSolutions(puz, variant, cap = 2) {
  const g = puz.map((row) => row.slice());
  const boxes = variant === "sudoku4";
  let count = 0;
  function ok(r, c, v) {
    for (let i = 0; i < 4; i++) if (g[r][i] === v || g[i][c] === v) return false;
    if (boxes) {
      const b = SUDOKU_BOX(r, c);
      for (let rr = 0; rr < 4; rr++)
        for (let cc = 0; cc < 4; cc++)
          if (SUDOKU_BOX(rr, cc) === b && g[rr][cc] === v) return false;
    }
    return true;
  }
  function solve(pos) {
    if (count >= cap) return;
    if (pos === 16) {
      count++;
      return;
    }
    const r = Math.floor(pos / 4);
    const c = pos % 4;
    if (g[r][c] !== 0) {
      solve(pos + 1);
      return;
    }
    for (let v = 1; v <= 4; v++) {
      if (ok(r, c, v)) {
        g[r][c] = v;
        solve(pos + 1);
        g[r][c] = 0;
      }
    }
  }
  solve(0);
  return count;
}

// Dig holes from a full grid while the puzzle stays uniquely solvable. `minGivens`
// stops the dig early so we can aim for a target difficulty — a 4×4 dug to its
// absolute minimum almost always lands at ~4–5 clues (very hard), so to get
// easier boards we simply leave more clues in. Digging still stops the moment a
// removal would break uniqueness.
function makePuzzle(variant, minGivens = 0) {
  const sol = fullGrid(variant);
  const puz = sol.map((row) => row.slice());
  // Remove cells in random order; keep a removal only if uniqueness survives and
  // we're still above the target clue floor.
  const cells = shuffle(Array.from({ length: 16 }, (_, i) => i));
  let givens = 16;
  for (const idx of cells) {
    if (givens <= minGivens) break;
    const r = Math.floor(idx / 4);
    const c = idx % 4;
    const saved = puz[r][c];
    puz[r][c] = 0;
    if (countSolutions(puz, variant, 2) !== 1) puz[r][c] = saved; // revert
    else givens--;
  }
  return { given: puz, solution: sol };
}

// Difficulty by how many cells are pre-filled (fewer givens = more deduction =
// harder). Tuned for the 16-cell 4×4 board: a minimal-uniqueness dig usually
// leaves 4–8 givens, so the bands split that range.
function gridDifficulty(givenCount) {
  if (givenCount >= 8) return "beginner";
  if (givenCount >= 6) return "intermediate";
  return "advanced";
}

function buildGridNumbers(variant, want) {
  const seen = new Set();
  const prompt =
    variant === "sudoku4"
      ? "Fill the grid so every row, every column, AND every 2×2 box contains 1, 2, 3 and 4 exactly once. Tap a blank cell and type 1–4."
      : "Fill the grid so every row and every column contains 1, 2, 3 and 4 exactly once. Tap a blank cell and type 1–4.";

  // Ask each difficulty for its own clue floor so we get real variety instead of
  // always digging to the (very hard) minimum. beginner leaves the most clues.
  const TARGETS = { beginner: 9, intermediate: 7, advanced: 5 };

  // Split `want` roughly evenly across the three bands.
  const bands = ["beginner", "intermediate", "advanced"];
  const perBand = Math.ceil(want / bands.length);

  const out = [];
  for (const difficulty of bands) {
    let made = 0;
    let guard = 0;
    while (made < perBand && out.length < want && guard++ < perBand * 60) {
      const { given, solution } = makePuzzle(variant, TARGETS[difficulty]);
      const key = given.flat().join("");
      if (seen.has(key)) continue;
      seen.add(key);
      // The dig may not hit the exact floor; classify by the ACTUAL clue count so
      // the badge is always honest even if a board landed a tier off.
      const givenCount = given.flat().filter((v) => v !== 0).length;
      out.push({
        kind: variant,
        prompt,
        size: 4,
        given,
        solution,
        difficulty: gridDifficulty(givenCount),
      });
      made++;
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSEMBLE — wrap each puzzle in the creatives item contract.
// ═══════════════════════════════════════════════════════════════════════════

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Per-kind presentation metadata for the card. `label` is the title noun — the
// card headline is `<label> #<n>` (see titleFor), so keep these as clean nouns
// that read well numbered ("Word Ladder #3", "Cipher #2").
const KIND_META = {
  word_ladder: {
    label: "Word Ladder",
    time: "3 min",
    difficulty: "beginner",
    action: "Climb the ladder, then check it",
  },
  anagram: {
    label: "Word Sprint",
    time: "30 sec",
    difficulty: "beginner",
    action: "Beat the clock — find every word you can",
  },
  middle: {
    label: "Word Sandwich",
    time: "3 min",
    difficulty: "intermediate",
    action: "Find the missing word, then check it",
  },
  cipher: {
    label: "Cipher",
    time: "5 min",
    difficulty: "beginner",
    action: "Crack the code, then check it",
  },
  rebus: {
    label: "Rebus",
    time: "2 min",
    difficulty: "beginner",
    action: "Read the picture, then reveal the phrase",
  },
  pattern: {
    label: "Pattern",
    time: "2 min",
    difficulty: "beginner",
    action: "Work out the rule, then type what comes next",
  },
  mystery: {
    label: "Minute Mystery",
    time: "3 min",
    difficulty: "intermediate",
    action: "Crack the case, then reveal the answer",
  },
  nonogram: {
    label: "Pixel Nonogram",
    time: "10 min",
    difficulty: "intermediate",
    action: "Fill the grid to reveal the picture",
  },
  sudoku4: {
    label: "Mini Sudoku",
    time: "5 min",
    difficulty: "intermediate",
    action: "Fill the grid, then check it",
  },
  latin4: {
    label: "Latin Square",
    time: "5 min",
    difficulty: "beginner",
    action: "Fill the grid, then check it",
  },
};

// The card headline: a simple, scalable "<Kind> #n" (e.g. "Word Ladder #3").
// `n` is the per-kind index (the same number stamped into the id), so titles
// stay uniform as the pool grows — no per-puzzle headline authoring. The blurb
// (BLURBS below) carries the descriptive line.
function titleFor(p, n) {
  const label = KIND_META[p.kind]?.label || "Solve This";
  return `${label} #${n}`;
}

const BLURBS = {
  word_ladder: "Change one letter at a time until you climb from the first word to the last.",
  anagram: "Seven letters, thirty seconds. Find as many words as you can before time runs out.",
  middle: "One little word finishes two bigger ones. Find the word that fits both blanks.",
  cipher: "A secret phrase, scrambled by a Caesar shift. Slide the letters back to read it.",
  rebus: "A little picture-puzzle hiding a word or phrase. Old puzzle-book energy.",
  pattern: "A sequence with the last term missing. Spot the rule, then type what comes next.",
  mystery: "A one-paragraph case with a single fatal contradiction. Out-detective the suspect.",
  nonogram: "Use the number clues to fill the grid — the finished squares reveal a tiny pixel icon.",
  sudoku4: "Sudoku, shrunk to a friendly 4×4. Rows, columns, and boxes each hold 1–4.",
  latin4: "Every row and column gets 1–4 exactly once. Sudoku's gentler cousin.",
};

function toItem(p, n) {
  const meta = KIND_META[p.kind];
  const idBase = `cr-solve-${slugify(p.kind)}`;
  return {
    id: `${idBase}-${String(n).padStart(3, "0")}`,
    lane: "solve",
    guide: true,
    title: titleFor(p, n),
    blurb: BLURBS[p.kind],
    time: meta.time,
    // A puzzle may carry its own computed difficulty (word sprints scale by how
    // many words the rack holds; grids/ladders by their own metric). Fall back to
    // the kind's default badge otherwise.
    difficulty: p.difficulty || meta.difficulty,
    cost: "free",
    action: meta.action,
    puzzle: p,
  };
}

// ── run ───────────────────────────────────────────────────────────────────
console.log("\nGEN-SOLVE-PUZZLES — building the Solve This pool\n");

const dict4 = loadWords(4);
const dict5 = loadWords(5);
console.log(`  loaded ${dict4.size} four-letter and ${dict5.size} five-letter words`);

// A length→Set map so the anagram + sandwich generators can verify words of any
// length (KEYBOARD is 8, BOARDED is 7, etc.). dict4/dict5 are reused as-is.
const dictByLen = {
  3: loadWords(3),
  4: dict4,
  5: dict5,
  6: loadWords(6),
  7: loadWords(7),
  8: loadWords(8),
};

const puzzles = [
  ...buildWordLadders(dict4, dict5, 14),
  ...buildWordSprints(dictByLen, 12),
  ...buildSandwiches(dictByLen, 10),
  ...buildCiphers(6),
  ...buildRebuses(6),
  ...buildPatterns(8),
  ...buildMysteries(4),
  ...buildNonograms(5),
  ...buildGridNumbers("sudoku4", 12),
  ...buildGridNumbers("latin4", 12),
];

// Stamp a stable per-kind index into each id.
const counters = {};
const items = puzzles.map((p) => {
  counters[p.kind] = (counters[p.kind] || 0) + 1;
  return toItem(p, counters[p.kind]);
});

// Report what we built, per kind.
for (const kind of Object.keys(KIND_META)) {
  const c = items.filter((i) => i.puzzle.kind === kind).length;
  console.log(`  ${kind.padEnd(12)} ${c}`);
}
console.log(`  ${"TOTAL".padEnd(12)} ${items.length}`);

const banner =
  "// AUTO-GENERATED by scripts/gen-solve-puzzles.js — do not edit by hand.\n" +
  "// \"Solve this\" puzzles for the /creatives page. Run `npm run gen:solve` to\n" +
  "// regenerate from the committed word lists in assets-src/wordlists/.\n";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, OUT_FILE),
  `${banner}export default ${JSON.stringify(items, null, 2)};\n`
);

console.log(`\n✓ wrote ${items.length} puzzles → src/data/generated/${OUT_FILE}\n`);
