import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { playSfx } from "../lib/sfx.js";

/* ═══════════════════════════════════════════════════════════════════════════
   MODEM DEFENDER: NET DEFENSE — a Galaga-style lateral shooter.

   Your 56k modem is locked to the bottom lane; drag (or ←/→) to slide it, and it
   AUTO-FIRES the active weapon upward. The early-2000s web descends in swaying
   formations — pop-ups, banner ads, spam, viruses, a meddling assistant, toolbar
   hijackers — each with its own ATTACK style and its own WEAKNESS. You carry up to
   four weapons (blaster, antivirus beam, spread de-fragger, EMP) and SWAP between
   them (tap a chip / 1-2-3-4); the right counter for what's on screen glows. Every
   few waves a BSOD BOSS drops in: one fat HP bar that keeps SPAWNING MINIONS, so
   you juggle nuking the boss against the adds it floods you with. Each boss has
   more HP than the last. Enemies (and bosses) that slip past the bottom drain your
   CONNECTION; hit 0 → NO CARRIER → game over.

   Architecture (unchanged from the original click-to-zap build): a self-contained
   cabinet — scoped `.md-*` CSS injected once, draws its own back button, one route.
   Rendering is absolutely-positioned DOM nodes driven by a rAF loop with refs
   mirroring state (the Tap Surge / Color Panic family pattern). Live entities live
   in refs; React state is only the coarse phase + a render pump. To stay smooth now
   that there are bullets + minions (not ~15 tappable nodes), every entity pool is
   CAPPED and pruned each frame so the DOM node count is bounded — no Canvas rewrite.
   Scores ride the Arcade Score Standard via useArcadeScore("modem-defender").

   Sound: procedural Web Audio tones (house style) are the always-present base; if
   the matching Kenney sample exists under public/games/kenney/sfx/ it layers on top
   via playSfx() (silent-safe no-op when the file is absent). Custom sprites live
   under public/games/modem-defender/.
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
  navy: "#000080",
  silver: "#c0c0c0",
};

const rand = (a, b) => Math.random() * (b - a) + a;
const randI = (a, b) => Math.floor(rand(a, b + 1));
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = () => performance.now();
const lerp = (a, b, t) => a + (b - a) * t;

/* ── Weapon catalog (data-driven; tune here) ──────────────────────────────────
   id        : key used by enemies' `weakTo`
   name      : HUD label
   emoji     : HUD chip icon
   color     : projectile + chip glow
   cooldown  : ms between shots at level 1 (scaled down per level)
   dmg       : damage per projectile at level 1
   speed     : projectile px/sec (negative vy = upward; set in fire())
   pierce    : how many enemies a shot passes through (1 = stops at first)
   spread    : number of pellets fanned out per shot
   beam      : true = tall fast piercing shot (antivirus)
   charge    : ms to "charge" before it can fire (EMP) — telegraphs a heavy hit
   levels    : multiplier table applied as the weapon upgrades (idx = level-1)
   unlock    : 'start' or the boss number that grants it (1 = after first boss) */
const WEAPONS = {
  blaster: {
    id: "blaster", name: "BLASTER", emoji: "🔫", color: T.cyan,
    cooldown: 200, dmg: 1, speed: 720, pierce: 1, spread: 1, w: 6, h: 16,
    unlock: "start",
    levels: [
      { cd: 1, dmg: 1, spread: 1, pierce: 1 },
      { cd: 0.8, dmg: 1, spread: 1, pierce: 1 },     // faster
      { cd: 0.72, dmg: 1, spread: 2, pierce: 1 },    // twin
      { cd: 0.62, dmg: 2, spread: 2, pierce: 2 },    // piercing twin
    ],
  },
  antivirus: {
    id: "antivirus", name: "ANTIVIRUS", emoji: "🧪", color: T.green,
    cooldown: 420, dmg: 2, speed: 980, pierce: 3, spread: 1, beam: true, w: 10, h: 30,
    unlock: 1,
    levels: [
      { cd: 1, dmg: 2, pierce: 3, w: 1 },
      { cd: 0.85, dmg: 3, pierce: 4, w: 1.4 },
      { cd: 0.72, dmg: 4, pierce: 6, w: 1.8 },
    ],
  },
  spread: {
    id: "spread", name: "DE-FRAG", emoji: "🔱", color: T.yellow,
    cooldown: 360, dmg: 1, speed: 600, pierce: 1, spread: 3, w: 7, h: 12,
    unlock: 2,
    levels: [
      { cd: 1, dmg: 1, spread: 3 },
      { cd: 0.9, dmg: 1, spread: 4 },
      { cd: 0.82, dmg: 2, spread: 5 },
    ],
  },
  emp: {
    id: "emp", name: "EMP", emoji: "💥", color: T.purple,
    cooldown: 900, dmg: 3, speed: 520, pierce: 99, spread: 1, charge: 380, w: 16, h: 22,
    unlock: 3,
    levels: [
      { cd: 1, dmg: 3, charge: 1 },
      { cd: 0.9, dmg: 4, charge: 0.8 },
      { cd: 0.82, dmg: 5, charge: 0.6 },
    ],
  },
};
const WEAPON_ORDER = ["blaster", "antivirus", "spread", "emp"];

/* ── Threat catalog (data-driven; tune balance here) ──────────────────────────
   w        : on-screen width in px
   speed    : descend px/sec (formation entry + dive speed baseline)
   drain    : connection % removed if it reaches the bottom
   score    : points for destroying it
   hp       : damage to kill (default 1)
   minWave  : first wave it can appear
   weight   : relative spawn frequency once unlocked
   art      : sprite file (or null for emoji-rendered)
   weakTo   : weapon id that does FULL damage; others do reduced/zero (see DMG_RULES)
   immuneTo : weapon ids that do ZERO damage (bounce / blocked)
   attack   : behavioural tag the loop reads ('dive' | 'drift' | 'zigzag' | 'shield' | 'armor' | 'swarm')
   fires    : ms cadence of return-fire (0 = never shoots back)
   onHit    : optional side-effect when damaged but not killed ('split')
   onReach  : optional side-effect when it reaches the bottom ('spawnPopups') */
