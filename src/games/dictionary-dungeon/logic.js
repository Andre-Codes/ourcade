/* DICTIONARY DUNGEON — pure run logic (node-pure). The heart of the game.

   No React, no DOM: the same module assembles the day's dungeon, resolves a
   typed word into damage + flavor, scores a run, and (de)serializes a save —
   for BOTH the playable cabinet (DictionaryDungeon.jsx) and the headless
   validator (scripts/dungeon-check.js). That guarantees every surface agrees on
   exactly what today's dungeon is and how a word plays out.

   buildRun(dayKey) deterministically draws rooms/enemies/rules/boss/relics from
   the authored pools (pools.js) using the same date-seeded PRNG the rest of the
   site uses (src/lib/daily.js). Practice mode calls buildRun(null) with a random
   seed. resolveTurn(state, word) validates the word (dict.js), checks the room
   rule (rules.js), computes damage (length + rare-letter + rarity + word-effect
   + relics), applies the enemy counterattack, and returns log lines. */

import {
  rotateDaily,
  dayNumberFromKey,
  daySeed,
  mulberry32,
  seededShuffle,
} from "../../lib/daily.js";
import { isWord, rarityTier, commonRank } from "./dict.js";
import { getRule } from "./rules.js";
import { resolveWordEffect, effectCategoryOf } from "./effects.js";
import {
  FIRST_WORD_TITLES,
  firstWordOmen,
  sequenceBadge,
  ALL_TITLES,
  ALL_OMENS,
  ALL_BADGES,
} from "./titles.js";
import {
  LEVELS,
  ENEMIES,
  ENEMY_BY_ID,
  BOSSES,
  BOSS_BY_ID,
  RELICS,
  RELIC_BY_ID,
  SCROLLS,
  SCROLL_BY_ID,
  FLAVOR,
  MERCHANT_STOCK,
  EVENTS,
} from "./pools.js";

// Re-exported so the render-only cabinet can resolve owned relic/scroll ids to
// their display metadata without importing pools.js directly.
export { RELICS, RELIC_BY_ID, SCROLLS, SCROLL_BY_ID };

// Re-exported so the title screen can show the full titles/omens/badges catalog
// (with locked "???" entries) WITHOUT statically importing titles.js — which
// pulls the big dictionary. The cabinet only reads these once `logic` has loaded.
export { ALL_TITLES, ALL_OMENS, ALL_BADGES };

const DUNGEON_SALT = 0x4444; // "DD" — independent daily rotation order
const EPOCH_KEY = "2026-06-01"; // anchors the small human "Dungeon #N"

export const START_HEARTS = 5;
export const START_COINS = 0;
const RARE_LETTERS = new Set(["J", "Q", "X", "Z"]);

// ── gibberish penalty ─────────────────────────────────────────────────────────
// "Sticks and stones…" — here, nonsense FEEDS the enemy. A gibberish word (fails
// the dictionary) played while a live enemy/boss is present heals it +1 HP (never
// above its max), so spamming junk is actively bad. Capped per room so a fed
// enemy can never become unkillable (the auto-solver never types gibberish, so
// the solvability gate is unaffected — the cap is purely to keep real play fair).
const GIBBERISH_HEAL = 1;
const GIBBERISH_CAP = 3; // max HP an enemy can regain from gibberish per room

// ── blocking ──────────────────────────────────────────────────────────────────
// A defense-category word (shield/parry/block/…) raises a BLOCK that negates the
// NEXT enemy counterattack, then goes on cooldown so you can't block every turn.
// Cooldown length / block strength are computed from state so future relics or
// scrolls can modify them (e.g. a shorter cooldown or a cooldown-ignoring block).
const BLOCK_COOLDOWN = 3; // turns before another block can be raised
function blockCooldownFor(state) {
  // Hook point: relics/scrolls could lower this. Default fixed for now.
  return BLOCK_COOLDOWN;
}
// Damage reduction applied to a blocked counterattack (1 = full negate).
function blockStrengthFor(state) {
  return 1; // full block for now; a partial-block relic could return <1.
}

// Hidden word Easter eggs. These aren't real ENABLE words, so they never pass
// the dictionary gate — we intercept them BEFORE isWord() and answer with a
// wink instead of the generic "not a word" line. Purely flavor: the turn is
// still a whiff (no damage, no heart lost), like any unrecognized word.
const EGG_WORDS = {
  SWEETROLL: "> A sweetroll materializes, then vanishes. …Let me guess. Someone stole it?",
  SWEETROLLS: "> A whole tray of sweetrolls, gone in a blink. The guards would have questions.",
};

// Effect category → FLAVOR bucket for a repeated (already-spent) word, so
// replaying SWORD reads differently from replaying APPLE. Categories not listed
// fall through to the generic `repeat` bucket.
const REPEAT_BUCKET_BY_CATEGORY = {
  weapon: "repeatWeapon",
  piercing: "repeatWeapon",
  blunt: "repeatBlunt",
  food: "repeatFood",
  magic: "repeatMagic",
  fire: "repeatFire",
  holy: "repeatHoly",
};

// ── run number ────────────────────────────────────────────────────────────────
export function dungeonNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

// ── seeded helpers ────────────────────────────────────────────────────────────
// A small deterministic picker bound to a seed stream, so a whole run assembles
// reproducibly. Returns { pick, pickN, shuffle, rand, int }.
function stream(seed) {
  const rand = mulberry32(seed >>> 0);
  const int = (n) => Math.floor(rand() * n);
  return {
    rand,
    int,
    pick: (arr) => arr[int(arr.length)],
    pickN: (arr, n) => seededShuffle(arr, (seed ^ arr.length) >>> 0).slice(0, n),
    shuffle: (arr) => seededShuffle(arr, seed >>> 0),
  };
}

