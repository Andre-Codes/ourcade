/* ============================================================
   PITS AND PORTALS — pure engine (no React / no DOM)
   All game logic + tuning constants live here so both the React
   component (PitsAndPortals.jsx) and the headless balance simulator
   (scripts/pits-and-portals-sim.js) share one source of truth.

   Perfect information + stage-then-commit. You are fragile
   (3 HP, no healing) and kill mostly by repositioning threats.
   A solver guarantees every floor is beatable hitless using only
   move/shove/wait — verbs/relics/items are player-side, so they
   can only ever help and the guarantee holds.
   ============================================================ */

export const W = 6;
export const H = 6;
export const MAX_HP = 3;
export const RESOLVE_MS = 300;
export const PURSUIT_MAX = 3;
export const STRIKER_RANGE = 3;
export const WALL_TTL = 3;       // player turns a wall persists
export const SWAP_RANGE = 3;     // swap reaches this far along a row/column
export const BOMB_FUSE = 2;      // turns from arming to detonation
export const BOMB_ARM_RANGE = 3; // bomber arms when you come this close

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const key = (x, y) => `${x},${y}`;
export const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const wallsToSet = (walls) => new Set((walls || []).map((w) => key(w.x, w.y)));

/* verbs: base cooldowns. push (SHOVE) is the always-free base verb. */
export const VERB_INFO = {
  push: { label: "SHOVE", baseCd: 0, kind: "enemy" },
  wall: { label: "WALL", baseCd: 4, kind: "tile" },
  pull: { label: "PULL", baseCd: 3, kind: "enemy" },
  swap: { label: "SWAP", baseCd: 5, kind: "enemy" },
  dash: { label: "DASH", baseCd: 3, kind: "tile" },
  leap: { label: "LEAP", baseCd: 4, kind: "tile" },
};

export const REWARDS = {
  wall: { id: "wall", name: "WALL", type: "verb", tier: "common", desc: "Drop a temporary wall on an adjacent tile. Blocks movement and beams." },
  pull: { id: "pull", name: "PULL", type: "verb", tier: "common", desc: "Yank a foe two tiles away in a line one step toward you. Into a pit = kill." },
  ward: { id: "ward", name: "WARD", type: "charge", tier: "common", desc: "A charge that absorbs the next hit you would take." },
  swap: { id: "swap", name: "SWAP", type: "verb", tier: "premium", desc: "Trade places with a foe in your row or column. The Warlord won't budge." },
  dash: { id: "dash", name: "DASH", type: "verb", tier: "premium", desc: "Move two tiles in a straight line — cross a beam in one turn." },
  leap: { id: "leap", name: "LEAP", type: "verb", tier: "premium", desc: "Vault over one adjacent foe or pit, landing on the empty tile beyond. The Warlord is too vast to clear." },
  empower: { id: "empower", name: "EMPOWER", type: "special", tier: "premium", desc: "Sharpen every verb: reduce all cooldowns by 1." },
};

// Premium boons cost embers to claim (drained from your meta purse) AND appear
// only on a draw roll — they are meant to be a genuine treat, not a default.
export const PREMIUM_COST = 20;
export const PREMIUM_POOL = ["swap", "dash", "leap", "empower"];
export const COMMON_POOL = ["wall", "pull", "ward"];
export const PREMIUM_DRAW = 0.5; // per-slot chance a hard-won premium slot actually rolls premium

export function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// Roll the 3-card boon draft. Premium slots are earned by a clean and/or purge,
// and even then each only rolls premium on a PREMIUM_DRAW coin-flip — so premium
// cards are a real treat. Returns up to 3 reward ids (premium first, shuffled).
export function rollVerbDraft(clean, purge) {
  const premMax = clean && purge ? 2 : (clean || purge) ? 1 : 0;
  let nPrem = 0;
  for (let i = 0; i < premMax; i++) if (Math.random() < PREMIUM_DRAW) nPrem++;
  const prem = shuffle(PREMIUM_POOL).slice(0, nPrem);
  const com = shuffle(COMMON_POOL).slice(0, 3 - nPrem);
  return shuffle([...prem, ...com]);
}

