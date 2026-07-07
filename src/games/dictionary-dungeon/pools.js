/* DICTIONARY DUNGEON — content pools (node-pure, hand-authored).

   All the authored variety lives here as plain data: the five level themes, the
   enemy roster, the bosses, relics, scrolls, and the flavor-text buckets. The
   daily assembler (logic.js buildRun) draws from these deterministically so
   every player sees the same run today, and scripts/dungeon-check.js validates
   the assembled runs are solvable.

   No React, no DOM. Rules are referenced by SPEC STRING (see rules.js): each
   level lists a pool of `ruleSpecs` sized to its difficulty; the assembler picks
   per-room rules from that pool. Enemies carry semantic tags so the word-effect
   system (effects.js) makes weapon/fire/holy/etc. matter.

   ENEMY TAGS:
     kindTags       — what it IS (skeleton, undead, beast, goblin, slime, …);
                      effect categories declare strongAgainst these.
     weaknessTags   — effect CATEGORIES it fears (extra damage).
     resistanceTags — effect CATEGORIES it shrugs off (dampened + "resisted").
*/

// ── LEVELS ────────────────────────────────────────────────────────────────────
// Five fixed themed levels. `ruleSpecs` is the rule pool the assembler draws
// room rules from (biased to the level's difficulty). `enemyIds` is the enemy
// pool for the level; `bossId` its climax. roomCount = non-boss rooms.
export const LEVELS = [
  {
    id: "entry-hall",
    name: "Entry Hall",
    accent: "#d9b45e",
    roomCount: 4,
    tone: "cold stone and guttering torchlight",
    intros: [
      "You push through a door of warped oak into the Entry Hall. Dust hangs in the torchlight.",
      "The Entry Hall stretches ahead, its flagstones worn smooth by centuries of the lost.",
      "Somewhere far below, the dungeon breathes. Here in the Entry Hall it is only cold.",
    ],
    ruleSpecs: ["any", "len>=4", "len>=5", "starts:S", "starts:B", "ends:T", "ends:E", "contains:R", "contains:A", "norepeat", "enemyletter"],
    enemyIds: ["paper-rat", "cave-bat", "mold-slime", "shuffling-husk", "grave-spider"],
    bossId: "doorwarden",
  },
  {
    id: "vowel-crypt",
    name: "Vowel Crypt",
    accent: "#8f6bb0",
    roomCount: 4,
    tone: "a chapel of cracked marble humming with swallowed vowels",
    intros: [
      "You descend into the Vowel Crypt. The walls hum with sounds they refuse to release.",
      "The Vowel Crypt is a chapel of cracked marble; every surface seems to be mid-word.",
      "In the Vowel Crypt the air tastes of unspoken letters.",
    ],
    ruleSpecs: ["vowels==2", "vowels==1", "no:E", "no:A", "cframe", "vstart", "onevowel", "len>=5", "contains:O"],
    enemyIds: ["mute-choirling", "restless-corpse", "pale-wraith", "hollow-monk", "echo-shade"],
    bossId: "mute-choir",
  },
  {
    id: "goblin-library",
    name: "Goblin Library",
    accent: "#5fae7a",
    roomCount: 5,
    tone: "toppled shelves and goblins offended by real words",
    intros: [
      "The Goblin Library sprawls in ruin — shelves toppled, a goblin squinting at your every word.",
      "Ink-stained goblins scatter as you enter the Library. They resent anything spelled correctly.",
      "The Goblin Library smells of mildew and spite. Somewhere a footnote is being defaced.",
    ],
    ruleSpecs: ["tier:common", "tier:notcommon", "tier:obscure", "len>=6", "double", "contains:I", "no:S", "norepeat", "enemyletter"],
    enemyIds: ["footnote-goblin", "book-imp", "ink-leech", "paper-wraith", "margin-gnome"],
    bossId: "footnote-king",
  },
  {
    id: "consonant-catacombs",
    name: "Consonant Catacombs",
    accent: "#b06b6b",
    roomCount: 5,
    tone: "dry vaults where vowels go to die",
    intros: [
      "The Consonant Catacombs open before you — dry vaults where vowels seem forbidden.",
      "In the Catacombs the walls are carved with hard, clacking letters and no soft ones.",
      "The Consonant Catacombs rattle with a language of edges.",
    ],
    ruleSpecs: ["vowels<=1", "double", "rareletter", "contains:K", "len>=6", "freshletters", "no:E", "cframe", "tier:obscure"],
    enemyIds: ["scrabble-wyrm", "apostrophe-wraith", "redaction-slime", "bone-golem", "consonant-crab"],
    bossId: "scrabble-wyrm-boss",
  },
  {
    id: "final-lexicon",
    name: "The Final Lexicon",
    accent: "#c9a24a",
    roomCount: 4,
    tone: "an endless hall of every word ever bound",
    intros: [
      "You reach the Final Lexicon — an endless hall where every word ever bound waits, watching.",
      "The Final Lexicon towers over you, its shelves vanishing into dark far overhead.",
      "This is the Final Lexicon. The dungeon has been reading you the whole way down.",
    ],
    ruleSpecs: ["len>=7", "no:E", "rareletter", "tier:obscure", "vowels==2", "norepeat", "contains:R", "double", "longer"],
    enemyIds: ["lexicon-sentinel", "verbose-shade", "silent-index", "creeping-errata"],
    bossId: "unabridged-lich",
  },
];