// Non-boss room types the assembler places. Every level gets at least one
// gate + one monster + one reward (treasure), per the design's assembly rules.
// From Level 2 (levelIdx >= 1) on, a merchant and/or an event may also appear,
// capped at ≤1 each so pacing stays clean. `dayKey` (or a seed) rotates the
// FIRST room's rule so the very first thing a player faces differs day to day.
function assembleRooms(level, levelIdx, dayKey, s) {
  const n = level.roomCount;
  const types = [];
  // Guaranteed beats.
  types.push("gate");
  types.push("monster");
  types.push("treasure");
  // Fill the rest. From Level 2 on, allow one merchant + one event; never more
  // than one trap. Favor monsters otherwise.
  let traps = 0;
  let merchants = 0;
  let events = 0;
  const canExtra = levelIdx >= 1;
  // Merchant frequency: a deterministic per-level ~70% intent (over the ~5
  // eligible levels ⇒ most runs see a merchant on most floors, so the coins you
  // earn per word actually get spent). Placed BEFORE the fill loop and capped at
  // one, so a level can never exceed a single merchant.
  if (canExtra && s.rand() < 0.7 && types.length < n) {
    types.push("merchant");
    merchants++;
  }
  while (types.length < n) {
    const r = s.rand();
    // (merchant is no longer placed here — guaranteed above)
    if (canExtra && r < 0.24 && events < 1) {
      types.push("event");
      events++;
    } else if (r < 0.44 && traps < 1) {
      types.push("trap");
      traps++;
    } else if (r < 0.72) types.push("monster");
    else types.push("gate");
  }
  const order = s.shuffle(types);

  // The FIRST room of every level (and so the very first room of the whole run)
  // must be a real WORD room — never a treasure/merchant/event as the opener. A
  // gate + a monster are always in the pool, so a word room always exists to swap
  // in. This runs BEFORE rule assignment (which keys off position 0's opener).
  const WORD_ROOMS = new Set(["gate", "monster", "trap"]);
  if (!WORD_ROOMS.has(order[0])) {
    const j = order.findIndex((t) => WORD_ROOMS.has(t));
    if (j > 0) [order[0], order[j]] = [order[j], order[0]];
  }

  // Assign rules so EARLIER rooms are easier and LATER rooms harder (and later
  // LEVELS skew harder overall). We only REORDER which of this level's already-
  // validated ruleSpecs lands in which room, so every room's rule stays solvable.
  const DIFF_RANK = { easy: 0, medium: 1, hard: 2 };
  const rankOf = (spec) => DIFF_RANK[getRule(spec).difficulty] ?? 1;
  // Sort the pool easy→hard, seeded within-tier order (deterministic, daily-varied).
  const sortedPool = s
    .shuffle(level.ruleSpecs)
    .map((spec, k) => ({ spec, rank: rankOf(spec), k }))
    .sort((a, b) => a.rank - b.rank || a.k - b.k)
    .map((o) => o.spec);
  const P = sortedPool.length;
  const L = LEVELS.length;
  const levelBias = L > 1 ? levelIdx / (L - 1) : 0; // 0 (first level) … 1 (last)
  const usedSpecs = new Set();
  // Nearest-unused spec outward from a target pool index (repeat only if the pool
  // is exhausted — matching the old round-robin's fallback).
  const pickAt = (idx) => {
    for (let d = 0; d < P; d++) {
      for (const cand of d === 0 ? [idx] : [idx + d, idx - d]) {
        if (cand < 0 || cand >= P) continue;
        const spec = sortedPool[cand];
        if (!usedSpecs.has(spec)) { usedSpecs.add(spec); return spec; }
      }
    }
    return sortedPool[Math.max(0, Math.min(P - 1, idx))];
  };
  // Map room position i → pool index: in-level ramp blended with cross-level lift,
  // plus a tiny seeded jitter (breaks within-tier ties, never crosses a tier).
  const ruleForRoom = (i) => {
    const posFrac = n > 1 ? i / (n - 1) : 0;
    const blend = 0.65 * posFrac + 0.35 * levelBias;
    const f = blend * (P - 1) + (s.rand() - 0.5);
    const idx = Math.max(0, Math.min(P - 1, Math.round(f)));
    return pickAt(idx);
  };

  const enemyPool = s.shuffle(level.enemyIds);
  let enemyIdx = 0;
  const nextEnemy = () => enemyPool[enemyIdx++ % enemyPool.length];

  // For Entry Hall (levelIdx 0), the FIRST room's rule rotates by day so the
  // opening isn't always the same. rotateDaily over the level's rule pool gives
  // a different opener each day while staying deterministic. (It stays easy —
  // it's drawn from the Entry Hall pool — so room 0 is never forced hard.)
  const openerRule =
    levelIdx === 0 && dayKey ? rotateDaily(level.ruleSpecs, dayKey, DUNGEON_SALT ^ 0x0110) : null;
  if (openerRule) usedSpecs.add(openerRule); // later rooms won't duplicate it

  return order.map((type, i) => {
    const room = {
      idx: i,
      type,
      ruleSpec: i === 0 && openerRule ? openerRule : ruleForRoom(i),
      intro: s.pick(level.intros),
    };
    if (type === "monster" || type === "trap") {
      const e = ENEMY_BY_ID[nextEnemy()];
      room.enemyId = e.id;
      room.enemyHP = e.baseHP;
      room.enemyMaxHP = e.baseHP;
    }
    if (type === "treasure") {
      room.relicChoices = s.pickN(RELICS, 3).map((r) => r.id);
    }
    if (type === "merchant") {
      // Seeded stock of 4 offers, priced with a mild per-level markup. Always
      // include ONE healing potion (reliable survival triage) AND ONE relic
      // (relics are now a paid purchase alongside the free treasure room); the
      // remaining slots fill from the rest of the catalog.
      const markup = 1 + levelIdx * 0.15;
      const HEAL_IDS = new Set(["buy-minor-heal", "buy-heal", "buy-greater-heal"]);
      const heals = MERCHANT_STOCK.filter((m) => HEAL_IDS.has(m.id));
      const relicStock = MERCHANT_STOCK.filter((m) => m.kind === "relic");
      const chosen = [];
      chosen.push(s.pick(heals));
      if (relicStock.length) chosen.push(s.pick(relicStock));
      const chosenIds = new Set(chosen.map((m) => m.id));
      const rest = s.pickN(
        MERCHANT_STOCK.filter((m) => !chosenIds.has(m.id)),
        Math.max(0, 4 - chosen.length)
      );
      room.offers = s.shuffle([...chosen, ...rest]).slice(0, 4).map((m) => ({
        ...m,
        price: Math.max(1, Math.round(m.basePrice * markup)),
        sold: false,
      }));
    }
    if (type === "event") {
      room.event = s.pick(EVENTS);
      room.eventResolved = false;
    }
    return room;
  });
}

/* Build the whole run for a day key (or a random practice run when dayKey is
   null). Returns the initial game STATE. */
export function buildRun(dayKey) {
  const daily = !!dayKey;
  const baseSeed = daily
    ? daySeed(`${dayKey}|${DUNGEON_SALT}`)
    : (Math.floor(Math.random() * 0xffffffff) >>> 0);
  const s = stream(baseSeed);

  const levels = LEVELS.map((level, li) => {
    const ls = stream((baseSeed ^ daySeed(`${level.id}|${li}`)) >>> 0);
    const rooms = assembleRooms(level, li, dayKey, ls);
    return {
      id: level.id,
      name: level.name,
      accent: level.accent,
      tone: level.tone,
      rooms,
      bossId: level.bossId,
      totalRooms: rooms.length + 1, // + boss
    };
  });

  return {
    v: SAVE_VERSION,
    mode: daily ? "daily" : "practice",
    dayKey: dayKey || null,
    seed: baseSeed,
    hearts: START_HEARTS,
    maxHearts: START_HEARTS,
    coins: START_COINS,
    relics: [], // relic ids owned — start EMPTY (earned/bought in-run)
    scrolls: [], // scroll ids owned — start EMPTY (bought at merchants)
    levelIdx: 0,
    roomIdx: 0, // index into level.rooms; === rooms.length means BOSS
    bossPhase: 0,
    levels,
    prevWord: null, // for memory rules (per room reset)
    words: [], // every accepted word this run (for recap)
    used: [], // UPPERCASE words already played (no-repeat across the run)
    title: null, // { title, revealText } earned from the first valid word (cosmetic)
    badges: [], // starting-secret omens/badges earned in the first few words (cosmetic)
    // per-level flags for relic once-per-level effects
    levelFlags: {},
    roomFails: 0, // wrong-word count in the CURRENT room (rule-fail penalty)
    gibberishFed: 0, // HP the current enemy has regained from gibberish this room
    famished: false, // set while a food-sealing enemy is alive in this room
    blockCooldown: 0, // turns until a defense-word BLOCK can be raised again
    over: false,
    won: false,
    deathCause: null,
    canDescend: false, // set when the current run's last level is cleared (endless prompt)
    clearedBase: false, // the fixed 6-level dungeon has been beaten at least once
    descentCycle: 0, // how many endless floors descended past the base dungeon
    // transient scroll effects queued for the next turn
    pending: {}, // e.g. { bonusDamage: 6, forgiveFail: true, clearRule: true }
    log: [],
  };
}

// ── endless mode (post-Lich) ────────────────────────────────────────────────
// After the fixed six levels, the run can DESCEND into escalating endless floors
// ("who can last the longest"). Each descent appends one new level with a punny
// name, the hardest rule pools, a mixed enemy roster, and a difficulty BAND that
// scales enemy/boss HP + damage. Occasional cycles are "spikes" (elite floors).
const ENDLESS_NAMES = [
  "The Deeper Lexicon", "The Unabridged Depths", "The Apocrypha",
  "The Errata Abyss", "The Marginalia", "The Lost Appendix",
  "The Redacted Index", "The Endless Errata", "Appendix ∞",
];
const ENDLESS_ACCENTS = ["#b06b6b", "#8f6bb0", "#6f8f8a", "#5fae7a", "#c9a24a"];

// A synthetic endless "level" fed to assembleRooms: hardest rules + all enemies.
function endlessLevelTemplate(cycle) {
  const hardPool = LEVELS[LEVELS.length - 1].ruleSpecs; // Final Lexicon (hardest)
  return {
    id: `endless-${cycle}`,
    name: ENDLESS_NAMES[(cycle - 1) % ENDLESS_NAMES.length],
    accent: ENDLESS_ACCENTS[(cycle - 1) % ENDLESS_ACCENTS.length],
    roomCount: 5,
    tone: "a depth the dictionary was never meant to hold",
    intros: [
      "You descend past the last page into something unpaginated.",
      "The words down here were struck from every edition. They remember being read.",
      "Deeper. The dark turns each letter over, weighing you.",
    ],
    ruleSpecs: hardPool,
    enemyIds: ENEMIES.map((e) => e.id), // full roster
    bossId: BOSSES[(cycle - 1) % BOSSES.length].id, // rotate bosses
  };
}

