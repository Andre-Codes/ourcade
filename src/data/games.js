import { lazy } from "react";
import { decodeScore, fmtClock } from "../lib/scoretime.js";

// ─────────────────────────────────────────────────────────────────────────
//  GAME REGISTRY
//  This is the ONE file you edit to add, remove, or reorder games.
//
//  React games:   type "react"  + a lazy()-loaded component.
//  Standalone HTML: type "iframe" + a path under /public (served as-is).
//
//  `category` decides which home-page shelf an entry lands on:
//    "game" → 🕹️ GAMES        "tool" → 🧰 TOOLS & TOYS
//
//  To add a new React game:
//    1. Drop the .jsx file in src/games/ (must `export default` a component).
//    2. Add an entry below with a unique `id` and component: lazy(() => import(...)).
//
//  To add a new tool/toy:
//    1. Drop the .jsx file in src/tools/ (same contract as a React game).
//    2. Add an entry with category: "tool".
//
//  To add a new standalone HTML game:
//    1. Drop the .html (and assets) in public/games/.
//    2. Add an entry with type "iframe" and src: "games/your-file.html".
//
//  THE ARCADE SCORE STANDARD (optional `score` config):
//    Add a `score` object and the game automatically gets a high-score board
//    at #/scores/:id, a 🏆 on its cabinet, and the shared HighScoreBoard UI —
//    no other wiring. Leave it off and the game simply has no board.
//      score: {
//        label: "SCORE",                 // column heading on the board
//        dir: "desc",                    // "desc" = higher better (default),
//                                        // "asc" = lower better (e.g. time)
//        format: (n) => n.toLocaleString(),  // optional; defaults to String(n)
//      }
//    React games submit via the shared GameOver hook (ADHDArcade.jsx); iframe
//    games postMessage { type:"ourcade:score", gameId, score } to the parent
//    (GamePage.jsx bridges it). Boards are claimed-accounts-only.
// ─────────────────────────────────────────────────────────────────────────

