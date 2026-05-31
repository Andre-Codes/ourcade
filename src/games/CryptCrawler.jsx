import React, { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { useArcadeBackButton } from "../arcadeChrome.js";

/* ============================================================
   CRYPT OF THE HOLLOW KING
   A deterministic "magic-tower" puzzle-crawler.
   - Every monster shows the exact HP it costs to defeat it.
   - No randomness in combat: pure route-planning + HP management.
   - Endless descent, bosses every 5 floors, autosaved runs.
   ============================================================ */

const COLS = 8;
const ROWS = 10;

// ---------- tiny utils ----------
// All randomness flows through RNG.next(), which is normally Math.random but
// can be swapped for a seeded generator (the Daily Dungeon uses this so every
// player gets the identical layout for a given day).
const RNG = {
  fn: Math.random,
  next() { return this.fn(); },
  use(fn) { this.fn = fn; },
  reset() { this.fn = Math.random; },
};
// mulberry32: tiny, fast, well-distributed seeded PRNG
function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const ri = (a, b) => Math.floor(RNG.next() * (b - a + 1)) + a;
const choice = (arr) => arr[Math.floor(RNG.next() * arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(RNG.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const key = (x, y) => `${x},${y}`;

// ---------- endless-scaling tunables ----------
// The crypt is meant to be played forever. The trick that makes that possible
// without numbers exploding: monsters and the hero both grow *gently and
// linearly*, and defense is percentage damage-reduction (diminishing returns)
// instead of flat subtraction. That keeps a fight's HP cost a roughly constant
// fraction of your max HP at every depth — so a well-built, well-played hero
// can always survive, while a careless one falls behind and dies.
const HP_RATE = 0.13;   // monster HP linear growth per floor
const ATK_RATE = 0.11;  // monster ATK linear growth per floor
const DEF_K = 55;       // hero defense mitigation constant (higher = DEF worth less)
const ARMOR_K = 40;     // enemy armor mitigation constant (keeps fights to a few rounds)
const MIT_CAP = 0.8;    // no mitigation ever exceeds this — nothing is fully immune
// x points of defense convert to a damage-reduction fraction with diminishing
// returns: 0 at def 0, approaching (but never reaching) MIT_CAP as def climbs.
const mitig = (x, K) => Math.min(MIT_CAP, x / (x + K));

// Compact number formatting so the rare very-deep run stays readable
// (1.2K, 3.4M, …). Plain integers below 10,000 so normal play looks normal.
function fmt(n) {
  const v = Math.round(n);
  if (!isFinite(v)) return "∞";
  const a = Math.abs(v);
  if (a < 10000) return String(v);
  if (a < 1e6) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  if (a < 1e9) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
}

// ---------- audio: tiny Web Audio synth (no asset files needed) ----------
const Sound = (() => {
  let ctx = null;
  let muted = false;
  const ensure = () => {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  // one beep: frequency sweep + gain envelope
  const beep = (c, { type = "square", f0, f1, t = 0.12, vol = 0.18, delay = 0 }) => {
    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + t);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + t + 0.02);
  };
  const noise = (c, { t = 0.16, vol = 0.16, delay = 0, hp = 800 }) => {
    const start = c.currentTime + delay;
    const n = Math.floor(c.sampleRate * t);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = "highpass";
    flt.frequency.value = hp;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t);
    src.connect(flt); flt.connect(gain); gain.connect(c.destination);
    src.start(start);
    src.stop(start + t);
  };

  const recipes = {
    step:    (c) => beep(c, { type: "sine", f0: 180, f1: 140, t: 0.05, vol: 0.05 }),
    hit:     (c) => { beep(c, { type: "square", f0: 320, f1: 120, t: 0.1, vol: 0.16 }); noise(c, { t: 0.1, vol: 0.1 }); },
    coin:    (c) => { beep(c, { type: "triangle", f0: 880, t: 0.07, vol: 0.16 }); beep(c, { type: "triangle", f0: 1320, t: 0.09, vol: 0.14, delay: 0.06 }); },
    heal:    (c) => { beep(c, { type: "sine", f0: 440, f1: 880, t: 0.22, vol: 0.16 }); },
    gear:    (c) => { beep(c, { type: "square", f0: 220, f1: 440, t: 0.12, vol: 0.13 }); },
    key:     (c) => { beep(c, { type: "triangle", f0: 660, t: 0.06, vol: 0.14 }); beep(c, { type: "triangle", f0: 990, t: 0.08, vol: 0.12, delay: 0.05 }); },
    chest:   (c) => { [523, 659, 784, 1047].forEach((f, i) => beep(c, { type: "triangle", f0: f, t: 0.12, vol: 0.14, delay: i * 0.07 })); },
    altar:   (c) => { beep(c, { type: "sine", f0: 330, f1: 495, t: 0.5, vol: 0.12 }); },
    buy:     (c) => { beep(c, { type: "triangle", f0: 784, t: 0.08, vol: 0.15 }); beep(c, { type: "triangle", f0: 1047, t: 0.1, vol: 0.13, delay: 0.07 }); },
    locked:  (c) => { beep(c, { type: "square", f0: 160, f1: 110, t: 0.14, vol: 0.14 }); },
    warn:    (c) => { beep(c, { type: "sawtooth", f0: 240, f1: 180, t: 0.18, vol: 0.14 }); },
    stairs:  (c) => { beep(c, { type: "sine", f0: 392, f1: 262, t: 0.22, vol: 0.12 }); },
    boss:    (c) => { beep(c, { type: "sawtooth", f0: 110, f1: 70, t: 0.6, vol: 0.16 }); beep(c, { type: "sawtooth", f0: 146, f1: 90, t: 0.6, vol: 0.12, delay: 0.02 }); },
    levelup: (c) => { [523, 659, 784, 1047, 1319].forEach((f, i) => beep(c, { type: "triangle", f0: f, t: 0.14, vol: 0.16, delay: i * 0.08 })); },
    bosswin: (c) => { [392, 523, 659, 784, 1047].forEach((f, i) => beep(c, { type: "square", f0: f, t: 0.16, vol: 0.15, delay: i * 0.1 })); },
    revive:  (c) => { beep(c, { type: "sine", f0: 196, f1: 880, t: 0.5, vol: 0.18 }); },
    death:   (c) => { beep(c, { type: "sawtooth", f0: 392, f1: 70, t: 0.9, vol: 0.18 }); noise(c, { t: 0.5, vol: 0.08, hp: 300, delay: 0.1 }); },
  };

  return {
    play(name) {
      if (muted) return;
      const c = ensure();
      if (!c || !recipes[name]) return;
      try { recipes[name](c); } catch (e) {}
    },
    setMuted(m) { muted = m; if (!m) ensure(); },
    isMuted() { return muted; },
  };
})();

// ---------- pathfinding (BFS over walkable tiles) ----------
// "Walkable" = floor/pickups the hero can pass through freely.
// Monsters, locked chests, and stairs are "blockers": the hero will path
// UP TO them but stops on the tile before, so each is a deliberate tap.
function isWalkthrough(cell) {
  switch (cell.t) {
    case "floor":
    case "heal":
    case "gold":
    case "sword":
    case "shield":
    case "key":
      return true;
    default:
      return false; // wall, monster, chest, relic, altar, down
  }
}

function findPath(grid, from, to) {
  if (from.x === to.x && from.y === to.y) return [];
  const dest = grid[to.y] && grid[to.y][to.x];
  if (!dest || dest.t === "wall") return null;
  const destIsBlocker = !isWalkthrough(dest); // monster/chest/altar/stairs

  const q = [from];
  const prev = new Map();
  prev.set(key(from.x, from.y), null);
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (q.length) {
    const cur = q.shift();
    if (cur.x === to.x && cur.y === to.y) break;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      const cell = grid[ny][nx];
      const isDest = nx === to.x && ny === to.y;
      // can step onto walkthrough tiles, or onto the destination even if it's a blocker
      if (isWalkthrough(cell) || isDest) {
        prev.set(k, cur);
        if (!isDest && !isWalkthrough(cell)) continue; // don't expand past blockers
        q.push({ x: nx, y: ny });
      }
    }
  }

  if (!prev.has(key(to.x, to.y))) return null;
  // reconstruct
  const path = [];
  let node = { x: to.x, y: to.y };
  while (node) {
    path.push(node);
    node = prev.get(key(node.x, node.y));
  }
  path.reverse();
  // path includes 'from' at [0]; return the steps after it
  const steps = path.slice(1);
  // If destination is a blocker, the final step IS the interaction tile —
  // keep it; the move reducer handles fight/open/descend on arrival.
  return { steps, destIsBlocker };
}

// ---------- bestiary ----------
const MONSTERS = [
  { kind: "Rat", e: "🐀", hp: 10, atk: 5, def: 0, min: 1 },
  { kind: "Bat", e: "🦇", hp: 14, atk: 8, def: 0, min: 1 },
  { kind: "Slime", e: "🟢", hp: 20, atk: 7, def: 1, min: 1 },
  { kind: "Spider", e: "🕷️", hp: 18, atk: 13, def: 0, min: 3 },
  { kind: "Skeleton", e: "💀", hp: 30, atk: 15, def: 1, min: 3 },
  { kind: "Ghost", e: "👻", hp: 26, atk: 18, def: 2, min: 5 },
  { kind: "Ghoul", e: "🧟", hp: 42, atk: 21, def: 1, min: 6 },
  { kind: "Vampire", e: "🧛", hp: 56, atk: 27, def: 2, min: 9 },
];

const BOSSES = [
  { kind: "Bone Warden", e: "☠️", hp: 95, atk: 22, def: 2 },
  { kind: "Crypt Lich", e: "🔮", hp: 150, atk: 31, def: 3 },
  { kind: "Wraith King", e: "👑", hp: 215, atk: 40, def: 3 },
  { kind: "Elder Dragon", e: "🐉", hp: 320, atk: 52, def: 4 },
];

// ---------- relics: equippable passives that change how you play ----------
// Each relic has an id, name, emoji, a short description, and hooks the combat
// engine and reducer read. Players hold up to RELIC_SLOTS at once.
const RELIC_SLOTS = 3;
const RELICS = [
  { id: "vampedge", name: "Vampiric Edge", e: "🩸", desc: "Heal a slice of your Max HP for every blow you land in a fight." },
  { id: "stoneskin", name: "Stoneskin", e: "🪨", desc: "The first enemy blow in every fight is fully blocked." },
  { id: "gambler", name: "Gambler's Coin", e: "🪙", desc: "+60% gold from all sources, but healing is 30% weaker." },
  { id: "berserker", name: "Berserker's Brand", e: "🔥", desc: "Up to +50% Attack — the lower your health, the harder you hit." },
  { id: "warden", name: "Warden's Key", e: "🗝️", desc: "Open locked chests without spending a key." },
  { id: "glasscannon", name: "Glass Cannon", e: "💎", desc: "+18% Attack, but you take +8% damage from every enemy blow." },
  { id: "ironheart", name: "Iron Heart", e: "❤️‍🔥", desc: "+25% Max HP the moment you equip it." },
  { id: "scholar", name: "Scholar's Eye", e: "📖", desc: "+35% XP from every kill — level up far faster." },
  { id: "executioner", name: "Executioner", e: "⚔️", desc: "Enemies below 25% HP die in one blow, ignoring defense." },
  { id: "thorns", name: "Thornmail", e: "🌹", desc: "Reflect damage: stronger Defense chips more off each foe's effective HP." },
  { id: "sapper", name: "Sapper's Pick", e: "⛏️", desc: "Your blows ignore half of every enemy's Defense." },
  { id: "aegis", name: "Aegis Plate", e: "🛡️", desc: "+40% Defense (and a little more) the moment you equip it." },
  { id: "frostbite", name: "Frostbite Charm", e: "❄️", desc: "Chill the enemy — block one extra blow in every fight." },
  { id: "hoarder", name: "Hoarder's Ring", e: "💍", desc: "Up to +35% Attack while you carry a deep purse of gold." },
  { id: "revenant", name: "Revenant's Vow", e: "🕯️", desc: "Slaying a boss heals you all the way to full." },
  { id: "keeneye", name: "Keen Eye", e: "🦅", desc: "+20% gold and +20% XP from every kill." },
];
const relicById = (id) => RELICS.find((r) => r.id === id);
const hasRelic = (p, id) => p.relics && p.relics.includes(id);

// ---------- consumables: found on the floor, used from the right-hand slots ----------
// `targeted` items arm on tap, then apply to the next valid cell you tap.
const ITEM_SLOTS = 3;
// `min` is the earliest floor each may drop on — basics early, power deep.
const CONSUMABLES = [
  { id: "draught", name: "Healing Draught", e: "🧪", targeted: false, min: 1, desc: "Restore 45 HP instantly." },
  { id: "ward", name: "Frost Ward", e: "❄️", targeted: false, min: 3, desc: "Your next fight costs no HP." },
  { id: "phase", name: "Phase Step", e: "🌀", targeted: true, min: 3, desc: "Leap over an adjacent monster to the empty tile beyond — no fight." },
  { id: "elixir", name: "Greater Elixir", e: "💖", targeted: false, min: 5, desc: "Heal to full and gain +10 Max HP." },
  { id: "firebomb", name: "Firebomb", e: "🔥", targeted: true, min: 5, desc: "Hurl at an adjacent monster — instantly slays anything but a boss." },
  { id: "tome", name: "Tome of Insight", e: "📜", targeted: false, min: 7, desc: "Gain a level instantly." },
];
const itemById = (id) => CONSUMABLES.find((c) => c.id === id);

// effective attack including stat-style relic effects. These are now
// *multiplicative* so they scale with the hero's growing ATK instead of being
// a flat bonus that becomes meaningless at depth. `floor` is used to benchmark
// "how much gold is a lot" for the Hoarder relic.
function effAtk(p, floor = p.floor || 1) {
  let mult = 1;
  if (hasRelic(p, "glasscannon")) mult += 0.18; // +18% attack
  if (hasRelic(p, "berserker")) mult += Math.min(0.5, 0.5 * Math.max(0, p.maxHp - p.hp) / Math.max(1, p.maxHp)); // up to +50% as you drop low
  if (hasRelic(p, "hoarder")) mult += Math.min(0.35, 0.35 * (p.gold || 0) / (150 * (1 + 0.12 * floor))); // up to +35% from a deep purse
  return p.atk * mult;
}

// ---------- combat (player strikes first; fully deterministic) ----------
// Relic-aware. Returns the exact HP cost plus any heal-back the fight grants.
function combat(p, m) {
  const atk = effAtk(p, m.floor || p.floor || 1);
  let effHp = m.hp;
  // Thornmail chips away effective HP, scaled by how much your Defense reduces
  // damage and by the target's own pool — so it stays relevant at depth without
  // ever trivializing a tanky foe (it's a fraction of their HP, self-capping).
  if (hasRelic(p, "thorns")) {
    const chip = Math.floor(m.hp * mitig(p.def, DEF_K) * 0.5);
    effHp = Math.max(1, m.hp - chip);
  }
  // Your blows are reduced by the enemy's armor as a percentage (diminishing
  // returns), not flat subtraction — so a growing ATK always lands meaningful
  // damage and fights stay a few rounds instead of becoming one-shots.
  // Sapper's Pick halves the enemy's effective armor.
  const rawDef = hasRelic(p, "sapper") ? m.def * 0.5 : m.def;
  const dToM = atk * (1 - mitig(rawDef, ARMOR_K));
  if (dToM <= 0.0001) return { unwinnable: true, cost: Infinity, heal: 0 };

  let rounds = Math.ceil(effHp / dToM);
  // Executioner: the killing blow lands as soon as the enemy would drop below
  // 25% of its (effective) pool, shaving the final swings — model it as needing
  // one fewer round when the last full hit would leave it under the threshold.
  if (hasRelic(p, "executioner") && rounds > 1) {
    const hpAfter = effHp - dToM * (rounds - 1);
    if (hpAfter <= effHp * 0.25) rounds -= 1;
  }

  // Damage taken per blow is the enemy's ATK reduced by your Defense as a
  // percentage. Defense never becomes worthless and never makes you immune.
  let perBlow = m.atk * (1 - mitig(p.def, DEF_K));
  if (hasRelic(p, "glasscannon")) perBlow *= 1.08; // +8% damage taken
  let blowsTaken = rounds - 1;
  if (hasRelic(p, "stoneskin") && blowsTaken > 0) blowsTaken -= 1; // first hit blocked
  if (hasRelic(p, "frostbite") && blowsTaken > 0) blowsTaken -= 1; // an extra blow chilled away

  const cost = Math.max(0, Math.round(blowsTaken * perBlow));
  // Vampiric Edge heals a slice of your max HP per blow you land, so it scales
  // with the hero instead of being a flat trickle that fades at depth.
  const heal = hasRelic(p, "vampedge") ? Math.round(rounds * p.maxHp * 0.02) : 0;
  return { unwinnable: false, cost, heal, rounds };
}

// ---------- floor generation ----------
function scaleMonster(base, floor) {
  // Gentle *linear* growth on both HP and ATK. The hero grows at a matching
  // pace (see applyLevelUps), so a fight's cost stays a roughly constant share
  // of max HP at every depth — endless without the numbers running away.
  const hp = Math.round(base.hp * (1 + HP_RATE * (floor - 1)));
  const atk = Math.round(base.atk * (1 + ATK_RATE * (floor - 1)));
  // Armor grows slowly and stays small: it feeds percentage mitigation now
  // (ARMOR_K), so it only needs to nudge fights from 3 → 5 rounds at depth.
  const def = base.def + Math.floor(floor / 8);
  // Reward scales with total threat, not just HP. Attack is weighted heavily
  // because high-attack mobs cost the most HP to kill and should pay the most.
  const threat = hp + atk * 2.4 + def * 6;
  return {
    t: "monster",
    floor, // combat reads this for floor-aware relics (Hoarder)
    kind: base.kind,
    e: base.e,
    hp,
    atk,
    def,
    gold: Math.max(2, Math.round(threat * 0.14)),
    xp: Math.max(2, Math.round(threat * 0.22)),
  };
}

// Occasionally upgrade an ordinary monster to an "elite": a tougher, glowing
// variant that pays out double. Adds difficulty spikes and variance with
// proportionate reward — never bosses, never on the gentle opening floors.
function maybeElite(mon, floor) {
  if (mon.boss || floor < 3) return mon;
  if (RNG.next() >= clamp(0.05 + floor * 0.01, 0, 0.22)) return mon;
  return {
    ...mon,
    elite: true,
    hp: Math.round(mon.hp * 1.6),
    atk: Math.round(mon.atk * 1.4),
    def: mon.def + 1,
    gold: Math.round(mon.gold * 2),
    xp: Math.round(mon.xp * 2),
  };
}

function makeBoss(floor) {
  const cycle = Math.floor((floor / 5 - 1)) % BOSSES.length;
  const b = BOSSES[cycle];
  // Bosses ride the same gentle linear curve as everything else — their hefty
  // base stats already make them a wall, so no extra repeat-tier multiplier is
  // needed (that double-counted growth and produced the old impossible spikes).
  const hp = Math.round(b.hp * (1 + HP_RATE * (floor - 1)));
  const atk = Math.round(b.atk * (1 + ATK_RATE * (floor - 1)));
  return {
    t: "monster",
    boss: true,
    floor,
    kind: b.kind,
    e: b.e,
    hp,
    atk,
    def: b.def,
    gold: Math.round(hp * 0.5),
    xp: Math.round(hp * 0.4),
  };
}

function emptyGrid() {
  const g = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      row.push({ t: border ? "wall" : "floor" });
    }
    g.push(row);
  }
  return g;
}

