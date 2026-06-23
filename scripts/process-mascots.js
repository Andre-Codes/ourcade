// Processes the raw art (mascots + Magic 8-Ball legendary tokens) into
// optimized, web-ready assets.
//
// The source files live in assets-src/ and are large (~1024-1536px, multi-MB)
// with transparent padding. This trims that padding, resizes, and compresses
// into web-ready copies under src/assets/, plus generates the favicon /
// apple-touch / og:image variants under public/.
//
// Run with: npm run assets:mascots

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets-src");
const SRC_BYTE = join(SRC, "byte_badger.png");
const SRC_ARCADE = join(SRC, "arcade_badger.png");
// Time-of-day greeting variants (home page day-part box). The site has 4
// day-parts but only 3 art variants — late-night reuses the after-hours badger
// (wired in Home.jsx), so no separate "night" source is needed here.
const TIME_BADGERS = ["badger-morning", "badger-afternoon", "badger-after-hours"];
const ASSETS = join(root, "src", "assets");
const PUBLIC = join(root, "public");

// Dark site background — used to flatten the square og:image canvas.
const BG = { r: 4, g: 5, b: 11, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Trim the transparent padding off a source PNG.
const trimmed = (src) => sharp(src).trim({ threshold: 10 });

// Knock a flat WHITE background out of an (animated) source into real alpha.
// GIF alpha is 1-bit, so a hard key leaves a jagged/haloed edge — instead we
// read raw RGBA and ramp near-white pixels to transparent (HI = fully clear,
// LO = fully opaque), but ONLY where the pixel is near-neutral (white/grey),
// so colored art is never touched. The soft grey contact-shadow (well below
// LO) is kept, and against the dark site bg it reads as a natural shadow — the
// reason we emit WebP (full alpha) here rather than another 1-bit gif.
const WHITE_HI = 250; // min channel >= this  → alpha 0
const WHITE_LO = 205; // min channel <= this  → alpha untouched (opaque)
const NEUTRAL_SPREAD = 22; // max-min channel spread to still count as "neutral"
async function whiteToAlphaWebp(src, outPath, webpOpts = {}) {
  const img = sharp(src, { animated: true });
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b);
    if (Math.max(r, g, b) - mn >= NEUTRAL_SPREAD) continue; // colored → keep
    if (mn >= WHITE_HI) data[i + 3] = 0;
    else if (mn > WHITE_LO) {
      const a = Math.round((255 * (WHITE_HI - mn)) / (WHITE_HI - WHITE_LO));
      if (a < data[i + 3]) data[i + 3] = a;
    }
  }
  await sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
    animated: true,
    pageHeight: meta.pageHeight,
  })
    .webp({ quality: 80, effort: 5, ...webpOpts })
    .toFile(outPath);
}

