/* DICTIONARY DUNGEON — first-word titles & starting secrets (node-pure).

   A cosmetic "character-creation" layer: the first few valid words of a run can
   quietly earn the player an RPG TITLE, an OMEN, or a BADGE. Flavor only — never
   hearts, coins, damage, or relics (leaderboard-safe, per the design doc).

   Three layers, evaluated in logic.js on each accepted word:
     1. First valid word → RPG title (exact map lookup).
     2. First valid word → omen (exact word OR structural predicate).
     3. First 2–4 valid words → badge (exact sequence OR structural sequence).

   No React, no DOM: shared by the cabinet and (harmlessly) the validator. All
   selection is deterministic — a map lookup / predicate on the played word(s),
   no randomness — so the daily reads the same for everyone. */

import { rarityTier, commonRank } from "./dict.js";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

// ── Layer 1: first-word RPG titles ──────────────────────────────────────────
// Exact match on the player's FIRST valid word (UPPERCASE). A generous subset
// of the design doc's tables — the fantasy words players are most likely to
// open with, across classes, races, monsters, royalty, scholars, and pirates.
export const FIRST_WORD_TITLES = {
  // Classes
  WIZARD: "Ink Wizard", MAGE: "Page Mage", SORCERER: "Spellbound Sorcerer",
  WARLOCK: "Glyph Warlock", WITCH: "Vowel Witch", CLERIC: "Page Cleric",
  PRIEST: "Archive Priest", PALADIN: "Oath Paladin", DRUID: "Root Druid",
  SHAMAN: "Rune Shaman", NECROMANCER: "Deadword Necromancer",
  ENCHANTER: "Lexicon Enchanter", ALCHEMIST: "Syllable Alchemist",
  ORACLE: "Oracle of Ink", SEER: "Candlelit Seer", BARD: "Dungeon Bard",
  MINSTREL: "Minstrel of Margins", ROGUE: "Letter Rogue", THIEF: "Quiet Thief",
  ASSASSIN: "Silent Syllable", NINJA: "Shadow Scribe", RANGER: "Lexicon Ranger",
  HUNTER: "Word Hunter", ARCHER: "Quill Archer", SCOUT: "Mapless Scout",
  KNIGHT: "Vowel Knight", WARRIOR: "Word Warrior", FIGHTER: "Ink Fighter",
  BARBARIAN: "Margin Barbarian", BERSERKER: "Berserker of Books",
  MONK: "Silent Monk", SAMURAI: "Blade Scribe", GLADIATOR: "Arena Grammarian",
  MERCENARY: "Coinblade Mercenary", SOLDIER: "Sentence Soldier",
  DUELIST: "Duelist of Definitions", TEMPLAR: "Templar of Text",
  WARDEN: "Door Warden", SENTINEL: "Silent Sentinel", GUARDIAN: "Gate Guardian",
  CHAMPION: "Champion of Chapters", HERO: "Firstword Hero",

  // Fantasy races
  ELF: "Glossary Elf", DWARF: "Stone Dwarf", ORC: "Word Orc",
  GOBLIN: "Footnote Goblin", TROLL: "Bridge Troll", GNOME: "Index Gnome",
  HALFLING: "Hearth Halfling", HOBBIT: "Pantry Pilgrim", FAIRY: "Marginal Fairy",
  SPRITE: "Ink Sprite", PIXIE: "Punctuation Pixie", GIANT: "Tower Giant",
  OGRE: "Blunt Ogre", HUMAN: "Plainspoken Human", NYMPH: "Willow Nymph",
  SATYR: "Laughing Satyr", DRYAD: "Rootbound Dryad", SIREN: "Singing Siren",
  CENTAUR: "Centaur of Stanzas", KOBOLD: "Candle Kobold", IMP: "Margin Imp",
  GREMLIN: "Gremlin of Grammar", MERMAID: "Tidebound Mermaid",

  // Monsters & undead
  DRAGON: "Dictionary Dragon", DEMON: "Red Ink Demon", ANGEL: "Golden Gloss Angel",
  DEVIL: "Contract Devil", VAMPIRE: "Redacted Vampire", WEREWOLF: "Moonlit Werewolf",
  SKELETON: "Bone Scribe", ZOMBIE: "Dead Letter", GHOST: "Whispering Ghost",
  LICH: "Unabridged Lich", GOLEM: "Stonebound Golem", PHOENIX: "Ashword Phoenix",
  HYDRA: "Many-Headed Reader", MINOTAUR: "Maze Minotaur", CYCLOPS: "One-Eyed Editor",
  CHIMERA: "Patchwork Chimera", GARGOYLE: "Gargoyle of Grammar",
  WRAITH: "Hollow Wraith", SHADE: "Margin Shade", MUMMY: "Wrapped Mummy",
  SLIME: "Greenroom Slime", MIMIC: "Chest Mimic", KRAKEN: "Kraken of Clauses",
  HARPY: "Harpy of Hyphens", WYVERN: "Wyvern of Words", SPHINX: "Riddle Sphinx",
  BASILISK: "Basilisk of Blanks",

  // Royalty & nobility
  KING: "Lexicon King", QUEEN: "Marginal Queen", PRINCE: "Page Prince",
  PRINCESS: "Lantern Princess", EMPEROR: "Emperor of Entries", EMPRESS: "Empress of Ink",
  LORD: "Lord of Letters", LADY: "Lady of Lines", BARON: "Baron of Banned Letters",
  DUKE: "Duke of Diction", DUCHESS: "Duchess of Definitions", COUNT: "Count of Clauses",
  EARL: "Earl of Echoes", REGENT: "Regent of Runes", NOBLE: "Noble of Names",
  SQUIRE: "Squire of Scrolls", JESTER: "Jester of Jargon", FOOL: "Blessed Fool",

  // Scholars & dungeon-adjacent
  SAGE: "Dusty Sage", SCHOLAR: "Candle Scholar", SCRIBE: "Dungeon Scribe",
  LIBRARIAN: "Forbidden Librarian", EXPLORER: "Crypt Explorer",
  PILGRIM: "Paper Pilgrim", WANDERER: "Wandering Word", NOMAD: "Nomad of Names",
  HERMIT: "Hermit of Footnotes", MASTER: "Master of Margins", KEEPER: "Keeper of Keys",
  CURATOR: "Curator of Curses", EDITOR: "Editor of Echoes", READER: "Reader of Runes",
  AUTHOR: "Author of Omens", POET: "Poet of Portals", PROPHET: "Prophet of Pages",
  HERALD: "Herald of Hidden Doors",

  // Adventurers & pirates
  PIRATE: "Plunderquill Pirate", CAPTAIN: "Captain of Clauses", SAILOR: "Sailor of Scrolls",
  RAIDER: "Raider of Runes", BANDIT: "Bandit of Blanks", OUTLAW: "Outlaw of Ink",
  VAGABOND: "Vagabond of Vowels", TRAVELER: "Traveler of Text", SEEKER: "Seeker of Syllables",
  DELVER: "Dungeon Delver", CORSAIR: "Corsair of Commas", BUCCANEER: "Buccaneer of Books",
};

