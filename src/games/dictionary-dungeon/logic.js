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
  LEVELS,
  ENEMY_BY_ID,
  BOSS_BY_ID,
  RELICS,
  RELIC_BY_ID,
  SCROLLS,
  SCROLL_BY_ID,
  FLAVOR,
} from "./pools.js";

// Re-exported so the render-only cabinet can resolve owned relic/scroll ids to
// their display metadata without importing pools.js directly.
export { RELICS, RELIC_BY_ID, SCROLLS, SCROLL_BY_ID };

const DUNGEON_SALT = 0x4444; // "DD" — independent daily rotation order
const EPOCH_KEY = "2026-06-01"; // anchors the small human "Dungeon #N"

export const START_HEARTS = 5;
export const START_COINS = 0;
const RARE_LETTERS = new Set(["J", "Q", "X", "Z"]);

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
function assembleRooms(level, s) {
  const n = level.roomCount;
  const types = [];
  // Guaranteed beats.
  types.push("gate");
  types.push("monster");
  types.push("treasure");
  // Fill the rest with monster/gate (favor monsters), never more than one trap.
  let traps = 0;
  while (types.length < n) {
    const r = s.rand();
    if (r < 0.15 && traps < 1) {
      types.push("trap");
      traps++;
    } else if (r < 0.6) types.push("monster");
    else types.push("gate");
  }
  const order = s.shuffle(types);

  // Assign rules (no exact repeat within the level) and enemies to monster/trap.
  const rulePool = s.shuffle(level.ruleSpecs);
  let ruleIdx = 0;
  const nextRule = () => {
    const spec = rulePool[ruleIdx % rulePool.length];
    ruleIdx++;
    return spec;
  };
  const enemyPool = s.shuffle(level.enemyIds);
  let enemyIdx = 0;
  const nextEnemy = () => enemyPool[enemyIdx++ % enemyPool.length];

  return order.map((type, i) => {
    const room = {
      idx: i,
      type,
      ruleSpec: nextRule(),
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
    const rooms = assembleRooms(level, ls);
    const boss = BOSS_BY_ID[level.bossId];
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

  // Offer a couple of scrolls to start (deterministic).
  const startScrolls = s.pickN(SCROLLS, 2).map((sc) => sc.id);

  return {
    v: SAVE_VERSION,
    mode: daily ? "daily" : "practice",
    dayKey: dayKey || null,
    seed: baseSeed,
    hearts: START_HEARTS,
    maxHearts: START_HEARTS,
    coins: START_COINS,
    relics: [], // relic ids owned
    scrolls: startScrolls, // scroll ids owned
    levelIdx: 0,
    roomIdx: 0, // index into level.rooms; === rooms.length means BOSS
    bossPhase: 0,
    levels,
    prevWord: null, // for memory rules (per room reset)
    words: [], // every accepted word this run (for recap)
    // per-level flags for relic once-per-level effects
    levelFlags: {},
    over: false,
    won: false,
    deathCause: null,
    // transient scroll effects queued for the next turn
    pending: {}, // e.g. { bonusDamage: 6, forgiveFail: true, clearRule: true }
    log: [],
  };
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
  if (isBossRoom(state)) {
    const boss = currentBoss(state);
    if (!boss) return null;
    const phase = boss.phases[state.bossPhase] || boss.phases[boss.phases.length - 1];
    return {
      kind: "boss",
      name: boss.name,
      emoji: boss.emoji,
      hp: state.bossHP ?? phase.hp,
      maxHP: phase.hp,
      damage: boss.damage,
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
      damage: e.damage,
      kindTags: e.kindTags,
      weaknessTags: e.weaknessTags,
      resistanceTags: e.resistanceTags,
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

// ── damage formula ────────────────────────────────────────────────────────────
function rareLetterBonus(w) {
  let b = 0;
  for (const ch of w) if (RARE_LETTERS.has(ch)) b += 3;
  return b;
}
function rarityBonus(tier) {
  return tier === "goblin" ? 4 : tier === "obscure" ? 2 : tier === "familiar" ? 1 : 0;
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
  if (has("commoners-cloak") && tier === "common" && !state.levelFlags[flag("cloak")]) {
    state.levelFlags[flag("cloak")] = true;
    heal += 1;
  }
  if (has("palindrome-coin") && /(.)\1/.test(w)) coins += 2;

  return { heal, coins };
}

/* Resolve a typed word against the current step. Returns:
   { ok, accepted, reason, damage, logLines[], effects{}, cleared, advanced,
     bossPhaseChanged }
   and MUTATES `state` (hearts/coins/hp/progression/log). Pure w.r.t. inputs
   except the intended state mutation — the cabinet calls this then re-renders.

   reason (when !accepted): "invalid" | "rulefail". */
export function resolveTurn(state, rawWord, seedOverride) {
  const w = (rawWord || "").toUpperCase().replace(/[^A-Z]/g, "");
  const target = currentTarget(state);
  const rule = getRule(target ? target.ruleSpec : "any");
  const seed = seedOverride != null ? seedOverride : daySeed(`${state.seed}|${state.levelIdx}|${state.roomIdx}|${state.bossPhase}|${w}`);
  const s = stream(seed);
  const flav = (bucket) => s.pick(FLAVOR[bucket]);
  const out = { ok: false, accepted: false, reason: null, damage: 0, logLines: [], effects: {}, cleared: false, advanced: false, bossPhaseChanged: false };

  // 1) real word?
  if (!isWord(w)) {
    out.reason = "invalid";
    out.logLines.push(`> ${w || "(nothing)"} — ${flav("invalid")}`);
    return out;
  }

  const tier = rarityTier(w);
  const ctx = { prevWord: state.prevWord, enemyName: target?.name || "", tier };

  // 2) rule satisfied? (a queued Clean Slate scroll bypasses the rule this turn)
  const ruleBypassed = !!state.pending.clearRule;
  const rulePasses = ruleBypassed || rule.test(w, ctx);
  if (!rulePasses) {
    out.reason = "rulefail";
    // Vowel Pardon / Iron Bookmark / queued forgive can save a heart on fail.
    const forgive = consumeFailForgiveness(state);
    out.logLines.push(`> ${w} is valid — ${flav("ruleFail")}`);
    if (!forgive && target && (target.kind === "trap" || target.kind === "boss")) {
      // Traps and bosses punish wrong words with a heart.
      state.hearts -= 1;
      out.logLines.push(`> The room bites back. You lose a heart. (❤ ${state.hearts})`);
      checkDeath(state, out, `a wrong word in the ${currentLevel(state).name}`);
    } else if (forgive) {
      out.logLines.push(`> ${forgive} shields you from the mistake.`);
    }
    return out;
  }
  if (ruleBypassed) delete state.pending.clearRule;

  out.accepted = true;
  out.ok = true;
  state.prevWord = w;
  state.words.push({ word: w, tier, rank: commonRank(w) });

  // 3) damage
  const parts = [{ label: "letters", amount: w.length }];
  const rb = rareLetterBonus(w);
  if (rb) parts.push({ label: "rare letters", amount: rb });
  const raB = rarityBonus(tier);
  if (raB) parts.push({ label: tier, amount: raB });

  // word-effect (semantic) — only meaningful vs an enemy/boss with tags
  const effectCat = effectCategoryOf(w);
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

  // 4) narrate the hit
  out.logLines.push(`> You played ${w}.${tier === "goblin" ? " (a goblin word!)" : tier === "obscure" ? " (obscure)" : ""}`);
  if (effect && effect.text) out.logLines.push(`> ${effect.text}`);
  else out.logLines.push(`> ${flav("plainHit")}`);
  if (effect && effect.resisted) out.logLines.push(`> ${target.name} resists it.`);

  // heals / coins from effect + relics
  const heal = (effect?.heal || 0) + relicExtra.heal;
  if (heal > 0) {
    state.hearts = Math.min(state.maxHearts, state.hearts + heal);
    out.logLines.push(`> You recover ${heal} heart${heal === 1 ? "" : "s"}. (❤ ${state.hearts})`);
  }
  const coinGain = (effect?.gold || 0) + relicExtra.coins;
  if (coinGain > 0) {
    state.coins += coinGain;
    out.logLines.push(`> +${coinGain} coins. (🪙 ${state.coins})`);
  }

  // 5) apply damage to the target and progress
  if (target && (target.kind === "monster" || target.kind === "trap")) {
    const room = currentRoom(state);
    room.enemyHP = Math.max(0, room.enemyHP - damage);
    out.logLines.push(`> ${damage} damage. (${target.name}: ${room.enemyHP}/${room.enemyMaxHP})`);
    if (room.enemyHP <= 0) {
      out.logLines.push(`> ${flav("enemyDown")}`);
      awardClear(state, out);
      advanceRoom(state, out);
      out.cleared = true;
    } else {
      enemyCounter(state, target, out);
    }
  } else if (target && target.kind === "boss") {
    const boss = currentBoss(state);
    const phase = boss.phases[state.bossPhase];
    state.bossHP = Math.max(0, (state.bossHP ?? phase.hp) - damage);
    out.logLines.push(`> ${damage} damage. (${boss.name} phase ${state.bossPhase + 1}/${boss.phases.length}: ${state.bossHP}/${phase.hp})`);
    if (state.bossHP <= 0) {
      if (state.bossPhase + 1 < boss.phases.length) {
        state.bossPhase += 1;
        state.bossHP = boss.phases[state.bossPhase].hp;
        state.prevWord = null;
        out.bossPhaseChanged = true;
        out.logLines.push(`> ${boss.name} shifts. ${boss.phases[state.bossPhase].intent}`);
        enemyCounter(state, target, out);
      } else {
        // boss defeated
        out.logLines.push(`> ${boss.victory}`);
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

  return out;
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
  const dmg = target.damage || 1;
  state.hearts -= dmg;
  out.logLines.push(`> ${target.name} strikes for ${dmg} heart${dmg === 1 ? "" : "s"}. (❤ ${state.hearts})`);
  checkDeath(state, out, deathBy(target.name));
}

// "slain by the Grave Spider" / "slain by the Mute Choir" — but boss names
// already start with "The", so don't double the article.
function deathBy(name) {
  return /^the\b/i.test(name) ? `slain by ${name}` : `slain by the ${name}`;
}

function awardClear(state, out, boss = false) {
  let coins = boss ? 8 : 3;
  if (state.relics.includes("coin-purse")) coins += 3;
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
// per-room memory word.
function advanceRoom(state, out) {
  const lvl = currentLevel(state);
  state.prevWord = null;
  delete state.bossHP;
  if (state.roomIdx < lvl.rooms.length) {
    state.roomIdx += 1; // may land on the boss (roomIdx === rooms.length)
  } else {
    // boss cleared → next level
    if (state.levelIdx + 1 < state.levels.length) {
      state.levelIdx += 1;
      state.roomIdx = 0;
      state.bossPhase = 0;
    } else {
      // final boss cleared → victory
      state.over = true;
      state.won = true;
      out.logLines.push("> The dungeon is silent. You have won.");
    }
  }
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
    case "reroll-rule":
      message = rerollRule(state);
      break;
    default:
      message = sc.description;
  }
  return { ok: true, message };
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
  return `${state.levelIdx + 1} · ${room}`;
}

/* Final leaderboard score: room/boss clears + surviving hearts + coins + rare
   word bonuses. One number, higher is better. */
export function runScore(state) {
  const prog = runProgress(state);
  let score = prog.done * 100; // each cleared room/boss
  if (state.won) score += 500; // victory bonus
  score += state.hearts * 60; // surviving hearts
  score += state.coins * 5;
  for (const rec of state.words) {
    if (rec.tier === "goblin") score += 25;
    else if (rec.tier === "obscure") score += 10;
  }
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
    deathCause: state.deathCause,
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
  const tail = recap.won ? "🏆 Cleared!" : `Floor ${recap.floor} 💀`;
  return `OURCADE Dictionary Dungeon #${n} — ${tail} · ${recap.score} 📖`;
}

// ── save / resume (mirrors chip-panic/logic.js) ───────────────────────────────
export const SAVE_VERSION = 1;

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
  return s;
}
