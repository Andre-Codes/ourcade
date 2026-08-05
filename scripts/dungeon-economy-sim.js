/* ============================================================
   DUNGEON-ECONOMY SIM — headless economy tuner for Dictionary Dungeon.

   check:dungeon proves the content is SOLVABLE. It says nothing about whether
   the run's money makes sense: its auto-solver plays at 99 hearts and walks
   straight past every merchant (`leaveMerchant(state); // solver doesn't need to
   shop`). So the shop could — and did — ship with an inverted potion price curve
   (11 coins/heart for the mid-tier against 6 for the one that healed twice as
   much), two shops per run against 270 coins of income, and four scrolls that
   were reachable from nowhere at all. Nothing failed, because nothing looked.

   This sim looks. It drives the REAL engine (same imports the cabinet uses) over
   N days with two player profiles (see the model below) and reports the numbers
   the shop tuning is actually chosen from:

     · coins earned / spent / LEFT OVER per run — leftover is the "my money
       racked up and it felt pointless" number
     · shops per run and where they land
     · % of shops stocking a heal, the Greater Draught rate, scrolls per shop
     · scrolls acquired per run, and by what route (bought vs dropped)
     · burn/venom share of total damage — proves the lingering beat is worth
       animating rather than being rounding error

   It's a REPORT, not a gate: it prints and exits 0. check:dungeon is the gate.

   Run:
     node scripts/dungeon-economy-sim.js [--days 200] [--start 2026-08-04]
                                         [--profile expert|elementalist|both] [--buy]
   ============================================================ */

import { rarityTier, allWords } from "../src/games/dictionary-dungeon/dict.js";
import { getRule } from "../src/games/dictionary-dungeon/rules.js";
import { effectCategoryOf } from "../src/games/dictionary-dungeon/effects.js";
import { MERCHANT_STOCK, SCROLLS } from "../src/games/dictionary-dungeon/pools.js";
import {
  buildRun,
  currentTarget,
  currentRoom,
  isChoiceRoom,
  isMerchantRoom,
  isEventRoom,
  resolveTurn,
  takeRelic,
  buyItem,
  priceFor,
  leaveMerchant,
  restockMerchant,
  restockPrice,
  resolveEvent,
} from "../src/games/dictionary-dungeon/logic.js";

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : dflt;
};
const DAYS = Number(arg("days", 200));
const START = arg("start", new Date().toISOString().slice(0, 10));
const VERBOSE = argv.includes("--buy");
// "expert" · "elementalist" · "both" (default). See the player model below.
const PROFILE = arg("profile", "both");

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n, d) => (d ? (100 * n) / d : 0);
const f1 = (x) => x.toFixed(1);
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/* ---------- the player model ----------
   Not a dictionary scanner. This matters: the check script's solver takes the
   first alphabetical match, which is junk like AAHED — short, common,
   category-less. That player earns the minimum (coins scale with length and
   rarity), deals the minimum, and dies on floor 2, so its economy numbers would
   be meaningless.

   Two profiles, because they answer different questions:

   EXPERT — plays a word the enemy is WEAK to, longest first, falling back to the
     longest legal word. This is the ceiling on income (long rare words pay most)
     and so the ceiling on LEFTOVER coin, which is the number the shop tuning has
     to answer. It also barely ever sees a status effect: a 7-letter weakness
     word does ~14 against a 10 HP monster, so most fights end in one blow and
     nothing lives long enough to burn.

   ELEMENTALIST — leads with fire/venom/frost/curse whenever one is legal, and
     reaches for the SHORT one (EMBER, not SMOLDER) — a player naming the element
     rather than hunting for the longest synonym. Its fights run 2–3 turns, which
     is the only place burn and venom do any work: a 7-letter fire word does ~14
     against a 10 HP monster, so the expert's enemies die before anything they lit
     can tick. This is the profile the lingering-damage numbers mean anything for.

   The band is capped at 7 letters in both. Allowed up to 10, the expert finds a
   ten-letter answer for every room and one-shots the entire dungeon (5384 kills
   against 309 counterattacks) — a superhuman's run, not a player's.

   Pools are pre-sorted longest-first and scanned linearly, so a turn is a short
   walk rather than a full 154k-word sweep. */