/* Descend one endless floor: append a scaled level and drop the player into it.
   Called by the cabinet when the player chooses "Descend Deeper". Mutates state. */
export function descend(state) {
  const out = { ok: true, logLines: [] };
  const cycle = (state.descentCycle || 0) + 1;
  state.descentCycle = cycle;
  const template = endlessLevelTemplate(cycle);

  // Difficulty band: HP + damage grow per cycle, with an "elite" spike every 3rd
  // floor. Deterministic from the run seed so a daily endless is shared.
  const spike = cycle % 3 === 0 ? 1.35 : 1;
  const hpBand = (1 + cycle * 0.35) * spike;
  const dmgBand = 1 + Math.floor(cycle / 2) * 0.5; // damage steps up every 2 floors

  const ls = stream((state.seed ^ daySeed(`endless|${cycle}`)) >>> 0);
  const rooms = assembleRooms(template, LEVELS.length + cycle - 1, state.dayKey, ls);
  // Bake scaled enemy HP into the rooms (damage is scaled at read-time by band).
  for (const room of rooms) {
    if (room.enemyHP != null) {
      room.enemyHP = Math.round(room.enemyHP * hpBand);
      room.enemyMaxHP = Math.round(room.enemyMaxHP * hpBand);
    }
  }
  state.levels.push({
    id: template.id,
    name: template.name,
    accent: template.accent,
    tone: template.tone,
    rooms,
    bossId: template.bossId,
    totalRooms: rooms.length + 1,
    endless: true,
    hpBand,
    dmgBand,
  });

  // Enter the new level.
  state.levelIdx = state.levels.length - 1;
  state.roomIdx = 0;
  state.bossPhase = 0;
  state.canDescend = false;
  state.prevWord = null;
  state.roomFails = 0;
  state.blockCooldown = 0;
  delete state.pending.blockNext;
  delete state.bossHP;
  if (state.relics.includes("second-wind")) {
    state.hearts = Math.min(state.maxHearts, state.hearts + 1);
  }
  out.logLines.push(`> You descend into ${template.name}.${spike > 1 ? " Something far stronger stirs here." : ""}`);
  syncRoomEntry(state);
  return out;
}

/* End the run here (bank the score) after a clear, instead of descending. */
export function endRun(state) {
  state.canDescend = false;
  state.over = true;
  return { ok: true };
}

// ── current-room resolution ──────────────────────────────────────────────────
export function currentLevel(state) {
  return state.levels[state.levelIdx] || null;
}
export function isBossRoom(state) {
  const lvl = currentLevel(state);
  return lvl && state.roomIdx >= lvl.rooms.length;
}
export function currentRoom(state) {
  const lvl = currentLevel(state);
  if (!lvl) return null;
  if (state.roomIdx < lvl.rooms.length) return lvl.rooms[state.roomIdx];
  return null; // boss — use currentBoss
}
export function currentBoss(state) {
  const lvl = currentLevel(state);
  if (!lvl || !isBossRoom(state)) return null;
  return BOSS_BY_ID[lvl.bossId] || null;
}

// The active enemy/target descriptor for the current step: a room enemy, a boss
// phase, or null for a gate/treasure/trap with no HP. Includes the rule spec.
export function currentTarget(state) {
  // Endless levels (past the fixed 6) carry a difficulty band that scales enemy/
  // boss HP + damage; fixed levels have no band (multiplier 1).
  const lvlNow = currentLevel(state);
  const hpBand = lvlNow?.hpBand || 1;
  const dmgBand = lvlNow?.dmgBand || 1;
  if (isBossRoom(state)) {
    const boss = currentBoss(state);
    if (!boss) return null;
    const phase = boss.phases[state.bossPhase] || boss.phases[boss.phases.length - 1];
    const phaseMax = Math.round(phase.hp * hpBand);
    return {
      kind: "boss",
      name: boss.name,
      emoji: boss.emoji,
      hp: state.bossHP ?? phaseMax,
      maxHP: phaseMax,
      damage: Math.max(1, Math.round(boss.damage * dmgBand)),
      kindTags: boss.kindTags,
      weaknessTags: boss.weaknessTags,
      resistanceTags: boss.resistanceTags,
      intent: phase.intent,
      ruleSpec: phase.ruleSpec,
      phase: state.bossPhase,
      phaseCount: boss.phases.length,
    };
  }
  const room = currentRoom(state);
  if (!room) return null;
  const rule = getRule(room.ruleSpec);
  if (room.type === "monster" || room.type === "trap") {
    const e = ENEMY_BY_ID[room.enemyId];
    return {
      kind: room.type,
      name: e.name,
      emoji: e.emoji,
      hp: room.enemyHP,
      maxHP: room.enemyMaxHP,
      // Enemy HP is baked into the room at assembly (scaled there for endless);
      // damage is scaled here by the level's band.
      damage: Math.max(1, Math.round(e.damage * dmgBand)),
      kindTags: e.kindTags,
      weaknessTags: e.weaknessTags,
      resistanceTags: e.resistanceTags,
      sealsFood: !!e.sealsFood,
      intent: e.intents ? e.intents[0] : "",
      ruleSpec: room.ruleSpec,
    };
  }
  // gate / treasure — a pure rule (no enemy).
  return {
    kind: room.type,
    name: null,
    ruleSpec: room.ruleSpec,
    hp: null,
  };
}

export function activeRule(state) {
  const t = currentTarget(state);
  return t ? getRule(t.ruleSpec) : getRule("any");
}

// Banded max HP for a boss phase (endless levels scale it; fixed levels = raw).
function bossPhaseMaxHP(state, boss, phaseIdx) {
  const lvl = currentLevel(state);
  const band = lvl?.hpBand || 1;
  const phase = boss.phases[phaseIdx] || boss.phases[boss.phases.length - 1];
  return Math.round(phase.hp * band);
}

// ── damage formula ────────────────────────────────────────────────────────────
function rareLetterBonus(w) {
  let b = 0;
  for (const ch of w) if (RARE_LETTERS.has(ch)) b += 3;
  return b;
}
function rarityBonus(tier) {
  return tier === "goblin" ? 4 : tier === "obscure" ? 2 : tier === "familiar" ? 1 : 0;
}

// Coins earned for an ACCEPTED word: length + rarity, so word quality (not just
// clearing rooms) drives the run's economy. A short common word is worth a coin
// or two; a long/rare word pays real money. Not scaled by depth — the merchant
// prices aren't scaled either, so a good vocabulary is always the way to afford
// things. (Clears still grant a token bonus in awardClear.)
function coinsForWord(w, tier) {
  let c = Math.floor(w.length / 2); // 4→2, 6→3, 8→4, 10→5
  c += tier === "goblin" ? 4 : tier === "obscure" ? 2 : tier === "familiar" ? 1 : 0;
  return c;
}

