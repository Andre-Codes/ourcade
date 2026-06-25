import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { playSfx, playSfxLoop } from "../lib/sfx.js";

/* ═══════════════════════════════════════════════════════════════════════════
   MODEM DEFENDER — BRICKLES. Ourcade's brick-breaker, dressed as the late-90s web.

   Your 56k modem is the PADDLE at the bottom (drag, or ←/→). A glowing DATA PACKET
   ricochets off it into a WALL of early-2000s junk — pop-ups, banner ads, spam,
   viruses, Clippy, toolbar hijackers — that you smash brick by brick. Tougher junk
   takes more hits; a couple of types occasionally lob a missile down at you. Some
   blocks in the wall are LOOT CRATES: break one and you're instantly handed a random
   consumable (no catching). Stash them in a 5-slot inventory — 🛡️ Firewall (paddle
   force-field that ricochets missiles back into the wall), 🍴 Fork Bomb (multiball),
   ⏳ Buffering (slow-mo), ⚡ Overclock (molten pierce ball), 📡 Broadband (wide
   paddle) — and tap a slot to fire it. Clear the wall to advance; every 5th level a
   lone BSOD BOSS roams the arena. Miss the ball and your CONNECTION drains; 0% =
   NO CARRIER.

   Architecture: self-contained cabinet — scoped `.md-*` CSS injected once, own back
   button, one route. Absolutely-positioned DOM nodes driven by a rAF loop with refs
   mirroring state (the Tap Surge / Color Panic family). Live entities live in refs;
   React state is only the coarse phase + a render pump. Entity pools are CAPPED and
   pruned each frame so DOM node count stays bounded. Scores ride the Arcade Score
   Standard via useArcadeScore("modem-defender").

   Audio: procedural Web-Audio tones are the always-present base; named Kenney samples
   layer on via playSfx() (silent-safe). The boss entrance plays computerNoise once
   and loops spaceEngine (playSfxLoop) for as long as the boss lives. Sprites live
   under public/games/modem-defender/; new art (ball, loot, badges) falls back to
   emoji/CSS until processed, so the game always runs.
   ═══════════════════════════════════════════════════════════════════════════ */

const GAME_ID = "modem-defender";
const HS_KEY = "modem:best"; // → ourcade:modem:best
const BASE = (import.meta.env.BASE_URL || "/") + "games/modem-defender/";
const sprite = (name) => `${BASE}sprites/${name}`;
const ui = (name) => `${BASE}ui/${name}`;

const T = {
  bg: "#08080f",
  surface: "#0f0f1e",
  cyan: "#3fffd0",
  green: "#30d158",
  yellow: "#ffd60a",
  red: "#ff2d55",
  purple: "#bf5af2",
  blue: "#0a84ff",
  navy: "#000080",
  silver: "#c0c0c0",
};

const rand = (a, b) => Math.random() * (b - a) + a;
const randI = (a, b) => Math.floor(rand(a, b + 1));
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = () => performance.now();
const lerp = (a, b, t) => a + (b - a) * t;

/* ── Brick catalog (data-driven; reuses the existing sprites) ──────────────────
   w       : on-screen width in px (cell sizing derives from this)
   hp      : hits to break
   score   : points per break
   drain   : connection % a brick costs YOU if it ever reaches the bottom (rare —
             only relevant to boss-spawned divers; wall bricks don't move)
   art     : sprite file (or null for emoji)
   anim    : frame count if it's an animated strip (virus)
   fires   : ms cadence to lob a missile (0 = never). Kept sparse on purpose.
   weight  : relative frequency in the wall once unlocked
   minLevel: first level this type appears */
const BRICKS = {
  popup: { w: 58, hp: 1, score: 100, drain: 6, art: "popup.webp", fires: 0, weight: 10, minLevel: 1 },
  spam: { w: 54, hp: 1, score: 120, drain: 5, art: "spam.webp", fires: 0, weight: 7, minLevel: 1 },
  banner: { w: 104, hp: 2, score: 150, drain: 7, art: "banner.webp", fires: 0, weight: 5, minLevel: 2 },
  virus: { w: 56, hp: 2, score: 200, drain: 10, art: "virus.webp", fires: 5200, weight: 5, minLevel: 3 },
  clippy: { w: 66, hp: 3, score: 220, drain: 9, art: "clippy.webp", fires: 6000, weight: 4, minLevel: 4 },
  toolbar: { w: 92, hp: 4, score: 260, drain: 8, art: "toolbar.webp", fires: 0, weight: 4, minLevel: 5 },
};

/* ── Inventory items (consumables looted from crates) ──────────────────────────
   The 5 slots, in display order. `dur` is the active-effect window in ms (0 =
   instant). `special` items have a level gate before they can drop. `badge` is the
   processed circular-badge sprite; until it exists the chip shows `emoji`. */
const ITEMS = {
  firewall: { id: "firewall", name: "FIREWALL", emoji: "🛡️", color: T.green, dur: 5000, badge: "badge-firewall.webp", weight: 6, minLevel: 1 },
  forkbomb: { id: "forkbomb", name: "FORK BOMB", emoji: "🍴", color: T.yellow, dur: 0, badge: "badge-forkbomb.webp", weight: 6, minLevel: 1 },
  buffering: { id: "buffering", name: "BUFFERING", emoji: "⏳", color: T.cyan, dur: 6000, badge: "badge-buffering.webp", weight: 6, minLevel: 1 },
  broadband: { id: "broadband", name: "BROADBAND", emoji: "📡", color: T.blue, dur: 9000, badge: "badge-broadband.webp", weight: 3, minLevel: 10, special: true },
  overclock: { id: "overclock", name: "OVERCLOCK", emoji: "⚡", color: T.purple, dur: 6000, badge: "badge-overclock.webp", weight: 3, minLevel: 15, special: true },
};
const ITEM_ORDER = ["firewall", "forkbomb", "buffering", "broadband", "overclock"];

// Pacing / tuning constants (kept together for playtest retuning).
const LEVELS_PER_BOSS = 5;
const BOSS_BASE_HP = 50; // boss #1 HP; × boss number thereafter
const BALL_BASE_SPEED = 360; // px/sec at level 1
const BALL_SPEED_PER_LEVEL = 16; // +px/sec each level
const BALL_SPEED_MAX = 620;
const PADDLE_W = 96;
const PADDLE_W_WIDE = 168; // Broadband
const PADDLE_Y_FRAC = 0.8; // paddle sits here; leaves a clear gap above the item bar
const MISS_DRAIN = 18; // connection lost when a ball falls past the paddle
const MISSILE_DRAIN = 5; // connection lost when a missile hits the paddle
const LOOT_PER_LEVEL = [1, 3]; // min..max loot crates woven into a wall
const ENTITY_CAP = { balls: 12, missiles: 40, bricks: 80, sparks: 80 };
// Stacking: how many of each item you can hold, by level reached.
const STACK_T1 = 5; // level ≥5 (after first boss) → hold 2
const STACK_T2 = 10; // level ≥10 → hold 3
function stackCap(level) {
  if (level >= STACK_T2) return 3;
  if (level >= STACK_T1) return 2;
  return 1;
}
// Which items may drop at a given level (specials gated by minLevel).
function lootPool(level) {
  return ITEM_ORDER.filter((id) => level >= ITEMS[id].minLevel);
}
function rollLoot(level) {
  const pool = [];
  for (const id of lootPool(level)) for (let i = 0; i < ITEMS[id].weight; i++) pool.push(id);
  return pool[randI(0, pool.length - 1)] || "firewall";
}

