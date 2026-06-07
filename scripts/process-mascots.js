// Processes the raw Byte Badger mascot PNGs into optimized, web-ready assets.
//
// The source files (repo root) are large (1254x1254, ~MB) with transparent
// padding. This trims that padding, resizes, and compresses into web-ready
// copies, plus generates favicon / apple-touch / og:image variants.
//
// Run with: npm run assets:mascots

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_BYTE = join(root, "byte_badger.png");
const SRC_ARCADE = join(root, "arcade_badger.png");
const ASSETS = join(root, "src", "assets");
const PUBLIC = join(root, "public");

// Dark site background — used to flatten the square og:image canvas.
const BG = { r: 4, g: 5, b: 11, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Trim the transparent padding off a source PNG.
const trimmed = (src) => sharp(src).trim({ threshold: 10 });

async function main() {
  await mkdir(ASSETS, { recursive: true });
  await mkdir(PUBLIC, { recursive: true });

  // 1. Primary mascot — header + daily band (transparent, ~512px wide).
  await trimmed(SRC_BYTE)
    .resize({ width: 512, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(join(ASSETS, "byte-badger.png"));

  // 2. Games-area variant — beside the GAMES heading (transparent, ~512px wide).
  await trimmed(SRC_ARCADE)
    .resize({ width: 512, withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(join(ASSETS, "arcade-badger.png"));

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

  console.log("Mascot assets generated:");
  console.log("  src/assets/byte-badger.png");
  console.log("  src/assets/arcade-badger.png");
  console.log("  public/favicon-32.png");
  console.log("  public/apple-touch-icon.png");
  console.log("  public/og-byte-badger.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
