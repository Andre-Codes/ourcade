// Shared access to the CC0 Kenney WebP icons emitted by scripts/process-kenney.js
// into public/games/kenney/<set>/<name>.webp. Keeping URLs + the avatar set in one
// place so features (Dice Roller, Memory Match, icon avatars) stay in sync.
import { createElement } from "react";

// URL for a prepped Kenney sprite. Mirrors ModemDefender's sprite()/ui() helpers:
// resolve off BASE_URL so it works under the Pages base ("./").
export const kImg = (set, name) =>
  (import.meta.env.BASE_URL || "/") + "games/kenney/" + set + "/" + name + ".webp";

// Playing-card face URL. `id` is the engine's "<suit><rank>" id (e.g. "H1" = Ace
// of hearts, "S13" = King of spades); kImg("cards","back") is the face-down back.
export const cardImg = (id) => kImg("cards", id);
export const cardBackImg = () => kImg("cards", "back");

// Poker-chip URL by color (the casino cabinets: Video Poker / Blackjack / Chip
// Panic). `color` is one of CHIP_COLORS below → .../chips/<color>.webp.
export const CHIP_COLORS = ["white", "red", "blue", "green", "black"];
// Canonical bet-chip color order, low → high denomination. Every casino cabinet
// (Blackjack / Video Poker / High Card Bust) maps its denominations to colors by
// ascending value through this list so the chips read consistently across games.
export const CHIP_ORDER = ["blue", "red", "green", "black"];
export const chipImg = (color) => kImg("chips", color);

// Memory Match pool — the curated retro/everyday objects (must exist in /memory).
export const MEMORY_ICONS = [
  "laptop", "monitor", "mp3", "phone", "cassette", "floppy", "usb", "gamepad",
  "mic", "headphones", "cd", "cursor", "wheel", "key", "wallet", "compass",
];

// Avatar-eligible Kenney icons (must exist in /icons). Stored on a profile as a
// sentinel string "kenney:<name>" so it coexists with the emoji AVATARS array.
export const AVATAR_ICONS = [
  "chess_king", "chess_queen", "chess_rook", "chess_bishop", "chess_knight",
  "chess_pawn", "crown", "skull", "shield", "sword", "d20", "award",
  "heart", "spade", "flask", "hourglass", "campfire",
  "gamepad", "floppy", "cd", "phone", "laptop", "cursor",
].map((name) => "kenney:" + name);

const ICON_PREFIX = "kenney:";

// Is this avatar value an icon (vs a plain emoji string)?
export const isIconAvatar = (a) =>
  typeof a === "string" && a.startsWith(ICON_PREFIX);

// URL for an icon-avatar value ("kenney:skull" → .../icons/skull.webp).
export const avatarIconUrl = (a) =>
  isIconAvatar(a) ? kImg("icons", a.slice(ICON_PREFIX.length)) : null;

// Shared avatar renderer used at every avatar render site. An emoji renders as
// text; a "kenney:" value renders as an <img>. Backward-compatible: existing
// emoji avatars are untouched. `size` controls both the icon box and emoji size.
export function renderAvatar(avatar, { size = 24, className, alt = "" } = {}) {
  const value = avatar || "🕹️";
  if (isIconAvatar(value)) {
    return createElement("img", {
      src: avatarIconUrl(value),
      alt,
      className,
      width: size,
      height: size,
      style: { width: size, height: size, objectFit: "contain", display: "block" },
    });
  }
  return createElement(
    "span",
    { className, style: { fontSize: size, lineHeight: 1 }, "aria-hidden": alt ? undefined : "true" },
    value
  );
}