const THREATS = {
  popup: {
    w: 60, speed: 70, drain: 7, score: 100, minWave: 1, weight: 10, art: "popup.webp",
    attack: "swarm", weakTo: null, fires: 0,
  },
  banner: {
    w: 110, speed: 52, drain: 7, score: 120, hp: 3, minWave: 2, weight: 6, art: "banner.webp",
    attack: "drift", weakTo: null, fires: 0,
  },
  spam: {
    w: 56, speed: 96, drain: 6, score: 140, minWave: 2, weight: 7, art: "spam.webp",
    attack: "dive", weakTo: null, fires: 0, onHit: "split",
  },
  virus: {
    w: 58, speed: 120, drain: 14, score: 220, minWave: 3, weight: 6, art: "virus.webp", anim: 4,
    attack: "zigzag", weakTo: "antivirus", immuneTo: ["blaster"], fires: 2600,
  },
  clippy: {
    w: 70, speed: 50, drain: 10, score: 180, hp: 3, minWave: 4, weight: 4, art: "clippy.webp",
    attack: "shield", weakTo: null, fires: 3200, onReach: "spawnPopups",
  },
  toolbar: {
    w: 96, speed: 60, drain: 9, score: 200, hp: 4, minWave: 5, weight: 4, art: "toolbar.webp",
    attack: "armor", weakTo: null, fires: 0,
  },
};

/* Damage rules — how much of a weapon's damage a threat actually takes.
   Returns a multiplier; 0 means "blocked" (shows a deflect spark, teaches by ear/eye).
   - immuneTo weapons → 0 (e.g. blaster vs virus bounces).
   - weakTo weapon → full + a 1.5x bonus (the intended counter).
   - clippy is shielded until EMP strips it; toolbar is front-armored until EMP. */
function damageMult(threat, weaponId) {
  const def = THREATS[threat.type] || {};
  if (def.immuneTo && def.immuneTo.includes(weaponId)) return 0;
  // shielded clippy: only EMP gets through until shield is down
  if (threat.shield && weaponId !== "emp") return 0;
  // front-armored toolbar: blaster/antivirus/spread chip slowly; EMP strips full
  if (def.attack === "armor" && !threat.stripped) {
    if (weaponId === "emp") return 1; // EMP strips + hits
    return 0.34; // chip away from the front
  }
  if (def.weakTo && def.weakTo === weaponId) return 1.5;
  if (def.weakTo && def.weakTo !== weaponId) return 0.5; // wrong tool: half
  return 1;
}

/* ── Power-ups (drifting chips) ───────────────────────────────────────────────
   firewall  : brief invulnerability + clear all enemy bullets
   broadband : slow-mo for a window (great for dodging)
   upgrade   : level up / unlock a weapon — the progression driver */
const POWERUPS = [
  { kind: "firewall", emoji: "🛡️", label: "FIREWALL", color: T.green, dur: 4000 },
  { kind: "broadband", emoji: "⚡", label: "BROADBAND", color: T.cyan, dur: 5000 },
  { kind: "upgrade", emoji: "⬆️", label: "UPGRADE", color: T.yellow, dur: 0 },
];

// Formation / pacing constants.
const WAVES_PER_BOSS = 3; // boss every Nth wave
const BOSS_BASE_HP = 60; // boss #1 HP; scales × boss number
const FORMATION_COLS = 6;
const ENTITY_CAP = { bullets: 90, ebullets: 70, enemies: 40, sparks: 40 };
const POWERUP_EVERY = [11000, 17000]; // ms range between power-up drifts
const PLAYER_Y_FRAC = 0.86; // modem sits this far down the arena
const PLAYER_W = 64;

/* ── Sound (Web Audio procedural base; samples layer on if present) ─────────── */
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
// noise burst (for explosions / EMP)
function noise({ gain = 0.14, dur = 0.18, lp = 1200 } = {}) {
  const c = ctx();
  if (!c) return;
  try {
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = lp;
    const env = c.createGain();
    const t = c.currentTime;
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(env).connect(c.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  } catch {}
}
const SFX = {
  shoot: (wid = "blaster") => {
    if (wid === "antivirus") tone({ freq: 680, gain: 0.05, dur: 0.1, sweep: 1.3, type: "sawtooth" });
    else if (wid === "spread") tone({ freq: 380, gain: 0.05, dur: 0.06, sweep: 0.9, type: "square" });
    else if (wid === "emp") { noise({ gain: 0.1, dur: 0.22, lp: 900 }); tone({ freq: 120, gain: 0.08, dur: 0.25, sweep: 0.4 }); }
    else tone({ freq: 540, gain: 0.045, dur: 0.05, sweep: 0.7, type: "triangle" });
  },
  hit: () => tone({ freq: 300, gain: 0.07, dur: 0.05, sweep: 0.8 }),
  blocked: () => { tone({ freq: 180, gain: 0.06, dur: 0.06, sweep: 1, type: "square" }); },
  kill: (combo = 0) => {
    const base = 420 + combo * 18;
    tone({ freq: base, gain: 0.1, dur: 0.08, sweep: 0.55, type: "triangle" });
    noise({ gain: 0.06, dur: 0.1, lp: 1600 });
    playSfx("confirmation", { volume: 0 }); // warm cache early; real cue is on unlock
  },
  breach: () => {
    tone({ freq: 150, gain: 0.13, dur: 0.16, sweep: 0.5 });
    setTimeout(() => tone({ freq: 95, gain: 0.09, dur: 0.13, sweep: 0.5 }), 90);
  },
  hurt: () => tone({ freq: 220, gain: 0.1, dur: 0.12, sweep: 0.6, type: "sawtooth" }),
  power: () => [523, 659, 880].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.1, dur: 0.1, sweep: 0.85 }), i * 55)),
  swap: () => tone({ freq: 660, gain: 0.06, dur: 0.05, sweep: 1.1, type: "square" }),
  unlock: () => { [523, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.1, dur: 0.12, sweep: 0.9 }), i * 70)); playSfx("confirmation", { volume: 0.6 }); },
  bossIn: () => { tone({ freq: 110, gain: 0.14, dur: 0.4, sweep: 1.4, type: "sawtooth" }); setTimeout(() => tone({ freq: 110, gain: 0.12, dur: 0.4, sweep: 1.4, type: "sawtooth" }), 260); },
  bossHit: () => tone({ freq: 200, gain: 0.08, dur: 0.06, sweep: 0.7, type: "square" }),
  bossDie: () => { noise({ gain: 0.18, dur: 0.6, lp: 800 }); [392, 311, 233, 175].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.12, dur: 0.18, sweep: 0.6 }), i * 110)); },
  wave: () => [392, 523].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.08, dur: 0.12, sweep: 0.9 }), i * 70)),
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

