// Processes the raw Modem Defender art into optimized, web-ready sprites.
//
// The source files live in assets-src/modem_defender/ and are raw image-generator
// output: large (1536×1024) RGBA PNGs with a real alpha channel but LOTS of
// transparent padding around the actual art. Dropped in unprocessed they'd be
// oversized and their click-hitboxes would be mostly empty space. This trims that
// padding, resizes each to a sane on-screen size, and writes web-ready WebP into
// public/games/modem-defender/{sprites,ui}/ where the React game references them.
//
// Every sprite (including the virus, now a single static frame animated with a CSS
// wobble in-game) is a plain single-image job — no sprite-sheet slicing.
//
// Same conventions as process-mascots.js / process-featured.js.
// Run with: npm run assets:modem

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets-src", "modem_defender");
const OUT = join(root, "public", "games", "modem-defender");
const SPRITES = join(OUT, "sprites");
const UI = join(OUT, "ui");

// trim() on uniformly-transparent borders is deterministic — this is its best
// case, so a modest threshold cleanly strips the padding without eating soft edges.
const TRIM = { threshold: 12 };
const WEBP = { quality: 86 };

// Single-sprite jobs: source basename → { out dir, out name, max width }.
// Sizes are the SOURCE-art cap (2–3× the on-screen CSS size) for crisp retina;
// the game scales each further down in CSS.
const SPRITE_JOBS = [
  { src: "pop-up-window.png", dir: SPRITES, name: "popup", width: 420 },
  { src: "banner-ad.png", dir: SPRITES, name: "banner", width: 600 },
  { src: "spam-envelope.png", dir: SPRITES, name: "spam", width: 320 },
  { src: "virus-blob.png", dir: SPRITES, name: "virus", width: 360 }, // single frame; animated via CSS wobble in-game
  { src: "parody-assistance.png", dir: SPRITES, name: "clippy", width: 360 },
  { src: "toolbar-hijacker.png", dir: SPRITES, name: "toolbar", width: 480 },
  { src: "turbo-popup.png", dir: SPRITES, name: "turbo-popup", width: 480 }, // "download faster!" pop-up → ball speed-up
  { src: "spam-swarm.png", dir: SPRITES, name: "spam-swarm", width: 420 }, // pop-up that multiplies on death
  { src: "bsod-boss.png", dir: SPRITES, name: "boss", width: 560 },
  { src: "defender-modem.png", dir: SPRITES, name: "player", width: 320 },
  { src: "modem-defender-logo.png", dir: UI, name: "logo", width: 900 },
  { src: "no-carrier-stamp.png", dir: UI, name: "no-carrier", width: 720 },
  // Brick-breaker additions (the game falls back to emoji/CSS until these exist):
  { src: "data-packet.png", dir: SPRITES, name: "ball", width: 128 },
  { src: "loot-block.png", dir: SPRITES, name: "loot", width: 360 },
  // Circular inventory badges — one emblem each, processed identically.
  { src: "badge-firewall.png", dir: SPRITES, name: "badge-firewall", width: 160 },
  { src: "badge-forkbomb.png", dir: SPRITES, name: "badge-forkbomb", width: 160 },
  { src: "badge-buffering.png", dir: SPRITES, name: "badge-buffering", width: 160 },
  { src: "badge-broadband.png", dir: SPRITES, name: "badge-broadband", width: 160 },
  { src: "badge-overclock.png", dir: SPRITES, name: "badge-overclock", width: 160 },
];

async function processSprite({ src, dir, name, width }) {
  const input = join(SRC, src);
  if (!existsSync(input)) {
    console.log(`  (skipped ${name} — no ${src})`);
    return false;
  }
  await sharp(input)
    .trim(TRIM)
    .resize({ width, withoutEnlargement: true })
    .webp(WEBP)
    .toFile(join(dir, `${name}.webp`));
  console.log(`  ${dir === UI ? "ui" : "sprites"}/${name}.webp`);
  return true;
}

async function main() {
  if (!existsSync(SRC)) {
    console.log(`(nothing to do — ${SRC} doesn't exist)`);
    return;
  }
  await mkdir(SPRITES, { recursive: true });
  await mkdir(UI, { recursive: true });

  console.log("Modem Defender assets generated:");
  for (const job of SPRITE_JOBS) await processSprite(job);
  console.log("Done → public/games/modem-defender/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
