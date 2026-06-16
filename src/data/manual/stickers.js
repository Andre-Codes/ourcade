/* ─────────────────────────────────────────────────────────────────────────
   STICKERS — the little corner flair on game cards  ·  edit this file by hand

   Each game card on the home shelves can wear ONE sticker in its top-right
   corner — the starburst that says "NEW!", "HOT!", etc. This file is the one
   place to set them. Edit it whenever you like; it's never touched by
   `npm run generate`.

   ── How to use ─────────────────────────────────────────────────────────────
   Map a game's id (the id from src/data/games.js, e.g. "tap-surge") to a
   sticker key below. To remove a sticker, delete the line (or set it to null).

        export const STICKERS = {
          "tap-surge": "HOT",
          "crypt-crawler": "STAR",
        };

   Anything here WINS over the old per-game `badge:` field in games.js, so this
   file is the source of truth — you don't need to touch games.js to change a
   sticker.

   ── Available stickers ─────────────────────────────────────────────────────
   These keys already have a color + label. To invent a new one, add it to
   STICKER_LABELS below AND add a matching `.arcade-burst.is-yourkey` color in
   src/arcade.css (next to .is-new / .is-hot).

     NEW   → "NEW!"   (lime)     fresh on the arcade
     HOT   → "HOT!"   (pink)     popular right now
     STAR  → "★"      (gold)     a personal favorite / staff pick
     TOP   → "TOP!"   (aqua)     a top-rated board
     FREE  → "FREE!"  (purple)   no account needed
   ───────────────────────────────────────────────────────────────────────── */

// id (from games.js) → sticker key (from STICKER_LABELS). Edit freely.
export const STICKERS = {
  "pits-and-portals": "NEW",
  "crypt-crawler": "NEW",
  "tap-surge": "HOT",
};

// Sticker key → the text drawn in the starburst. Add a row here (and a CSS
// color) to introduce a brand-new sticker.
export const STICKER_LABELS = {
  NEW: "NEW!",
  HOT: "HOT!",
  STAR: "★",
  TOP: "TOP!",
  FREE: "FREE!",
};

// Resolve a game's sticker: this file first, then the legacy `badge` field on
// the game entry (so nothing breaks if a game isn't listed here yet).
// Returns { key, label } or null.
export function getSticker(game) {
  if (!game) return null;
  const key = STICKERS[game.id] ?? game.badge;
  if (!key) return null;
  return { key, label: STICKER_LABELS[key] || `${key}!` };
}