export const GAMES = [
  {
    id: "relic-run",
    original: true,
    title: "Web Run",
    blurb: "A Wikipedia-race through a haunted 2003 webring. Same start and target for everyone each day — surf the fake retro pages and reach today's lost page in the fewest clicks.",
    emoji: "🖱️",
    accent: "#3fffd0",
    tags: ["daily", "maze", "old-web", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/RelicRun.jsx")),
    // Board ranks the daily run by fewest clicks (asc = lower is better).
    // Free-play "Random Relic Run" never submits.
    score: { label: "CLICKS", dir: "asc" },
  },
  {
    id: "dictionary-dungeon",
    original: true,
    title: "Dictionary Dungeon",
    blurb:
      "A text roguelike where language is the weapon. Type valid words to clear rooms, slay enemies, and survive the daily dungeon — same run for everyone today. Longer, rarer words hit harder, and some words hide a sting.",
    emoji: "📖",
    accent: "#d9b45e",
    tags: ["daily", "word", "roguelike", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/DictionaryDungeon.jsx")),
    // Daily run ranks by total score (higher better). Practice never submits.
    score: { label: "SCORE", dir: "desc" },
  },
  // The Daily Quarter (Wordle-style word game) is PARKED — replaced as the daily
  // game by Daily Relic Run (too close to Wordle). Source files are kept on disk
  // (src/games/QuarterGame.jsx, src/games/quarter/, src/data/quarterWords.js,
  // scripts/quarter-text.js); un-comment this entry to bring it back.
  // {
  //   id: "quarter",
  //   title: "The Daily Quarter",
  //   blurb: "One word a day — six guesses, same puzzle for everyone. Spend your quarter wisely. Come back tomorrow for a fresh one.",
  //   emoji: "🪙",
  //   accent: "#ffd45e",
  //   tags: ["daily", "word", "puzzle", "solo"],
  //   rating: 5,
  //   plays: 0,
  //   category: "game",
  //   type: "react",
  //   component: lazy(() => import("../games/QuarterGame.jsx")),
  //   // Board ranks by fewest guesses (asc = lower is better). A miss never submits.
  //   score: { label: "GUESSES", dir: "asc", format: (n) => `${n}/6` },
  // },
  {
    id: "spelldown",
    original: true,
    title: "Spelldown",
    blurb: "Seven letters, one in the middle you must use. Spell as many words as you can — using all seven is the daily jackpot. Same board for everyone; a fresh one drops at midnight.",
    emoji: "🐝",
    accent: "#ffd45e",
    tags: ["daily", "word", "puzzle", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Spelldown.jsx")),
    // Board ranks by MOST words found (desc = higher is better).
    score: { label: "WORDS", dir: "desc" },
  },
  {
    id: "rank-it",
    original: true,
    title: "Rank It",
    blurb: "Five everyday words, one question: which is more common? Drag them into their true order of how often English actually uses them — most-used on top. Same five for everyone; lock in once, a fresh set at midnight.",
    emoji: "📊",
    accent: "#5ac8fa",
    tags: ["daily", "word", "puzzle", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/RankIt.jsx")),
    // Board ranks by closeness score (0–100; higher is better).
    score: { label: "SCORE", dir: "desc" },
  },
  {
    id: "laddergram",
    original: true,
    title: "Laddergram",
    blurb: "A daily word ladder. Climb from the start word to the target by changing one letter at a time — every rung has to be a real word. Beat par for the day, keep your streak alive. Same ladder for everyone; a new one at midnight.",
    emoji: "🪜",
    accent: "#4fdd8a",
    tags: ["daily", "word", "puzzle", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Laddergram.jsx")),
    // Board ranks by fewest steps, then fastest (asc = lower is better). Score
    // packs steps + solve seconds via scoretime.encodeScore(steps, secs, "asc").
    score: {
      label: "STEPS · TIME",
      dir: "asc",
      format: (n) => {
        const { value, secs } = decodeScore(n, "asc");
        return `${value} step${value === 1 ? "" : "s"} · ${fmtClock(secs)}`;
      },
    },
  },
  {
    id: "missing-vowels",
    original: true,
    title: "Missing Vowels",
    blurb: "A one-minute daily decode. Six everyday words, all their vowels stripped out — just the consonant skeletons and a theme to guide you. Fill the vowels back in. Same set for everyone; a fresh theme at midnight.",
    emoji: "🔤",
    accent: "#c77dff",
    tags: ["daily", "word", "puzzle", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/MissingVowels.jsx")),
    // Board ranks by words restored, then fastest (desc = higher is better).
    // Score packs solved + seconds via encodeScore(solved, secs, "desc").
    score: {
      label: "SOLVED · TIME",
      dir: "desc",
      format: (n) => {
        const { value, secs } = decodeScore(n, "desc");
        return `${value}/6 · ${fmtClock(secs)}`;
      },
    },
  },
  {
    id: "chain",
    original: true,
    title: "Chain",
    blurb: "Word dominoes. Each word has to start with the last letter of the one before it — all real, everyday words, no repeats. Build the longest chain you can from the day's seed and beat par. Same seed for everyone; a new one at midnight.",
    emoji: "🔗",
    accent: "#39d6c4",
    tags: ["daily", "word", "puzzle", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Chain.jsx")),
    // Board ranks by longest chain, then fastest to reach it (desc = higher is
    // better). Score packs length + seconds via encodeScore(length, secs, "desc").
    score: {
      label: "LENGTH · TIME",
      dir: "desc",
      format: (n) => {
        const { value, secs } = decodeScore(n, "desc");
        return `${value} · ${fmtClock(secs)}`;
      },
    },
  },
  {
    id: "pits-and-portals",
    original: true,
    title: "Pits and Portals",
    blurb: "A fragile-hero puzzle-roguelike. No healing — survive by shoving threats into the pits. Every floor is verified beatable hitless.",
    emoji: "🕯️",
    accent: "#e3bb5e",
    tags: ["puzzle", "roguelike"],
    rating: 4.8,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/PitsAndPortals.jsx")),
  },
  {
    id: "crypt-crawler",
    original: true,
    title: "Crypt of the Hollow King",
    blurb: "A deterministic magic-tower puzzle-crawler. Plan every step — no luck, just route-finding and HP math.",
    emoji: "🏰",
    accent: "#ff8a3d",
    tags: ["puzzle", "roguelike"],
    rating: 4,
    plays: 13370,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/CryptCrawler.jsx")),
  },
  {
    id: "tap-surge",
    original: true,
    title: "Tap Surge",
    blurb: "Tap the dots before they vanish. Miss three and it's over. Gets faster the higher you score.",
    emoji: "⚡",
    accent: "#ff9500",
    tags: ["reaction", "arcade", "solo", "tapping"],
    rating: 4,
    plays: 3201,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/TapSurge.jsx")),
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "modem-defender",
    original: true,
    title: "Modem Defender",
    blurb: "Brick-breaker for the dial-up age. Bounce a data packet off your modem to smash a wall of pop-ups, viruses, spam and toolbars; crack loot crates for firewalls, multiball and more. Clear every level, survive the BSOD bosses. Drop the ball and it's NO CARRIER.",
    emoji: "📡",
    accent: "#3fffd0",
    tags: ["brick-breaker", "arcade", "old-web", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/ModemDefender.jsx")),
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "memory-match",
    title: "Memory Match",
    blurb: "Concentration with a retro twist — flip the tiles, match the floppies, CDs and gamepads, and clear the board in as few moves as you can.",
    emoji: "🧠",
    accent: "#3fffd0",
    tags: ["memory", "puzzle", "solo", "classic", "low-stim"],
    rating: 4,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/MemoryMatch.jsx")),
    // No board on the cabinet itself: each grid size has its OWN fewest-moves
    // board (raw moves aren't comparable across 8/10/12-pair grids). The three
    // score-only entries below carry the boards; MemoryMatch submits to
    // `memory-match-<level.id>` and links to the active one from its win screen.
  },
  // Score-only sub-entries: a `score` config gives each its own board + #/scores
  // page + profile-bests row, but with NO `category`/`component` they don't show
  // on the home shelves and aren't separately playable. See MemoryMatch.jsx.
  { id: "memory-match-easy", title: "Memory Match · 4×4", emoji: "🧠",
    score: { label: "MOVES", dir: "asc" } },
  { id: "memory-match-med", title: "Memory Match · 4×5", emoji: "🧠",
    score: { label: "MOVES", dir: "asc" } },
  { id: "memory-match-hard", title: "Memory Match · 4×6", emoji: "🧠",
    score: { label: "MOVES", dir: "asc" } },
  {
    id: "solitaire",
    title: "Solitaire",
    blurb: "The one that defined a billion coffee breaks. Klondike, draw 1 or draw 3, tap-to-move, auto-complete when it's in the bag. Clear it in the fewest moves.",
    emoji: "🃏",
    accent: "#3fffd0",
    tags: ["cards", "classic", "solo", "puzzle", "low-stim"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Solitaire.jsx")),
    score: { label: "MOVES", dir: "asc" },
  },
  {
    id: "video-poker",
    title: "Video Poker",
    blurb: "The corner-bar cabinet. Jacks or Better: bet your credits, hold the keepers, draw, and chase the royal flush. Best bankroll wins.",
    emoji: "🎰",
    accent: "#ffd23f",
    tags: ["cards", "casino", "classic", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/VideoPoker.jsx")),
    score: { label: "CREDITS", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "blackjack",
    title: "Blackjack",
    blurb: "Beat the house. Hit, stand, or double down — dealer stands on 17, blackjack pays 3:2. Walk away with the biggest chip stack you can.",
    emoji: "🂡",
    accent: "#3fffd0",
    tags: ["cards", "casino", "classic", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Blackjack.jsx")),
    score: { label: "CHIPS", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "chip-panic",
    original: true,
    title: "High Card Bust",
    blurb: "Poker solitaire, push-your-luck. Open a lane with a chip ante, then fill it to five: TWO PAIR or better truly scores, any pair only saves the lane (no points, ante gone), and a HIGH CARD locks it for good. Raise for a multiplier, chase the rotating WANTED hand for bonus chips and points, and build a streak — all four lanes locked ends the run.",
    emoji: "🎴",
    accent: "#bf5af2",
    tags: ["cards", "poker", "casino", "solo"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/ChipPanic.jsx")),
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "color-panic",
    original: true,
    title: "Color Panic",
    blurb: "Tap only the target color as tiles rain down. The target keeps changing — keep up.",
    emoji: "🎨",
    accent: "#bf5af2",
    tags: ["reaction", "arcade", "solo", "color"],
    rating: 4,
    plays: 2410,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/ColorPanic.jsx")),
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "piano-tiles",
    original: true,
    title: "Piano Tiles",
    blurb: "Tap the lane the moment a tile hits the line. Perfect beats Good beats Miss.",
    emoji: "🎹",
    accent: "#34c759",
    tags: ["reaction", "arcade", "solo", "rhythm"],
    rating: 3.5,
    plays: 1530,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/PianoTiles.jsx")),
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "splitter",
    original: true,
    title: "Splitter",
    blurb: "Pop the dots before they split into more. The longer you last, the faster they come.",
    emoji: "💥",
    accent: "#0a84ff",
    tags: ["reaction", "arcade", "solo", "tapping"],
    rating: 3.8,
    plays: 901,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Splitter.jsx")),
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "mind-flood",
    original: true,
    title: "Mind Flood",
    blurb: "Six cognitive trainers — Corsi, Stroop Clash, Math Rush, N-Back, Task Switch, and Go/No-Go.",
    emoji: "🧠",
    accent: "#e8ff47",
    tags: ["brain", "training"],
    rating: 4,
    plays: 5128,
    category: "game",
    type: "iframe",
    src: "games/mind-flood.html",
  },
  {
    id: "snake",
    title: "Snake",
    blurb: "The one that came on every phone. Eat, grow, don't bite yourself — now with a working dialer and a hidden browser.",
    emoji: "🐍",
    accent: "#a8c83a",
    tags: ["arcade", "classic", "low-stim"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "iframe",
    src: "games/snake.html",
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "tetris",
    title: "Tetris",
    blurb: "The original falling blocks. Stack the tetrominoes, clear lines, and chase the top score before you top out.",
    emoji: "🧱",
    accent: "#34c5ff",
    tags: ["arcade", "classic", "puzzle", "solo", "low-stim"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Tetris.jsx")),
    // Higher is better → standard board.
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "game-2048",
    title: "2048",
    blurb: "Slide the tiles, merge the matching numbers, and chase 2048. No timer, no rush — one calm move at a time.",
    emoji: "🔢",
    accent: "#cdb24e",
    tags: ["puzzle", "classic", "solo", "low-stim"],
    rating: 5,
    plays: 0,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/Game2048.jsx")),
    // Higher is better → standard board.
    score: { label: "SCORE", dir: "desc", format: (n) => n.toLocaleString() },
  },
  {
    id: "poker-tracker",
    title: "Poker Night Tracker",
    blurb: "Track buy-ins and cash-outs for a home game, then get the exact who-pays-whom settlement.",
    emoji: "♠️",
    accent: "#c8a84b",
    tags: ["utility", "cards"],
    rating: 4,
    plays: 2207,
    category: "tool",
    type: "react",
    component: lazy(() => import("../games/PokerTracker.jsx")),
  },
  {
    id: "wheel-of-names",
    title: "Wheel of Names",
    blurb: "Drop in a list of names and spin the wheel to pick one at random. Remove the winner and spin again.",
    emoji: "🎡",
    accent: "#ffd23f",
    tags: ["party", "picker"],
    rating: 5,
    plays: 412,
    category: "tool",
    type: "react",
    component: lazy(() => import("../tools/WheelOfNames.jsx")),
  },
  {
    id: "dice-roller",
    title: "Dice & Coin",
    blurb: "Roll any combo of d4–d20 with modifiers, or flip a coin. Sums, breakdowns, and a roll history.",
    emoji: "🎲",
    accent: "#b44dff",
    tags: ["party", "ttrpg"],
    rating: 5,
    plays: 388,
    category: "tool",
    type: "react",
    component: lazy(() => import("../tools/DiceRoller.jsx")),
  },
  {
    id: "magic-8-ball",
    title: "Magic 8-Ball",
    blurb: "Ask a yes/no question, shake, and let fate answer with all 20 of the classic replies.",
    emoji: "🎱",
    accent: "#3fffd0",
    tags: ["party", "novelty"],
    rating: 4,
    plays: 666,
    category: "tool",
    type: "react",
    component: lazy(() => import("../tools/MagicEightBall.jsx")),
  },
  {
    id: "name-o-tron",
    original: true,
    title: "Name-O-Tron 3000",
    blurb: "Feed it any name and the supercomputer prints a 100% scientific readout — coolness, mystery, arcade skill — plus a verdict you can share.",
    emoji: "🔮",
    accent: "#b44dff",
    tags: ["party", "novelty"],
    rating: 5,
    plays: 0,
    category: "tool",
    type: "react",
    component: lazy(() => import("../tools/NameORon.jsx")),
  },
  {
    id: "soundboard",
    original: true,
    title: "Ourcade Soundboard",
    blurb: "A grid of old-internet pads — the dial-up handshake, Windows 98 & XP startup/shutdown chimes, and more. Tap to relive the noise.",
    emoji: "🔊",
    accent: "#3fa9ff",
    tags: ["party", "novelty"],
    rating: 5,
    plays: 0,
    category: "tool",
    type: "react",
    component: lazy(() => import("../tools/Soundboard.jsx")),
  },
];

export const getGame = (id) => GAMES.find((g) => g.id === id);

// Does this game (id or entry) opt into the Arcade Score Standard?
export const hasScoreboard = (gameOrId) => {
  const g = typeof gameOrId === "string" ? getGame(gameOrId) : gameOrId;
  return !!g?.score;
};

// Entries on a given home-page shelf, e.g. getByCategory("game" | "tool").
export const getByCategory = (category) => GAMES.filter((g) => g.category === category);
