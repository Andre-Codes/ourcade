// Converts the CC0 Kenney SFX (OGG) into web-ready MP3 so they play everywhere,
// including Safari/iOS which don't support OGG. Sources live in
// assets-src/kenney/sfx/*.ogg; output goes to public/games/kenney/sfx/*.mp3 where
// the games reference them via src/lib/sfx.js.
//
// Uses the bundled ffmpeg-static binary — no system ffmpeg needed.
// Same conventions as process-kenney.js. Run with: npm run assets:sfx

import ffmpegPath from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "assets-src", "kenney", "sfx");
const OUT = join(root, "public", "games", "kenney", "sfx");

async function main() {
  if (!existsSync(SRC)) {
    console.log(`(nothing to do — ${SRC} doesn't exist)`);
    return;
  }
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    console.error("ffmpeg-static binary not found — run `npm install`.");
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  const files = (await readdir(SRC)).filter((f) => f.toLowerCase().endsWith(".ogg"));
  if (!files.length) {
    console.log("(no .ogg files to convert)");
    return;
  }

  console.log("Kenney SFX converted:");
  for (const file of files) {
    const name = file.replace(/\.ogg$/i, "");
    const input = join(SRC, file);
    const output = join(OUT, `${name}.mp3`);
    // -q:a 4 ≈ ~165kbps VBR — plenty for short SFX, keeps files tiny.
    const res = spawnSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-q:a", "4", output], { stdio: "inherit" });
    if (res.status !== 0) {
      console.error(`  FAILED ${name}.mp3 (exit ${res.status})`);
      process.exit(1);
    }
    console.log(`  sfx/${name}.mp3`);
  }
  console.log("Done → public/games/kenney/sfx/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