function carve(grid, ax, ay, bx, by) {
  // L-shaped corridor: horizontal then vertical. Turn walls into floor.
  let x = ax;
  const stepX = bx > ax ? 1 : -1;
  while (x !== bx) {
    if (grid[ay][x].t === "wall") grid[ay][x] = { t: "floor" };
    x += stepX;
  }
  let y = ay;
  const stepY = by > ay ? 1 : -1;
  while (y !== by) {
    if (grid[y][bx].t === "wall") grid[y][bx] = { t: "floor" };
    y += stepY;
  }
}

function nonWallNeighbors(grid, x, y) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let c = 0;
  for (const [dx, dy] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (grid[ny] && grid[ny][nx] && grid[ny][nx].t !== "wall") c++;
  }
  return c;
}

// flood fill of every tile reachable from `start` (walls block movement,
// 4-directional only — so a tile touching the maze only diagonally is NOT
// reachable, which is exactly what we want to forbid).
function reachableSet(grid, start) {
  const seen = new Set([key(start.x, start.y)]);
  const q = [start];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  while (q.length) {
    const c = q.shift();
    for (const [dx, dy] of dirs) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      if (grid[ny][nx].t === "wall") continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

function generate(floor) {
  const isBoss = floor % 5 === 0;
  const grid = emptyGrid();

  // scatter internal walls
  const wallCount = ri(5, 11);
  for (let i = 0; i < wallCount; i++) {
    const x = ri(1, COLS - 2), y = ri(2, ROWS - 3);
    grid[y][x] = { t: "wall" };
  }

  // start (top)
  const start = { x: ri(1, COLS - 2), y: 1 };
  grid[start.y][start.x] = { t: "floor" };

  // down stairs + (boss) gate. Stairs are ALWAYS flanked by walls so they
  // form a dead end and can never sever the map.
  let downX, downY, bossTile = null;
  if (isBoss) {
    downX = Math.floor(COLS / 2);
    downY = ROWS - 2;
    bossTile = { x: downX, y: downY - 1 };
    grid[downY][downX] = { t: "down" };
    grid[downY][downX - 1] = { t: "wall" };
    grid[downY][downX + 1] = { t: "wall" };
    grid[bossTile.y][bossTile.x] = makeBoss(floor);
    carve(grid, start.x, start.y, bossTile.x, bossTile.y);
  } else {
    downX = ri(2, COLS - 3);
    downY = ROWS - 2;
    grid[downY][downX] = { t: "down" };
    grid[downY][downX - 1] = { t: "wall" };
    grid[downY][downX + 1] = { t: "wall" };
    // carve to the stairs tile; the loop stops before it, carving the tile
    // directly above (the stairs' only open neighbour) so it's always reachable
    carve(grid, start.x, start.y, downX, downY);
  }

  // remove unreachable "island" floor tiles so nothing can be stranded on one
  const reach = reachableSet(grid, start);
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      const c = grid[y][x];
      if (c.t !== "wall" && c.t !== "down" && !reach.has(key(x, y))) {
        grid[y][x] = { t: "wall" };
      }
    }
  }

  // tiles we must never place loot on
  const reserved = new Set([key(start.x, start.y), key(downX, downY)]);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    reserved.add(key(start.x + dx, start.y + dy));
  }
  if (bossTile) reserved.add(key(bossTile.x, bossTile.y));

  // single source of truth for placement: refuses to ever double-occupy a tile
  const occupied = new Set(reserved);
  const place = (x, y, obj) => {
    const k = key(x, y);
    if (occupied.has(k)) return false;
    if (!grid[y] || !grid[y][x] || grid[y][x].t !== "floor") return false;
    grid[y][x] = obj;
    occupied.add(k);
    return true;
  };

  // candidate open tiles (reachable floor, not reserved)
  let open = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[y][x].t === "floor" && !reserved.has(key(x, y)) && reach.has(key(x, y))) {
        open.push({ x, y });
      }
    }
  }
  open = shuffle(open);

  // dead ends = exactly one open (non-wall) neighbour. Blockers go here ONLY,
  // so placing one can never disconnect the rest of the floor.
  const deadEnds = open.filter((p) => nonWallNeighbors(grid, p.x, p.y) === 1);
  const usedDeadEnd = new Set();
  const takeDeadEnd = () => {
    for (const d of deadEnds) {
      const k = key(d.x, d.y);
      if (!usedDeadEnd.has(k) && !occupied.has(k)) {
        usedDeadEnd.add(k);
        return d;
      }
    }
    return null;
  };
  const takeOpen = () => {
    while (open.length) {
      const t = open.pop();
      if (!occupied.has(key(t.x, t.y))) return t;
    }
    return null;
  };

  // ---- blockers first, on dead ends ----
  const preBoss = floor % 5 === 4; // floors 4,9,14… — the last stop before a boss

  // locked chest (best loot) + its key, placed together or not at all
  if (RNG.next() < 0.6) {
    const ch = takeDeadEnd();
    if (ch && place(ch.x, ch.y, { t: "chest", locked: true })) {
      const kt = takeOpen();
      if (kt) place(kt.x, kt.y, { t: "key" });
    }
  }
  // relic chest — a special chest that grants an equippable relic. Gated to
  // floor 3+ with a low, slowly-ramping chance so relics stay prizes and you
  // don't fill all three slots by mid-game.
  if (floor >= 3 && RNG.next() < 0.16 + Math.min(floor, 15) * 0.012) {
    const ch = takeDeadEnd();
    if (ch) place(ch.x, ch.y, { t: "relic", locked: floor >= 6 && RNG.next() < 0.5 });
  }
  // free chest
  if (RNG.next() < 0.3) {
    const ch = takeDeadEnd();
    if (ch) place(ch.x, ch.y, { t: "chest", locked: false });
  }
  // altar (shop): GUARANTEED on the floor right before every boss, so you can
  // always gear up first; otherwise a normal random chance.
  if (preBoss) {
    const a = takeDeadEnd() || takeOpen();
    if (a) place(a.x, a.y, { t: "altar", preBoss: true });
  } else if (RNG.next() < 0.45) {
    const a = takeDeadEnd();
    if (a) place(a.x, a.y, { t: "altar" });
  }

  // ---- monsters & consumables on remaining open tiles ----
  const pool = MONSTERS.filter((m) => m.min <= floor);
  // Density rises with depth but stays capped so a floor is always *traversable*
  // by picking your fights — you can never be forced to fight your way through a
  // wall of bodies, but you also can't clear every monster on the HP you have.
  const monsterCount = clamp(4 + Math.floor(floor * 0.5), 4, Math.floor(open.length * 0.5));
  for (let i = 0; i < monsterCount; i++) {
    const t = takeOpen();
    if (!t) break;
    place(t.x, t.y, maybeElite(scaleMonster(choice(pool), floor), floor));
  }

  // Healing thins out as you descend: floors 1-3 are forgiving; deeper floors
  // keep HP a real resource as fights start costing more. The %4 bonus and the
  // "big draught" roll only apply in the shallows.
  const heals = (floor <= 3 ? 2 : 1) + (isBoss ? 1 : 0) + (floor < 10 && floor % 4 === 0 ? 1 : 0);
  for (let i = 0; i < heals; i++) {
    const t = takeOpen();
    if (!t) break;
    const big = floor < 10 && RNG.next() < 0.18;
    // Heals are a fraction of your max HP, resolved on pickup — so a draught is
    // always meaningful no matter how large your HP pool has grown.
    place(t.x, t.y, { t: "heal", big, pct: big ? 0.45 : 0.22 });
  }

  // consumable drop — potions & skills, the only source of usable items. Gated
  // to floor 2+ and rarer than before; the pool is filtered by each item's `min`
  // floor so basics come early and powerful skills only appear deeper.
  const itemPool = CONSUMABLES.filter((c) => floor >= (c.min || 1));
  if (floor >= 2 && itemPool.length && RNG.next() < 0.32) {
    const t = takeOpen();
    if (t) place(t.x, t.y, { t: "item", id: choice(itemPool).id });
  }

  if (RNG.next() < 0.7) {
    const t = takeOpen();
    if (t) place(t.x, t.y, { t: "gold", amt: 8 + floor * 3 + ri(0, 5) });
  }
  if (RNG.next() < 0.22) {
    const t = takeOpen();
    if (t) place(t.x, t.y, { t: "sword", amt: 2 + Math.floor(floor / 4) });
  }
  if (RNG.next() < 0.18) {
    const t = takeOpen();
    if (t) place(t.x, t.y, { t: "shield", amt: 1 + Math.floor(floor / 6) });
  }

  return { grid, start: { ...start } };
}

// ---------- reinforcements: monsters that wander in while you dawdle ----------
// Ticked once per real step. The deeper you are the faster they arrive, capped
// per floor so it never becomes unwinnable. Beeline the stairs and you outrun
// them; explore/farm and the crypt fills in behind you — the time-pressure that
// rewards quick decisions. Mutates g (grid already copied by the MOVE handler).
function maybeSpawnReinforcement(g) {
  const floor = g.floor;
  g.floorSteps = (g.floorSteps || 0) + 1;
  const interval = clamp(13 - Math.floor(floor / 2), 6, 13);
  if (g.floorSteps % interval !== 0) return;
  const maxReinf = Math.min(3 + Math.floor(floor / 6), 8);
  if ((g.reinforcements || 0) >= maxReinf) return;

  // candidate floor tiles at least 3 away from the hero (no instant ambush)
  const p = g.player;
  const spots = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (g.grid[y][x].t !== "floor") continue;
      if (Math.abs(x - p.x) + Math.abs(y - p.y) <= 2) continue;
      spots.push({ x, y });
    }
  }
  if (!spots.length) return;

  // keep the Daily identical for everyone: seed the picks from depth + step
  const seeded = g.seed != null;
  if (seeded) RNG.use(seededRng((g.seed + floor * 2654435761 + g.floorSteps * 40503) >>> 0));
  const spot = choice(spots);
  const pool = MONSTERS.filter((m) => m.min <= floor);
  const mon = maybeElite(scaleMonster(choice(pool), floor), floor);
  if (seeded) RNG.reset();

  g.grid[spot.y][spot.x] = mon;
  g.reinforcements = (g.reinforcements || 0) + 1;
  sfx(g, "warn");
  pushLog(g, `🦴 ${mon.kind} crawls out of the dark!`);
  g.toast = "Something stirs in the crypt…";
}

