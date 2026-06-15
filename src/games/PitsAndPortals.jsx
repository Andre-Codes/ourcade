import { useState, useCallback, useMemo, useRef, useEffect } from "react";

import {
  W, H, MAX_HP, RESOLVE_MS, PURSUIT_MAX, SWAP_RANGE, BLINK_RANGE,
  DIRS, key, inBounds, manhattan, sign, wallsToSet,
  VERB_INFO, REWARDS, VESSELS, VESSEL_BY_ID, EM, MODIFIERS, STYLE, styleRank,
  REC0, ACH, ACH_ORDER, RELICS, RELIC_ORDER, RELIC_EVERY, CONSUMABLES,
  SATCHEL_MAX, PREMIUM_COST, INSPECT,
  withIntents, resolve, generateFloor, farEdgeSpawn, rollVerbDraft,
} from "./pits-and-portals/engine";
import { useArcadeBackButton } from "../arcadeChrome.js";

// Persistent meta key. window.storage was never wired up (silently dead), so we
// use localStorage with the ourcade: prefix like the rest of the app.
const META_KEY = "ourcade:pits-and-portals:meta";


/* ---------- token glyphs ---------- */
// Shared gradient/defs for all sigils — rendered once, referenced by url(#id).
function SigilDefs() {
  return (
    <svg className="sigilDefs" width="0" height="0" aria-hidden="true">
      <defs>
        <radialGradient id="gPlayer" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#8a97c4" /><stop offset="55%" stopColor="#414d7e" /><stop offset="100%" stopColor="#1c2240" />
        </radialGradient>
        <radialGradient id="gLantern" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fffdf2" /><stop offset="60%" stopColor="#ffe9a6" /><stop offset="100%" stopColor="#caa23f" />
        </radialGradient>
        <linearGradient id="gCharger" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff7a63" /><stop offset="100%" stopColor="#b32316" />
        </linearGradient>
        <radialGradient id="gStriker" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#e7d2ff" /><stop offset="45%" stopColor="#b07dff" /><stop offset="100%" stopColor="#5e3aa6" />
        </radialGradient>
        <radialGradient id="gBomber" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#ffd9a0" /><stop offset="55%" stopColor="#ff9d3c" /><stop offset="100%" stopColor="#a85410" />
        </radialGradient>
        <radialGradient id="gCore" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#fff3c0" /><stop offset="50%" stopColor="#ff8a2a" /><stop offset="100%" stopColor="#3a1c06" />
        </radialGradient>
        <linearGradient id="gWarlord" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6f8a" /><stop offset="55%" stopColor="#a8389e" /><stop offset="100%" stopColor="#5a1670" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Glyph({ type }) {
  // PLAYER — hooded lantern-bearer
  if (type === "player")
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="sig">
        <path d="M50 9 C39 9 33 20 33 32 C22 39 15 55 15 73 C15 85 27 91 50 91 C73 91 85 85 85 73 C85 55 78 39 67 32 C67 20 61 9 50 9 Z" fill="url(#gPlayer)" stroke="#fff6dc" strokeWidth="2.5" />
        <path d="M39 30 C39 23 61 23 61 30 C61 43 56 53 50 53 C44 53 39 43 39 30 Z" fill="#17110a" />
        <circle cx="45.5" cy="37" r="2.4" fill="#ffe9a6" className="eyeglint" />
        <circle cx="54.5" cy="37" r="2.4" fill="#ffe9a6" className="eyeglint" />
        <path d="M69 59 Q74 54 79 59" stroke="#caa23f" strokeWidth="2" fill="none" />
        <circle cx="74" cy="70" r="7.5" fill="url(#gLantern)" stroke="#fff6dc" strokeWidth="1.5" className="lantern" />
      </svg>
    );
  // CHARGER — horned hound, lunging
  if (type === "charger")
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="sig">
        <path d="M24 16 L34 34 M76 16 L66 34" stroke="#ffd2c4" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M50 22 C70 22 84 40 84 58 C84 74 72 86 50 88 C28 86 16 74 16 58 C16 40 30 22 50 22 Z" fill="url(#gCharger)" stroke="#ffd2c4" strokeWidth="2.5" />
        <path d="M40 84 L50 96 L60 84 Z" fill="url(#gCharger)" stroke="#ffd2c4" strokeWidth="2" />
        <path d="M34 54 L44 60 M66 54 L56 60" stroke="#3a0a05" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  // BOMBER — volatile spore-mote
  if (type === "bomber")
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="sig">
        <g className="spores">
          <path d="M50 8 L50 22 M92 50 L78 50 M50 92 L50 78 M8 50 L22 50" stroke="#ffcaa0" strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="34" fill="url(#gBomber)" stroke="#ffe2bd" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="15" fill="url(#gCore)" className="core" />
      </svg>
    );
  // WARLORD — armored revenant skull-crown
  if (type === "warlord")
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="sig">
        <path d="M16 30 L30 8 L40 26 L50 6 L60 26 L70 8 L84 30 Z" fill="url(#gWarlord)" stroke="#ffd9cd" strokeWidth="2.5" />
        <path d="M28 30 C28 24 38 20 50 20 C62 20 72 24 72 30 L72 58 C72 74 62 90 50 90 C38 90 28 74 28 58 Z" fill="url(#gWarlord)" stroke="#ffd9cd" strokeWidth="2.5" />
        <circle cx="40" cy="52" r="7.5" fill="url(#gLantern)" className="bosseye" />
        <circle cx="60" cy="52" r="7.5" fill="url(#gLantern)" className="bosseye" />
        <path d="M44 72 L50 66 L56 72" stroke="#2a0820" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
    );
  // STRIKER — watching eye
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" className="sig">
      <path d="M10 50 C28 28 72 28 90 50 C72 72 28 72 10 50 Z" fill="#1a1226" stroke="var(--violet)" strokeWidth="3" />
      <circle cx="50" cy="50" r="18" fill="url(#gStriker)" />
      <ellipse cx="50" cy="50" rx="5" ry="13" fill="#160a26" className="pupil" />
      <circle cx="44" cy="44" r="4" fill="#fff" opacity="0.85" />
    </svg>
  );
}

// Small rune icons for the verb bar.
function VerbIcon({ id }) {
  const c = { width: "100%", height: "100%", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "push") return (<svg {...c}><path d="M5 12h11" /><path d="M13 8l4 4-4 4" /><path d="M20 6v12" /></svg>);
  if (id === "wall") return (<svg {...c}><rect x="3" y="6" width="18" height="12" rx="1" /><path d="M3 12h18M9 6v6M15 12v6" /></svg>);
  if (id === "pull") return (<svg {...c}><path d="M19 12H8" /><path d="M11 8l-4 4 4 4" /><path d="M4 6v12" /></svg>);
  if (id === "swap") return (<svg {...c}><path d="M7 8h10l-3-3M17 16H7l3 3" /></svg>);
  if (id === "dash") return (<svg {...c}><path d="M4 12h10" /><path d="M9 7l5 5-5 5" /><path d="M17 7l5 5-5 5" /></svg>);
  if (id === "leap") return (<svg {...c}><path d="M4 18c4 0 4-10 8-10s4 10 8 10" /><path d="M3 21h18" /></svg>);
  return null;
}

