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
    ruleSpecs: ["any", "len>=4", "len>=5", "len<=6", "starts:S", "starts:B", "ends:T", "ends:E", "contains:R", "contains:A", "norepeat", "enemyletter"],
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
    ruleSpecs: ["vowels==2", "vowels==1", "no:E", "no:A", "cframe", "vstart", "onevowel", "len>=5", "len<=5", "contains:O"],
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
    ruleSpecs: ["tier:common", "tier:notcommon", "tier:obscure", "len>=6", "len<=5", "len<=5&tier:notcommon", "double", "contains:I", "no:S", "norepeat", "enemyletter"],
    enemyIds: ["footnote-goblin", "book-imp", "ink-leech", "paper-wraith", "margin-gnome", "gluttonous-maw"],
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
    ruleSpecs: ["vowels<=1", "double", "rareletter", "contains:K", "len>=6", "len<=4", "len<=4&vowels<=1", "freshletters", "no:E", "cframe", "tier:obscure", "no:E&double", "len>=6&cframe", "vowels<=1&len>=5"],
    enemyIds: ["scrabble-wyrm", "apostrophe-wraith", "redaction-slime", "bone-golem", "consonant-crab", "famine-wraith"],
    bossId: "scrabble-wyrm-boss",
  },
  {
    id: "tomb-of-forgotten-letters",
    name: "Tomb of Forgotten Letters",
    accent: "#6f8f8a",
    roomCount: 5,
    tone: "a crypt of letters that are written but never spoken",
    intros: [
      "You enter the Tomb of Forgotten Letters. The walls are carved with words whose sounds died long ago.",
      "In the Tomb, silent letters drift like dust — the K in KNIFE, the G in GNAW, all of them buried here.",
      "The Tomb of Forgotten Letters holds its breath. Here, half of every word is a ghost.",
    ],
    ruleSpecs: ["has:MB", "has:GH", "has:GN", "silentletter", "startseq:KN", "startseq:WR", "startseq:PS", "silentletter&len>=5", "no:E", "double", "len>=6"],
    enemyIds: ["gnawing-knight", "gnarled-gnome", "tomb-knocker", "ghoul", "silent-wraith"],
    bossId: "psycho-pseudomancer",
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
    ruleSpecs: ["len>=7", "no:E", "rareletter", "tier:obscure", "vowels==2", "norepeat", "double", "longer", "len<=4&rareletter", "len>=7&no:E", "no:E&norepeat", "len>=6&contains:R", "tier:obscure&len>=6"],
    enemyIds: ["lexicon-sentinel", "verbose-shade", "silent-index", "creeping-errata", "hunger-sentinel"],
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
  // ── Food-sealers (sealsFood: true) ──────────────────────────────────────────
  // These clamp your food heals to 0 for the whole fight — a clever "no snacking
  // mid-battle" pressure. Slay it and food works again. logic.js reads sealsFood.
  {
    id: "gluttonous-maw", name: "Gluttonous Maw", emoji: "👄", baseHP: 13, damage: 1,
    kindTags: ["beast", "flesh"], weaknessTags: ["fire", "holy"], resistanceTags: ["food"],
    sealsFood: true,
    intents: ["swallow your snacks whole", "gape wide, eating the smell of food"],
    flavor: ["A Gluttonous Maw yawns open — it eats your rations before you can. Food will not heal you here."],
  },
  {
    id: "famine-wraith", name: "Famine Wraith", emoji: "🦴", baseHP: 15, damage: 2,
    kindTags: ["undead", "spirit"], weaknessTags: ["holy", "light"], resistanceTags: ["poison", "food"],
    sealsFood: true,
    intents: ["starve you for 2 hearts", "wither every crumb to dust"],
    flavor: ["A Famine Wraith drifts in and the air goes hungry. Any food you conjure turns to ash. Kill it to eat again."],
  },
  {
    id: "hunger-sentinel", name: "Hunger Sentinel", emoji: "🗿", baseHP: 16, damage: 2,
    kindTags: ["construct", "armor"], weaknessTags: ["magic", "tool"], resistanceTags: ["food", "poison"],
    sealsFood: true,
    intents: ["seal your pantry for 2 hearts", "grind shut every door to sustenance"],
    flavor: ["A Hunger Sentinel bars the way, and your provisions rot in an instant. No food heals until it falls."],
  },
  // ── Tomb of Forgotten Letters (silent-letter theme) ─────────────────────────
  {
    id: "gnawing-knight", name: "Gnawing Knight", emoji: "🛡️", baseHP: 15, damage: 2,
    kindTags: ["undead", "armor", "construct"], weaknessTags: ["blunt", "holy"], resistanceTags: ["piercing"],
    intents: ["hew at you for 2 hearts", "grind its silent, rusted visor toward you"],
    flavor: ["A Gnawing Knight rises in silent armor — the G in its name never spoken, only felt."],
  },
  {
    id: "gnarled-gnome", name: "Gnarled Gnome", emoji: "🧌", baseHP: 13, damage: 1,
    kindTags: ["goblin", "flesh"], weaknessTags: ["weapon", "fire"], resistanceTags: [],
    intents: ["gnash for 1 heart", "gnarl its knotted fingers at your word"],
    flavor: ["A Gnarled Gnome uncurls from a tomb-niche, gnawing on a forgotten G."],
  },
  {
    id: "tomb-knocker", name: "Tomb Knocker", emoji: "⚰️", baseHP: 14, damage: 1,
    kindTags: ["undead", "construct"], weaknessTags: ["blunt", "light"], resistanceTags: ["dark"],
    intents: ["knock the breath from you for 1 heart", "rap a knuckle-bone against the lid, silent K and all"],
    flavor: ["A Tomb Knocker taps from inside a sealed coffin — the K in KNOCK swallowed by stone."],
  },
  {
    id: "ghoul", name: "Ghoul", emoji: "🧟", baseHP: 15, damage: 2,
    kindTags: ["undead", "flesh"], weaknessTags: ["holy", "fire"], resistanceTags: ["poison", "dark"],
    intents: ["maul you for 2 hearts", "drag itself closer through the crypt-dust"],
    flavor: ["A Ghoul unfolds from a heap of gnawed pages, the GH of its name gone silent."],
  },
  {
    id: "silent-wraith", name: "Silent Wraith", emoji: "👻", baseHP: 14, damage: 1,
    kindTags: ["undead", "ghost", "spirit"], weaknessTags: ["holy", "light"], resistanceTags: ["weapon", "piercing", "poison"],
    intents: ["wail soundlessly for 1 heart", "wring the air where a W should have been heard"],
    flavor: ["A Silent Wraith seeps from the wall — the W in WRAITH written but never sounded."],
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
      { hp: 12, ruleSpec: "len<=4", intent: "Finish it with a single short, sharp tile-word (4 letters or fewer)." },
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
  {
    id: "psycho-pseudomancer", name: "The Psycho Pseudomancer", emoji: "🔮", damage: 2,
    kindTags: ["undead", "spirit", "demon"], weaknessTags: ["holy", "light"], resistanceTags: ["dark", "poison"],
    phases: [
      { hp: 11, ruleSpec: "silentletter", intent: "The Pseudomancer speaks in silent letters. Answer in kind." },
      { hp: 12, ruleSpec: "startseq:PS", intent: "It hisses a soundless P — begin your word with PS." },
      { hp: 12, ruleSpec: "has:GH", intent: "For the last rite: a word carrying the ghost of GH." },
    ],
    victory: "The Psycho Pseudomancer tries to pronounce its own name, chokes on the silent letters, and unravels into unspoken sounds.",
    defeat: "The Pseudomancer whispers a word with no sound, and the silence takes you.",
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
  { id: "iron-bookmark", name: "Iron Bookmark", emoji: "🔖", effectTag: "first-fail-forgiven", description: "The first failed word each level costs no heart." },
  { id: "palindrome-coin", name: "Palindrome Coin", emoji: "🪙", effectTag: "double-coins", description: "Words with a double letter earn +2 coins." },
  { id: "whetstone", name: "Whetstone", emoji: "⚔️", effectTag: "weapon-plus2", description: "Weapon-words deal an extra +2 damage." },
  { id: "tinderbox", name: "Tinderbox", emoji: "🔥", effectTag: "fire-plus2", description: "Fire-words deal an extra +2 damage." },
  { id: "reliquary", name: "Reliquary", emoji: "✝️", effectTag: "holy-plus2", description: "Holy-words deal an extra +2 damage." },
  { id: "thesaurus-shard", name: "Thesaurus Shard", emoji: "💠", effectTag: "long-plus1", description: "+1 damage for every word 5+ letters long." },
  { id: "coin-purse", name: "Bottomless Purse", emoji: "👛", effectTag: "coins-per-clear", description: "Earn +3 coins each room cleared." },
  // Expansion
  { id: "poisoners-ring", name: "Poisoner's Ring", emoji: "💍", effectTag: "poison-plus2", description: "Poison-words deal an extra +2 damage." },
  { id: "frost-lens", name: "Frost Lens", emoji: "❄️", effectTag: "ice-plus2", description: "Ice-words deal an extra +2 damage." },
  { id: "silver-fang", name: "Silver Fang", emoji: "🐺", effectTag: "beastly-plus2", description: "Beast-words deal an extra +2 damage." },
  { id: "goblin-lens", name: "Goblin Lens", emoji: "🔍", effectTag: "goblin-plus6", description: "Goblin-tier words deal +6 damage." },
  { id: "vowel-crown", name: "Vowel Crown", emoji: "👑", effectTag: "vowel-heavy-heal", description: "Words with 3+ vowels heal 1 heart (once per room)." },
  { id: "iron-stomach", name: "Iron Stomach", emoji: "🍖", effectTag: "food-plus1", description: "Food-words heal +1 extra." },
  { id: "gluttons-charm", name: "Glutton's Charm", emoji: "🍗", effectTag: "food-unseal", description: "Food heals even against food-sealing enemies." },
  { id: "merchants-token", name: "Merchant's Token", emoji: "🎟️", effectTag: "shop-discount", description: "Everything in merchant rooms costs 25% less." },
  { id: "lucky-coin", name: "Lucky Coin", emoji: "🍀", effectTag: "coins-per-clear-2", description: "Earn +5 coins each room cleared." },
  { id: "short-blade", name: "Short Blade", emoji: "🔪", effectTag: "short-plus2", description: "+2 damage for words 4 letters or shorter." },
  { id: "runed-anvil", name: "Runed Anvil", emoji: "🔨", effectTag: "blunt-plus2", description: "Blunt-words deal an extra +2 damage." },
  { id: "second-wind", name: "Second Wind", emoji: "🌬️", effectTag: "level-heal", description: "Heal 1 heart at the start of each level." },
  // Legendary: unlocks the EXCALIBUR power-word (handled specially in logic.js).
  { id: "sword-in-stone", name: "Sword in the Stone", emoji: "🗿", effectTag: "excalibur", description: "You alone may speak EXCALIBUR — a legendary strike that ignores the room's rule." },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));

// ── SCROLLS ───────────────────────────────────────────────────────────────────
// One-use tools. `effectTag` resolved in logic.js when consumed.
// (Hint-flavored scrolls — hint-scroll / lantern-scroll — are parked: the Hint
// feature is disabled, so they're removed from the offered pool.)
export const SCROLLS = [
  { id: "clean-slate", name: "Clean Slate", emoji: "🧼", effectTag: "clear-rule", description: "Removes this room's rule for one word." },
  { id: "word-bomb", name: "Word Bomb", emoji: "💣", effectTag: "bonus-damage", description: "Your next valid word deals +6 damage." },
  { id: "vowel-pardon", name: "Vowel Pardon", emoji: "🕊️", effectTag: "forgive-fail", description: "Your next failed word is forgiven (no heart lost)." },
  { id: "reroll-room", name: "Reroll Scroll", emoji: "🎲", effectTag: "reroll-rule", description: "Swaps this room's rule for another of the same tier." },
  { id: "healing-draught", name: "Healing Draught", emoji: "🧪", effectTag: "heal-2", description: "Restores 2 hearts." },
  // Expansion
  { id: "greater-draught", name: "Greater Draught", emoji: "⚗️", effectTag: "heal-4", description: "Restores 4 hearts." },
  { id: "smoke-bomb", name: "Smoke Bomb", emoji: "💨", effectTag: "skip-counter", description: "The enemy's next counterattack is skipped." },
  { id: "greater-bomb", name: "Greater Word Bomb", emoji: "🧨", effectTag: "bonus-damage-big", description: "Your next valid word deals +12 damage." },
  { id: "banish-scroll", name: "Banish Scroll", emoji: "🌀", effectTag: "banish", description: "Instantly deal 8 damage to the enemy." },
  { id: "coin-scroll", name: "Coin Scroll", emoji: "🪙", effectTag: "gain-coins", description: "Gain 10 coins." },
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
    "The walls wait for a real word. That wasn't one.",
    "The letters refuse to hold their shape.",
    "Gibberish. The torches don't even flicker.",
  ],
  ruleFail: [
    "The word is real, but it breaks the room's law.",
    "Valid — but not what this room demands.",
    "A true word, wrongly shaped for this place.",
    "The rule rejects it. Try again.",
    "The room glares. Your word doesn't fit its law.",
    "Real, yes — but the wrong shape for this door.",
  ],
  ruleFailPenalty: [
    "The room punishes the second wrong word. A heart flickers out.",
    "Twice wrong. The walls take their due — you lose a heart.",
    "The dungeon's patience ends. That mistake costs you a heart.",
  ],
  plainHit: [
    "The word lands with a dull, magical thud.",
    "Plain letters, plainly delivered.",
    "No special weight to it — but it strikes all the same.",
    "The word does its honest work.",
    "A workmanlike blow — nothing fancy, but it counts.",
    "The word connects, flat and true.",
  ],
  // Shown for a RARE (obscure/goblin) word that has no effect category — it may
  // carry no sword or torch, but its sheer strangeness is a weapon of its own.
  plainHitRare: [
    "A word this rare lands with uncanny weight.",
    "The dungeon flinches — few would dare to speak that one.",
    "No blade, no flame — but a word that strange cuts all on its own.",
    "The stones don't recognize it, and that alone unsettles them.",
    "Such an unusual word; the dark leans in to listen, then recoils.",
  ],
  enemyDown: [
    "The creature comes apart into loose punctuation.",
    "It crumbles, unmade by a single well-chosen word.",
    "The thing collapses into a heap of spent letters.",
    "Defeated — it dissolves back into the dungeon's murmur.",
    "It folds shut like a closing book and is gone.",
    "The last of it unspools into silence.",
  ],
  roomClear: [
    "The way ahead grinds open.",
    "The room settles, its challenge spent.",
    "A door you hadn't noticed swings wide.",
    "Silence. You've cleared it.",
    "The pressure lifts. The next room waits.",
    "A passage exhales dust and opens.",
  ],
  repeat: [
    "You've already spoken that word this run. The dungeon remembers.",
    "That word is spent — it won't answer twice.",
    "The dungeon has heard that one already. Find another.",
  ],
  // Category-aware repeats — chosen when a spent word belongs to an effect
  // category, so replaying SWORD reads differently from replaying APPLE. {WORD}
  // is swapped for the played word (like the effect flavor). Falls back to the
  // generic `repeat` bucket for words with no category.
  repeatWeapon: [
    "That {WORD} has no edge left — you've already swung it.",
    "The {WORD} is notched and spent. It won't cut twice.",
    "You reach for the {WORD}, but its work here is done.",
  ],
  repeatBlunt: [
    "The {WORD} is already dented from the last blow.",
    "You've swung the {WORD} once. It's spent.",
  ],
  repeatFood: [
    "No more {WORD} left in your sack.",
    "You've already eaten the last {WORD}.",
    "The {WORD} is gone — you finished it a moment ago.",
  ],
  repeatMagic: [
    "That {WORD} is already discharged — the magic is spent.",
    "The {WORD} fizzles. You've spoken its power once already.",
  ],
  repeatFire: [
    "The {WORD} has already burned out.",
    "Only cold ash remains of that {WORD}.",
  ],
  repeatHoly: [
    "That {WORD} has already been offered. It answers only once.",
    "The {WORD} is spent; the blessing does not repeat.",
  ],
  foodSealed: [
    "The food turns to ash before it reaches your lips.",
    "Your snack withers to dust — this thing has sealed your pantry.",
    "The morsel rots in an instant. No nourishment here.",
  ],
};

