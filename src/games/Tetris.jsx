import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";

/* ─────────────────────────────────────────────────────────────────────────
   TETRIS — a self-contained classic marathon cabinet for Ourcade.

   Modern "guideline" feel: 7-bag randomizer, SRS rotation + wall kicks,
   ghost piece, hold, hard/soft drop, lock delay. Endless until top-out;
   score (higher = better) feeds the Arcade Score Standard board (`tetris`).

   The whole engine lives in refs and a single requestAnimationFrame loop —
   React state is only touched for the HUD (score/lines/level) and screen
   transitions, never per-frame, so it stays smooth. The playfield + hold +
   next previews are drawn to one <canvas>.

   Touch is fully locked to the game surface (touch-action:none + a
   non-passive touchmove preventDefault) so tapping/dragging never scrolls,
   zooms, or pull-to-refreshes the page underneath — this is a website page,
   not a native app.
   ───────────────────────────────────────────────────────────────────────── */

const COLS = 10;
const ROWS = 20;
const SIDE = 3.8; // cells of gutter on each side: HOLD left, NEXT right
const HIDDEN = 2; // spawn rows above the visible field
const TOTAL_ROWS = ROWS + HIDDEN;

// Tetromino definitions. Each piece has 4 rotation states given as [x,y]
// offsets within a 4x4 (I) or 3x3 box, following the SRS spawn orientation.
// We instead store rotations explicitly as cell coordinate lists for clarity.
const PIECES = {
  I: {
    color: "#28e0e8",
    rotations: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
  },
  O: {
    color: "#f2d23b",
    rotations: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
  },
  T: {
    color: "#b24dff",
    rotations: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  S: {
    color: "#3ddc6a",
    rotations: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  Z: {
    color: "#ff4d5e",
    rotations: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  J: {
    color: "#3a7bff",
    rotations: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
  },
  L: {
    color: "#ff9f3a",
    rotations: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  },
};
const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

// SRS wall-kick tables. Offsets to try, in order, when a rotation collides.
// Keyed by "from>to" rotation index. JLSTZ share one table; I has its own;
// O never kicks (it doesn't rotate visually).
const KICKS_JLSTZ = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

// Classic gravity curve (ms per cell) by level. Caps fast at high levels.
const GRAVITY = [
  0, 800, 720, 630, 550, 470, 380, 300, 220, 130, 100,
  83, 83, 83, 67, 67, 67, 50, 50, 50, 33,
];
function gravityFor(level) {
  return GRAVITY[Math.min(level, GRAVITY.length - 1)] || 25;
}

const LOCK_DELAY = 500; // ms a grounded piece can still be nudged before locking
const DAS = 160; // ms before auto-shift kicks in
const ARR = 45; // ms between auto-shifts once repeating
const SOFT_FACTOR = 20; // soft drop is this much faster than gravity

// ── Difficulty settings ──────────────────────────────────────────────────────
// Players can opt into a harder game (no ghost piece, faster base speed). Both
// raise the score multiplier so the extra challenge pays off. Persisted so the
// choice sticks between visits (same lsGetJSON/lsSetJSON tack as other cabinets).
//
// SPEED is a difficulty dial, NOT a starting level: everyone starts on LEVEL 1
// and levels up every 10 lines the same way. A higher speed simply offsets the
// gravity lookup (gravityFor(level + speed-1)), so level 1 — and every level
// after — falls faster. This keeps the level number an honest "how far you got".
const SETTINGS_KEY = "tetris:settings"; // → ourcade:tetris:settings
const MAX_SPEED = 10;
const DEFAULT_SETTINGS = { ghost: true, speed: 1 };
function loadSettings() {
  const s = lsGetJSON(SETTINGS_KEY, DEFAULT_SETTINGS) || DEFAULT_SETTINGS;
  return {
    ghost: s.ghost !== false,
    speed: Math.min(MAX_SPEED, Math.max(1, Math.round(s.speed || 1))),
  };
}
// Ghost OFF = +0.10×; each speed step above 1 = +0.05×. Capped at 2.0×.
function scoreMultFor(s) {
  const m = 1 + (s.ghost ? 0 : 0.1) + (s.speed - 1) * 0.05;
  return Math.min(2, Math.round(m * 100) / 100);
}

function makeBoard() {
  return Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(null));
}

// Fisher–Yates shuffle for the 7-bag.
function shuffled() {
  const a = TYPES.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SCREEN = { TITLE: "title", PLAY: "play", OVER: "over" };

// Difficulty panel shown from the title card. Ghost on/off + starting level,
// with a live readout of the resulting score multiplier. Pure presentational —
// it just edits the `settings` object owned by Tetris (persisted there).
function SettingsPanel({ settings, setSettings, onClose }) {
  const mult = scoreMultFor(settings);
  const setSpeed = (v) =>
    setSettings((s) => ({ ...s, speed: Math.min(MAX_SPEED, Math.max(1, v)) }));
  return (
    <div className="tetris-overlay tetris-set" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tetris-set-title">SETTINGS</div>

      <div className="tetris-set-row">
        <span className="tetris-set-label">GHOST PIECE</span>
        <button
          className={`tetris-btn tetris-set-toggle${settings.ghost ? " is-on" : ""}`}
          onClick={() => setSettings((s) => ({ ...s, ghost: !s.ghost }))}
        >
          {settings.ghost ? "ON" : "OFF"}
        </button>
      </div>

      <div className="tetris-set-row">
        <span className="tetris-set-label">SPEED</span>
        <div className="tetris-set-stepper">
          <button
            className="tetris-btn tetris-set-step"
            onClick={() => setSpeed(settings.speed - 1)}
            disabled={settings.speed <= 1}
            aria-label="Lower speed"
          >
            −
          </button>
          <b className="tetris-set-num">{settings.speed}</b>
          <button
            className="tetris-btn tetris-set-step"
            onClick={() => setSpeed(settings.speed + 1)}
            disabled={settings.speed >= MAX_SPEED}
            aria-label="Raise speed"
          >
            +
          </button>
        </div>
      </div>

      <div className="tetris-set-mult">
        SCORE&nbsp;×&nbsp;<b>{mult.toFixed(2)}</b>
        {mult > 1 && <span className="tetris-set-bonus"> harder = more points</span>}
      </div>

      <button className="tetris-btn tetris-btn-primary" onClick={onClose}>DONE</button>
    </div>
  );
}

export default function Tetris() {
  const navigate = useNavigate();
  const { submit, best } = useArcadeScore("tetris");
  const [screen, setScreen] = useState(SCREEN.TITLE);
  const [hud, setHud] = useState({ score: 0, lines: 0, level: 1 });
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  // Mirror settings in a ref so newGame (a stable []-deps callback) reads the
  // latest without being re-created, and persist the choice across visits.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    lsSetJSON(SETTINGS_KEY, settings);
  }, [settings]);

  // Title + game-over screens show the BACK chrome; gameplay hides it.
  useArcadeBackButton(screen !== SCREEN.PLAY);

  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const padRef = useRef(null);

  // All mutable game state lives here so the rAF loop never triggers a render.
  const G = useRef(null);

  // Inject scoped retro styles once.
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => {
      document.head.removeChild(el);
    };
  }, []);

  // Belt-and-suspenders: a NON-passive touchmove guard on the game surface so a
  // drag can never scroll / pull-to-refresh the page underneath. touch-action
  // on the elements handles most of it; this catches the rest.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const stop = (e) => e.preventDefault();
    node.addEventListener("touchmove", stop, { passive: false });
    return () => node.removeEventListener("touchmove", stop);
  }, []);

  // ── Engine ───────────────────────────────────────────────────────────────
  const newGame = useCallback(() => {
    const bag = shuffled();
    const queue = bag.concat(shuffled());
    const cfg = settingsRef.current; // chosen difficulty for this run
    G.current = {
      board: makeBoard(),
      queue, // upcoming types; we keep it long, refilling as needed
      cur: null, // { type, rot, x, y }
      hold: null,
      holdUsed: false,
      score: 0,
      lines: 0,
      level: 1, // everyone starts at level 1; cfg.speed offsets gravity instead
      settings: cfg, // read by draw() for the ghost toggle + speed offset
      scoreMult: scoreMultFor(cfg), // applied to line-clear points
      gravityAcc: 0,
      lockTimer: 0,
      grounded: false,
      // input state
      left: false,
      right: false,
      soft: false,
      dasTimer: 0,
      dasDir: 0,
      arrTimer: 0,
      // line-clear flash animation
      flashRows: [],
      flashTimer: 0,
      over: false,
      raf: 0,
      last: 0,
    };
    spawn();
    setHud({ score: 0, lines: 0, level: 1 });
  }, []);

  // Pull the next type, refilling the queue from fresh bags.
  function nextType() {
    const g = G.current;
    if (g.queue.length < 8) g.queue = g.queue.concat(shuffled());
    return g.queue.shift();
  }

  function spawn(type) {
    const g = G.current;
    const t = type || nextType();
    const cur = { type: t, rot: 0, x: 3, y: 0 };
    if (collides(g.board, cur)) {
      // Top-out.
      g.over = true;
      return;
    }
    g.cur = cur;
    g.holdUsed = false;
    g.grounded = false;
    g.lockTimer = 0;
  }

  function cellsOf(piece) {
    return PIECES[piece.type].rotations[piece.rot];
  }

  function collides(board, piece) {
    const cells = cellsOf(piece);
    for (const [cx, cy] of cells) {
      const x = piece.x + cx;
      const y = piece.y + cy;
      if (x < 0 || x >= COLS || y >= TOTAL_ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
    return false;
  }

  function tryMove(dx, dy) {
    const g = G.current;
    const moved = { ...g.cur, x: g.cur.x + dx, y: g.cur.y + dy };
    if (!collides(g.board, moved)) {
      g.cur = moved;
      return true;
    }
    return false;
  }

  function tryRotate(dir) {
    const g = G.current;
    const p = g.cur;
    if (p.type === "O") return; // O doesn't kick/rotate
    const from = p.rot;
    const to = (p.rot + (dir > 0 ? 1 : 3)) % 4;
    const table = p.type === "I" ? KICKS_I : KICKS_JLSTZ;
    const kicks = table[`${from}>${to}`] || [[0, 0]];
    for (const [kx, ky] of kicks) {
      // SRS kick y is "up positive"; our y grows downward, so subtract ky.
      const cand = { ...p, rot: to, x: p.x + kx, y: p.y - ky };
      if (!collides(g.board, cand)) {
        g.cur = cand;
        // touching the floor again resets lock delay (move-reset, capped by loop)
        if (g.grounded) g.lockTimer = 0;
        return;
      }
    }
  }

  function ghostY() {
    const g = G.current;
    let gy = g.cur.y;
    const test = { ...g.cur };
    while (true) {
      test.y = gy + 1;
      if (collides(g.board, test)) break;
      gy++;
    }
    return gy;
  }

  function lockPiece() {
    const g = G.current;
    const { board, cur } = g;
    for (const [cx, cy] of cellsOf(cur)) {
      const x = cur.x + cx;
      const y = cur.y + cy;
      if (y >= 0) board[y][x] = PIECES[cur.type].color;
    }
    // Find full rows.
    const full = [];
    for (let y = 0; y < TOTAL_ROWS; y++) {
      if (board[y].every((c) => c)) full.push(y);
    }
    if (full.length) {
      g.flashRows = full;
      g.flashTimer = 140; // brief flash before collapse
    } else {
      g.cur = null;
      spawn();
    }
  }

  function clearRows() {
    const g = G.current;
    const full = g.flashRows;
    if (!full.length) return;
    for (const y of full) {
      g.board.splice(y, 1);
      g.board.unshift(Array(COLS).fill(null));
    }
    const n = full.length;
    const base = [0, 100, 300, 500, 800][n] || 0;
    g.score += Math.round(base * g.level * (g.scoreMult || 1));
    g.lines += n;
    // Level starts at 1 and climbs one per 10 lines, the same for everyone.
    g.level = Math.floor(g.lines / 10) + 1;
    g.flashRows = [];
    setHud({ score: g.score, lines: g.lines, level: g.level });
    g.cur = null;
    spawn();
  }

  function hardDrop() {
    const g = G.current;
    if (!g.cur) return;
    const gy = ghostY();
    g.score += (gy - g.cur.y) * 2;
    g.cur.y = gy;
    lockPiece();
  }

  function holdSwap() {
    const g = G.current;
    if (g.holdUsed || !g.cur) return;
    const curType = g.cur.type;
    if (g.hold) {
      const swapWith = g.hold;
      g.hold = curType;
      g.cur = null;
      spawn(swapWith);
    } else {
      g.hold = curType;
      g.cur = null;
      spawn();
    }
    g.holdUsed = true;
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== SCREEN.PLAY) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Size the canvas to its container, DPR-aware, keeping the 10x20 field plus
    // side panel (hold + next + hud) proportions.
    function resize() {
      // Size the canvas against the PLAY COLUMN's height minus the controls,
      // NOT the stage. The stage now shrink-wraps the canvas, so measuring it
      // would be circular (stage size ← canvas size ← stage size). Measuring
      // the column lets the stage hug the board, so the HUD sits at the board's
      // top-right and the controls sit directly under the board.
      const stage = stageRef.current;
      const play = stage?.parentElement; // .tetris-play
      const pad = padRef.current;
      if (!stage || !canvas || !play) return;
      const playBox = play.getBoundingClientRect();
      // Field is 10 wide, flanked by a gutter on each side: HOLD on the left,
      // NEXT (single piece) on the right.
      const COLS_TOTAL = COLS + SIDE * 2;
      const ROWS_TOTAL = ROWS;
      const padH = pad ? pad.offsetHeight : 0;
      const maxW = playBox.width - 16; // column horizontal padding
      const maxH = playBox.height - padH - 18; // pad + gap breathing room
      let cell = Math.min(maxW / COLS_TOTAL, maxH / ROWS_TOTAL);
      cell = Math.max(8, Math.floor(cell));
      const cssW = Math.floor(cell * COLS_TOTAL);
      const cssH = Math.floor(cell * ROWS_TOTAL);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      G.current.cell = cell;
      G.current.cssW = cssW;
      G.current.cssH = cssH;
    }
    resize();
    window.addEventListener("resize", resize);

    const loop = (t) => {
      const g = G.current;
      if (!g) return;
      if (!g.last) g.last = t;
      let dt = t - g.last;
      g.last = t;
      if (dt > 100) dt = 100; // clamp after tab-away

      if (!paused && !g.over) {
        step(dt);
      }
      draw(ctx);

      if (g.over) {
        cancelLoop();
        finishGame();
        return;
      }
      g.raf = requestAnimationFrame(loop);
    };

    function cancelLoop() {
      const g = G.current;
      if (g && g.raf) cancelAnimationFrame(g.raf);
    }

    function finishGame() {
      const g = G.current;
      submit(g.score);
      setHud({ score: g.score, lines: g.lines, level: g.level });
      setScreen(SCREEN.OVER);
    }

    function step(dt) {
      const g = G.current;

      // Line-clear flash holds the board frozen briefly, then collapses.
      if (g.flashTimer > 0) {
        g.flashTimer -= dt;
        if (g.flashTimer <= 0) clearRows();
        return;
      }
      if (!g.cur) return;

      // Horizontal auto-shift (DAS/ARR).
      if (g.dasDir !== 0) {
        g.dasTimer -= dt;
        while (g.dasTimer <= 0) {
          tryMove(g.dasDir, 0);
          g.dasTimer += ARR;
        }
      }

      // Gravity (soft drop multiplies fall speed). SPEED offsets the gravity
      // lookup so a higher difficulty falls faster at every level, level 1 up.
      const fall = gravityFor(g.level + ((g.settings?.speed || 1) - 1));
      const interval = g.soft ? Math.max(fall / SOFT_FACTOR, 12) : fall;
      g.gravityAcc += dt;
      while (g.gravityAcc >= interval) {
        g.gravityAcc -= interval;
        if (tryMove(0, 1)) {
          if (g.soft) g.score += 1;
          g.grounded = false;
          g.lockTimer = 0;
        } else {
          g.grounded = true;
        }
      }

      // Lock delay when resting on the stack.
      if (g.grounded) {
        // confirm still grounded (a move/rotate could have freed it)
        const below = { ...g.cur, y: g.cur.y + 1 };
        if (collides(g.board, below)) {
          g.lockTimer += dt;
          if (g.lockTimer >= LOCK_DELAY) {
            lockPiece();
          }
        } else {
          g.grounded = false;
          g.lockTimer = 0;
        }
      }
    }

    G.current.last = 0;
    G.current.raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", resize);
      cancelLoop();
    };
    // paused is read via closure-free ref? No — we need it fresh. Re-run on pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, paused]);

  // ── Drawing ────────────────────────────────────────────────────────────────
  function draw(ctx) {
    const g = G.current;
    if (!g || !g.cell) return;
    const cell = g.cell;
    const w = g.cssW;
    const h = g.cssH;
    ctx.clearRect(0, 0, w, h);

    const boardW = COLS * cell;
    const boardH = ROWS * cell;
    const boardX = SIDE * cell; // field is offset right by the HOLD gutter

    // Field is drawn in its own coordinate space starting at the left gutter,
    // so all the per-cell math below stays board-relative (0..COLS, 0..ROWS).
    ctx.save();
    ctx.translate(boardX, 0);

    // Playfield background + grid.
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, boardW, boardH);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, boardH);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(boardW, y * cell + 0.5);
      ctx.stroke();
    }

    // Settled cells (skip hidden rows).
    for (let y = HIDDEN; y < TOTAL_ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = g.board[y][x];
        if (c) drawCell(ctx, x, y - HIDDEN, cell, c);
      }
    }

    // Flash on rows about to clear.
    if (g.flashRows.length) {
      const on = Math.floor(g.flashTimer / 35) % 2 === 0;
      ctx.fillStyle = on ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)";
      for (const y of g.flashRows) {
        if (y >= HIDDEN) ctx.fillRect(0, (y - HIDDEN) * cell, boardW, cell);
      }
    }

    // Ghost + active piece. Ghost is suppressed when the player turns it off.
    if (g.cur && !g.flashRows.length) {
      const color = PIECES[g.cur.type].color;
      if (g.settings?.ghost !== false) {
        const gy = ghostY();
        for (const [cx, cy] of cellsOf(g.cur)) {
          const x = g.cur.x + cx;
          const y = gy + cy - HIDDEN;
          if (y >= 0) drawGhost(ctx, x, y, cell, color);
        }
      }
      for (const [cx, cy] of cellsOf(g.cur)) {
        const x = g.cur.x + cx;
        const y = g.cur.y + cy - HIDDEN;
        if (y >= 0) drawCell(ctx, x, y, cell, color);
      }
    }

    // Frame around the playfield.
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, boardW - 2, boardH - 2);

    ctx.restore();

    // HOLD box in the left gutter; NEXT (single piece) in the right gutter,
    // pushed down so it reads as sitting under the right-side HUD overlay.
    const panelW = SIDE * cell - cell * 0.6;
    drawMini(ctx, "HOLD", g.hold, cell * 0.3, cell * 0.3, panelW, cell);
    drawMini(ctx, "NEXT", previewQueue(g, 1)[0], boardX + boardW + cell * 0.3, cell * 7, panelW, cell);
  }

  function previewQueue(g, n) {
    const out = [];
    let q = g.queue;
    for (let i = 0; i < n && i < q.length; i++) out.push(q[i]);
    return out;
  }

  function drawCell(ctx, x, y, cell, color) {
    const px = x * cell;
    const py = y * cell;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, cell, cell);
    // bevel
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(px, py, cell, Math.max(2, cell * 0.14));
    ctx.fillRect(px, py, Math.max(2, cell * 0.14), cell);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px, py + cell - Math.max(2, cell * 0.14), cell, Math.max(2, cell * 0.14));
    ctx.fillRect(px + cell - Math.max(2, cell * 0.14), py, Math.max(2, cell * 0.14), cell);
  }

  function drawGhost(ctx, x, y, cell, color) {
    const px = x * cell;
    const py = y * cell;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
    ctx.globalAlpha = 1;
  }

  function drawMini(ctx, label, type, x, y, w, cell) {
    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = `bold ${Math.max(9, Math.floor(cell * 0.55))}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      ctx.fillText(label, x, y);
    }
    const boxY = y + (label ? cell * 0.9 : 0);
    const mini = cell * 0.66;
    if (!type) return;
    const cells = PIECES[type].rotations[0];
    // center the piece in a 4-wide box
    let minX = 4, maxX = -1, minY = 4, maxY = -1;
    for (const [cx, cy] of cells) {
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
    }
    const pw = (maxX - minX + 1) * mini;
    const ox = x + (w - pw) / 2 - minX * mini;
    const oy = boxY - minY * mini + mini * 0.2;
    for (const [cx, cy] of cells) {
      const ppx = ox + cx * mini;
      const ppy = oy + cy * mini;
      ctx.fillStyle = PIECES[type].color;
      ctx.fillRect(ppx, ppy, mini, mini);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(ppx, ppy, mini, 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(ppx, ppy + mini - 2, mini, 2);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  // Keyboard. preventDefault on game keys so the page never scrolls.
  useEffect(() => {
    if (screen !== SCREEN.PLAY) return undefined;
    const GAME_KEYS = new Set([
      "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Spacebar",
      "z", "Z", "x", "X", "c", "C", "Shift", "p", "P",
    ]);

    const down = (e) => {
      const g = G.current;
      if (!g) return;
      if (GAME_KEYS.has(e.key)) e.preventDefault();
      if (e.repeat) return; // we run our own DAS/ARR
      switch (e.key) {
        case "ArrowLeft":
          startShift(-1); break;
        case "ArrowRight":
          startShift(1); break;
        case "ArrowDown":
          g.soft = true; break;
        case "ArrowUp":
        case "x":
        case "X":
          if (!paused) tryRotate(1); break;
        case "z":
        case "Z":
          if (!paused) tryRotate(-1); break;
        case " ":
        case "Spacebar":
          if (!paused) hardDrop(); break;
        case "c":
        case "C":
        case "Shift":
          if (!paused) holdSwap(); break;
        case "p":
        case "P":
          setPaused((p) => !p); break;
        case "Escape":
          setScreen(SCREEN.TITLE); break;
        default:
          break;
      }
    };
    const up = (e) => {
      const g = G.current;
      if (!g) return;
      switch (e.key) {
        case "ArrowLeft":
          if (g.dasDir === -1) endShift(); break;
        case "ArrowRight":
          if (g.dasDir === 1) endShift(); break;
        case "ArrowDown":
          g.soft = false; break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, paused]);

  // Shared shift helpers (used by both keyboard and touch buttons).
  function startShift(dir) {
    const g = G.current;
    if (!g || paused) return;
    tryMove(dir, 0); // immediate response
    g.dasDir = dir;
    g.dasTimer = DAS;
  }
  function endShift() {
    const g = G.current;
    if (!g) return;
    g.dasDir = 0;
    g.dasTimer = 0;
  }

  // Touch buttons: pointerdown to act, pointerup/leave to release. We
  // preventDefault so a press never starts a page scroll or text selection.
  function holdButton(onPress, onRelease) {
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onPress();
      },
      onPointerUp: (e) => {
        e.preventDefault();
        onRelease && onRelease();
      },
      onPointerCancel: () => onRelease && onRelease(),
      onPointerLeave: () => onRelease && onRelease(),
    };
  }
  function tapButton(onPress) {
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        onPress();
      },
    };
  }

  const softPress = () => { const g = G.current; if (g && !paused) g.soft = true; };
  const softRelease = () => { const g = G.current; if (g) g.soft = false; };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapRef}
      className="tetris-root"
      style={{
        touchAction: "none",
        overscrollBehavior: "contain",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {screen === SCREEN.TITLE && (
        <div className="tetris-card">
          <div className="tetris-logo">TETRIS</div>
          <p className="tetris-sub">Stack the blocks. Clear the lines. Don't top out.</p>
          {best != null && <p className="tetris-best">BEST&nbsp;·&nbsp;{best.toLocaleString()}</p>}
          <button className="tetris-btn tetris-btn-primary" onClick={() => { newGame(); setPaused(false); setScreen(SCREEN.PLAY); }}>
            ▶ PLAY
          </button>
          <button className="tetris-btn" onClick={() => setShowSettings(true)}>⚙ SETTINGS</button>
          <button className="tetris-btn" onClick={() => navigate("/")}>‹ BACK TO OURCADE</button>
          <p className="tetris-help">
            ← → move · ↑/X rotate · Z rotate ccw · ↓ soft · <b>Space</b> hard drop · C hold · P pause
          </p>
        </div>
      )}

      {screen === SCREEN.TITLE && showSettings && (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {screen === SCREEN.PLAY && (
        <div className="tetris-play">
          <div className="tetris-stage" ref={stageRef}>
            <canvas ref={canvasRef} className="tetris-canvas" />
            <div className="tetris-hud">
              <button className="tetris-pause" {...tapButton(() => setPaused((p) => !p))}>
                {paused ? "▶" : "❚❚"}
              </button>
              <div className="tetris-stat"><span>SCORE</span><b>{hud.score.toLocaleString()}</b></div>
              <div className="tetris-stat"><span>LINES</span><b>{hud.lines}</b></div>
              <div className="tetris-stat"><span>LEVEL</span><b>{hud.level}</b></div>
            </div>
            {paused && (
              <div className="tetris-overlay">
                <div className="tetris-paused">PAUSED</div>
                <button className="tetris-btn tetris-btn-primary" {...tapButton(() => setPaused(false))}>RESUME</button>
                <button className="tetris-btn" {...tapButton(() => setScreen(SCREEN.TITLE))}>QUIT</button>
              </div>
            )}
          </div>

          {/* On-screen controls (mobile). pointerdown-based, no page scroll.
              Single row: HOLD ◀ ▼ ▶ ↻ DROP. */}
          <div className="tetris-pad" ref={padRef}>
            <button className="tetris-key tetris-key-wide" {...tapButton(() => !paused && holdSwap())} aria-label="Hold">HOLD</button>
            <button className="tetris-key" {...holdButton(() => startShift(-1), endShift)} aria-label="Left">◀</button>
            <button className="tetris-key" {...holdButton(softPress, softRelease)} aria-label="Soft drop">▼</button>
            <button className="tetris-key" {...holdButton(() => startShift(1), endShift)} aria-label="Right">▶</button>
            <button className="tetris-key tetris-key-rot" {...tapButton(() => !paused && tryRotate(1))} aria-label="Rotate">↻</button>
            <button className="tetris-key tetris-key-drop" {...tapButton(() => !paused && hardDrop())} aria-label="Hard drop">DROP</button>
          </div>
        </div>
      )}

      {screen === SCREEN.OVER && (
        <div className="tetris-card">
          <div className="tetris-over">GAME OVER</div>
          <div className="tetris-final">
            <div className="tetris-stat big"><span>SCORE</span><b>{hud.score.toLocaleString()}</b></div>
            <div className="tetris-row">
              <div className="tetris-stat"><span>LINES</span><b>{hud.lines}</b></div>
              <div className="tetris-stat"><span>LEVEL</span><b>{hud.level}</b></div>
            </div>
            {best != null && (
              <p className="tetris-best">
                {hud.score >= best ? "🏆 NEW BEST!" : `BEST · ${best.toLocaleString()}`}
              </p>
            )}
          </div>
          <button className="tetris-btn tetris-btn-primary" onClick={() => { newGame(); setPaused(false); setScreen(SCREEN.PLAY); }}>
            ▶ PLAY AGAIN
          </button>
          <button className="tetris-btn" onClick={() => navigate("/")}>‹ BACK TO OURCADE</button>
        </div>
      )}
    </div>
  );
}

const CSS = `
.tetris-root{
  position:relative; width:100vw; height:100svh; overflow:hidden;
  background:
    radial-gradient(circle at 50% 0%, #16162a 0%, #0a0a14 60%, #06060c 100%);
  color:#e8e8f4;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  display:flex; align-items:center; justify-content:center;
}
/* subtle scanlines for the CRT feel */
.tetris-root::after{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px);
  mix-blend-mode:overlay; opacity:.4;
}

/* ── Title / Game over cards ── */
.tetris-card{
  position:relative; z-index:2; display:flex; flex-direction:column;
  align-items:center; gap:14px; padding:28px; text-align:center; max-width:340px;
}
.tetris-logo{
  font-size:clamp(40px, 12vw, 72px); font-weight:900; letter-spacing:6px;
  color:#34c5ff;
  text-shadow:0 0 12px rgba(52,197,255,.7), 4px 4px 0 rgba(178,77,255,.55);
}
.tetris-over{
  font-size:clamp(32px, 10vw, 56px); font-weight:900; letter-spacing:4px;
  color:#ff4d5e; text-shadow:0 0 12px rgba(255,77,94,.7);
}
.tetris-sub{ color:#9aa0c0; margin:0; font-size:14px; }
.tetris-best{ color:#f2d23b; font-weight:700; margin:2px 0; letter-spacing:1px; }
.tetris-help{ color:#6b7095; font-size:11px; line-height:1.6; margin:6px 0 0; }
.tetris-final{ display:flex; flex-direction:column; align-items:center; gap:8px; margin:4px 0; }
.tetris-row{ display:flex; gap:22px; }

.tetris-btn{
  appearance:none; border:2px solid #34c5ff; background:transparent; color:#34c5ff;
  font-family:inherit; font-weight:800; letter-spacing:2px; font-size:14px;
  padding:12px 22px; border-radius:10px; cursor:pointer; min-width:200px;
  transition:transform .06s ease, background .15s ease;
}
.tetris-btn:active{ transform:translateY(1px); }
.tetris-btn-primary{ background:#34c5ff; color:#06121b; box-shadow:0 0 16px rgba(52,197,255,.5); }

/* ── Play screen layout ── */
.tetris-play{
  position:relative; z-index:2; width:100%; height:100%;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:8px 8px 10px; box-sizing:border-box; gap:8px;
}
/* HUD overlays the stage, pinned top-right as a vertical stack so it never
   eats vertical space from (or clips above) the board. */
.tetris-hud{
  position:absolute; top:8px; right:8px; z-index:2;
  display:flex; flex-direction:column; align-items:flex-end; gap:8px;
  pointer-events:none; /* taps fall through to the canvas… */
}
.tetris-hud .tetris-pause{ pointer-events:auto; } /* …except the pause button */
.tetris-stat{ display:flex; flex-direction:column; align-items:flex-end; line-height:1.1; }
.tetris-stat span{ font-size:10px; color:#7c81a8; letter-spacing:2px; }
.tetris-stat b{ font-size:18px; color:#e8e8f4; }
.tetris-stat.big b{ font-size:40px; color:#34c5ff; text-shadow:0 0 12px rgba(52,197,255,.5); }
.tetris-pause{
  appearance:none; background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.18); color:#e8e8f4; border-radius:8px;
  width:38px; height:34px; font-size:13px; cursor:pointer;
}

.tetris-stage{
  position:relative; flex:0 0 auto; /* shrink-wrap the canvas so the HUD hugs
    the board top-right and the controls sit directly under the board */
  display:flex; align-items:center; justify-content:center;
}
.tetris-canvas{ image-rendering:pixelated; display:block; }

.tetris-overlay{
  position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:12px;
  background:rgba(6,6,12,.82); z-index:3;
}
.tetris-paused{ font-size:34px; font-weight:900; letter-spacing:6px; color:#34c5ff; }

/* ── On-screen controls ── */
.tetris-pad{
  width:100%; max-width:560px; flex:0 0 auto;
  display:flex; align-items:center; justify-content:center;
  flex-wrap:wrap; gap:8px; padding-top:4px;
}
.tetris-key{
  appearance:none; touch-action:none; user-select:none;
  background:linear-gradient(180deg, #23233a, #15152400 140%);
  background-color:#1a1a2c;
  border:1px solid rgba(255,255,255,.16); color:#e8e8f4;
  border-radius:12px; width:58px; height:58px; font-size:22px; font-weight:800;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  box-shadow:0 2px 0 rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.08);
}
.tetris-key:active{ transform:translateY(2px); box-shadow:0 0 0 rgba(0,0,0,.4); background-color:#252540; }
.tetris-key-wide{ width:auto; padding:0 14px; font-size:13px; letter-spacing:1px; }
.tetris-key-rot{ color:#b24dff; font-size:26px; }
.tetris-key-drop{ color:#34c5ff; font-size:13px; letter-spacing:1px; width:auto; padding:0 16px; }

/* On wider screens, give buttons a touch more room and center the cluster. */
@media (min-width:560px){
  .tetris-key{ width:62px; height:62px; }
}
/* When a real keyboard is likely (fine pointer, no touch), shrink the pad so
   it's clearly secondary — but keep it visible for click users. */
@media (hover:hover) and (pointer:fine){
  .tetris-pad{ opacity:.85; }
}

/* ── Settings panel (title screen) ── */
.tetris-set{ gap:16px; padding:24px; }
.tetris-set-title{ font-size:22px; font-weight:900; letter-spacing:6px; color:#34c5ff; text-shadow:0 0 12px rgba(52,197,255,.5); }
.tetris-set-row{
  display:flex; align-items:center; justify-content:space-between;
  width:min(280px, 80vw); gap:16px;
}
.tetris-set-label{ font-size:12px; letter-spacing:2px; color:#9aa0c4; }
/* Reuse .tetris-btn but compact, since these sit inline in a row. */
.tetris-set-toggle{ min-width:78px; padding:9px 0; text-align:center; }
.tetris-set-toggle.is-on{ background:#34c5ff; color:#06121b; box-shadow:0 0 14px rgba(52,197,255,.45); }
.tetris-set-stepper{ display:flex; align-items:center; gap:12px; }
.tetris-set-step{ min-width:42px; padding:8px 0; text-align:center; font-size:20px; line-height:1; }
.tetris-set-step:disabled{ opacity:.35; cursor:default; }
.tetris-set-num{ font-size:22px; color:#e8e8f4; min-width:24px; text-align:center; }
.tetris-set-mult{ font-size:13px; letter-spacing:1px; color:#9aa0c4; }
.tetris-set-mult b{ color:#ffd23c; font-size:16px; }
.tetris-set-bonus{ color:#ffd23c; opacity:.8; font-size:11px; }
`;
