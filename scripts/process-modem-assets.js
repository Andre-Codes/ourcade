// Processes the raw Modem Defender art into optimized, web-ready sprites.
//
// The source files live in assets-src/modem_defender/ and are raw image-generator
// output: large (1536×1024) RGBA PNGs with a real alpha channel but LOTS of
// transparent padding around the actual art. Dropped in unprocessed they'd be
// oversized and their click-hitboxes would be mostly empty space. This trims that
// padding, resizes each to a sane on-screen size, and writes web-ready WebP into
// public/games/modem-defender/{sprites,ui}/ where the React game references them.
//
// The virus is a 4-frame horizontal sprite SHEET — it gets sliced into 4 equal
// cells re-packed onto a uniform strip so a CSS steps(4) animation lands exactly.
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
  { src: "parody-assistance.png", dir: SPRITES, name: "clippy", width: 360 },
  { src: "toolbar-hijacker.png", dir: SPRITES, name: "toolbar", width: 480 },
  { src: "bsod-boss.png", dir: SPRITES, name: "boss", width: 560 },
  { src: "defender-modem.png", dir: SPRITES, name: "player", width: 320 },
  { src: "modem-defender-logo.png", dir: UI, name: "logo", width: 900 },
  { src: "no-carrier-stamp.png", dir: UI, name: "no-carrier", width: 720 },
];

const VIRUS_SRC = "virus-blob_4-frame.png";
const VIRUS_FRAMES = 4;
const VIRUS_CELL = 128; // per-frame output cell (px); 4 cells → 512px-wide strip.

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

// Slice the 4-frame sheet into an even strip. Trim each frame INDEPENDENTLY (so a
// frame with more motion doesn't shift the others), then center each onto an equal
// VIRUS_CELL square. The result is a clean (VIRUS_FRAMES × VIRUS_CELL)-wide PNG
// the game animates with `background-position` + steps(VIRUS_FRAMES).
async function processVirus() {
  const input = join(SRC, VIRUS_SRC);
  if (!existsSync(input)) {
    console.log(`  (skipped virus — no ${VIRUS_SRC})`);
    return false;
  }
  // Trim the whole sheet first to drop the outer margin, then split by width.
  // Read dimensions from the RENDERED buffer (not the pre-trim pipeline metadata,
  // which still reports the original 1536-wide size and overflows the extract).
  const buf = await sharp(input).trim(TRIM).png().toBuffer();
  const meta = await sharp(buf).metadata();
  const fw = Math.floor(meta.width / VIRUS_FRAMES);

  const cells = [];
  for (let i = 0; i < VIRUS_FRAMES; i++) {
    // Extract one raw frame, trim its own padding, fit it into the square cell.
    const left = i * fw;
    const w = i === VIRUS_FRAMES - 1 ? meta.width - left : fw;
    const cell = await sharp(buf)
      .extract({ left, top: 0, width: w, height: meta.height })
      .trim(TRIM)
      .resize({
        width: VIRUS_CELL,
        height: VIRUS_CELL,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    cells.push({ input: cell, left: i * VIRUS_CELL, top: 0 });
  }

  await sharp({
    create: {
      width: VIRUS_CELL * VIRUS_FRAMES,
      height: VIRUS_CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(cells)
    .webp(WEBP)
    .toFile(join(SPRITES, "virus.webp"));
  console.log(`  sprites/virus.webp (${VIRUS_FRAMES}-frame strip, ${VIRUS_CELL}px cells)`);
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
  await processVirus();
  console.log("Done → public/games/modem-defender/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