/* ── Sound (Web Audio procedural base; Kenney samples layer on if present) ───── */
let _ctx = null;
function ctx() {
  try {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}
function tone({ freq = 440, gain = 0.12, dur = 0.09, sweep = 0.7, type = "sine" } = {}) {
  const c = ctx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const filt = c.createBiquadFilter();
    const env = c.createGain();
    osc.connect(filt);
    filt.connect(env);
    env.connect(c.destination);
    osc.type = type;
    filt.type = "lowpass";
    filt.frequency.value = freq * 2.2;
    const t = c.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.02);
    osc.start(t);
    osc.stop(t + dur + 0.04);
  } catch {}
}
const SFX = {
  // ball bounces off the paddle — sampled thunk + a soft tone underneath
  paddle: () => { playSfx("paddle_hit", { volume: 0.55 }); tone({ freq: 240, gain: 0.05, dur: 0.05, sweep: 0.9 }); },
  // ball hits a brick that survives
  brick: () => { playSfx("enemy_hit", { volume: 0.5 }); },
  // a non-boss brick is destroyed
  pop: (combo = 0) => { playSfx("impactPunch_heavy_003", { volume: 0.55 }); tone({ freq: 420 + combo * 14, gain: 0.05, dur: 0.06, sweep: 0.6, type: "triangle" }); },
  wall: () => { playSfx("paddle_hit", { volume: 0.3 }); }, // ball off a side/top wall (quiet)
  shield: () => { playSfx("forceField_002", { volume: 0.6 }); },
  item: () => [523, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.09, dur: 0.1, sweep: 0.9 }), i * 55)),
  use: (c = T.cyan) => { void c; tone({ freq: 660, gain: 0.08, dur: 0.08, sweep: 1.1, type: "square" }); },
  miss: () => { tone({ freq: 150, gain: 0.13, dur: 0.16, sweep: 0.5 }); setTimeout(() => tone({ freq: 95, gain: 0.09, dur: 0.13, sweep: 0.5 }), 90); },
  hurt: () => tone({ freq: 220, gain: 0.1, dur: 0.12, sweep: 0.6, type: "sawtooth" }),
  level: () => [392, 523].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.08, dur: 0.12, sweep: 0.9 }), i * 70)),
  bossEnter: () => { playSfx("computerNoise_001", { volume: 0.7, fadeOut: 3 }); }, // ~5s clip, fades over its last 3s; the loop is started separately
  bossHit: () => tone({ freq: 200, gain: 0.07, dur: 0.05, sweep: 0.7, type: "square" }),
  bossDie: () => { playSfx("large_explosion", { volume: 0.7 }); [392, 311, 233, 175].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.1, dur: 0.16, sweep: 0.6 }), i * 110)); },
  count: () => tone({ freq: 440, gain: 0.1, dur: 0.07, sweep: 0.85 }),
  go: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.1, dur: 0.1, sweep: 0.8 }), i * 55)),
};

function loadBest() {
  return lsGetJSON(HS_KEY, 0) || 0;
}
function saveBest(score) {
  const b = loadBest();
  if (score > b) lsSetJSON(HS_KEY, score);
  return Math.max(score, b);
}

function barColor(pct) {
  if (pct > 55) return T.green;
  if (pct > 25) return T.yellow;
  return T.red;
}