// ── ENEMIES ───────────────────────────────────────────────────────────────────
export const ENEMIES = [
  // Entry Hall
  {
    id: "paper-rat", name: "Paper Rat", emoji: "🐀", baseHP: 8, damage: 1,
    kindTags: ["beast", "flesh"], weaknessTags: ["fire", "weapon"], resistanceTags: [],
    intents: ["gnaw for 1 heart", "skitter closer, teeth bared"],
    flavor: ["A rat of folded paper rears up, squeaking dryly."],
  },
  {
    id: "cave-bat", name: "Cave Bat", emoji: "🦇", baseHP: 7, damage: 1,
    kindTags: ["beast", "flesh"], weaknessTags: ["blunt", "light"], resistanceTags: [],
    intents: ["dive for 1 heart", "wheel through the dark"],
    flavor: ["A cave bat drops from the rafters, shrieking."],
  },
  {
    id: "mold-slime", name: "Mold Slime", emoji: "🟢", baseHP: 10, damage: 1,
    kindTags: ["slime"], weaknessTags: ["fire", "ice"], resistanceTags: ["weapon", "piercing"],
    intents: ["ooze forward for 1 heart", "split and reform"],
    flavor: ["A slick of green mold gathers itself into a slime."],
  },
  {
    id: "shuffling-husk", name: "Shuffling Husk", emoji: "🧟", baseHP: 11, damage: 1,
    kindTags: ["undead", "flesh"], weaknessTags: ["holy", "fire"], resistanceTags: ["poison"],
    intents: ["grab for 1 heart", "shamble nearer"],
    flavor: ["A dried-out husk of a body lurches upright."],
  },
  {
    id: "grave-spider", name: "Grave Spider", emoji: "🕷️", baseHP: 9, damage: 1,
    kindTags: ["beast", "spider"], weaknessTags: ["fire"], resistanceTags: [],
    intents: ["bite for 1 heart", "spin a snare"],
    flavor: ["A grave spider unfolds from a crack in the wall."],
  },
  // Vowel Crypt
  {
    id: "mute-choirling", name: "Mute Choirling", emoji: "👻", baseHP: 12, damage: 1,
    kindTags: ["undead", "spirit"], weaknessTags: ["holy", "light"], resistanceTags: ["weapon"],
    intents: ["shriek for 1 heart next turn", "open a silent, screaming mouth"],
    flavor: ["A robed choirling drifts up, its song stolen away."],
  },
  {
    id: "restless-corpse", name: "Restless Corpse", emoji: "🧟‍♂️", baseHP: 13, damage: 1,
    kindTags: ["undead", "flesh"], weaknessTags: ["holy", "fire"], resistanceTags: ["poison"],
    intents: ["claw for 1 heart", "drag itself upright again"],
    flavor: ["A corpse that refuses to lie still rises once more."],
  },
  {
    id: "pale-wraith", name: "Pale Wraith", emoji: "🌫️", baseHP: 12, damage: 1,
    kindTags: ["undead", "ghost", "spirit"], weaknessTags: ["holy", "light"], resistanceTags: ["weapon", "piercing", "poison"],
    intents: ["chill you for 1 heart", "reach through your chest"],
    flavor: ["A pale wraith seeps out of the marble, weaponless words useless against it."],
  },
  {
    id: "hollow-monk", name: "Hollow Monk", emoji: "🧎", baseHP: 12, damage: 1,
    kindTags: ["undead", "spirit"], weaknessTags: ["light", "fire"], resistanceTags: ["dark"],
    intents: ["intone a hex for 1 heart", "bow, hollow-eyed"],
    flavor: ["A hooded monk kneels — then lifts a face with nothing inside the cowl."],
  },
  {
    id: "echo-shade", name: "Echo Shade", emoji: "🕯️", baseHP: 11, damage: 1,
    kindTags: ["spirit", "dark"], weaknessTags: ["light", "holy"], resistanceTags: ["dark"],
    intents: ["repeat your pain for 1 heart", "flicker between the pillars"],
    flavor: ["A shade of some long-dead echo peels off the wall."],
  },
  // Goblin Library
  {
    id: "footnote-goblin", name: "Footnote Goblin", emoji: "👺", baseHP: 13, damage: 1,
    kindTags: ["goblin", "flesh"], weaknessTags: ["weapon", "beastly"], resistanceTags: [],
    intents: ["stab with a pen-nib for 1 heart", "scribble over your last word"],
    flavor: ["A footnote goblin bristles, furious that your word is real."],
  },
  {
    id: "book-imp", name: "Book Imp", emoji: "📕", baseHP: 12, damage: 1,
    kindTags: ["construct", "goblin"], weaknessTags: ["fire", "magic"], resistanceTags: [],
    intents: ["snap shut on you for 1 heart", "flutter its pages menacingly"],
    flavor: ["A book imp flaps up on paper wings, biting with a spine of staples."],
  },
  {
    id: "ink-leech", name: "Ink Leech", emoji: "🖋️", baseHP: 11, damage: 1,
    kindTags: ["beast", "slime"], weaknessTags: ["water", "fire"], resistanceTags: ["dark"],
    intents: ["drain 1 heart", "leave a stain where it touches"],
    flavor: ["An ink leech drops from a broken quill, hungry for color."],
  },
  {
    id: "paper-wraith", name: "Paper Wraith", emoji: "📜", baseHP: 13, damage: 1,
    kindTags: ["undead", "spirit", "construct"], weaknessTags: ["fire", "water"], resistanceTags: ["weapon"],
    intents: ["paper-cut you for 1 heart", "unfurl into a thousand pages"],
    flavor: ["A wraith of loose pages rustles up out of the stacks."],
  },
  {
    id: "margin-gnome", name: "Margin Gnome", emoji: "🧌", baseHP: 12, damage: 1,
    kindTags: ["goblin", "flesh"], weaknessTags: ["weapon", "blunt"], resistanceTags: [],
    intents: ["jab from the margins for 1 heart", "cackle and rewrite the rules"],
    flavor: ["A gnome that lives in the margins pokes out, red pen ready."],
  },
  // Consonant Catacombs
  {
    id: "scrabble-wyrm", name: "Scrabble Wyrm", emoji: "🐉", baseHP: 15, damage: 2,
    kindTags: ["beast", "construct"], weaknessTags: ["magic", "ice"], resistanceTags: ["blunt"],
    intents: ["bite for 2 hearts", "count the value of your letters, unimpressed"],
    flavor: ["A wyrm of scattered letter-tiles coils up, rare letters glinting."],
  },
  {
    id: "apostrophe-wraith", name: "Apostrophe Wraith", emoji: "❞", baseHP: 14, damage: 1,
    kindTags: ["undead", "spirit"], weaknessTags: ["holy", "light"], resistanceTags: ["weapon", "poison"],
    intents: ["elide 1 heart", "hover, curling like a hook"],
    flavor: ["A wraith shaped like a floating apostrophe hooks toward you."],
  },
  {
    id: "redaction-slime", name: "Redaction Slime", emoji: "⬛", baseHP: 14, damage: 1,
    kindTags: ["slime", "dark"], weaknessTags: ["fire", "light"], resistanceTags: ["piercing", "weapon"],
    intents: ["blot out 1 heart", "smear black across the room"],
    flavor: ["A slime of pure redaction oozes forward, erasing the floor as it comes."],
  },
  {
    id: "bone-golem", name: "Bone Golem", emoji: "💀", baseHP: 16, damage: 2,
    kindTags: ["undead", "skeleton", "construct"], weaknessTags: ["blunt", "holy"], resistanceTags: ["poison", "piercing"],
    intents: ["crush for 2 hearts", "reassemble with a clatter"],
    flavor: ["A golem of fused bone hauls itself together with a grinding of joints."],
  },
  {
    id: "consonant-crab", name: "Consonant Crab", emoji: "🦀", baseHP: 13, damage: 1,
    kindTags: ["beast", "armor"], weaknessTags: ["blunt", "tool"], resistanceTags: ["weapon"],
    intents: ["clack a claw for 1 heart", "sidle behind its shell"],
    flavor: ["A crab armored in hard consonants clatters into the open."],
  },
  // Final Lexicon
  {
    id: "lexicon-sentinel", name: "Lexicon Sentinel", emoji: "🗿", baseHP: 15, damage: 2,
    kindTags: ["construct", "armor"], weaknessTags: ["magic", "tool"], resistanceTags: ["poison", "dark"],
    intents: ["slam a stone fist for 2 hearts", "read your entire history at a glance"],
    flavor: ["A sentinel of carved words grinds upright to bar the way."],
  },
  {
    id: "verbose-shade", name: "Verbose Shade", emoji: "🗣️", baseHP: 14, damage: 1,
    kindTags: ["spirit", "dark"], weaknessTags: ["light", "holy"], resistanceTags: ["dark"],
    intents: ["monologue for 1 heart", "bury you in adjectives"],
    flavor: ["A shade that will not stop talking coalesces, already mid-sentence."],
  },
  {
    id: "silent-index", name: "Silent Index", emoji: "🔖", baseHP: 14, damage: 1,
    kindTags: ["construct", "spirit"], weaknessTags: ["fire", "magic"], resistanceTags: ["weapon"],
    intents: ["cross-reference your wounds for 1 heart", "flip to your worst page"],
    flavor: ["A silent index unspools, tabs marking every mistake you've made."],
  },
  {
    id: "creeping-errata", name: "Creeping Errata", emoji: "🪱", baseHP: 15, damage: 2,
    kindTags: ["slime", "dark"], weaknessTags: ["fire", "holy"], resistanceTags: ["poison", "piercing"],
    intents: ["correct you for 2 hearts", "rewrite the floor beneath your feet"],
    flavor: ["Errata creep across the shelves, changing what was true a moment ago."],
  },
];

