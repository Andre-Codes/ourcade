/* ─────────────────────────────────────────────────────────────────────────
   STICKERS — the little corner flair on game cards  ·  edit this file by hand

   Each game card on the home shelves can wear ONE sticker in its top-right
   corner — the starburst that says "NEW!", "HOT!", etc. This file is the one
   place to set them. Edit it whenever you like; it's never touched by
   `npm run generate`.

   ── How to use ─────────────────────────────────────────────────────────────
   Map a game's id (the id from src/data/games.js, e.g. "tap-surge") to a
   sticker key below. Only games listed here get a sticker — to remove one,
   delete its line. To add one, add a line. That's it.

        export const STICKERS = {
          "tap-surge": "HOT",
          "crypt-crawler": "STAR",
        };

   This file is the SOLE source of sticker truth. games.js has no sticker/badge
   field — you never touch games.js to change a sticker.

   ── Available stickers ─────────────────────────────────────────────────────
   These keys already have a color + label. To invent a new one, add it to
   STICKER_LABELS below AND add a matching `.arcade-burst.is-yourkey` color in
   src/arcade.css (next to .is-new / .is-hot).

     NEW    → "NEW!"   (lime)     fresh on the arcade
     HOT    → "HOT!"   (pink)     popular right now
     STAR   → "★"      (gold)     a personal favorite / staff pick
     TOP    → "TOP!"   (aqua)     a top-rated board
     FREE   → "FREE!"  (purple)   no account needed
     DAILY  → "DAILY"  (gold)     a new challenge every day
     CASINO → "CASINO" (green)    cards & chips — the casino corner
   ───────────────────────────────────────────────────────────────────────── */

// id (from games.js) → sticker key (from STICKER_LABELS). Only listed games
// get a sticker; omit a game to give it none.
export const STICKERS = {
  "relic-run": "DAILY",
  "pits-and-portals": "HOT",
  "tap-surge": "HOT",
  "modem-defender": "HOT",
  "snake": "TOP",
  "tetris": "NEW",
  "game-2048": "NEW",
  "solitaire": "NEW",
  "memory-match": "HOT",
  "video-poker": "NEW",
  "blackjack": "NEW",
  "chip-panic": "NEW",
};

// Sticker key → the text drawn in the starburst. Add a row here (and a CSS
// color) to introduce a brand-new sticker.
export const STICKER_LABELS = {
  NEW: "NEW!",
  HOT: "HOT!",
  STAR: "★",
  TOP: "TOP!",
  FREE: "FREE!",
  DAILY: "DAILY",
  CASINO: "CASINO",
};

// Resolve a game's sticker from this file (the sole source). Returns
// { key, label } or null when the game has no sticker.
export function getSticker(game) {
  if (!game) return null;
  const key = STICKERS[game.id];
  if (!key) return null;
  return { key, label: STICKER_LABELS[key] || `${key}!` };
}
