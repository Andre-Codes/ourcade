/* DICTIONARY DUNGEON — the word-effect system (node-pure). THE CORE MECHANIC.

   Any valid word that satisfies the room rule does base damage. But if the word
   also MEANS something — sword, torch, apple, poison — it triggers a semantic
   bonus and its own flavor line. This is the "Scribblenauts-lite" juice: the
   word game stays primary (the rule must pass), and meaning modifies the result.

     resolveWordEffect(word, enemy, seed) → {
       category, damageBonus, heal, block, gold, status,
       weaknessBonus, resisted, text
     }

   No React, no DOM: shared by the cabinet and scripts/dungeon-check.js (which
   asserts every word below is a real ENABLE word, so no effect word is ever
   unplayable).

   HOW ENEMIES INTERACT. An enemy carries `weaknessTags` and `resistanceTags`
   (e.g. a skeleton weak to "blunt"/"holy", resistant to "poison"). A category
   also declares `strongAgainst` / `weakAgainst` enemy *kind* tags. When a
   played word's category is strong against the enemy, it adds a weakness bonus;
   when the enemy resists it, the effect is dampened and a "resisted" line shows.

   Flavor is chosen deterministically from `seed` so the daily run reads the same
   for everyone on a given turn. */

// ── categories ───────────────────────────────────────────────────────────────
// Each category: base bonus + which enemy kind-tags it is strong/weak against +
// flavor text buckets (generic / strong / resisted).
// Flavor lines may contain "{WORD}" — resolveWordEffect swaps in the played
// word so the log reads "You swing the HAMMER...". Lines without it still work.
export const EFFECT_CATEGORIES = {
  weapon: {
    id: "weapon",
    baseBonus: { damage: 2 },
    strongAgainst: ["flesh", "beast", "goblin"],
    weakAgainst: ["ghost", "spirit"],
    text: {
      generic: [
        "You swing the {WORD} and steel bites deep.",
        "The {WORD} flashes out of the dark and cuts clean.",
        "You level the {WORD} and drive it home.",
      ],
      strong: [
        "The {WORD} finds soft flesh and opens it wide.",
        "A perfect cut — the {WORD} leaves the creature reeling.",
      ],
      resisted: ["The {WORD} passes through with little to catch on."],
    },
  },
  blunt: {
    id: "blunt",
    baseBonus: { damage: 2 },
    strongAgainst: ["skeleton", "armor", "construct"],
    weakAgainst: ["slime", "ghost"],
    text: {
      generic: [
        "You swing the {WORD} in a bone-rattling arc.",
        "The {WORD} lands like a dropped anvil.",
      ],
      strong: [
        "The {WORD} shatters brittle bone in a spray of chips.",
        "Armor buckles and cracks under the {WORD}.",
      ],
      resisted: ["The {WORD} sinks in and stops, absorbed."],
    },
  },
  piercing: {
    id: "piercing",
    baseBonus: { damage: 2, status: "pierce" },
    strongAgainst: ["armor", "beast", "flesh"],
    weakAgainst: ["ghost"],
    text: {
      generic: [
        "The {WORD} narrows to a point and punches through.",
        "You thrust the {WORD} past the guard and lodge it deep.",
      ],
      strong: ["The {WORD} finds a seam in the armor and drives home."],
      resisted: ["The {WORD} skitters off, finding no purchase."],
    },
  },
  fire: {
    id: "fire",
    baseBonus: { damage: 2, status: "burn" },
    strongAgainst: ["spider", "plant", "undead", "slime", "beast"],
    weakAgainst: ["fire", "stone"],
    text: {
      generic: [
        "The {WORD} flares up and licks over the enemy.",
        "You raise the {WORD}; heat rolls off it.",
      ],
      strong: [
        "The {WORD} catches perfectly and the creature shrieks as it scorches.",
        "Flame races across it — this thing HATES the {WORD}.",
      ],
      resisted: ["The {WORD} gutters against it and dies."],
    },
  },
  light: {
    id: "light",
    baseBonus: { damage: 1, status: "reveal" },
    strongAgainst: ["undead", "ghost", "spirit", "dark"],
    weakAgainst: [],
    text: {
      generic: [
        "The {WORD} glows, pushing back the dungeon dark.",
        "Clean light spills from the {WORD} and dazzles the creature.",
      ],
      strong: ["The {WORD} sears the shadow-thing where it stands."],
      resisted: ["The {WORD} washes over it harmlessly."],
    },
  },
  holy: {
    id: "holy",
    baseBonus: { damage: 2 },
    strongAgainst: ["undead", "ghost", "demon", "spirit", "dark"],
    weakAgainst: [],
    text: {
      generic: [
        "Something sacred rings out of the {WORD}.",
        "The {WORD} gathers a clean, righteous weight.",
      ],
      strong: [
        "The {WORD} tears through the unholy thing in holy light.",
        "The creature recoils, smoking where the {WORD} touched it.",
      ],
      resisted: ["The {WORD} passes without effect on the living."],
    },
  },
  magic: {
    id: "magic",
    baseBonus: { damage: 2, status: "stun" },
    strongAgainst: ["construct", "beast"],
    weakAgainst: ["magic"],
    text: {
      generic: [
        "The {WORD} hums with unstable magic and discharges.",
        "Arcane sparks leap from the {WORD}.",
      ],
      strong: ["The {WORD} overloads the creature and it seizes up."],
      resisted: ["The {WORD} fizzles against its wards."],
    },
  },
  defense: {
    id: "defense",
    baseBonus: { damage: 1, block: 2 },
    strongAgainst: [],
    weakAgainst: [],
    text: {
      generic: [
        "You brace behind the {WORD}; the next blow will land softer.",
        "The {WORD} locks into place before you.",
      ],
    },
  },
  food: {
    id: "food",
    baseBonus: { damage: 1, heal: 2 },
    strongAgainst: [],
    weakAgainst: [],
    text: {
      generic: [
        "You wolf down the {WORD} and recover a little strength.",
        "The {WORD} appears just long enough to help.",
        "Questionable dungeon hygiene, but the {WORD} restores you.",
      ],
    },
  },
  poison: {
    id: "poison",
    baseBonus: { damage: 2, status: "poison" },
    strongAgainst: ["flesh", "beast", "goblin", "plant"],
    weakAgainst: ["skeleton", "undead", "construct", "stone"],
    text: {
      generic: [
        "Venom seeps from the {WORD} and works into the wound.",
        "A sick green haze rises off the {WORD}.",
      ],
      strong: ["The {WORD} takes hold fast; the creature staggers, sickened."],
      resisted: [
        "The {WORD} drips venom, but there's nothing living left in it to poison.",
      ],
    },
  },
  dark: {
    id: "dark",
    baseBonus: { damage: 2, status: "curse" },
    strongAgainst: ["flesh", "beast"],
    weakAgainst: ["holy", "undead", "demon"],
    text: {
      generic: [
        "The {WORD} pours shadow that clings to the enemy.",
        "The {WORD} drinks the light around it and lashes out.",
      ],
      strong: ["The {WORD} smothers the creature; it flails, blinded."],
      resisted: ["The {WORD} recognizes its own and does little."],
    },
  },
  ice: {
    id: "ice",
    baseBonus: { damage: 2, status: "freeze" },
    strongAgainst: ["plant", "beast", "slime"],
    weakAgainst: ["fire"],
    text: {
      generic: [
        "The {WORD} frosts over and cold cracks outward.",
        "A rime spreads from the {WORD}.",
      ],
      strong: ["The {WORD} stiffens the creature half-frozen mid-lunge."],
      resisted: ["The {WORD} melts off it without slowing it."],
    },
  },
  water: {
    id: "water",
    baseBonus: { damage: 1, status: "soak" },
    strongAgainst: ["fire", "slime", "construct"],
    weakAgainst: ["plant"],
    text: {
      generic: [
        "The {WORD} crashes out in a wave.",
        "The {WORD} rushes the enemy in a cold flood.",
      ],
      strong: ["The {WORD} quenches and staggers the burning thing."],
      resisted: ["The {WORD} sheets off it and drains away."],
    },
  },
  tool: {
    id: "tool",
    baseBonus: { damage: 1, status: "pierce" },
    strongAgainst: ["armor", "construct"],
    weakAgainst: [],
    text: {
      generic: [
        "You put the {WORD} to work and pry an opening.",
        "The {WORD} finds the mechanism and jams it.",
      ],
      strong: ["The {WORD} slips into a joint and wrenches it apart."],
    },
  },
  treasure: {
    id: "treasure",
    baseBonus: { damage: 1, gold: 3 },
    strongAgainst: [],
    weakAgainst: ["goblin"],
    text: {
      generic: [
        "The {WORD} glitters into coin; you pocket a little.",
        "The {WORD} spills treasure — useful and shiny.",
      ],
      resisted: ["The greedy thing lunges for the {WORD}, unbothered by the hit."],
    },
  },
  nature: {
    id: "nature",
    baseBonus: { damage: 1, status: "root" },
    strongAgainst: ["construct", "undead"],
    weakAgainst: ["fire"],
    text: {
      generic: [
        "The {WORD} bursts into root and bramble and grabs hold.",
        "The {WORD} grows wild and thorny in an instant.",
      ],
      strong: ["The {WORD} seizes the creature and wrenches it down."],
    },
  },
  beastly: {
    id: "beastly",
    baseBonus: { damage: 2 },
    strongAgainst: ["flesh", "goblin"],
    weakAgainst: ["holy"],
    text: {
      generic: [
        "The {WORD} turns fang and claw and tears in.",
        "The {WORD} answers feral and mauls the enemy.",
      ],
      strong: ["The {WORD} closes its jaws and rips a chunk free."],
    },
  },
};

