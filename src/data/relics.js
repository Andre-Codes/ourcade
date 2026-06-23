/* ─────────────────────────────────────────────────────────────────────────
   RELICS — Ourcade's site-wide collectible system.

   A relic is a REWARD OBJECT of a rarity TIER, independent of where it was
   found. Two axes:
     • rarity → which art + how prestigious:
         "legendary" → golden floppy disk (common-ish)
         "mythic"    → CD / disc (rarer)
         "crystal"   → crystal cartridge (rarest; the top tier)
     • source  → where it can be found (lore/flavor only, NOT the reward):
         "eightball" → rolled on the Magic 8-Ball
         "relic-run" → unearthed as an easter egg in the Daily Relic Run
         (future sources just add another value here)

   So any feature can grant a relic of a tier matched to how hard/rare its
   easter egg is. This module is the single source of truth for every relic
   definition; consumers import ALL_RELICS to resolve any id, while the 8-Ball
   imports only the eightball-sourced RELICS to keep them rollable as answers.

   Discoveries are stored in private state (store.getDiscoveredRelics →
   { id, at }[], legacy key "eightball:legends"); a public COUNT is mirrored to
   profiles/{uid}.relicCount so others see "N relics found" without the details.
   ───────────────────────────────────────────────────────────────────────── */

import goldenFloppy from "../assets/golden-floppy.png";
import mythicDisc from "../assets/mythic-disc.png";
import legendLocked from "../assets/legend-locked.png";
import crystalCartridge from "../assets/crystal-cartridge.png";

export const RELIC_ASSETS = { goldenFloppy, mythicDisc, legendLocked, crystalCartridge };

// Every relic granted by the Magic 8-Ball (also rollable as 8-ball answers).
// Rarest first (mythic, then legendary). `id` is stable — the collection
// survives text edits.
export const RELICS = [
  // ── MYTHIC (CD / disc) ── ~1 in 2000; unearthed cultural relics read off a screen.
  { id: "safe-to-turn-off", text: "It is now safe to turn off your computer.", tone: "yes", rarity: "mythic", source: "eightball" },
  { id: "died-of-dysentery", text: "You have died of dysentery.", tone: "no", rarity: "mythic", source: "eightball" },
  { id: "youve-got-mail", text: "You've got mail!", tone: "yes", rarity: "mythic", source: "eightball" },
  // ── LEGENDARY (golden floppy) ──
  { id: "golden-floppy", text: "You have discovered the golden floppy disk.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "prophecy", text: "The prophecy is fulfilled.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "legendary-drop", text: "A legendary drop has appeared.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "internet-owes-you", text: "The internet owes you one.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "main-character", text: "Congratulations, you're the main character today.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "final-pixel", text: "The final pixel has been found.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "developer-mode", text: "You unlocked developer mode.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "cheat-code", text: "The cheat code worked.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "peak-nostalgia", text: "You have achieved peak nostalgia.", tone: "yes", rarity: "legendary", source: "eightball" },
  { id: "badger-salutes", text: "The badger salutes you.", tone: "yes", rarity: "legendary", source: "eightball" },
];

// Relics unearthed as easter eggs in the Daily Relic Run (NOT 8-ball answers).
// Tier reflects how hidden/hard the egg is: obvious finds → floppy, sneakier
// ones → CD, a single very rare one → crystal. `text` is the line shown in the
// profile's relic grid. Wired to nodes via the `relic` field in relicNodes.js.
export const RELIC_RUN_RELICS = [
  { id: "geo-under-construction", text: "A still-blinking UNDER CONSTRUCTION sign.", rarity: "legendary", source: "relic-run" },
  { id: "broken-button-88x31", text: "A cracked 88×31 'Best Viewed In' button.", rarity: "legendary", source: "relic-run" },
  { id: "guestbook-signature", text: "A signature left in a forgotten guestbook.", rarity: "legendary", source: "relic-run" },
  { id: "webring-token", text: "An intact webring token, still warm.", rarity: "mythic", source: "relic-run" },
  { id: "first-pixel", text: "The very first pixel ever lit on the old web.", rarity: "crystal", source: "relic-run" },
  // Newer eggs, hidden as a disguised word in each node's fake-wiki article.
  { id: "winamp-skin-wsz", text: "A still-warm Winamp skin (.wsz).", rarity: "legendary", source: "relic-run" },
  { id: "preserved-swf", text: "A perfectly preserved .swf, still playable.", rarity: "legendary", source: "relic-run" },
  { id: "unbreakable-brick", text: "The indestructible brick that outlived its century.", rarity: "legendary", source: "relic-run" },
  { id: "first-ripped-mp3", text: "The first MP3 anyone ever ripped.", rarity: "mythic", source: "relic-run" },
];

// Relics granted through the Nopia phone. Texting BYTE BADGER the secret
// passphrase ("Wassup") earns the only one so far — a mythic for finding the
// den. `source: "phone"` is lore/flavor only, like the others.
export const PHONE_RELICS = [
  { id: "byte-badger-secret", text: "Byte Badger let you into the den.", rarity: "mythic", source: "phone" },
];

// Relics granted through Badger's walkman. The first time anyone clicks the
// hidden discman in the header mascot's hand and spins up the mix, they earn
// this mythic. `source: "walkman"` is lore/flavor only, like the others.
export const WALKMAN_RELICS = [
  { id: "badger-mixtape", text: "Badger pressed play on his secret mixtape.", rarity: "mythic", source: "walkman" },
];

// Every relic in the game, from every source. Resolve any discovered id here.
export const ALL_RELICS = [...RELICS, ...RELIC_RUN_RELICS, ...PHONE_RELICS, ...WALKMAN_RELICS];

export const RELIC_COUNT = ALL_RELICS.length;
const RELIC_BY_ID = new Map(ALL_RELICS.map((r) => [r.id, r]));
export const relicById = (id) => RELIC_BY_ID.get(id) || null;

// The art for a relic by tier, or the locked silhouette when undiscovered.
export const relicIcon = (relic, found) => {
  if (!found) return RELIC_ASSETS.legendLocked;
  if (relic?.rarity === "crystal") return RELIC_ASSETS.crystalCartridge;
  if (relic?.rarity === "mythic") return RELIC_ASSETS.mythicDisc;
  return RELIC_ASSETS.goldenFloppy;
};