const WORDS = [...allWords()];
const byLenDesc = (a, b) => b.length - a.length || (a < b ? -1 : 1);

const KNOWN = WORDS.filter((w) => w.length >= 5 && w.length <= 7 && rarityTier(w) !== "goblin").sort(byLenDesc);
// The categories that leave something behind on the enemy (effects.js `status`).
const STATUS_CATEGORIES = ["fire", "poison", "ice", "dark", "magic", "nature", "water"];
// …bucketed by word-effect category, so the expert can answer a weakness.
const BY_CATEGORY = new Map();
for (const w of KNOWN) {
  const cat = effectCategoryOf(w);
  if (!cat) continue;
  if (!BY_CATEGORY.has(cat)) BY_CATEGORY.set(cat, []);
  BY_CATEGORY.get(cat).push(w);
}
const ANY = [...WORDS].sort(byLenDesc);

function findWord(state, profile) {
  const target = currentTarget(state);
  const spec = target ? target.ruleSpec : "any";
  const rule = getRule(spec);
  const ctx = { prevWord: state.prevWord, enemyName: target?.name || "" };
  const used = new Set(state.used || []);
  const needsTier = String(spec).includes("tier:");
  const legal = (w) => !used.has(w) && rule.test(w, { ...ctx, tier: needsTier ? rarityTier(w) : null });

  const expert = profile === "expert";
  const inCombat = target && (target.kind === "monster" || target.kind === "trap" || target.kind === "boss");
  const prefer = expert ? target?.weaknessTags || [] : inCombat ? STATUS_CATEGORIES : [];
  for (const cat of prefer) {
    const pool = BY_CATEGORY.get(cat) || [];
    // BY_CATEGORY is longest-first; the elementalist walks it backwards.
    const hit = expert ? pool.find(legal) : findLast(pool, legal);
    if (hit) return hit;
  }
  return KNOWN.find(legal) || ANY.find(legal) || null;
}

function findLast(arr, ok) {
  for (let i = arr.length - 1; i >= 0; i--) if (ok(arr[i])) return arr[i];
  return undefined;
}

/* Shopping policy: heal when hurt, otherwise buy whatever's affordable, cheapest
   first, and restock while there's still real money left over. A reasonable
   player empties their pockets rather than hoarding, so the leftover this
   reports is the FLOOR on how much coin genuinely has nowhere to go. */
function shop(state, tally) {
  const room = currentRoom(state);
  for (let pass = 0; pass < 6; pass++) {
    for (let guard = 0; guard < 8; guard++) {
      const offers = (room.offers || [])
        .map((o, i) => ({ o, i, price: priceFor(state, o) }))
        .filter(({ o, price }) => !o.sold && price <= state.coins)
        .filter(({ o }) => !(o.kind === "heal" && state.hearts >= state.maxHearts))
        .sort((a, b) => a.price - b.price);
      if (!offers.length) break;
      // Prioritise a heal when below half, else take the cheapest thing going.
      const hurt = state.hearts < state.maxHearts / 2;
      const pick = (hurt && offers.find(({ o }) => o.kind === "heal")) || offers[0];
      const before = state.coins;
      const r = buyItem(state, pick.i);
      if (!r.ok) break;
      tally.spent += before - state.coins;
      tally.bought[pick.o.id] = (tally.bought[pick.o.id] || 0) + 1;
      if (pick.o.kind === "scroll") tally.scrollsBought++;
    }
    // Reroll the shelf only while the fee still leaves enough to buy something.
    const fee = restockPrice(state);
    if (state.coins < fee + 20) break;
    const before = state.coins;
    if (!restockMerchant(state).ok) break;
    tally.spent += before - state.coins;
    tally.restockFees += before - state.coins;
    tally.restocks++;
  }
  leaveMerchant(state);
}