// ---------- chest rewards ----------
function rollReward(floor, locked) {
  // Stat rewards scale with depth so a deep chest is worth opening — a flat
  // +4 ATK would be noise once your ATK is in the hundreds.
  const lAtk = Math.round(4 + floor / 4);
  const lDef = Math.round(3 + floor / 5);
  const uAtk = Math.round(2 + floor / 6);
  const uDef = Math.max(1, Math.round(floor / 8));
  const opts = locked
    ? [
        { maxHp: Math.round(40 + floor * 4), heal: true, label: "+Max HP & full heal" },
        { atk: lAtk, label: `+${lAtk} Attack` },
        { def: lDef, label: `+${lDef} Defense` },
        { gold: 40 + floor * 10, label: "treasure" },
      ]
    : [
        { maxHp: Math.round(12 + floor * 1.5), label: "+Max HP" },
        { atk: uAtk, label: `+${uAtk} Attack` },
        { def: uDef, label: `+${uDef} Defense` },
        { gold: 15 + floor * 4, label: "coins" },
      ];
  return choice(opts);
}

// ---------- game state ----------
function newGame(opts = {}) {
  const { seed = null, meta = null, daily = false } = opts;
  if (seed != null) RNG.use(seededRng((seed + 1 * 2654435761) >>> 0));
  const { grid, start } = generate(1);
  if (seed != null) RNG.reset();
  // permanent meta perks (earned across all runs)
  const perks = metaPerks(meta);
  return {
    screen: "playing",
    daily,
    seed,
    grid,
    player: start,
    floor: 1,
    hp: 80 + perks.bonusHp,
    maxHp: 80 + perks.bonusHp,
    atk: 10 + perks.bonusAtk,
    def: 3 + perks.bonusDef,
    gold: perks.bonusGold,
    level: 1,
    xp: 0,
    keys: 0,
    charm: false,
    slain: 0,
    relics: perks.startRelic ? [perks.startRelic] : [],
    pendingRelic: null,
    relicChoiceOpen: false,
    items: [],
    armedItem: null,
    ward: false,
    floorSteps: 0,
    reinforcements: 0,
    upgradesBought: 0,
    lifetimeSlain: meta ? meta.lifetimeSlain : 0,
    bossesBeaten: meta ? meta.bossesBeaten : 0,
    log: ["You descend into the crypt. The torches gutter behind you."],
    toast: null,
    altarOpen: false,
    confirm: null,
    fx: null,
    fxId: 0,
    sfx: null,
    sfxId: 0,
    deathLine: "",
  };
}

// permanent unlocks driven by lifetime stats (the meta-progression bar)
const META_TIERS = [
  { need: 0,    bonusHp: 0,  bonusAtk: 0, bonusDef: 0, label: "Wanderer" },
  { need: 50,   bonusHp: 5,  bonusAtk: 0, bonusDef: 0, label: "Delver" },
  { need: 150,  bonusHp: 10, bonusAtk: 1, bonusDef: 0, label: "Crypt-Breaker" },
  { need: 350,  bonusHp: 15, bonusAtk: 1, bonusDef: 1, label: "Tomb Warden" },
  { need: 700,  bonusHp: 20, bonusAtk: 2, bonusDef: 1, label: "Deathless" },
  { need: 1300, bonusHp: 30, bonusAtk: 2, bonusDef: 2, label: "Hollow Slayer" },
];
function metaTier(meta) {
  const kills = meta ? meta.lifetimeSlain : 0;
  let t = META_TIERS[0];
  for (const tier of META_TIERS) if (kills >= tier.need) t = tier;
  return t;
}
function metaPerks(meta) {
  const t = metaTier(meta);
  return {
    bonusHp: t.bonusHp,
    bonusAtk: t.bonusAtk,
    bonusDef: t.bonusDef,
    bonusGold: 0,
    startRelic: null,
  };
}

function xpNeeded(level) {
  // Near-linear so the hero's level keeps pace with the floor (~level ≈ floor).
  // The old level^1.35 curve out-ran the linear XP income at depth, leaving the
  // hero badly under-levelled exactly when monsters were toughest.
  return Math.round(45 + 22 * level);
}

function pushLog(g, text) {
  g.log = [text, ...g.log].slice(0, 4);
}

function setFx(g, text, color) {
  g.fxId += 1;
  g.fx = { id: g.fxId, text, color };
}

function sfx(g, name) {
  g.sfxId += 1;
  g.sfx = { id: g.sfxId, name };
}

// ---- relic-aware resource helpers (single place for the modifiers) ----
function gainGold(g, amt) {
  let a = amt;
  if (hasRelic(g, "gambler")) a = Math.round(a * 1.6);
  if (hasRelic(g, "keeneye")) a = Math.round(a * 1.2);
  g.gold += a;
  return a;
}
function gainXp(g, amt) {
  let a = amt;
  if (hasRelic(g, "scholar")) a = Math.round(a * 1.35);
  if (hasRelic(g, "keeneye")) a = Math.round(a * 1.2);
  g.xp += a;
  return a;
}
function applyHeal(g, amt) {
  let a = amt;
  if (hasRelic(g, "gambler")) a = Math.round(a * 0.7);
  g.hp = clamp(g.hp + a, 0, g.maxHp);
  return a;
}
// immediate stat relics apply the moment they're actually equipped — as a
// percentage of your current stat so they stay impactful at any depth. Applied
// in exactly one place per relic (direct equip here, or on swap-in) so the
// bonus is never double-counted and is never gained for a relic you declined.
function applyEquipBonus(g, id) {
  if (id === "ironheart") { const b = Math.round(g.maxHp * 0.25); g.maxHp += b; g.hp += b; }
  if (id === "aegis") { g.def = Math.round(g.def * 1.4) + 4; }
}

// grant a random relic the player doesn't already hold; returns the relic or null
function grantRelic(g) {
  const owned = g.relics || [];
  const pool = RELICS.filter((r) => !owned.includes(r.id));
  if (!pool.length) return null;
  const relic = choice(pool);
  if (owned.length < RELIC_SLOTS) {
    applyEquipBonus(g, relic.id); // equipped right now
    g.relics = [...owned, relic.id];
    g.pendingRelic = null;
  } else {
    // slots full → stash it; the bonus applies only if/when it's swapped in
    g.pendingRelic = relic.id;
  }
  return relic;
}

// spend banked XP into as many level-ups as it covers. Mutates g.
function applyLevelUps(g) {
  while (g.xp >= xpNeeded(g.level)) {
    g.xp -= xpNeeded(g.level);
    g.level += 1;
    // Each level keeps pace with the linear monster curve: a solid Max HP bump
    // (so damage stays a constant share of your bar) plus ATK and DEF. DEF gives
    // diminishing-returns mitigation now, so +1 every level is safe — it can't
    // make fights free the way flat subtraction once did.
    g.maxHp += 12;
    g.hp = clamp(g.hp + Math.round(g.maxHp * 0.06), 0, g.maxHp);
    g.atk += 1;
    g.def += 1;
    setFx(g, `★ LEVEL ${g.level}`, "#ffd24d");
    sfx(g, "levelup");
    pushLog(g, `★ LEVEL ${g.level}! +12 Max HP, +1 ATK, +1 DEF (and some HP back).`);
  }
}

// grant the rewards for slaying `cell`. Does NOT move the player or clear the
// tile — callers handle the board. Used by melee combat and the Firebomb item.
function awardKill(g, cell) {
  gainGold(g, cell.gold);
  gainXp(g, cell.xp);
  g.slain += 1;
  g.lifetimeSlain = (g.lifetimeSlain || 0) + 1;
  if (cell.boss) {
    // Boss rewards scale with depth so a floor-50 boss is a real power spike,
    // not the same +2 ATK it gave on floor 5.
    const f = cell.floor || g.floor || 1;
    const hpUp = Math.round(20 + f * 2);
    const atkUp = Math.round(2 + f / 8);
    const defUp = Math.round(1 + f / 12);
    g.maxHp += hpUp;
    g.atk += atkUp;
    g.def += defUp;
    g.hp = clamp(g.hp + Math.round(g.maxHp * 0.25), 0, g.maxHp);
    g.bossesBeaten = (g.bossesBeaten || 0) + 1;
    pushLog(g, `The boss's essence floods you: +${hpUp} Max HP, +${atkUp} ATK, +${defUp} DEF, and a surge of health.`);
    if (hasRelic(g, "revenant")) {
      g.hp = g.maxHp;
      setFx(g, "🕯 FULL HP", "#ffd27a");
      pushLog(g, "Revenant's Vow restores you to full.");
    }
  }
  applyLevelUps(g);
}

// instant (non-targeted) consumables. Mutates g.
function applyInstantItem(g, id) {
  switch (id) {
    case "draught": {
      const got = applyHeal(g, Math.round(g.maxHp * 0.35));
      setFx(g, `+${fmt(got)} HP`, "#ff5f6d");
      sfx(g, "heal");
      pushLog(g, `You quaff a Healing Draught (+${fmt(got)} HP).`);
      break;
    }
    case "elixir": {
      const bonus = Math.round(g.maxHp * 0.06);
      g.maxHp += bonus;
      g.hp = g.maxHp;
      setFx(g, `FULL HP +${fmt(bonus)}`, "#ff9bb0");
      sfx(g, "heal");
      pushLog(g, `The Greater Elixir floods you — full health and +${fmt(bonus)} Max HP.`);
      break;
    }
    case "ward": {
      g.ward = true;
      setFx(g, "❄ FROST WARD", "#7ec8ff");
      sfx(g, "gear");
      pushLog(g, "Frost Ward shimmers — your next fight will cost no HP.");
      break;
    }
    case "tome": {
      g.xp += xpNeeded(g.level);
      setFx(g, "📜 INSIGHT", "#ffd24d");
      sfx(g, "levelup");
      pushLog(g, "You absorb the Tome of Insight.");
      applyLevelUps(g);
      break;
    }
    default:
      break;
  }
}

// targeted consumables. Mutates g (grid already copied by the caller).
// Returns true if the item was spent, false if it should stay in the pack.
function applyTargetedItem(g, id, tx, ty) {
  const p = g.player;
  const dx = tx - p.x, dy = ty - p.y;
  const adjacent = Math.abs(dx) + Math.abs(dy) === 1;
  const target = g.grid[ty] && g.grid[ty][tx];
  if (!adjacent || !target || target.t !== "monster") {
    g.toast = "Aim at an adjacent monster.";
    return false;
  }
  if (id === "phase") {
    const lx = tx + dx, ly = ty + dy;
    const land = g.grid[ly] && g.grid[ly][lx];
    if (!land || !isWalkthrough(land)) {
      g.toast = "No room to leap beyond.";
      return false;
    }
    g.player = { x: lx, y: ly };
    g.confirm = null;
    setFx(g, "🌀 PHASE", "#b98bff");
    sfx(g, "step");
    pushLog(g, `You phase past the ${target.kind} in a blur.`);
    return true;
  }
  if (id === "firebomb") {
    if (target.boss) {
      g.toast = "The blast barely scratches the boss.";
      return false;
    }
    awardKill(g, target);
    g.grid[ty][tx] = { t: "floor" };
    setFx(g, "🔥 BOOM", "#ff7a2e");
    sfx(g, "hit");
    pushLog(g, `Your Firebomb engulfs the ${target.kind}!`);
    return true;
  }
  return false;
}

function score(g) {
  return g.floor * 120 + g.gold + g.level * 30 + g.slain * 10;
}

// Altar catalog. Items unlock with depth, so the shop keeps giving you new
// reasons to save gold as you descend. `min` is the floor it appears on.
function shopItems(g) {
  const f = g.floor;
  // Permanent stat upgrades get a little pricier with each one bought this run,
  // but the ramp is gentle and capped so deep-run upgrades never lock out — the
  // *effect* scales with depth too, so each buy stays meaningful forever.
  const up = Math.min(2.5, 1 + 0.15 * (g.upgradesBought || 0));
  const statPrice = Math.round((30 + f * 8) * up);
  // Upgrade effects scale with floor so a deep "+Attack" is a real boost, not
  // the same +2 it was on floor 1. `amount` is the single source of truth that
  // BUY reads when applying the purchase.
  const atkUp = Math.round(2 + f / 6);
  const defUp = Math.round(2 + f / 8);
  const bandUp = Math.round(15 + f * 2);
  const mendUp = "≈" + fmt(Math.round((g.maxHp || 80) * 0.4));
  const all = [
    { opt: "heal", min: 1, icon: "❤", title: "Mend Wounds", desc: `Restore ${mendUp} HP`, price: 22 + f * 5 },
    { opt: "atk", min: 1, icon: "⚔", title: "Whet the Blade", desc: `+${atkUp} Attack, forever`, price: statPrice, amount: atkUp },
    { opt: "def", min: 1, icon: "🛡", title: "Temper Armor", desc: `+${defUp} Defense, forever`, price: statPrice, amount: defUp },
    { opt: "key", min: 3, icon: "🗝️", title: "Iron Key", desc: "Opens one locked chest", price: 35 + f * 6 },
    { opt: "band", min: 5, icon: "➕", title: "Bandolier", desc: `+${bandUp} Max HP (and heal ${bandUp})`, price: statPrice, amount: bandUp },
    { opt: "greater", min: 5, icon: "💖", title: "Greater Draught", desc: "Heal all the way to full", price: 50 + f * 9 },
    { opt: "charm", min: 8, icon: "🔥", title: "Phoenix Charm", desc: "Survive one killing blow at ½ HP", price: 120 + f * 18, soldOut: g.charm },
    { opt: "relic", min: 4, icon: "✦", title: "Mystic Relic", desc: "Attune to a random new relic", price: 90 + f * 12, soldOut: (g.relics || []).length >= RELICS.length },
  ];
  return all.filter((it) => f >= it.min);
}