// ── Layer 2: first-word omens ───────────────────────────────────────────────
// Exact single-word omens (funny/thematic). { name, text }.
const EXACT_OMENS = {
  ZORK: ["Old Lantern Lit", "The dungeon briefly forgets it is modern."],
  HELLO: ["The Dungeon Answers", "Something behind the wall says hello back."],
  PLEASE: ["Polite Delver", "The door appreciates your manners. Suspiciously."],
  THANKS: ["Grateful Guest", "The dungeon accepts gratitude as legal tender."],
  DOOM: ["Bad Omen", "The torches lean away from you."],
  DEATH: ["Cheerful Start", "The dungeon underlines your optimism."],
  CURSE: ["Marked in Red", "Your name appears briefly in the margin."],
  GOLD: ["Treasure-Sniffer", "A coin coughs somewhere in the dark."],
  COIN: ["Pocket Prophet", "The dungeon suspects you are here for the economy."],
  CHEST: ["Box Thinker", "Every chest in the dungeon feels judged."],
  BOOK: ["Book-Touched", "The shelves rustle like they recognize you."],
  PAGE: ["Pagebound", "One loose page follows you for a while."],
  INK: ["Inkmarked", "Your word stains the air before fading."],
  QUILL: ["Quillbearer", "An invisible pen scratches your name into the run."],
  DOOR: ["Knockless Entry", "The first door takes this personally."],
  KEY: ["Keydreamer", "A keyhole blinks open, then pretends it did not."],
  DUNGEON: ["Too Direct", "The dungeon seems flattered by the mention."],
  MONSTER: ["Creature Caller", "Something with too many syllables notices you."],
  // "bad idea" omens
  TRAP: ["Trap Caller", "A trap somewhere takes attendance."],
  BOSS: ["Ambitious", "The dungeon admires your impatience."],
  LOOT: ["Priorities", "The treasure chest nods approvingly."],
  RUN: ["Reasonable Instinct", "The exit politely pretends not to hear."],
  HELP: ["Help Requested", "The dungeon marks your request as pending."],
  EASY: ["Famous Last Word", "The dungeon writes that down."],
  HARD: ["Tempting Fate", "The walls become slightly more smug."],
  QUIT: ["Early Honesty", "The dungeon appreciates clear communication."],
  DEAD: ["Premature Epitaph", "Your tombstone briefly loads in draft mode."],
};

