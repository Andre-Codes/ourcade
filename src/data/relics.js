/* ─────────────────────────────────────────────────────────────────────────
   RELICS — the Magic 8-Ball's collectible tier (legendary floppies + mythic
   discs), pulled into its own tiny module so BOTH the 8-ball's Hall of Legends
   AND the public profile can render them without importing the whole tool
   (which injects its own theme + audio). This is the single source of truth
   for the collectible definitions; MagicEightBall.jsx splices RELICS into its
   answer pool so they stay rollable.

   The 8-ball stores discoveries in private state (store.getDiscoveredLegendaries
   → { id, at }[]); a public COUNT is mirrored to profiles/{uid}.relicCount so
   others see "N relics discovered" without seeing which ones.
   ───────────────────────────────────────────────────────────────────────── */

import goldenFloppy from "../assets/golden-floppy.png";
import mythicDisc from "../assets/mythic-disc.png";
import legendLocked from "../assets/legend-locked.png";

export const RELIC_ASSETS = { goldenFloppy, mythicDisc, legendLocked };

// Rarest first (mythic relics, then legendaries). `id` is stable — the
// collection survives text edits. Each is also a rollable 8-ball answer.
export const RELICS = [
  // ── MYTHIC ── ~1 in 2000; unearthed cultural relics read off a screen.
  { id: "safe-to-turn-off", text: "It is now safe to turn off your computer.", tone: "yes", rarity: "mythic" },
  { id: "died-of-dysentery", text: "You have died of dysentery.", tone: "no", rarity: "mythic" },
  { id: "youve-got-mail", text: "You've got mail!", tone: "yes", rarity: "mythic" },
  // ── LEGENDARY ──
  { id: "golden-floppy", text: "You have discovered the golden floppy disk.", tone: "yes", rarity: "legendary" },
  { id: "prophecy", text: "The prophecy is fulfilled.", tone: "yes", rarity: "legendary" },
  { id: "legendary-drop", text: "A legendary drop has appeared.", tone: "yes", rarity: "legendary" },
  { id: "internet-owes-you", text: "The internet owes you one.", tone: "yes", rarity: "legendary" },
  { id: "main-character", text: "Congratulations, you're the main character today.", tone: "yes", rarity: "legendary" },
  { id: "final-pixel", text: "The final pixel has been found.", tone: "yes", rarity: "legendary" },
  { id: "developer-mode", text: "You unlocked developer mode.", tone: "yes", rarity: "legendary" },
  { id: "cheat-code", text: "The cheat code worked.", tone: "yes", rarity: "legendary" },
  { id: "peak-nostalgia", text: "You have achieved peak nostalgia.", tone: "yes", rarity: "legendary" },
  { id: "badger-salutes", text: "The badger salutes you.", tone: "yes", rarity: "legendary" },
];

export const RELIC_COUNT = RELICS.length;
const RELIC_BY_ID = new Map(RELICS.map((r) => [r.id, r]));
export const relicById = (id) => RELIC_BY_ID.get(id) || null;

// The disc art for a relic (mythic disc vs golden floppy), or the locked
// silhouette when undiscovered.
export const relicIcon = (relic, found) =>
  !found ? RELIC_ASSETS.legendLocked : relic?.rarity === "mythic" ? RELIC_ASSETS.mythicDisc : RELIC_ASSETS.goldenFloppy;