// ── curated word → category lists ────────────────────────────────────────────
// Authored by hand and kept broad so the effect feels natural, not gimmicky.
// EVERY word here is verified against ENABLE by scripts/dungeon-check.js — if
// one isn't a real playable word it gets flagged and removed. All UPPERCASE at
// lookup time (source kept lowercase for readability).
const WORD_LISTS = {
  weapon: [
    "sword", "blade", "axe", "dagger", "knife", "spear", "lance", "sabre", "saber",
    "rapier", "cutlass", "scimitar", "machete", "glaive", "halberd", "poniard",
    "pike", "javelin", "arrow", "dart", "sling", "whip", "flail", "sickle",
    "scythe", "cleaver", "bayonet", "trident", "harpoon", "shiv", "stiletto",
    "broadsword", "claymore", "falchion", "kris", "bolo", "edge", "point",
    "assegai", "kukri", "yatagan", "sabres", "rapiers", "cutlasses",
    "blades", "swords", "knives", "spears", "arrows", "daggers", "axes", "lances",
    "hatchet", "tomahawk", "cutlass", "billhook", "partisan",
  ],
  blunt: [
    "hammer", "mace", "club", "cudgel", "mallet", "maul", "bat", "staff", "rod",
    "cane", "baton", "bludgeon", "sledge", "hammers", "clubs", "shillelagh",
    "brick", "stone", "rock", "boulder", "anvil", "fist", "knuckle", "pestle",
    "cobble", "cobblestone", "slab", "bricks", "stones", "rocks", "bash",
    "quarterstaff", "truncheon", "blackjack", "cosh", "knobkerrie",
    "boulders", "mauls", "maces", "cudgels", "bricks",
  ],
  piercing: [
    "needle", "pin", "awl", "nail", "spike", "thorn", "quill", "fang", "tusk",
    "talon", "beak", "spine", "barb", "prong", "skewer", "stake", "sting",
    "needles", "nails", "spikes", "thorns", "fangs", "talons", "barbs", "bodkin",
    "bradawl", "gimlet", "stinger", "caltrop", "goad", "lancet", "pricker",
  ],
  fire: [
    "fire", "flame", "torch", "ember", "blaze", "inferno", "pyre", "bonfire",
    "spark", "cinder", "coal", "flare", "scorch", "sear", "burn", "smoke",
    "lava", "magma", "furnace", "kiln", "candle", "lantern", "wildfire",
    "flames", "torches", "embers", "sparks", "cinders", "coals", "flares",
    "brimstone", "heat", "glow", "combust", "ignite", "smolder", "brand",
    "flambeau", "brazier", "cresset", "pyres", "wildfires",
    "firebrand", "kindle", "singe", "char", "blazes", "infernos",
  ],
  light: [
    "light", "sun", "sunlight", "sunshine", "ray", "beam", "glare", "gleam",
    "shine", "dawn", "daylight", "star", "starlight", "lamp", "beacon",
    "radiance", "luster", "glimmer", "lights", "beams", "rays", "stars",
    "flash", "spark", "halo", "aura", "prism", "dazzle", "lumen", "glint",
    "shimmer", "sunbeam", "corona", "nimbus", "gloaming", "aurora",
  ],
  holy: [
    "holy", "prayer", "angel", "relic", "saint", "blessing", "bless", "grace",
    "faith", "sacred", "divine", "temple", "shrine", "altar", "cross", "chapel",
    "psalm", "hymn", "amen", "halo", "seraph", "cleric", "priest", "monk",
    "sanctify", "hallow", "pilgrim", "chalice", "prayers", "angels", "saints",
    "creed", "gospel", "spirit", "soul", "heaven", "mercy", "pure", "purity",
    "cherub", "reliquary", "sanctum", "vestment", "censer", "sacrament",
    "benediction", "orison", "litany", "consecrate", "beatify", "vespers",
  ],
  magic: [
    "magic", "spell", "rune", "wand", "charm", "hex", "sigil", "glyph", "arcane",
    "enchant", "conjure", "sorcery", "wizardry", "witch", "wizard", "mage",
    "sorcerer", "warlock", "potion", "elixir", "incant", "curse", "jinx",
    "spells", "runes", "wands", "charms", "hexes", "glyphs", "scrolls",
    "familiar", "cauldron", "talisman", "amulet", "mystic", "occult", "philter",
    "thaumaturgy", "necromancy", "divination", "scrying", "evocation", "cantrip",
    "warlocks", "wizards", "sorcerers", "runic", "eldritch",
  ],
  defense: [
    "shield", "armor", "armour", "guard", "wall", "barrier", "bulwark", "ward",
    "aegis", "plate", "mail", "helm", "helmet", "buckler", "shell", "carapace",
    "fortress", "rampart", "bastion", "parapet", "shields", "walls", "guards",
    "gauntlet", "breastplate", "cover", "bunker", "barricade", "defend",
    "cuirass", "greaves", "pauldron", "vambrace", "brigandine", "hauberk",
    "palisade", "portcullis", "battlement", "redoubt",
  ],
  food: [
    // Everyday
    "apple", "bread", "meat", "honey", "stew", "soup", "cheese", "egg", "eggs",
    "fruit", "berry", "pear", "plum", "grape", "melon", "peach", "cherry",
    "cake", "pie", "tart", "roast", "bacon", "ham", "fish", "rice", "beans",
    "carrot", "potato", "turnip", "onion", "garlic", "nut", "acorn", "grain",
    "wheat", "corn", "milk", "cream", "butter", "jam", "loaf", "biscuit",
    "apples", "berries", "meats", "feast", "meal", "ration", "porridge", "broth",
    "mutton", "venison", "gravy", "pudding", "custard", "scone", "muffin",
    "pottage", "gruel", "hardtack", "jerky", "sausage", "pickle", "relish",
    // Clever / obscure fruits & dishes — dual-purpose (heal + rarity bonus)
    "durian", "persimmon", "kumquat", "lychee", "loquat", "quince", "medlar",
    "pomelo", "tamarind", "jujube", "damson", "rambutan", "guava",
    "papaya", "mango", "fig", "date", "raisin", "currant", "sultana",
    "pomegranate", "apricot", "nectarine", "satsuma", "citron",
    "plantain", "yam", "cassava", "taro", "leek", "parsnip", "radish", "kale",
    "lentil", "chickpea", "hummus", "falafel", "couscous", "risotto", "goulash",
    "kimchi", "sauerkraut", "chutney", "marmalade", "compote", "tapioca",
    "marzipan", "nougat", "praline", "brioche", "crumpet", "bannock", "damper",
  ],
  poison: [
    "poison", "venom", "toxin", "bane", "blight", "plague", "rot", "decay",
    "sludge", "bile", "acid", "corrode", "fester", "spore", "mold", "fungus",
    "hemlock", "nightshade", "arsenic", "cyanide", "toxic", "noxious", "putrid",
    "venoms", "toxins", "spores", "poisons", "miasma", "corruption", "ooze",
    "wormwood", "belladonna", "henbane", "mandrake", "toadstool", "pestilence",
    "gangrene", "necrosis", "virulent", "septic", "canker", "murrain",
  ],
  dark: [
    "shadow", "dark", "darkness", "night", "gloom", "murk", "void", "abyss",
    "nether", "shade", "dusk", "midnight", "eclipse", "black", "raven", "crow",
    "grave", "tomb", "crypt", "specter", "phantom", "wraith", "shadows",
    "dread", "doom", "bane", "sinister", "wicked", "evil", "cursed", "grim",
    "umbra", "penumbra", "stygian", "tenebrous", "sepulcher",
    "necropolis", "shroud", "pall", "obsidian", "nocturne", "eventide",
  ],
  ice: [
    "ice", "frost", "snow", "cold", "chill", "freeze", "glacier", "hail",
    "sleet", "icicle", "blizzard", "winter", "rime", "frozen", "arctic",
    "shiver", "numb", "icy", "snowflake", "frostbite", "iceberg", "floe",
    "frosts", "icicles", "snows", "glaciers", "hoarfrost", "permafrost",
    "tundra", "glacial", "hailstone", "snowdrift", "flurry", "gelid",
  ],
  water: [
    "water", "wave", "flood", "rain", "river", "stream", "ocean", "sea", "tide",
    "torrent", "deluge", "surge", "splash", "spray", "geyser", "current",
    "brook", "creek", "pond", "lake", "puddle", "drench", "soak", "wash",
    "waves", "floods", "rivers", "streams", "waters", "downpour", "monsoon",
    "cascade", "cataract", "maelstrom", "riptide", "undertow", "billow",
    "freshet", "estuary", "rivulet", "spume", "brine", "tsunami",
  ],
  tool: [
    "key", "lever", "crowbar", "wrench", "pliers", "chisel", "saw", "drill",
    "pick", "pickaxe", "shovel", "spade", "hook", "rope", "chain", "clamp",
    "vise", "wedge", "screw", "bolt", "hinge", "gear", "cog", "file", "rasp",
    "keys", "chains", "hooks", "levers", "tongs", "auger", "gimlet",
    "mattock", "trowel", "plumb", "caliper", "ratchet", "spanner", "grapnel",
    "winch", "pulley", "fulcrum", "skeleton",
  ],
  treasure: [
    "coin", "gold", "silver", "gem", "jewel", "ruby", "emerald", "diamond",
    "pearl", "sapphire", "topaz", "opal", "amber", "crown", "chest", "hoard",
    "loot", "bounty", "riches", "treasure", "coins", "gems", "jewels", "gilt",
    "bullion", "ingot", "trove", "fortune", "wealth", "prize", "medallion",
    "doubloon", "ducat", "florin", "guilder", "sovereign", "specie", "lucre",
    "garnet", "amethyst", "beryl", "jade", "onyx", "carnelian", "scepter",
  ],
  nature: [
    "vine", "root", "branch", "thorn", "bramble", "briar", "leaf", "moss",
    "ivy", "bark", "wood", "timber", "forest", "grove", "seed", "sprout",
    "bloom", "flower", "petal", "grass", "reed", "fern", "oak", "elm", "birch",
    "vines", "roots", "branches", "thorns", "leaves", "trees", "bushes", "weed",
    "lichen", "bracken", "nettle", "thistle", "creeper", "tendril", "sapling",
    "underbrush", "thicket", "coppice", "verdure", "foliage", "willow", "alder",
  ],
  beastly: [
    "wolf", "bear", "lion", "tiger", "boar", "hound", "fang", "claw", "beast",
    "hawk", "eagle", "falcon", "serpent", "snake", "viper", "cobra", "shark",
    "wolves", "bears", "lions", "claws", "fangs", "jaws", "maw", "brute",
    "raptor", "predator", "hunter", "pack", "swarm", "horde", "ram", "bull",
    "lynx", "panther", "jackal", "hyena", "badger", "wolverine", "mastiff",
    "behemoth", "leviathan", "chimera", "manticore", "basilisk", "wyvern",
  ],
};