function isPalindrome(w) {
  return w.length >= 3 && w === w.split("").reverse().join("");
}
function countVowels(w) {
  let n = 0;
  for (const ch of w) if (VOWELS.has(ch)) n++;
  return n;
}
function hasDouble(w) {
  for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return true;
  return false;
}

// Structural omens (predicate-based; first match wins, roughly rarest → plainest).
// Extracted to a shared list so BOTH firstWordOmen and the ALL_OMENS catalog draw
// from one source (no drift). `hint` is a vague nudge for the locked-collection UI
// — enough to intrigue, never a solution. `test(w, tier)` gets the UPPERCASE word.
const STRUCTURAL_OMENS = [
  { id: "struct:palindrome", name: "Mirror-Touched", text: "The room folds in half and matches itself.",
    hint: "Open with a word that reads the same backward.", test: (w) => isPalindrome(w) },
  { id: "struct:novowel", name: "Silent Initiate", text: "The vowels go quiet in your presence.",
    hint: "Open with a word that has no vowels at all.", test: (w) => countVowels(w) === 0 },
  { id: "struct:goblin", name: "Goblin-Approved", text: 'A goblin writes "real word??" beside your name.',
    hint: "Open with a strange, rare word full of odd letters.",
    test: (w, tier) => (tier === "goblin" || tier === "obscure") && /[XZQJ]/.test(w) && commonRank(w) == null },
  { id: "struct:long8", name: "Longblade Opening", text: "Your first word arrives carrying its own shadow.",
    hint: "Open with a long word (8+ letters).", test: (w) => w.length >= 8 },
  { id: "struct:three", name: "Small Key", text: "A tiny word opens a tiny lock.",
    hint: "Open with a very short word (exactly 3 letters).", test: (w) => w.length === 3 },
  { id: "struct:allvowels", name: "Vowel Feast", text: "The Vowel Crypt, somewhere far below, wakes up hungry.",
    hint: "Open with a word containing every vowel: A, E, I, O, U.", test: (w) => [..."AEIOU"].every((v) => w.includes(v)) },
  { id: "struct:double", name: "Echo Mark", text: "One letter repeats itself from the rafters.",
    hint: "Open with a word that has a double letter.", test: (w) => hasDouble(w) },
  { id: "struct:closedloop", name: "Closed Loop", text: "The dungeon notices your word came back home.",
    hint: "Open with a word that starts and ends with the same letter.", test: (w) => w[0] === w[w.length - 1] },
];

// Returns { name, text } for the first matching omen, or null. Exact-word omens
// win over structural ones. `word` is UPPERCASE and already validated.
export function firstWordOmen(word) {
  const w = (word || "").toUpperCase();
  if (EXACT_OMENS[w]) {
    const [name, text] = EXACT_OMENS[w];
    return { name, text };
  }
  const tier = rarityTier(w);
  for (const o of STRUCTURAL_OMENS) {
    if (o.test(w, tier)) return { name: o.name, text: o.text };
  }
  return null;
}