// Apply owned-relic modifiers to a computed hit. Mutates `parts` (a list of
// {label, amount}) and returns extra {heal, coins}. `state` used for
// once-per-level flags.
function applyRelics(state, w, tier, effectCat, parts, ctx) {
  let heal = 0;
  let coins = 0;
  const has = (id) => state.relics.includes(id);
  const flag = (k) => `${state.levelIdx}:${k}`;

  if (has("rusty-quill") && w.length >= 6) parts.push({ label: "Rusty Quill", amount: 2 });
  if (has("ink-dagger") && w.length === 4) parts.push({ label: "Ink Dagger", amount: 3 });
  if (has("thesaurus-shard") && w.length >= 5) parts.push({ label: "Thesaurus Shard", amount: 1 });
  if (has("goblin-dictionary") && (tier === "obscure" || tier === "goblin")) {
    const base = parts.reduce((a, p) => a + p.amount, 0);
    parts.push({ label: "Goblin Dictionary", amount: Math.ceil(base * 0.5) });
  }
  if (has("scrabble-tile") && /[JQXZ]/.test(w)) parts.push({ label: "Scrabble Tile", amount: 4 });
  if (has("whetstone") && effectCat === "weapon") parts.push({ label: "Whetstone", amount: 2 });
  if (has("tinderbox") && effectCat === "fire") parts.push({ label: "Tinderbox", amount: 2 });
  if (has("reliquary") && effectCat === "holy") parts.push({ label: "Reliquary", amount: 2 });
  if (has("poisoners-ring") && effectCat === "poison") parts.push({ label: "Poisoner's Ring", amount: 2 });
  if (has("frost-lens") && effectCat === "ice") parts.push({ label: "Frost Lens", amount: 2 });
  if (has("silver-fang") && effectCat === "beastly") parts.push({ label: "Silver Fang", amount: 2 });
  if (has("runed-anvil") && effectCat === "blunt") parts.push({ label: "Runed Anvil", amount: 2 });
  if (has("short-blade") && w.length <= 4) parts.push({ label: "Short Blade", amount: 2 });
  if (has("goblin-lens") && tier === "goblin") parts.push({ label: "Goblin Lens", amount: 6 });
  if (has("commoners-cloak") && tier === "common" && !state.levelFlags[flag("cloak")]) {
    state.levelFlags[flag("cloak")] = true;
    heal += 1;
  }
  if (has("vowel-crown") && countVowelsIn(w) >= 3 && !state.levelFlags[flag("vcrown") + state.roomIdx]) {
    state.levelFlags[flag("vcrown") + state.roomIdx] = true;
    heal += 1;
  }
  if (has("palindrome-coin") && /(.)\1/.test(w)) coins += 2;

  return { heal, coins };
}

function countVowelsIn(w) {
  let n = 0;
  for (const ch of w) if ("AEIOU".includes(ch)) n++;
  return n;
}

/* Resolve a typed word against the current step. Returns:
   { ok, accepted, reason, damage, logLines[], effects{}, cleared, advanced,
     bossPhaseChanged }
   and MUTATES `state` (hearts/coins/hp/progression/log). Pure w.r.t. inputs
   except the intended state mutation — the cabinet calls this then re-renders.

   reason (when !accepted): "invalid" | "rulefail". */
export function resolveTurn(state, rawWord, seedOverride) {
  syncRoomEntry(state); // keep the food-seal flag correct (first turn / resume)
  const w = (rawWord || "").toUpperCase().replace(/[^A-Z]/g, "");
  const target = currentTarget(state);
  const rule = getRule(target ? target.ruleSpec : "any");
  const seed = seedOverride != null ? seedOverride : daySeed(`${state.seed}|${state.levelIdx}|${state.roomIdx}|${state.bossPhase}|${w}`);
  const s = stream(seed);
  const flav = (bucket) => s.pick(FLAVOR[bucket]);
  const out = { ok: false, accepted: false, reason: null, damage: 0, logLines: [], effects: {}, cleared: false, advanced: false, bossPhaseChanged: false };

  // 0) hidden word Easter eggs (intercept before the dictionary gate — these
  // aren't ENABLE words, so we answer with a wink instead of "not a word").
  if (EGG_WORDS[w]) {
    out.reason = "invalid";
    out.logLines.push(EGG_WORDS[w]);
    return out;
  }

  // 0b) EXCALIBUR — a legendary power-word unlocked by the Sword in the Stone
  // relic. It isn't an ENABLE word, so it's an explicit intercept: with the relic
  // it lands a rule-ignoring legendary weapon strike; without it, the blade
  // refuses an unworthy hand (a whiff, like any unrecognized word). It IS spent
  // (added to `used`) so it can't be spammed every turn.
  if (w === "EXCALIBUR") {
    if (!state.relics.includes("sword-in-stone")) {
      out.reason = "invalid";
      out.logLines.push("> EXCALIBUR does not stir. The blade will not come to an unworthy hand.");
      return out;
    }
    return resolveExcalibur(state, out, s, flav);
  }

  // 1) real word?
  if (!isWord(w)) {
    out.reason = "invalid";
    // Gibberish penalty: if a LIVE enemy/boss is present, it feasts on the
    // nonsense and gains HP (capped per room). Non-combat rooms just whiff.
    const fed = feedGibberish(state, target, w, out, flav);
    if (!fed) out.logLines.push(`> ${w || "(nothing)"} — ${flav("invalid")}`);
    return out;
  }

  // 1b) no repeats across the whole run — a spent word won't answer twice.
  // Category-aware flavor: a spent weapon/food/spell gets its own line (with
  // {WORD} swapped in); anything else falls back to the generic bucket.
  if ((state.used || []).includes(w)) {
    out.reason = "repeat";
    const repeatBucket = REPEAT_BUCKET_BY_CATEGORY[effectCategoryOf(w)];
    if (repeatBucket) {
      out.logLines.push(`> ${flav(repeatBucket).replace(/\{WORD\}/g, w)}`);
    } else {
      out.logLines.push(`> ${w} — ${flav("repeat")}`);
    }
    return out;
  }

  const tier = rarityTier(w);
  const ctx = { prevWord: state.prevWord, enemyName: target?.name || "", tier };

  // 2) rule satisfied? (a queued Clean Slate scroll bypasses the rule this turn)
  const ruleBypassed = !!state.pending.clearRule;
  const rulePasses = ruleBypassed || rule.test(w, ctx);
  if (!rulePasses) {
    out.reason = "rulefail";
    state.roomFails = (state.roomFails || 0) + 1;
    out.logLines.push(`> ${w} is valid — ${flav("ruleFail")}`);
    // The FIRST wrong word in a room is a free warning; the 2nd+ costs a heart
    // (any room, not just traps/bosses). Fail-forgiveness (relic/scroll) can
    // still save the heart. Traps/bosses always sting from the first miss.
    const hard = target && (target.kind === "trap" || target.kind === "boss");
    const penalize = hard || state.roomFails >= 2;
    if (penalize) {
      const forgive = consumeFailForgiveness(state);
      if (forgive) {
        out.logLines.push(`> ${forgive} shields you from the mistake.`);
      } else {
        state.hearts -= 1;
        out.logLines.push(`> ${flav("ruleFailPenalty")} (❤ ${state.hearts})`);
        checkDeath(state, out, `a wrong word in the ${currentLevel(state).name}`);
      }
    }
    return out;
  }
  if (ruleBypassed) delete state.pending.clearRule;

  out.accepted = true;
  out.ok = true;
  state.prevWord = w;
  state.words.push({ word: w, tier, rank: commonRank(w) });
  (state.used || (state.used = [])).push(w);

  // 2b) starting secrets — cosmetic first-word title + omens/badges from the
  // opening words. Flavor only (no hearts/coins/damage), evaluated here so a
  // resumed run keeps them (state.title/badges persist).
  applyStartingSecrets(state, w, out);

  // 3) damage
  const parts = [{ label: "letters", amount: w.length }];
  const rb = rareLetterBonus(w);
  if (rb) parts.push({ label: "rare letters", amount: rb });
  const raB = rarityBonus(tier);
  if (raB) parts.push({ label: tier, amount: raB });

  // word-effect (semantic) — only meaningful vs an enemy/boss with tags
  const effectCat = effectCategoryOf(w);

  // Blocking: a defense-category word raises a block against the NEXT counter,
  // unless it's on cooldown. Only meaningful vs an enemy/boss (a gate has no
  // counter). The cooldown ticks down once per accepted turn (below).
  const targetCanCounter = target && (target.kind === "monster" || target.kind === "trap" || target.kind === "boss");
  let raisedBlockThisTurn = false;
  if (effectCat === "defense" && targetCanCounter) {
    if ((state.blockCooldown || 0) <= 0) {
      state.pending.blockNext = true;
      state.blockCooldown = blockCooldownFor(state);
      raisedBlockThisTurn = true;
      out.logLines.push(`> You raise the ${w} — the next blow will be turned aside.`);
    } else {
      // This turn ticks the cooldown down by 1 (below), so report the value the
      // player will see AFTER this turn resolves.
      const after = Math.max(0, state.blockCooldown - 1);
      out.logLines.push(`> You reach for a guard, but it isn't ready yet (${after} more turn${after === 1 ? "" : "s"}).`);
    }
  }
  // Tick the block cooldown down once per accepted turn — but NOT on the turn a
  // block was just raised (so a cooldown of N means N full turns before reuse).
  if (!raisedBlockThisTurn && state.blockCooldown > 0) state.blockCooldown -= 1;

  let effect = null;
  if (target && (target.kind === "monster" || target.kind === "trap" || target.kind === "boss")) {
    effect = resolveWordEffect(w, target, seed);
  }
  if (effect) {
    if (effect.damageBonus) parts.push({ label: effect.category, amount: effect.damageBonus });
    if (effect.weaknessBonus) parts.push({ label: "weakness", amount: effect.weaknessBonus });
  }

  // relics
  const relicExtra = applyRelics(state, w, tier, effectCat, parts, ctx);

  // queued Word Bomb / bonus damage
  if (state.pending.bonusDamage) {
    parts.push({ label: "Word Bomb", amount: state.pending.bonusDamage });
    delete state.pending.bonusDamage;
  }

  let damage = parts.reduce((a, p) => a + Math.max(0, p.amount), 0);
  out.damage = damage;

  // 4) narrate the hit — attribute to the player's earned title if they have one
  // ("Tower Giant plays APPLES"), else the plain "You played APPLES".
  const actor = state.title?.title;
  const actorLine = actor ? `${actor} plays ${w}` : `You played ${w}`;
  out.logLines.push(`> ${actorLine}.${tier === "goblin" ? " (a goblin word!)" : tier === "obscure" ? " (obscure)" : ""}`);
  if (effect && effect.text) out.logLines.push(`> ${effect.text}`);
  // A categoryless word normally gets the plain "no special weight" line — but a
  // RARE word (goblin/obscure) earns a flavor line that respects its rarity so
  // an impressive strange word never reads as mundane.
  else if (tier === "goblin" || tier === "obscure") out.logLines.push(`> ${flav("plainHitRare")}`);
  else out.logLines.push(`> ${flav("plainHit")}`);
  if (effect && effect.resisted) out.logLines.push(`> ${target.name} resists it.`);

  // heals / coins from effect + relics. FOOD heals are special: a food-sealing
  // enemy (state.famished) nullifies them unless the Glutton's Charm unseals;
  // Iron Stomach adds +1. Non-food heals (e.g. Vowel Crown relic) are unaffected.
  const isFood = effectCat === "food";
  let effectHeal = effect?.heal || 0;
  let foodSealed = false;
  if (isFood && effectHeal > 0) {
    if (state.relics.includes("iron-stomach")) effectHeal += 1;
    if (state.famished && !state.relics.includes("gluttons-charm")) {
      effectHeal = 0;
      foodSealed = true;
    }
  }
  if (foodSealed) out.logLines.push(`> ${flav("foodSealed")}`);
  const heal = effectHeal + relicExtra.heal;
  if (heal > 0) {
    state.hearts = Math.min(state.maxHearts, state.hearts + heal);
    out.logLines.push(`> You recover ${heal} heart${heal === 1 ? "" : "s"}. (❤ ${state.hearts})`);
  }
  // Coins are primarily earned per accepted word (length + rarity), plus any
  // treasure-word gold and coin-relic bonuses. This is the main coin source.
  const coinGain = coinsForWord(w, tier) + (effect?.gold || 0) + relicExtra.coins;
  if (coinGain > 0) {
    state.coins += coinGain;
    out.logLines.push(`> +${coinGain} coins. (🪙 ${state.coins})`);
  }

  // 5) apply damage to the target and progress
  applyDamageAndProgress(state, target, damage, out, flav);

  return out;
}