async function main() {
  await mkdir(ASSETS, { recursive: true });
  await mkdir(PUBLIC, { recursive: true });

  // 1. Primary mascot — header + daily band (transparent, ~512px wide).
  // Emitted as BOTH .png (legacy) and .webp; the homepage imports the .webp,
  // which is ~3-4× smaller for the same art and the heaviest thing on first paint.
  await trimmed(SRC_BYTE)
    .resize({ width: 512, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(join(ASSETS, "byte-badger.png"));
  await trimmed(SRC_BYTE)
    .resize({ width: 512, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(join(ASSETS, "byte-badger.webp"));

  // 2. Games-area variant — beside the GAMES heading (transparent, ~512px wide).
  await trimmed(SRC_ARCADE)
    .resize({ width: 512, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(join(ASSETS, "arcade-badger.png"));
  await trimmed(SRC_ARCADE)
    .resize({ width: 512, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(join(ASSETS, "arcade-badger.webp"));

  // 2b. Time-of-day badger variants — shown in the home greeting box per
  // day-part. Same treatment as the primary mascot (trim padding, ~512px,
  // png + webp). The homepage imports the .webp.
  for (const name of TIME_BADGERS) {
    const src = join(SRC, `${name}.png`);
    if (!existsSync(src)) continue;
    await trimmed(src)
      .resize({ width: 512, withoutEnlargement: true })
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(join(ASSETS, `${name}.png`));
    await trimmed(src)
      .resize({ width: 512, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(ASSETS, `${name}.webp`));
  }

  // 2c. Badger Officer — the "members only" mascot on the locked game-submission
  // card (/contact). Same treatment as the other badgers (trim, ~512px, png +
  // webp); the card imports the .webp. Optional until the source art lands.
  let officerDone = false;
  if (existsSync(join(SRC, "badger-officer.png"))) {
    await trimmed(join(SRC, "badger-officer.png"))
      .resize({ width: 512, withoutEnlargement: true })
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(join(ASSETS, "badger-officer.png"));
    await trimmed(join(SRC, "badger-officer.png"))
      .resize({ width: 512, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(ASSETS, "badger-officer.webp"));
    officerDone = true;
  }

  // 2d. Water-cooler animation (Water Cooler page). The source is an animated
  // gif on a solid WHITE field with a soft grey contact-shadow; white would read
  // as a glaring box on the dark site. Key the white to real alpha and emit an
  // animated WebP (keeps the soft shadow, no 1-bit halo). Native size — small
  // art, never upscale. Optional until the source lands.
  let coolerDone = false;
  if (existsSync(join(SRC, "water-cooler.gif"))) {
    await whiteToAlphaWebp(join(SRC, "water-cooler.gif"), join(ASSETS, "water-cooler.webp"));
    coolerDone = true;
  }

  // 3. Favicon 32x32 (transparent).
  await trimmed(SRC_BYTE)
    .resize({ width: 32, height: 32, fit: "contain", background: TRANSPARENT })
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, "favicon-32.png"));

  // 4. Apple touch icon 180x180 (transparent).
  await trimmed(SRC_BYTE)
    .resize({ width: 180, height: 180, fit: "contain", background: TRANSPARENT })
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, "apple-touch-icon.png"));

  // 5. Social og:image 1200x630 — badger centered on the dark site background.
  // Composite onto an opaque (3-channel) canvas built in a separate pass, since
  // sharp reorders flatten ahead of composite within a single pipeline.
  const badger = await trimmed(SRC_BYTE)
    .resize({ height: 520, withoutEnlargement: true })
    .png()
    .toBuffer();
  const canvas = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: BG },
  })
    .png()
    .toBuffer();
  await sharp(canvas)
    .composite([{ input: badger, gravity: "center" }])
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(join(PUBLIC, "og-byte-badger.png"));

  // 6. Magic 8-Ball legendary tokens (transparent). The floppy + locked tile
  // are centered objects → trim their padding; the rays backdrop fills the
  // frame and fades out at the edges → resize without trimming so the burst
  // stays symmetric.
  await trimmed(join(SRC, "golden-floppy.png"))
    .resize({ width: 384, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(join(ASSETS, "golden-floppy.png"));

  await trimmed(join(SRC, "legend-locked.png"))
    .resize({ width: 384, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(join(ASSETS, "legend-locked.png"));

  await sharp(join(SRC, "legend-rays.png"))
    .resize({ width: 720, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 88 })
    .toFile(join(ASSETS, "legend-rays.png"));

  // Mythic relic token (iridescent disc) — optional until the source art lands.
  // Drop assets-src/mythic-disc.png and re-run to replace the placeholder.
  let mythicDone = false;
  if (existsSync(join(SRC, "mythic-disc.png"))) {
    await trimmed(join(SRC, "mythic-disc.png"))
      .resize({ width: 384, withoutEnlargement: true })
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(join(ASSETS, "mythic-disc.png"));
    mythicDone = true;
  }

  console.log("Assets generated:");
  console.log("  src/assets/byte-badger.png + .webp");
  console.log("  src/assets/arcade-badger.png + .webp");
  for (const name of TIME_BADGERS) console.log(`  src/assets/${name}.png + .webp`);
  if (officerDone) console.log("  src/assets/badger-officer.png + .webp");
  else console.log("  (skipped badger-officer — no assets-src/badger-officer.png yet)");
  if (coolerDone) console.log("  src/assets/water-cooler.webp (animated, white→alpha)");
  else console.log("  (skipped water-cooler — no assets-src/water-cooler.gif yet)");
  console.log("  src/assets/golden-floppy.png");
  console.log("  src/assets/legend-locked.png");
  console.log("  src/assets/legend-rays.png");
  if (mythicDone) console.log("  src/assets/mythic-disc.png");
  else console.log("  (skipped mythic-disc.png — no assets-src/mythic-disc.png yet)");
  console.log("  public/favicon-32.png");
  console.log("  public/apple-touch-icon.png");
  console.log("  public/og-byte-badger.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