// ── MERCHANTS ──────────────────────────────────────────────────────────────────
// A merchant room draws a small seeded stock (2–4 offers) from this catalog and
// prices each. buyItem (logic.js) deducts coins. `kind` decides what's granted:
//   "scroll"/"relic" (grants the id), "heal" (restores value hearts),
//   "maxheart" (raises max + current hearts). basePrice scales mildly by level
//   in logic.js. Treasure rooms still give a FREE relic — merchants are the sink.
export const MERCHANT_STOCK = [
  { id: "buy-minor-heal", kind: "heal", value: 1, basePrice: 4, name: "Minor Draught", emoji: "🩹", description: "Restore 1 heart." },
  { id: "buy-heal", kind: "heal", value: 2, basePrice: 14, name: "Healing Draught", emoji: "🧪", description: "Restore 2 hearts." },
  { id: "buy-greater-heal", kind: "heal", value: 4, basePrice: 24, name: "Greater Draught", emoji: "⚗️", description: "Restore 4 hearts." },
  { id: "buy-maxheart", kind: "maxheart", value: 1, basePrice: 22, name: "Heart Locket", emoji: "❤️", description: "Raise max hearts by 1 (and heal 1)." },
  { id: "buy-clean", kind: "scroll", grant: "clean-slate", basePrice: 10, name: "Clean Slate", emoji: "🧼", description: "Lift a room's rule for one word." },
  { id: "buy-bomb", kind: "scroll", grant: "word-bomb", basePrice: 12, name: "Word Bomb", emoji: "💣", description: "Next word deals +6." },
  { id: "buy-greater-bomb", kind: "scroll", grant: "greater-bomb", basePrice: 20, name: "Greater Word Bomb", emoji: "🧨", description: "Next word deals +12." },
  { id: "buy-banish", kind: "scroll", grant: "banish-scroll", basePrice: 18, name: "Banish Scroll", emoji: "🌀", description: "Deal 8 damage instantly." },
  { id: "buy-relic-quill", kind: "relic", grant: "rusty-quill", basePrice: 20, name: "Rusty Quill", emoji: "🪶", description: "+2 damage for 6+ letter words." },
  { id: "buy-relic-whetstone", kind: "relic", grant: "whetstone", basePrice: 20, name: "Whetstone", emoji: "⚔️", description: "Weapon-words deal +2." },
  { id: "buy-relic-purse", kind: "relic", grant: "coin-purse", basePrice: 24, name: "Bottomless Purse", emoji: "👛", description: "+3 coins per room cleared." },
  { id: "buy-relic-stomach", kind: "relic", grant: "iron-stomach", basePrice: 18, name: "Iron Stomach", emoji: "🍖", description: "Food heals +1 extra." },
  { id: "buy-relic-thesaurus", kind: "relic", grant: "thesaurus-shard", basePrice: 20, name: "Thesaurus Shard", emoji: "💠", description: "+1 damage for every 5+ letter word." },
  { id: "buy-relic-secondwind", kind: "relic", grant: "second-wind", basePrice: 22, name: "Second Wind", emoji: "🌬️", description: "Heal 1 heart each new level." },
  { id: "buy-relic-tinderbox", kind: "relic", grant: "tinderbox", basePrice: 20, name: "Tinderbox", emoji: "🔥", description: "Fire-words deal +2." },
  { id: "buy-relic-reliquary", kind: "relic", grant: "reliquary", basePrice: 20, name: "Reliquary", emoji: "✝️", description: "Holy-words deal +2." },
  { id: "buy-relic-scrabble", kind: "relic", grant: "scrabble-tile", basePrice: 22, name: "Scrabble Tile", emoji: "🔠", description: "J/Q/X/Z words deal +4." },
  { id: "buy-relic-bookmark", kind: "relic", grant: "iron-bookmark", basePrice: 18, name: "Iron Bookmark", emoji: "🔖", description: "First failed word each level costs no heart." },
  // Legendary — rare, expensive; unlocks the EXCALIBUR power-word.
  { id: "buy-relic-excalibur", kind: "relic", grant: "sword-in-stone", basePrice: 40, name: "Sword in the Stone", emoji: "🗿", description: "Speak EXCALIBUR: a rule-ignoring legendary strike." },
];