// EXCALIBUR power-word resolution (relic already confirmed by the caller). A
// rule-ignoring, no-repeat-of-others legendary weapon strike: big flat damage +
// weapon-category weakness/resist flavor. Spent afterward (added to `used`) so
// it can't be repeated. Mutates state/out and returns out.
const EXCALIBUR_BASE = 18; // legendary flat damage before weakness/resist
function resolveExcalibur(state, out, s, flav) {
  const w = "EXCALIBUR";
  if ((state.used || []).includes(w)) {
    out.reason = "repeat";
    out.logLines.push("> EXCALIBUR has already been drawn this run — the stone holds it fast now.");
    return out;
  }

  out.accepted = true;
  out.ok = true;
  state.prevWord = w;
  state.words.push({ word: w, tier: "goblin", rank: null });
  (state.used || (state.used = [])).push(w);

  const target = currentTarget(state);
  let damage = EXCALIBUR_BASE;
  // Route through the weapon-category effect vs the target for weakness/resist
  // flavor (EXCALIBUR reads as a weapon). We reuse SWORD as the effect proxy so
  // the semantic system stays the single source of weapon interactions.
  let effect = null;
  if (target && (target.kind === "monster" || target.kind === "trap" || target.kind === "boss")) {
    effect = resolveWordEffect("SWORD", target, state.seed >>> 0);
    if (effect) damage += (effect.damageBonus || 0) + (effect.weaknessBonus || 0);
  }

  const actor = state.title?.title;
  out.logLines.push(`> ${actor ? `${actor} draws` : "You draw"} EXCALIBUR from the stone — the dungeon holds its breath.`);
  out.logLines.push(effect?.resisted
    ? "> The legendary blade bites, though this foe is oddly unbothered."
    : "> A blaze of old light: the sword falls like a verdict.");

  out.damage = damage;
  applyDamageAndProgress(state, target, damage, out, flav);
  return out;
}

// Apply a computed hit to the current target (enemy / boss / gate) and advance.
// Shared by the normal accepted-word path and the EXCALIBUR power-word so both
// resolve kills, boss phases, and counterattacks identically. Mutates state/out.
function applyDamageAndProgress(state, target, damage, out, flav) {
  if (target && (target.kind === "monster" || target.kind === "trap")) {
    const room = currentRoom(state);
    room.enemyHP = Math.max(0, room.enemyHP - damage);
    out.logLines.push(`> ${damage} damage. (${target.name}: ${room.enemyHP}/${room.enemyMaxHP})`);
    if (room.enemyHP <= 0) {
      out.logLines.push(`> ${flav("enemyDown")}`);
      // Slain-enemy identity for the cabinet's "defeated" card (captured before
      // advanceRoom moves us to the next target).
      out.defeated = { name: target.name, emoji: target.emoji, kind: target.kind };
      awardClear(state, out);
      advanceRoom(state, out);
      out.cleared = true;
    } else {
      enemyCounter(state, target, out);
    }
  } else if (target && target.kind === "boss") {
    const boss = currentBoss(state);
    const phaseMax = bossPhaseMaxHP(state, boss, state.bossPhase);
    state.bossHP = Math.max(0, (state.bossHP ?? phaseMax) - damage);
    out.logLines.push(`> ${damage} damage. (${boss.name} phase ${state.bossPhase + 1}/${boss.phases.length}: ${state.bossHP}/${phaseMax})`);
    if (state.bossHP <= 0) {
      if (state.bossPhase + 1 < boss.phases.length) {
        state.bossPhase += 1;
        state.bossHP = bossPhaseMaxHP(state, boss, state.bossPhase);
        state.prevWord = null;
        out.bossPhaseChanged = true;
        out.logLines.push(`> ${boss.name} shifts. ${boss.phases[state.bossPhase].intent}`);
        enemyCounter(state, target, out);
      } else {
        // boss defeated
        out.logLines.push(`> ${boss.victory}`);
        // Only a FINAL boss kill sets `defeated` (a phase transition does not) —
        // the cabinet shows the card for real kills, never mid-boss shifts.
        out.defeated = { name: target.name, emoji: target.emoji, kind: "boss" };
        awardClear(state, out, /*boss*/ true);
        advanceRoom(state, out);
        out.cleared = true;
      }
    } else {
      enemyCounter(state, target, out);
    }
  } else {
    // gate / treasure — no enemy; the valid word simply opens it.
    out.logLines.push(`> ${flav("roomClear")}`);
    awardClear(state, out);
    advanceRoom(state, out);
    out.cleared = true;
  }
}