// Build the flat lookup map ONCE. Later categories don't override earlier ones:
// a word listed in two buckets keeps its FIRST assignment (source order above),
// which is intentional (e.g. "thorn" → piercing before nature).
let _lookup = null;
function lookup() {
  if (!_lookup) {
    _lookup = new Map();
    for (const [cat, words] of Object.entries(WORD_LISTS)) {
      for (const w of words) {
        const key = w.toUpperCase();
        if (!_lookup.has(key)) _lookup.set(key, cat);
      }
    }
  }
  return _lookup;
}

// Exposed for scripts/dungeon-check.js to validate every effect word is real
// and to report duplicates. Returns { word, category } rows.
export function allEffectWords() {
  const rows = [];
  const seen = new Set();
  for (const [cat, words] of Object.entries(WORD_LISTS)) {
    for (const w of words) {
      const key = w.toUpperCase();
      rows.push({ word: key, category: cat, dupe: seen.has(key) });
      seen.add(key);
    }
  }
  return rows;
}

// The raw category a word maps to, or null. (Cabinet uses this to hint the
// player a word "feels" like something.)
export function effectCategoryOf(word) {
  return lookup().get((word || "").toUpperCase()) || null;
}

// Small deterministic pick from a list given a seed (so the daily turn reads the
// same for everyone). Falls back to index 0 for an empty/absent list.
function pick(list, seed) {
  if (!list || !list.length) return null;
  return list[(seed >>> 0) % list.length];
}

