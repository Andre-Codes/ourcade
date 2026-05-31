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
// ─────────────────────────────────────────────────────────────────────────

export const GAMES = [
  {
    id: "crypt-crawler",
    title: "Crypt of the Hollow King",
    blurb: "A deterministic magic-tower puzzle-crawler. Plan every step — no luck, just route-finding and HP math.",
    emoji: "🏰",
    accent: "#ff8a3d",
    tags: ["puzzle", "roguelike"],
    badge: "NEW",
    rating: 5,
    plays: 13370,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/CryptCrawler.jsx")),
  },
  {
    id: "adhd-arcade",
    title: "Reflex Arcade",
    blurb: "Four bite-sized reaction games: Tap Surge, Color Panic, Piano Tiles, and Splitter. Tap, react, score, repeat.",
    emoji: "⚡",
    accent: "#ff9500",
    tags: ["reaction", "arcade"],
    badge: "HOT",
    rating: 4,
    plays: 8042,
    category: "game",
    type: "react",
    component: lazy(() => import("../games/ADHDArcade.jsx")),
  },
  {
    id: "mind-flood",
    title: "Mind Flood",
    blurb: "Six cognitive trainers — Corsi, Stroop Clash, Math Rush, N-Back, Task Switch, and Go/No-Go.",
    emoji: "🧠",
    accent: "#e8ff47",
    tags: ["brain", "training"],
    badge: null,
    rating: 4,
    plays: 5128,
    category: "game",
    type: "iframe",
    src: "games/mind-flood.html",
  },
  {
    id: "poker-tracker",
    title: "Poker Night Tracker",
    blurb: "Track buy-ins and cash-outs for a home game, then get the exact who-pays-whom settlement.",
    emoji: "♠️",
    accent: "#c8a84b",
    tags: ["utility", "cards"],
    badge: null,
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
    badge: "NEW",
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
    badge: "NEW",
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
    badge: "NEW",
    rating: 4,
    plays: 666,
    category: "tool",
    type: "react",
    component: lazy(() => import("../tools/MagicEightBall.jsx")),
  },
];

export const getGame = (id) => GAMES.find((g) => g.id === id);

// Entries on a given home-page shelf, e.g. getByCategory("game" | "tool").
export const getByCategory = (category) => GAMES.filter((g) => g.category === category);