// Between-runs unlocks. Vessels grant starting OPTIONS (verbs / wards) — never
// bigger numbers — so the anti-scaling design survives meta-progression.
export const VESSELS = [
  { id: "wanderer", name: "WANDERER", cost: 0, verbs: ["push"], wards: 0, blurb: "The pure descent. Shove only." },
  { id: "warden", name: "WARDEN", cost: 40, verbs: ["push", "wall"], wards: 0, blurb: "Begins owning WALL — zone the lanes from turn one." },
  { id: "stalker", name: "STALKER", cost: 80, verbs: ["push", "dash"], wards: 0, blurb: "Begins owning DASH — thread beams from the start." },
  { id: "sentinel", name: "SENTINEL", cost: 140, verbs: ["push", "wall"], wards: 1, blurb: "Begins with WALL and one WARD held." },
];
export const VESSEL_BY_ID = Object.fromEntries(VESSELS.map((v) => [v.id, v]));
export const BOSS_EVERY = 5;
// ember economy — kept in one place for easy tuning. Hunting (kills/purges)
// is the dominant source; depth/clean are a modest baseline.
export const EM = { depth: 1, clean: 1, purge: 2, kill: 1, boss: 5, mod: 1 };

// Floor modifiers — named conditions that re-skin the puzzle. All solver-safe:
// dark/hunting are pure presentation/pursuit; volatile/cramped only change
// generation (bombers / arena), which the solver already verifies.
export const MODIFIERS = {
  dark: { label: "DARKNESS", note: "Telegraphs reveal only near you." },
  cramped: { label: "CRAMPED", note: "A tighter arena, edged by the chasm." },
  volatile: { label: "VOLATILE", note: "The dark teems with bombers." },
  hunting: { label: "HUNTING GROUNDS", note: "Stalling summons hunters fast." },
};
export const MOD_KEYS = Object.keys(MODIFIERS);

// STYLE — a flawless killing streak. Builds on PLAYER-caused kills (style points),
// holds through quiet turns, decays when idle, and shatters when you take a hit.
// Ranks need rising cumulative points, so ×3 (RELENTLESS) demands sustained hunting.
export const STYLE = {
  thresh: [0, 2, 5, 9],            // style points required to reach each rank
  mult: [1, 1.5, 2, 3],            // kill-ember multiplier at each rank
  rank: ["", "STALKING", "HUNTING", "RELENTLESS"],
};
// rank index for a given accumulated style-point total
export function styleRank(points) {
  let r = 0;
  for (let i = STYLE.thresh.length - 1; i >= 0; i--) if (points >= STYLE.thresh[i]) { r = i; break; }
  return r;
}

// lifetime records (persisted) + their zero state
export const REC0 = { bestDepth: 0, maxEmbersRun: 0, totalKills: 0, totalCleanPurges: 0, totalBosses: 0, runs: 0, bestStyle: 0 };

// bankable achievements — one-time ember rewards + a gold toast when earned
export const ACH = {
  firstblood: { name: "First Blood", desc: "Slay your first foe.", reward: 5 },
  untouchable: { name: "Untouchable", desc: "Take a floor as a clean purge.", reward: 15 },
  giantslayer: { name: "Giant-Slayer", desc: "Fell a Warlord.", reward: 20 },
  relentless: { name: "Relentless", desc: "Reach Relentless style (×3).", reward: 15 },
  deep10: { name: "Into the Deep", desc: "Reach depth 10.", reward: 15 },
  deep20: { name: "Abyssal", desc: "Reach depth 20.", reward: 40 },
  exterminator: { name: "Exterminator", desc: "Slay 50 foes in all.", reward: 25 },
  survivor: { name: "Survivor", desc: "Brave 10 descents.", reward: 20 },
};
export const ACH_ORDER = ["firstblood", "untouchable", "giantslayer", "relentless", "deep10", "deep20", "exterminator", "survivor"];

// Relics: passive, run-scoped build-definers drafted at shrines. All are
// player-side (they only ever help), so the solver — which never applies them —
// still proves every floor beatable, and the guarantee holds.
export const RELICS = {
  echo: { id: "echo", name: "Echo Stone", desc: "A shove or pull also stuns foes beside where it lands." },
  blood: { id: "blood", name: "Bloodstone", desc: "Each foe you slay refunds a turn from every verb cooldown." },
  ward: { id: "ward", name: "Warded Soul", desc: "The first hit you take on each floor is absorbed." },
  hunt: { id: "hunt", name: "Hunter's Mark", desc: "Every slain foe yields +2 embers." },
  stone: { id: "stone", name: "Stoneskin", desc: "Your walls endure one extra turn." },
  iron: { id: "iron", name: "Iron Resolve", desc: "A hit can no longer drop your style below ×1.5." },
};
export const RELIC_ORDER = ["echo", "blood", "ward", "hunt", "stone", "iron"];
export const RELIC_EVERY = 5; // a relic shrine after every Nth floor cleared
export const EMPTY_SET = new Set();

