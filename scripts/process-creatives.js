// Processes Creatives art into optimized, web-ready WebP — card/header
// thumbnails, per-guide step images, and whole-plate images, ORGANIZED BY LANE.
//
// Everything for a lane lives under that lane's subfolder, so drawings, prints,
// builds, etc. don't pile into one directory. Drop raw art into:
//   assets-src/creatives/<lane>/<slug>.(png|jpg|jpeg|webp)              ← card/header thumb
//   assets-src/creatives/<lane>/steps/<guide-id>/<step-slug>.(…)        ← one guide's step images
//   assets-src/creatives/<lane>/plates/<plate-slug>.(…)                 ← whole-plate guide image
// where <lane> is "drawings" | "prints" | "builds" | … (see LANE_DIR in
// src/components/creativeArt.js — the data item's `lane` selects the folder).
//
// This writes the same tree under src/assets/creatives/<lane>/…:
//   src/assets/creatives/<lane>/<slug>.webp                   (640px — shown small)
//   src/assets/creatives/<lane>/steps/<guide-id>/<step>.webp  (1000px — full-width)
//   src/assets/creatives/<lane>/plates/<plate>.webp           (1000px — the reference plate)
//
// <slug> matches an item's `image`; <guide-id> matches a guide item's `id`;
// <step-slug> matches a step's `image`; <plate-slug> matches a guide's `plate`.
// The component layer (creativeArt.js) resolves those slugs back to these files
// via import.meta.glob, scoped by the item's lane.
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
const STEP_WIDTH = 1000; // step / plate image — viewed full-width while you draw alongside it

async function convert(srcFile, outFile, width) {
  await sharp(srcFile)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outFile);
}

// Convert every accepted image directly inside `inDir` → `outDir` (flat, one level).
async function convertFlat(inDir, outDir, width, label, log) {
  if (!existsSync(inDir)) return 0;
  const files = (await readdir(inDir, { withFileTypes: true })).filter(
    (e) => e.isFile() && SOURCES.has(extname(e.name).toLowerCase())
  );
  if (!files.length) return 0;
  await mkdir(outDir, { recursive: true });
  let n = 0;
  for (const e of files) {
    const slug = basename(e.name, extname(e.name));
    const out = join(outDir, `${slug}.webp`);
    await convert(join(inDir, e.name), out, width);
    log.push(`  ${label}${slug}.webp`);
    n++;
  }
  return n;
}

async function main() {
  if (!existsSync(SRC)) {
    console.log(`(nothing to do — ${SRC} doesn't exist yet)`);
    console.log("Drop art under a lane folder, e.g.:");
    console.log("  assets-src/creatives/drawings/wizard-cat.png            (card thumb)");
    console.log("  assets-src/creatives/drawings/steps/cr-draw-x/step-1.png (per-step)");
    console.log("  assets-src/creatives/drawings/plates/snail.png          (whole-plate)");
    return;
  }
  await mkdir(OUT, { recursive: true });

  const log = [];
  let count = 0;

  // One pass per lane subfolder (drawings/, prints/, builds/, …).
  const lanes = (await readdir(SRC, { withFileTypes: true })).filter((e) => e.isDirectory());
  for (const lane of lanes) {
    const laneSrc = join(SRC, lane.name);
    const laneOut = join(OUT, lane.name);

    // a) card/header thumbnails — flat files directly under the lane folder.
    count += await convertFlat(laneSrc, laneOut, CARD_WIDTH, `src/assets/creatives/${lane.name}/`, log);

    // b) whole-plate images — assets-src/creatives/<lane>/plates/<plate>.*
    count += await convertFlat(
      join(laneSrc, "plates"),
      join(laneOut, "plates"),
      STEP_WIDTH,
      `src/assets/creatives/${lane.name}/plates/`,
      log
    );

    // c) per-guide step images — assets-src/creatives/<lane>/steps/<guide-id>/<step>.*
    const stepsSrc = join(laneSrc, "steps");
    if (existsSync(stepsSrc)) {
      const guides = (await readdir(stepsSrc, { withFileTypes: true })).filter((e) => e.isDirectory());
      for (const g of guides) {
        count += await convertFlat(
          join(stepsSrc, g.name),
          join(laneOut, "steps", g.name),
          STEP_WIDTH,
          `src/assets/creatives/${lane.name}/steps/${g.name}/`,
          log
        );
      }
    }
  }

  if (count) {
    console.log("Creative art generated:");
    for (const line of log) console.log(line);
  } else {
    console.log(`(no source images found under ${SRC}/<lane>/)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