export const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

// ── BOSSES ────────────────────────────────────────────────────────────────────
// Each boss is HP split across PHASES; each phase swaps the rule. MVP: no
// shields — a phase is beaten by dropping its HP band to 0, then the rule
// changes. `ruleSpec` per phase is a rules.js spec.
export const BOSSES = [
  {
    id: "doorwarden", name: "The Doorwarden", emoji: "🚪", damage: 1,
    kindTags: ["construct", "armor"], weaknessTags: ["blunt", "tool"], resistanceTags: [],
    phases: [
      { hp: 8, ruleSpec: "len>=4", intent: "The Doorwarden demands a longer word." },
      { hp: 9, ruleSpec: "len>=5", intent: "It braces — a still longer word." },
      { hp: 10, ruleSpec: "len>=6", intent: "One final, longer word will break it." },
    ],
    victory: "The Doorwarden groans open at last and crumbles from its hinges.",
    defeat: "The Doorwarden slams shut. You are locked in the dark.",
  },
  {
    id: "mute-choir", name: "The Mute Choir", emoji: "🎼", damage: 1,
    kindTags: ["undead", "spirit"], weaknessTags: ["holy", "light"], resistanceTags: ["weapon", "poison"],
    phases: [
      { hp: 9, ruleSpec: "no:A", intent: "The Choir swallows the A. Do not feed it one." },
      { hp: 10, ruleSpec: "no:E", intent: "Now it hungers for E. Deny it." },
      { hp: 11, ruleSpec: "no:O", intent: "It reaches for O. Starve it out." },
    ],
    victory: "The Mute Choir chokes on its own silence and unravels into echoes.",
    defeat: "The Choir finds its voice in your scream. Everything goes quiet after.",
  },
  {
    id: "footnote-king", name: "The Footnote Goblin King", emoji: "👑", damage: 1,
    kindTags: ["goblin", "flesh"], weaknessTags: ["weapon", "beastly"], resistanceTags: ["treasure"],
    phases: [
      { hp: 10, ruleSpec: "tier:notcommon", intent: "The King sneers — common words bore him." },
      { hp: 11, ruleSpec: "tier:obscure", intent: "His shield holds. Only obscure words will crack it." },
      { hp: 11, ruleSpec: "len>=6", intent: "Finish him with something long and strange." },
    ],
    victory: "The Footnote King bursts into a puff of erased citations.",
    defeat: "The King footnotes your defeat in tiny, gloating print.",
  },
  {
    id: "scrabble-wyrm-boss", name: "The Scrabble Wyrm", emoji: "🐲", damage: 2,
    kindTags: ["beast", "construct"], weaknessTags: ["magic", "ice"], resistanceTags: ["blunt", "poison"],
    phases: [
      { hp: 11, ruleSpec: "vowels<=1", intent: "The Wyrm resists soft words. Keep the vowels out." },
      { hp: 12, ruleSpec: "rareletter", intent: "Its scales harden — only a rare letter bites now." },
      { hp: 12, ruleSpec: "double", intent: "Hit the same note twice: a double letter ends it." },
    ],
    victory: "The Scrabble Wyrm scatters into a hundred worthless tiles.",
    defeat: "The Wyrm tallies your letters, finds them wanting, and swallows you.",
  },
  {
    id: "unabridged-lich", name: "The Unabridged Lich", emoji: "📖", damage: 2,
    kindTags: ["undead", "spirit", "demon"], weaknessTags: ["holy", "light", "fire"], resistanceTags: ["poison", "dark"],
    phases: [
      { hp: 12, ruleSpec: "tier:common", intent: "Only what everyone knows can touch the Lich now." },
      { hp: 13, ruleSpec: "tier:obscure", intent: "It shifts — now only the forgotten words wound it." },
      { hp: 14, ruleSpec: "len>=7", intent: "For the final page: a long, no-mercy word." },
      { hp: 6, ruleSpec: "no:E", intent: "The last line. No E. Close the book." },
    ],
    victory: "The Unabridged Lich closes around a word it cannot define — and is undone. The dungeon exhales.",
    defeat: "The Lich adds you to its index and reads on, unbothered.",
  },
];

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