// Consumables: one-use items kept in a small satchel. Like relics they're
// player-side, so the solver (which never uses them) still proves every floor
// beatable and the no-damage guarantee holds. Using one is your action for the turn.
export const CONSUMABLES = {
  blink: { id: "blink", name: "Blink Dust", desc: "Vanish to a nearby empty tile.", mode: "target" },
  quake: { id: "quake", name: "Quake Flask", desc: "Hurl every adjacent foe back a tile.", mode: "instant" },
  aegis: { id: "aegis", name: "Aegis Draught", desc: "Conjure 2 ward shields.", mode: "instant" },
  phoenix: { id: "phoenix", name: "Phoenix Draught", desc: "Survive one lethal blow. Automatic.", mode: "passive" },
};
export const SATCHEL_MAX = 3;
export const BLINK_RANGE = 3;
// weighted cache loot — Phoenix is the rare drop
export const LOOT_POOL = ["blink", "blink", "quake", "quake", "aegis", "aegis", "phoenix"];

// Event floors break the combat rhythm. Vaults are breathers holding a
// consumable cache; Gauntlets are cursed floors that guarantee a relic.
export const EVENT_VAULT_CHANCE = 0.15;
export const EVENT_GAUNTLET_CHANCE = 0.14;
export const GAUNTLET_MODS = ["volatile", "hunting", "cramped"];

// Inspect copy — shown when the player taps a token or a top status icon.
// Kept beside the data it describes so the React UI stays presentation-only.
export const INSPECT = {
  player: { name: "YOU", tone: "gold", desc: "A fragile lantern-bearer with 3 life and no healing. Reach the portal; reposition threats to survive." },
  charger: { name: "CHARGER", tone: "crimson", desc: "Hunts you one step at a time, closing on its longer axis. Shove it into a pit to slay it." },
  striker: { name: "STRIKER", tone: "violet", desc: "Fires a beam down its row or column when aligned with you. Break the line of sight or step off it." },
  bomber: { name: "BOMBER", tone: "orange", desc: "Arms when you come near, then detonates a cross on a fuse — slaying any foe caught in the blast, including itself." },
  warlord: { name: "WARLORD", tone: "boss", desc: "Every 5th floor. Hunts and beams at once, and is armored — dodge it; a pit-shove only chips a plate." },
  pursuit: { name: "PURSUIT", tone: "crimson", desc: "Stalling raises this. When it fills, the dark spawns a fresh hunter at the far edge. Keep moving." },
  ward: { name: "WARD", tone: "teal", desc: "A held charge that absorbs the next hit you would take." },
};

/* ---------- enemy telegraphs ---------- */
export function chargerIntent(c, player, pits, enemies, wallSet) {
  const dx = player.x - c.x, dy = player.y - c.y;
  const cands = [];
  if (dx !== 0) cands.push({ x: c.x + sign(dx), y: c.y, axis: Math.abs(dx) });
  if (dy !== 0) cands.push({ x: c.x, y: c.y + sign(dy), axis: Math.abs(dy) });
  cands.sort((a, b) => b.axis - a.axis);
  for (const t of cands) {
    if (!inBounds(t.x, t.y)) continue;
    if (t.x === player.x && t.y === player.y) return { kind: "attack", tile: { x: t.x, y: t.y } };
    if (pits.has(key(t.x, t.y)) || wallSet.has(key(t.x, t.y))) continue;
    if (enemies.some((e) => e.id !== c.id && e.x === t.x && e.y === t.y)) continue;
    return { kind: "move", tile: { x: t.x, y: t.y } };
  }
  return { kind: "idle" };
}

export function buildBeam(s, dir, pits, enemies, wallSet) {
  const tiles = [];
  for (let i = 1; i <= STRIKER_RANGE; i++) {
    const x = s.x + dir.x * i, y = s.y + dir.y * i;
    if (!inBounds(x, y)) break;
    if (pits.has(key(x, y)) || wallSet.has(key(x, y))) break;
    if (enemies.some((e) => e.id !== s.id && e.x === x && e.y === y)) break;
    tiles.push({ x, y });
  }
  return tiles;
}
export function strikerIntent(s, player, pits, enemies, wallSet) {
  let dir = null;
  if (s.x === player.x && s.y !== player.y) dir = { x: 0, y: sign(player.y - s.y) };
  else if (s.y === player.y && s.x !== player.x) dir = { x: sign(player.x - s.x), y: 0 };
  if (!dir) return { kind: "idle" };
  const tiles = buildBeam(s, dir, pits, enemies, wallSet);
  if (tiles.some((t) => t.x === player.x && t.y === player.y)) return { kind: "beam", tiles };
  return { kind: "idle" };
}