// Gibberish penalty: a non-word played against a LIVE enemy/boss feeds it +1 HP
// (clamped to its max), capped at GIBBERISH_CAP per room. Emits a "⚠"-prefixed
// feast line (the cabinet colorizes it). Returns true if it fed (so the caller
// skips the generic "not a word" line), false for empty input or no live enemy.
function feedGibberish(state, target, w, out, flav) {
  if (!w) return false; // empty input isn't gibberish — just a no-op
  const live = target && (target.kind === "monster" || target.kind === "trap" || target.kind === "boss");
  if (!live) return false;
  const name = target.name;
  if ((state.gibberishFed || 0) >= GIBBERISH_CAP) {
    out.logLines.push(`> ⚠ ${flav("gibberishFull").replace(/\{NAME\}/g, name)}`);
    return true;
  }
  // Heal the correct HP pool, clamped to its max.
  let healed = false;
  if (target.kind === "boss") {
    const boss = currentBoss(state);
    const phaseMax = bossPhaseMaxHP(state, boss, state.bossPhase);
    const cur = state.bossHP ?? phaseMax;
    if (cur < phaseMax) {
      state.bossHP = Math.min(phaseMax, cur + GIBBERISH_HEAL);
      healed = true;
    }
  } else {
    const room = currentRoom(state);
    if (room && room.enemyHP < room.enemyMaxHP) {
      room.enemyHP = Math.min(room.enemyMaxHP, room.enemyHP + GIBBERISH_HEAL);
      healed = true;
    }
  }
  if (!healed) {
    // Already at full HP — the feast can't add more, but it's still nonsense.
    out.logLines.push(`> ⚠ ${flav("gibberishFull").replace(/\{NAME\}/g, name)}`);
    return true;
  }
  state.gibberishFed = (state.gibberishFed || 0) + 1;
  out.logLines.push(`> ⚠ ${flav("gibberish").replace(/\{NAME\}/g, name)} (${name} +${GIBBERISH_HEAL} HP)`);
  return true;
}

// A failed word may be forgiven by a relic (once/level) or a queued scroll.
// Returns the source label if forgiven, else null.
function consumeFailForgiveness(state) {
  if (state.pending.forgiveFail) {
    delete state.pending.forgiveFail;
    return "Vowel Pardon";
  }
  const flag = `${state.levelIdx}:bookmark`;
  if (state.relics.includes("iron-bookmark") && !state.levelFlags[flag]) {
    state.levelFlags[flag] = true;
    return "Iron Bookmark";
  }
  return null;
}

function enemyCounter(state, target, out) {
  // A queued Smoke Bomb skips one incoming counterattack.
  if (state.pending.skipCounter) {
    delete state.pending.skipCounter;
    out.logLines.push(`> Smoke swallows ${target.name}'s counter — no damage.`);
    return;
  }
  const baseDmg = target.damage || 1;
  // A raised BLOCK (from a defense word) reduces the incoming counter. Full block
  // (strength 1) negates it entirely; a partial-block relic could reduce it.
  if (state.pending.blockNext) {
    delete state.pending.blockNext;
    const reduced = Math.max(0, Math.round(baseDmg * (1 - blockStrengthFor(state))));
    if (reduced <= 0) {
      out.logLines.push(`> You turn aside ${target.name}'s blow — no damage.`);
      return;
    }
    state.hearts -= reduced;
    out.logLines.push(`> You partly block ${target.name}'s blow — only ${reduced} heart${reduced === 1 ? "" : "s"} lost. (❤ ${state.hearts})`);
    checkDeath(state, out, deathBy(target.name));
    return;
  }
  const dmg = baseDmg;
  state.hearts -= dmg;
  out.logLines.push(`> ${target.name} strikes for ${dmg} heart${dmg === 1 ? "" : "s"}. (❤ ${state.hearts})`);
  checkDeath(state, out, deathBy(target.name));
}

// "slain by the Grave Spider" / "slain by the Mute Choir" — but boss names
// already start with "The", so don't double the article.
function deathBy(name) {
  return /^the\b/i.test(name) ? `slain by ${name}` : `slain by the ${name}`;
}

// Cosmetic "character-creation" layer. On the FIRST valid word, maybe assign a
// title and/or an omen; across the first four valid words, maybe award a
// sequence badge. All flavor — never touches hearts/coins/damage. Badges dedupe
// by id so a resumed/re-evaluated run doesn't double-award.
function applyStartingSecrets(state, w, out) {
  const wordCount = state.words.length; // this word already pushed
  const addBadge = (b) => {
    if (!b) return;
    if (!state.badges) state.badges = [];
    if (state.badges.some((x) => x.id === b.id)) return;
    state.badges.push({ id: b.id, name: b.name, text: b.text, kind: b.kind || "badge" });
    out.logLines.push(`> ✦ ${b.kind === "omen" ? "Omen" : "Secret"}: ${b.name} — ${b.text}`);
  };

  if (wordCount === 1 && !state.title) {
    const title = FIRST_WORD_TITLES[w];
    if (title) {
      state.title = { title, revealText: `The dungeon remembers your first word. You are named the ${title}.` };
      out.logLines.push(`> ✦ ${state.title.revealText}`);
    }
    const omen = firstWordOmen(w);
    if (omen) addBadge({ id: "omen:" + w, name: omen.name, text: omen.text, kind: "omen" });
  }

  // Sequence badges look at the first few words; only meaningful through word 4.
  if (wordCount >= 2 && wordCount <= 4) {
    addBadge(sequenceBadge(state));
  }
}

// Coins now come mostly from played words (coinsForWord). A cleared room grants
// only a small token bonus so the run total varies with how well you spell, not
// just how many rooms you clear. Coin relics still add their bonus on top.
function awardClear(state, out, boss = false) {
  let coins = boss ? 3 : 1;
  if (state.relics.includes("coin-purse")) coins += 3;
  if (state.relics.includes("lucky-coin")) coins += 5;
  state.coins += coins;
  out.effects.coins = coins;
}

function checkDeath(state, out, cause) {
  if (state.hearts <= 0 && !state.over) {
    state.hearts = 0;
    state.over = true;
    state.won = false;
    state.deathCause = cause;
    out.logLines.push(`> You fall. (${cause})`);
  }
}

// Move to the next room; on the last boss defeated, win the run. Resets the
// per-room memory word + fail counter, and re-syncs the food-seal flag for
// whatever room we land on.
function advanceRoom(state, out) {
  const lvl = currentLevel(state);
  state.prevWord = null;
  state.roomFails = 0;
  state.gibberishFed = 0; // the enemy's gibberish-feast tally resets each room
  // A raised block and its cooldown don't carry between rooms — each fight is
  // fresh (you can raise a block on the first turn of the next enemy).
  delete state.pending.blockNext;
  state.blockCooldown = 0;
  delete state.bossHP;
  if (state.roomIdx < lvl.rooms.length) {
    state.roomIdx += 1; // may land on the boss (roomIdx === rooms.length)
  } else {
    // boss cleared → next level
    if (state.levelIdx + 1 < state.levels.length) {
      state.levelIdx += 1;
      state.roomIdx = 0;
      state.bossPhase = 0;
      // Second Wind relic: heal 1 at the start of each new level.
      if (state.relics.includes("second-wind")) {
        state.hearts = Math.min(state.maxHearts, state.hearts + 1);
        out.logLines.push(`> Second Wind: you catch your breath. (❤ ${state.hearts})`);
      }
    } else {
      // Last level in the run cleared. Instead of ending, PAUSE and offer the
      // choice to descend deeper (endless) or bank the score. The cabinet reads
      // state.canDescend to show the interstitial. The very first time (the fixed
      // Unabridged Lich) is the real "you won" beat; deeper clears just survive.
      state.canDescend = true;
      if (!state.clearedBase) {
        state.clearedBase = true;
        state.won = true;
        out.logLines.push("> The dungeon is silent. You have cleared the Unabridged Lich.");
      } else {
        out.logLines.push("> Another depth conquered. The dark keeps unfolding.");
      }
    }
  }
  syncRoomEntry(state);
}

// Recompute the food-seal flag for the CURRENT room: true iff a live
// food-sealing enemy is present. Called on every room entry and defensively at
// the top of resolveTurn so a resumed save is correct too.
export function syncRoomEntry(state) {
  const target = currentTarget(state);
  state.famished = !!(target && target.sealsFood && (target.hp == null || target.hp > 0));
}