// ── Layer 3: sequence badges ────────────────────────────────────────────────
// Exact word sequences (checked as a prefix of the run's word list). Longest
// sequences first so a 4-word party wins over its 2-word prefix.
const EXACT_SEQUENCES = [
  // Four-word party secrets
  { seq: ["FIGHTER", "THIEF", "CLERIC", "WIZARD"], name: "Full Party Assembled", text: "The dungeon recognizes an old formation." },
  { seq: ["WARRIOR", "ROGUE", "PRIEST", "MAGE"], name: "Balanced Party", text: "Four shadows join yours, briefly." },
  { seq: ["KNIGHT", "RANGER", "CLERIC", "WITCH"], name: "Strange Fellowship", text: "The torches argue about who leads." },
  { seq: ["ELF", "DWARF", "ORC", "HUMAN"], name: "Awkward Alliance", text: "The dungeon prepares extra chairs." },
  { seq: ["GOBLIN", "TROLL", "OGRE", "GIANT"], name: "Monster March", text: "The floorboards complain about escalation." },
  { seq: ["KING", "QUEEN", "PRINCE", "PRINCESS"], name: "Royal Court", text: "A tiny crown appears over the room title." },
  { seq: ["LOCK", "KEY", "DOOR", "OPEN"], name: "Dungeon Logic", text: "The door hates that this worked in order." },
  { seq: ["FIRE", "WATER", "EARTH", "AIR"], name: "Elemental Order", text: "Four old symbols turn once in the dark." },
  { seq: ["SUN", "MOON", "STAR", "VOID"], name: "Skyfall Omen", text: "The ceiling goes deeper than expected." },
  // Three-word secrets
  { seq: ["RAT", "BAT", "CAT"], name: "Tiny Bestiary", text: "The dungeon starts with the small problems." },
  { seq: ["SUN", "MOON", "STAR"], name: "Sky Sequence", text: "The ceiling briefly remembers being outside." },
  { seq: ["ONE", "TWO", "THREE"], name: "Counting Charm", text: "The dungeon can count. This is bad news." },
  { seq: ["ASH", "BONE", "DUST"], name: "Grave Grammar", text: "The floor becomes very interested in your boots." },
  { seq: ["BOOK", "INK", "QUILL"], name: "Scribe's Kit", text: "A blank page follows you like a familiar." },
  { seq: ["SWORD", "SPELL", "SHIELD"], name: "Balanced Adventurer", text: "Martial, magical, and mildly overprepared." },
  { seq: ["GOLD", "GEM", "CROWN"], name: "Loot Brain", text: "The treasure chest pretends not to notice." },
  // Two-word secrets
  { seq: ["SWORD", "SHIELD"], name: "Armed Adventurer", text: "The dungeon recognizes a classic loadout." },
  { seq: ["BOW", "ARROW"], name: "Straight Shot", text: "A painted arrow on the wall points deeper." },
  { seq: ["STAFF", "SPELL"], name: "Proper Caster", text: "The spellbook nods approvingly." },
  { seq: ["LOCK", "KEY"], name: "Obvious Solution", text: "The door hates how effective that was." },
  { seq: ["LIVE", "EVIL"], name: "Mirror Knock", text: "A mirror opens one eye." },
  { seq: ["ANGEL", "DEMON"], name: "Balanced Ledger", text: "The dungeon records both sides." },
  { seq: ["SUN", "MOON"], name: "Day-Night Pact", text: "A cold light crosses the floor." },
  { seq: ["FIRE", "ICE"], name: "Element Split", text: "The torches freeze for one second." },
  { seq: ["KING", "QUEEN"], name: "Royal Pair", text: "Two crowns appear in the dust." },
  { seq: ["DARK", "LIGHT"], name: "Lantern Logic", text: "The shadows make room." },
  { seq: ["LOST", "FOUND"], name: "Mapless Miracle", text: "A blank map draws one confident line." },
];