// Weighted random threat type valid for the current wave.
function pickThreatType(wave) {
  const pool = [];
  for (const [k, v] of Object.entries(THREATS)) {
    if (wave >= v.minWave) for (let i = 0; i < v.weight; i++) pool.push(k);
  }
  return pool[randI(0, pool.length - 1)] || "popup";
}

// Connection-bar color by remaining %.
function barColor(pct) {
  if (pct > 55) return T.green;
  if (pct > 25) return T.yellow;
  return T.red;
}

export function ModemDefender({ onExit }) {
  const [phase, setPhase] = useState("start"); // start | countdown | running | over
  const [count, setCount] = useState(3);
  const [, force] = useState(0); // re-render pump for the rAF view
  const tick = useCallback(() => force((n) => (n + 1) & 0xffff), []);

  // Live game state lives in refs (the rAF loop reads/writes these every frame);
  // React state is only the coarse phase + a render pump.
  const enemies = useRef([]); // formation + dive enemies
  const bullets = useRef([]); // player projectiles
  const ebullets = useRef([]); // enemy projectiles
  const boss = useRef(null); // { hp, maxHp, x, y, num, nextMinion, nextShot, dir }
  const floats = useRef([]); // [{ id, x, y, text, color, born }]
  const sparks = useRef([]); // transient CSS spark/shatter bursts
  const powerup = useRef(null); // a single drifting power-up, or null

  const player = useRef({ x: 0, targetX: 0, vx: 0 });
  const arsenal = useRef({ active: "blaster", levels: { blaster: 1 } }); // unlocked → level
  const lastShot = useRef(0); // ts of last player shot
  const chargeUntil = useRef(0); // EMP charge window end

  const score = useRef(0);
  const combo = useRef(0);
  const conn = useRef(100); // connection %
  const wave = useRef(1);
  const bossCount = useRef(0); // how many bosses cleared (drives HP scaling)
  const waveState = useRef("formation"); // formation | clearing | boss | bossClear
  const invUntil = useRef(0); // firewall invulnerability window
  const slowUntil = useRef(0); // broadband slow-mo
  const hitFlash = useRef(0); // ts of last damage-taken pulse

  const startedAt = useRef(0);
  const lastSpawn = useRef(0);
  const spawnQueue = useRef([]); // queued formation spawns for the current wave
  const nextPower = useRef(0);
  const raf = useRef(0);
  const lastFrame = useRef(0);
  const arena = useRef(null);
  const dragging = useRef(false);
  const keys = useRef({ left: false, right: false });
  const [hud, setHud] = useState({ active: "blaster", suggest: null }); // chips need React for layout

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

  function reset() {
    enemies.current = [];
    bullets.current = [];
    ebullets.current = [];
    boss.current = null;
    floats.current = [];
    sparks.current = [];
    powerup.current = null;
    score.current = 0;
    combo.current = 0;
    conn.current = 100;
    wave.current = 1;
    bossCount.current = 0;
    waveState.current = "formation";
    arsenal.current = { active: "blaster", levels: { blaster: 1 } };
    invUntil.current = 0;
    slowUntil.current = 0;
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    player.current = { x: W / 2, targetX: W / 2, vx: 0 };
    setHud({ active: "blaster", suggest: null });
  }

  function beginRun() {
    reset();
    const t = now();
    startedAt.current = t;
    lastSpawn.current = t;
    nextPower.current = t + rand(POWERUP_EVERY[0], POWERUP_EVERY[1]);
    queueWave(1);
    setPhase("running");
    raf.current = requestAnimationFrame(loop);
  }

  function endRun() {
    cancelAnimationFrame(raf.current);
    SFX.breach();
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

  // ── wave / formation building ──────────────────────────────────────────────
  // Build a queue of formation enemies for the wave; each has a grid slot it eases
  // into, then sways and periodically peels off to dive. Boss waves queue the boss.
  function queueWave(w) {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    const isBoss = w % WAVES_PER_BOSS === 0;
    spawnQueue.current = [];
    if (isBoss) {
      waveState.current = "boss";
      spawnBoss(w);
      SFX.bossIn();
      addFloat(W / 2, 90, "⚠ BSOD INCOMING ⚠", T.purple);
      return;
    }
    waveState.current = "formation";
    SFX.wave();
    addFloat(W / 2, 80, `WAVE ${w}`, T.cyan);
    const rows = Math.min(2 + Math.floor(w / 2), 5);
    const cols = FORMATION_COLS;
    const cellW = Math.min(72, (W - 40) / cols);
    const x0 = (W - cellW * (cols - 1)) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = pickThreatType(w);
        spawnQueue.current.push({ type, slotX: x0 + c * cellW, slotY: 70 + r * 56, delay: (r * cols + c) * 90 });
      }
    }
  }

  function spawnFormationEnemy(item) {
    const def = THREATS[item.type];
    if (enemies.current.length >= ENTITY_CAP.enemies) return;
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    enemies.current.push({
      id: uid(),
      type: item.type,
      x: clamp(item.slotX, 30, W - 30),
      y: -def.w,
      slotX: item.slotX,
      slotY: item.slotY,
      w: def.w,
      hp: def.hp || 1,
      maxHp: def.hp || 1,
      art: def.art,
      anim: def.anim || 0,
      score: def.score,
      drain: def.drain,
      speed: def.speed,
      attack: def.attack,
      onReach: def.onReach,
      onHit: def.onHit,
      fires: def.fires || 0,
      nextShot: now() + rand(1200, 3600),
      state: "enter", // enter → formed → diving
      diveT: 0,
      phase: rand(0, Math.PI * 2), // for sway / zigzag
      shield: def.attack === "shield", // clippy starts shielded
      shieldNext: now() + rand(2000, 4000),
      stripped: false, // toolbar armor stripped?
      born: now(),
    });
  }

  // A smaller spam fragment (the split). Inherits a dive state immediately.
  // Returns the entity (the loop buffers these and appends after iterating, so we
  // never push into enemies.current while it's being walked).
  function makeSpamFragment(x, y) {
    const def = THREATS.spam;
    return {
      id: uid(), type: "spam", x, y, slotX: x, slotY: y,
      w: def.w * 0.62, hp: 1, maxHp: 1, art: def.art, anim: 0,
      score: Math.round(def.score * 0.5), drain: Math.ceil(def.drain * 0.5),
      speed: def.speed * 1.25, attack: "dive", fires: 0,
      nextShot: Infinity, state: "diving", diveT: 0, phase: rand(0, 6.28),
      fragment: true, born: now(),
    };
  }

  function spawnBoss(w) {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    const num = bossCount.current + 1;
    const maxHp = BOSS_BASE_HP * num;
    boss.current = {
      x: W / 2, y: -120, w: Math.min(180, W * 0.5),
      hp: maxHp, maxHp, num, dir: 1, t: 0,
      nextMinion: now() + 2600,
      nextShot: now() + 1800,
      entering: true,
    };
  }

  function spawnPowerup() {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    // Bias toward UPGRADE when the player has room to grow, else defensive chips.
    const def = POWERUPS[randI(0, POWERUPS.length - 1)];
    powerup.current = { id: uid(), ...def, x: rand(40, W - 40), y: -40, vy: 80, born: now() };
  }

  // ── firing ─────────────────────────────────────────────────────────────────
  function activeWeapon() {
    const id = arsenal.current.active;
    const lvl = arsenal.current.levels[id] || 1;
    const def = WEAPONS[id];
    const mod = def.levels[Math.min(lvl, def.levels.length) - 1];
    return { def, lvl, mod, id };
  }

  function tryFire(t) {
    const { def, mod, id } = activeWeapon();
    const cd = def.cooldown * (mod.cd || 1);
    if (t - lastShot.current < cd) return;
    // EMP telegraph: a charge window before the heavy shot
    if (def.charge) {
      if (chargeUntil.current === 0) {
        chargeUntil.current = t + def.charge * (mod.charge || 1);
        return;
      }
      if (t < chargeUntil.current) return;
      chargeUntil.current = 0;
    }
    lastShot.current = t;
    const px = player.current.x;
    const py = playerY();
    const spread = mod.spread || def.spread || 1;
    const dmg = (mod.dmg || def.dmg) * 1;
    const wMul = mod.w || 1;
    for (let i = 0; i < spread; i++) {
      if (bullets.current.length >= ENTITY_CAP.bullets) break;
      // fan: center the pellets
      const angOff = spread > 1 ? (i - (spread - 1) / 2) * 0.16 : 0;
      const vx = Math.sin(angOff) * def.speed;
      const vy = -Math.cos(angOff) * def.speed;
      bullets.current.push({
        id: uid(), x: px, y: py - 18, vx, vy,
        w: def.w * (def.beam ? wMul : 1), h: def.h * (def.beam ? wMul : 1),
        dmg, pierce: mod.pierce || def.pierce || 1, hits: [], weapon: id, color: def.color,
        beam: !!def.beam, emp: !!def.charge,
      });
    }
    SFX.shoot(id);
  }

  function playerY() {
    const box = arena.current?.getBoundingClientRect();
    return (box?.height || 600) * PLAYER_Y_FRAC;
  }

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
    const slow = t < slowUntil.current ? 0.5 : 1;
    const inv = t < invUntil.current;
    const py = H * PLAYER_Y_FRAC;

    // ── player movement (drag target + keyboard velocity) ──
    const p = player.current;
    if (keys.current.left) p.targetX -= 520 * dt;
    if (keys.current.right) p.targetX += 520 * dt;
    p.targetX = clamp(p.targetX, PLAYER_W / 2, W - PLAYER_W / 2);
    p.x = lerp(p.x, p.targetX, Math.min(1, dt * 16));
    p.x = clamp(p.x, PLAYER_W / 2, W - PLAYER_W / 2);

    // ── auto-fire ──
    tryFire(t);

    // ── player bullets ──
    const liveB = [];
    for (const b of bullets.current) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -40 || b.x < -40 || b.x > W + 40) continue;
      liveB.push(b);
    }
    bullets.current = liveB;

    // ── enemies: movement + collisions ──
    const formY = 56 + Math.sin(t / 700) * 10; // whole formation gentle bob offset
    const surviving = [];
    const spawned = []; // fragments born this frame (appended after the loop)
    for (const a of enemies.current) {
      // movement by state/attack
      if (a.state === "enter") {
        a.y = lerp(a.y, a.slotY + formY, Math.min(1, dt * 4));
        a.x = lerp(a.x, a.slotX, Math.min(1, dt * 4));
        if (Math.abs(a.y - (a.slotY + formY)) < 4) a.state = "formed";
      } else if (a.state === "formed") {
        // sway in formation; occasionally peel off into a dive
        a.x = a.slotX + Math.sin(t / 600 + a.phase) * 16;
        a.y = a.slotY + formY;
        const diveChance = (a.attack === "dive" ? 0.9 : 0.25) * dt * (0.4 + wave.current * 0.05);
        if (Math.random() < diveChance) { a.state = "diving"; a.diveX = a.x; }
      } else {
        // diving toward / past the player
        a.diveT += dt;
        const sp = a.speed * slow * (1 + wave.current * 0.04);
        a.y += sp * dt;
        if (a.attack === "zigzag") a.x = a.diveX + Math.sin(a.diveT * 6) * 70;
        else a.x += Math.sin(a.diveT * 3 + a.phase) * 40 * dt * 6;
        a.x = clamp(a.x, a.w / 2, W - a.w / 2);
      }

      // shield toggle (clippy): opens a vulnerable window periodically
      if (a.attack === "shield" && t > a.shieldNext) {
        a.shield = !a.shield;
        a.shieldNext = t + (a.shield ? rand(2600, 3800) : rand(1300, 1900));
      }

      // enemy fire
      if (a.fires && t > a.nextShot && a.y > 0 && a.y < H * 0.8) {
        a.nextShot = t + a.fires * rand(0.8, 1.3);
        if (ebullets.current.length < ENTITY_CAP.ebullets) {
          const dx = p.x - a.x, dy = py - a.y;
          const d = Math.hypot(dx, dy) || 1;
          ebullets.current.push({ id: uid(), x: a.x, y: a.y + a.w / 2, vx: (dx / d) * 220, vy: (dy / d) * 220, w: 9 });
        }
      }

      // bullet → enemy collisions
      for (const b of bullets.current) {
        if (b.dead || b.hits.includes(a.id)) continue;
        if (Math.abs(b.x - a.x) < (a.w / 2 + b.w / 2) && Math.abs(b.y - a.y) < (a.w / 2 + b.h / 2)) {
          const mult = damageMult(a, b.weapon);
          if (mult <= 0) {
            spawnSpark(b.x, b.y, "block");
            SFX.blocked();
            b.dead = true; // blocked shot fizzles
            continue;
          }
          // EMP strips toolbar armor / clippy shield on contact
          if (b.weapon === "emp") { a.stripped = true; a.shield = false; }
          a.hp -= b.dmg * mult;
          b.hits.push(a.id);
          if (b.pierce <= b.hits.length) b.dead = true;
          if (a.hp > 0) {
            spawnSpark(b.x, b.y, "hit");
            SFX.hit();
            if (a.onHit === "split" && !a.fragment) {
              // spam splits when damaged unless the hit comes from spread/EMP (the
              // intended hard-counters that clean-kill it instead of multiplying it)
              if (b.weapon !== "spread" && b.weapon !== "emp") {
                spawned.push(makeSpamFragment(a.x - 10, a.y), makeSpamFragment(a.x + 10, a.y));
                a.hp = 0; // original consumed into fragments
              }
            }
          }
          if (a.hp <= 0) break;
        }
      }
      // prune dead bullets that pierced out
      bullets.current = bullets.current.filter((b) => !b.dead);

      if (a.hp <= 0) {
        killEnemy(a);
        continue;
      }

      // reached the bottom → breach
      if (a.y - a.w / 2 > H) {
        if (!inv) {
          conn.current = clamp(conn.current - a.drain, 0, 100);
          combo.current = 0;
          hitFlash.current = t;
          addFloat(a.x, H - 24, `-${a.drain}`, T.red);
          SFX.breach();
          if (a.onReach === "spawnPopups") {
            spawnQueue.current.push({ type: "popup", slotX: a.x - 30, slotY: 70, delay: 0 });
            spawnQueue.current.push({ type: "popup", slotX: a.x + 30, slotY: 70, delay: 120 });
          }
        }
        continue;
      }
      surviving.push(a);
    }
    // append fragments born this frame, up to the cap
    for (const f of spawned) {
      if (surviving.length >= ENTITY_CAP.enemies) break;
      surviving.push(f);
    }
    enemies.current = surviving;

    // ── enemy bullets ──
    const liveEB = [];
    for (const eb of ebullets.current) {
      eb.x += eb.vx * dt * slow;
      eb.y += eb.vy * dt * slow;
      if (eb.y > H + 30 || eb.y < -30 || eb.x < -30 || eb.x > W + 30) continue;
      // hit player?
      if (!inv && Math.abs(eb.x - p.x) < PLAYER_W * 0.38 && Math.abs(eb.y - py) < PLAYER_W * 0.4) {
        conn.current = clamp(conn.current - 4, 0, 100);
        combo.current = 0;
        hitFlash.current = t;
        SFX.hurt();
        spawnSpark(eb.x, eb.y, "hit");
        continue;
      }
      liveEB.push(eb);
    }
    ebullets.current = liveEB;

    // ── boss ──
    if (boss.current) updateBoss(t, dt, W, H, py, slow, inv);

    // ── power-up drift ──
    if (powerup.current) {
      powerup.current.y += powerup.current.vy * dt;
      if (powerup.current.y > H + 40) powerup.current = null;
      else if (Math.abs(powerup.current.x - p.x) < PLAYER_W * 0.7 && Math.abs(powerup.current.y - py) < PLAYER_W * 0.7) {
        grabPower(powerup.current);
        powerup.current = null;
      }
    }

    // ── spawning from the wave queue (paced drip so a formation streams in) ──
    if (waveState.current === "formation") {
      if (spawnQueue.current.length && t - lastSpawn.current > 85) {
        lastSpawn.current = t;
        spawnFormationEnemy(spawnQueue.current.shift());
      }
      // wave cleared → next wave
      if (!spawnQueue.current.length && enemies.current.length === 0) {
        wave.current += 1;
        queueWave(wave.current);
      }
    }

    // power-up timer
    if (!powerup.current && t > nextPower.current) {
      spawnPowerup();
      nextPower.current = t + rand(POWERUP_EVERY[0], POWERUP_EVERY[1]);
    }

    // expire transients
    floats.current = floats.current.filter((f) => t - f.born < 850);
    sparks.current = sparks.current.filter((s) => t - s.born < 480);

    // HUD suggestion: which weapon counters the most on-screen threats
    syncHud();

    if (conn.current <= 0) {
      endRun();
      return;
    }
    tick();
    raf.current = requestAnimationFrame(loop);
  };

  function killEnemy(a) {
    combo.current += 1;
    const mult = combo.current >= 3 ? Math.min(1 + (combo.current - 2) * 0.2, 4) : 1;
    const pts = Math.round(a.score * mult);
    score.current += pts;
    addFloat(a.x, a.y, `+${pts}`, mult > 1 ? T.yellow : T.cyan);
    spawnSpark(a.x, a.y, "kill");
    SFX.kill(combo.current);
  }

  function updateBoss(t, dt, W, H, py, slow, inv) {
    const bo = boss.current;
    bo.t += dt;
    if (bo.entering) {
      bo.y = lerp(bo.y, 96, Math.min(1, dt * 3));
      if (bo.y > 90) bo.entering = false;
      return;
    }
    // strafe side to side
    bo.x += bo.dir * 70 * dt * slow;
    if (bo.x < bo.w / 2 + 10) { bo.x = bo.w / 2 + 10; bo.dir = 1; }
    if (bo.x > W - bo.w / 2 - 10) { bo.x = W - bo.w / 2 - 10; bo.dir = -1; }

    // spawn minions — the core "juggle the adds" pressure
    if (t > bo.nextMinion) {
      bo.nextMinion = t + rand(2400, 3600) - Math.min(1200, bo.num * 200);
      const type = Math.random() < 0.5 ? "popup" : "spam";
      const def = THREATS[type];
      if (enemies.current.length < ENTITY_CAP.enemies) {
        enemies.current.push({
          id: uid(), type, x: clamp(bo.x + rand(-60, 60), 30, W - 30), y: bo.y + bo.w / 2,
          slotX: bo.x, slotY: 90, w: def.w, hp: def.hp || 1, maxHp: def.hp || 1, art: def.art, anim: def.anim || 0,
          score: def.score, drain: def.drain, speed: def.speed * 1.1, attack: "dive", onHit: def.onHit,
          fires: 0, nextShot: Infinity, state: "diving", diveT: 0, phase: rand(0, 6.28), born: now(),
        });
      }
      addFloat(bo.x, bo.y + 30, "SPAWN", T.red);
    }

    // boss fan-fire
    if (t > bo.nextShot) {
      bo.nextShot = t + rand(900, 1500);
      const n = 3 + Math.min(4, bo.num);
      for (let i = 0; i < n; i++) {
        if (ebullets.current.length >= ENTITY_CAP.ebullets) break;
        const ang = Math.PI / 2 + (i - (n - 1) / 2) * 0.28;
        ebullets.current.push({ id: uid(), x: bo.x, y: bo.y + bo.w / 2, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, w: 11, boss: true });
      }
    }

    // player bullets → boss (weak point = EMP/antivirus do bonus, all damage works)
    for (const b of bullets.current) {
      if (b.dead) continue;
      if (Math.abs(b.x - bo.x) < bo.w / 2 && b.y < bo.y + bo.w / 2 && b.y > bo.y - bo.w / 2) {
        const bonus = b.weapon === "emp" ? 1.6 : b.weapon === "antivirus" ? 1.3 : 1;
        bo.hp -= b.dmg * bonus;
        b.hits.push("boss");
        if (b.pierce <= b.hits.length) b.dead = true;
        spawnSpark(b.x, b.y, "hit");
        SFX.bossHit();
      }
    }
    bullets.current = bullets.current.filter((b) => !b.dead);

    if (bo.hp <= 0) {
      // defeated
      bossCount.current += 1;
      score.current += 1500 * bo.num;
      addFloat(bo.x, bo.y, `BOSS DOWN +${(1500 * bo.num).toLocaleString()}`, T.yellow);
      for (let i = 0; i < 12; i++) spawnSpark(bo.x + rand(-bo.w / 2, bo.w / 2), bo.y + rand(-bo.w / 2, bo.w / 2), "kill");
      SFX.bossDie();
      boss.current = null;
      grantUpgrade(true); // reward: unlock or upgrade a weapon
      ebullets.current = [];
      // advance to next wave (formation)
      wave.current += 1;
      queueWave(wave.current);
      return;
    }

    // boss reaching the bottom (shouldn't usually) — heavy drain
    if (!inv && bo.y - bo.w / 2 > H) {
      conn.current = clamp(conn.current - 30, 0, 100);
      hitFlash.current = t;
      boss.current = null;
      wave.current += 1;
      queueWave(wave.current);
    }
  }

  // ── power-ups & progression ─────────────────────────────────────────────────
  function grabPower(pw) {
    SFX.power();
    addFloat(pw.x, pw.y, pw.label, pw.color);
    if (pw.kind === "firewall") {
      invUntil.current = now() + pw.dur;
      ebullets.current = [];
    } else if (pw.kind === "broadband") {
      slowUntil.current = now() + pw.dur;
    } else if (pw.kind === "upgrade") {
      grantUpgrade(false);
    }
  }

  // Unlock the next locked weapon (preferring the one whose `unlock` boss is met),
  // or upgrade a random already-owned weapon. `fromBoss` lets boss kills unlock the
  // gated weapons even before their boss-number; otherwise level something up.
  function grantUpgrade(fromBoss) {
    const owned = arsenal.current.levels;
    // candidate to UNLOCK: a weapon not owned whose unlock requirement is met
    const lockable = WEAPON_ORDER.filter((id) => !owned[id]);
    const unlockable = lockable.filter((id) => {
      const u = WEAPONS[id].unlock;
      return u === "start" || (typeof u === "number" && bossCount.current >= u);
    });
    let target = unlockable[0];
    // boss kills also unlock the next gated weapon regardless of order gate
    if (fromBoss && !target && lockable.length) target = lockable[0];
    if (target) {
      owned[target] = 1;
      arsenal.current.active = target; // auto-switch to the new toy
      SFX.unlock();
      const box = arena.current?.getBoundingClientRect();
      addFloat((box?.width || 360) / 2, (box?.height || 600) * 0.5, `NEW WEAPON: ${WEAPONS[target].name}`, WEAPONS[target].color);
      setHud((h) => ({ ...h, active: target }));
      return;
    }
    // else upgrade an owned weapon that still has levels left
    const upgradable = Object.keys(owned).filter((id) => owned[id] < WEAPONS[id].levels.length);
    if (upgradable.length) {
      const id = upgradable[randI(0, upgradable.length - 1)];
      owned[id] += 1;
      SFX.unlock();
      const box = arena.current?.getBoundingClientRect();
      addFloat((box?.width || 360) / 2, (box?.height || 600) * 0.5, `${WEAPONS[id].name} LV${owned[id]}`, WEAPONS[id].color);
    } else {
      // everything maxed → award points instead
      score.current += 1000;
    }
  }

  function selectWeapon(id) {
    if (!arsenal.current.levels[id]) return; // not owned
    if (arsenal.current.active === id) return;
    arsenal.current.active = id;
    chargeUntil.current = 0;
    SFX.swap();
    setHud((h) => ({ ...h, active: id }));
  }

  // Recompute the "suggested" weapon (counters the most on-screen threats). Only
  // pokes React state when it actually changes, so it doesn't thrash renders.
  const lastSuggest = useRef(null);
  function syncHud() {
    const tally = {};
    for (const a of enemies.current) {
      const def = THREATS[a.type];
      if (def?.weakTo && arsenal.current.levels[def.weakTo]) tally[def.weakTo] = (tally[def.weakTo] || 0) + 1;
      if (a.shield && arsenal.current.levels.emp) tally.emp = (tally.emp || 0) + 1;
      if (def?.attack === "armor" && !a.stripped && arsenal.current.levels.emp) tally.emp = (tally.emp || 0) + 1;
    }
    let best = null, bestN = 0;
    for (const [id, n] of Object.entries(tally)) if (n > bestN) { best = id; bestN = n; }
    if (best !== lastSuggest.current) {
      lastSuggest.current = best;
      setHud((h) => ({ ...h, suggest: best }));
    }
  }

  // ── input ────────────────────────────────────────────────────────────────
  function moveToClientX(clientX) {
    const box = arena.current?.getBoundingClientRect();
    if (!box) return;
    player.current.targetX = clamp(clientX - box.left, PLAYER_W / 2, box.width - PLAYER_W / 2);
  }
  function onPointerDown(e) {
    if (phase !== "running") return;
    dragging.current = true;
    moveToClientX(e.clientX);
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
      else if (k === "1") selectWeapon("blaster");
      else if (k === "2") selectWeapon("antivirus");
      else if (k === "3") selectWeapon("spread");
      else if (k === "4") selectWeapon("emp");
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
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // ── render ───────────────────────────────────────────────────────────────
  const pct = Math.round(conn.current);
  const bc = barColor(pct);
  const t = now();
  const hurt = t - hitFlash.current < 260;
  const slowed = t < slowUntil.current;
  const inv = t < invUntil.current;
  const bo = boss.current;
  const owned = arsenal.current.levels;

  return (
    <div className="md-root">
      <div className="md-crt" />
      {hurt && <div className="md-breach" />}
      {slowed && <div className="md-slow" />}
      {inv && <div className="md-shielded" />}

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
          {combo.current >= 3 && <span className="md-combo">×{Math.min(1 + (combo.current - 2) * 0.2, 4).toFixed(1)}</span>}
          <span className="md-wave">WAVE {wave.current}</span>
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
        {/* boss sprite */}
        {bo && (
          <img
            className="md-boss"
            src={sprite("boss.webp")}
            alt=""
            draggable={false}
            style={{ left: bo.x, top: bo.y, width: bo.w, transform: "translate(-50%,-50%)" }}
          />
        )}

        {/* enemies */}
        {(phase === "running") &&
          enemies.current.map((a) => (
            <div
              key={a.id}
              className={`md-enemy${a.shield ? " md-shield" : ""}${a.attack === "armor" && !a.stripped ? " md-armor" : ""}`}
              style={{ left: a.x, top: a.y, width: a.w, transform: "translate(-50%,-50%)" }}
            >
              {a.anim ? (
                <span className="md-virus" style={{ width: a.w, height: a.w, backgroundImage: `url(${sprite(a.art)})` }} />
              ) : (
                <img src={sprite(a.art)} alt="" draggable={false} style={{ width: a.w }} />
              )}
              {a.maxHp > 1 && a.hp < a.maxHp && (
                <span className="md-ehp"><span style={{ width: `${(a.hp / a.maxHp) * 100}%` }} /></span>
              )}
            </div>
          ))}

        {/* player bullets */}
        {bullets.current.map((b) => (
          <span
            key={b.id}
            className={`md-bullet${b.beam ? " md-beam" : ""}${b.emp ? " md-empshot" : ""}`}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, background: b.color, boxShadow: `0 0 8px ${b.color}` }}
          />
        ))}

        {/* enemy bullets */}
        {ebullets.current.map((eb) => (
          <span key={eb.id} className={`md-ebullet${eb.boss ? " md-ebullet-boss" : ""}`} style={{ left: eb.x, top: eb.y, width: eb.w, height: eb.w }} />
        ))}

        {/* player modem */}
        {(phase === "running" || phase === "countdown") && (
          <div className={`md-player${hurt ? " md-player-hit" : ""}${inv ? " md-player-shield" : ""}`} style={{ left: player.current.x, top: `${PLAYER_Y_FRAC * 100}%` }}>
            <img src={sprite("player.webp")} alt="" draggable={false} />
          </div>
        )}

        {/* power-up */}
        {phase === "running" && powerup.current && (
          <div className="md-power" style={{ left: powerup.current.x, top: powerup.current.y, "--pc": powerup.current.color }}>
            <span className="md-power-emoji">{powerup.current.emoji}</span>
            <span className="md-power-label">{powerup.current.label}</span>
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

        {/* ── weapon chips ── */}
        {phase === "running" && (
          <div className="md-weapons">
            {WEAPON_ORDER.map((id, i) =>
              owned[id] ? (
                <button
                  key={id}
                  className={`md-wchip${hud.active === id ? " md-wchip-on" : ""}${hud.suggest === id && hud.active !== id ? " md-wchip-suggest" : ""}`}
                  style={{ "--wc": WEAPONS[id].color }}
                  onPointerDown={(e) => { e.stopPropagation(); selectWeapon(id); }}
                >
                  <span className="md-wchip-key">{i + 1}</span>
                  <span className="md-wchip-emoji">{WEAPONS[id].emoji}</span>
                  <span className="md-wchip-name">{WEAPONS[id].name}</span>
                  <span className="md-wchip-lv">{"●".repeat(owned[id])}{"○".repeat(WEAPONS[id].levels.length - owned[id])}</span>
                </button>
              ) : null
            )}
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
            <p className="md-tag">Drag to fly your modem · it auto-fires · swap weapons to match each threat. Survive the waves, down the BSOD bosses, keep your signal alive.</p>
            <div className="md-legend">
              <span>🔫 blaster</span><span>🧪 antivirus → 🦠</span><span>🔱 de-frag → ✉️</span><span>💥 emp → 📎🧰</span>
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
            <div className="md-best">BEST: {saveBest(score.current).toLocaleString()} · reached wave {wave.current}</div>
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
.md-shielded{position:absolute;inset:0;pointer-events:none;z-index:39;box-shadow:inset 0 0 120px 24px rgba(48,209,88,0.2);animation:mdPulse 0.7s infinite;}
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

.md-enemy{position:absolute;pointer-events:none;animation:mdPopIn 0.2s cubic-bezier(0.34,1.56,0.64,1);filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));}
.md-enemy img{display:block;pointer-events:none;}
@keyframes mdPopIn{0%{transform:translate(-50%,-50%) scale(0) rotate(-8deg);opacity:0}70%{transform:translate(-50%,-50%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1)}}
.md-virus{display:block;background-repeat:no-repeat;background-size:400% 100%;animation:mdVirus 0.5s steps(4) infinite;pointer-events:none;}
@keyframes mdVirus{from{background-position:0 0}to{background-position:100% 0}}
.md-shield::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid #3fffd0;box-shadow:0 0 12px #3fffd0,inset 0 0 12px #3fffd0;opacity:0.85;animation:mdPulse 0.9s infinite;}
.md-armor::before{content:"";position:absolute;left:50%;top:-3px;transform:translateX(-50%);width:80%;height:5px;background:#c0c0c0;border-radius:3px;box-shadow:0 0 6px #c0c0c0;}
.md-ehp{position:absolute;left:8%;right:8%;bottom:-7px;height:3px;background:#ffffff22;border-radius:2px;overflow:hidden;}
.md-ehp span{display:block;height:100%;background:#ff2d55;box-shadow:0 0 4px #ff2d55;}

.md-bullet{position:absolute;transform:translate(-50%,-50%);border-radius:3px;pointer-events:none;z-index:12;}
.md-beam{border-radius:2px;opacity:0.92;}
.md-empshot{border-radius:50%;animation:mdPulse 0.2s infinite;}
.md-ebullet{position:absolute;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff,#ff2d55 60%,transparent 72%);box-shadow:0 0 8px #ff2d55;pointer-events:none;z-index:11;}
.md-ebullet-boss{background:radial-gradient(circle,#fff,#bf5af2 60%,transparent 72%);box-shadow:0 0 9px #bf5af2;}

.md-player{position:absolute;transform:translate(-50%,-50%);z-index:14;pointer-events:none;will-change:left;}
.md-player img{width:64px;height:auto;display:block;filter:drop-shadow(0 0 10px rgba(63,255,208,0.5));}
.md-player-hit img{animation:mdShake 0.26s ease;filter:drop-shadow(0 0 12px #ff2d55) brightness(1.3);}
.md-player-shield::after{content:"";position:absolute;inset:-10px;border-radius:50%;border:2px solid #30d158;box-shadow:0 0 16px #30d158,inset 0 0 16px #30d15866;animation:mdPulse 0.7s infinite;}

.md-power{position:absolute;transform:translate(-50%,-50%);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;animation:mdFloatY 1.4s ease-in-out infinite;z-index:13;}
.md-power-emoji{font-size:32px;filter:drop-shadow(0 0 10px var(--pc));}
.md-power-label{font-size:8px;letter-spacing:1px;color:var(--pc);text-shadow:0 0 6px var(--pc);white-space:nowrap;}
@keyframes mdFloatY{0%,100%{margin-top:0}50%{margin-top:-5px}}

.md-float{position:absolute;transform:translate(-50%,-50%);font-family:'Black Ops One';font-size:16px;pointer-events:none;z-index:60;animation:mdFloat 0.85s ease-out forwards;white-space:nowrap;}
@keyframes mdFloat{0%{transform:translate(-50%,-50%);opacity:1}100%{transform:translate(-50%,-150%);opacity:0}}

.md-spark{position:absolute;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;pointer-events:none;z-index:55;}
.md-spark-hit{background:radial-gradient(circle,#fff,#3fffd0 50%,transparent 70%);animation:mdSpark 0.3s ease-out forwards;}
.md-spark-kill{background:radial-gradient(circle,#fff,#ffd60a 45%,transparent 70%);box-shadow:0 0 14px #ffd60a;animation:mdSpark 0.42s ease-out forwards;}
.md-spark-block{background:radial-gradient(circle,#fff,#c0c0c0 45%,transparent 70%);box-shadow:0 0 8px #c0c0c0;animation:mdSparkBlock 0.3s ease-out forwards;}
@keyframes mdSpark{0%{transform:translate(-50%,-50%) scale(0.4);opacity:1}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
@keyframes mdSparkBlock{0%{transform:translate(-50%,-50%) scale(0.6);opacity:1}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}

.md-weapons{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:6px;z-index:70;padding:0 8px;flex-wrap:wrap;}
.md-wchip{position:relative;background:#0d0d18cc;border:1.5px solid var(--wc);border-radius:8px;padding:5px 9px 4px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;min-width:54px;opacity:0.5;transition:opacity 0.15s,transform 0.1s;}
.md-wchip-on{opacity:1;box-shadow:0 0 12px var(--wc);transform:translateY(-3px);}
.md-wchip-suggest{opacity:0.95;animation:mdSuggest 0.7s infinite;}
@keyframes mdSuggest{0%,100%{box-shadow:0 0 4px var(--wc)}50%{box-shadow:0 0 16px var(--wc);border-color:#fff}}
.md-wchip-key{position:absolute;top:-7px;left:-6px;background:var(--wc);color:#08080f;font-family:'Black Ops One';font-size:9px;width:15px;height:15px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
.md-wchip-emoji{font-size:17px;line-height:1;}
.md-wchip-name{font-size:7px;letter-spacing:0.5px;color:var(--wc);}
.md-wchip-lv{font-size:7px;color:var(--wc);letter-spacing:1px;}

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
