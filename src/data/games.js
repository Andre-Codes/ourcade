import { lazy } from "react";

// ─────────────────────────────────────────────────────────────────────────
//  GAME REGISTRY
//  This is the ONE file you edit to add, remove, or reorder games.
//
//  React games:   type "react"  + a lazy()-loaded component.
//  Standalone HTML: type "iframe" + a path under /public (served as-is).
//
//  To add a new React game:
//    1. Drop the .jsx file in src/games/ (must `export default` a component).
//    2. Add an entry below with a unique `id` and component: lazy(() => import(...)).
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
    type: "react",
    component: lazy(() => import("../games/PokerTracker.jsx")),
  },
];

export const getGame = (id) => GAMES.find((g) => g.id === id);
