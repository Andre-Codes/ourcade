// Processes page-header icons (the cheesy GeoCities-style clip-art that stands
// in for an emoji at the top of a page) into optimized, transparent WebP.
//
// Drop raw art into assets-src/page-icons/ named by slug
// (e.g. assets-src/page-icons/vault.png — png/webp; transparency is kept).
// This resizes and compresses each into src/assets/page-icons/<slug>.webp,
// which the page header imports. Unlike the photographic Featured art, these
// keep their alpha channel so they sit on the page background.
//
// Run with: npm run assets:page-icons

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets-src", "page-icons");
const OUT = join(root, "src", "assets", "page-icons");

// Shown as a ~96px masthead graphic; 256px covers it at 2× DPR with headroom.
const WIDTH = 256;
const SOURCES = new Set([".png", ".webp"]);

async function main() {
  if (!existsSync(SRC)) {
    console.log(`(nothing to do — ${SRC} doesn't exist yet)`);
    console.log("Drop page icons there named by slug, e.g. vault.png");
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

  console.log("Page icons generated:");
  for (const file of files) {
    const slug = basename(file, extname(file));
    const outFile = join(OUT, `${slug}.webp`);
    await sharp(join(SRC, file))
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outFile);
    console.log(`  src/assets/page-icons/${slug}.webp`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