/* Resolve a word's semantic effect against an enemy.

   `enemy` may carry: kindTags[] (what it IS — "skeleton","undead",…),
   weaknessTags[] and resistanceTags[] (effect categories it's weak/strong to).
   `seed` makes flavor deterministic. Returns null if the word has no effect
   (plain strike). */
export function resolveWordEffect(word, enemy = {}, seed = 0) {
  const cat = effectCategoryOf(word);
  if (!cat) return null;
  const def = EFFECT_CATEGORIES[cat];
  if (!def) return null;

  const kinds = new Set(enemy.kindTags || []);
  const weakTo = new Set(enemy.weaknessTags || []); // categories the enemy fears
  const resistTo = new Set(enemy.resistanceTags || []); // categories it shrugs off

  const base = def.baseBonus || {};
  let damageBonus = base.damage || 0;
  let heal = base.heal || 0;
  let block = base.block || 0;
  let gold = base.gold || 0;
  let status = base.status || null;
  let weaknessBonus = 0;
  let resisted = false;

  // Category strong against this enemy KIND → weakness bonus.
  const strong = (def.strongAgainst || []).some((t) => kinds.has(t));
  const catWeak = (def.weakAgainst || []).some((t) => kinds.has(t));

  // Enemy explicitly weak to / resistant to this category.
  if (weakTo.has(cat)) weaknessBonus += 2;
  if (strong) weaknessBonus += 1;

  if (resistTo.has(cat) || catWeak) {
    resisted = true;
    // Dampen: drop the category damage bonus and any status/heal payload.
    damageBonus = Math.max(0, Math.floor(damageBonus / 2));
    weaknessBonus = 0;
    status = null;
  }

  // Choose the flavor bucket, then weave the actual word in: any "{WORD}"
  // placeholder is replaced with the played word (lines without it still work).
  let bucket = def.text.generic;
  if (resisted && def.text.resisted) bucket = def.text.resisted;
  else if ((strong || weakTo.has(cat)) && def.text.strong) bucket = def.text.strong;
  const raw = pick(bucket, seed) || pick(def.text.generic, seed) || "";
  const text = raw.replace(/\{WORD\}/g, (word || "").toUpperCase());

  return {
    category: cat,
    damageBonus,
    weaknessBonus,
    heal,
    block,
    gold,
    status,
    resisted,
    text,
  };
}
