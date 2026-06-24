// Processes selected CC0 Kenney icons into optimized, web-ready WebP.
//
// The source files live under assets-src/kenney/ (board_game_icons/ and
// generic_items_white/colored/) as individual transparent PNGs with some padding.
// This trims that padding, normalizes each to a uniform width, and writes WebP into
// public/games/kenney/<set>/<name>.webp where the React features reference them.
//
// Unlike the modem virus, Kenney icons are individual files — no sheet-slicing.
// The manifest below is DECLARATIVE: future features extend it by adding lines.
// The generic_items source files are NUMBERED only (genericItem_color_NNN.png);
// the human-readable `name` here is the OUTPUT name, chosen by visually curating
// the set, so downstream code references "floppy"/"gamepad" not opaque numbers.
//
// Same conventions as process-modem-assets.js. Run with: npm run assets:kenney

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KENNEY = join(root, "assets-src", "kenney");
const BOARD = join(KENNEY, "board_game_icons");
const GENERIC = join(KENNEY, "generic_items_white", "colored");
const CARD_SRC = join(KENNEY, "cards");
const OUT = join(root, "public", "games", "kenney");

const TRIM = { threshold: 10 };
const WEBP = { quality: 88 };
const WIDTH = 128; // uniform icon width; features scale down further in CSS.

// Each job: { src (abs basename resolver below), set (out subdir), name (out basename) }.
// `from` selects the source pack so the manifest reads cleanly.
const g = (num, name) => ({ from: "generic", src: `genericItem_color_${num}.png`, name });
const b = (src, name) => ({ from: "board", src: `${src}.png`, name: name || src });

// --- cards/: the real 52 playing-card faces + a back (§2 Solitaire). ------------
// Source files are named cardClubsA / cardClubs10 / cardSpadesK …; output is named
// by the engine's canonical id "<suit><rank>" (S1 = Ace of spades … H13 = K hearts)
// so Solitaire.jsx references kImg("cards", card.id) directly. Cards are NOT
// trimmed — they must keep a uniform card rectangle.
const SUIT_DIR = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
const RANK_FILE = { 1: "A", 11: "J", 12: "Q", 13: "K" }; // others = the number
const c = (from, name) => ({ from: "card", src: from, name, trim: false });
const CARDS = [c("cardBack_blue2", "back")];
for (const [s, dir] of Object.entries(SUIT_DIR)) {
  for (let r = 1; r <= 13; r++) {
    const label = RANK_FILE[r] || String(r);
    CARDS.push(c(`card${dir}${label}`, `${s}${r}`));
  }
}

// --- dice/: die shapes + d6 faces for the Dice Roller overhaul (§4) -------------
const DICE = [
  b("d4"), b("d6"), b("d8"), b("d10"), b("d12"), b("d20"),
  b("dice_1"), b("dice_2"), b("dice_3"), b("dice_4"), b("dice_5"), b("dice_6"),
  b("dice_3D"), b("flip_head"), b("flip_tails"),
];

// --- memory/: ~16 distinct, recognizable retro/everyday objects (§3) ------------
// Numbers curated from a contact sheet of the 163 generic_items icons.
const MEMORY = [
  g("050", "laptop"), g("051", "monitor"), g("066", "mp3"), g("067", "phone"),
  g("068", "cassette"), g("072", "floppy"), g("073", "usb"), g("081", "gamepad"),
  g("083", "mic"), g("084", "headphones"), g("085", "cd"), g("086", "cursor"),
  g("147", "wheel"), g("155", "key"), g("157", "wallet"), g("162", "compass"),
];

// --- icons/: avatar-eligible set (§5) = named board icons + a few generic ones --
const ICONS = [
  b("chess_king"), b("chess_queen"), b("chess_rook"), b("chess_bishop"),
  b("chess_knight"), b("chess_pawn"), b("crown_a", "crown"), b("skull"),
  b("shield"), b("sword"), b("d20", "d20"), b("award"),
  b("suit_hearts", "heart"), b("suit_spades", "spade"), b("flask_full", "flask"),
  b("hourglass"), b("campfire"),
  g("081", "gamepad"), g("072", "floppy"), g("085", "cd"), g("067", "phone"),
  g("050", "laptop"), g("086", "cursor"),
];

const SETS = { cards: CARDS, dice: DICE, memory: MEMORY, icons: ICONS };

const CARD_WIDTH = 200; // card faces are larger + uniform (not trimmed).

function resolve(job) {
  if (job.from === "card") return join(CARD_SRC, `${job.src}.png`);
  return job.from === "generic" ? join(GENERIC, job.src) : join(BOARD, job.src);
}

async function processIcon(set, job) {
  const input = resolve(job);
  if (!existsSync(input)) {
    console.log(`  (skipped ${set}/${job.name} — no ${job.src})`);
    return false;
  }
  let pipe = sharp(input);
  if (job.trim !== false) pipe = pipe.trim(TRIM); // cards keep their full rectangle
  await pipe
    .resize({ width: job.from === "card" ? CARD_WIDTH : WIDTH, withoutEnlargement: true })
    .webp(WEBP)
    .toFile(join(OUT, set, `${job.name}.webp`));
  console.log(`  ${set}/${job.name}.webp`);
  return true;
}

async function main() {
  if (!existsSync(KENNEY)) {
    console.log(`(nothing to do — ${KENNEY} doesn't exist)`);
    return;
  }
  console.log("Kenney assets generated:");
  for (const [set, jobs] of Object.entries(SETS)) {
    await mkdir(join(OUT, set), { recursive: true });
    for (const job of jobs) await processIcon(set, job);
  }
  console.log("Done → public/games/kenney/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