export function blastTiles(b) {
  const out = [{ x: b.x, y: b.y }];
  for (const [dx, dy] of DIRS) {
    const x = b.x + dx, y = b.y + dy;
    if (inBounds(x, y)) out.push({ x, y });
  }
  return out;
}
export function bomberIntent(b, player) {
  if (b.fuse === 1) return { kind: "detonate", tiles: blastTiles(b) };
  if (b.fuse >= 2) return { kind: "fusing", tiles: blastTiles(b), fuse: b.fuse };
  if (manhattan(b, player) <= BOMB_ARM_RANGE) return { kind: "arming", tiles: blastTiles(b) };
  return { kind: "idle" };
}

// Mini-boss: closes distance like a charger AND fires down its lane like a
// striker. Built purely from the two proven intents, so it adds no new solver
// state — the hitless guarantee carries over unchanged.
export function warlordIntent(b, player, pits, enemies, wallSet) {
  const ci = chargerIntent(b, player, pits, enemies, wallSet);
  const si = strikerIntent(b, player, pits, enemies, wallSet);
  let tile = ci.kind === "idle" ? null : ci.tile;
  // The Warlord refuses to stall: when both direct steps are blocked, it routes
  // around the obstacle — taking any open neighbour that gets it strictly closer.
  // Deterministic (DIRS order, no RNG) so the solver models the same approach.
  if (!tile) {
    const cur = manhattan(b, player);
    let best = null, bestD = cur;
    for (const [dx, dy] of DIRS) {
      const nx = b.x + dx, ny = b.y + dy;
      if (!inBounds(nx, ny) || (nx === player.x && ny === player.y)) continue;
      if (pits.has(key(nx, ny)) || wallSet.has(key(nx, ny))) continue;
      if (enemies.some((e) => e.id !== b.id && e.x === nx && e.y === ny)) continue;
      const d = manhattan({ x: nx, y: ny }, player);
      if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
    }
    if (best) tile = best;
  }
  const beam = si.kind === "beam" ? si.tiles : null;
  if (!tile && !beam) return { kind: "idle" };
  return { kind: "warlord", tile, beam };
}

export function withIntents(player, enemies, pits, walls) {
  const wallSet = wallsToSet(walls);
  return enemies.map((e) => {
    let intent;
    if (e.type === "charger") intent = chargerIntent(e, player, pits, enemies, wallSet);
    else if (e.type === "striker") intent = strikerIntent(e, player, pits, enemies, wallSet);
    else if (e.type === "warlord") intent = warlordIntent(e, player, pits, enemies, wallSet);
    else intent = bomberIntent(e, player);
    return { ...e, intent, pushed: false };
  });
}

/* ---------- turn resolution (preview == reality) ----------
   Also returns an `events` list — what physically happened this turn
   (shoves, kills, beams, detonations, descend). The UI consumes it for
   sound + VFX; the solver and preview ignore it. Kill events carry
   `byPlayer` — true for kills caused by the player's own action this turn
   (shove/pull/quake/leap into a pit), false for autonomous enemy-phase
   detonations. Style only advances on byPlayer kills; embers count all. */