// ── RELICS ────────────────────────────────────────────────────────────────────
// Passive modifiers offered in treasure rooms. Effects resolved in logic.js via
// `effectTag`. Kept small for MVP but varied enough to change what words you want.
export const RELICS = [
  { id: "rusty-quill", name: "Rusty Quill", emoji: "🪶", effectTag: "len6-plus2", description: "+2 damage for 6+ letter words." },
  { id: "ink-dagger", name: "Ink Dagger", emoji: "🗡️", effectTag: "len4-plus3", description: "+3 damage for exactly 4-letter words." },
  { id: "goblin-dictionary", name: "Goblin Dictionary", emoji: "📗", effectTag: "obscure-plus50", description: "Obscure words deal +50% damage." },
  { id: "commoners-cloak", name: "Commoner's Cloak", emoji: "🧥", effectTag: "common-heal", description: "The first common word each level heals 1 heart." },
  { id: "scrabble-tile", name: "Scrabble Tile", emoji: "🔠", effectTag: "rareletter-plus4", description: "Words with J/Q/X/Z deal +4 damage." },
  { id: "vowel-charm", name: "Vowel Charm", emoji: "🔮", effectTag: "vowel-pardon", description: "Once per level, a vowel-rule failure is forgiven." },
  { id: "lantern-of-hints", name: "Lantern of Hints", emoji: "🏮", effectTag: "boss-hint", description: "Reveals a valid starting letter at the start of each boss." },
  { id: "iron-bookmark", name: "Iron Bookmark", emoji: "🔖", effectTag: "first-fail-forgiven", description: "The first failed word each level costs no heart." },
  { id: "palindrome-coin", name: "Palindrome Coin", emoji: "🪙", effectTag: "double-coins", description: "Words with a double letter earn +2 coins." },
  { id: "whetstone", name: "Whetstone", emoji: "⚔️", effectTag: "weapon-plus2", description: "Weapon-words deal an extra +2 damage." },
  { id: "tinderbox", name: "Tinderbox", emoji: "🔥", effectTag: "fire-plus2", description: "Fire-words deal an extra +2 damage." },
  { id: "reliquary", name: "Reliquary", emoji: "✝️", effectTag: "holy-plus2", description: "Holy-words deal an extra +2 damage." },
  { id: "thesaurus-shard", name: "Thesaurus Shard", emoji: "💠", effectTag: "long-plus1", description: "+1 damage for every word 5+ letters long." },
  { id: "coin-purse", name: "Bottomless Purse", emoji: "👛", effectTag: "coins-per-clear", description: "Earn +3 coins each room cleared." },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));

