import { lazy } from "react";

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
    id: "pits-and-portals",
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
    id: "color-panic",
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