// ── scrolls ───────────────────────────────────────────────────────────────────
/* Consume a scroll by id. Some take effect immediately (heal), some queue for
   the next word. Returns { ok, message }. Mutates state. */
export function useScroll(state, scrollId) {
  const i = state.scrolls.indexOf(scrollId);
  if (i < 0) return { ok: false, message: "You don't have that scroll." };
  const sc = SCROLLS.find((x) => x.id === scrollId);
  state.scrolls.splice(i, 1);
  let message = "";
  switch (sc.effectTag) {
    case "heal-2":
      state.hearts = Math.min(state.maxHearts, state.hearts + 2);
      message = `Healing Draught: +2 hearts. (❤ ${state.hearts})`;
      break;
    case "bonus-damage":
      state.pending.bonusDamage = 6;
      message = "Word Bomb primed: your next word deals +6.";
      break;
    case "forgive-fail":
      state.pending.forgiveFail = true;
      message = "Vowel Pardon ready: your next mistake is forgiven.";
      break;
    case "clear-rule":
      state.pending.clearRule = true;
      message = "Clean Slate: the room's rule is lifted for one word.";
      break;
    case "reveal-starter":
      message = `Hint: try a word starting with ${hintStarter(state) || "?"}.`;
      break;
    case "reveal-three":
      message = `Hints: try starting with ${hintLetters(state, 3).join(", ") || "?"}.`;
      break;
    case "reroll-rule":
      message = rerollRule(state);
      break;
    case "heal-4":
      state.hearts = Math.min(state.maxHearts, state.hearts + 4);
      message = `Greater Draught: +4 hearts. (❤ ${state.hearts})`;
      break;
    case "bonus-damage-big":
      state.pending.bonusDamage = 12;
      message = "Greater Word Bomb primed: your next word deals +12.";
      break;
    case "skip-counter":
      state.pending.skipCounter = true;
      message = "Smoke Bomb ready: the enemy's next counter is skipped.";
      break;
    case "gain-coins":
      state.coins += 10;
      message = `Coin Scroll: +10 coins. (🪙 ${state.coins})`;
      break;
    case "banish": {
      // Deal a flat 8 to the current enemy/boss (no word played).
      const dealt = dealDirectDamage(state, 8);
      message = dealt ? "Banish Scroll: 8 damage torn out of the enemy." : "Nothing here to banish.";
      break;
    }
    default:
      message = sc.description;
  }
  return { ok: true, message };
}

// Flat damage to the current enemy/boss (used by the Banish scroll). Advances
// the room if it kills. Returns true if there was a target to hit.
function dealDirectDamage(state, amount) {
  const target = currentTarget(state);
  const out = { logLines: [] };
  if (target && (target.kind === "monster" || target.kind === "trap")) {
    const room = currentRoom(state);
    room.enemyHP = Math.max(0, room.enemyHP - amount);
    if (room.enemyHP <= 0) {
      awardClear(state, out);
      advanceRoom(state, out);
    }
    return true;
  }
  if (target && target.kind === "boss") {
    const boss = currentBoss(state);
    state.bossHP = Math.max(0, (state.bossHP ?? bossPhaseMaxHP(state, boss, state.bossPhase)) - amount);
    if (state.bossHP <= 0) {
      if (state.bossPhase + 1 < boss.phases.length) {
        state.bossPhase += 1;
        state.bossHP = bossPhaseMaxHP(state, boss, state.bossPhase);
        state.prevWord = null;
      } else {
        awardClear(state, out, true);
        advanceRoom(state, out);
      }
    }
    return true;
  }
  return false;
}

// N distinct useful starting letters for the current rule (Lantern scroll).
function hintLetters(state, n) {
  const target = currentTarget(state);
  const rule = getRule(target ? target.ruleSpec : "any");
  const ctx = { prevWord: state.prevWord, enemyName: target?.name || "" };
  const SAMPLES = ["APPLE", "STONE", "TORCH", "BRICK", "CANDLE", "GHOUL", "QUARTZ", "JELLY", "OXEN", "VIVID", "WATER", "ZEBRA", "KNIFE", "MAGIC", "NIGHT", "PEARL", "RIVER", "SWORD", "URCHIN", "YEAST", "DAGGER", "EMBER", "FLAME", "HAMMER", "IRON", "LANTERN", "BONE", "CRYPT", "DUSK", "FROST"];
  const out = [];
  for (const cand of SAMPLES) {
    if (out.length >= n) break;
    if (isWord(cand) && rule.test(cand, { ...ctx, tier: rarityTier(cand) }) && !out.includes(cand[0])) {
      out.push(cand[0]);
    }
  }
  return out;
}

// A valid starting letter for the current rule (best-effort; scans A–Z for a
// real word that satisfies the rule). Used by Hint Scroll + Lantern relic.
export function hintStarter(state) {
  const target = currentTarget(state);
  const rule = getRule(target ? target.ruleSpec : "any");
  const ctx = { prevWord: state.prevWord, enemyName: target?.name || "", tier: null };
  // Try common short words per letter — cheap heuristic without scanning 150k.
  const SAMPLES = ["APPLE", "STONE", "TORCH", "BRICK", "CANDLE", "GHOUL", "QUARTZ", "JELLY", "OXEN", "VIVID", "WATER", "ZEBRA", "KNIFE", "MAGIC", "NIGHT", "PEARL", "RIVER", "SWORD", "URCHIN", "YEAST", "DAGGER", "EMBER", "FLAME", "HAMMER", "IRON", "LANTERN"];
  for (const cand of SAMPLES) {
    if (isWord(cand) && rule.test(cand, { ...ctx, tier: rarityTier(cand) })) return cand[0];
  }
  return null;
}

function rerollRule(state) {
  const lvl = currentLevel(state);
  const room = currentRoom(state);
  if (!room) return "There's nothing to reroll here.";
  const level = LEVELS.find((l) => l.id === lvl.id);
  const options = level.ruleSpecs.filter((r) => r !== room.ruleSpec);
  if (!options.length) return "No other rule to swap to.";
  const s = stream(daySeed(`${state.seed}|reroll|${state.levelIdx}|${state.roomIdx}`));
  room.ruleSpec = s.pick(options);
  return `The rule shifts: ${getRule(room.ruleSpec).displayText}`;
}

// ── treasure ──────────────────────────────────────────────────────────────────
/* Take a relic from the current treasure room's choices, then advance. */
export function takeRelic(state, relicId) {
  const room = currentRoom(state);
  if (!room || room.type !== "treasure") return { ok: false };
  if (!room.relicChoices?.includes(relicId)) return { ok: false };
  if (!state.relics.includes(relicId)) state.relics.push(relicId);
  const out = { ok: true, logLines: [] };
  out.logLines.push(`> You take the ${RELICS.find((r) => r.id === relicId)?.name}.`);
  advanceRoom(state, out);
  return out;
}

// A treasure room is cleared by picking a relic, not by a word. The cabinet
// checks this to swap the input for relic buttons.
export function isChoiceRoom(state) {
  const room = currentRoom(state);
  return !!room && room.type === "treasure";
}
export function isMerchantRoom(state) {
  const room = currentRoom(state);
  return !!room && room.type === "merchant";
}
export function isEventRoom(state) {
  const room = currentRoom(state);
  return !!room && room.type === "event";
}

// ── merchant ──────────────────────────────────────────────────────────────────
/* Buy offer #i in the current merchant room. Deducts coins (with Merchant's
   Token discount), grants the item, marks the offer sold. The room is NOT
   advanced by a purchase — the player leaves via leaveMerchant(). */