// ── EVENTS ─────────────────────────────────────────────────────────────────────
// Zork-style choice rooms. resolveEvent (logic.js) applies the chosen outcome and
// advances. Each outcome is an object read by applyOutcome: { heal, coins, hearts
// (negative = lose), relic, scroll, maxheart }. `requires` (optional) gates a
// choice on { coins } the player must have. Text is flavor.
export const EVENTS = [
  {
    id: "cracked-fountain",
    bodyText: "A cracked fountain trickles something that might be water, might be ink. A coin slot gleams at its base.",
    choices: [
      { label: "Toss in 6 coins", requires: { coins: 6 }, outcome: { coins: -6, heal: 3 }, resultText: "The fountain drinks your coins and mends you. (+3 hearts)" },
      { label: "Drink from it", outcome: { hearts: -1, scroll: "healing-draught" }, resultText: "It burns going down (−1 heart) — but a Healing Draught condenses in your hand." },
      { label: "Leave it be", outcome: {}, resultText: "You move on, thirsty but whole." },
    ],
  },
  {
    id: "whispering-shelf",
    bodyText: "A shelf of books whispers your name. One volume juts out, waiting to be pulled.",
    choices: [
      { label: "Pull the book", outcome: { relic: "goblin-dictionary" }, resultText: "The book snaps to dust, leaving a Goblin Dictionary behind." },
      { label: "Shush the shelf", outcome: { coins: 5 }, resultText: "The shelf falls silent, embarrassed, and a few coins roll out. (+5 coins)" },
    ],
  },
  {
    id: "starving-goblin",
    bodyText: "A thin goblin blocks the passage, holding out a trembling bowl. 'Food?' it rasps.",
    choices: [
      { label: "Share your rations", outcome: { hearts: -1, relic: "gluttons-charm" }, resultText: "You give up a meal (−1 heart). The goblin presses a Glutton's Charm into your palm." },
      { label: "Give it 8 coins", requires: { coins: 8 }, outcome: { coins: -8, scroll: "greater-draught" }, resultText: "It buys food elsewhere and gratefully hands you a Greater Draught." },
      { label: "Step over it", outcome: {}, resultText: "You step past. It watches you go, unblinking." },
    ],
  },
  {
    id: "gambling-skull",
    bodyText: "A grinning skull rattles two dice. 'Double or nothing on your luck,' it clacks.",
    choices: [
      { label: "Bet 10 coins", requires: { coins: 10 }, outcome: { coins: 10 }, resultText: "The dice land in your favor — the pot doubles back to you. (+10 coins)" },
      { label: "Bet a heart", outcome: { hearts: -1, coins: 15 }, resultText: "You wager blood (−1 heart) and the skull pays out in gold. (+15 coins)" },
      { label: "Walk away", outcome: {}, resultText: "The skull sighs. 'Cowardice. Very sensible.'" },
    ],
  },
  {
    id: "sealed-altar",
    bodyText: "An altar of black glass asks for a sacrifice. A slot for coins. A slot for something worse.",
    choices: [
      { label: "Offer 12 coins", requires: { coins: 12 }, outcome: { coins: -12, maxheart: 1 }, resultText: "The altar accepts your gold and widens your heart. (max hearts +1)" },
      { label: "Offer nothing", outcome: {}, resultText: "The altar dims, unimpressed, and lets you pass." },
    ],
  },
  {
    id: "lost-quill",
    bodyText: "A quill floats mid-air, scratching at a page that keeps erasing itself.",
    choices: [
      { label: "Take the quill", outcome: { relic: "rusty-quill" }, resultText: "You snatch the quill — a Rusty Quill, still warm with ink." },
      { label: "Read the page", outcome: { coins: 7 }, resultText: "The page crumbles to coins in your hand before it can finish writing. (+7 coins)" },
    ],
  },
  {
    id: "mirror-pool",
    bodyText: "A still pool shows your reflection — but it's holding something you aren't.",
    choices: [
      { label: "Reach in", outcome: { hearts: -1, relic: "second-wind" }, resultText: "Cold bites your arm (−1 heart) but you pull out a charm of Second Wind." },
      { label: "Study the reflection", outcome: { coins: 6 }, resultText: "You memorize a trick and coins surface from the deep. (+6 coins)" },
      { label: "Turn away", outcome: {}, resultText: "You refuse to look. It's the wisest thing you do all day." },
    ],
  },
  {
    id: "toll-door",
    bodyText: "A stone face set in the door yawns wide. 'Pay the toll or answer with blood.'",
    choices: [
      { label: "Pay 5 coins", requires: { coins: 5 }, outcome: { coins: -5 }, resultText: "The door accepts your coin and grinds open." },
      { label: "Pay a heart", outcome: { hearts: -1, coins: 8 }, resultText: "It drinks a heart (−1) and, oddly, spits back a bribe of coins. (+8)" },
    ],
  },
  {
    id: "candle-vendor",
    bodyText: "A hooded figure sells a single guttering candle. 'It wards off what bites in the dark,' they murmur.",
    choices: [
      { label: "Buy it (7 coins)", requires: { coins: 7 }, outcome: { coins: -7, scroll: "healing-draught" }, resultText: "The candle's warmth condenses into a Healing Draught in your grip." },
      { label: "Blow it out", outcome: { heal: 1 }, resultText: "Darkness, then calm. You breathe easier. (+1 heart)" },
    ],
  },
  {
    id: "ration-cache",
    bodyText: "A forgotten cache of preserved food sits in an alcove, impossibly untouched.",
    choices: [
      { label: "Eat your fill", outcome: { heal: 3 }, resultText: "You feast on the preserved rations until your strength returns. (+3 hearts)" },
      { label: "Pocket it for coin", outcome: { coins: 9 }, resultText: "You'll sell it later. Someone always wants old rations. (+9 coins)" },
    ],
  },
];