export function ModemDefender({ onExit }) {
  const [phase, setPhase] = useState("start"); // start | countdown | running | over
  const [count, setCount] = useState(3);
  const [, force] = useState(0);
  const tick = useCallback(() => force((n) => (n + 1) & 0xffff), []);

  // Live state in refs (rAF loop reads/writes every frame). React state = coarse only.
  const balls = useRef([]); // [{ id, x, y, vx, vy, r, stuck, pierce }]
  const bricks = useRef([]); // [{ id, type, x, y, w, h, hp, maxHp, art, anim, fires, nextShot, loot }]
  const missiles = useRef([]); // [{ id, x, y, vy, vx, w, hostile }]
  const boss = useRef(null); // { hp, maxHp, x, y, w, num, dir, nextMinion, nextShot, entering }
  const floats = useRef([]);
  const sparks = useRef([]);

  const paddle = useRef({ x: 0, targetX: 0, w: PADDLE_W });
  const inv = useRef({ counts: {}, seen: {}, active: {} }); // counts[id], seen[id], active[id]=expiryTs
  const [invView, setInvView] = useState({ order: [], counts: {}, active: {}, cap: 1 }); // mirror for render

  const score = useRef(0);
  const combo = useRef(0);
  const conn = useRef(100);
  const level = useRef(1);
  const bossCount = useRef(0);
  const mode = useRef("wall"); // wall | boss
  const hitFlash = useRef(0);
  const launchPending = useRef(false); // a ball is stuck waiting to be launched

  const raf = useRef(0);
  const lastFrame = useRef(0);
  const arena = useRef(null);
  const dragging = useRef(false);
  const keys = useRef({ left: false, right: false });
  const bossLoop = useRef(null); // handle from playSfxLoop while boss alive

  const { submit, best } = useArcadeScore(GAME_ID);

  // ── countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "countdown") return;
    setCount(3);
    SFX.count();
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      setCount(n);
      if (n <= 0) {
        clearInterval(id);
        SFX.go();
        beginRun();
      } else SFX.count();
    }, 700);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function stopBossLoop() {
    if (bossLoop.current) {
      bossLoop.current.stop();
      bossLoop.current = null;
    }
  }

  function reset() {
    balls.current = [];
    bricks.current = [];
    missiles.current = [];
    boss.current = null;
    floats.current = [];
    sparks.current = [];
    score.current = 0;
    combo.current = 0;
    conn.current = 100;
    level.current = 1;
    bossCount.current = 0;
    mode.current = "wall";
    hitFlash.current = 0;
    inv.current = { counts: {}, seen: {}, active: {} };
    stopBossLoop();
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    paddle.current = { x: W / 2, targetX: W / 2, w: PADDLE_W };
    syncInv();
  }

  function beginRun() {
    reset();
    buildLevel(1);
    setPhase("running");
    lastFrame.current = 0;
    raf.current = requestAnimationFrame(loop);
  }

  function endRun() {
    cancelAnimationFrame(raf.current);
    stopBossLoop();
    SFX.miss();
    saveBest(score.current);
    submit(score.current);
    setPhase("over");
  }

  function addFloat(x, y, text, color) {
    floats.current.push({ id: uid(), x, y, text, color, born: now() });
  }
  function spawnSpark(x, y, kind) {
    if (sparks.current.length > ENTITY_CAP.sparks) sparks.current.shift();
    sparks.current.push({ id: uid(), x, y, kind, born: now() });
  }

  function ballSpeed() {
    return Math.min(BALL_SPEED_MAX, BALL_BASE_SPEED + (level.current - 1) * BALL_SPEED_PER_LEVEL);
  }
  function paddleY() {
    const box = arena.current?.getBoundingClientRect();
    return (box?.height || 600) * PADDLE_Y_FRAC;
  }

  // Spawn one ball stuck to the paddle, awaiting launch.
  function spawnBall(stuck = true) {
    if (balls.current.length >= ENTITY_CAP.balls) return;
    const px = paddle.current.x;
    balls.current.push({ id: uid(), x: px, y: paddleY() - 22, vx: 0, vy: 0, r: 13, stuck, pierce: false });
    if (stuck) launchPending.current = true;
  }

  function launchBall() {
    let launched = false;
    for (const b of balls.current) {
      if (b.stuck) {
        const ang = rand(-0.35, 0.35); // mostly up, slight angle
        const s = ballSpeed();
        b.vx = Math.sin(ang) * s;
        b.vy = -Math.cos(ang) * s;
        b.stuck = false;
        launched = true;
      }
    }
    if (launched) { launchPending.current = false; SFX.paddle(); }
  }

  // ── level / wall building ────────────────────────────────────────────────
  function buildLevel(lv) {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    bricks.current = [];
    missiles.current = [];
    boss.current = null;
    stopBossLoop();
    // fresh ball on the paddle
    balls.current = [];
    spawnBall(true);

    if (lv % LEVELS_PER_BOSS === 0) {
      mode.current = "boss";
      spawnBoss(lv);
      SFX.bossEnter();
      bossLoop.current = playSfxLoop("spaceEngine_000", { volume: 0.4 });
      addFloat(W / 2, 120, "⚠ BSOD INCOMING ⚠", T.purple);
      return;
    }

    mode.current = "wall";
    SFX.level();
    addFloat(W / 2, 100, `LEVEL ${lv}`, T.cyan);
    // grid sizing — bigger bricks; slight visual overlap is fine (gap can be small/neg)
    const cols = clamp(4 + Math.floor(lv / 2), 5, 8);
    const top = 78;
    const gap = 2;
    const cellW = Math.min(96, (W - 16 - gap * (cols - 1)) / cols);
    const rows = clamp(2 + Math.floor(lv / 2), 3, 6);
    const x0 = (W - (cellW * cols + gap * (cols - 1))) / 2 + cellW / 2;
    const cellH = 42;
    // choose loot crate cells
    const total = rows * cols;
    const lootN = clamp(randI(LOOT_PER_LEVEL[0], LOOT_PER_LEVEL[1]), 0, total);
    const lootCells = new Set();
    while (lootCells.size < lootN) lootCells.add(randI(0, total - 1));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const isLoot = lootCells.has(idx);
        const type = isLoot ? "loot" : pickBrickType(lv, r);
        const def = isLoot ? null : BRICKS[type];
        const cx = x0 + c * (cellW + gap);
        const cy = top + r * (cellH + gap);
        if (bricks.current.length >= ENTITY_CAP.bricks) break;
        bricks.current.push({
          id: uid(),
          type: isLoot ? "loot" : type,
          loot: isLoot,
          x: cx,
          y: cy,
          w: cellW,
          h: cellH,
          hp: isLoot ? 1 : def.hp,
          maxHp: isLoot ? 1 : def.hp,
          art: isLoot ? null : def.art,
          anim: isLoot ? 0 : def.anim || 0,
          fires: isLoot ? 0 : def.fires || 0,
          nextShot: now() + rand(3000, 8000),
        });
      }
    }
  }

  // Harder/tougher bricks bias toward the TOP rows; easy ones toward the bottom.
  function pickBrickType(lv, row) {
    const pool = [];
    for (const [k, v] of Object.entries(BRICKS)) {
      if (lv < v.minLevel) continue;
      let w = v.weight;
      if (v.hp >= 3 && row > 1) w = Math.max(1, Math.floor(w / 2)); // tough bricks rarer low down
      for (let i = 0; i < w; i++) pool.push(k);
    }
    return pool[randI(0, pool.length - 1)] || "popup";
  }

  function spawnBoss(lv) {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    const num = bossCount.current + 1;
    const maxHp = BOSS_BASE_HP * num + (lv - LEVELS_PER_BOSS) * 2;
    boss.current = { x: W / 2, y: -120, w: Math.min(170, W * 0.46), hp: maxHp, maxHp, num, dir: 1, t: 0, nextShot: now() + 2200, entering: true };
  }

  // ── inventory ──────────────────────────────────────────────────────────────
  function syncInv() {
    // Build the render mirror: only slots the player has ever acquired (`seen`).
    const order = ITEM_ORDER.filter((id) => inv.current.seen[id]);
    const counts = {};
    const active = {};
    const t = now();
    for (const id of ITEM_ORDER) {
      counts[id] = inv.current.counts[id] || 0;
      const exp = inv.current.active[id] || 0;
      active[id] = exp > t ? exp : 0;
    }
    setInvView({ order, counts, active, cap: stackCap(level.current) });
  }

  // x,y = where the crate was broken, so the pickup label floats up from there.
  function awardItem(id, x, y) {
    const fx = x ?? paddle.current.x;
    const fy = y ?? paddleY() - 40;
    const cap = stackCap(level.current);
    const cur = inv.current.counts[id] || 0;
    const firstSeen = !inv.current.seen[id];
    inv.current.seen[id] = true; // slot becomes visible even if we can't add (so they know it exists)
    if (cur >= cap) {
      // slot full → loot skipped
      addFloat(fx, fy, `${ITEMS[id].name} FULL`, T.silver);
      syncInv();
      return false;
    }
    inv.current.counts[id] = cur + 1;
    SFX.item();
    addFloat(fx, fy, `+${ITEMS[id].name}`, ITEMS[id].color);
    if (firstSeen) addFloat(fx, fy - 22, "NEW ITEM!", ITEMS[id].color);
    syncInv();
    return true;
  }

  function useItem(id) {
    if (phase !== "running") return;
    if ((inv.current.counts[id] || 0) <= 0) return;
    inv.current.counts[id] -= 1;
    const def = ITEMS[id];
    SFX.use(def.color);
    const t = now();
    if (id === "forkbomb") {
      // split every active (non-stuck) ball into +2, capped
      const extra = [];
      for (const b of balls.current) {
        if (b.stuck) continue;
        for (let k = 0; k < 2; k++) {
          if (balls.current.length + extra.length >= ENTITY_CAP.balls) break;
          const ang = rand(-0.6, 0.6);
          const s = Math.hypot(b.vx, b.vy) || ballSpeed();
          extra.push({ id: uid(), x: b.x, y: b.y, vx: Math.sin(ang) * s, vy: -Math.abs(Math.cos(ang) * s), r: b.r, stuck: false, pierce: b.pierce });
        }
      }
      balls.current = balls.current.concat(extra);
      addFloat(paddle.current.x, paddleY() - 40, "FORK BOMB!", def.color);
    } else if (id === "firewall") {
      inv.current.active.firewall = t + def.dur;
      SFX.shield();
    } else if (id === "buffering") {
      inv.current.active.buffering = t + def.dur;
    } else if (id === "broadband") {
      inv.current.active.broadband = t + def.dur;
    } else if (id === "overclock") {
      inv.current.active.overclock = t + def.dur;
      for (const b of balls.current) b.pierce = true;
    }
    syncInv();
  }

  const isActive = (id) => (inv.current.active[id] || 0) > now();

  // ── main loop ────────────────────────────────────────────────────────────
  const loopRef = useRef();
  function loop(ts) {
    loopRef.current(ts);
  }
  loopRef.current = (ts) => {
    const t = ts || now();
    const prev = lastFrame.current || t;
    let dt = (t - prev) / 1000;
    lastFrame.current = t;
    if (dt > 0.05) dt = 0.05;

    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    const H = box?.height || 600;
    const slow = isActive("buffering") ? 0.5 : 1;
    const shield = isActive("firewall");
    const wide = isActive("broadband");
    const pierce = isActive("overclock");
    const py = H * PADDLE_Y_FRAC;

    // paddle width (broadband) + movement
    paddle.current.w = wide ? PADDLE_W_WIDE : PADDLE_W;
    const pad = paddle.current;
    if (keys.current.left) pad.targetX -= 560 * dt;
    if (keys.current.right) pad.targetX += 560 * dt;
    pad.targetX = clamp(pad.targetX, pad.w / 2, W - pad.w / 2);
    pad.x = lerp(pad.x, pad.targetX, Math.min(1, dt * 18));
    pad.x = clamp(pad.x, pad.w / 2, W - pad.w / 2);

    // ── balls ──
    const liveBalls = [];
    for (const b of balls.current) {
      if (b.stuck) {
        b.x = pad.x;
        b.y = py - 22;
        liveBalls.push(b);
        continue;
      }
      // overclock pierce flag tracks the active window
      b.pierce = pierce;
      const sp = slow;
      b.x += b.vx * dt * sp;
      b.y += b.vy * dt * sp;

      // short fast-fading trail (a few ghost dots that vanish in a fraction of a
      // second) — replaces the iOS filter-smear with a controlled effect.
      b.trailAt = (b.trailAt || 0) + 1;
      if (b.trailAt % 2 === 0) spawnSpark(b.x, b.y, b.pierce ? "trailp" : "trail");

      // walls
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); SFX.wall(); }
      else if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); SFX.wall(); }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); SFX.wall(); }

      // paddle
      if (b.vy > 0 && b.y + b.r >= py && b.y - b.r <= py + 16 && Math.abs(b.x - pad.x) <= pad.w / 2 + b.r) {
        const off = clamp((b.x - pad.x) / (pad.w / 2), -1, 1); // -1..1 across paddle
        const s = ballSpeed();
        const ang = off * 1.05; // up to ~60°
        b.vx = Math.sin(ang) * s;
        b.vy = -Math.cos(ang) * s;
        b.y = py - b.r - 1;
        SFX.paddle();
      }

      // boss collision
      if (boss.current && !boss.current.entering) {
        const bo = boss.current;
        if (Math.abs(b.x - bo.x) < bo.w / 2 + b.r && Math.abs(b.y - bo.y) < bo.w / 2 + b.r) {
          bo.hp -= 1;
          spawnSpark(b.x, b.y, "hit");
          SFX.bossHit();
          if (!b.pierce) {
            // reflect off boss center
            const dx = b.x - bo.x, dy = b.y - bo.y;
            if (Math.abs(dx) > Math.abs(dy)) b.vx = Math.sign(dx) * Math.abs(b.vx);
            else b.vy = Math.sign(dy) * Math.abs(b.vy);
          }
        }
      }

      // brick collisions (resolve at most one per frame for a clean bounce)
      hitBricks(b);

      // fell past the paddle?
      if (b.y - b.r > H) {
        if (shield) {
          // force-field bounces it back up instead of losing it
          b.y = py - b.r - 1;
          b.vy = -Math.abs(b.vy);
          spawnSpark(b.x, py, "shield");
          SFX.shield();
        } else {
          continue; // lost
        }
      }
      liveBalls.push(b);
    }
    balls.current = liveBalls;

    // out of balls → drain connection + respawn (unless game over)
    if (balls.current.length === 0 && phase === "running") {
      conn.current = clamp(conn.current - MISS_DRAIN, 0, 100);
      combo.current = 0;
      hitFlash.current = t;
      SFX.miss();
      if (conn.current > 0) spawnBall(true);
    }

    // ── bricks: missile fire ──
    if (mode.current === "wall") {
      for (const br of bricks.current) {
        if (br.loot || !br.fires) continue;
        if (t > br.nextShot) {
          br.nextShot = t + br.fires * rand(0.8, 1.4);
          if (missiles.current.length < ENTITY_CAP.missiles) {
            missiles.current.push({ id: uid(), x: br.x, y: br.y + br.h / 2, vx: 0, vy: 200, w: 10, hostile: true });
          }
        }
      }
    }

    // ── boss ──
    if (boss.current) updateBoss(t, dt, W, H, slow);

    // ── missiles ──
    const liveM = [];
    for (const m of missiles.current) {
      m.x += m.vx * dt * slow;
      m.y += m.vy * dt * slow;
      if (m.y > H + 30 || m.y < -40 || m.x < -30 || m.x > W + 30) continue;
      if (m.hostile) {
        // shield deflect → ricochet upward as a friendly projectile that hurts bricks
        if (shield && m.vy > 0 && m.y + m.w >= py - 6 && Math.abs(m.x - pad.x) <= pad.w / 2 + m.w) {
          m.hostile = false;
          m.vy = -260;
          m.vx = rand(-120, 120);
          spawnSpark(m.x, py, "shield");
          SFX.shield();
          liveM.push(m);
          continue;
        }
        // hit the paddle?
        if (Math.abs(m.x - pad.x) <= pad.w / 2 + m.w && Math.abs(m.y - py) <= 14) {
          conn.current = clamp(conn.current - MISSILE_DRAIN, 0, 100);
          combo.current = 0;
          hitFlash.current = t;
          SFX.hurt();
          spawnSpark(m.x, m.y, "hit");
          continue;
        }
      } else {
        // ricocheted missile damages bricks / boss
        let consumed = false;
        for (const br of bricks.current) {
          if (Math.abs(m.x - br.x) < br.w / 2 + m.w && Math.abs(m.y - br.y) < br.h / 2 + m.w) {
            damageBrick(br, 1, m.x, m.y);
            consumed = true;
            break;
          }
        }
        if (consumed) continue;
        if (boss.current && !boss.current.entering && Math.abs(m.x - boss.current.x) < boss.current.w / 2 && Math.abs(m.y - boss.current.y) < boss.current.w / 2) {
          boss.current.hp -= 1;
          spawnSpark(m.x, m.y, "hit");
          SFX.bossHit();
          continue;
        }
      }
      liveM.push(m);
    }
    missiles.current = liveM;

    // prune dead bricks now (damageBrick marks hp<=0)
    bricks.current = bricks.current.filter((br) => br.hp > 0);

    // ── level clear? ──
    if (mode.current === "wall" && bricks.current.length === 0 && phase === "running") {
      level.current += 1;
      buildLevel(level.current);
      syncInv();
    }

    // expire transient effects + refresh inventory active windows for render.
    // Trails live only ~150ms (a fraction of a second); other sparks ~480ms.
    floats.current = floats.current.filter((f) => t - f.born < 850);
    sparks.current = sparks.current.filter((s) => t - s.born < ((s.kind === "trail" || s.kind === "trailp") ? 150 : 480));
    refreshActive(t);

    if (conn.current <= 0) {
      endRun();
      return;
    }
    tick();
    raf.current = requestAnimationFrame(loop);
  };

  // Resolve ball↔brick collision (one brick per frame). Reflects on the shallower
  // axis unless the ball is piercing (overclock), which plows straight through.
  function hitBricks(b) {
    for (const br of bricks.current) {
      if (br.hp <= 0) continue;
      const dx = Math.abs(b.x - br.x);
      const dy = Math.abs(b.y - br.y);
      if (dx < br.w / 2 + b.r && dy < br.h / 2 + b.r) {
        const dmg = b.pierce ? 99 : 1;
        damageBrick(br, dmg, b.x, b.y);
        if (!b.pierce) {
          // bounce: pick axis by overlap depth
          const ox = br.w / 2 + b.r - dx;
          const oy = br.h / 2 + b.r - dy;
          if (ox < oy) b.vx = b.x < br.x ? -Math.abs(b.vx) : Math.abs(b.vx);
          else b.vy = b.y < br.y ? -Math.abs(b.vy) : Math.abs(b.vy);
          return; // one brick per frame for a clean bounce
        }
      }
    }
  }

  function damageBrick(br, dmg, x, y) {
    if (br.hp <= 0) return;
    if (br.loot) {
      // crate: always pops in one hit, awards loot immediately
      br.hp = 0;
      const id = rollLoot(level.current);
      spawnSpark(br.x, br.y, "kill");
      SFX.pop(combo.current);
      awardItem(id, br.x, br.y);
      return;
    }
    br.hp -= dmg;
    if (br.hp > 0) {
      spawnSpark(x, y, "hit");
      SFX.brick();
    } else {
      combo.current += 1;
      const mult = combo.current >= 4 ? Math.min(1 + (combo.current - 3) * 0.15, 3) : 1;
      const pts = Math.round((BRICKS[br.type]?.score || 100) * mult);
      score.current += pts;
      addFloat(br.x, br.y, `+${pts}`, mult > 1 ? T.yellow : T.cyan);
      spawnSpark(br.x, br.y, "kill");
      SFX.pop(combo.current);
    }
  }

  function updateBoss(t, dt, W, H, slow) {
    const bo = boss.current;
    bo.t += dt;
    if (bo.entering) {
      bo.y = lerp(bo.y, 130, Math.min(1, dt * 3));
      if (bo.y > 124) bo.entering = false;
      return;
    }
    // roam: drift horizontally + gentle vertical bob
    bo.x += bo.dir * 90 * dt * slow;
    if (bo.x < bo.w / 2 + 8) { bo.x = bo.w / 2 + 8; bo.dir = 1; }
    if (bo.x > W - bo.w / 2 - 8) { bo.x = W - bo.w / 2 - 8; bo.dir = -1; }
    bo.y = 130 + Math.sin(bo.t * 1.1) * 26;

    // boss fan-fire — the BSOD boss fights ALONE (no minions). Keep the volley
    // small and dodgeable: 1–3 slow shots on a long interval, scaling very gently
    // with boss number, so an early boss is fair even without items.
    if (t > bo.nextShot) {
      bo.nextShot = t + rand(1800, 2600);
      const n = Math.min(1 + Math.floor(bo.num / 2), 3); // 1 → 2 → 3 across bosses
      for (let i = 0; i < n; i++) {
        if (missiles.current.length >= ENTITY_CAP.missiles) break;
        const ang = Math.PI / 2 + (i - (n - 1) / 2) * 0.34;
        missiles.current.push({ id: uid(), x: bo.x, y: bo.y + bo.w / 2, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150, w: 11, hostile: true, boss: true });
      }
    }

    if (bo.hp <= 0) {
      bossCount.current += 1;
      const reward = 2000 * bo.num;
      score.current += reward;
      addFloat(bo.x, bo.y, `BOSS DOWN +${reward.toLocaleString()}`, T.yellow);
      for (let i = 0; i < 14; i++) spawnSpark(bo.x + rand(-bo.w / 2, bo.w / 2), bo.y + rand(-bo.w / 2, bo.w / 2), "kill");
      SFX.bossDie();
      stopBossLoop();
      boss.current = null;
      missiles.current = [];
      level.current += 1;
      buildLevel(level.current); // rebuilds bricks/balls for the next level
      syncInv();
    }
  }

  // Refresh the render mirror's active timers (so chips show live countdowns) and
  // clear the overclock pierce flag when its window ends.
  const lastActiveSig = useRef("");
  function refreshActive(t) {
    let sig = "";
    for (const id of ITEM_ORDER) {
      const exp = inv.current.active[id] || 0;
      sig += exp > t ? "1" : "0";
    }
    if (sig !== lastActiveSig.current) {
      lastActiveSig.current = sig;
      syncInv();
    }
  }

  // ── input ────────────────────────────────────────────────────────────────
  function moveToClientX(clientX) {
    const box = arena.current?.getBoundingClientRect();
    if (!box) return;
    paddle.current.targetX = clamp(clientX - box.left, paddle.current.w / 2, box.width - paddle.current.w / 2);
  }
  function onPointerDown(e) {
    if (phase !== "running") return;
    dragging.current = true;
    moveToClientX(e.clientX);
    if (launchPending.current) launchBall();
  }
  function onPointerMove(e) {
    if (!dragging.current || phase !== "running") return;
    moveToClientX(e.clientX);
  }
  function onPointerUp() {
    dragging.current = false;
  }

  useEffect(() => {
    function down(e) {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.current.left = true;
      else if (k === "arrowright" || k === "d") keys.current.right = true;
      else if (k === " " || k === "spacebar") { if (launchPending.current) launchBall(); }
      else if (k >= "1" && k <= "5") {
        const id = invView.order[Number(k) - 1];
        if (id) useItem(id);
      }
    }
    function up(e) {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.current.left = false;
      else if (k === "arrowright" || k === "d") keys.current.right = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invView.order]);

  useEffect(() => {
    return () => { cancelAnimationFrame(raf.current); stopBossLoop(); };
  }, []);

  // ── render ───────────────────────────────────────────────────────────────
  const pct = Math.round(conn.current);
  const bc = barColor(pct);
  const t = now();
  const hurt = t - hitFlash.current < 260;
  const shieldOn = isActive("firewall");
  const slowOn = isActive("buffering");
  const wideOn = isActive("broadband");
  const overOn = isActive("overclock");
  const bo = boss.current;

  return (
    <div className="md-root">
      <div className="md-crt" />
      {hurt && <div className="md-breach" />}
      {slowOn && <div className="md-slow" />}
      {shieldOn && <div className="md-shielded" />}

      {/* ── HUD ── */}
      <div className="md-hud">
        <button className="md-back" onPointerDown={(e) => { e.stopPropagation(); onExit(); }}>←</button>
        <div className="md-hud-mid">
          <div className="md-meter">
            <div className="md-meter-fill" style={{ width: `${pct}%`, background: bc, boxShadow: `0 0 10px ${bc}` }} />
            <span className="md-meter-label">📡 {pct}% · BAUD</span>
          </div>
        </div>
        <div className="md-hud-right">
          {combo.current >= 4 && <span className="md-combo">×{Math.min(1 + (combo.current - 3) * 0.15, 3).toFixed(1)}</span>}
          <span className="md-wave">LVL {level.current}</span>
          <span className="md-score">{score.current.toLocaleString()}</span>
        </div>
      </div>

      {/* ── boss HP bar ── */}
      {bo && !bo.entering && (
        <div className="md-bossbar">
          <span className="md-bossbar-label">👾 BSOD #{bo.num}</span>
          <div className="md-bossbar-track">
            <div className="md-bossbar-fill" style={{ width: `${Math.max(0, (bo.hp / bo.maxHp) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── arena ── */}
      <div
        className="md-arena"
        ref={arena}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* boss */}
        {bo && (
          <img className="md-boss" src={sprite("boss.webp")} alt="" draggable={false} style={{ left: bo.x, top: bo.y, width: bo.w, transform: "translate(-50%,-50%)" }} />
        )}

        {/* bricks */}
        {phase === "running" &&
          bricks.current.map((br) =>
            br.loot ? (
              <div key={br.id} className="md-brick md-loot" style={{ left: br.x, top: br.y, width: br.w, height: br.h, transform: "translate(-50%,-50%)" }}>
                <img className="md-loot-img" src={sprite("loot.webp")} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "inline"; }} />
                <span className="md-loot-fallback" style={{ display: "none" }}>🎁</span>
              </div>
            ) : (
              <div key={br.id} className="md-brick" style={{ left: br.x, top: br.y, width: br.w, height: br.h, transform: "translate(-50%,-50%)" }}>
                <img className={br.type === "virus" ? "md-virus-blob" : undefined} src={sprite(br.art)} alt="" draggable={false} style={{ width: br.w }} />
                {br.maxHp > 1 && br.hp < br.maxHp && <span className="md-ehp"><span style={{ width: `${(br.hp / br.maxHp) * 100}%` }} /></span>}
              </div>
            )
          )}

        {/* missiles */}
        {missiles.current.map((m) => (
          <span key={m.id} className={`md-missile${m.hostile ? "" : " md-missile-friendly"}${m.boss ? " md-missile-boss" : ""}`} style={{ left: m.x, top: m.y, width: m.w, height: m.w * 1.6 }} />
        ))}

        {/* balls */}
        {balls.current.map((b) => (
          <span key={b.id} className={`md-ball${b.pierce ? " md-ball-pierce" : ""}`} style={{ left: b.x, top: b.y, width: b.r * 2, height: b.r * 2 }}>
            <img className="md-ball-img" src={sprite("ball.webp")} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.classList.add("md-ball-fallback"); }} />
          </span>
        ))}

        {/* paddle */}
        {(phase === "running" || phase === "countdown") && (
          <div className={`md-paddle${hurt ? " md-paddle-hit" : ""}${shieldOn ? " md-paddle-shield" : ""}${wideOn ? " md-paddle-wide" : ""}${overOn ? " md-paddle-over" : ""}`} style={{ left: paddle.current.x, top: `${PADDLE_Y_FRAC * 100}%`, width: paddle.current.w }}>
          <img src={sprite("player.webp")} alt="" draggable={false} />
          </div>
        )}

        {/* score floats */}
        {floats.current.map((f) => (
          <span key={f.id} className="md-float" style={{ left: f.x, top: f.y, color: f.color, textShadow: `0 0 8px ${f.color}` }}>{f.text}</span>
        ))}

        {/* sparks */}
        {sparks.current.map((s) => (
          <span key={s.id} className={`md-spark md-spark-${s.kind}`} style={{ left: s.x, top: s.y }} />
        ))}

        {/* launch hint */}
        {phase === "running" && launchPending.current && (
          <div className="md-launch-hint">tap / space / drag to launch ⬆</div>
        )}

        {/* ── inventory slots (only those acquired; pop in on first award) ── */}
        {phase === "running" && invView.order.length > 0 && (
          <div className="md-inv">
            {invView.order.map((id, i) => {
              const def = ITEMS[id];
              const active = invView.active[id] > t;
              const remain = active ? Math.ceil((invView.active[id] - t) / 1000) : 0;
              return (
                <button
                  key={id}
                  className={`md-slot md-pop${active ? " md-slot-active" : ""}${invView.counts[id] > 0 ? "" : " md-slot-empty"}`}
                  style={{ "--ic": def.color }}
                  onPointerDown={(e) => { e.stopPropagation(); useItem(id); }}
                >
                  <span className="md-slot-key">{i + 1}</span>
                  <span className="md-slot-badge">
                    <img src={sprite(def.badge)} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "inline"; }} />
                    <span className="md-slot-emoji" style={{ display: "none" }}>{def.emoji}</span>
                  </span>
                  <span className="md-slot-name">{def.name}</span>
                  <span className="md-slot-pips">
                    {Array.from({ length: invView.cap }).map((_, k) => (
                      <i key={k} className={k < (invView.counts[id] || 0) ? "on" : ""} />
                    ))}
                  </span>
                  {active && <span className="md-slot-timer">{remain}s</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── countdown ── */}
        {phase === "countdown" && (
          <div className="md-overlay"><div className="md-count">{count <= 0 ? "GO!" : count}</div></div>
        )}

        {/* ── start ── */}
        {phase === "start" && (
          <div className="md-overlay md-start">
            <img className="md-logo" src={ui("logo.webp")} alt="Modem Defender" draggable={false} />
            <p className="md-tag">Bounce the data packet with your modem, smash the web wall, grab loot from the 🎁 crates. Clear each level — survive the BSOD bosses every 5th. Drop the ball and your signal bleeds out.</p>
            <div className="md-legend">
              <span>🛡️ firewall</span><span>🍴 fork bomb</span><span>⏳ buffering</span><span>📡 broadband</span><span>⚡ overclock</span>
            </div>
            <button className="md-btn" onPointerDown={(e) => { e.stopPropagation(); setPhase("countdown"); }}>CONNECT ▶</button>
            <div className="md-best">BEST: {(best || loadBest() || 0).toLocaleString()}</div>
          </div>
        )}

        {/* ── game over ── */}
        {phase === "over" && (
          <div className="md-overlay md-over">
            <img className="md-stamp" src={ui("no-carrier.webp")} alt="NO CARRIER" draggable={false} />
            {score.current >= (best || 0) && score.current > 0 && <div className="md-newbest">★ NEW BEST ★</div>}
            <div className="md-final">{score.current.toLocaleString()}</div>
            <div className="md-best">BEST: {saveBest(score.current).toLocaleString()} · reached level {level.current}</div>
            <div className="md-btns">
              <button className="md-btn" onPointerDown={(e) => { e.stopPropagation(); setPhase("countdown"); }}>RECONNECT</button>
              <button className="md-btn md-btn-ghost" onPointerDown={(e) => { e.stopPropagation(); onExit(); }}>MENU</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── scoped styles ─────────────────────────────────────────────────────────── */
export const MD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Share+Tech+Mono&display=swap');
.md-root{position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,#10122a,#08080f 70%);overflow:hidden;font-family:'Share Tech Mono',monospace;user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;}
.md-crt{position:absolute;inset:0;pointer-events:none;z-index:50;background:repeating-linear-gradient(0deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18) 1px,transparent 2px,transparent 3px);mix-blend-mode:multiply;opacity:0.5;}
.md-crt::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 55%,rgba(0,0,0,0.55));}
.md-breach{position:absolute;inset:0;pointer-events:none;z-index:40;animation:mdBreach 0.26s ease-out;box-shadow:inset 0 0 120px 20px rgba(255,45,85,0.5);}
.md-slow{position:absolute;inset:0;pointer-events:none;z-index:39;box-shadow:inset 0 0 140px 30px rgba(63,255,208,0.16);}
.md-shielded{position:absolute;inset:0;pointer-events:none;z-index:39;box-shadow:inset 0 0 120px 24px rgba(48,209,88,0.18);}
@keyframes mdBreach{0%{opacity:1}100%{opacity:0}}

.md-hud{position:absolute;top:0;left:0;right:0;height:54px;display:flex;align-items:center;gap:8px;padding:0 10px;z-index:100;background:linear-gradient(#0f0f1eee,transparent);border-bottom:1px solid #ffffff10;}
.md-back{background:#ffffff08;border:1px solid #ffffff18;color:#ffffff66;padding:6px 11px;border-radius:5px;font-family:'Share Tech Mono';font-size:13px;cursor:pointer;flex-shrink:0;}
.md-hud-mid{flex:1;min-width:0;}
.md-meter{position:relative;height:20px;border:2px solid #ffffff22;border-radius:5px;background:#05050c;overflow:hidden;box-shadow:inset 0 0 8px #000;}
.md-meter-fill{position:absolute;left:0;top:0;bottom:0;transition:width 0.18s linear,background 0.4s;}
.md-meter-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:1px;color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;}
.md-hud-right{display:flex;align-items:center;gap:9px;flex-shrink:0;}
.md-combo{font-family:'Black Ops One';font-size:12px;color:#ffd60a;text-shadow:0 0 8px #ffd60a;animation:mdPulse 0.5s infinite;}
.md-wave{font-size:9px;letter-spacing:1px;color:#ffffff44;}
.md-score{font-family:'Black Ops One';font-size:20px;color:#3fffd0;text-shadow:0 0 10px #3fffd0;min-width:50px;text-align:right;}
@keyframes mdPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.94)}}

.md-bossbar{position:absolute;top:56px;left:10px;right:10px;z-index:95;display:flex;align-items:center;gap:8px;}
.md-bossbar-label{font-family:'Black Ops One';font-size:10px;color:#bf5af2;text-shadow:0 0 8px #bf5af2;white-space:nowrap;}
.md-bossbar-track{flex:1;height:12px;background:#1a0a22;border:1px solid #bf5af255;border-radius:4px;overflow:hidden;box-shadow:inset 0 0 6px #000;}
.md-bossbar-fill{height:100%;background:linear-gradient(90deg,#bf5af2,#ff2d55);box-shadow:0 0 10px #bf5af2;transition:width 0.12s linear;}

.md-arena{position:absolute;top:54px;left:0;right:0;bottom:0;z-index:10;}
.md-boss{position:absolute;z-index:7;filter:drop-shadow(0 0 16px rgba(191,90,242,0.55));pointer-events:none;}

.md-brick{position:absolute;pointer-events:none;display:flex;align-items:center;justify-content:center;animation:mdPopIn 0.2s cubic-bezier(0.34,1.56,0.64,1);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));}
.md-brick img{display:block;pointer-events:none;}
@keyframes mdPopIn{0%{transform:translate(-50%,-50%) scale(0);opacity:0}70%{transform:translate(-50%,-50%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1)}}
/* Virus = single static sprite, animated with a gentle organic wobble + squash
   (jelly blob). Pure CSS transform on the img; transform-origin bottom-center so it
   jiggles like it's anchored. Replaces the old 4-frame strip entirely. */
.md-virus-blob{transform-origin:50% 90%;animation:mdWobble 1.2s ease-in-out infinite;}
@keyframes mdWobble{
  0%{transform:rotate(-5deg) scale(1,1)}
  25%{transform:rotate(0deg) scale(1.08,0.92)}
  50%{transform:rotate(5deg) scale(1,1)}
  75%{transform:rotate(0deg) scale(0.94,1.06)}
  100%{transform:rotate(-5deg) scale(1,1)}
}
.md-ehp{position:absolute;left:8%;right:8%;bottom:-5px;height:3px;background:#ffffff22;border-radius:2px;overflow:hidden;}
.md-ehp span{display:block;height:100%;background:#ff2d55;box-shadow:0 0 4px #ff2d55;}
.md-loot{animation:mdPopIn 0.2s cubic-bezier(0.34,1.56,0.64,1),mdLootGlow 1.2s ease-in-out infinite;}
.md-loot-img{width:100%;height:100%;object-fit:contain;}
.md-loot-fallback{position:absolute;font-size:20px;}
@keyframes mdLootGlow{0%,100%{filter:drop-shadow(0 0 4px #ffd60a)}50%{filter:drop-shadow(0 0 12px #ffd60a)}}

/* The sprite carries the look. No filter/box-shadow on the ball itself: a glow
   filter on an element repositioned every frame smears into trails on iOS Safari
   (the diagonal streaks). The fast-fading trail dots provide the motion glow
   instead. A solid gradient fill is the fallback only when the sprite is missing. */
.md-ball{position:absolute;transform:translate(-50%,-50%);z-index:13;border-radius:50%;pointer-events:none;}
.md-ball-img{width:100%;height:100%;object-fit:contain;}
.md-ball-pierce{filter:hue-rotate(-40deg) saturate(1.4);}
.md-ball-fallback{background:radial-gradient(circle at 35% 30%,#fff,#3fffd0 55%,#0a84ff 90%);box-shadow:0 0 10px #3fffd0,0 0 4px #fff;}
.md-ball-fallback.md-ball-pierce{background:radial-gradient(circle at 35% 30%,#fff,#ffd60a 50%,#ff2d55 90%);}

.md-missile{position:absolute;transform:translate(-50%,-50%);border-radius:3px;background:linear-gradient(#ff2d55,#ff8a3d);box-shadow:0 0 8px #ff2d55;pointer-events:none;z-index:11;}
.md-missile-friendly{background:linear-gradient(#3fffd0,#0a84ff);box-shadow:0 0 8px #3fffd0;}
.md-missile-boss{background:linear-gradient(#bf5af2,#ff2d55);box-shadow:0 0 9px #bf5af2;}

.md-paddle{position:absolute;transform:translate(-50%,-50%);z-index:14;pointer-events:none;will-change:left;display:flex;align-items:center;justify-content:center;transition:width 0.18s;}
.md-paddle img{width:100%;height:auto;display:block;filter:drop-shadow(0 0 10px rgba(63,255,208,0.5));}
.md-paddle-hit img{animation:mdShake 0.26s ease;filter:drop-shadow(0 0 12px #ff2d55) brightness(1.3);}
/* Shield ring wraps the modem's actual footprint. The paddle div tightly bounds
   the sprite (width = paddle.w, height = sprite aspect), so sizing the ellipse to
   a % of the div and centering on it hugs the modem regardless of the art's
   internal asymmetry — and scales correctly when Broadband widens the paddle. */
.md-paddle-shield::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:122%;height:128%;border-radius:50%;border:2px solid #30d158;box-shadow:0 0 16px #30d158,inset 0 0 14px #30d15866;animation:mdPulse 0.7s infinite;}
.md-paddle-wide img{filter:drop-shadow(0 0 12px #0a84ff);}
.md-paddle-over img{filter:drop-shadow(0 0 12px #ffd60a);}

.md-float{position:absolute;transform:translate(-50%,-50%);font-family:'Black Ops One';font-size:15px;pointer-events:none;z-index:60;animation:mdFloat 0.85s ease-out forwards;white-space:nowrap;}
@keyframes mdFloat{0%{transform:translate(-50%,-50%);opacity:1}100%{transform:translate(-50%,-150%);opacity:0}}
.md-spark{position:absolute;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;pointer-events:none;z-index:55;}
.md-spark-hit{background:radial-gradient(circle,#fff,#3fffd0 50%,transparent 70%);animation:mdSpark 0.3s ease-out forwards;}
.md-spark-kill{background:radial-gradient(circle,#fff,#ffd60a 45%,transparent 70%);box-shadow:0 0 14px #ffd60a;animation:mdSpark 0.42s ease-out forwards;}
.md-spark-shield{background:radial-gradient(circle,#fff,#30d158 45%,transparent 70%);box-shadow:0 0 12px #30d158;animation:mdSpark 0.36s ease-out forwards;}
/* ball trail: small dot behind the ball that fades + shrinks within ~150ms */
.md-spark-trail{z-index:12;width:14px;height:14px;background:radial-gradient(circle,#3fffd0 0%,rgba(63,255,208,0.35) 45%,transparent 70%);animation:mdTrail 0.15s linear forwards;}
.md-spark-trailp{z-index:12;width:16px;height:16px;background:radial-gradient(circle,#ffd60a 0%,rgba(255,45,85,0.4) 45%,transparent 70%);animation:mdTrail 0.15s linear forwards;}
@keyframes mdSpark{0%{transform:translate(-50%,-50%) scale(0.4);opacity:1}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
@keyframes mdTrail{0%{transform:translate(-50%,-50%) scale(1);opacity:0.7}100%{transform:translate(-50%,-50%) scale(0.3);opacity:0}}

.md-launch-hint{position:absolute;left:0;right:0;bottom:90px;text-align:center;color:#ffffff77;font-size:11px;letter-spacing:2px;z-index:30;animation:mdPulse 1.1s infinite;pointer-events:none;}

.md-inv{position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;gap:8px;z-index:70;padding:0 8px;flex-wrap:wrap;}
.md-slot{position:relative;background:#0d0d18cc;border:1.5px solid var(--ic);border-radius:10px;padding:5px 8px 4px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;min-width:58px;transition:transform 0.1s,box-shadow 0.15s,opacity 0.15s;}
.md-pop{animation:mdSlotPop 0.42s cubic-bezier(0.34,1.7,0.5,1);}
@keyframes mdSlotPop{0%{transform:translateY(14px) scale(0.2);opacity:0}60%{transform:translateY(0) scale(1.18);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
.md-slot-empty{opacity:0.4;}
.md-slot-active{box-shadow:0 0 16px var(--ic);border-color:#fff;animation:mdPulse 0.7s infinite;}
.md-slot-key{position:absolute;top:-7px;left:-6px;background:var(--ic);color:#08080f;font-family:'Black Ops One';font-size:9px;width:15px;height:15px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.md-slot-badge{width:26px;height:26px;display:flex;align-items:center;justify-content:center;}
.md-slot-badge img{width:100%;height:100%;object-fit:contain;}
.md-slot-emoji{font-size:20px;line-height:1;}
.md-slot-name{font-size:7px;letter-spacing:0.5px;color:var(--ic);}
.md-slot-pips{display:flex;gap:2px;margin-top:1px;}
.md-slot-pips i{width:6px;height:6px;border-radius:50%;background:#ffffff22;}
.md-slot-pips i.on{background:var(--ic);box-shadow:0 0 5px var(--ic);}
.md-slot-timer{position:absolute;top:-8px;right:-6px;background:#08080f;border:1px solid var(--ic);color:var(--ic);font-size:8px;padding:1px 3px;border-radius:6px;}

.md-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:80;background:rgba(8,8,15,0.72);text-align:center;padding:20px;}
.md-count{font-family:'Black Ops One';font-size:96px;color:#3fffd0;text-shadow:0 0 30px #3fffd0,0 0 60px #3fffd055;animation:mdCount 0.55s ease;}
@keyframes mdCount{0%{transform:scale(1.7);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}
.md-logo{width:min(80%,420px);height:auto;filter:drop-shadow(0 4px 18px rgba(63,255,208,0.35));animation:mdPopIn2 0.5s cubic-bezier(0.34,1.56,0.64,1);}
@keyframes mdPopIn2{0%{transform:scale(0.6);opacity:0}100%{transform:scale(1);opacity:1}}
.md-tag{max-width:360px;color:#ffffff99;font-size:12px;line-height:1.5;margin:0;}
.md-legend{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;color:#ffffff66;font-size:11px;}
.md-btn{background:#3fffd018;border:2px solid #3fffd055;color:#3fffd0;padding:11px 26px;border-radius:7px;font-family:'Black Ops One';font-size:14px;letter-spacing:3px;cursor:pointer;text-shadow:0 0 8px #3fffd0;transition:transform 0.1s;}
.md-btn:active{transform:scale(0.95);}
.md-btn-ghost{background:#ffffff0a;border-color:#ffffff33;color:#ffffff88;text-shadow:none;}
.md-btns{display:flex;gap:12px;margin-top:6px;}
.md-best{color:#ffffff44;font-size:11px;letter-spacing:2px;}
.md-stamp{width:min(78%,420px);height:auto;animation:mdShake 0.5s ease;}
@keyframes mdShake{0%{transform:translate(0,0)}20%{transform:translate(-7px,3px)}40%{transform:translate(6px,-4px)}60%{transform:translate(-4px,-3px)}80%{transform:translate(4px,3px)}100%{transform:translate(0,0)}}
.md-final{font-family:'Black Ops One';font-size:60px;color:#ff2d55;text-shadow:0 0 22px #ff2d55;line-height:1;}
.md-newbest{font-family:'Share Tech Mono';font-size:11px;letter-spacing:5px;color:#ffd60a;text-shadow:0 0 8px #ffd60a;animation:mdPulse 0.9s infinite;}
`;

// Standalone cabinet wrapper (mirrors TapSurge.jsx): inject scoped CSS, hide the
// arcade chrome (the game draws its own back button), route onExit → home.
export default function ModemDefenderGame() {
  const navigate = useNavigate();
  useArcadeBackButton(false);
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = MD_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  return (
    <div style={{ width: "100vw", height: "100svh", background: "#08080f", overflow: "hidden", position: "relative" }}>
      <ModemDefender onExit={() => navigate("/")} />
    </div>
  );
}
