import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";

/* ═══════════════════════════════════════════════════════════════════════════
   MODEM DEFENDER — defend your 56k dial-up connection from the early-2000s web.

   A juicy, real-time, click-to-zap arcade score-chaser. Threats (pop-ups, banner
   ads, viruses, spam, a parody assistant) drift toward your CONNECTION BAR at the
   top; tap them to score + build combo before they reach the bar and drain your
   baud. Connection hits 0 → NO CARRIER → game over. Power-ups (🛡️ firewall,
   ⚡ broadband, 🚫 pop-up blocker) drift in occasionally.

   Self-contained cabinet (like RelicRun): scoped `.md-*` CSS injected once, draws
   its own back button (so arcade chrome is hidden), one route. Rendering is
   absolutely-positioned DOM nodes driven by a rAF loop with refs mirroring state
   — the same approach the Tap Surge / Color Panic family uses. Scores ride the
   Arcade Score Standard via useArcadeScore("modem-defender") (registry `score`
   config gives it a board; claimed-accounts-only, monotonic — handled by the hook).

   Custom sprites (trimmed/optimized by scripts/process-modem-assets.js) live under
   public/games/modem-defender/. Power-up icons + FX are emoji/CSS so they read
   crisply and don't clash with the pixel-art sprites.
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
  navy: "#000080",
  silver: "#c0c0c0",
};

const rand = (a, b) => Math.random() * (b - a) + a;
const randI = (a, b) => Math.floor(rand(a, b + 1));
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = () => performance.now();

/* ── Threat catalog (data-driven; tune balance here) ──────────────────────────
   w        : on-screen width in px
   speed    : downward px/sec at wave 1 (scales up by wave)
   drain    : connection % removed if it reaches the bar
   score    : points for zapping it
   hp       : clicks to kill (default 1)
   minWave  : first wave it can spawn
   weight   : relative spawn frequency once unlocked
   art      : sprite file, or null for an emoji-rendered threat
   onReach  : optional side-effect when it hits the bar ("spawnPopups") */
const THREATS = {
  popup: { w: 96, speed: 80, drain: 8, score: 100, minWave: 1, weight: 10, art: "popup.webp" },
  banner: { w: 150, speed: 64, drain: 7, score: 120, minWave: 2, weight: 7, art: "banner.webp" },
  spam: { w: 74, speed: 104, drain: 6, score: 140, minWave: 2, weight: 6, art: "spam.webp" },
  virus: { w: 70, speed: 140, drain: 14, score: 200, minWave: 3, weight: 6, art: "virus.webp", anim: 4 },
  clippy: { w: 86, speed: 56, drain: 10, score: 160, hp: 2, minWave: 4, weight: 4, art: "clippy.webp", onReach: "spawnPopups" },
  toolbar: { w: 120, speed: 70, drain: 9, score: 180, minWave: 5, weight: 4, art: "toolbar.webp" },
};

// "Trusted download" — a rare friendly node you should NOT click (penalty if you do).
const TRUSTED = { w: 64, speed: 52, score: -150, minWave: 3, chance: 0.06 };

/* ── Power-ups (emoji chips) ─────────────────────────────────────────────────
   kind, emoji, label, color, and the effect applied on pickup. */
const POWERUPS = [
  { kind: "firewall", emoji: "🛡️", label: "FIREWALL", color: T.green, dur: 0, heal: 25, clear: true },
  { kind: "broadband", emoji: "⚡", label: "BROADBAND", color: T.cyan, dur: 5000 },
  { kind: "blocker", emoji: "🚫", label: "POP-UP BLOCKER", color: T.yellow, dur: 0, killType: "popup" },
];

const SPAWN_BASE = 1150; // ms between spawns at wave 1
const SPAWN_MIN = 360; // fastest spawn interval
const WAVE_EVERY = 1400; // score per wave step
const POWERUP_EVERY = [9000, 15000]; // ms range between power-up drifts