function VesselIcon({ id }) {
  const c = { width: "100%", height: "100%", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "wanderer") return (<svg {...c}><path d="M9 7l3-3 3 3" /><circle cx="12" cy="13" r="5" /><path d="M12 10v6" /></svg>);
  if (id === "warden") return (<svg {...c}><rect x="4" y="7" width="16" height="10" rx="1" /><path d="M4 12h16M10 7v5M14 12v5" /></svg>);
  if (id === "stalker") return (<svg {...c}><path d="M4 12h9" /><path d="M9 7l5 5-5 5" /><path d="M16 7l4 5-4 5" /></svg>);
  if (id === "sentinel") return (<svg {...c}><path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 11l2 2 4-4" /></svg>);
  return null;
}

function RelicIcon({ id }) {
  const c = { width: "100%", height: "100%", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "echo") return (<svg {...c}><circle cx="12" cy="12" r="3" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3" /></svg>);
  if (id === "blood") return (<svg {...c}><path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z" /></svg>);
  if (id === "ward") return (<svg {...c}><path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg>);
  if (id === "hunt") return (<svg {...c}><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>);
  if (id === "stone") return (<svg {...c}><rect x="4" y="7" width="16" height="10" rx="1" /><path d="M4 12h16M10 7v5M14 12v5" /></svg>);
  if (id === "iron") return (<svg {...c}><path d="M6 4h12l-2 7a4 4 0 0 1-8 0z" /><path d="M9 18h6M12 15v3" /></svg>);
  return null;
}

function ConsumableIcon({ id }) {
  const c = { width: "100%", height: "100%", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "blink") return (<svg {...c}><path d="M13 2L5 13h6l-1 9 8-12h-6z" /></svg>);
  if (id === "quake") return (<svg {...c}><circle cx="12" cy="12" r="3.2" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>);
  if (id === "aegis") return (<svg {...c}><path d="M7 4h10v3a8 8 0 0 1-5 7 8 8 0 0 1-5-7z" /><path d="M9 20h6M12 14v6" /></svg>);
  if (id === "phoenix") return (<svg {...c}><path d="M12 3c2 3 5 4 5 8a5 5 0 0 1-10 0c0-2 1-3 2-4M12 21c-3-1-5-3-5-5" /></svg>);
  return null;
}

/* ---------- procedural audio (lazy, gesture-gated) ---------- */
const SFX = (() => {
  let ctx = null, master = null, muted = false;
  function ensure() {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
  function tone(o) {
    const c = ensure(); if (!c || muted) return;
    const { f = 440, t = "sine", dur = 0.15, gain = 0.3, slideTo = null, attack = 0.005, when = 0 } = o;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = t; osc.frequency.setValueAtTime(f, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(o) {
    const c = ensure(); if (!c || muted) return;
    const { dur = 0.3, gain = 0.4, type = "lowpass", freq = 800, when = 0 } = o;
    const t0 = c.currentTime + when;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const filt = c.createBiquadFilter(); filt.type = type; filt.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur);
  }
  function play(name, opt = {}) {
    switch (name) {
      case "move": tone({ f: 150, t: "sine", dur: 0.07, gain: 0.16 }); break;
      case "dash": tone({ f: 240, slideTo: 460, t: "triangle", dur: 0.16, gain: 0.2 }); break;
      case "shove": tone({ f: 120, slideTo: 55, t: "square", dur: 0.12, gain: 0.26 }); noise({ dur: 0.07, gain: 0.14, freq: 500 }); break;
      case "wall": tone({ f: 90, t: "square", dur: 0.1, gain: 0.28 }); noise({ dur: 0.12, gain: 0.2, freq: 280 }); break;
      case "swap": tone({ f: 520, slideTo: 920, t: "sine", dur: 0.1, gain: 0.2 }); tone({ f: 920, slideTo: 520, t: "sine", dur: 0.12, gain: 0.16, when: 0.05 }); break;
      case "beam": tone({ f: 760, slideTo: 180, t: "sawtooth", dur: 0.22, gain: 0.18 }); break;
      case "slash": noise({ dur: 0.1, gain: 0.22, type: "highpass", freq: 2200 }); break;
      case "fuse": tone({ f: opt.urgent ? 1500 : 950, t: "square", dur: 0.045, gain: 0.15 }); break;
      case "detonate": noise({ dur: 0.5, gain: 0.55, freq: 1400 }); tone({ f: 190, slideTo: 38, t: "sine", dur: 0.55, gain: 0.42 }); break;
      case "kill": noise({ dur: 0.16, gain: 0.28, freq: 1000 }); break;
      case "descend": tone({ f: 523, t: "sine", dur: 0.16, gain: 0.24 }); tone({ f: 784, t: "sine", dur: 0.3, gain: 0.2, when: 0.11 }); break;
      case "hurt": tone({ f: 210, slideTo: 70, t: "sawtooth", dur: 0.3, gain: 0.34 }); break;
      case "ward": tone({ f: 1300, slideTo: 700, t: "triangle", dur: 0.22, gain: 0.24 }); noise({ dur: 0.14, gain: 0.16, type: "highpass", freq: 3000 }); break;
      case "reward": tone({ f: 660, t: "triangle", dur: 0.14, gain: 0.2 }); tone({ f: 990, t: "triangle", dur: 0.26, gain: 0.18, when: 0.11 }); break;
      case "death": tone({ f: 160, slideTo: 30, t: "sawtooth", dur: 0.9, gain: 0.4 }); break;
      case "boss": tone({ f: 130, t: "sawtooth", dur: 0.5, gain: 0.32 }); tone({ f: 98, t: "sawtooth", dur: 0.6, gain: 0.3, when: 0.16 }); tone({ f: 65, t: "square", dur: 0.7, gain: 0.22, when: 0.16 }); break;
      case "stagger": tone({ f: 320, slideTo: 180, t: "square", dur: 0.12, gain: 0.26 }); noise({ dur: 0.1, gain: 0.22, type: "bandpass", freq: 2600 }); break;
      case "ember": tone({ f: 1050, t: "triangle", dur: 0.1, gain: 0.16 }); tone({ f: 1570, t: "triangle", dur: 0.12, gain: 0.12, when: 0.05 }); break;
      case "tap": tone({ f: 620, t: "sine", dur: 0.04, gain: 0.12 }); break;
      case "confirm": tone({ f: 480, slideTo: 760, t: "triangle", dur: 0.09, gain: 0.17 }); break;
      case "multikill": tone({ f: 523, t: "triangle", dur: 0.1, gain: 0.2 }); tone({ f: 659, t: "triangle", dur: 0.1, gain: 0.2, when: 0.08 }); tone({ f: 880, t: "triangle", dur: 0.16, gain: 0.18, when: 0.16 }); break;
      case "fanfare": tone({ f: 523, t: "triangle", dur: 0.14, gain: 0.22 }); tone({ f: 784, t: "triangle", dur: 0.14, gain: 0.2, when: 0.13 }); tone({ f: 1046, t: "triangle", dur: 0.3, gain: 0.2, when: 0.26 }); break;
      default: break;
    }
  }
  return { play, ensure, setMuted };
})();
const buzz = (p) => { try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

/* ============================================================ */
export default function App() {
  const [floor, setFloor] = useState(null);
  const [player, setPlayer] = useState({ x: 0, y: 0 });
  const [enemies, setEnemies] = useState([]);
  const [walls, setWalls] = useState([]);
  const [hp, setHp] = useState(MAX_HP);
  const [depth, setDepth] = useState(1);
  const [cleanClears, setCleanClears] = useState(0);
  const [floorDamage, setFloorDamage] = useState(0);
  const [pursuit, setPursuit] = useState(0);
  const [wards, setWards] = useState(0);
  const [verbs, setVerbs] = useState([{ id: "push", baseCd: 0, cd: 0 }]);

  const [staged, setStaged] = useState(null);
  const [armed, setArmed] = useState(null); // null | verb id
  const [phase, setPhase] = useState("intro"); // intro | play | resolving | reward | dead
  // Show the arcade's "‹ BACK TO OURCADE" chrome only on the sanctum — never
  // mid-run, where it would sit atop the board's own UI.
  useArcadeBackButton(phase === "intro");
  const [flash, setFlash] = useState(0);
  const [toast, setToast] = useState(null);
  const [rewardOptions, setRewardOptions] = useState([]);
  const [rewardKind, setRewardKind] = useState("verb"); // verb | relic
  const [pendingDepth, setPendingDepth] = useState(1);
  const [relics, setRelics] = useState([]);        // run-scoped passive relics
  const [floorWard, setFloorWard] = useState(false); // Warded Soul: per-floor absorb charge
  const [satchel, setSatchel] = useState([]);      // run-scoped consumables (ids, max SATCHEL_MAX)
  const [cacheTaken, setCacheTaken] = useState(false);
  const [fx, setFx] = useState([]);
  const [shaking, setShaking] = useState(false);
  const [muted, setMuted] = useState(false);
  // meta-progression (persisted across sessions via window.storage)
  const [embers, setEmbers] = useState(0);
  const [unlocked, setUnlocked] = useState(["wanderer"]);
  const [selectedVessel, setSelectedVessel] = useState("wanderer");
  const [best, setBest] = useState(0);
  const [lastRun, setLastRun] = useState(null);
  const [sanctumTab, setSanctumTab] = useState("vessels");
  const [runKE, setRunKE] = useState(0);       // embers banked from kills + purges this run
  const [runKills, setRunKills] = useState(0); // kill count this run (display)
  const [purgeClears, setPurgeClears] = useState(0);
  const [cleanPurges, setCleanPurges] = useState(0);
  const [runBossKills, setRunBossKills] = useState(0);
  const [modifier, setModifier] = useState(null);
  const [celebrate, setCelebrate] = useState(0);
  const [showModNote, setShowModNote] = useState(false);
  const [inspect, setInspect] = useState(null); // {name, tone, desc} info card, or null
  const [stylePoints, setStylePoints] = useState(0); // accumulated style; rank derives from it
  // consecutive idle WAITs not yet decayed: the first WAIT after any action or kill
  // is free (grace), so a single pause never ends a streak. Carries across floors.
  const [idleWaits, setIdleWaits] = useState(0);
  const styleStep = styleRank(stylePoints);
  const [runBestStyle, setRunBestStyle] = useState(0);
  const relicSet = useMemo(() => new Set(relics), [relics]);
  const [records, setRecords] = useState(REC0);
  const [achievements, setAchievements] = useState([]);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, ms = 1900) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // hold long enough to read — never shorter than the rise animation
    toastTimer.current = setTimeout(() => setToast(null), Math.max(ms, 1800));
  }, []);
  const lockRef = useRef(false);
  const commitRef = useRef(null);
  const fxId = useRef(0);
  const inspectOf = useCallback((info) => { if (!info) return; SFX.play("tap"); setInspect(info); }, []);

  // load persistent meta once on mount (storage may be absent — fail soft)
  useEffect(() => {
    let alive = true;
    try {
      const raw =
        typeof window !== "undefined" && window.localStorage
          ? window.localStorage.getItem(META_KEY)
          : null;
      if (alive && raw) {
        const m = JSON.parse(raw);
        setEmbers(m.embers || 0);
        const u = Array.isArray(m.unlocked) && m.unlocked.length ? m.unlocked : ["wanderer"];
        setUnlocked(u);
        setSelectedVessel(u.includes(m.selected) ? m.selected : "wanderer");
        setBest(m.best || 0);
        if (m.records) setRecords({ ...REC0, ...m.records });
        if (Array.isArray(m.achievements)) setAchievements(m.achievements);
        if ((m.best || 0) > 0) return () => { alive = false; };
      }
    } catch (e) {}
    if (alive) setSanctumTab("guide"); // first-timer: open the guide
    return () => { alive = false; };
  }, []);

  const saveMeta = useCallback((next) => {
    try {
      if (typeof window !== "undefined" && window.localStorage)
        window.localStorage.setItem(META_KEY, JSON.stringify(next));
    } catch (e) {}
  }, []);

  const spawnFx = useCallback((kind, x, y, tiles, val) => {
    const id = ++fxId.current;
    setFx((arr) => [...arr, { id, kind, x, y, tiles, val }]);
    setTimeout(() => setFx((arr) => arr.filter((f) => f.id !== id)), 1500);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => { const n = !m; SFX.setMuted(n); if (!n) SFX.ensure(); return n; });
  }, []);

  // Translate a resolved turn's events into sound + on-board VFX + haptics.
  const playEvents = useCallback((events, hpTaken, wardUsed) => {
    let shook = false;
    for (const ev of events) {
      switch (ev.kind) {
        case "move": SFX.play("move"); break;
        case "dash": SFX.play("dash"); break;
        case "leap": SFX.play("dash"); break;
        case "blink": SFX.play("swap"); spawnFx("puff", ev.x, ev.y); break;
        case "wall": SFX.play("wall"); spawnFx("wall", ev.x, ev.y); break;
        case "swap": SFX.play("swap"); spawnFx("puff", ev.x, ev.y); break;
        case "shove": SFX.play("shove"); spawnFx("puff", ev.x, ev.y); break;
        case "beam": SFX.play("beam"); spawnFx("beam", 0, 0, ev.tiles); break;
        case "slash": SFX.play("slash"); break;
        case "stagger": SFX.play("stagger"); spawnFx("puff", ev.x, ev.y); break;
        case "kill":
          SFX.play("kill"); spawnFx("shatter", ev.x, ev.y);
          SFX.play("ember"); spawnFx("ember", ev.x, ev.y, null, ev.boss ? EM.boss : EM.kill);
          break;
        case "detonate":
          SFX.play("detonate"); spawnFx("detonate", ev.x, ev.y, ev.tiles);
          if (!shook) { shook = true; setShaking(true); setTimeout(() => setShaking(false), 440); buzz([0, 35, 25, 55]); }
          break;
        case "descend": SFX.play("descend"); break;
        default: break;
      }
    }
    if (wardUsed > 0) SFX.play("ward");
    if (hpTaken > 0) { SFX.play("hurt"); buzz(45); }
  }, [spawnFx]);

  const startFloor = useCallback((d, relicList = relics) => {
    const f = generateFloor(d);
    setFloor({ pits: f.pits, stairs: f.stairs, event: f.event, cache: f.cache });
    setPlayer(f.player);
    setEnemies(f.enemies);
    setWalls([]);
    setFloorDamage(0);
    setStaged(null);
    setArmed(null);
    setPursuit(0);
    setModifier(f.modifier || null);
    setFloorWard(relicList.includes("ward"));
    setCacheTaken(false);
    setInspect(null);
    setVerbs((vs) => vs.map((v) => ({ ...v, cd: 0 })));
    setPhase("play");
    if (f.enemies.some((e) => e.type === "warlord")) {
      SFX.play("boss");
      showToast("⚔  THE WARLORD", 1300);
    } else if (f.event === "vault") {
      SFX.play("reward");
      showToast("✦  TREASURE VAULT", 1300);
    } else if (f.event === "gauntlet") {
      SFX.play("boss");
      showToast("☠  GAUNTLET · " + MODIFIERS[f.modifier].label, 1500);
    } else if (f.modifier) {
      SFX.play("boss");
      showToast(MODIFIERS[f.modifier].label, 1300);
    }
  }, [showToast, relics]);

  const beginGame = useCallback(() => {
    SFX.ensure();
    const v = VESSEL_BY_ID[selectedVessel] || VESSEL_BY_ID.wanderer;
    setHp(MAX_HP);
    setDepth(1);
    setCleanClears(0);
    setWards(v.wards);
    setVerbs(v.verbs.map((id) => ({ id, baseCd: VERB_INFO[id].baseCd, cd: 0 })));
    setLastRun(null);
    setRunKE(0);
    setRunKills(0);
    setPurgeClears(0);
    setCleanPurges(0);
    setRunBossKills(0);
    setStylePoints(0);
    setIdleWaits(0);
    setRunBestStyle(0);
    setRelics([]);
    setSatchel([]);
    startFloor(1, []);
  }, [startFloor, selectedVessel]);

  const unlockVessel = useCallback((v) => {
    if (unlocked.includes(v.id)) { setSelectedVessel(v.id); SFX.play("move"); return; }
    if (embers < v.cost) return;
    const ne = embers - v.cost;
    const nu = [...unlocked, v.id];
    setEmbers(ne);
    setUnlocked(nu);
    setSelectedVessel(v.id);
    SFX.play("reward");
    saveMeta({ embers: ne, unlocked: nu, selected: v.id, best, records, achievements });
  }, [unlocked, embers, best, saveMeta, records, achievements]);

  const enemyById = useCallback((id) => enemies.find((e) => e.id === id), [enemies]);
  const wallSet = useMemo(() => wallsToSet(walls), [walls]);
  const ownsVerb = (id) => verbs.some((v) => v.id === id);
  const verbCd = (id) => { const v = verbs.find((x) => x.id === id); return v ? v.cd : 0; };

  /* ---------- targeting ---------- */
  const pushable = useMemo(() => {
    const m = {};
    if (!floor) return m;
    for (const e of enemies) {
      if (manhattan(e, player) !== 1) continue;
      const dest = { x: e.x + sign(e.x - player.x), y: e.y + sign(e.y - player.y) };
      if (!inBounds(dest.x, dest.y) || wallSet.has(key(dest.x, dest.y))) continue;
      if (enemies.some((o) => o.id !== e.id && o.x === dest.x && o.y === dest.y)) continue;
      m[e.id] = { dest, dies: floor.pits.has(key(dest.x, dest.y)) };
    }
    return m;
  }, [enemies, player, floor, wallSet]);

  const pullable = useMemo(() => {
    const m = {};
    if (!floor) return m;
    for (const e of enemies) {
      let mid = null;
      if (e.y === player.y && Math.abs(e.x - player.x) === 2) mid = { x: (e.x + player.x) / 2, y: e.y };
      else if (e.x === player.x && Math.abs(e.y - player.y) === 2) mid = { x: e.x, y: (e.y + player.y) / 2 };
      if (!mid) continue;
      if (wallSet.has(key(mid.x, mid.y))) continue;
      if (enemies.some((o) => o.id !== e.id && o.x === mid.x && o.y === mid.y)) continue;
      m[e.id] = { dest: mid, dies: floor.pits.has(key(mid.x, mid.y)) };
    }
    return m;
  }, [enemies, player, floor, wallSet]);

  const swappable = useMemo(() => {
    const m = {};
    if (!floor) return m;
    // directional: scan each cardinal line for the first foe on a clear path
    for (const [dx, dy] of DIRS) {
      for (let step = 1; step <= SWAP_RANGE; step++) {
        const x = player.x + dx * step, y = player.y + dy * step;
        if (!inBounds(x, y)) break;
        const k = key(x, y);
        if (floor.pits.has(k) || wallSet.has(k)) break; // blocked by terrain
        const e = enemies.find((en) => en.x === x && en.y === y);
        if (e) {
          if (e.type !== "warlord") m[e.id] = true; // the Warlord won't budge
          break; // a foe blocks the line beyond it
        }
      }
    }
    return m;
  }, [enemies, player, floor, wallSet]);

  const wallTargets = useMemo(() => {
    const s = new Set();
    if (!floor) return s;
    for (const [dx, dy] of DIRS) {
      const x = player.x + dx, y = player.y + dy;
      if (!inBounds(x, y)) continue;
      const k = key(x, y);
      if (floor.pits.has(k) || wallSet.has(k)) continue;
      if (k === key(floor.stairs.x, floor.stairs.y)) continue;
      if (enemies.some((e) => e.x === x && e.y === y)) continue;
      s.add(k);
    }
    return s;
  }, [player, floor, enemies, wallSet]);

  const dashTargets = useMemo(() => {
    const s = new Set();
    if (!floor) return s;
    const free = (x, y) =>
      inBounds(x, y) && !floor.pits.has(key(x, y)) && !wallSet.has(key(x, y)) &&
      !enemies.some((e) => e.x === x && e.y === y);
    for (const [dx, dy] of DIRS) {
      const t1 = { x: player.x + dx, y: player.y + dy };
      const t2 = { x: player.x + 2 * dx, y: player.y + 2 * dy };
      if (free(t1.x, t1.y) && free(t2.x, t2.y)) s.add(key(t2.x, t2.y));
    }
    return s;
  }, [player, floor, enemies, wallSet]);

  // LEAP: vault over exactly one adjacent obstacle — a pit or a non-Warlord foe —
  // and land on the empty tile beyond. The jumped tile is left untouched.
  const leapTargets = useMemo(() => {
    const s = new Set();
    if (!floor) return s;
    const land = (x, y) =>
      inBounds(x, y) && !floor.pits.has(key(x, y)) && !wallSet.has(key(x, y)) &&
      !enemies.some((e) => e.x === x && e.y === y);
    for (const [dx, dy] of DIRS) {
      const mx = player.x + dx, my = player.y + dy;        // jumped tile
      const lx = player.x + 2 * dx, ly = player.y + 2 * dy; // landing tile
      if (!inBounds(mx, my)) continue;
      const overPit = floor.pits.has(key(mx, my));
      const foe = enemies.find((e) => e.x === mx && e.y === my);
      const overFoe = foe && foe.type !== "warlord";
      if ((overPit || overFoe) && land(lx, ly)) s.add(key(lx, ly));
    }
    return s;
  }, [player, floor, enemies, wallSet]);

  const blinkTargets = useMemo(() => {
    const s = new Set();
    if (!floor) return s;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = manhattan({ x, y }, player);
        if (d < 1 || d > BLINK_RANGE) continue;
        const k = key(x, y);
        if (floor.pits.has(k) || wallSet.has(k)) continue;
        if (enemies.some((e) => e.x === x && e.y === y)) continue;
        if (k === key(floor.stairs.x, floor.stairs.y)) continue; // can't skip onto the stairs
        s.add(k);
      }
    return s;
  }, [player, floor, enemies, wallSet]);

  const verbReady = useMemo(() => ({
    push: Object.keys(pushable).length > 0,
    pull: Object.keys(pullable).length > 0,
    swap: Object.keys(swappable).length > 0,
    wall: wallTargets.size > 0,
    dash: dashTargets.size > 0,
    leap: leapTargets.size > 0,
  }), [pushable, pullable, swappable, wallTargets, dashTargets, leapTargets]);

  /* ---------- danger telegraphs ---------- */
  const dangerTiles = useMemo(() => {
    const m = new Map();
    for (const e of enemies) {
      const it = e.intent;
      if (!it || it.kind === "idle") continue;
      if (e.type === "striker" && it.tiles) for (const t of it.tiles) m.set(key(t.x, t.y), "striker");
      else if (e.type === "bomber" && it.kind === "detonate") for (const t of it.tiles) m.set(key(t.x, t.y), "bomber");
      else if (e.type === "charger" && it.tile) m.set(key(it.tile.x, it.tile.y), "charger");
      else if (e.type === "warlord") {
        if (it.beam) for (const t of it.beam) m.set(key(t.x, t.y), "striker");
        if (it.tile) m.set(key(it.tile.x, it.tile.y), "charger");
      }
    }
    if (modifier === "dark")
      for (const k of [...m.keys()]) {
        const [x, y] = k.split(",").map(Number);
        if (manhattan({ x, y }, player) > 2) m.delete(k);
      }
    return m;
  }, [enemies, modifier, player]);

  const warnTiles = useMemo(() => {
    const m = new Map();
    for (const e of enemies) {
      if (e.type !== "bomber" || !e.intent) continue;
      if (e.intent.kind === "fusing" || e.intent.kind === "arming")
        for (const t of e.intent.tiles) {
          if (modifier === "dark" && manhattan(t, player) > 2) continue;
          m.set(key(t.x, t.y), e.intent.fuse || 0);
        }
    }
    return m;
  }, [enemies, modifier, player]);

  /* ---------- preview ---------- */
  const preview = useMemo(() => {
    if (!floor || phase !== "play") return null;
    return resolve(
      { pits: floor.pits, stairs: floor.stairs, player, enemies, walls },
      staged ?? { type: "wait" },
      relicSet
    );
  }, [floor, player, enemies, walls, staged, phase, relicSet]);

  const rawDmg = preview ? preview.dmg : 0;
  const absorb = wards + (floorWard ? 1 : 0);
  const wardSave = rawDmg > 0 && absorb > 0;
  const hpLoss = wardSave ? Math.max(0, rawDmg - absorb) : rawDmg;
  const onDanger = hpLoss > 0;

  let finalPos = player;
  if (staged?.type === "move" || staged?.type === "dash" || staged?.type === "leap" || staged?.type === "blink") finalPos = staged.to;
  else if (staged?.type === "swap") { const e = enemyById(staged.targetId); if (e) finalPos = { x: e.x, y: e.y }; }

  /* ---------- input ---------- */
  const stagedTargetTile = useCallback((s) => {
    if (!s) return null;
    if (s.type === "move" || s.type === "dash" || s.type === "leap" || s.type === "wall" || s.type === "blink") return s.to;
    const e = enemyById(s.targetId);
    return e ? { x: e.x, y: e.y } : null;
  }, [enemyById]);

  const tapCell = useCallback((x, y) => {
    if (phase !== "play" || lockRef.current) return;
    if (staged) {
      const ct = stagedTargetTile(staged);
      if (ct && ct.x === x && ct.y === y) { commitRef.current && commitRef.current(); return; }
    }
    if (armed) {
      const e = enemies.find((en) => en.x === x && en.y === y);
      if (armed === "push" && e && pushable[e.id]) setStaged({ type: "push", targetId: e.id, to: pushable[e.id].dest, dies: pushable[e.id].dies });
      else if (armed === "pull" && e && pullable[e.id]) setStaged({ type: "pull", targetId: e.id, to: pullable[e.id].dest, dies: pullable[e.id].dies });
      else if (armed === "swap" && e && swappable[e.id]) setStaged({ type: "swap", targetId: e.id });
      else if (armed === "wall" && wallTargets.has(key(x, y))) setStaged({ type: "wall", to: { x, y } });
      else if (armed === "dash" && dashTargets.has(key(x, y))) setStaged({ type: "dash", to: { x, y } });
      else if (armed === "leap" && leapTargets.has(key(x, y))) setStaged({ type: "leap", to: { x, y } });
      else if (armed === "blink" && blinkTargets.has(key(x, y))) setStaged({ type: "blink", to: { x, y }, item: "blink" });
      else return;
      SFX.play("tap");
      setArmed(null);
      return;
    }
    // not armed: tapping a foe inspects it; tapping yourself clears a stage or inspects
    const foe = enemies.find((e) => e.x === x && e.y === y);
    if (foe) { inspectOf(INSPECT[foe.type]); return; }
    if (x === player.x && y === player.y) { if (staged) setStaged(null); else inspectOf(INSPECT.player); return; }
    if (manhattan({ x, y }, player) !== 1) return;
    if (floor.pits.has(key(x, y)) || wallSet.has(key(x, y))) return;
    if (enemies.some((e) => e.x === x && e.y === y)) return;
    SFX.play("tap");
    setStaged({ type: "move", to: { x, y } });
  }, [phase, staged, armed, enemies, pushable, pullable, swappable, wallTargets, dashTargets, leapTargets, blinkTargets, player, floor, wallSet, stagedTargetTile, inspectOf]);

  const armVerb = useCallback((id) => {
    if (phase !== "play" || verbCd(id) > 0 || !verbReady[id]) return;
    setStaged(null);
    setArmed((a) => (a === id ? null : id));
  }, [phase, verbs, verbReady]);

  const useConsumable = useCallback((id) => {
    if (phase !== "play" || lockRef.current || !satchel.includes(id)) return;
    const mode = CONSUMABLES[id].mode;
    if (mode === "passive") { showToast("PHOENIX WAITS", 900); return; }
    SFX.play("tap");
    if (mode === "target") { setStaged(null); setArmed((a) => (a === "blink" ? null : "blink")); return; }
    // instant: stage a self-action so the player sees the preview before committing
    setArmed(null);
    setStaged({ type: id, item: id });
  }, [phase, satchel, showToast]);

  /* ---------- commit ---------- */
  const commit = useCallback(() => {
    if (phase !== "play" || lockRef.current || !floor) return;
    SFX.ensure();
    const action = staged ?? { type: "wait" };
    if (staged) SFX.play("confirm");
    const pv = resolve({ pits: floor.pits, stairs: floor.stairs, player, enemies, walls }, action, relicSet);

    lockRef.current = true;
    setPhase("resolving");
    setPlayer(pv.player);
    setEnemies(pv.enemies);
    setWalls(pv.walls);
    setStaged(null);
    setArmed(null);

    // consume a used item; Aegis conjures shields on use
    if (action.item) setSatchel((s) => { const i = s.indexOf(action.item); if (i < 0) return s; const n = [...s]; n.splice(i, 1); return n; });
    if (action.type === "aegis") setWards((w) => w + 2);

    const fwUsed = pv.dmg > 0 && floorWard ? 1 : 0;            // Warded Soul (free, per floor)
    const afterFw = pv.dmg - fwUsed;
    const wardUsed = afterFw > 0 && wards > 0 ? Math.min(afterFw, wards) : 0;
    const hpTaken = afterFw - wardUsed;
    if (hpTaken > 0) setFlash((f) => f + 1);
    playEvents(pv.events, hpTaken, wardUsed + fwUsed);

    const waited = action.type === "wait";
    const usedVerb = ["push", "wall", "pull", "swap", "dash", "leap"].includes(action.type) ? action.type : null;
    let hpNow = hp - hpTaken;
    const phoenixUsed = hpNow <= 0 && satchel.includes("phoenix");
    if (phoenixUsed) hpNow = 1; // rise from the ashes
    const floorDmgNow = floorDamage + pv.dmg;
    // loot a vault cache the player has stepped onto
    const cache = floor.cache;
    const gotCache = cache && !cacheTaken && pv.player.x === cache.x && pv.player.y === cache.y && hpNow > 0;

    setTimeout(() => {
      lockRef.current = false;
      // tally kills — pkills are the player's OWN kills (style only counts these;
      // embers count every kill, incidental blasts included).
      let ke = 0, kills = 0, bossSlain = 0, pkills = 0;
      const huntBonus = relicSet.has("hunt") ? 2 : 0;
      for (const ev of pv.events) if (ev.kind === "kill") {
        ke += (ev.boss ? EM.boss : EM.kill) + huntBonus; kills += 1;
        if (ev.boss) bossSlain += 1;
        if (ev.byPlayer) pkills += 1;
      }

      // STYLE: a flawless killing streak measured in points. Player kills add
      // points (a Warlord is worth more), holding through quiet turns; idle waits
      // bleed a point; a hit shatters it (Iron Resolve floors it at ×1.5). Ranks
      // need rising cumulative points, so ×3 RELENTLESS demands sustained hunting.
      let newPoints = stylePoints;
      let nextIdle = idleWaits;
      if (hpTaken > 0) { newPoints = relicSet.has("iron") ? Math.min(stylePoints, STYLE.thresh[1]) : 0; nextIdle = 0; }
      else if (pkills > 0) { newPoints = stylePoints + pkills + (bossSlain > 0 ? 2 : 0); nextIdle = 0; }
      else if (waited) {
        // first WAIT after any action/kill is free (grace); decay only on the 2nd+
        if (idleWaits === 0) nextIdle = 1;
        else { newPoints = Math.max(0, stylePoints - 1); nextIdle = idleWaits + 1; }
      } else nextIdle = 0; // any non-wait, non-kill action refreshes the grace
      const oldStep = styleRank(stylePoints);
      const newStep = styleRank(newPoints);
      const keScaled = Math.round(ke * STYLE.mult[newStep]);
      setStylePoints(newPoints);
      setIdleWaits(nextIdle);
      const peakStyle = Math.max(runBestStyle, newStep);
      if (peakStyle !== runBestStyle) setRunBestStyle(peakStyle);
      if (keScaled > 0) setRunKE((v) => v + keScaled);
      if (kills > 0) setRunKills((v) => v + kills);
      if (bossSlain > 0) setRunBossKills((v) => v + bossSlain);

      // collect achievements earned this turn
      const earnedAch = [];
      const tryAch = (id) => { if (!achievements.includes(id) && !earnedAch.includes(id)) earnedAch.push(id); };
      if (kills > 0) tryAch("firstblood");
      if (bossSlain > 0) tryAch("giantslayer");
      if (newStep >= 3) tryAch("relentless");

      // kill-feedback toast (an earned achievement overrides this below)
      if (phoenixUsed) { setSatchel((s) => { const i = s.indexOf("phoenix"); if (i < 0) return s; const n = [...s]; n.splice(i, 1); return n; }); SFX.play("fanfare"); setCelebrate((c) => c + 1); spawnFx("blast", pv.player.x, pv.player.y); showToast("✦  PHOENIX RISES", 1500); }
      else if (gotCache) { setSatchel((s) => s.length < SATCHEL_MAX ? [...s, cache.item] : s); setCacheTaken(true); SFX.play("reward"); spawnFx("puff", cache.x, cache.y); showToast(satchel.length < SATCHEL_MAX ? "FOUND · " + CONSUMABLES[cache.item].name : "SATCHEL FULL", 1300); }
      else if (bossSlain > 0) { SFX.play("fanfare"); setCelebrate((c) => c + 1); showToast("⚔  WARLORD SLAIN", 1300); }
      else if (kills >= 2) { SFX.play("multikill"); showToast(kills >= 4 ? "MASSACRE!" : kills === 3 ? "TRIPLE KILL!" : "DOUBLE KILL!", 1100); }
      else if (fwUsed > 0) showToast("SOUL WARDED", 900);
      else if (wardUsed > 0) showToast("WARD SHATTERS", 900);
      else if (waited && newStep < oldStep) showToast(newStep === 0 ? "STREAK ENDS" : "STREAK COOLING", 1300);
      if (fwUsed > 0) setFloorWard(false);
      if (wardUsed > 0) setWards((w) => w - wardUsed);

      // grant any achievements collected on a continuing turn (kill/descend paths)
      const applyEarned = () => {
        if (!earnedAch.length) return;
        const rew = earnedAch.reduce((s, id) => s + ACH[id].reward, 0);
        const nextAch = [...achievements, ...earnedAch];
        setAchievements(nextAch);
        setEmbers((e) => e + rew);
        SFX.play("fanfare"); setCelebrate((c) => c + 1);
        showToast("★  " + ACH[earnedAch[0]].name, 1600);
        saveMeta({ embers: embers + rew, unlocked, selected: selectedVessel, best, records, achievements: nextAch });
      };

      if (hpNow <= 0) {
        setHp(0); SFX.play("death"); buzz([0, 60, 40, 90]);
        const haul = depth * EM.depth + cleanClears * EM.clean + runKE + keScaled;
        const newRuns = records.runs + 1;
        const totalKills = records.totalKills + runKills + kills;
        if (totalKills >= 50) tryAch("exterminator");
        if (newRuns >= 10) tryAch("survivor");
        if (depth >= 10) tryAch("deep10");
        if (depth >= 20) tryAch("deep20");
        const rew = earnedAch.reduce((s, id) => s + ACH[id].reward, 0);
        const nextAch = [...achievements, ...earnedAch];
        const newRecords = {
          bestDepth: Math.max(records.bestDepth, depth),
          maxEmbersRun: Math.max(records.maxEmbersRun, haul),
          totalKills,
          totalCleanPurges: records.totalCleanPurges + cleanPurges,
          totalBosses: records.totalBosses + runBossKills + bossSlain,
          runs: newRuns,
          bestStyle: Math.max(records.bestStyle, peakStyle),
        };
        const ne = embers + haul + rew;
        const nb = Math.max(best, depth);
        setEmbers(ne); setBest(nb); setRecords(newRecords); setAchievements(nextAch);
        setLastRun({ depth, clears: cleanClears, kills: runKills + kills, earned: haul, purges: purgeClears, cleanPurges, bosses: runBossKills + bossSlain, bonus: rew, newAch: earnedAch.map((id) => ACH[id].name) });
        saveMeta({ embers: ne, unlocked, selected: selectedVessel, best: nb, records: newRecords, achievements: nextAch });
        setPhase("dead");
        return;
      }
      setHp(hpNow);
      setFloorDamage(floorDmgNow);

      if (pv.descend) {
        const clean = floorDmgNow === 0;
        const purge = pv.enemies.length === 0;
        if (clean) setCleanClears((c) => c + 1);
        if (purge) { setPurgeClears((p) => p + 1); setRunKE((v) => v + EM.purge); }
        if (clean && purge) { setCleanPurges((c) => c + 1); SFX.play("fanfare"); setCelebrate((c) => c + 1); tryAch("untouchable"); }
        if (modifier) setRunKE((v) => v + EM.mod);
        const nd = depth + 1;
        if (nd >= 10) tryAch("deep10");
        if (nd >= 20) tryAch("deep20");
        const relicPool = RELIC_ORDER.filter((id) => !relics.includes(id));
        const wantRelic = (depth % RELIC_EVERY === 0 || floor.event === "gauntlet") && relicPool.length > 0;
        if (wantRelic) {
          // relic shrine
          const pick = [...relicPool].sort(() => Math.random() - 0.5).slice(0, 3);
          setRewardKind("relic");
          setRewardOptions(pick.map((id) => RELICS[id]));
        } else {
          const opts = rollVerbDraft(clean, purge);
          setRewardKind("verb");
          setRewardOptions(opts.map((id) => REWARDS[id]));
        }
        setPendingDepth(nd);
        showToast(clean && purge ? "CLEAN PURGE" : purge ? "PURGE" : clean ? "CLEAN DESCENT" : "DESCEND", 1100);
        applyEarned();
        setPhase("reward");
      } else {
        const blood = relicSet.has("blood") && kills > 0 ? 1 : 0;
        setVerbs((vs) => vs.map((v) => {
          const base = v.id === usedVerb ? v.baseCd : Math.max(0, v.cd - 1);
          return { ...v, cd: Math.max(0, base - blood) };
        }));
        // A "stalled" turn is any loitering: a literal WAIT, or a move/verb that
        // got no closer to the portal and slew nothing — so pacing back and forth
        // can no longer dodge pursuit (and farm a pit-blocked boss) for free.
        // Advancing toward the portal, or killing, still drains pursuit.
        const advanced = manhattan(pv.player, floor.stairs) < manhattan(player, floor.stairs);
        const stalled = waited || (!advanced && kills === 0);
        const nextPursuit = stalled ? pursuit + (modifier === "hunting" ? 2 : 1) : Math.max(0, pursuit - 1);
        let live = pv.enemies;
        if (stalled && nextPursuit >= PURSUIT_MAX && live.length < 6) {
          const spawn = farEdgeSpawn(pv.player, live, floor.pits, floor.stairs);
          if (spawn) {
            const nid = Math.max(0, ...live.map((e) => e.id)) + 1;
            live = [...live, { id: nid, type: "charger", x: spawn.x, y: spawn.y }];
            showToast("THE DARK STIRS", 900);
            setPursuit(0);
          } else setPursuit(nextPursuit);
        } else setPursuit(nextPursuit);
        const liveFuses = live.filter((e) => e.type === "bomber" && e.fuse > 0).map((e) => e.fuse);
        if (liveFuses.length) SFX.play("fuse", { urgent: Math.min(...liveFuses) === 1 });
        applyEarned();
        setEnemies(withIntents(pv.player, live, floor.pits, pv.walls));
        setPhase("play");
      }
    }, RESOLVE_MS);
  }, [phase, floor, staged, player, enemies, walls, hp, floorDamage, depth, cleanClears, pursuit, wards, playEvents, embers, best, unlocked, selectedVessel, saveMeta, runKE, runKills, modifier, purgeClears, cleanPurges, runBossKills, stylePoints, idleWaits, runBestStyle, records, achievements, showToast, relics, relicSet, floorWard, satchel, cacheTaken, spawnFx]);
  commitRef.current = commit;

  const chooseReward = useCallback((r) => {
    // premium boons cost embers — a real choice, and an ember sink. A common card
    // is always on offer, so an unaffordable premium just means: pick another.
    const premiumPick = rewardKind === "verb" && r.tier === "premium";
    if (premiumPick && embers < PREMIUM_COST) { SFX.play("tap"); showToast("NOT ENOUGH ✦", 900); return; }
    SFX.play("reward");
    if (rewardKind === "relic") {
      const next = relics.includes(r.id) ? relics : [...relics, r.id];
      setRelics(next);
      setDepth(pendingDepth);
      startFloor(pendingDepth, next);
      return;
    }
    if (r.type === "charge") setWards((w) => w + 1);
    else if (r.type === "special" && r.id === "empower")
      setVerbs((vs) => vs.map((v) => ({ ...v, baseCd: Math.max(v.id === "push" ? 0 : 1, v.baseCd - 1) })));
    else if (r.type === "verb")
      setVerbs((vs) => {
        if (vs.some((v) => v.id === r.id)) return vs.map((v) => (v.id === r.id ? { ...v, baseCd: Math.max(1, v.baseCd - 1) } : v));
        return [...vs, { id: r.id, baseCd: VERB_INFO[r.id].baseCd, cd: 0 }];
      });
    if (premiumPick) {
      const ne = embers - PREMIUM_COST;
      setEmbers(ne);
      saveMeta({ embers: ne, unlocked, selected: selectedVessel, best, records, achievements });
    }
    setDepth(pendingDepth);
    startFloor(pendingDepth, relics);
  }, [pendingDepth, startFloor, rewardKind, relics, embers, showToast, saveMeta, unlocked, selectedVessel, best, records, achievements]);

  /* ---------- render helpers ---------- */
  const pct = (v) => `${(v / W) * 100}%`;
  const center = (v) => `${((v + 0.5) / W) * 100}%`;
  const uiActive = phase === "play" || phase === "resolving";

  const cells = [];
  if (floor) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = key(x, y);
        const isPit = floor.pits.has(k);
        const isStairs = floor.stairs.x === x && floor.stairs.y === y;
        const isWall = wallSet.has(k);
        const isCache = floor.cache && !cacheTaken && floor.cache.x === x && floor.cache.y === y;
        const isMoveStage = (staged?.type === "move" || staged?.type === "dash" || staged?.type === "leap" || staged?.type === "blink") && staged.to.x === x && staged.to.y === y;
        const isWallStage = staged?.type === "wall" && staged.to.x === x && staged.to.y === y;
        const moveOption = phase === "play" && !armed && !isPit && !isWall && !isStairs &&
          manhattan({ x, y }, player) === 1 &&
          !enemies.some((e) => e.x === x && e.y === y) && !(x === player.x && y === player.y);
        const tileTarget = phase === "play" &&
          ((armed === "wall" && wallTargets.has(k)) || (armed === "dash" && dashTargets.has(k)) || (armed === "leap" && leapTargets.has(k)) || (armed === "blink" && blinkTargets.has(k)));
        cells.push(
          <button key={k} onClick={() => tapCell(x, y)} className="cell"
            style={{ left: pct(x), top: pct(y), width: pct(1), height: pct(1), cursor: phase === "play" ? "pointer" : "default" }}>
            <span className={`tile ${isPit ? "pit" : ""} ${isStairs ? "stairs" : ""} ${isWall ? "wall" : ""} ${moveOption ? "canMove" : ""} ${tileTarget ? "tgt" : ""}`}>
              {isStairs && (
                <svg viewBox="0 0 100 100" width="78%" height="78%" className="portal">
                  <circle cx="50" cy="50" r="34" fill="none" stroke="var(--teal)" strokeWidth="2.5" opacity="0.9" />
                  <circle cx="50" cy="50" r="34" fill="none" stroke="var(--teal)" strokeWidth="6" strokeDasharray="3 9" className="portalRing" />
                  <circle cx="50" cy="50" r="20" fill="rgba(84,226,198,0.16)" stroke="var(--teal)" strokeWidth="1.5" />
                  <path d="M50 36 L50 64 M40 46 L60 46 M40 56 L60 56" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {isCache && (
                <svg viewBox="0 0 24 24" width="62%" height="62%" className="cacheGlyph" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="9" width="16" height="10" rx="1.5" />
                  <path d="M4 13h16M12 9v10" />
                  <path d="M8 9V7a4 4 0 0 1 8 0v2" />
                </svg>
              )}
            </span>
            {moveOption && <span className="moveDot" />}
            {isMoveStage && <span className="moveStage" />}
            {isWallStage && <span className="wallStage" />}
          </button>
        );
      }
  }

  const dangerLayer = [];
  if (floor && phase === "play") {
    for (const [k, t] of warnTiles.entries()) {
      const [x, y] = k.split(",").map(Number);
      dangerLayer.push(<div key={"w" + k} className="warnTile" style={{ left: pct(x), top: pct(y), width: pct(1), height: pct(1) }} />);
    }
    for (const [k, etype] of dangerTiles.entries()) {
      const [x, y] = k.split(",").map(Number);
      const hot = finalPos.x === x && finalPos.y === y;
      dangerLayer.push(
        <div key={"d" + k} className={`danger ${hot ? "hot" : ""}`} style={{ left: pct(x), top: pct(y), width: pct(1), height: pct(1) }}>
          <span className="dangerInner" data-t={etype} />
        </div>
      );
    }
  }

  const ghosts = [];
  if (staged?.type === "push" || staged?.type === "pull")
    ghosts.push(
      <div key="pg" className={`ghost ${staged.dies ? "ghostKill" : "ghostStun"}`} style={{ left: center(staged.to.x), top: center(staged.to.y) }}>
        {staged.dies ? "✕" : "z"}
      </div>
    );
  if (staged?.type === "swap") {
    const e = enemyById(staged.targetId);
    if (e) ghosts.push(<div key="sg" className="ghost ghostSwap" style={{ left: center(e.x), top: center(e.y) }}>⇄</div>);
  }

  const orderedVerbs = ["push", "wall", "pull", "swap", "dash", "leap"].filter(ownsVerb).map((id) => verbs.find((v) => v.id === id));

  // the consumable currently armed (blink) or staged (instant) — drives a tooltip
  // so the player reads what it does before committing
  const activeConsumable = armed === "blink" ? "blink" : (staged?.item ?? null);

  // progress (0..1) toward the next style rank — fills the partial segment
  const styleCur = STYLE.thresh[styleStep];
  const styleNext = STYLE.thresh[Math.min(styleStep + 1, STYLE.thresh.length - 1)];
  const styleFrac = styleStep >= STYLE.thresh.length - 1 ? 1
    : styleNext > styleCur ? Math.max(0, Math.min(1, (stylePoints - styleCur) / (styleNext - styleCur))) : 0;

  /* ---------- screen ---------- */
  return (
    <div className="root">
      <style>{CSS}</style>
      <SigilDefs />
      <div className="grain" />
      <div className="vignette" />
      <div className="motes">{Array.from({ length: 7 }).map((_, i) => <span key={i} className={`mote m${i}`} />)}</div>
      {flash > 0 && <div className="hurt" key={flash} />}
      {celebrate > 0 && <div className="celebrate" key={"c" + celebrate} />}
      <div className="frame">
        <header className="hud">
          <div className="hudLeft">
            <div className="hp">
              <button className="hpPips inspectTap" onClick={() => inspectOf(INSPECT.player)} aria-label="inspect yourself">
                {Array.from({ length: MAX_HP }).map((_, i) => (
                  <span key={i} className={`pip ${i < hp ? "on" : "off"}`} />
                ))}
              </button>
              {wards > 0 && <button className="wardBadge inspectTap" onClick={() => inspectOf(INSPECT.ward)}>◈{wards}</button>}
            </div>
            <button className="pursuit inspectTap" onClick={() => inspectOf(INSPECT.pursuit)} aria-label="inspect pursuit">
              <span className="pLabel">⟁</span>
              {Array.from({ length: PURSUIT_MAX }).map((_, i) => (
                <span key={i} className={`pdot ${i < pursuit ? "on" : ""}`} />
              ))}
            </button>
            {relics.length > 0 && (
              <div className="relicShelf">
                {relics.map((id) => (
                  <button key={id} className={`relicChip inspectTap ${id === "ward" && floorWard ? "armed" : ""}`}
                    onClick={() => inspectOf({ name: RELICS[id].name, tone: "gold", desc: RELICS[id].desc })}
                    title={`${RELICS[id].name} — ${RELICS[id].desc}`}>
                    <RelicIcon id={id} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="titleWrap">
            <div className="title">PITS AND PORTALS</div>
            {modifier && uiActive && (
              <button className="modTag" onClick={() => { setShowModNote((s) => !s); setTimeout(() => setShowModNote(false), 3500); }}>
                {MODIFIERS[modifier].label}
              </button>
            )}
            {showModNote && modifier && <div className="modNote">{MODIFIERS[modifier].note}</div>}
          </div>
          <div className="stats">
            <span className="depth">DEPTH {depth}</span>
            <span className="haul">✦ {depth * EM.depth + cleanClears * EM.clean + runKE}</span>
            <span className="clean">◆ {cleanClears}</span>
          </div>
        </header>

        {/* fixed-height slot so the board never shifts as the streak comes and goes */}
        {uiActive && (
          <div className="styleSlot">
            {styleStep > 0 && (
              <div className="styleBar" key={"sb" + styleStep}>
                <span className="styleRank">{STYLE.rank[styleStep]}</span>
                <span className="styleSegs">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`seg ${i < styleStep ? "on" : ""}`}>
                      {i === styleStep && styleStep < 3 && (
                        <span className="segFill" style={{ width: `${Math.round(styleFrac * 100)}%` }} />
                      )}
                    </span>
                  ))}
                </span>
                <span className="styleMult">×{STYLE.mult[styleStep]}</span>
              </div>
            )}
          </div>
        )}

        <div className="boardWrap">
          <button className="mute" onClick={toggleMute} aria-label="toggle sound">{muted ? "♪⃠" : "♪"}</button>
          <div className={`board ${onDanger ? "warn" : ""} ${shaking ? "shaking" : ""}`}>
            <div className="layer">{cells}</div>
            <div className="layer noTap">{dangerLayer}</div>
            {modifier === "dark" && uiActive && (
              <div className="fog noTap" style={{ left: center(player.x), top: center(player.y) }} />
            )}
            <div className="layer noTap" key={depth}>
              {enemies.map((e) => (
                <div key={e.id}
                  className={`token ${e.type} ${e.type === "bomber" && e.fuse === 1 ? "primed" : ""} ${armed && ((armed === "push" && pushable[e.id]) || (armed === "pull" && pullable[e.id]) || (armed === "swap" && swappable[e.id])) ? "tgtRing" : ""}`}
                  style={{ left: center(e.x), top: center(e.y), width: pct(e.type === "warlord" ? 0.8 : 0.62), height: pct(e.type === "warlord" ? 0.8 : 0.62) }}>
                  <Glyph type={e.type} />
                  {e.type === "bomber" && e.fuse > 0 && <span className={`fuse ${e.fuse === 1 ? "hot" : ""}`}>{e.fuse}</span>}
                  {e.type === "warlord" && (
                    <span className="armor">
                      {Array.from({ length: e.hp || 1 }).map((_, i) => <span key={i} className="plate" />)}
                    </span>
                  )}
                </div>
              ))}
              <div className="token player" style={{ left: center(player.x), top: center(player.y), width: pct(0.62), height: pct(0.62) }}>
                <Glyph type="player" />
              </div>
              {ghosts}
            </div>
            <div className="layer noTap">
              {fx.map((f) => {
                if (f.kind === "detonate")
                  return (
                    <div key={f.id}>
                      <div className="fxRing" style={{ left: center(f.x), top: center(f.y) }} />
                      {f.tiles.map((t, i) => (
                        <div key={i} className="fxBlast" style={{ left: pct(t.x), top: pct(t.y), width: pct(1), height: pct(1) }} />
                      ))}
                    </div>
                  );
                if (f.kind === "beam")
                  return (
                    <div key={f.id}>
                      {(f.tiles || []).map((t, i) => (
                        <div key={i} className="fxBeam" style={{ left: pct(t.x), top: pct(t.y), width: pct(1), height: pct(1) }} />
                      ))}
                    </div>
                  );
                if (f.kind === "shatter")
                  return <div key={f.id} className="fxShatter" style={{ left: center(f.x), top: center(f.y) }}>✦</div>;
                if (f.kind === "wall")
                  return <div key={f.id} className="fxWall" style={{ left: pct(f.x), top: pct(f.y), width: pct(1), height: pct(1) }} />;
                if (f.kind === "puff")
                  return <div key={f.id} className="fxPuff" style={{ left: center(f.x), top: center(f.y) }} />;
                if (f.kind === "ember")
                  return <div key={f.id} className="fxEmber" style={{ left: center(f.x), top: center(f.y) }}>+{f.val} ✦</div>;
                return null;
              })}
            </div>
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>

        <div className={`banner ${onDanger ? "bad" : wardSave ? "ward" : "good"}`}>
          {phase === "play" && (onDanger
            ? `⚠  Committing costs ${hpLoss} HP`
            : wardSave
            ? "◈  A ward will absorb this hit"
            : staged
            ? "✓  Clean — no damage"
            : styleStep > 0
            ? "✦  Safe — but WAIT bleeds your streak"
            : "✓  Safe to wait")}
          {phase === "resolving" && "…"}
        </div>

        {satchel.length > 0 && (
          <div className="satchelWrap">
            {activeConsumable && CONSUMABLES[activeConsumable] && (
              <div className="cTip"><b>{CONSUMABLES[activeConsumable].name}</b> — {CONSUMABLES[activeConsumable].desc}</div>
            )}
            <div className="satchel">
              {Array.from(new Set(satchel)).map((id) => {
                const count = satchel.filter((s) => s === id).length;
                const passive = CONSUMABLES[id].mode === "passive";
                const active = (id === "blink" && armed === "blink") || staged?.item === id;
                return (
                  <button key={id} className={`cbtn ${active ? "armed" : ""} ${passive ? "passive" : ""}`}
                    disabled={phase !== "play"} onClick={() => useConsumable(id)}
                    title={`${CONSUMABLES[id].name} — ${CONSUMABLES[id].desc}`}>
                    <span className="cicon"><ConsumableIcon id={id} /></span>
                    <span className="clabel">{CONSUMABLES[id].name.split(" ")[0]}</span>
                    {count > 1 && <span className="ccount">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="verbs">
          {orderedVerbs.map((v) => {
            const ready = verbReady[v.id] && v.cd === 0;
            return (
              <button key={v.id}
                className={`vbtn ${armed === v.id ? "armed" : ""} ${v.cd > 0 ? "charging" : ""}`}
                disabled={phase !== "play" || !ready}
                onClick={() => armVerb(v.id)}>
                <span className="vicon"><VerbIcon id={v.id} /></span>
                <span className="vlabel">{VERB_INFO[v.id].label}</span>
                {v.cd > 0 && (
                  <>
                    <span className="cdFill" style={{ height: `${Math.min(1, v.cd / Math.max(1, v.baseCd)) * 100}%` }} />
                    <span className="cdNum">{v.cd}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="actions">
          <button className="btn clear" disabled={phase !== "play" || (!staged && !armed)}
            onClick={() => { setStaged(null); setArmed(null); }}>
            CLEAR
          </button>
          <button className="btn commit" disabled={!uiActive} onClick={commit}>
            {staged ? "COMMIT" : "WAIT"}
          </button>
        </div>

        <div className="inspectHint">tap any token or icon to inspect it</div>
      </div>

      {inspect && (
        <div className="inspectOverlay" onClick={() => setInspect(null)}>
          <div className={`inspectCard tone-${inspect.tone || "gold"}`} onClick={(e) => e.stopPropagation()}>
            <div className="inspectName">{inspect.name}</div>
            <div className="inspectDesc">{inspect.desc}</div>
            <button className="btn inspectClose" onClick={() => setInspect(null)}>CLOSE</button>
          </div>
        </div>
      )}

      {phase === "intro" && (
        <div className="overlay">
          <div className="panel sanctum">
            <div className="crest" aria-hidden="true">
              <svg viewBox="0 0 64 40" width="64" height="40"><path d="M2 20h18l4-8 8 16 4-8h18" stroke="var(--gold)" strokeWidth="2" fill="none" strokeLinecap="round" /><circle cx="32" cy="20" r="4" fill="var(--gold)" /></svg>
            </div>
            <h1>PITS AND PORTALS</h1>
            <div className="purse">
              <span className="purseEmber">✦ {embers}</span>
              <span className="purseSep" />
              <span className="purseBest">deepest {best}</span>
            </div>

            <div className="tabs">
              <button className={`tab ${sanctumTab === "vessels" ? "on" : ""}`} onClick={() => setSanctumTab("vessels")}>VESSELS</button>
              <button className={`tab ${sanctumTab === "guide" ? "on" : ""}`} onClick={() => setSanctumTab("guide")}>GUIDE</button>
              <button className={`tab ${sanctumTab === "annals" ? "on" : ""}`} onClick={() => setSanctumTab("annals")}>ANNALS</button>
            </div>

            <div className="tabBody">
              {sanctumTab === "vessels" && (
                <div className="vessels">
                  {VESSELS.map((v) => {
                    const owned = unlocked.includes(v.id);
                    const sel = selectedVessel === v.id;
                    const afford = embers >= v.cost;
                    return (
                      <button key={v.id}
                        className={`vessel ${sel ? "sel" : ""} ${owned ? "owned" : afford ? "afford" : "locked"}`}
                        onClick={() => unlockVessel(v)} disabled={!owned && !afford}>
                        <span className="vIcon"><VesselIcon id={v.id} /></span>
                        <span className="vBody">
                          <span className="vtop">
                            <span className="vname">{v.name}</span>
                            <span className={`vstate ${owned && sel ? "eq" : ""}`}>{owned ? (sel ? "EQUIPPED" : "SELECT") : `✦ ${v.cost}`}</span>
                          </span>
                          <span className="vblurb">{v.blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {sanctumTab === "guide" && (
                <div className="guide">
                  <h3 className="gh">The Goal</h3>
                  <p>Reach the <span className="kt">portal</span> on each floor and descend as deep as you dare. You carry <b>3 life</b> — and there is no healing.</p>
                  <h3 className="gh">Reading Danger</h3>
                  <p><span className="badge red">RED TILES</span> show what foes strike <i>this</i> turn. Never end your move on one — a hit only lands if you stop there.</p>
                  <h3 className="gh">The Threats</h3>
                  <ul className="threats">
                    <li><span className="en crimson">Charger</span> — hunts you one step at a time.</li>
                    <li><span className="en violet">Striker</span> — fires down its row or column.</li>
                    <li><span className="en orange">Bomber</span> — detonates a cross on a fuse, slaying foes caught in it.</li>
                    <li><span className="en boss">Warlord</span> — every 5th floor; hunts and beams at once, and is armored.</li>
                  </ul>
                  <h3 className="gh">Acting</h3>
                  <p>Tap a tile to stage a move, tap again to commit. <b>Verbs</b> reposition threats — shove a foe into a pit, wall off a lane, or set up a bomb. Every floor is verified beatable without a scratch.</p>
                  <h3 className="gh">Relics &amp; Vaults</h3>
                  <p>Every few floors a <span className="kt">relic shrine</span> offers a passive boon that reshapes the run. <span className="kt">Vaults</span> hold a one-use item for your satchel — Blink Dust, Quake Flask, Aegis or Phoenix — while <span className="badge red">GAUNTLET</span> floors are cursed but guarantee a relic. No two descents play alike.</p>
                  <h3 className="gh">Glory &amp; Embers</h3>
                  <p><span className="badge teal">CLEAN</span> take no damage. <span className="badge gold">PURGE</span> slay every foe. Both at once — <span className="badge gold">CLEAN PURGE</span> — yields the richest draft. Each slain foe builds <span className="badge gold">STYLE</span>, multiplying embers — it holds as you descend and shatters only when you're struck. Embers buy new vessels.</p>
                </div>
              )}

              {sanctumTab === "annals" && (
                <div className="annals">
                  <div className="recGrid">
                    <div className="rec"><span className="rv">{records.bestDepth}</span><span className="rl">deepest</span></div>
                    <div className="rec"><span className="rv">{records.runs}</span><span className="rl">descents</span></div>
                    <div className="rec"><span className="rv">{records.totalKills}</span><span className="rl">total slain</span></div>
                    <div className="rec"><span className="rv">{records.maxEmbersRun}</span><span className="rl">best haul</span></div>
                    <div className="rec"><span className="rv">{records.totalCleanPurges}</span><span className="rl">clean purges</span></div>
                    <div className="rec"><span className="rv">{records.totalBosses}</span><span className="rl">warlords</span></div>
                  </div>
                  <div className="achList">
                    {ACH_ORDER.map((id) => {
                      const got = achievements.includes(id);
                      return (
                        <div key={id} className={`ach ${got ? "got" : ""}`}>
                          <span className="achStar">{got ? "★" : "☆"}</span>
                          <span className="achText"><b>{ACH[id].name}</b> — {ACH[id].desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button className="btn commit big" onClick={beginGame}>DESCEND</button>
          </div>
        </div>
      )}
      {phase === "reward" && (
        <div className="overlay">
          <div className="panel">
            <h1 className="rewardTitle">{rewardKind === "relic" ? "A RELIC STIRS" : "CHOOSE A BOON"}</h1>
            <div className="rewards">
              {rewardKind === "relic"
                ? rewardOptions.map((r) => (
                  <button key={r.id} className="rcard relic" onClick={() => chooseReward(r)}>
                    <div className="rIcon"><RelicIcon id={r.id} /></div>
                    <div className="rBody">
                      <div className="rname">{r.name}</div>
                      <div className="rtier relicTag">RELIC</div>
                      <div className="rdesc">{r.desc}</div>
                    </div>
                  </button>
                ))
                : rewardOptions.map((r) => {
                  const isPrem = r.tier === "premium";
                  const tooDear = isPrem && embers < PREMIUM_COST;
                  return (
                    <button key={r.id} className={`rcard ${r.tier} ${tooDear ? "tooDear" : ""}`} disabled={tooDear} onClick={() => chooseReward(r)}>
                      <div className="rtop">
                        <div className="rname">{r.name}</div>
                        {isPrem && <div className={`rcost ${tooDear ? "short" : ""}`}>✦ {PREMIUM_COST}</div>}
                      </div>
                      <div className="rtier">{isPrem ? "PREMIUM" : "COMMON"}</div>
                      <div className="rdesc">{r.desc}</div>
                      {ownsVerb(r.id) && r.type === "verb" && <div className="rown">owned → cooldown −1</div>}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      {phase === "dead" && (
        <div className="overlay">
          <div className="panel deadPanel">
            <h1>YOU FELL</h1>
            <div className="feats">
              <div className="feat"><span className="fv">{lastRun ? lastRun.depth : depth}</span><span className="fl">depth</span></div>
              <div className="feat"><span className="fv">{lastRun ? lastRun.kills : runKills}</span><span className="fl">slain</span></div>
              <div className="feat"><span className="fv">{lastRun ? lastRun.clears : cleanClears}</span><span className="fl">clean</span></div>
              <div className="feat"><span className="fv">{lastRun ? lastRun.purges : purgeClears}</span><span className="fl">purges</span></div>
              <div className={`feat ${(lastRun ? lastRun.cleanPurges : cleanPurges) > 0 ? "gold" : ""}`}><span className="fv">{lastRun ? lastRun.cleanPurges : cleanPurges}</span><span className="fl">clean purge</span></div>
              <div className={`feat ${(lastRun ? lastRun.bosses : runBossKills) > 0 ? "gold" : ""}`}><span className="fv">{lastRun ? lastRun.bosses : runBossKills}</span><span className="fl">warlords</span></div>
            </div>
            <div className="earned">+{lastRun ? lastRun.earned + (lastRun.bonus || 0) : 0} <span className="ember">✦</span> embers</div>
            {lastRun && lastRun.newAch && lastRun.newAch.length > 0 && (
              <div className="newAch">★ {lastRun.newAch.join(" · ")}</div>
            )}
            <button className="btn commit big" onClick={() => { setSanctumTab("vessels"); setPhase("intro"); }}>RETURN TO SANCTUM</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Overlay({ title, lines, btn, onClick, tone }) {
  return (
    <div className="overlay">
      <div className={`panel ${tone === "dead" ? "deadPanel" : ""}`}>
        <h1>{title}</h1>
        {lines.map((l, i) => <p key={i}>{l}</p>)}
        <button className="btn commit big" onClick={onClick}>{btn}</button>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
:root{
  --bg:#0a0a10; --bg2:#05050a; --stone:#171722; --stone2:#1d1d2b; --edge:#2c2c3e;
  --ink:#ece6d6; --muted:#8b859b; --gold:#e3bb5e; --teal:#54e2c6;
  --crimson:#ff5848; --violet:#b07dff; --orange:#ff9d3c; --danger:#ff4636; --wallcol:#aab2c6;
}
*{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
.root{position:relative; min-height:100vh; width:100%;
  background:radial-gradient(120% 90% at 50% 0%, #14141f 0%, var(--bg) 45%, var(--bg2) 100%);
  color:var(--ink); font-family:'IBM Plex Mono', ui-monospace, monospace;
  display:flex; justify-content:center; align-items:stretch; overflow:hidden;}
.grain{position:fixed; inset:0; pointer-events:none; opacity:.05; mix-blend-mode:overlay;
  background-image:repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 2px);}
.vignette{position:fixed; inset:0; pointer-events:none; z-index:1; background:radial-gradient(120% 100% at 50% 35%, transparent 45%, rgba(0,0,0,.55) 100%);}
.motes{position:fixed; inset:0; pointer-events:none; z-index:1; overflow:hidden;}
.mote{position:absolute; width:3px; height:3px; border-radius:50%; background:rgba(227,187,94,.5); box-shadow:0 0 6px rgba(227,187,94,.4); opacity:0;}
.mote.m0{left:12%; animation:drift 17s linear infinite;}
.mote.m1{left:28%; width:2px; height:2px; animation:drift 22s linear infinite 3s;}
.mote.m2{left:44%; animation:drift 19s linear infinite 7s;}
.mote.m3{left:60%; width:2px; height:2px; animation:drift 25s linear infinite 1s;}
.mote.m4{left:73%; animation:drift 15s linear infinite 5s;}
.mote.m5{left:86%; width:4px; height:4px; animation:drift 28s linear infinite 9s;}
.mote.m6{left:54%; width:2px; height:2px; animation:drift 21s linear infinite 12s;}
@keyframes drift{0%{top:104%; opacity:0; transform:translateX(0)}10%{opacity:.7}90%{opacity:.5}100%{top:-6%; opacity:0; transform:translateX(24px)}}
.frame{position:relative; z-index:2; width:100%; max-width:440px; min-height:100vh;
  display:flex; flex-direction:column; gap:9px; padding:12px 12px calc(12px + env(safe-area-inset-bottom));}

.hud{display:flex; align-items:flex-start; justify-content:space-between; gap:8px;}
.titleWrap{position:relative; flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding-top:4px;}
.title{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.2em; font-size:12px; color:var(--muted); text-align:center;}
.modTag{font-family:'IBM Plex Mono'; font-size:9px; letter-spacing:.22em; color:var(--teal); border:1px solid rgba(84,226,198,.35); border-radius:6px; padding:2px 7px; background:rgba(84,226,198,.07); cursor:pointer;}
.modNote{position:absolute; top:100%; margin-top:4px; max-width:230px; font-size:10px; line-height:1.4; color:#cfeee7; background:#0c1816; border:1px solid rgba(84,226,198,.4); border-radius:8px; padding:6px 9px; text-align:center; z-index:6; box-shadow:0 8px 24px rgba(0,0,0,.5);}
.hudLeft{display:flex; flex-direction:column; gap:6px;}
.hp{display:flex; gap:5px; align-items:center;}
.inspectTap{background:none; border:0; padding:0; margin:0; font:inherit; color:inherit; cursor:pointer; line-height:1;}
.inspectTap:active{transform:scale(.94);}
.hpPips{display:flex; gap:5px; align-items:center;}
.pip{width:14px; height:14px; transform:rotate(45deg); border:1.5px solid var(--gold);}
.pip.on{background:var(--gold); box-shadow:0 0 10px rgba(227,187,94,.6);}
.pip.off{background:transparent; border-color:#4a4133; opacity:.6;}
.wardBadge{font-size:11px; color:var(--teal); margin-left:4px; letter-spacing:.04em;}
.pursuit{display:flex; align-items:center; gap:4px;}
.pLabel{font-size:10px; color:#6a6478;}
.pdot{width:8px; height:8px; border-radius:50%; background:transparent; border:1px solid #4a4458;}
.pdot.on{background:var(--crimson); border-color:var(--crimson); box-shadow:0 0 8px rgba(255,88,72,.7);}
.stats{display:flex; flex-direction:column; align-items:flex-end; line-height:1.25;}
.depth{font-weight:600; letter-spacing:.12em; font-size:13px;}
.haul{font-size:11px; color:var(--gold);}
.clean{font-size:11px; color:var(--teal);}

.boardWrap{position:relative; display:flex; justify-content:center;}
.board{position:relative; width:100%; aspect-ratio:1/1;
  background:linear-gradient(180deg,#101019,#0b0b13); border:1px solid var(--edge);
  border-radius:14px; overflow:hidden; box-shadow:0 18px 50px rgba(0,0,0,.55), inset 0 0 60px rgba(0,0,0,.6);}
.board.warn{box-shadow:0 18px 50px rgba(0,0,0,.55), inset 0 0 50px rgba(255,70,54,.18), 0 0 0 1px rgba(255,70,54,.4);}
.board.shaking{animation:shake .42s cubic-bezier(.36,.07,.19,.97);}
@keyframes shake{10%{transform:translate(-2px,1px)}20%{transform:translate(3px,-2px)}30%{transform:translate(-4px,2px)}40%{transform:translate(3px,2px)}50%{transform:translate(-3px,-1px)}60%{transform:translate(3px,1px)}70%{transform:translate(-2px,2px)}80%{transform:translate(2px,-1px)}90%{transform:translate(-1px,1px)}100%{transform:translate(0,0)}}
.mute{position:absolute; top:8px; right:8px; z-index:6; width:30px; height:30px; border-radius:8px; border:1px solid var(--edge); background:#0e0e16cc; color:var(--muted); font-size:14px; line-height:1; cursor:pointer; backdrop-filter:blur(2px);}
.mute:active{transform:scale(.94);}
.layer{position:absolute; inset:0;}
.noTap{pointer-events:none;}
.cell{position:absolute; padding:3px; border:0; background:transparent;}
.tile{position:relative; display:flex; align-items:center; justify-content:center; width:100%; height:100%; border-radius:8px;
  background:linear-gradient(155deg,#22222f,#171720 60%,#13131b);
  border:1px solid #2b2b3c; box-shadow:inset 0 1px 0 #ffffff0e, inset 0 -3px 8px #00000055, inset 0 0 0 1px #00000030;}
.tile.pit{background:radial-gradient(58% 58% at 50% 42%,#000 0%,#07070c 70%,#0e0e16 100%); border:1px solid #05050a;
  box-shadow:inset 0 10px 22px #000, inset 0 0 0 1px #1a1a24, inset 0 -2px 6px #1d1d2a;}
.tile.stairs{background:radial-gradient(70% 70% at 50% 50%,rgba(84,226,198,.2),#101820 80%); border:1px solid rgba(84,226,198,.5);
  box-shadow:inset 0 0 22px rgba(84,226,198,.28), 0 0 14px rgba(84,226,198,.12);}
.tile.wall{background:radial-gradient(70% 70% at 50% 35%,#3b4250,#262a36); border:1px solid var(--wallcol);
  box-shadow:inset 0 0 0 1px #00000050, inset 0 0 12px rgba(170,178,198,.25), 0 0 12px rgba(170,178,198,.2);}
.tile.wall::after{content:""; position:absolute; width:42%; height:42%; border:2px solid rgba(200,208,228,.55); border-radius:3px; transform:rotate(45deg); box-shadow:0 0 8px rgba(170,178,198,.5);}
.portal{filter:drop-shadow(0 0 6px rgba(84,226,198,.55));}
.portalRing{transform-origin:50% 50%; animation:spin 9s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.tile.canMove{background:linear-gradient(180deg,#27273b,#1e1e2d); box-shadow:inset 0 0 0 1.5px rgba(227,187,94,.45), inset 0 0 16px rgba(227,187,94,.12);}
.tile.tgt{box-shadow:inset 0 0 0 1.5px rgba(84,226,198,.6), inset 0 0 16px rgba(84,226,198,.18);}
.moveDot{position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:22%; height:22%; border-radius:50%; background:rgba(227,187,94,.5); border:1px solid rgba(227,187,94,.75); box-shadow:0 0 10px rgba(227,187,94,.45);}
.moveStage{position:absolute; inset:7%; border-radius:9px; border:2px dashed var(--gold); box-shadow:0 0 16px rgba(227,187,94,.4);}
.wallStage{position:absolute; inset:9%; border-radius:7px; border:2px dashed var(--wallcol); background:rgba(170,178,198,.12);}

.danger{position:absolute; padding:3px;}
.dangerInner{display:block; width:100%; height:100%; border-radius:9px; background:rgba(255,70,54,.14); border:1px solid rgba(255,70,54,.45); animation:pulse 1.25s ease-in-out infinite;}
.dangerInner[data-t="striker"]{background:rgba(176,125,255,.16); border-color:rgba(176,125,255,.5);}
.dangerInner[data-t="bomber"]{background:rgba(255,157,60,.18); border-color:rgba(255,157,60,.55);}
.danger.hot .dangerInner{background:rgba(255,70,54,.32); border:2px solid var(--danger); box-shadow:0 0 18px rgba(255,70,54,.6); animation:hotpulse .55s ease-in-out infinite;}
.warnTile{position:absolute; padding:3px;}
.warnTile:after{content:""; display:block; width:100%; height:100%; border-radius:9px; border:1px dashed rgba(255,157,60,.4); background:rgba(255,157,60,.07); animation:pulse 1.6s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes hotpulse{0%,100%{opacity:.7}50%{opacity:1}}

.token{position:absolute; transform:translate(-50%,-50%); transition:left .26s cubic-bezier(.4,1.2,.5,1), top .26s cubic-bezier(.4,1.2,.5,1); display:flex; align-items:center; justify-content:center;}
.token svg{filter:drop-shadow(0 2px 5px rgba(0,0,0,.6));}
.token .sig{overflow:visible;}
.fog{position:absolute; width:280%; height:280%; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle, transparent 16%, rgba(3,3,8,.5) 26%, rgba(3,3,8,.93) 40%); transition:left .26s ease, top .26s ease; pointer-events:none;}
.eyeglint{animation:flicker 2.4s ease-in-out infinite;}
.bosseye{filter:drop-shadow(0 0 4px rgba(255,233,166,.9)); animation:flicker 1.8s ease-in-out infinite;}
.player svg{filter:drop-shadow(0 0 9px rgba(227,187,94,.6));}
.charger svg{filter:drop-shadow(0 0 7px rgba(255,88,72,.5));}
.striker svg{filter:drop-shadow(0 0 8px rgba(176,125,255,.55));}
.bomber svg{filter:drop-shadow(0 0 8px rgba(255,157,60,.55));}
.player{animation:bob 3.2s ease-in-out infinite;}
@keyframes bob{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,-54%)}}
.lantern{animation:flicker 2.4s ease-in-out infinite; transform-origin:center;}
@keyframes flicker{0%,100%{opacity:1}45%{opacity:.7}70%{opacity:.95}}
.core{transform-origin:50% 50%; animation:corepulse 1.3s ease-in-out infinite;}
@keyframes corepulse{0%,100%{opacity:.85; transform:scale(.92)}50%{opacity:1; transform:scale(1.12)}}
.spores{transform-origin:50% 50%; animation:spin 6s linear infinite;}
.pupil{animation:gaze 4s ease-in-out infinite; transform-origin:50% 50%;}
@keyframes gaze{0%,100%{transform:translateX(0)}30%{transform:translateX(4px)}60%{transform:translateX(-4px)}}
.token.warlord svg{filter:drop-shadow(0 0 10px rgba(255,88,72,.6)) drop-shadow(0 0 6px rgba(176,125,255,.5));}
.token.warlord::after{content:""; position:absolute; inset:-10%; border-radius:50%; background:radial-gradient(circle, rgba(176,125,255,.18), transparent 70%); animation:hotpulse 1.4s ease-in-out infinite;}
.token.tgtRing::after{content:""; position:absolute; inset:-16%; border-radius:50%; border:2px dashed var(--gold); opacity:.9; animation:hotpulse .7s ease-in-out infinite;}
.token.primed svg{animation:primed .5s ease-in-out infinite;}
.token.primed::before{content:""; position:absolute; inset:-12%; border-radius:50%; background:radial-gradient(circle, rgba(255,70,54,.35), transparent 70%); animation:hotpulse .5s ease-in-out infinite;}
@keyframes primed{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.fuse{position:absolute; top:-3px; right:-3px; font-size:12px; font-weight:700; color:#241000; background:var(--orange); border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 10px rgba(255,157,60,.8); border:1.5px solid #1a0f04;}
.fuse.hot{background:var(--danger); color:#fff; box-shadow:0 0 14px rgba(255,70,54,.95); animation:primed .45s ease-in-out infinite;}
.armor{position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); display:flex; gap:3px;}
.plate{width:7px; height:7px; transform:rotate(45deg); background:var(--violet); border:1px solid #e8d6ff; box-shadow:0 0 6px rgba(176,125,255,.7);}
.fxEmber{position:absolute; transform:translate(-50%,-50%); color:var(--gold); font-size:13px; font-weight:700; text-shadow:0 0 10px rgba(227,187,94,.8); white-space:nowrap; animation:emberfloat 1.4s ease-out forwards; pointer-events:none;}
@keyframes emberfloat{0%{opacity:0; transform:translate(-50%,-30%) scale(.8)}15%{opacity:1}65%{opacity:1; transform:translate(-50%,-110%) scale(1.05)}100%{opacity:0; transform:translate(-50%,-165%) scale(1.05)}}
/* one-shot effects */
.fxRing{position:absolute; transform:translate(-50%,-50%); width:14%; height:14%; border-radius:50%; border:3px solid var(--orange); box-shadow:0 0 24px rgba(255,157,60,.8); animation:ring .6s ease-out forwards;}
@keyframes ring{0%{opacity:1; width:14%; height:14%}100%{opacity:0; width:140%; height:140%; border-width:1px}}
.fxBlast{position:absolute; padding:3px;}
.fxBlast:after{content:""; display:block; width:100%; height:100%; border-radius:9px; background:radial-gradient(circle, rgba(255,220,160,.95), rgba(255,90,40,.6) 60%, transparent); animation:blast .5s ease-out forwards;}
@keyframes blast{0%{opacity:1; transform:scale(1)}60%{opacity:.8}100%{opacity:0; transform:scale(.85)}}
.fxBeam{position:absolute; padding:4px;}
.fxBeam:after{content:""; display:block; width:100%; height:100%; border-radius:7px; background:rgba(176,125,255,.85); box-shadow:0 0 14px rgba(176,125,255,.8); animation:beamflash .35s ease-out forwards;}
@keyframes beamflash{0%{opacity:.95}100%{opacity:0}}
.fxShatter{position:absolute; transform:translate(-50%,-50%); color:#ffd9b0; font-size:22px; text-shadow:0 0 12px rgba(255,157,60,.9); animation:shatter .55s ease-out forwards;}
@keyframes shatter{0%{opacity:1; transform:translate(-50%,-50%) scale(.6) rotate(0)}100%{opacity:0; transform:translate(-50%,-50%) scale(2) rotate(90deg)}}
.fxWall{position:absolute; padding:6%;}
.fxWall:after{content:""; display:block; width:100%; height:100%; border-radius:8px; border:2px solid var(--wallcol); animation:thunk .4s ease-out forwards;}
@keyframes thunk{0%{opacity:0; transform:scale(1.4)}40%{opacity:1; transform:scale(.92)}100%{opacity:0; transform:scale(1)}}
.fxPuff{position:absolute; transform:translate(-50%,-50%); width:30%; height:30%; border-radius:50%; border:2px solid rgba(236,230,214,.7); animation:puff .4s ease-out forwards;}
@keyframes puff{0%{opacity:.9; transform:translate(-50%,-50%) scale(.4)}100%{opacity:0; transform:translate(-50%,-50%) scale(1.6)}}
.ghost{position:absolute; transform:translate(-50%,-50%); width:13%; height:13%; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px; pointer-events:none;}
.ghostKill{color:var(--crimson); border:2px solid var(--crimson); background:rgba(255,88,72,.15); box-shadow:0 0 14px rgba(255,88,72,.5);}
.ghostStun{color:var(--muted); border:2px dashed var(--muted); background:rgba(139,133,155,.12);}
.ghostSwap{color:var(--teal); border:2px solid var(--teal); background:rgba(84,226,198,.14); box-shadow:0 0 14px rgba(84,226,198,.45);}
.toast{position:absolute; top:42%; left:50%; transform:translate(-50%,-50%); font-family:'Cinzel',serif; font-weight:700; letter-spacing:.18em; font-size:19px; color:var(--teal); text-shadow:0 0 18px rgba(84,226,198,.6); animation:rise 1.8s ease-out forwards; pointer-events:none; text-align:center;}
@keyframes rise{0%{opacity:0; transform:translate(-50%,-30%)}12%{opacity:1}75%{opacity:1; transform:translate(-50%,-62%)}100%{opacity:0; transform:translate(-50%,-90%)}}

.banner{min-height:32px; display:flex; align-items:center; justify-content:center; border-radius:9px; font-size:12.5px; letter-spacing:.05em; padding:7px 10px; border:1px solid var(--edge); background:#10101a;}
.banner.good{color:var(--teal); border-color:rgba(84,226,198,.35);}
.banner.ward{color:var(--gold); border-color:rgba(227,187,94,.4); background:rgba(227,187,94,.06);}
.banner.bad{color:var(--crimson); border-color:rgba(255,88,72,.45); background:rgba(255,70,54,.08); animation:hotpulse .8s ease-in-out infinite;}

.satchel{display:flex; gap:6px; margin-bottom:7px;}
.cTip{font-size:10.5px; line-height:1.4; color:#cfe6f5; background:linear-gradient(180deg,#13202b,#0e1820); border:1px solid rgba(143,209,255,.3); border-radius:8px; padding:5px 9px; margin-bottom:6px; text-align:center;}
.cTip b{color:var(--teal); letter-spacing:.04em;}
.cbtn{position:relative; flex:1 1 0; min-height:46px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; border:1px solid rgba(143,209,255,.35); background:linear-gradient(180deg,#15202b,#101820); color:#cfe6f5; font-family:'IBM Plex Mono'; font-weight:600; letter-spacing:.06em; font-size:10px; border-radius:10px; cursor:pointer; transition:transform .08s, background .15s, border-color .15s;}
.cbtn:active{transform:translateY(1px);}
.cbtn:disabled{opacity:.4;}
.cbtn.armed{border-color:var(--teal); background:linear-gradient(180deg,#10302b,#0c211d); box-shadow:0 0 12px rgba(84,226,198,.3); color:var(--teal);}
.cbtn.passive{border-color:rgba(227,187,94,.4); color:#e8d6a6;}
.cicon{width:20px; height:20px;}
.clabel{font-size:9px; letter-spacing:.05em;}
.ccount{position:absolute; top:3px; right:5px; font-size:10px; font-weight:700; color:var(--gold);}
.cacheGlyph{filter:drop-shadow(0 0 6px rgba(227,187,94,.5)); animation:cachePulse 1.8s ease-in-out infinite;}
@keyframes cachePulse{0%,100%{opacity:.8} 50%{opacity:1}}
.verbs{display:flex; flex-wrap:wrap; gap:6px;}
.vbtn{position:relative; flex:1 1 28%; min-height:54px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; border:1px solid var(--edge); background:linear-gradient(180deg,#191923,#12121b); color:var(--ink); font-family:'IBM Plex Mono'; font-weight:600; letter-spacing:.08em; font-size:11px; border-radius:10px; cursor:pointer; transition:transform .08s, background .15s, border-color .15s;}
.vbtn:active{transform:translateY(1px);}
.vbtn:disabled{opacity:.3; cursor:default;}
.vbtn.armed{background:rgba(227,187,94,.18); border-color:var(--gold); color:var(--gold); box-shadow:0 0 12px rgba(227,187,94,.25), inset 0 0 10px rgba(227,187,94,.1);}
.vicon{width:20px; height:20px; opacity:.92;}
.vlabel{line-height:1;}
.cdFill{position:absolute; left:0; right:0; bottom:0; background:rgba(8,8,14,.74); border-radius:0 0 10px 10px; transition:height .22s ease; pointer-events:none;}
.cdNum{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Mono'; font-weight:700; font-size:19px; color:var(--crimson); text-shadow:0 0 8px rgba(255,70,54,.55); pointer-events:none;}
.vbtn.charging{opacity:1; border-color:rgba(255,70,54,.3);}
.vbtn.charging .vicon,.vbtn.charging .vlabel{opacity:.38;}

.actions{display:grid; grid-template-columns:.8fr 1.6fr; gap:8px;}
.btn{border:1px solid var(--edge); background:#15151f; color:var(--ink); font-family:'IBM Plex Mono'; font-weight:600; letter-spacing:.1em; font-size:13px; min-height:54px; border-radius:11px; cursor:pointer; transition:transform .08s, background .15s;}
.btn:active{transform:translateY(1px) scale(.99);}
.btn:disabled{opacity:.32; cursor:default;}
.commit{background:linear-gradient(180deg,#2a5e54,#1c463f); border-color:rgba(84,226,198,.5); color:#dffff6; text-shadow:0 0 10px rgba(84,226,198,.4);}
.big{min-height:54px; width:100%; margin-top:8px;}

.inspectHint{text-align:center; font-size:10px; letter-spacing:.06em; color:#6a6478; padding-top:1px;}
.inspectOverlay{position:fixed; inset:0; z-index:22; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(5,5,10,.7); backdrop-filter:blur(2px);}
.inspectCard{max-width:320px; width:100%; background:linear-gradient(180deg,#15151f,#0d0d15); border:1px solid var(--edge); border-left:3px solid var(--gold); border-radius:14px; padding:18px 18px 16px; box-shadow:0 24px 60px rgba(0,0,0,.6); animation:rise2 .18s ease-out;}
@keyframes rise2{0%{opacity:0; transform:translateY(8px) scale(.98)}100%{opacity:1; transform:none}}
.inspectCard.tone-crimson{border-left-color:var(--crimson);} .inspectCard.tone-crimson .inspectName{color:var(--crimson);}
.inspectCard.tone-violet{border-left-color:var(--violet);} .inspectCard.tone-violet .inspectName{color:var(--violet);}
.inspectCard.tone-orange{border-left-color:var(--orange);} .inspectCard.tone-orange .inspectName{color:var(--orange);}
.inspectCard.tone-teal{border-left-color:var(--teal);} .inspectCard.tone-teal .inspectName{color:var(--teal);}
.inspectCard.tone-boss{border-left-color:var(--violet);} .inspectCard.tone-boss .inspectName{background:linear-gradient(90deg,#ff6f8a,#a8389e); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;}
.inspectName{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.12em; font-size:18px; color:var(--gold); margin-bottom:8px;}
.inspectDesc{font-size:13px; line-height:1.55; color:#cfc8d8; margin-bottom:14px;}
.inspectClose{width:100%; min-height:42px;}

.overlay{position:fixed; inset:0; z-index:20; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(5,5,10,.84); backdrop-filter:blur(3px);}
.panel{max-width:392px; width:100%; max-height:90vh; overflow-y:auto; background:linear-gradient(180deg,#13131d,#0c0c14); border:1px solid var(--edge); border-radius:16px; padding:24px 20px; box-shadow:0 30px 80px rgba(0,0,0,.6);}
.panel h1{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.14em; font-size:24px; margin:0 0 16px; color:var(--gold); text-align:center; text-shadow:0 0 22px rgba(227,187,94,.3);}
.deadPanel h1{color:var(--crimson); text-shadow:0 0 22px rgba(255,88,72,.35);}
.rewardTitle{color:var(--teal); text-shadow:0 0 22px rgba(84,226,198,.3);}
.panel p{font-size:13px; line-height:1.55; color:#cfc8d8; margin:0 0 11px;}
.rewards{display:flex; flex-direction:column; gap:10px;}
.rcard{text-align:left; border:1px solid var(--edge); background:#16161f; border-radius:12px; padding:13px 14px; cursor:pointer; transition:transform .08s, border-color .15s, background .15s;}
.rcard:active{transform:translateY(1px) scale(.995);}
.rcard.common{border-left:3px solid var(--muted);}
.rcard.premium{border-left:3px solid var(--gold); background:#1b1814;}
.rcard:hover{border-color:var(--teal);}
.rcard.tooDear{opacity:.55; cursor:default; filter:saturate(.6);}
.rcard.tooDear:hover{border-color:var(--edge);}
.rtop{display:flex; align-items:baseline; justify-content:space-between; gap:8px;}
.rcost{font-family:'IBM Plex Mono'; font-weight:700; font-size:13px; color:var(--gold); white-space:nowrap;}
.rcost.short{color:var(--crimson);}
.rname{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.1em; font-size:16px; color:var(--ink);}
.rtier{font-size:9px; letter-spacing:.2em; color:var(--muted); margin:2px 0 6px;}
.rcard.premium .rtier{color:var(--gold);}
.rdesc{font-size:12px; line-height:1.5; color:#bfb8cc;}
.rown{font-size:11px; color:var(--teal); margin-top:6px;}
/* sanctum / meta */
.sanctum{max-width:418px; background:linear-gradient(180deg,#171320,#0d0a12); border-color:#3a3048;}
.crest{display:flex; justify-content:center; margin-bottom:4px; opacity:.9; filter:drop-shadow(0 0 8px rgba(227,187,94,.3));}
.sanctum h1{margin-bottom:8px;}
.purse{display:flex; align-items:center; justify-content:center; gap:10px; margin:-2px 0 14px; font-family:'IBM Plex Mono'; font-size:12px;}
.purseEmber{color:var(--gold); font-weight:600; letter-spacing:.05em;}
.purseSep{width:4px; height:4px; border-radius:50%; background:#4a4458;}
.purseBest{color:var(--muted); letter-spacing:.08em;}
.tabs{display:flex; gap:6px; margin-bottom:12px; border-bottom:1px solid #2c2638; padding-bottom:10px;}
.tab{flex:1; padding:8px 4px; background:#15121d; border:1px solid var(--edge); border-radius:9px; color:var(--muted); font-family:'Cinzel',serif; font-weight:700; letter-spacing:.12em; font-size:11px; cursor:pointer; transition:.15s;}
.tab.on{color:var(--gold); border-color:rgba(227,187,94,.5); background:linear-gradient(180deg,rgba(227,187,94,.14),rgba(227,187,94,.03)); box-shadow:0 0 12px rgba(227,187,94,.15);}
.tabBody{margin-bottom:14px;}
.vessels{display:flex; flex-direction:column; gap:9px;}
.vessel{display:flex; align-items:stretch; gap:11px; text-align:left; border:1px solid var(--edge); background:linear-gradient(180deg,#1a1622,#141019); border-radius:12px; padding:11px 12px; cursor:pointer; transition:transform .08s, border-color .15s, background .15s;}
.vessel:active{transform:translateY(1px) scale(.995);}
.vessel.locked{opacity:.5; cursor:default;}
.vessel.afford{border-color:rgba(227,187,94,.4);}
.vessel.sel{border-color:var(--teal); background:linear-gradient(180deg,#102320,#0c1a17); box-shadow:inset 0 0 0 1px rgba(84,226,198,.35), 0 0 14px rgba(84,226,198,.1);}
.vIcon{flex:0 0 38px; width:38px; display:flex; align-items:center; justify-content:center; color:var(--muted); border-right:1px solid #2a2536; padding-right:10px;}
.vessel.sel .vIcon{color:var(--teal);} .vessel.afford .vIcon{color:var(--gold);} .vessel.owned .vIcon{color:var(--ink);}
.vBody{flex:1; display:flex; flex-direction:column; gap:3px;}
.vtop{display:flex; align-items:center; justify-content:space-between; gap:8px;}
.vname{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.08em; font-size:15px; color:var(--ink);}
.vstate{font-size:10px; letter-spacing:.12em; color:var(--muted); border:1px solid currentColor; border-radius:20px; padding:2px 8px; white-space:nowrap;}
.vessel.sel .vstate.eq{color:var(--teal);}
.vessel.owned:not(.sel) .vstate{color:#9a93ab;}
.vessel.afford .vstate{color:var(--gold);}
.vblurb{font-size:11.5px; line-height:1.45; color:#bfb8cc;}
/* guide */
.guide{}
.guide .gh{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.1em; font-size:12px; color:var(--gold); margin:12px 0 5px; text-transform:uppercase;}
.guide .gh:first-child{margin-top:0;}
.guide p{font-size:12.5px; line-height:1.55; color:#d2cbdd; margin:0;}
.guide b{color:#fff;}
.guide .kt{color:var(--teal); font-weight:600;}
.threats{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:5px;}
.threats li{font-size:12px; line-height:1.4; color:#c4bdd2;}
.en{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.03em;}
.en.crimson{color:var(--crimson);} .en.violet{color:var(--violet);} .en.orange{color:var(--orange);}
.en.boss{background:linear-gradient(90deg,#ff6f8a,#a8389e); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;}
.badge{display:inline-block; font-family:'IBM Plex Mono'; font-size:10px; font-weight:700; letter-spacing:.08em; padding:1px 7px; border-radius:20px; border:1px solid currentColor; vertical-align:middle;}
.badge.red{color:var(--crimson);} .badge.teal{color:var(--teal);} .badge.gold{color:var(--gold);}
/* annals */
.annals .recGrid{display:grid; grid-template-columns:1fr 1fr 1fr; gap:7px; margin-bottom:11px;}
.rec{display:flex; flex-direction:column; align-items:center; gap:2px; border:1px solid var(--edge); border-radius:9px; padding:7px 3px; background:#14141d;}
.rec .rv{font-family:'Cinzel',serif; font-weight:700; font-size:16px; color:var(--ink);}
.rec .rl{font-size:8.5px; letter-spacing:.1em; color:var(--muted); text-transform:uppercase;}
.achList{display:flex; flex-direction:column; gap:6px;}
.ach{display:flex; align-items:flex-start; gap:8px; opacity:.45;}
.ach.got{opacity:1;}
.achStar{color:var(--gold); font-size:14px; line-height:1.3;}
.achText{font-size:11px; line-height:1.35; color:#cfc8d8;}
.ach.got .achText b{color:var(--gold);}
.newAch{text-align:center; font-size:12px; color:var(--gold); margin-bottom:12px; text-shadow:0 0 12px rgba(227,187,94,.4);}
.styleSlot{min-height:30px; display:flex; align-items:center;}
.styleBar{flex:1; display:flex; align-items:center; gap:8px; padding:5px 10px; border:1px solid rgba(227,187,94,.4); border-radius:9px; background:linear-gradient(90deg, rgba(227,187,94,.12), rgba(227,187,94,.03)); animation:styleflare .4s ease-out;}
@keyframes styleflare{0%{transform:scale(1.04); box-shadow:0 0 18px rgba(227,187,94,.5)}100%{transform:scale(1); box-shadow:none}}
.styleRank{font-family:'Cinzel',serif; font-weight:700; letter-spacing:.14em; font-size:12px; color:var(--gold); text-shadow:0 0 12px rgba(227,187,94,.4);}
.styleSegs{display:flex; gap:4px; flex:1;}
.seg{position:relative; flex:1; height:5px; border-radius:3px; background:#2a2636; border:1px solid #3a3550; overflow:hidden;}
.seg.on{background:var(--gold); border-color:var(--gold); box-shadow:0 0 8px rgba(227,187,94,.6);}
.segFill{position:absolute; inset:0; right:auto; background:var(--gold); opacity:.55; border-radius:3px; transition:width .2s ease;}
.styleMult{font-family:'IBM Plex Mono'; font-weight:700; font-size:13px; color:var(--gold);}
.relicShelf{display:flex; gap:5px; margin-top:6px; flex-wrap:wrap;}
.relicChip{width:24px; height:24px; display:flex; align-items:center; justify-content:center; padding:3px; border:1px solid rgba(227,187,94,.45); border-radius:7px; color:var(--gold); background:rgba(227,187,94,.08);}
.relicChip.armed{border-color:var(--teal); color:var(--teal); background:rgba(84,226,198,.1); box-shadow:0 0 8px rgba(84,226,198,.3);}
.rcard.relic{display:flex; align-items:flex-start; gap:12px; text-align:left;}
.rcard.relic .rIcon{flex:0 0 40px; width:40px; height:40px; padding:7px; color:var(--gold); border:1px solid rgba(227,187,94,.4); border-radius:10px; background:rgba(227,187,94,.07); margin-top:2px;}
.rcard.relic .rBody{flex:1;}
.relicTag{color:var(--gold) !important;}
.earned{text-align:center; font-size:20px; font-family:'Cinzel',serif; font-weight:700; color:var(--gold); margin:6px 0 4px; text-shadow:0 0 18px rgba(227,187,94,.35);}
.earned .ember{font-size:16px;}
.hurt{position:fixed; inset:0; z-index:15; pointer-events:none; background:radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(255,40,28,.5) 100%); animation:hurtfade .45s ease-out forwards;}
.celebrate{position:fixed; inset:0; z-index:15; pointer-events:none; background:radial-gradient(120% 90% at 50% 50%, transparent 50%, rgba(227,187,94,.45) 100%); animation:hurtfade .7s ease-out forwards;}
.feats{display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin:6px 0 14px;}
.feat{display:flex; flex-direction:column; align-items:center; gap:2px; border:1px solid var(--edge); border-radius:10px; padding:9px 4px; background:#14141d;}
.feat .fv{font-family:'Cinzel',serif; font-weight:700; font-size:19px; color:var(--ink);}
.feat .fl{font-size:9px; letter-spacing:.12em; color:var(--muted); text-transform:uppercase;}
.feat.gold{border-color:rgba(227,187,94,.55); background:#1b1814;}
.feat.gold .fv{color:var(--gold); text-shadow:0 0 14px rgba(227,187,94,.4);}
@keyframes hurtfade{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
`;