export function buyItem(state, offerIdx) {
  const room = currentRoom(state);
  if (!room || room.type !== "merchant") return { ok: false, message: "No merchant here." };
  const offer = room.offers?.[offerIdx];
  if (!offer || offer.sold) return { ok: false, message: "That's not for sale." };
  const discount = state.relics.includes("merchants-token") ? 0.75 : 1;
  const price = Math.max(1, Math.round(offer.price * discount));
  if (state.coins < price) return { ok: false, message: `Not enough coins (need ${price}).` };
  state.coins -= price;
  offer.sold = true;
  let message = "";
  switch (offer.kind) {
    case "heal":
      state.hearts = Math.min(state.maxHearts, state.hearts + offer.value);
      message = `Bought ${offer.name}: +${offer.value} hearts. (❤ ${state.hearts})`;
      break;
    case "maxheart":
      state.maxHearts += offer.value;
      state.hearts += offer.value;
      message = `Bought ${offer.name}: max hearts +${offer.value}. (❤ ${state.hearts}/${state.maxHearts})`;
      break;
    case "scroll":
      state.scrolls.push(offer.grant);
      message = `Bought ${offer.name}.`;
      break;
    case "relic":
      if (!state.relics.includes(offer.grant)) state.relics.push(offer.grant);
      message = `Bought ${offer.name}.`;
      break;
    default:
      message = `Bought ${offer.name}.`;
  }
  return { ok: true, message, coins: state.coins };
}

/* Leave the merchant room and advance. */
export function leaveMerchant(state) {
  const room = currentRoom(state);
  if (!room || room.type !== "merchant") return { ok: false };
  const out = { ok: true, logLines: ["> You leave the merchant and press on."] };
  advanceRoom(state, out);
  return out;
}

// ── events ────────────────────────────────────────────────────────────────────
/* Resolve the current event room by choice index. Applies the outcome and
   advances. Returns { ok, logLines }. */
export function resolveEvent(state, choiceIdx) {
  const room = currentRoom(state);
  if (!room || room.type !== "event" || !room.event) return { ok: false };
  const choice = room.event.choices?.[choiceIdx];
  if (!choice) return { ok: false };
  // Gate on requirements (e.g. enough coins).
  if (choice.requires?.coins != null && state.coins < choice.requires.coins) {
    return { ok: false, message: `You need ${choice.requires.coins} coins for that.` };
  }
  const out = { ok: true, logLines: [] };
  applyOutcome(state, choice.outcome || {}, out);
  if (choice.resultText) out.logLines.push(`> ${choice.resultText}`);
  advanceRoom(state, out);
  return out;
}

// Apply an event outcome bag to state. Supports heal/hearts(±)/coins(±)/
// relic/scroll/maxheart.
function applyOutcome(state, o, out) {
  if (o.heal) {
    state.hearts = Math.min(state.maxHearts, state.hearts + o.heal);
  }
  if (o.hearts) {
    state.hearts = Math.min(state.maxHearts, state.hearts + o.hearts);
    if (state.hearts <= 0) {
      state.hearts = 0;
      state.over = true;
      state.won = false;
      state.deathCause = "an ill-fated bargain";
      out.logLines.push("> The bargain takes your last heart. You fall.");
    }
  }
  if (o.maxheart) {
    state.maxHearts += o.maxheart;
    state.hearts += o.maxheart;
  }
  if (o.coins) state.coins = Math.max(0, state.coins + o.coins);
  if (o.relic && !state.relics.includes(o.relic)) state.relics.push(o.relic);
  if (o.scroll) state.scrolls.push(o.scroll);
}

// ── progress / scoring ────────────────────────────────────────────────────────
export function runProgress(state) {
  let total = 0;
  let done = 0;
  state.levels.forEach((lvl, li) => {
    total += lvl.totalRooms;
    if (li < state.levelIdx) done += lvl.totalRooms;
    else if (li === state.levelIdx) done += Math.min(state.roomIdx, lvl.totalRooms);
  });
  return { done, total, pct: total ? done / total : 0 };
}

export function floorLabel(state) {
  const lvl = currentLevel(state);
  if (!lvl) return "—";
  const room = isBossRoom(state) ? "Boss" : `Room ${state.roomIdx + 1}`;
  // Endless floors read as "Depth N" (how far past the base dungeon).
  if (lvl.endless) return `Depth ${state.descentCycle} · ${room}`;
  return `${state.levelIdx + 1} · ${room}`;
}

/* Final leaderboard score: room/boss clears + surviving hearts + coins + rare
   word bonuses, plus an escalating endless-depth bonus so "lasting longer" wins. */
export function runScore(state) {
  const prog = runProgress(state);
  let score = prog.done * 100; // each cleared room/boss
  if (state.won) score += 500; // victory bonus (cleared the base dungeon)
  score += state.hearts * 60; // surviving hearts
  score += state.coins * 5;
  for (const rec of state.words) {
    if (rec.tier === "goblin") score += 25;
    else if (rec.tier === "obscure") score += 10;
  }
  // Endless depth: each descent is worth progressively more (1000, 2000, …).
  const cycle = state.descentCycle || 0;
  if (cycle > 0) score += (cycle * (cycle + 1) / 2) * 1000;
  return score;
}

// The rarest and best (highest-damage-ish → longest/rarest) words, for the recap.
export function runRecap(state) {
  const words = state.words || [];
  let rarest = null;
  let longest = null;
  for (const rec of words) {
    if (!rarest || rankScore(rec) > rankScore(rarest)) rarest = rec;
    if (!longest || rec.word.length > longest.word.length) longest = rec;
  }
  return {
    score: runScore(state),
    words: words.length,
    hearts: state.hearts,
    coins: state.coins,
    relics: state.relics.slice(),
    rarest: rarest?.word || null,
    best: longest?.word || null,
    floor: floorLabel(state),
    won: state.won,
    depth: state.descentCycle || 0,
    deathCause: state.deathCause,
    title: state.title?.title || null,
    badges: (state.badges || []).map((b) => ({ name: b.name, kind: b.kind || "badge" })),
  };
}
// Higher = rarer, for "rarest word" pick.
function rankScore(rec) {
  const tierRank = rec.tier === "goblin" ? 3 : rec.tier === "obscure" ? 2 : rec.tier === "familiar" ? 1 : 0;
  return tierRank * 100 + rec.word.length;
}

// ── share ─────────────────────────────────────────────────────────────────────
export function shareLine(state) {
  const recap = runRecap(state);
  if (state.mode !== "daily") {
    return `OURCADE Dictionary Dungeon (practice) — ${recap.won ? "Escaped!" : `Floor ${recap.floor}`} · ${recap.score} 📖`;
  }
  const n = dungeonNumber(state.dayKey);
  const tail = recap.depth > 0
    ? `🏆 Cleared + Depth ${recap.depth} 🕳️`
    : recap.won ? "🏆 Cleared!" : `Floor ${recap.floor} 💀`;
  return `OURCADE Dictionary Dungeon #${n} — ${tail} · ${recap.score} 📖`;
}

// ── save / resume (mirrors chip-panic/logic.js) ───────────────────────────────
// v2: added merchant/event rooms, no-repeat `used`, roomFails, famished, zero
// starting inventory.
// v3: added cosmetic first-word title + starting-secret badges (state.title,
// state.badges). Old saves are discarded (start fresh).
// v4: added blocking (blockCooldown), endless mode (canDescend, clearedBase,
// descentCycle, appended endless levels). Old saves are discarded.
export const SAVE_VERSION = 4;

export const isSaveable = (state) => !!state && !state.over;

export function serializeGame(state) {
  if (!state) return null;
  return { v: SAVE_VERSION, state };
}

export function hydrateGame(saved) {
  if (!saved || saved.v !== SAVE_VERSION || !saved.state) return null;
  const s = saved.state;
  if (!Array.isArray(s.levels) || !s.levels.length) return null;
  if (typeof s.hearts !== "number" || typeof s.levelIdx !== "number") return null;
  if (s.over) return null; // finished runs aren't resumable
  // Backfill fields that may be absent in an older blob.
  if (!Array.isArray(s.used)) s.used = (s.words || []).map((r) => r.word);
  if (typeof s.roomFails !== "number") s.roomFails = 0;
  if (typeof s.gibberishFed !== "number") s.gibberishFed = 0;
  if (typeof s.famished !== "boolean") s.famished = false;
  if (s.title === undefined) s.title = null;
  if (!Array.isArray(s.badges)) s.badges = [];
  if (typeof s.blockCooldown !== "number") s.blockCooldown = 0;
  if (typeof s.canDescend !== "boolean") s.canDescend = false;
  if (typeof s.clearedBase !== "boolean") s.clearedBase = false;
  if (typeof s.descentCycle !== "number") s.descentCycle = 0;
  return s;
}
