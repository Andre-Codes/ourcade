// Processes High Card Bust's bespoke art into web-ready assets.
//
// Source masters live in assets-src/high_card_bust/ (large, transparent PNGs).
// This trims their transparent padding, resizes, and compresses into WebP under
// public/games/chip-panic/ — the path the game references (see WANTED_BADGE in
// src/games/ChipPanic.jsx). Mirrors the mascot pipeline (trim → resize → webp).
//
// Run with: npm run assets:hcb

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets-src", "high_card_bust");
const OUT = join(root, "public", "games", "chip-panic");

// Trim the transparent padding off a centered source PNG.
const trimmed = (src) => sharp(src).trim({ threshold: 10 });

async function main() {
  await mkdir(OUT, { recursive: true });

  const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

  // Each entry: source PNG → public WebP, at a display-appropriate master size.
  // Badges use a square `size` (fit:contain). The title logo is a wide masthead, so
  // it sets `width` only (height auto) to keep its natural aspect ratio.
  const jobs = [
    { src: "wanted-badge.png", out: "wanted-badge.webp", size: 128 }, // banner badge (~26px)
    { src: "ante-up.png", out: "ante-up.webp", size: 256 },           // "ANTE UP" popup icon (larger)
    { src: "discard-token.png", out: "discard.webp", size: 128 },     // discard-button icon (~26px)
    { src: "diamond-badge.png", out: "jackpot-badge.webp", size: 128 }, // JACKPOT banner badge (~16px)
    { src: "logo.png", out: "logo.webp", width: 680 },                // title-screen masthead (~340px)
  ];

  for (const j of jobs) {
    const src = join(SRC, j.src);
    if (!existsSync(src)) { console.log(`  (skipped ${j.out} — no assets-src/high_card_bust/${j.src})`); continue; }
    const resize = j.width
      ? { width: j.width, withoutEnlargement: true }
      : { width: j.size, height: j.size, fit: "contain", background: TRANSPARENT };
    await trimmed(src)
      .resize(resize)
      .webp({ quality: 88 })
      .toFile(join(OUT, j.out));
    console.log(`  public/games/chip-panic/${j.out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