function reducer(state, action) {
  switch (action.type) {
    case "NEW_GAME":
      return newGame(action.opts || {});
    case "CONTINUE":
      return { ...action.state, screen: "playing", toast: null, confirm: null, altarOpen: false, armedItem: null };
    case "GO_START":
      return { ...state, screen: "start" };
    case "DISMISS_TOAST":
      return { ...state, toast: null };
    case "CLOSE_ALTAR":
      return { ...state, altarOpen: false };

    case "SWAP_RELIC": {
      // replace relic at action.index with the pending relic
      if (!state.pendingRelic) return state;
      const g = { ...state, relics: state.relics.slice() };
      const incoming = state.pendingRelic;
      const dropped = g.relics[action.index];
      g.relics[action.index] = incoming;
      applyEquipBonus(g, incoming); // immediate-effect relic applies when actually equipped
      g.pendingRelic = null;
      g.relicChoiceOpen = false;
      pushLog(g, `You swap out ${relicById(dropped)?.name} for ${relicById(incoming)?.name}.`);
      sfx(g, "chest");
      return g;
    }
    case "DECLINE_RELIC": {
      if (!state.pendingRelic) return state;
      const g = { ...state };
      pushLog(g, `You leave the ${relicById(state.pendingRelic)?.name} behind.`);
      g.pendingRelic = null;
      g.relicChoiceOpen = false;
      return g;
    }

    case "USE_ITEM": {
      if (state.screen !== "playing" || state.altarOpen || state.relicChoiceOpen) return state;
      const idx = action.index;
      const id = state.items[idx];
      if (!id) return state;
      const def = itemById(id);
      // tapping the already-armed item cancels its targeting
      if (state.armedItem && state.armedItem.index === idx) {
        return { ...state, armedItem: null, toast: null };
      }
      if (def.targeted) {
        return { ...state, armedItem: { id, index: idx }, toast: `${def.e} ${def.name} — tap a target.` };
      }
      // instant item: apply now and remove from the pack
      const g = { ...state, items: state.items.slice(), armedItem: null, toast: null };
      applyInstantItem(g, id);
      g.items.splice(idx, 1);
      if (g.hp <= 0) { g.screen = "dead"; g.deathLine = deathFlavor(g.floor, null); }
      return g;
    }
    case "APPLY_ITEM": {
      if (state.screen !== "playing") return state;
      const { index, tx, ty } = action;
      const id = state.items[index];
      if (!id) return state;
      const g = {
        ...state,
        grid: state.grid.map((r) => r.slice()),
        items: state.items.slice(),
        armedItem: null,
        toast: null,
      };
      const spent = applyTargetedItem(g, id, tx, ty);
      if (spent) g.items.splice(index, 1);
      return g;
    }

    case "BUY": {
      if (!state.altarOpen) return state;
      const it = shopItems(state).find((i) => i.opt === action.opt);
      if (!it) return state;
      if (it.soldOut) return { ...state, toast: "You already carry one." };
      if (state.gold < it.price) return { ...state, toast: "Not enough gold." };
      const g = { ...state };
      g.gold -= it.price;
      switch (action.opt) {
        case "heal": {
          const amt = applyHeal(g, Math.round(g.maxHp * 0.4));
          setFx(g, `+${fmt(amt)} HP`, "#ff5f6d");
          break;
        }
        case "atk": g.atk += it.amount; g.upgradesBought = (g.upgradesBought || 0) + 1; setFx(g, `+${it.amount} ATK`, "#ffd27a"); break;
        case "def": g.def += it.amount; g.upgradesBought = (g.upgradesBought || 0) + 1; setFx(g, `+${it.amount} DEF`, "#7ec8ff"); break;
        case "key": g.keys += 1; setFx(g, "🗝️ +1", "#ffd24d"); break;
        case "band":
          g.maxHp += it.amount;
          g.hp = clamp(g.hp + it.amount, 0, g.maxHp);
          g.upgradesBought = (g.upgradesBought || 0) + 1;
          setFx(g, `+${fmt(it.amount)} MAX HP`, "#ff9bb0");
          break;
        case "greater": g.hp = g.maxHp; setFx(g, "FULL HP", "#ff5f6d"); break;
        case "charm": g.charm = true; setFx(g, "🔥 CHARM", "#ffd27a"); break;
        case "relic": {
          const relic = grantRelic(g);
          if (!relic) { g.gold += it.price; g.toast = "You already hold every relic."; return g; }
          setFx(g, "✦ RELIC ✦", "#b98bff");
          if (g.pendingRelic) {
            g.relicChoiceOpen = true;
            pushLog(g, `The altar offers the ${relic.e} ${relic.name} — your slots are full, choose one to replace.`);
          } else {
            pushLog(g, `You attune to the ${relic.e} ${relic.name}: ${relic.desc}`);
          }
          break;
        }
        default: break;
      }
      g.toast = "The altar's glow dims as you pay.";
      sfx(g, "buy");
      return g;
    }

    case "MOVE": {
      if (state.screen !== "playing" || state.altarOpen || state.relicChoiceOpen) return state;
      const { dx, dy, force } = action;
      const nx = state.player.x + dx;
      const ny = state.player.y + dy;
      if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) return state;
      const cell = state.grid[ny][nx];
      if (cell.t === "wall") return state;

      // working copy
      const g = {
        ...state,
        grid: state.grid.map((r) => r.slice()),
        keys: state.keys,
        toast: null,
      };
      const clearTile = () => (g.grid[ny][nx] = { t: "floor" });
      const moveIn = () => (g.player = { x: nx, y: ny });
      let resolvedConfirm = false;

      switch (cell.t) {
        case "floor": {
          moveIn();
          sfx(g, "step");
          break;
        }
        case "down": {
          if (g.seed != null) RNG.use(seededRng((g.seed + (g.floor + 1) * 2654435761) >>> 0));
          const next = generate(g.floor + 1);
          if (g.seed != null) RNG.reset();
          g.grid = next.grid;
          g.player = next.start;
          g.floor += 1;
          g.floorSteps = 0;
          g.reinforcements = 0;
          g.hp = clamp(g.hp + Math.round(g.maxHp * 0.03), 0, g.maxHp);
          g.confirm = null;
          sfx(g, g.floor % 5 === 0 ? "boss" : "stairs");
          pushLog(
            g,
            g.floor % 5 === 0
              ? `Floor ${g.floor} — a great malice stirs ahead…`
              : `You descend to floor ${g.floor}.`
          );
          return g;
        }
        case "heal": {
          // pct of max HP (resolved here so it scales with your grown pool);
          // fall back to a legacy flat `amt` for any pre-update saved tile.
          const amount = cell.pct != null ? Math.round(g.maxHp * cell.pct) : (cell.amt || 0);
          const got = applyHeal(g, amount);
          setFx(g, `+${fmt(got)} HP`, "#ff5f6d");
          sfx(g, "heal");
          pushLog(g, `You drink a ${cell.big ? "greater " : ""}draught (+${fmt(got)} HP).`);
          clearTile();
          moveIn();
          break;
        }
        case "gold": {
          const got = gainGold(g, cell.amt);
          setFx(g, `+${fmt(got)} gold`, "#ffd24d");
          sfx(g, "coin");
          pushLog(g, `You pocket ${fmt(got)} gold.`);
          clearTile();
          moveIn();
          break;
        }
        case "sword": {
          g.atk += cell.amt;
          setFx(g, `+${cell.amt} ATK`, "#ffd27a");
          sfx(g, "gear");
          pushLog(g, `You claim a blade (+${cell.amt} ATK).`);
          clearTile();
          moveIn();
          break;
        }
        case "shield": {
          g.def += cell.amt;
          setFx(g, `+${cell.amt} DEF`, "#7ec8ff");
          sfx(g, "gear");
          pushLog(g, `You strap on armor (+${cell.amt} DEF).`);
          clearTile();
          moveIn();
          break;
        }
        case "key": {
          g.keys += 1;
          setFx(g, "🗝️", "#ffd24d");
          sfx(g, "key");
          pushLog(g, "You find an iron key.");
          clearTile();
          moveIn();
          break;
        }
        case "altar": {
          moveIn();
          g.altarOpen = true;
          sfx(g, "altar");
          break;
        }
        case "chest": {
          const freeOpen = hasRelic(g, "warden");
          if (cell.locked && g.keys <= 0 && !freeOpen) {
            g.toast = "🔒 Locked. You need a key.";
            sfx(g, "locked");
            return g;
          }
          if (cell.locked && !freeOpen) g.keys -= 1;
          const r = rollReward(g.floor, cell.locked);
          let msg = [];
          if (r.maxHp) { g.maxHp += r.maxHp; g.hp += r.maxHp; msg.push(`+${fmt(r.maxHp)} Max HP`); }
          if (r.heal) { g.hp = g.maxHp; msg.push("full heal"); }
          if (r.atk) { g.atk += r.atk; msg.push(`+${fmt(r.atk)} ATK`); }
          if (r.def) { g.def += r.def; msg.push(`+${fmt(r.def)} DEF`); }
          if (r.gold) { const got = gainGold(g, r.gold); msg.push(`+${fmt(got)} gold`); }
          if (cell.locked && freeOpen) msg.push("(Warden's Key)");
          setFx(g, cell.locked ? "✦ LOOT ✦" : "loot", "#9b7bff");
          sfx(g, "chest");
          pushLog(g, `Chest opened: ${msg.join(", ")}.`);
          clearTile();
          moveIn();
          break;
        }
        case "relic": {
          const freeOpen = hasRelic(g, "warden");
          if (cell.locked && g.keys <= 0 && !freeOpen) {
            g.toast = "🔒 Sealed reliquary. You need a key.";
            sfx(g, "locked");
            return g;
          }
          if (cell.locked && !freeOpen) g.keys -= 1;
          const relic = grantRelic(g);
          if (!relic) {
            // already hold every relic — convert to gold instead
            const got = gainGold(g, 60 + g.floor * 8);
            setFx(g, `+${got} gold`, "#ffd24d");
            pushLog(g, "The reliquary holds nothing new — you take its gold.");
          } else if (g.pendingRelic) {
            setFx(g, "✦ RELIC ✦", "#b98bff");
            sfx(g, "chest");
            pushLog(g, `You found the ${relic.e} ${relic.name}! Your relic slots are full — choose one to replace.`);
            g.relicChoiceOpen = true;
          } else {
            setFx(g, "✦ RELIC ✦", "#b98bff");
            sfx(g, "chest");
            pushLog(g, `You attune to the ${relic.e} ${relic.name}: ${relic.desc}`);
          }
          clearTile();
          moveIn();
          break;
        }
        case "item": {
          if ((g.items || []).length >= ITEM_SLOTS) {
            g.toast = "Your pack is full — use something first.";
            return g;
          }
          const it = itemById(cell.id);
          g.items = [...(g.items || []), cell.id];
          setFx(g, `${it.e} ${it.name}`, "#9bf0ab");
          sfx(g, "gear");
          pushLog(g, `You pocket a ${it.name}: ${it.desc}`);
          clearTile();
          moveIn();
          break;
        }
        case "monster": {
          const res = combat(g, cell);
          if (res.unwinnable) {
            g.toast = "Your blows glance off — far too tough.";
            return g;
          }
          // Frost Ward turns the next fight free, then is spent.
          if (g.ward) {
            res.cost = 0;
            g.ward = false;
            setFx(g, "❄ WARDED", "#7ec8ff");
          }
          // shared reward/level-up logic for any successful kill
          const finishKill = () => {
            awardKill(g, cell);
            clearTile();
            moveIn();
          };

          if (res.cost >= g.hp) {
            // would be fatal — Phoenix Charm saves you if you carry one
            if (g.charm) {
              g.charm = false;
              finishKill();
              g.hp = Math.max(1, Math.floor(g.maxHp / 2));
              g.confirm = null;
              setFx(g, "✦ REVIVED ✦", "#ffd27a");
              sfx(g, "revive");
              pushLog(g, `Your Phoenix Charm shatters — you slay the ${cell.kind} and rise at half health!`);
              return g;
            }
            // otherwise require a confirming second tap (or force from inspect)
            if (force || (state.confirm && state.confirm.x === nx && state.confirm.y === ny)) {
              resolvedConfirm = true;
              g.hp = 0;
              g.slain += 1;
              g.confirm = null;
              g.screen = "dead";
              g.deathLine = deathFlavor(g.floor, cell);
              sfx(g, "death");
              return g;
            }
            g.confirm = { x: nx, y: ny };
            g.toast = `☠ ${cell.kind} would cost ${fmt(res.cost)} HP — fatal! Tap again to risk it.`;
            sfx(g, "warn");
            return g;
          }
          // normal kill
          g.hp -= res.cost;
          if (res.heal > 0) g.hp = clamp(g.hp + res.heal, 0, g.maxHp);
          const costLabel = res.cost > 0
            ? (res.heal > 0 ? `-${fmt(res.cost)} +${fmt(res.heal)}` : `-${fmt(res.cost)} HP`)
            : (res.heal > 0 ? `+${fmt(res.heal)} HP` : "clean kill");
          setFx(g, costLabel, res.cost > res.heal ? "#ff5f6d" : "#74e08a");
          sfx(g, cell.boss ? "bosswin" : "hit");
          pushLog(
            g,
            cell.boss
              ? `⚔ You vanquish the ${cell.kind}! (−${fmt(res.cost)} HP, +${fmt(cell.gold)} gold)`
              : `You slay the ${cell.kind} (−${fmt(res.cost)} HP).`
          );
          finishKill();
          break;
        }
        default:
          return state;
      }

      if (!resolvedConfirm) g.confirm = null;
      // a real step was taken on this floor — the crypt may send reinforcements
      maybeSpawnReinforcement(g);
      if (g.hp <= 0) {
        g.screen = "dead";
        g.deathLine = deathFlavor(g.floor, null);
      }
      return g;
    }
    default:
      return state;
  }
}

function deathFlavor(floor, monster) {
  const lines = [
    "The crypt claims another wanderer.",
    "Your torch sputters out in the dark.",
    "Dust settles over your bones.",
    "The Hollow King smiles, somewhere below.",
  ];
  const m = monster ? `Felled by a ${monster.kind} on floor ${floor}.` : `You fall on floor ${floor}.`;
  return `${m} ${choice(lines)}`;
}

// ============================================================
//  COMPONENT
// ============================================================
const SAVE_KEY = "crypt:save:v1";
const BEST_KEY = "crypt:best:v1";
const MUTE_KEY = "crypt:muted:v1";
const META_KEY = "crypt:meta:v1";

// ---- persistence ----
// Synchronous localStorage wrapper. Synchronous matters: the latest state lands
// on disk the instant an action resolves, so it survives a tab close, refresh,
// or the OS killing a backgrounded mobile tab — no async write left in flight.
// Every call is guarded so private-mode / disabled-storage never crashes the game.
const store = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); } catch (e) {}
  },
};