/* ---------- one run ---------- */
function simulate(key, profile) {
  const state = buildRun(key);
  const t = {
    key,
    earned: 0,
    spent: 0,
    shops: 0,
    shopFloors: [],
    shopsWithHeal: 0,
    shopsWithGreater: 0,
    scrollOffers: 0,
    scrollsBought: 0,
    restocks: 0,
    restockFees: 0,
    scrollsDropped: 0,
    droppedIds: {},
    bought: {},
    words: 0,
    wordDamage: 0,
    lingerDamage: 0,
    turnsWithLinger: 0,
    beats: {},
    died: false,
    won: false,
  };
  let guard = 0;
  while (!state.over && !state.canDescend && guard++ < 600) {
    if (isChoiceRoom(state)) {
      takeRelic(state, currentRoom(state).relicChoices[0]);
      continue;
    }
    if (isMerchantRoom(state)) {
      const room = currentRoom(state);
      t.shops++;
      t.shopFloors.push(state.levelIdx + 1);
      const ids = room.offers.map((o) => o.id);
      if (room.offers.some((o) => o.kind === "heal")) t.shopsWithHeal++;
      if (ids.includes("buy-greater-heal")) t.shopsWithGreater++;
      t.scrollOffers += room.offers.filter((o) => o.kind === "scroll").length;
      shop(state, t);
      continue;
    }
    if (isEventRoom(state)) {
      const room = currentRoom(state);
      let i = room.event.choices.findIndex(
        (c) => c.requires?.coins == null || state.coins >= c.requires.coins
      );
      if (i < 0) i = room.event.choices.length - 1;
      resolveEvent(state, i);
      continue;
    }
    const w = findWord(state, profile);
    if (!w) break; // no legal answer — solvability is check:dungeon's job, not ours
    const scrollsBefore = state.scrolls.length;
    const coinsBefore = state.coins;
    const res = resolveTurn(state, w);
    t.words++;
    t.earned += Math.max(0, state.coins - coinsBefore);
    t.wordDamage += res.damage || 0;
    if (res.lingeringDamage) {
      t.lingerDamage += res.lingeringDamage;
      t.turnsWithLinger++;
    }
    for (const p of res.phases || []) t.beats[p.kind] = (t.beats[p.kind] || 0) + 1;
    // Anything gained mid-turn that wasn't bought is a drop.
    const gained = state.scrolls.length - scrollsBefore;
    if (gained > 0) {
      t.scrollsDropped += gained;
      for (const id of state.scrolls.slice(scrollsBefore)) {
        t.droppedIds[id] = (t.droppedIds[id] || 0) + 1;
      }
    }
  }
  t.died = !!state.over && !state.won;
  t.won = !!state.clearedBase;
  t.leftover = state.coins;
  t.hearts = state.hearts;
  return t;
}

/* ---------- sweep the days ---------- */
const base = new Date(`${START}T00:00:00Z`).getTime();
const dayKeys = Array.from({ length: DAYS }, (_, i) =>
  new Date(base + i * 86400000).toISOString().slice(0, 10)
);

console.log(`\nOURCADE dungeon-economy-sim — ${DAYS} days from ${START}`);
for (const profile of PROFILE === "both" ? ["expert", "elementalist"] : [PROFILE]) report(profile);