// Structural sequence badges, evaluated exactly at the 3rd word. Extracted to a
// shared list so BOTH sequenceBadge and the ALL_BADGES catalog draw from one
// source. `test(words, lens, initials)` gets the 3 UPPERCASE words + derived
// arrays. First match wins (order preserved from the original inline checks).
const STRUCTURAL_BADGES = [
  { id: "struct:growing", name: "Growing Incantation", text: "Each word stands taller than the last.",
    hint: "Play three words, each longer than the one before.",
    test: (_w, lens) => lens[0] < lens[1] && lens[1] < lens[2] },
  { id: "struct:shrinking", name: "Shrinking Spell", text: "Your words vanish down a staircase of size.",
    hint: "Play three words, each shorter than the one before.",
    test: (_w, lens) => lens[0] > lens[1] && lens[1] > lens[2] },
  { id: "struct:measured", name: "Measured Pace", text: "The dungeon respects your symmetry.",
    hint: "Play three words that are all the same length (five letters).",
    test: (_w, lens) => lens.every((l) => l === 5) },
  { id: "struct:samestart", name: "Rune Repeater", text: "The same initial scratches itself into the wall three times.",
    hint: "Play three words that all start with the same letter.",
    test: (_w, _l, initials) => initials.every((x) => x === initials[0]) },
  { id: "struct:ordered", name: "Ordered Steps", text: "The alphabet accepts your tribute.",
    hint: "Play three words whose first letters run in sequence (like B, C, D).",
    test: (_w, _l, initials) =>
      initials[1].charCodeAt(0) === initials[0].charCodeAt(0) + 1 &&
      initials[2].charCodeAt(0) === initials[1].charCodeAt(0) + 1 },
  { id: "struct:goblin", name: "Goblin Fluency", text: 'The goblins whisper: "one of us."',
    hint: "Open a run with three strange, rare words in a row.",
    test: (words) => words.every((w) => rarityTier(w) === "obscure" || rarityTier(w) === "goblin") },
];

// The uppercase word strings played so far, in order.
function playedWords(state) {
  return (state.words || []).map((x) => (typeof x === "string" ? x : x.word));
}

// Return a { id, name, text } badge newly earned on THIS accepted word, or null.
// Checks exact sequences that END on the current word, then structural
// sequences at the 3-word mark. `id` dedupes so a badge is only awarded once.
export function sequenceBadge(state) {
  const words = playedWords(state);
  const n = words.length;

  // Exact sequences: does the run's prefix exactly match a known sequence and
  // did it complete on this word?
  for (const { seq, name, text } of EXACT_SEQUENCES) {
    if (n === seq.length && seq.every((s, i) => words[i] === s)) {
      return { id: "seq:" + seq.join("-"), name, text };
    }
  }

  // Structural sequences evaluated exactly at the 3rd word (shared list).
  if (n === 3) {
    const lens = words.map((w) => w.length);
    const initials = words.map((w) => w[0]);
    for (const b of STRUCTURAL_BADGES) {
      if (b.test(words, lens, initials)) return { id: b.id, name: b.name, text: b.text };
    }
  }
  return null;
}

// ── catalogs (for the persistent "Discovered" collection on the title screen) ──
// Every title/omen/badge that CAN be earned, so the cabinet can render locked
// "???" entries next to the ones the player has found. Each entry is
// { id, name, hint } — `id` matches what logic.js records (see below), `hint` is
// a vague nudge (never a solution). These are derived from the same data the
// award functions use, so the catalog can't drift from what's actually earnable.

// Titles: the DISPLAY string is the id (that's what state.title.title holds and
// what the store records). Deduped — several first-words map to the same title
// only rarely, but Object.values may repeat, so we unique them.
export const ALL_TITLES = [...new Set(Object.values(FIRST_WORD_TITLES))]
  .sort()
  .map((name) => ({ id: name, name, hint: "Open a run with a certain evocative first word." }));

// Omens: exact-word omens (id "omen:<name>") + structural omens (their struct id).
// logic.js records an earned omen by the id it stored on the badge; exact omens
// are stored as { id: "omen:" + WORD }, but the DISPLAY id we collect on is the
// omen NAME so the catalog and the store agree regardless of which word triggered
// it. We therefore key the collection on the omen NAME.
// (All keyed on the omen NAME — that's the stable id the cabinet records earned
// entries under, regardless of which word/predicate triggered it.)
export const ALL_OMENS = [
  ...Object.values(EXACT_OMENS).map(([name]) => ({
    id: name, name, hint: "Open a run with a particular telling word.",
  })),
  ...STRUCTURAL_OMENS.map((o) => ({ id: o.name, name: o.name, hint: o.hint })),
];

// Badges ("secrets"): exact word-sequences + structural sequences. Keyed on NAME.
export const ALL_BADGES = [
  ...EXACT_SEQUENCES.map((s) => ({
    id: s.name, name: s.name,
    hint: `Play a telling sequence of ${s.seq.length} words in a row to open a run.`,
  })),
  ...STRUCTURAL_BADGES.map((b) => ({ id: b.name, name: b.name, hint: b.hint })),
];