// today's date as YYYY-MM-DD (local) and a stable integer seed from it
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dailySeed(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function CryptCrawler() {
  const [game, dispatch] = useReducer(reducer, undefined, () => ({ screen: "start" }));
  const [best, setBest] = useState(0);
  const [hasSave, setHasSave] = useState(false);
  const [savedRun, setSavedRun] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hpFlash, setHpFlash] = useState(false);
  const [statInfo, setStatInfo] = useState(null); // which stat chip popover is open
  const [muted, setMuted] = useState(false);
  const [meta, setMeta] = useState({ lifetimeSlain: 0, bossesBeaten: 0, deepest: 0, dailyDate: null, dailyBest: 0, streak: 0, lastDaily: null });
  const prevHp = useRef(null);
  const lastSfx = useRef(0);

  // The arcade "back" button only belongs on the title screen, never over the HUD.
  useArcadeBackButton(game.screen === "start");

  // load best + meta + saved run on mount
  useEffect(() => {
    const b = store.get(BEST_KEY);
    if (b) setBest(parseInt(b, 10) || 0);

    const m = store.get(MUTE_KEY);
    if (m === "1") { setMuted(true); Sound.setMuted(true); }

    const mt = store.get(META_KEY);
    if (mt) {
      try { const parsed = JSON.parse(mt); if (parsed) setMeta((prev) => ({ ...prev, ...parsed })); } catch (e) {}
    }

    const s = store.get(SAVE_KEY);
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && parsed.screen === "playing") {
          setSavedRun(parsed);
          setHasSave(true);
        }
      } catch (e) {}
    }
  }, []);

  // persist run / best — runs on EVERY state change (the reducer returns a new
  // `game` object per action), so picking up an item, buying at an altar, taking
  // a hit, or swapping a relic is all saved immediately, not just on movement.
  useEffect(() => {
    if (game.screen === "playing") {
      store.set(SAVE_KEY, JSON.stringify(game));
      setSavedRun(game);
      setHasSave(true);
    } else if (game.screen === "dead") {
      store.remove(SAVE_KEY);
      setHasSave(false);
      setSavedRun(null);
      const sc = score(game);
      if (sc > best) {
        setBest(sc);
        store.set(BEST_KEY, String(sc));
      }
      // fold this run into permanent meta progression
      setMeta((prev) => {
        const next = {
          ...prev,
          lifetimeSlain: (game.lifetimeSlain != null ? game.lifetimeSlain : prev.lifetimeSlain),
          bossesBeaten: (game.bossesBeaten != null ? game.bossesBeaten : prev.bossesBeaten),
          deepest: Math.max(prev.deepest || 0, game.floor),
        };
        if (game.daily) {
          const today = todayStr();
          const isNewDay = prev.dailyDate !== today;
          next.dailyDate = today;
          next.dailyBest = isNewDay ? sc : Math.max(prev.dailyBest || 0, sc);
          // streak: increment if last completed daily was yesterday, else reset to 1
          if (prev.lastDaily !== today) {
            const y = new Date(); y.setDate(y.getDate() - 1);
            const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
            next.streak = prev.lastDaily === yStr ? (prev.streak || 0) + 1 : 1;
            next.lastDaily = today;
          }
        }
        store.set(META_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [game]);

  // belt-and-suspenders for mobile: phones rarely fire a clean unload, so flush
  // the current run when the tab is hidden or being frozen/closed. Uses the
  // shared gameRef (declared below) which always points at the latest state.
  useEffect(() => {
    const flush = () => {
      const g = gameRef.current;
      if (g && g.screen === "playing") store.set(SAVE_KEY, JSON.stringify(g));
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // hp flash on damage
  useEffect(() => {
    if (game.screen !== "playing") return;
    if (prevHp.current != null && game.hp < prevHp.current) {
      setHpFlash(true);
      const t = setTimeout(() => setHpFlash(false), 320);
      prevHp.current = game.hp;
      return () => clearTimeout(t);
    }
    prevHp.current = game.hp;
  }, [game.hp, game.screen]);

  // play queued sound effects
  useEffect(() => {
    if (!game.sfx) return;
    if (game.sfx.id === lastSfx.current) return;
    lastSfx.current = game.sfx.id;
    Sound.play(game.sfx.name);
  }, [game.sfx]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      Sound.setMuted(next);
      store.set(MUTE_KEY, next ? "1" : "0");
      if (!next) Sound.play("key"); // little confirmation blip when unmuting
      return next;
    });
  }, []);

  // toast auto-dismiss
  useEffect(() => {
    if (game.toast) {
      const t = setTimeout(() => dispatch({ type: "DISMISS_TOAST" }), 2600);
      return () => clearTimeout(t);
    }
  }, [game.toast]);

  // keyboard
  const move = useCallback((dx, dy, force) => dispatch({ type: "MOVE", dx, dy, force }), []);

  // tap-to-walk: queue of steps the hero auto-walks through
  const walkRef = useRef({ steps: [], i: 0, timer: null });
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  const stopWalk = useCallback(() => {
    if (walkRef.current.timer) clearTimeout(walkRef.current.timer);
    walkRef.current = { steps: [], i: 0, timer: null };
  }, []);

  const stepWalk = useCallback(() => {
    const w = walkRef.current;
    const g = gameRef.current;
    if (g.screen !== "playing") { stopWalk(); return; }
    if (w.i >= w.steps.length) {
      // Walk finished. A safe blocker queued for auto-interact fires now that
      // the hero is adjacent (single deliberate move, never via stepWalk).
      if (w.interact) {
        const dx = w.interact.x - g.player.x, dy = w.interact.y - g.player.y;
        stopWalk();
        if (Math.abs(dx) + Math.abs(dy) === 1) move(dx, dy);
        return;
      }
      stopWalk();
      return;
    }
    const prevTile = w.i === 0 ? g.player : w.steps[w.i - 1];
    const next = w.steps[w.i];
    // The path was planned at tap time; a reinforcement may have since spawned
    // onto a tile ahead of us. Every queued step is a walkthrough tile by
    // construction, so if the live tile is no longer walkable, halt here instead
    // of marching in and auto-attacking whatever appeared.
    const liveCell = g.grid[next.y] && g.grid[next.y][next.x];
    if (!liveCell || !isWalkthrough(liveCell)) { stopWalk(); return; }
    const dx = next.x - prevTile.x;
    const dy = next.y - prevTile.y;
    w.i += 1;
    move(dx, dy);
    if (w.i < w.steps.length || w.interact) {
      // keep ticking — the extra tick after the last step runs the interaction
      w.timer = setTimeout(stepWalk, 110);
    } else {
      stopWalk();
    }
  }, [move, stopWalk]);
  useEffect(() => {
    const onKey = (e) => {
      if (game.screen !== "playing" || game.relicChoiceOpen || game.altarOpen) return;
      const map = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
      };
      if (map[e.key]) {
        e.preventDefault();
        stopWalk();
        move(map[e.key][0], map[e.key][1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.screen, game.relicChoiceOpen, game.altarOpen, move]);

  // Stable across renders (reads live state from gameRef) so the memoized grid
  // Cells don't re-render just because their tap handler changed identity.
  const onCellTap = useCallback((x, y) => {
    const g = gameRef.current;
    if (g.screen !== "playing" || g.altarOpen || g.relicChoiceOpen) return;
    setStatInfo(null);
    // an armed consumable redirects the next tap into its target
    if (g.armedItem) {
      stopWalk();
      dispatch({ type: "APPLY_ITEM", index: g.armedItem.index, tx: x, ty: y });
      return;
    }
    const p = g.player;
    if (x === p.x && y === p.y) return;
    stopWalk();
    const result = findPath(g.grid, p, { x, y });
    if (!result || result.steps.length === 0) {
      // fall back to a single adjacent step if tapped neighbor
      const dx = x - p.x, dy = y - p.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) move(dx, dy);
      return;
    }
    // If the destination is a blocker the final step IS the interaction tile —
    // it must never be walked onto via stepWalk (which refuses non-walkthrough
    // tiles). Strip it and interact with a direct move(), the same path the
    // keyboard and TargetBar use.
    if (result.destIsBlocker) {
      const walkSteps = result.steps.slice(0, -1); // tiles up to (not incl) blocker
      if (walkSteps.length === 0) {
        // already adjacent: interact now (attack / open / grab / descend)
        const dx = x - p.x, dy = y - p.y;
        move(dx, dy);
        return;
      }
      // Hybrid approach behaviour: monsters require a deliberate second tap
      // (walk adjacent and STOP), while safe blockers auto-interact on arrival.
      const destCell = g.grid[y] && g.grid[y][x];
      const isMonster = destCell && destCell.t === "monster";
      walkRef.current = {
        steps: walkSteps,
        i: 0,
        timer: null,
        interact: isMonster ? null : { x, y },
      };
      stepWalk();
      return;
    }
    // walkthrough destination — walk all the way onto it
    walkRef.current = { steps: result.steps, i: 0, timer: null };
    stepWalk();
  }, [move, stepWalk, stopWalk, dispatch]);

  // stop walking if the run ends
  useEffect(() => {
    if (game.screen !== "playing") stopWalk();
  }, [game.screen, stopWalk]);

  return (
    <div className="cck-root">
      <StyleBlock />
      <div className="cck-atmos" />
      <div className="cck-frame">
        {game.screen === "start" && (
          <StartScreen
            best={best}
            hasSave={hasSave}
            meta={meta}
            onNew={() => dispatch({ type: "NEW_GAME", opts: { meta } })}
            onDaily={() => dispatch({ type: "NEW_GAME", opts: { meta, daily: true, seed: dailySeed(todayStr()) } })}
            onContinue={() => savedRun && dispatch({ type: "CONTINUE", state: savedRun })}
            onHelp={() => setShowHelp(true)}
          />
        )}

        {game.screen === "playing" && (
          <PlayScreen
            game={game}
            hpFlash={hpFlash}
            onCellTap={onCellTap}
            move={move}
            onUseItem={(i) => { stopWalk(); dispatch({ type: "USE_ITEM", index: i }); }}
            onMenu={() => { stopWalk(); setPaused(true); }}
            onHelp={() => setShowHelp(true)}
            onBuy={(opt) => dispatch({ type: "BUY", opt })}
            onCloseAltar={() => dispatch({ type: "CLOSE_ALTAR" })}
            onStatInfo={(s) => setStatInfo(s)}
            muted={muted}
            onToggleMute={toggleMute}
          />
        )}

        {game.relicChoiceOpen && game.screen === "playing" && (
          <RelicChoiceModal
            game={game}
            onSwap={(i) => dispatch({ type: "SWAP_RELIC", index: i })}
            onDecline={() => dispatch({ type: "DECLINE_RELIC" })}
          />
        )}

        {paused && game.screen === "playing" && (
          <PauseModal
            game={game}
            onResume={() => setPaused(false)}
            onHelp={() => setShowHelp(true)}
            onQuit={() => { setPaused(false); dispatch({ type: "GO_START" }); }}
          />
        )}

        {statInfo && game.screen === "playing" && (
          <StatPopover stat={statInfo} game={game} onClose={() => setStatInfo(null)} />
        )}

        {game.screen === "dead" && (
          <DeathScreen
            game={game}
            score={score(game)}
            best={Math.max(best, score(game))}
            onAgain={() => dispatch({ type: "NEW_GAME", opts: { meta } })}
            onMenu={() => dispatch({ type: "GO_START" })}
          />
        )}

        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </div>
    </div>
  );
}

// ---------------- Start ----------------
function StartScreen({ best, hasSave, meta, onNew, onDaily, onContinue, onHelp }) {
  const tier = metaTier(meta);
  const nextTier = META_TIERS.find((t) => t.need > (meta.lifetimeSlain || 0));
  const prevNeed = tier.need;
  const span = nextTier ? nextTier.need - prevNeed : 1;
  const into = (meta.lifetimeSlain || 0) - prevNeed;
  const pct = nextTier ? clamp((into / span) * 100, 0, 100) : 100;
  const todayDone = meta.dailyDate === todayStr();
  return (
    <div className="cck-start">
      <div className="cck-torches">
        <span className="cck-torch">🔥</span>
        <span className="cck-torch">🔥</span>
      </div>
      <h1 className="cck-title">
        <span className="cck-title-sm">Crypt of the</span>
        <span className="cck-title-lg">HOLLOW KING</span>
      </h1>
      <p className="cck-tag">Every monster shows its price in blood. Plan your route. Descend.</p>

      {/* meta progression: lifetime rank + bar toward the next perk */}
      <div className="cck-meta">
        <div className="cck-meta-row">
          <span className="cck-meta-rank">⚜ {tier.label}</span>
          {meta.streak > 0 && <span className="cck-meta-streak">🔥 {meta.streak}-day streak</span>}
        </div>
        <div className="cck-meta-bar"><div className="cck-meta-fill" style={{ width: `${pct}%` }} /></div>
        <div className="cck-meta-sub">
          {nextTier
            ? `${meta.lifetimeSlain || 0} / ${nextTier.need} kills → next: +${nextTier.bonusHp} HP${nextTier.bonusAtk ? ` / +${nextTier.bonusAtk} ATK` : ""}${nextTier.bonusDef ? ` / +${nextTier.bonusDef} DEF` : ""}`
            : `Max rank reached · ${meta.lifetimeSlain || 0} lifetime kills`}
        </div>
        {(tier.bonusHp || tier.bonusAtk || tier.bonusDef) > 0 && (
          <div className="cck-meta-perk">Active perks: +{tier.bonusHp} HP{tier.bonusAtk ? `, +${tier.bonusAtk} ATK` : ""}{tier.bonusDef ? `, +${tier.bonusDef} DEF` : ""} at start</div>
        )}
      </div>

      <div className="cck-startbtns">
        {hasSave && (
          <button className="cck-btn cck-btn-primary" onClick={onContinue}>
            ⏷ Continue Descent
          </button>
        )}
        <button className={`cck-btn ${hasSave ? "" : "cck-btn-primary"}`} onClick={onNew}>
          🗡️ New Descent
        </button>
        <button className="cck-btn cck-btn-daily" onClick={onDaily}>
          📅 Daily Dungeon {todayDone ? `· best ${meta.dailyBest}` : "· today"}
        </button>
        <button className="cck-btn cck-btn-ghost" onClick={onHelp}>
          ❓ How to Play
        </button>
      </div>
      <div className="cck-startfoot">
        {best > 0 && <span>Deepest glory · {best} pts</span>}
        {meta.deepest > 0 && <span>Deepest floor · {meta.deepest}</span>}
      </div>
    </div>
  );
}

// ---------------- Play ----------------
function PlayScreen({ game, hpFlash, onCellTap, move, onUseItem, onMenu, onHelp, onBuy, onCloseAltar, onStatInfo, muted, onToggleMute }) {
  const hpPct = clamp((game.hp / game.maxHp) * 100, 0, 100);
  // Every player-side input combat() reads. While this is unchanged, a memoized
  // Cell can skip re-rendering its monster threat badge even as `game` churns.
  const threatSig = `${game.atk}|${game.def}|${game.hp}|${game.maxHp}|${game.gold}|${game.floor}|${(game.relics || []).join(",")}`;
  return (
    <div className="cck-play">
      <div className="cck-topbar">
        <button className="cck-icon" onClick={onMenu} aria-label="menu">☰</button>
        <div className="cck-floor">
          <span className="cck-floor-n">Floor {game.floor}</span>
          {game.floor % 5 === 0 && <span className="cck-bosstag">BOSS</span>}
          {game.daily && <span className="cck-dailytag">DAILY</span>}
        </div>
        <div className="cck-topright">
          <button className="cck-icon" onClick={onToggleMute} aria-label={muted ? "unmute" : "mute"}>
            {muted ? "🔇" : "🔊"}
          </button>
          <button className="cck-icon" onClick={onHelp} aria-label="help">?</button>
        </div>
      </div>

      {/* stats — tap any of these to learn what it does */}
      <div className="cck-stats">
        <button className={`cck-hpbar ${hpFlash ? "flash" : ""}`} onClick={() => onStatInfo("hp")}>
          <div className="cck-hpfill" style={{ width: `${hpPct}%` }} />
          <span className="cck-hptext">❤ {fmt(game.hp)} / {fmt(game.maxHp)} &nbsp;ⓘ</span>
        </button>
        <div className="cck-chips">
          <button className="cck-chip" onClick={() => onStatInfo("atk")}>⚔ {fmt(effAtk(game))}{Math.round(effAtk(game)) !== game.atk ? "*" : ""}</button>
          <button className="cck-chip" onClick={() => onStatInfo("def")}>🛡 {fmt(game.def)}</button>
          <span className="cck-chip cck-chip-static">💰 {fmt(game.gold)}</span>
          <span className="cck-chip cck-chip-static">🗝️ {game.keys}</span>
          <button className="cck-chip cck-chip-lvl" onClick={() => onStatInfo("level")}>★ {game.level}</button>
          {game.charm && <span className="cck-chip cck-chip-charm">🔥</span>}
        </div>
        {/* inventory: relics on the left, usable consumables on the right */}
        <div className="cck-inventory">
          <div className="cck-relics">
            {(game.relics || []).map((id) => {
              const r = relicById(id);
              return (
                <button key={id} className="cck-relic" onClick={() => onStatInfo("relic:" + id)} title={r.name}>
                  {r.e}
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, RELIC_SLOTS - (game.relics || []).length) }).map((_, i) => (
              <span key={"er" + i} className="cck-relic empty">·</span>
            ))}
          </div>
          <div className="cck-items">
            {(game.items || []).map((id, i) => {
              const it = itemById(id);
              const armed = game.armedItem && game.armedItem.index === i;
              return (
                <button
                  key={id + i}
                  className={`cck-relic cck-item${armed ? " armed" : ""}`}
                  onClick={() => onUseItem(i)}
                  title={`${it.name} — ${it.desc}`}
                >
                  {it.e}
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, ITEM_SLOTS - (game.items || []).length) }).map((_, i) => (
              <span key={"ei" + i} className="cck-relic empty">·</span>
            ))}
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="cck-gridwrap">
        <div className="cck-grid" key={game.floor}>
          {game.grid.map((row, y) =>
            row.map((cell, x) => (
              <Cell
                key={`${x}-${y}`}
                x={x}
                y={y}
                cell={cell}
                isPlayer={game.player.x === x && game.player.y === y}
                player={game}
                threatSig={threatSig}
                confirm={game.confirm && game.confirm.x === x && game.confirm.y === y}
                onTap={onCellTap}
                delay={(x + y) * 18}
              />
            ))
          )}
        </div>
        {game.fx && (
          <div className="cck-fx" key={game.fx.id} style={{ color: game.fx.color }}>
            {game.fx.text}
          </div>
        )}
      </div>

      {/* target readout (auto-shows adjacent foes) or latest log line */}
      <TargetBar game={game} onAttack={move} />

      {game.toast && <div className="cck-toast">{game.toast}</div>}

      {game.altarOpen && (
        <AltarModal game={game} onBuy={onBuy} onClose={onCloseAltar} />
      )}
    </div>
  );
}

const Cell = React.memo(function Cell({ x, y, cell, isPlayer, player, threatSig, confirm, onTap, delay }) {
  let inner = null;
  let cls = "cck-cell";
  let badge = null;

  if (cell.t === "wall") cls += " wall";
  else cls += " floor";

  if (isPlayer) {
    // crisp inline SVG knight — renders identically on mobile and desktop,
    // tinted by `color` (currentColor) so the torch glow CSS still applies
    inner = (
      <svg className="cck-hero" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="7" r="3.4" />
        <path d="M5.5 21c0-5.3 2.7-8.2 6.5-8.2s6.5 2.9 6.5 8.2z" />
      </svg>
    );
    cls += " hero";
  } else {
    switch (cell.t) {
      case "down":
        inner = <span className="cck-down">⇩</span>;
        cls += " down";
        break;
      case "heal":
        inner = <span className="cck-emoji">{cell.big ? "💖" : "❤️"}</span>;
        break;
      case "gold":
        inner = <span className="cck-emoji">💰</span>;
        break;
      case "sword":
        inner = <span className="cck-emoji">🗡️</span>;
        break;
      case "shield":
        inner = <span className="cck-emoji">🛡️</span>;
        break;
      case "key":
        inner = <span className="cck-emoji">🗝️</span>;
        break;
      case "altar":
        inner = <span className="cck-emoji cck-altar">🔮</span>;
        break;
      case "chest":
        inner = <span className="cck-emoji">{cell.locked ? "🔒" : "🎁"}</span>;
        break;
      case "relic":
        inner = <span className="cck-emoji cck-reliccell">{cell.locked ? "🔐" : "✦"}</span>;
        break;
      case "item":
        inner = <span className="cck-emoji cck-itemcell">{(itemById(cell.id) || {}).e || "✦"}</span>;
        break;
      case "monster": {
        const res = combat(player, cell);
        let bcls = "cck-badge";
        let label;
        if (res.unwinnable) { bcls += " unwin"; label = "∞"; }
        else {
          label = fmt(res.cost);
          const ratio = res.cost / player.hp;
          if (res.cost >= player.hp) bcls += " fatal";
          else if (ratio < 0.18) bcls += " safe";
          else if (ratio < 0.45) bcls += " warn";
          else bcls += " danger";
        }
        inner = <span className={`cck-emoji ${cell.boss ? "cck-boss" : ""} ${cell.elite ? "cck-eliteglow" : ""}`}>{cell.e}</span>;
        badge = <span className={bcls}>{label}</span>;
        if (cell.boss) cls += " bosscell";
        else if (cell.elite) cls += " elitecell";
        break;
      }
      default:
        break;
    }
  }

  if (confirm) cls += " confirm";

  return (
    <button
      className={cls}
      onClick={() => onTap(x, y)}
      style={{ animationDelay: `${delay}ms` }}
      aria-label={cell.t}
    >
      {inner}
      {badge}
    </button>
  );
}, (a, b) => (
  // Skip re-render unless something this cell actually draws has changed.
  // `player`/`game` churns every action, but the only player state a cell's
  // monster badge depends on is captured by `threatSig` — so we compare that
  // instead of the object reference. `cell` keeps its identity across renders
  // when unchanged (grid rows are sliced, cell objects are replaced on edit).
  a.cell === b.cell &&
  a.isPlayer === b.isPlayer &&
  a.confirm === b.confirm &&
  a.threatSig === b.threatSig &&
  a.onTap === b.onTap &&
  a.x === b.x && a.y === b.y && a.delay === b.delay
));

// Auto target readout: a fixed-height panel so the grid never shifts. The most
// recent log lines stay visible at the top (so simultaneous events are all
// shown); whenever the hero stands next to monsters, each one's full breakdown
// appears below in a scrollable list — a single tap attacks it.
function TargetBar({ game, onAttack }) {
  const p = game.player;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const foes = [];
  for (const [dx, dy] of dirs) {
    const c = game.grid[p.y + dy] && game.grid[p.y + dy][p.x + dx];
    if (c && c.t === "monster") foes.push({ cell: c, dx, dy });
  }
  // newest first; older lines are dimmed in CSS
  const recent = (game.log || []).slice(0, 3);
  return (
    <div className="cck-readout">
      <div className={`cck-log${foes.length ? " compact" : ""}`}>
        {recent.map((line, i) => (
          <div key={i} className={`cck-logline${i === 0 ? " latest" : ""}`}>{line}</div>
        ))}
      </div>
      {foes.length > 0 && (
      <div className="cck-targets">
      {foes.map((f, i) => {
        const cell = f.cell;
        const res = combat(game, cell);
        // blows the hero actually needs, accounting for relics (effAtk, Sapper,
        // Thornmail, Executioner). `rounds` is the real count from combat().
        const blows = res.unwinnable ? null : res.rounds;
        const fatal = res.cost >= game.hp;
        const charm = fatal && game.charm;
        const ratio = res.cost / game.hp;
        const tone = res.unwinnable
          ? "danger"
          : fatal
          ? charm ? "charm" : "fatal"
          : ratio < 0.18 ? "safe" : ratio < 0.45 ? "warn" : "danger";
        return (
          <button key={i} className={`cck-target ${tone}`} onClick={() => onAttack(f.dx, f.dy)}>
            <span className="cck-tg-emoji">{cell.e}</span>
            <span className="cck-tg-info">
              <b>{cell.kind}{cell.boss ? " · BOSS" : cell.elite ? " · ELITE" : ""}</b>
              <small>HP {fmt(cell.hp)} · ⚔ {fmt(cell.atk)} · 🛡 {fmt(cell.def)}{blows != null ? ` · ${blows} ${blows === 1 ? "blow" : "blows"}` : ""}</small>
            </span>
            <span className="cck-tg-cost">
              <b>{res.unwinnable ? "∞" : `−${fmt(res.cost)}`}</b>
              <em>{charm ? "🔥 survive" : fatal ? "☠ fatal" : "HP"}</em>
            </span>
          </button>
        );
      })}
      </div>
      )}
    </div>
  );
}

const STAT_TEXT = {
  hp: (g) => ({
    title: "❤ Health",
    body: `You have ${fmt(g.hp)} of ${fmt(g.maxHp)} max. Every fight subtracts HP — at 0 you die, so HP is the real currency of the crypt.`,
    grow: `Max HP grows when you LEVEL UP (+12), defeat a BOSS, open chests, or buy a Bandolier at the altar. Refill with ❤️ potions, altar healing, or a Greater Draught — healing scales with your Max HP, so it never goes stale.`,
  }),
  atk: (g) => ({
    title: "⚔ Attack",
    body: `Attack is ${fmt(Math.round(effAtk(g)))}. Higher Attack means fewer blows to kill — and fewer blows means you take less damage back. Keeping Attack growing is what stops deep monsters from taking forever to kill.`,
    grow: `Raise it with 🗡️ swords on the floor, "Whet the Blade" at the altar, chest rewards, and leveling up. Upgrades scale with depth, so they stay meaningful.`,
  }),
  def: (g) => {
    const pct = Math.round(mitig(g.def, DEF_K) * 100);
    return {
      title: "🛡 Defense",
      body: `Defense is ${fmt(g.def)}, reducing every enemy blow by ${pct}%. Defense is percentage damage-reduction with diminishing returns — it always helps and never becomes useless, but you're never fully immune.`,
      grow: `Raise it with 🛡️ armor on the floor, "Temper Armor" at the altar, chest rewards, and leveling up.`,
    };
  },
  level: (g) => ({
    title: "★ Level",
    body: `You're level ${g.level}. Slaying monsters earns XP; fill the bar and you level up. Tougher enemies grant more XP — and your level keeps pace with the floor.`,
    grow: `Each level grants +12 Max HP, +1 Attack, and +1 Defense, and tops some of your health back up.`,
  }),
};

function PauseModal({ game, onResume, onHelp, onQuit }) {
  return (
    <div className="cck-modal-bg" onClick={onResume}>
      <div className="cck-modal cck-pausemodal" onClick={(e) => e.stopPropagation()}>
        <div className="cck-modal-h">Paused</div>
        <p className="cck-modal-sub">Floor {game.floor} · Level {game.level} · {game.slain} slain</p>
        <button className="cck-btn cck-btn-primary cck-pausebtn" onClick={onResume}>▶ Resume</button>
        <button className="cck-btn cck-btn-ghost cck-pausebtn" onClick={onHelp}>How to Play</button>
        <button className="cck-btn cck-btn-ghost cck-pausebtn" onClick={onQuit}>Quit to Gate</button>
        <p className="cck-pause-note">Your run is saved — you can continue from the gate.</p>
      </div>
    </div>
  );
}

function StatPopover({ stat, game, onClose }) {
  let info;
  if (stat && stat.startsWith("relic:")) {
    const r = relicById(stat.slice(6));
    info = r
      ? { title: `${r.e} ${r.name}`, body: r.desc, grow: "Relics are found in ✦ reliquaries and sold at deep altars. You can hold up to three at once." }
      : STAT_TEXT.hp(game);
  } else {
    info = (STAT_TEXT[stat] || STAT_TEXT.hp)(game);
  }
  return (
    <div className="cck-modal-bg" onClick={onClose}>
      <div className="cck-modal cck-statinfo" onClick={(e) => e.stopPropagation()}>
        <div className="cck-modal-h">{info.title}</div>
        <p className="cck-stat-body">{info.body}</p>
        <p className="cck-stat-grow">{info.grow}</p>
        <button className="cck-btn cck-btn-primary cck-modal-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

function RelicChoiceModal({ game, onSwap, onDecline }) {
  const incoming = relicById(game.pendingRelic);
  if (!incoming) return null;
  return (
    <div className="cck-modal-bg">
      <div className="cck-modal cck-relicchoice" onClick={(e) => e.stopPropagation()}>
        <div className="cck-modal-h">✦ New Relic Found</div>
        <div className="cck-relic-incoming">
          <span className="cck-relic-big">{incoming.e}</span>
          <div><b>{incoming.name}</b><small>{incoming.desc}</small></div>
        </div>
        <p className="cck-modal-sub">Your slots are full. Replace one — or leave the new relic behind.</p>
        <div className="cck-relic-slots">
          {game.relics.map((id, i) => {
            const r = relicById(id);
            return (
              <button key={id} className="cck-relic-row" onClick={() => onSwap(i)}>
                <span className="cck-relic-big">{r.e}</span>
                <div><b>{r.name}</b><small>{r.desc}</small></div>
                <span className="cck-relic-swap">Replace</span>
              </button>
            );
          })}
        </div>
        <button className="cck-btn cck-btn-ghost cck-modal-close" onClick={onDecline}>Leave it behind</button>
      </div>
    </div>
  );
}

function AltarModal({ game, onBuy, onClose }) {
  const items = shopItems(game);
  const nextUnlock = [
    { min: 3, name: "Iron Keys" },
    { min: 5, name: "Bandolier & Greater Draught" },
    { min: 8, name: "Phoenix Charm" },
  ].find((u) => game.floor < u.min);
  return (
    <div className="cck-modal-bg" onClick={onClose}>
      <div className="cck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cck-modal-h">🔮 Forgotten Altar</div>
        <p className="cck-modal-sub">You have <b>💰 {fmt(game.gold)}</b> gold.</p>
        <div className="cck-shoplist">
          {items.map((it) => {
            const afford = game.gold >= it.price && !it.soldOut;
            return (
              <button
                key={it.opt}
                className={`cck-shopitem ${afford ? "" : "poor"} ${it.soldOut ? "soldout" : ""}`}
                onClick={() => afford && onBuy(it.opt)}
              >
                <span className="cck-shop-icon">{it.icon}</span>
                <span className="cck-shop-mid">
                  <b>{it.title}</b>
                  <small>{it.soldOut ? "Already carried" : it.desc}</small>
                </span>
                <span className="cck-shop-price">{it.soldOut ? "✓" : `💰 ${fmt(it.price)}`}</span>
              </button>
            );
          })}
        </div>
        {nextUnlock && (
          <p className="cck-unlock-hint">Reach floor {nextUnlock.min} to unlock: {nextUnlock.name}</p>
        )}
        <button className="cck-btn cck-btn-ghost cck-modal-close" onClick={onClose}>
          Leave the Altar
        </button>
      </div>
    </div>
  );
}

function DeathScreen({ game, score, best, onAgain, onMenu }) {
  const isRecord = score >= best;
  return (
    <div className="cck-death">
      <div className="cck-skull">💀</div>
      <h2 className="cck-death-h">YOU FELL</h2>
      <p className="cck-death-line">{game.deathLine}</p>
      <div className="cck-scoregrid">
        <div><span>Depth</span><b>Floor {game.floor}</b></div>
        <div><span>Slain</span><b>{fmt(game.slain)}</b></div>
        <div><span>Gold</span><b>{fmt(game.gold)}</b></div>
        <div><span>Level</span><b>{game.level}</b></div>
      </div>
      <div className="cck-finalscore">
        <span>SCORE</span>
        <b>{fmt(score)}</b>
        {isRecord && <em>★ New Record</em>}
      </div>
      <div className="cck-startbtns">
        <button className="cck-btn cck-btn-primary" onClick={onAgain}>🗡️ Descend Again</button>
        <button className="cck-btn cck-btn-ghost" onClick={onMenu}>Return to Gate</button>
      </div>
    </div>
  );
}

function HelpModal({ onClose }) {
  return (
    <div className="cck-modal-bg" onClick={onClose}>
      <div className="cck-modal cck-helpmodal" onClick={(e) => e.stopPropagation()}>
        <div className="cck-modal-h">How to Play</div>
        <ul className="cck-help">
          <li><b>Move:</b> tap any reachable tile to walk there (arrow keys / WASD also work on desktop).</li>
          <li><b>Fight:</b> tap into a monster to attack — combat is 100% predictable, so the <span className="cck-hl">number</span> on it is the <b>exact HP</b> the fight will cost. Stand next to any monster and its full breakdown appears automatically. A fight that would kill you asks for a confirming second tap.</li>
          <li><span className="cck-dot safe" /> cheap · <span className="cck-dot warn" /> risky · <span className="cck-dot danger" /> costly · <span className="cck-dot fatal" /> would kill you.</li>
        </ul>
        <div className="cck-help-sec">The math</div>
        <ul className="cck-help">
          <li><b>⚔ Attack</b> − enemy <b>Defense</b> = damage you deal per blow. More Attack → fewer blows → you take less damage.</li>
          <li>enemy <b>Attack</b> − <b>🛡 Defense</b> = damage you take per blow (you always strike first, so a one-blow kill costs nothing).</li>
        </ul>
        <div className="cck-help-sec">Getting stronger</div>
        <ul className="cck-help">
          <li><b>Max HP</b> rises from <b>leveling up</b> (+9), <b>beating a boss</b> (+18), <b>chests</b>, and the altar's <b>Bandolier</b>.</li>
          <li><b>Level up</b> by earning XP from kills — each level adds Max HP, Attack &amp; Defense.</li>
          <li>🗝️ keys open 🔒 locked chests (the best loot). 🔮 <b>altars</b> sell upgrades that unlock as you go deeper — and there's always one on the floor right <b>before a boss</b>.</li>
          <li><b>✦ Relics</b> are powerful passives found in reliquaries and deep altars — they change how you play (lifesteal, free first hits, executions…). You hold up to <b>three</b> on the <b>left</b>; tap a relic to read it.</li>
          <li><b>🧪 Potions &amp; skills</b> are consumables found on the floor, held in <b>three slots on the right</b>. <b>Tap one to use it</b> — potions act at once, while targeted skills (like <b>🌀 Phase Step</b> to leap over a monster, or <b>🔥 Firebomb</b>) then ask you to <b>tap a target</b>. Tap the slot again to cancel.</li>
          <li><b>Tip:</b> tap your ❤/⚔/🛡/★ stats any time for a reminder of what they do.</li>
        </ul>
        <div className="cck-help-sec">Coming back</div>
        <ul className="cck-help">
          <li>Every kill counts toward your <b>lifetime rank</b>, which grants permanent starting bonuses — so no run is wasted.</li>
          <li>The <b>📅 Daily Dungeon</b> is the same layout for everyone each day. Beat your score and build a day streak.</li>
        </ul>
        <p className="cck-help-foot">Reach the stairs ⇩ alive and descend forever. Bosses guard every 5th floor. Your run autosaves.</p>
        <button className="cck-btn cck-btn-primary cck-modal-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

// ---------------- styles ----------------
function StyleBlock() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=EB+Garamond:ital@0;1&display=swap');

.cck-root{
  --bg0:#080510; --bg1:#130d20; --stone:#1c1730; --stone2:#241d3a;
  --line:#382c54; --torch:#ff8a3d; --torch2:#ffd27a; --blood:#e0455a;
  --bone:#ece3cf; --gold:#ffcc4d; --poison:#74e08a; --magic:#a98bff;
  --text:#cfc1e4; --muted:#857aa3;
  position:relative; width:100%; min-height:100%; min-height:100dvh;
  background:radial-gradient(120% 90% at 50% -10%, #1a1230 0%, var(--bg1) 38%, var(--bg0) 100%);
  color:var(--text); font-family:'EB Garamond','Palatino Linotype',Georgia,serif;
  display:flex; justify-content:center; overflow-x:hidden;
  -webkit-tap-highlight-color:transparent;
}
.cck-atmos{
  position:absolute; inset:0; pointer-events:none; z-index:0;
  background:
    radial-gradient(40% 30% at 18% 8%, rgba(255,138,61,.16), transparent 70%),
    radial-gradient(40% 30% at 82% 8%, rgba(255,138,61,.16), transparent 70%),
    radial-gradient(60% 50% at 50% 120%, rgba(120,40,160,.18), transparent 70%);
  mix-blend-mode:screen;
}
.cck-frame{ position:relative; z-index:1; width:100%; max-width:480px; padding:14px 14px 26px;
  min-height:100dvh; display:flex; flex-direction:column; }

.cck-btn{
  font-family:'Cinzel',Georgia,serif; font-weight:700; letter-spacing:.04em;
  border:1px solid var(--line); border-radius:12px; padding:13px 18px; font-size:15px;
  color:var(--bone); background:linear-gradient(180deg,var(--stone2),var(--stone));
  cursor:pointer; transition:transform .08s ease, box-shadow .2s ease, border-color .2s ease;
  box-shadow:0 3px 0 #0b0815, inset 0 1px 0 rgba(255,255,255,.05);
}
.cck-btn:active{ transform:translateY(2px); box-shadow:0 1px 0 #0b0815; }
.cck-btn-primary{
  color:#1a0d05; border-color:#b86a26;
  background:linear-gradient(180deg,var(--torch2),var(--torch));
  box-shadow:0 3px 0 #7a3a13, 0 0 24px rgba(255,138,61,.4);
}
.cck-btn-ghost{ background:transparent; color:var(--muted); box-shadow:none; }

/* ---- start ---- */
.cck-start{ text-align:center; padding-top:24px; animation:fadeIn .6s ease; }
.cck-torches{ display:flex; justify-content:center; gap:120px; margin-bottom:6px; }
.cck-torch{ font-size:34px; filter:drop-shadow(0 0 12px var(--torch)); animation:flick 1.4s ease-in-out infinite alternate; }
.cck-torches .cck-torch:last-child{ animation-delay:.4s; }
@keyframes flick{ from{ transform:scale(1) translateY(0); opacity:.85;} to{ transform:scale(1.12) translateY(-2px); opacity:1;} }
.cck-title{ margin:6px 0 4px; line-height:1; }
.cck-title-sm{ display:block; font-family:'Cinzel',serif; font-weight:500; font-size:16px; letter-spacing:.4em; color:var(--muted); }
.cck-title-lg{ display:block; font-family:'Cinzel',serif; font-weight:900; font-size:40px; letter-spacing:.06em;
  background:linear-gradient(180deg,#fff5e0,var(--torch2) 55%,var(--torch)); -webkit-background-clip:text; background-clip:text; color:transparent;
  text-shadow:0 0 30px rgba(255,138,61,.3); }
.cck-tag{ color:var(--muted); font-style:italic; font-size:15px; max-width:300px; margin:10px auto 26px; }
.cck-startbtns{ display:flex; flex-direction:column; gap:12px; max-width:300px; margin:0 auto; }
.cck-best{ margin-top:22px; font-family:'Cinzel',serif; font-size:13px; letter-spacing:.18em; color:var(--gold); }

/* ---- topbar ---- */
.cck-topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.cck-topright{ display:flex; gap:6px; }
.cck-icon{ width:38px; height:38px; border-radius:10px; border:1px solid var(--line);
  background:var(--stone); color:var(--bone); font-size:18px; cursor:pointer; }
.cck-icon:active{ transform:translateY(1px); }
.cck-floor{ display:flex; align-items:center; gap:8px; }
.cck-floor-n{ font-family:'Cinzel',serif; font-weight:700; font-size:18px; letter-spacing:.08em; color:var(--bone); }
.cck-bosstag{ font-family:'Cinzel',serif; font-size:11px; font-weight:900; letter-spacing:.14em;
  color:#1a0d05; background:linear-gradient(180deg,var(--blood),#9c1f33); padding:3px 8px; border-radius:6px;
  animation:pulseTag 1s ease-in-out infinite; }
@keyframes pulseTag{ 50%{ box-shadow:0 0 14px rgba(224,69,90,.8);} }

/* ---- stats ---- */
.cck-stats{ margin-bottom:12px; }
.cck-hpbar{ position:relative; height:26px; border-radius:8px; overflow:hidden;
  border:1px solid #4a2230; background:#2a121b; box-shadow:inset 0 2px 6px rgba(0,0,0,.6); }
.cck-hpbar.flash{ animation:hpflash .3s ease; }
@keyframes hpflash{ 0%{ box-shadow:0 0 0 2px #fff inset;} 100%{} }
.cck-hpfill{ position:absolute; inset:0; right:auto;
  background:linear-gradient(180deg,#ff6b7d,#c41f3a); transition:width .35s cubic-bezier(.4,0,.2,1);
  box-shadow:0 0 12px rgba(224,69,90,.6); }
.cck-hptext{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  font-family:'Cinzel',serif; font-weight:700; font-size:13px; color:#fff; text-shadow:0 1px 3px #000; }
.cck-chips{ display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
.cck-chip{ flex:1; min-width:54px; text-align:center; font-family:'Cinzel',serif; font-weight:700; font-size:14px;
  padding:6px 4px; border-radius:8px; border:1px solid var(--line);
  background:linear-gradient(180deg,var(--stone2),var(--stone)); color:var(--bone); cursor:pointer; }
button.cck-chip:active{ transform:translateY(1px); }
.cck-chip-static{ cursor:default; }
.cck-chip-lvl{ color:var(--gold); border-color:#6a5520; }
.cck-chip-charm{ flex:0 0 auto; min-width:0; color:var(--torch2); border-color:#b86a26;
  box-shadow:0 0 10px rgba(255,138,61,.5); animation:flick 1.6s ease-in-out infinite alternate; }
.cck-hpbar{ cursor:pointer; padding:0; width:100%; display:block; }

/* ---- play layout: fill exactly one viewport, no page scroll ---- */
.cck-play{ display:flex; flex-direction:column; flex:1; min-height:0; }

/* ---- grid ---- */
.cck-gridwrap{ position:relative; flex:1 1 auto; min-height:0;
  display:flex; align-items:center; justify-content:center; margin:6px 0; }
.cck-grid{
  display:grid; grid-template-columns:repeat(${COLS},1fr); gap:3px;
  /* width capped so grid height (= width·ROWS/COLS) plus the ~366px of HUD
     chrome (incl. the fixed 132px readout panel) always fits within the
     viewport — letterboxes on short screens */
  width:100%; margin-inline:auto;
  max-width:min(100%, max(150px, calc((100dvh - 366px) * ${COLS} / ${ROWS})));
  background:linear-gradient(180deg,#0d0a16,#0a0712); padding:6px; border-radius:14px;
  border:1px solid var(--line); box-shadow:inset 0 0 30px rgba(0,0,0,.7), 0 6px 20px rgba(0,0,0,.5);
}
.cck-cell, .cck-target, .cck-chip, .cck-hpbar, .cck-relic{
  -webkit-user-select:none; user-select:none; -webkit-touch-callout:none;
  -webkit-tap-highlight-color:transparent; touch-action:manipulation;
}
.cck-cell{
  aspect-ratio:1; border-radius:6px; border:none; cursor:pointer; padding:0;
  display:flex; align-items:center; justify-content:center; position:relative;
  font-size:clamp(13px, min(5.4vw, 4.6vh), 24px); line-height:1;
  animation:cellIn .4s ease backwards;
}
@keyframes cellIn{ from{ opacity:0; transform:scale(.4);} to{ opacity:1; transform:scale(1);} }
.cck-cell.floor{ background:radial-gradient(120% 120% at 30% 20%, #221b34, #181226);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.03); }
.cck-cell.wall{ background:linear-gradient(180deg,#0c0913,#070510);
  box-shadow:inset 0 2px 3px rgba(0,0,0,.8), inset 0 -2px 0 rgba(255,255,255,.02);
  cursor:default;
  background-image:linear-gradient(180deg,#0c0913,#070510),
    repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 1px, transparent 1px 14px);
}
.cck-cell.hero{ background:radial-gradient(circle at 50% 45%, rgba(255,138,61,.4), #181226 70%);
  transition:background .12s ease; z-index:2; }
.cck-cell{ transition:box-shadow .12s ease, transform .08s ease; }
.cck-cell.floor:active{ box-shadow:inset 0 0 0 2px rgba(255,210,122,.5); }
.cck-cell.down{ background:radial-gradient(circle, rgba(169,139,255,.35), #181226 72%);
  box-shadow:inset 0 0 14px rgba(169,139,255,.5); animation:cellIn .4s backwards, downGlow 1.8s ease-in-out infinite; }
@keyframes downGlow{ 50%{ box-shadow:inset 0 0 22px rgba(169,139,255,.85);} }
.cck-cell.bosscell{ background:radial-gradient(circle, rgba(224,69,90,.28), #181226 72%); }
.cck-cell.elitecell{ background:radial-gradient(circle, rgba(255,204,77,.22), #181226 72%);
  box-shadow:inset 0 0 0 1px rgba(255,204,77,.55), 0 0 10px rgba(255,204,77,.35); }
.cck-eliteglow{ filter:drop-shadow(0 0 6px var(--gold)); }
.cck-cell.confirm{ box-shadow:0 0 0 2px var(--blood), 0 0 14px rgba(224,69,90,.8); animation:none; }

.cck-hero{ display:block; color:var(--torch2);
  width:clamp(17px, min(6.6vw, 5.6vh), 30px); height:clamp(17px, min(6.6vw, 5.6vh), 30px);
  filter:drop-shadow(0 0 6px var(--torch)) drop-shadow(0 0 2px rgba(255,255,255,.65));
  animation:heroBob 1.6s ease-in-out infinite; }
.cck-hero path, .cck-hero circle{ fill:currentColor; }
@keyframes heroBob{ 50%{ transform:translateY(-2px);} }
.cck-down{ color:var(--magic); text-shadow:0 0 12px var(--magic); font-weight:900; }
.cck-emoji{ filter:drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
.cck-altar{ animation:heroBob 2s ease-in-out infinite; filter:drop-shadow(0 0 8px var(--magic)); }
.cck-boss{ font-size:clamp(16px, min(6.6vw, 5.4vh), 28px); filter:drop-shadow(0 0 8px var(--blood)); animation:heroBob 1.4s ease-in-out infinite; }

.cck-badge{ position:absolute; bottom:-2px; right:-2px; min-width:16px; padding:0 3px; height:15px;
  display:flex; align-items:center; justify-content:center; border-radius:5px;
  font-family:'Cinzel',serif; font-weight:900; font-size:10px; color:#0d0a14;
  border:1px solid rgba(0,0,0,.4); }
.cck-badge.safe{ background:linear-gradient(180deg,#9bf0ab,var(--poison)); }
.cck-badge.warn{ background:linear-gradient(180deg,#ffe07a,var(--gold)); }
.cck-badge.danger{ background:linear-gradient(180deg,#ffae6b,#ff7a2e); }
.cck-badge.fatal{ background:linear-gradient(180deg,#ff6b7d,var(--blood)); color:#fff; }
.cck-badge.unwin{ background:#2a2440; color:var(--muted); border-color:var(--line); }

.cck-fx{ position:absolute; left:50%; top:38%; transform:translateX(-50%);
  font-family:'Cinzel',serif; font-weight:900; font-size:24px; pointer-events:none;
  text-shadow:0 2px 8px #000, 0 0 12px currentColor; animation:fxFloat 1.1s ease-out forwards; }
@keyframes fxFloat{ 0%{ opacity:0; transform:translate(-50%,8px) scale(.7);} 25%{ opacity:1;} 100%{ opacity:0; transform:translate(-50%,-30px) scale(1.05);} }

/* ---- readout: fixed-height panel (log + adjacent-foe targets) so the grid
   above it never reflows as cards appear/disappear ---- */
.cck-readout{ flex:0 0 auto; height:132px; margin:8px 2px 10px;
  display:flex; flex-direction:column; gap:6px; overflow:hidden; }

/* ---- log ---- */
.cck-log{ flex:0 0 auto; display:flex; flex-direction:column; gap:3px;
  border-left:2px solid var(--line); padding-left:10px; }
.cck-logline{ font-style:italic; font-size:15px; line-height:1.3; color:var(--muted); opacity:.5; }
.cck-logline.latest{ opacity:1; }
/* when foes are adjacent, the targets need the room — keep only the newest line */
.cck-log.compact .cck-logline{ display:none; }
.cck-log.compact .cck-logline.latest{ display:block; }


/* ---- toast ---- */
.cck-toast{ position:fixed; left:50%; bottom:24px; transform:translateX(-50%);
  background:rgba(20,12,28,.96); border:1px solid var(--line); border-radius:12px;
  padding:11px 16px; font-size:14px; color:var(--bone); max-width:88%; text-align:center;
  box-shadow:0 8px 30px rgba(0,0,0,.6); z-index:40; animation:toastIn .25s ease; }
@keyframes toastIn{ from{ opacity:0; transform:translate(-50%,10px);} to{ opacity:1; transform:translate(-50%,0);} }

/* ---- modals ---- */
.cck-modal-bg{ position:fixed; inset:0; background:rgba(5,3,10,.78); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center; z-index:50; padding:20px; animation:fadeIn .2s ease; }
.cck-modal{ width:100%; max-width:360px; background:linear-gradient(180deg,#1b1430,#120c20);
  border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:0 20px 60px rgba(0,0,0,.7);
  animation:popIn .3s cubic-bezier(.2,1.3,.5,1); }
@keyframes popIn{ from{ opacity:0; transform:scale(.85) translateY(10px);} to{ opacity:1; transform:scale(1);} }
.cck-modal-h{ font-family:'Cinzel',serif; font-weight:900; font-size:20px; color:var(--torch2);
  text-align:center; letter-spacing:.04em; margin-bottom:8px; }
.cck-modal-sub{ text-align:center; color:var(--muted); margin-bottom:16px; }
.cck-modal-sub b{ color:var(--gold); }
.cck-modal-close{ width:100%; margin-top:14px; }
.cck-pausemodal{ max-width:300px; text-align:center; }
.cck-pausebtn{ width:100%; margin-top:10px; }
.cck-pause-note{ color:var(--muted); font-size:12px; font-style:italic; margin:14px 0 2px; }
.cck-shoplist{ display:flex; flex-direction:column; gap:10px; }
.cck-shopitem{ display:flex; align-items:center; gap:12px; text-align:left;
  border:1px solid var(--line); border-radius:12px; padding:12px; cursor:pointer;
  background:linear-gradient(180deg,var(--stone2),var(--stone)); color:var(--text); transition:border-color .15s; }
.cck-shopitem:active{ transform:translateY(1px); }
.cck-shopitem.poor{ opacity:.45; cursor:not-allowed; }
.cck-shop-icon{ font-size:22px; }
.cck-shop-mid{ flex:1; display:flex; flex-direction:column; }
.cck-shop-mid b{ font-family:'Cinzel',serif; font-size:15px; color:var(--bone); }
.cck-shop-mid small{ color:var(--muted); }
.cck-shop-price{ font-family:'Cinzel',serif; font-weight:700; color:var(--gold); }

.cck-help{ list-style:none; padding:0; margin:0 0 4px; display:flex; flex-direction:column; gap:11px; font-size:14.5px; line-height:1.45; }
.cck-help li{ border-left:2px solid var(--line); padding-left:11px; color:var(--text); }
.cck-help b{ color:var(--bone); }
.cck-hl{ color:var(--torch2); font-weight:700; }
.cck-dot{ display:inline-block; width:11px; height:11px; border-radius:3px; vertical-align:middle; margin:0 1px; }
.cck-dot.safe{ background:var(--poison);} .cck-dot.warn{ background:var(--gold);}
.cck-dot.danger{ background:#ff7a2e;} .cck-dot.fatal{ background:var(--blood);}

/* ---- death ---- */
.cck-death{ text-align:center; padding-top:30px; animation:fadeIn .5s ease; }
.cck-skull{ font-size:64px; filter:drop-shadow(0 0 20px rgba(224,69,90,.5)); animation:popIn .5s ease; }
.cck-death-h{ font-family:'Cinzel',serif; font-weight:900; font-size:32px; letter-spacing:.1em;
  color:var(--blood); margin:6px 0; text-shadow:0 0 24px rgba(224,69,90,.4); }
.cck-death-line{ color:var(--muted); font-style:italic; max-width:300px; margin:0 auto 22px; line-height:1.4; }
.cck-scoregrid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; max-width:300px; margin:0 auto 18px; }
.cck-scoregrid div{ background:linear-gradient(180deg,var(--stone2),var(--stone)); border:1px solid var(--line);
  border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:2px; }
.cck-scoregrid span{ font-size:12px; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; }
.cck-scoregrid b{ font-family:'Cinzel',serif; font-size:17px; color:var(--bone); }
.cck-finalscore{ display:flex; flex-direction:column; align-items:center; margin-bottom:24px; }
.cck-finalscore span{ font-family:'Cinzel',serif; font-size:13px; letter-spacing:.3em; color:var(--muted); }
.cck-finalscore b{ font-family:'Cinzel',serif; font-size:46px; font-weight:900; color:var(--gold);
  text-shadow:0 0 26px rgba(255,204,77,.4); line-height:1.1; }
.cck-finalscore em{ font-style:normal; font-family:'Cinzel',serif; font-size:13px; color:var(--poison); letter-spacing:.12em; }

@keyframes fadeIn{ from{ opacity:0;} to{ opacity:1;} }

/* ---- daily tag ---- */
.cck-dailytag{ font-family:'Cinzel',serif; font-size:11px; font-weight:900; letter-spacing:.14em;
  color:#0c1320; background:linear-gradient(180deg,#7ec8ff,#3a7bd5); padding:3px 8px; border-radius:6px; margin-left:6px; }

/* ---- inventory: relics (left) + consumables (right) ---- */
.cck-inventory{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:7px; }
.cck-relics{ display:flex; gap:6px; align-items:center; }
.cck-items{ display:flex; gap:6px; align-items:center; }
.cck-item{ border-color:#2f6a4a; background:linear-gradient(180deg,#16302a,#0e1f1c);
  box-shadow:0 0 8px rgba(116,224,138,.3); }
.cck-item.armed{ border-color:var(--torch2); box-shadow:0 0 12px rgba(255,210,122,.85);
  animation:flick 1s ease-in-out infinite alternate; }
.cck-itemcell{ color:#9bf0ab; text-shadow:0 0 8px rgba(116,224,138,.9); animation:flick 1.4s ease-in-out infinite alternate; }
.cck-relic{ width:34px; height:34px; border-radius:9px; font-size:18px; line-height:1;
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  border:1px solid #5a3aa0; background:linear-gradient(180deg,#241a3c,#171028);
  box-shadow:0 0 8px rgba(123,91,255,.35); }
.cck-relic:active{ transform:translateY(1px); }
.cck-relic.empty{ border-style:dashed; border-color:#3a3258; background:none; box-shadow:none;
  color:#473e66; cursor:default; }
.cck-reliccell{ color:#c8a8ff; text-shadow:0 0 8px rgba(155,123,255,.9); animation:flick 1.4s ease-in-out infinite alternate; }

/* ---- relic choice modal ---- */
.cck-relicchoice{ max-width:340px; }
.cck-relic-incoming{ display:flex; align-items:center; gap:12px; padding:12px;
  border-radius:12px; border:1px solid #5a3aa0; background:rgba(123,91,255,.12); margin-bottom:6px; }
.cck-relic-big{ font-size:30px; line-height:1; }
.cck-relic-incoming b, .cck-relic-row b{ font-family:'Cinzel',serif; font-size:15px; color:var(--bone); display:block; }
.cck-relic-incoming small, .cck-relic-row small{ color:var(--muted); font-size:12px; line-height:1.3; display:block; }
.cck-relic-slots{ display:flex; flex-direction:column; gap:8px; margin:12px 0; }
.cck-relic-row{ display:flex; align-items:center; gap:11px; text-align:left; width:100%; cursor:pointer;
  padding:9px 11px; border-radius:11px; border:1px solid var(--line);
  background:linear-gradient(180deg,var(--stone2),var(--stone)); color:var(--bone); }
.cck-relic-row:active{ transform:translateY(1px); }
.cck-relic-swap{ margin-left:auto; font-family:'Cinzel',serif; font-size:11px; letter-spacing:.08em;
  color:var(--torch2); border:1px solid #b86a26; border-radius:6px; padding:4px 8px; white-space:nowrap; }

/* ---- meta progression on start ---- */
.cck-meta{ width:100%; max-width:300px; margin:4px auto 18px; padding:13px 15px;
  border-radius:14px; border:1px solid var(--line); background:rgba(20,14,34,.6); }
.cck-meta-row{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.cck-meta-rank{ font-family:'Cinzel',serif; font-weight:700; font-size:14px; color:var(--gold); letter-spacing:.06em; }
.cck-meta-streak{ font-size:12px; color:var(--torch2); font-weight:700; }
.cck-meta-bar{ height:8px; border-radius:5px; background:#1c1430; overflow:hidden; border:1px solid #2c2348; }
.cck-meta-fill{ height:100%; background:linear-gradient(90deg,#7b5bff,#c8a8ff); box-shadow:0 0 8px rgba(123,91,255,.6);
  transition:width .4s ease; }
.cck-meta-sub{ font-size:11.5px; color:var(--muted); margin-top:7px; line-height:1.4; }
.cck-meta-perk{ font-size:11.5px; color:var(--poison); margin-top:4px; }
.cck-btn-daily{ color:#cfe8ff; border-color:#3a7bd5;
  background:linear-gradient(180deg,#27456e,#19304d); box-shadow:0 3px 0 #0e1c30; }
.cck-startfoot{ display:flex; gap:16px; justify-content:center; margin-top:20px; flex-wrap:wrap;
  font-family:'Cinzel',serif; font-size:12px; letter-spacing:.12em; color:var(--gold); }

/* ---- danger button ---- */
.cck-btn-danger{ color:#fff; border-color:#9c1f33;
  background:linear-gradient(180deg,#ff6b7d,#c41f3a);
  box-shadow:0 3px 0 #5c0f1d, 0 0 20px rgba(224,69,90,.45); }

/* ---- target readout (adjacent foes) — scrolls within the fixed panel ---- */
.cck-targets{ flex:1 1 auto; min-height:0; overflow-y:auto;
  display:flex; flex-direction:column; gap:6px; padding-right:2px; }
.cck-targets::-webkit-scrollbar{ width:5px; }
.cck-targets::-webkit-scrollbar-thumb{ background:var(--line); border-radius:3px; }
.cck-target{ display:flex; align-items:center; gap:10px; width:100%; text-align:left; flex:0 0 auto;
  padding:6px 11px; border-radius:11px; cursor:pointer;
  border:1px solid var(--line); background:linear-gradient(180deg,var(--stone2),var(--stone));
  color:var(--bone); transition:transform .06s ease, box-shadow .12s ease; }
.cck-target:active{ transform:translateY(1px) scale(.995); }
.cck-tg-emoji{ font-size:24px; line-height:1; filter:drop-shadow(0 0 5px rgba(0,0,0,.5)); }
.cck-tg-info{ flex:1; display:flex; flex-direction:column; gap:1px; min-width:0; }
.cck-tg-info b{ font-family:'Cinzel',serif; font-size:15px; }
.cck-tg-info small{ color:var(--muted); font-size:11.5px; letter-spacing:.02em; }
.cck-tg-cost{ display:flex; flex-direction:column; align-items:flex-end; line-height:1.05; }
.cck-tg-cost b{ font-family:'Cinzel',serif; font-size:19px; }
.cck-tg-cost em{ font-style:normal; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
.cck-target.safe{ border-color:#2f6b3f; } .cck-target.safe .cck-tg-cost b{ color:var(--poison); }
.cck-target.warn{ border-color:#7a6420; } .cck-target.warn .cck-tg-cost b{ color:var(--gold); }
.cck-target.danger{ border-color:#8a4420; } .cck-target.danger .cck-tg-cost b{ color:var(--torch2); }
.cck-target.fatal{ border-color:#9c1f33; box-shadow:0 0 14px rgba(224,69,90,.3); }
.cck-target.fatal .cck-tg-cost b{ color:#ff5f6d; }
.cck-target.fatal .cck-tg-cost em{ color:#ff8a98; }
.cck-target.charm{ border-color:#b86a26; box-shadow:0 0 14px rgba(255,138,61,.35); }
.cck-target.charm .cck-tg-cost b{ color:var(--torch2); }
.cck-target.charm .cck-tg-cost em{ color:var(--torch2); }

/* ---- stat info popover ---- */
.cck-statinfo{ max-width:330px; }
.cck-stat-body{ font-size:15px; line-height:1.5; color:var(--text); margin:0 0 12px; }
.cck-stat-grow{ font-size:14px; line-height:1.5; color:var(--muted); margin:0 0 4px;
  border-left:2px solid var(--torch); padding-left:11px; }

/* ---- shop extras ---- */
.cck-shopitem.soldout{ opacity:.7; cursor:default; }
.cck-shopitem.soldout .cck-shop-price{ color:var(--poison); }
.cck-unlock-hint{ text-align:center; color:var(--muted); font-size:12.5px; font-style:italic; margin:12px 0 0; }

/* ---- help extras ---- */
.cck-helpmodal{ max-height:84vh; overflow-y:auto; }
.cck-help-sec{ font-family:'Cinzel',serif; font-weight:700; font-size:13px; letter-spacing:.16em;
  text-transform:uppercase; color:var(--torch2); margin:16px 0 9px; }
.cck-help-foot{ font-size:13.5px; color:var(--muted); font-style:italic; margin:14px 0 2px; line-height:1.4; }
    `}</style>
  );
}