export function resolve(state, action, relics = EMPTY_SET) {
  const { pits, stairs } = state;
  let player = { ...state.player };
  let enemies = state.enemies.map((e) => ({ ...e, pushed: false }));
  let walls = (state.walls || []).map((w) => ({ ...w }));
  let dmg = 0;
  const events = [];

  switch (action.type) {
    case "move":
      player = { x: action.to.x, y: action.to.y };
      events.push({ kind: "move" });
      break;
    case "dash":
      player = { x: action.to.x, y: action.to.y };
      events.push({ kind: "dash" });
      break;
    case "leap":
      player = { x: action.to.x, y: action.to.y };
      events.push({ kind: "leap" });
      break;
    case "blink":
      player = { x: action.to.x, y: action.to.y };
      events.push({ kind: "blink", x: action.to.x, y: action.to.y });
      break;
    case "quake": {
      // hurl every adjacent non-boss foe back one tile (into a pit = a kill)
      for (const [dx, dy] of DIRS) {
        const ax = player.x + dx, ay = player.y + dy;
        const idx = enemies.findIndex((e) => e.x === ax && e.y === ay);
        if (idx < 0) continue;
        const tgt = enemies[idx];
        if (tgt.type === "warlord") { enemies[idx] = { ...tgt, pushed: false }; continue; }
        const tx = ax + dx, ty = ay + dy, tk = key(tx, ty);
        events.push({ kind: "shove", x: tx, y: ty });
        if (inBounds(tx, ty) && pits.has(tk)) {
          events.push({ kind: "kill", x: tx, y: ty, cause: "pit", boss: false, byPlayer: true });
          enemies.splice(idx, 1);
        } else if (inBounds(tx, ty) && !walls.some((w) => w.x === tx && w.y === ty) && !enemies.some((e) => e.x === tx && e.y === ty)) {
          enemies[idx] = { ...tgt, x: tx, y: ty, pushed: true };
        } else {
          enemies[idx] = { ...tgt, pushed: true }; // wall/edge/foe behind: stunned in place
        }
      }
      break;
    }
    case "wall":
      walls.push({ x: action.to.x, y: action.to.y, ttl: WALL_TTL + (relics.has("stone") ? 1 : 0) });
      events.push({ kind: "wall", x: action.to.x, y: action.to.y });
      break;
    case "push":
    case "pull": {
      const idx = enemies.findIndex((e) => e.id === action.targetId);
      if (idx >= 0) {
        const tgt = enemies[idx];
        events.push({ kind: "shove", x: action.to.x, y: action.to.y });
        if (action.dies && tgt.type === "warlord" && (tgt.hp || 1) > 1) {
          // armored: a pit-shove chips a plate but the Warlord clings on, stays
          // put, and STILL acts this turn — chain-shoving it is not free.
          enemies[idx] = { ...tgt, hp: (tgt.hp || 1) - 1, pushed: false };
          events.push({ kind: "stagger", x: tgt.x, y: tgt.y });
        } else if (action.dies) {
          events.push({ kind: "kill", x: action.to.x, y: action.to.y, cause: "pit", boss: tgt.type === "warlord", byPlayer: true });
          enemies.splice(idx, 1);
        } else {
          enemies[idx] = { ...tgt, x: action.to.x, y: action.to.y, pushed: true };
        }
        // Echo Stone: foes beside the landing tile are staggered (skip their turn)
        if (relics.has("echo")) {
          for (const [dx, dy] of DIRS) {
            const ax = action.to.x + dx, ay = action.to.y + dy;
            const a = enemies.find((e) => e.x === ax && e.y === ay && e.id !== action.targetId && !e.pushed);
            if (a) { a.pushed = true; events.push({ kind: "stagger", x: a.x, y: a.y }); }
          }
        }
      }
      break;
    }
    case "swap": {
      const e = enemies.find((en) => en.id === action.targetId);
      if (e && e.type !== "warlord") {
        const px = player.x, py = player.y;
        player = { x: e.x, y: e.y };
        e.x = px; e.y = py; e.pushed = true;
        events.push({ kind: "swap", x: player.x, y: player.y });
      }
      break;
    }
    default:
      break; // wait
  }

  const wallSet = wallsToSet(walls);

  // Reaching the stairs is an escape: you descend before enemies act.
  if (player.x === stairs.x && player.y === stairs.y) {
    events.push({ kind: "descend" });
    return { player, enemies, walls, dmg: 0, descend: true, events };
  }

  // chargers + strikers
  const occupied = new Set(enemies.map((e) => key(e.x, e.y)));
  const order = [...enemies].sort((a, b) => a.id - b.id);
  for (const ref of order) {
    const e = enemies.find((x) => x.id === ref.id);
    if (!e || e.pushed) continue;
    const it = e.intent;
    if (!it || it.kind === "idle") continue;
    if (e.type === "striker") {
      if (it.tiles.some((t) => t.x === player.x && t.y === player.y)) {
        dmg += 1;
        events.push({ kind: "beam", tiles: it.tiles });
      }
      continue;
    }
    if (e.type === "charger") {
      const t = it.tile;
      if (player.x === t.x && player.y === t.y) { dmg += 1; events.push({ kind: "slash" }); continue; }
      occupied.delete(key(e.x, e.y));
      if (!occupied.has(key(t.x, t.y)) && !pits.has(key(t.x, t.y)) && !wallSet.has(key(t.x, t.y))) {
        e.x = t.x; e.y = t.y;
      }
      occupied.add(key(e.x, e.y));
    }
    if (e.type === "warlord") {
      if (it.beam && it.beam.some((t) => t.x === player.x && t.y === player.y)) {
        dmg += 1;
        events.push({ kind: "beam", tiles: it.beam });
      }
      const t = it.tile;
      if (t) {
        if (player.x === t.x && player.y === t.y) { dmg += 1; events.push({ kind: "slash" }); }
        else {
          occupied.delete(key(e.x, e.y));
          if (!occupied.has(key(t.x, t.y)) && !pits.has(key(t.x, t.y)) && !wallSet.has(key(t.x, t.y))) {
            e.x = t.x; e.y = t.y;
          }
          occupied.add(key(e.x, e.y));
        }
      }
    }
  }

  // bombers: detonate (fuse 1), then tick / arm survivors
  const detonated = new Set(), victims = new Set();
  for (const b of enemies) {
    if (b.type !== "bomber" || b.pushed) continue;
    if (b.fuse === 1) {
      const tiles = blastTiles(b);
      if (tiles.some((t) => t.x === player.x && t.y === player.y)) dmg += 1;
      for (const o of enemies)
        if (o.id !== b.id && tiles.some((t) => t.x === o.x && t.y === o.y)) victims.add(o.id);
      detonated.add(b.id);
      events.push({ kind: "detonate", x: b.x, y: b.y, tiles });
    }
  }
  // armored warlords caught in a blast lose a plate instead of dying
  const survivors = new Set();
  for (const o of enemies) {
    if (!victims.has(o.id)) continue;
    if (o.type === "warlord" && (o.hp || 1) > 1) {
      o.hp = (o.hp || 1) - 1;
      survivors.add(o.id);
      events.push({ kind: "stagger", x: o.x, y: o.y });
    } else {
      // autonomous detonation during the enemy phase — counts for embers, not style
      events.push({ kind: "kill", x: o.x, y: o.y, cause: "blast", boss: o.type === "warlord", byPlayer: false });
    }
  }
  for (const id of survivors) victims.delete(id);
  if (detonated.size || victims.size)
    enemies = enemies.filter((e) => !detonated.has(e.id) && !victims.has(e.id));
  for (const b of enemies) {
    if (b.type !== "bomber" || b.pushed) continue;
    if (b.fuse >= 2) b.fuse -= 1;
    else if (b.fuse === 0 && manhattan(b, player) <= BOMB_ARM_RANGE) b.fuse = BOMB_FUSE;
  }

  // Age walls at END of turn: a wall blocks during the same enemy phase its
  // telegraph accounted for, then expires — no surprise un-blocking mid-turn.
  walls = walls.map((w) => ({ ...w, ttl: w.ttl - 1 })).filter((w) => w.ttl > 0);

  return { player, enemies, walls, dmg, descend: false, events };
}