// ── SCROLLS ───────────────────────────────────────────────────────────────────
// One-use tools. `effectTag` resolved in logic.js when consumed.
export const SCROLLS = [
  { id: "hint-scroll", name: "Hint Scroll", emoji: "📜", effectTag: "reveal-starter", description: "Reveals one valid starting letter for this room." },
  { id: "clean-slate", name: "Clean Slate", emoji: "🧼", effectTag: "clear-rule", description: "Removes this room's rule for one word." },
  { id: "word-bomb", name: "Word Bomb", emoji: "💣", effectTag: "bonus-damage", description: "Your next valid word deals +6 damage." },
  { id: "vowel-pardon", name: "Vowel Pardon", emoji: "🕊️", effectTag: "forgive-fail", description: "Your next failed word is forgiven (no heart lost)." },
  { id: "reroll-room", name: "Reroll Scroll", emoji: "🎲", effectTag: "reroll-rule", description: "Swaps this room's rule for another of the same tier." },
  { id: "healing-draught", name: "Healing Draught", emoji: "🧪", effectTag: "heal-2", description: "Restores 2 hearts." },
];

export const SCROLL_BY_ID = Object.fromEntries(SCROLLS.map((s) => [s.id, s]));

// ── FLAVOR ────────────────────────────────────────────────────────────────────
// Pooled reaction lines. Picked seeded per turn so the daily reads the same for
// everyone. `damage` lines take the amount; the rest are plain.
export const FLAVOR = {
  invalid: [
    "The dungeon does not recognize that word.",
    "The letters scatter — that isn't a real word here.",
    "Nothing happens. The word means nothing to the stones.",
    "A word that isn't a word. The dark stays silent.",
  ],
  ruleFail: [
    "The word is real, but it breaks the room's law.",
    "Valid — but not what this room demands.",
    "A true word, wrongly shaped for this place.",
    "The rule rejects it. Try again.",
  ],
  plainHit: [
    "The word lands with a dull, magical thud.",
    "Plain letters, plainly delivered.",
    "No special weight to it — but it strikes all the same.",
    "The word does its honest work.",
  ],
  enemyDown: [
    "The creature comes apart into loose punctuation.",
    "It crumbles, unmade by a single well-chosen word.",
    "The thing collapses into a heap of spent letters.",
    "Defeated — it dissolves back into the dungeon's murmur.",
  ],
  roomClear: [
    "The way ahead grinds open.",
    "The room settles, its challenge spent.",
    "A door you hadn't noticed swings wide.",
    "Silence. You've cleared it.",
  ],
};