function report(profile) {
const runs = dayKeys.map((k) => simulate(k, profile));
const sum = (f) => runs.reduce((a, r) => a + f(r), 0);
const shops = sum((r) => r.shops);

console.log(`\n${"═".repeat(64)}\n${profile.toUpperCase()} — ${
  profile === "expert" ? "plays the enemy's weakness, longest word first" : "leads with fire/venom/frost, no weakness lookup"
}\n${"═".repeat(64)}\n`);

console.log("COIN FLOW (per run)");
console.log(`  earned        ${f1(avg(runs.map((r) => r.earned)))}   median ${median(runs.map((r) => r.earned))}`);
console.log(`  spent         ${f1(avg(runs.map((r) => r.spent)))}   median ${median(runs.map((r) => r.spent))}`);
console.log(`  LEFT OVER     ${f1(avg(runs.map((r) => r.leftover)))}   median ${median(runs.map((r) => r.leftover))}`);
console.log(`  spent / earned ${f1(pct(sum((r) => r.spent), sum((r) => r.earned)))}%`);
console.log(`  words played  ${f1(avg(runs.map((r) => r.words)))}  (${f1(sum((r) => r.earned) / Math.max(1, sum((r) => r.words)))} coins/word)`);

console.log("\nSHOPS");
const floorHist = {};
for (const r of runs) floorHist[r.shopFloors.join(",")] = (floorHist[r.shopFloors.join(",")] || 0) + 1;
console.log(`  per run       ${f1(avg(runs.map((r) => r.shops)))}`);
console.log(`  floors        ${Object.entries(floorHist).map(([k, n]) => `[${k}] ×${n}`).join("  ")}`);
console.log(`  stock a heal  ${f1(pct(sum((r) => r.shopsWithHeal), shops))}% of shops`);
console.log(`  Greater Drght ${f1(pct(sum((r) => r.shopsWithGreater), shops))}% of shops`);
console.log(`  scroll offers ${f1(sum((r) => r.scrollOffers) / Math.max(1, shops))} per shop`);
console.log(`  restocks      ${f1(avg(runs.map((r) => r.restocks)))} per run  (${f1(avg(runs.map((r) => r.restockFees)))} coins into fees)`);

console.log("\nSCROLLS (per run)");
console.log(`  bought        ${f1(avg(runs.map((r) => r.scrollsBought)))}`);
console.log(`  dropped       ${f1(avg(runs.map((r) => r.scrollsDropped)))}`);
console.log(`  TOTAL         ${f1(avg(runs.map((r) => r.scrollsBought + r.scrollsDropped)))}`);
const dropTally = {};
for (const r of runs) for (const [id, n] of Object.entries(r.droppedIds)) dropTally[id] = (dropTally[id] || 0) + n;
const unreachable = SCROLLS.filter((s) => !dropTally[s.id]).map((s) => s.id);
console.log(`  drop mix      ${Object.entries(dropTally).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id}×${n}`).join(", ") || "none"}`);
if (unreachable.length) console.log(`  never dropped ${unreachable.join(", ")}`);

console.log("\nLINGERING DAMAGE (burn + venom)");
const wd = sum((r) => r.wordDamage);
const ld = sum((r) => r.lingerDamage);
console.log(`  share of damage dealt  ${f1(pct(ld, wd + ld))}%   (${f1(avg(runs.map((r) => r.lingerDamage)))} per run)`);
console.log(`  turns with a tick      ${f1(pct(sum((r) => r.turnsWithLinger), sum((r) => r.words)))}% of turns`);
const beats = {};
for (const r of runs) for (const [k, n] of Object.entries(r.beats)) beats[k] = (beats[k] || 0) + n;
console.log(`  beats emitted          ${Object.entries(beats).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join("  ")}`);

console.log("\nOUTCOMES");
console.log(`  cleared the Lich  ${f1(pct(runs.filter((r) => r.won).length, DAYS))}%`);
console.log(`  died              ${f1(pct(runs.filter((r) => r.died).length, DAYS))}%`);
console.log(`  hearts at end     ${f1(avg(runs.map((r) => r.hearts)))}`);

if (VERBOSE) {
  console.log("\nPURCHASES (share of runs that bought each item)");
  const tally = {};
  for (const r of runs) for (const [id, n] of Object.entries(r.bought)) tally[id] = (tally[id] || 0) + n;
  const byId = new Map(MERCHANT_STOCK.map((m) => [m.id, m]));
  Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, n]) => console.log(`  ${(byId.get(id)?.name || id).padEnd(22)} ${f1(pct(n, DAYS))}%`));
}
}
console.log("");