/* ── Sound (Web Audio, house style: soft sine pops / dull thwacks) ─────────── */
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
  zap: (combo = 0) => {
    const base = 420 + combo * 22;
    tone({ freq: base, gain: 0.12, dur: 0.07, sweep: 0.6, type: "triangle" });
    if (combo >= 4) setTimeout(() => tone({ freq: base * 1.5, gain: 0.06, dur: 0.07 }), 30);
  },
  hp: () => tone({ freq: 300, gain: 0.1, dur: 0.06, sweep: 0.8 }),
  wrong: () => tone({ freq: 130, gain: 0.12, dur: 0.13, sweep: 0.5 }),
  breach: () => {
    tone({ freq: 150, gain: 0.13, dur: 0.16, sweep: 0.5 });
    setTimeout(() => tone({ freq: 95, gain: 0.09, dur: 0.13, sweep: 0.5 }), 90);
  },
  power: (c = T.cyan) => {
    void c;
    [523, 659, 880].forEach((f, i) => setTimeout(() => tone({ freq: f, gain: 0.1, dur: 0.1, sweep: 0.85 }), i * 55));
  },
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
  const threats = useRef([]); // [{ id, type, x, y, w, h, vy, hp, art, anim, trusted, born }]
  const floats = useRef([]); // [{ id, x, y, text, color, born }]
  const powerup = useRef(null); // a single drifting power-up, or null
  const score = useRef(0);
  const combo = useRef(0);
  const conn = useRef(100); // connection %
  const wave = useRef(1);
  const shieldFlash = useRef(0); // ts of last big screen pulse
  const slowUntil = useRef(0); // broadband slow-mo / auto-zap window
  const startedAt = useRef(0);
  const lastSpawn = useRef(0);
  const nextPower = useRef(0);
  const raf = useRef(0);
  const lastFrame = useRef(0); // ts of previous frame, for dt
  const sparks = useRef([]); // transient CSS spark/shatter bursts
  const arena = useRef(null);

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
    threats.current = [];
    floats.current = [];
    powerup.current = null;
    score.current = 0;
    combo.current = 0;
    conn.current = 100;
    wave.current = 1;
    slowUntil.current = 0;
    shieldFlash.current = 0;
  }

  function beginRun() {
    reset();
    const t = now();
    startedAt.current = t;
    lastSpawn.current = t;
    nextPower.current = t + rand(POWERUP_EVERY[0], POWERUP_EVERY[1]);
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

  function spawnThreat(type, forced) {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    const def = THREATS[type];
    const w = def.w;
    const x = rand(w / 2 + 6, W - w / 2 - 6);
    threats.current.push({
      id: uid(),
      type,
      x,
      y: -def.w * 0.6,
      w,
      vy: def.speed,
      hp: def.hp || 1,
      art: def.art,
      anim: def.anim || 0,
      score: def.score,
      drain: def.drain,
      onReach: def.onReach,
      trusted: false,
      born: now(),
      forced: !!forced,
    });
  }

  function spawnTrusted() {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    const w = TRUSTED.w;
    threats.current.push({
      id: uid(),
      type: "trusted",
      x: rand(w / 2 + 6, W - w / 2 - 6),
      y: -w,
      w,
      vy: TRUSTED.speed,
      hp: 1,
      art: null,
      anim: 0,
      score: TRUSTED.score,
      drain: 0,
      trusted: true,
      born: now(),
    });
  }

  function spawnPowerup() {
    const box = arena.current?.getBoundingClientRect();
    const W = box?.width || 360;
    const def = POWERUPS[randI(0, POWERUPS.length - 1)];
    powerup.current = {
      id: uid(),
      ...def,
      x: rand(40, W - 40),
      y: -40,
      vy: 70,
      born: now(),
    };
  }

  // ── main loop ────────────────────────────────────────────────────────────
  const loopRef = useRef();
  function loop(ts) {
    loopRef.current(ts);
  }
  // keep the loop body in a ref so it always sees fresh closures without
  // re-subscribing rAF (mirrors the refs-driven pattern of the sibling games).
  loopRef.current = (ts) => {
    const t = ts || now();
    const prev = lastFrame.current || t;
    let dt = (t - prev) / 1000;
    lastFrame.current = t;
    if (dt > 0.05) dt = 0.05; // clamp big tab-switch gaps

    const slowed = t < slowUntil.current ? 0.45 : 1; // broadband slow-mo
    const waveMul = 1 + (wave.current - 1) * 0.12; // threats speed up per wave
    const arenaBox = arena.current?.getBoundingClientRect();
    const floor = arenaBox?.height || 600; // junk that falls past this breaches your system

    // advance threats: they fall DOWN toward your system at the bottom.
    const survivors = [];
    for (const a of threats.current) {
      a.y += a.vy * waveMul * slowed * dt;
      if (a.y - a.w / 2 > floor) {
        // fell past your defenses → breach (drains the connection)
        if (!a.trusted) {
          conn.current = clamp(conn.current - a.drain, 0, 100);
          combo.current = 0;
          shieldFlash.current = t;
          addFloat(a.x, floor - 20, `-${a.drain}`, T.red);
          SFX.breach();
          if (a.onReach === "spawnPopups") {
            for (let i = 0; i < 2; i++) spawnThreat("popup");
          }
        }
        continue; // remove (trusted just leaves harmlessly)
      }
      survivors.push(a);
    }
    threats.current = survivors;

    // power-up drift
    if (powerup.current) {
      powerup.current.y += powerup.current.vy * dt;
      const box = arena.current?.getBoundingClientRect();
      if (powerup.current.y > (box?.height || 600) + 40) powerup.current = null;
    }

    // spawning
    const elapsed = t - startedAt.current;
    wave.current = Math.floor(score.current / WAVE_EVERY) + 1;
    const spawnInt = Math.max(SPAWN_MIN, SPAWN_BASE - wave.current * 70);
    if (t - lastSpawn.current > spawnInt) {
      lastSpawn.current = t;
      if (wave.current >= TRUSTED.minWave && Math.random() < TRUSTED.chance) spawnTrusted();
      else spawnThreat(pickThreatType(wave.current));
    }
    if (!powerup.current && t > nextPower.current) {
      spawnPowerup();
      nextPower.current = t + rand(POWERUP_EVERY[0], POWERUP_EVERY[1]);
    }

    // expire transient effects
    floats.current = floats.current.filter((f) => t - f.born < 750);
    sparks.current = sparks.current.filter((s) => t - s.born < 500);

    if (conn.current <= 0) {
      endRun();
      return;
    }
    void elapsed;
    tick();
    raf.current = requestAnimationFrame(loop);
  };

  // ── input ────────────────────────────────────────────────────────────────
  function zap(a, e) {
    if (phase !== "running") return;
    e?.stopPropagation?.();
    if (a.trusted) {
      // clicked a friendly download — penalty
      score.current = Math.max(0, score.current + a.score);
      combo.current = 0;
      addFloat(a.x, a.y, `${a.score}`, T.red);
      SFX.wrong();
      threats.current = threats.current.filter((x) => x.id !== a.id);
      return;
    }
    a.hp -= 1;
    if (a.hp > 0) {
      SFX.hp();
      a.flash = now();
      return;
    }
    combo.current += 1;
    const mult = combo.current >= 3 ? Math.min(1 + (combo.current - 2) * 0.25, 4) : 1;
    const pts = Math.round(a.score * mult);
    score.current += pts;
    addFloat(a.x, a.y, `+${pts}`, mult > 1 ? T.yellow : T.cyan);
    SFX.zap(combo.current);
    a.dead = now();
    threats.current = threats.current.filter((x) => x.id !== a.id);
    spawnSpark(a.x, a.y, a.type === "popup");
  }

  function grabPower(e) {
    if (phase !== "running" || !powerup.current) return;
    e?.stopPropagation?.();
    const p = powerup.current;
    powerup.current = null;
    SFX.power(p.color);
    addFloat(p.x, p.y, p.label, p.color);
    if (p.heal) conn.current = clamp(conn.current + p.heal, 0, 100);
    if (p.clear) {
      // firewall: vaporize everything on screen, award a little
      for (const a of threats.current) spawnSpark(a.x, a.y, false);
      score.current += threats.current.length * 25;
      threats.current = [];
      shieldFlash.current = now();
    }
    if (p.killType) {
      threats.current = threats.current.filter((a) => {
        if (a.type === p.killType) {
          spawnSpark(a.x, a.y, true);
          return false;
        }
        return true;
      });
    }
    if (p.dur) slowUntil.current = now() + p.dur;
  }

  // transient spark/shatter elements (pure CSS; sparks ref declared with the others)
  function spawnSpark(x, y, shatter) {
    sparks.current.push({ id: uid(), x, y, shatter, born: now() });
    // prune old
    sparks.current = sparks.current.filter((s) => now() - s.born < 500);
  }

  function missTap() {
    // tapping empty space breaks combo (mild — keeps it from being mindless)
    if (phase === "running") combo.current = 0;
  }

  useEffect(() => {
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // ── render ───────────────────────────────────────────────────────────────
  const pct = Math.round(conn.current);
  const bc = barColor(pct);
  const t = now();
  const breaching = t - shieldFlash.current < 280;
  const slowed = t < slowUntil.current;

  return (
    <div className="md-root" onPointerDown={missTap}>
      {/* CRT scanline + vignette overlay */}
      <div className="md-crt" />
      {breaching && <div className="md-breach" />}
      {slowed && <div className="md-slow" />}

      {/* ── HUD: connection bar ── */}
      <div className="md-hud">
        <button className="md-back" onPointerDown={(e) => { e.stopPropagation(); onExit(); }}>←</button>
        <div className="md-hud-mid">
          <div className="md-meter">
            <div className="md-meter-fill" style={{ width: `${pct}%`, background: bc, boxShadow: `0 0 10px ${bc}` }} />
            <span className="md-meter-label">📡 {pct}% · BAUD</span>
          </div>
        </div>
        <div className="md-hud-right">
          {combo.current >= 3 && <span className="md-combo">×{Math.min(1 + (combo.current - 2) * 0.25, 4).toFixed(2)}</span>}
          <span className="md-wave">WAVE {wave.current}</span>
          <span className="md-score">{score.current.toLocaleString()}</span>
        </div>
      </div>

      {/* ── arena ── */}
      <div className="md-arena" ref={arena}>
        {/* your system at the bottom — what the falling junk is trying to reach */}
        {(phase === "running" || phase === "countdown") && (
          <div className={`md-dock${breaching ? " md-dock-hit" : ""}`} style={{ "--bc": bc }}>
            <img className="md-dock-modem" src={sprite("player.webp")} alt="" draggable={false} />
            <div className="md-dock-line" />
          </div>
        )}

        {phase === "running" &&
          threats.current.map((a) => (
            <button
              key={a.id}
              className={`md-threat${a.trusted ? " md-trusted" : ""}`}
              style={{
                left: a.x,
                top: a.y,
                width: a.w,
                transform: "translate(-50%,-50%)",
              }}
              onPointerDown={(e) => zap(a, e)}
            >
              {a.trusted ? (
                <span className="md-trusted-chip">✅ trusted<br />download</span>
              ) : a.anim ? (
                <span
                  className="md-virus"
                  style={{
                    width: a.w,
                    height: a.w,
                    backgroundImage: `url(${sprite(a.art)})`,
                  }}
                />
              ) : (
                <img src={sprite(a.art)} alt="" draggable={false} style={{ width: a.w }} />
              )}
              {a.hp > 1 && <span className="md-hp">{a.hp}</span>}
            </button>
          ))}

        {phase === "running" && powerup.current && (
          <button
            className="md-power"
            style={{ left: powerup.current.x, top: powerup.current.y, "--pc": powerup.current.color }}
            onPointerDown={grabPower}
          >
            <span className="md-power-emoji">{powerup.current.emoji}</span>
            <span className="md-power-label">{powerup.current.label}</span>
          </button>
        )}

        {/* score floats */}
        {floats.current.map((f) => (
          <span key={f.id} className="md-float" style={{ left: f.x, top: f.y, color: f.color, textShadow: `0 0 8px ${f.color}` }}>
            {f.text}
          </span>
        ))}

        {/* sparks */}
        {sparks.current.map((s) => (
          <span key={s.id} className={`md-spark${s.shatter ? " md-shatter" : ""}`} style={{ left: s.x, top: s.y }} />
        ))}

        {/* ── countdown ── */}
        {phase === "countdown" && (
          <div className="md-overlay">
            <div className="md-count">{count <= 0 ? "GO!" : count}</div>
          </div>
        )}

        {/* ── start screen ── */}
        {phase === "start" && (
          <div className="md-overlay md-start">
            <img className="md-logo" src={ui("logo.webp")} alt="Modem Defender" draggable={false} />
            <p className="md-tag">The web is under attack. Protect your 56k connection — tap the junk before it kills your signal.</p>
            <div className="md-legend">
              <span>🪟 pop-ups</span><span>🦠 viruses</span><span>✉️ spam</span><span>📎 assistant</span>
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
.md-breach{position:absolute;inset:0;pointer-events:none;z-index:40;animation:mdBreach 0.28s ease-out;box-shadow:inset 0 0 120px 20px rgba(255,45,85,0.55);}
.md-slow{position:absolute;inset:0;pointer-events:none;z-index:39;box-shadow:inset 0 0 140px 30px rgba(63,255,208,0.18);}
@keyframes mdBreach{0%{opacity:1}100%{opacity:0}}

.md-hud{position:absolute;top:0;left:0;right:0;height:62px;display:flex;align-items:center;gap:8px;padding:0 10px;z-index:100;background:linear-gradient(#0f0f1eee,transparent);border-bottom:1px solid #ffffff10;}
.md-back{background:#ffffff08;border:1px solid #ffffff18;color:#ffffff66;padding:6px 11px;border-radius:5px;font-family:'Share Tech Mono';font-size:13px;cursor:pointer;flex-shrink:0;}
.md-hud-mid{flex:1;min-width:0;}
.md-meter{position:relative;height:22px;border:2px solid #ffffff22;border-radius:5px;background:#05050c;overflow:hidden;box-shadow:inset 0 0 8px #000;}
.md-meter-fill{position:absolute;left:0;top:0;bottom:0;transition:width 0.18s linear,background 0.4s;}
.md-meter-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;letter-spacing:1px;color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;}
.md-hud-right{display:flex;align-items:center;gap:9px;flex-shrink:0;}
.md-combo{font-family:'Black Ops One';font-size:12px;color:#ffd60a;text-shadow:0 0 8px #ffd60a;animation:mdPulse 0.5s infinite;}
.md-wave{font-size:9px;letter-spacing:1px;color:#ffffff44;}
.md-score{font-family:'Black Ops One';font-size:22px;color:#3fffd0;text-shadow:0 0 10px #3fffd0;min-width:54px;text-align:right;}
@keyframes mdPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.92)}}

.md-arena{position:absolute;top:62px;left:0;right:0;bottom:0;z-index:10;}
.md-dock{position:absolute;left:0;right:0;bottom:0;height:64px;z-index:8;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;}
.md-dock-line{position:absolute;left:0;right:0;bottom:54px;height:3px;background:var(--bc);box-shadow:0 0 14px var(--bc),0 0 4px var(--bc);opacity:0.85;transition:background 0.4s;}
.md-dock-modem{height:78px;width:auto;margin-bottom:-6px;filter:drop-shadow(0 0 10px rgba(63,255,208,0.4));z-index:9;}
.md-dock::before{content:"";position:absolute;left:0;right:0;bottom:0;height:54px;background:linear-gradient(transparent,rgba(63,255,208,0.06) 60%,rgba(63,255,208,0.12));}
.md-dock-hit .md-dock-line{background:#ff2d55;box-shadow:0 0 18px #ff2d55;}
.md-dock-hit .md-dock-modem{animation:mdShake 0.3s ease;}
.md-threat{position:absolute;background:none;border:none;padding:0;cursor:pointer;animation:mdPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1);filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));}
.md-threat img{display:block;image-rendering:auto;pointer-events:none;}
.md-threat:active{filter:brightness(1.4) drop-shadow(0 0 8px #3fffd0);}
@keyframes mdPopIn{0%{transform:translate(-50%,-50%) scale(0) rotate(-10deg);opacity:0}70%{transform:translate(-50%,-50%) scale(1.12)}100%{transform:translate(-50%,-50%) scale(1)}}
.md-virus{display:block;background-repeat:no-repeat;background-size:400% 100%;animation:mdVirus 0.5s steps(4) infinite;pointer-events:none;}
@keyframes mdVirus{from{background-position:0 0}to{background-position:100% 0}}
.md-hp{position:absolute;top:-6px;right:-6px;background:#ff2d55;color:#fff;font-size:11px;font-family:'Black Ops One';width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 6px #ff2d55;}
.md-trusted{}
.md-trusted-chip{display:block;background:#0a3d1e;border:2px solid #30d158;color:#aaffcc;font-size:9px;line-height:1.1;text-align:center;padding:6px 4px;border-radius:6px;box-shadow:0 0 10px #30d15855;}

.md-power{position:absolute;transform:translate(-50%,-50%);background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;animation:mdFloatY 1.4s ease-in-out infinite;}
.md-power-emoji{font-size:34px;filter:drop-shadow(0 0 10px var(--pc));}
.md-power-label{font-size:8px;letter-spacing:1px;color:var(--pc);text-shadow:0 0 6px var(--pc);white-space:nowrap;}
@keyframes mdFloatY{0%,100%{margin-top:0}50%{margin-top:-5px}}

.md-float{position:absolute;transform:translate(-50%,-50%);font-family:'Black Ops One';font-size:18px;pointer-events:none;z-index:60;animation:mdFloat 0.75s ease-out forwards;}
@keyframes mdFloat{0%{transform:translate(-50%,-50%);opacity:1}100%{transform:translate(-50%,-150%);opacity:0}}

.md-spark{position:absolute;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:radial-gradient(circle,#fff,#3fffd0 50%,transparent 70%);pointer-events:none;z-index:55;animation:mdSpark 0.4s ease-out forwards;}
@keyframes mdSpark{0%{transform:translate(-50%,-50%) scale(0.4);opacity:1}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
.md-shatter{background:radial-gradient(circle,#fff,#ffd60a 45%,transparent 70%);box-shadow:0 0 14px #ffd60a;}

.md-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:80;background:rgba(8,8,15,0.72);text-align:center;padding:20px;}
.md-count{font-family:'Black Ops One';font-size:96px;color:#3fffd0;text-shadow:0 0 30px #3fffd0,0 0 60px #3fffd055;animation:mdCount 0.55s ease;}
@keyframes mdCount{0%{transform:scale(1.7);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}
.md-logo{width:min(80%,420px);height:auto;filter:drop-shadow(0 4px 18px rgba(63,255,208,0.35));animation:mdPopIn2 0.5s cubic-bezier(0.34,1.56,0.64,1);}
@keyframes mdPopIn2{0%{transform:scale(0.6);opacity:0}100%{transform:scale(1);opacity:1}}
.md-tag{max-width:340px;color:#ffffff99;font-size:12px;line-height:1.5;margin:0;}
.md-legend{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;color:#ffffff66;font-size:11px;}
.md-btn{background:#3fffd018;border:2px solid #3fffd055;color:#3fffd0;padding:11px 26px;border-radius:7px;font-family:'Black Ops One';font-size:14px;letter-spacing:3px;cursor:pointer;text-shadow:0 0 8px #3fffd0;transition:transform 0.1s;}
.md-btn:active{transform:scale(0.95);}
.md-btn-ghost{background:#ffffff0a;border-color:#ffffff33;color:#ffffff88;text-shadow:none;}
.md-btns{display:flex;gap:12px;margin-top:6px;}
.md-best{color:#ffffff44;font-size:11px;letter-spacing:2px;}
.md-stamp{width:min(78%,420px);height:auto;animation:mdShake 0.5s ease;}
@keyframes mdShake{0%{transform:translate(0,0)}20%{transform:translate(-8px,4px)}40%{transform:translate(7px,-5px)}60%{transform:translate(-5px,-3px)}80%{transform:translate(4px,4px)}100%{transform:translate(0,0)}}
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
