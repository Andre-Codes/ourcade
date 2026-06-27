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

  // Wanted badge — shown in the objective banner (renders ~26px; 128px master
  // gives crisp retina headroom at a tiny file size). Transparent.
  const badge = join(SRC, "wanted-badge.png");
  if (existsSync(badge)) {
    await trimmed(badge)
      .resize({ width: 128, height: 128, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 88 })
      .toFile(join(OUT, "wanted-badge.webp"));
    console.log("  public/games/chip-panic/wanted-badge.webp");
  } else {
    console.log("  (skipped wanted-badge — no assets-src/high_card_bust/wanted-badge.png)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
