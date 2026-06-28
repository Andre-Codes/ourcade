// Processes Creatives art into optimized, web-ready WebP — both the card/header
// thumbnails and the per-guide step images for /creatives/:id walkthroughs.
//
// Drop raw art into:
//   assets-src/creatives/<slug>.(png|jpg|jpeg|webp)            ← card/header thumb
//   assets-src/creatives/steps/<guide-id>/<step-slug>.(…)      ← one guide's steps
//
// This writes:
//   src/assets/creatives/<slug>.webp                           (640px — shown small)
//   src/assets/creatives/steps/<guide-id>/<step-slug>.webp     (1000px — full-width)
//
// <slug> matches an item's `image`; <guide-id> matches a guide item's `id`;
// <step-slug> matches a step's `image`. The component layer (creativeArt.js)
// resolves those slugs back to these files via import.meta.glob. Sibling of
// process-featured.js — same sharp→webp core, two passes instead of one.
//
// Run with: npm run assets:creatives

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets-src", "creatives");
const OUT = join(root, "src", "assets", "creatives");

const SOURCES = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const CARD_WIDTH = 640; // card/header thumb — shown small in the grid (like featured)
const STEP_WIDTH = 1000; // step image — viewed full-width while you draw alongside it

async function convert(srcFile, outFile, width) {
  await sharp(srcFile)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outFile);
}

async function main() {
  if (!existsSync(SRC)) {
    console.log(`(nothing to do — ${SRC} doesn't exist yet)`);
    console.log("Drop card art there named by slug, e.g. wizard-cat.png,");
    console.log("and step art under steps/<guide-id>/step-1.png, etc.");
    return;
  }
  await mkdir(OUT, { recursive: true });

  let count = 0;

  // Pass 1 — flat card/header thumbnails at the top level.
  const top = await readdir(SRC, { withFileTypes: true });
  const cardFiles = top.filter(
    (e) => e.isFile() && SOURCES.has(extname(e.name).toLowerCase())
  );
  if (cardFiles.length) console.log("Creative card art:");
  for (const e of cardFiles) {
    const slug = basename(e.name, extname(e.name));
    await convert(join(SRC, e.name), join(OUT, `${slug}.webp`), CARD_WIDTH);
    console.log(`  src/assets/creatives/${slug}.webp`);
    count++;
  }

  // Pass 2 — per-guide step folders under assets-src/creatives/steps/<guide-id>/.
  const STEPS_SRC = join(SRC, "steps");
  if (existsSync(STEPS_SRC)) {
    const dirs = (await readdir(STEPS_SRC, { withFileTypes: true })).filter((e) =>
      e.isDirectory()
    );
    if (dirs.length) console.log("Creative guide steps:");
    for (const dir of dirs) {
      const inDir = join(STEPS_SRC, dir.name);
      const outDir = join(OUT, "steps", dir.name);
      await mkdir(outDir, { recursive: true });
      const stepFiles = (await readdir(inDir)).filter((f) =>
        SOURCES.has(extname(f).toLowerCase())
      );
      for (const f of stepFiles) {
        const slug = basename(f, extname(f));
        await convert(join(inDir, f), join(outDir, `${slug}.webp`), STEP_WIDTH);
        console.log(`  src/assets/creatives/steps/${dir.name}/${slug}.webp`);
        count++;
      }
    }
  }

  if (!count) console.log(`(no source images found in ${SRC})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
