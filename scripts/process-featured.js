// Processes the Featured Game key art into optimized, web-ready WebP.
//
// Drop raw key art / screenshots into assets-src/featured/ named by slug
// (e.g. assets-src/featured/caves-of-qud.jpg — png/jpg/jpeg/webp all fine).
// This resizes and compresses each into src/assets/featured/<slug>.webp, which
// the homepage Featured Game card imports. Game art is photographic, so unlike
// the mascots there's no transparent-padding trim — it's resized full-frame.
//
// Run with: npm run assets:featured

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets-src", "featured");
const OUT = join(root, "src", "assets", "featured");

// Card art is shown ~140px wide; 640px covers it comfortably at 2× DPR.
const WIDTH = 640;
const SOURCES = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function main() {
  if (!existsSync(SRC)) {
    console.log(`(nothing to do — ${SRC} doesn't exist yet)`);
    console.log("Drop game art there named by slug, e.g. caves-of-qud.jpg");
    return;
  }
  await mkdir(OUT, { recursive: true });

  const files = (await readdir(SRC)).filter((f) =>
    SOURCES.has(extname(f).toLowerCase()),
  );
  if (!files.length) {
    console.log(`(no source images in ${SRC})`);
    return;
  }

  console.log("Featured art generated:");
  for (const file of files) {
    const slug = basename(file, extname(file));
    const outFile = join(OUT, `${slug}.webp`);
    await sharp(join(SRC, file))
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outFile);
    console.log(`  src/assets/featured/${slug}.webp`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