/* ---------- reachability + solver ---------- */
export function reachable(start, goal, pits) {
  const seen = new Set([key(start.x, start.y)]);
  const q = [start];
  while (q.length) {
    const c = q.shift();
    if (c.x === goal.x && c.y === goal.y) return true;
    for (const [dx, dy] of DIRS) {
      const nx = c.x + dx, ny = c.y + dy;
      if (!inBounds(nx, ny)) continue;
      const k = key(nx, ny);
      if (seen.has(k) || pits.has(k)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return false;
}

// The set of non-pit tiles orthogonally connected to `start` (its open region).
// Used so enemies never spawn sealed off in a pit pocket they can't leave.
export function regionFrom(start, pits) {
  const seen = new Set([key(start.x, start.y)]);
  const q = [start];
  while (q.length) {
    const c = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = c.x + dx, ny = c.y + dy;
      if (!inBounds(nx, ny)) continue;
      const k = key(nx, ny);
      if (seen.has(k) || pits.has(k)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

// BFS proof that a ZERO-DAMAGE line to the stairs exists, using only the
// always-available move/shove/wait actions (verbs can only help, so they're
// excluded — keeping the guarantee honest and the search cheap). Bombers ARE
// modelled, including their fuse, so bomb floors are verified too.
export function stateKey(player, enemies) {
  return (
    player.x + "," + player.y + "#" +
    enemies
      .map((e) => e.id + ":" + e.x + "," + e.y +
        (e.type === "bomber" ? "f" + (e.fuse || 0) : "") +
        (e.type === "warlord" ? "h" + (e.hp || 1) : ""))
      .sort()
      .join("|")
  );
}
export function enumActions(player, enemies, pits) {
  const acts = [{ type: "wait" }];
  for (const [dx, dy] of DIRS) {
    const x = player.x + dx, y = player.y + dy;
    if (!inBounds(x, y) || pits.has(key(x, y))) continue;
    if (enemies.some((e) => e.x === x && e.y === y)) continue;
    acts.push({ type: "move", to: { x, y } });
  }
  for (const e of enemies) {
    if (e.type === "warlord") continue; // boss is armored: dodging is the proven hitless line, never shoving it
    if (manhattan(e, player) !== 1) continue;
    const dest = { x: e.x + sign(e.x - player.x), y: e.y + sign(e.y - player.y) };
    if (!inBounds(dest.x, dest.y)) continue;
    if (enemies.some((o) => o.id !== e.id && o.x === dest.x && o.y === dest.y)) continue;
    acts.push({ type: "push", targetId: e.id, to: dest, dies: pits.has(key(dest.x, dest.y)) });
  }
  return acts;
}
export function cleanSolution(pits, stairs, player0, enemies0, nodeCap = 6000) {
  const start = { player: player0, enemies: withIntents(player0, enemies0, pits, []) };
  const visited = new Set([stateKey(start.player, start.enemies)]);
  const queue = [{ ...start, d: 0 }];
  let head = 0, explored = 0;
  while (head < queue.length) {
    if (++explored > nodeCap) return { ok: false, len: -1 };
    const node = queue[head++];
    for (const a of enumActions(node.player, node.enemies, pits)) {
      const pv = resolve({ pits, stairs, player: node.player, enemies: node.enemies, walls: [] }, a);
      if (pv.descend) return { ok: true, len: node.d + 1 };
      if (pv.dmg > 0) continue;
      const ne = withIntents(pv.player, pv.enemies, pits, []);
      const k = stateKey(pv.player, ne);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ player: pv.player, enemies: ne, d: node.d + 1 });
    }
  }
  return { ok: false, len: -1 };
}

/* ---------- floor generation ---------- */
export function generateFloor(depth) {
  const isBoss = depth % BOSS_EVERY === 0;
  // event floors: vault (breather + loot) or gauntlet (cursed + guaranteed relic)
  let event = null;
  if (!isBoss && depth >= 3) {
    const r = Math.random();
    if (r < EVENT_VAULT_CHANCE) event = "vault";
    else if (r < EVENT_VAULT_CHANCE + EVENT_GAUNTLET_CHANCE) event = "gauntlet";
  }
  // pick a floor modifier (never on boss floors); gauntlets always carry one
  let modifier = null;
  if (event === "gauntlet") modifier = pick(GAUNTLET_MODS);
  else if (event !== "vault" && !isBoss && depth >= 4 && Math.random() < 0.38) modifier = pick(MOD_KEYS);

  // cramped shaves the grid to a tighter arena, edged by the chasm
  let bx0 = 0, bx1 = W - 1, by0 = 0, by1 = H - 1;
  if (modifier === "cramped") {
    if (Math.random() < 0.5) bx0 = 1; else bx1 = W - 2;
    if (Math.random() < 0.5) by0 = 1; else by1 = H - 2;
  }
  const inBox = (x, y) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1;

  const bossAdds = Math.max(1, Math.min(Math.floor(depth / 5), 3));
  let nEnemies = isBoss ? 1 + bossAdds : Math.min(1 + Math.floor((depth - 1) / 2), depth >= 14 ? 6 : 5);
  if (event === "vault") nEnemies = Math.max(1, Math.min(1 + Math.floor((depth - 1) / 2), 5)); // a guarded hoard — the cache always sits on an enemy floor
  else if (event === "gauntlet") nEnemies = Math.min(nEnemies + 1, 6);
  else if (modifier === "volatile") nEnemies = Math.min(nEnemies + 1, 6);
  const nPits = modifier === "cramped"
    ? Math.min(2 + Math.floor(depth / 3), 5)
    : Math.min(3 + Math.floor(depth / 2), 10);
  const bossHp = depth >= 15 ? 3 : 2;
  const targetLen = Math.min(3 + Math.floor(depth / 2), 12);
  const minPlayerStairs = modifier === "cramped" ? 4 : 5;
  let firstSolvable = null;

  for (let attempt = 0; attempt < 180; attempt++) {
    const player = { x: randInt(bx0, bx1), y: pick([by1, by1 - 1]) };
    const stairs = { x: randInt(bx0, bx1), y: pick([by0, by0 + 1]) };
    if (manhattan(player, stairs) < minPlayerStairs) continue;

    const blocked = new Set([key(player.x, player.y), key(stairs.x, stairs.y)]);
    const pits = new Set();
    // chasm border for cramped: everything outside the box is a pit
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (!inBox(x, y)) pits.add(key(x, y));
    let safety = 0;
    while (pits.size - (W * H - (bx1 - bx0 + 1) * (by1 - by0 + 1)) < nPits && safety++ < 240) {
      const x = randInt(bx0, bx1), y = randInt(by0, by1);
      const k = key(x, y);
      if (blocked.has(k) || pits.has(k)) continue;
      pits.add(k);
    }
    if (!reachable(player, stairs, pits)) continue;

    // the player's open region — enemies must spawn inside it so none is ever
    // sealed off in a pit pocket it can't leave (and the player can't engage).
    const region = regionFrom(player, pits);

    const minDist = isBoss ? 3 : 2;
    const free = [];
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const k = key(x, y);
        if (pits.has(k) || k === key(player.x, player.y) || k === key(stairs.x, stairs.y)) continue;
        if (!region.has(k)) continue; // skip tiles cut off from the player by pits
        if (manhattan({ x, y }, player) < minDist) continue;
        // skip tiles with no orthogonal exit — an enemy here would be inert
        const hasExit = DIRS.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return inBounds(nx, ny) && !pits.has(key(nx, ny)); });
        if (!hasExit) continue;
        free.push({ x, y });
      }
    if (free.length < nEnemies) continue;

    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    if (!isBoss) {
      const nearIdx = free.findIndex((t) => { const d = manhattan(t, player); return d >= 2 && d <= 4; });
      if (nearIdx > 0) [free[0], free[nearIdx]] = [free[nearIdx], free[0]];
    }

    const regular = depth >= 4 ? ["charger", "striker", "bomber"] : ["charger", "striker"];
    const rawEnemies = [];
    for (let i = 0; i < nEnemies; i++) {
      let type;
      if (isBoss) type = i === 0 ? "warlord" : pick(regular);
      else if (modifier === "volatile") type = i === 0 ? "charger" : (Math.random() < 0.6 && depth >= 4 ? "bomber" : pick(regular));
      else if (i === 0) type = "charger";
      else if (i === 1) type = depth >= 4 && Math.random() < 0.5 ? "bomber" : "striker";
      else type = pick(regular);
      const e = { id: i + 1, type, x: free[i].x, y: free[i].y };
      if (type === "bomber") e.fuse = 0;
      if (type === "warlord") e.hp = bossHp;
      rawEnemies.push(e);
    }

    const sol = cleanSolution(pits, stairs, player, rawEnemies, 7500);
    if (!sol.ok) continue;
    let cache = null;
    if (event === "vault") {
      const taken = new Set([key(player.x, player.y), key(stairs.x, stairs.y), ...rawEnemies.map((e) => key(e.x, e.y))]);
      const spots = [];
      for (let y = by0; y <= by1; y++)
        for (let x = bx0; x <= bx1; x++) {
          const k = key(x, y);
          if (pits.has(k) || taken.has(k)) continue;
          if (manhattan({ x, y }, stairs) < 2) continue; // worth a small detour
          spots.push({ x, y });
        }
      if (spots.length) { const s = pick(spots); cache = { x: s.x, y: s.y, item: pick(LOOT_POOL) }; }
    }
    const floor = { pits, stairs, player, enemies: withIntents(player, rawEnemies, pits, []), modifier, event, cache };
    if (sol.len >= targetLen || event) return floor; // events accept the first solvable layout
    if (!firstSolvable) firstSolvable = floor;
  }
  if (firstSolvable) return firstSolvable;

  const pits = new Set([key(1, 3), key(4, 2)]);
  const player = { x: 2, y: 5 };
  const stairs = { x: 3, y: 0 };
  const fb = isBoss ? [{ id: 1, type: "warlord", x: 2, y: 1, hp: bossHp }] : [{ id: 1, type: "charger", x: 0, y: 1 }];
  const enemies = withIntents(player, fb, pits, []);
  return { pits, stairs, player, enemies, modifier: null, event: null, cache: null };
}

export function farEdgeSpawn(player, enemies, pits, stairs) {
  let best = null, bestD = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x !== 0 && x !== W - 1 && y !== 0 && y !== H - 1) continue;
      const k = key(x, y);
      if (pits.has(k)) continue;
      if (x === player.x && y === player.y) continue;
      if (x === stairs.x && y === stairs.y) continue;
      if (enemies.some((e) => e.x === x && e.y === y)) continue;
      const d = manhattan({ x, y }, player);
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
  return best;
}
