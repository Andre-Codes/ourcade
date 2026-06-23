import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGetJSON, lsSetJSON, lsRemove } from "../lib/store.js";

/* ─────────────────────────────────────────────────────────────────────────
   2048 — a calm, turn-based cabinet for Ourcade's low-stim shelf.

   Slide the 4×4 board with arrows / swipes; equal tiles merge and double.
   No timer, no twitch — just one move at a time. Score (higher = better)
   feeds the Arcade Score Standard board (`game-2048`).

   This is deliberately NOT canvas + rAF like Tetris: the board only changes
   on a discrete move, so it's plain React state and CSS-transitioned tiles.
   Each tile carries a stable id so React keeps its DOM node across a move and
   the CSS `transform` animates the slide; merges flag a one-shot pop.

   A resumable board persists to localStorage (ourcade:2048:state) so a calm
   game survives a refresh — the whole point of the genre.

   Touch is locked to the game surface (touch-action:none + a non-passive
   touchmove guard) so swiping the board never scrolls the page underneath.
   ───────────────────────────────────────────────────────────────────────── */

const SIZE = 4;
const START_TILES = 2;
const WIN_VALUE = 2048;
const STATE_KEY = "2048:state";

const SCREEN = { TITLE: "title", PLAY: "play", OVER: "over" };

// Muted, low-contrast tile palette — warm neutrals that step up gently, so the
// board never flashes or shouts. Text flips to light only on the darkest tiles.
const TILE = {
  2: { bg: "#2a2a3a", fg: "#cfd2e6" },
  4: { bg: "#33334a", fg: "#cfd2e6" },
  8: { bg: "#3e4668", fg: "#e7e9f6" },
  16: { bg: "#46557e", fg: "#e7e9f6" },
  32: { bg: "#4e6391", fg: "#eef0fb" },
  64: { bg: "#5572a6", fg: "#eef0fb" },
  128: { bg: "#5a7d8c", fg: "#eef7f6" },
  256: { bg: "#5e8a78", fg: "#eef7f1" },
  512: { bg: "#6f9669", fg: "#f1f8ec" },
  1024: { bg: "#8aa05c", fg: "#161a10" },
  2048: { bg: "#b3a84e", fg: "#161407" },
  4096: { bg: "#b88a4e", fg: "#1a1207" },
  8192: { bg: "#b8694e", fg: "#1d0e07" },
};
const tileStyle = (v) => TILE[v] || TILE[8192];
// Shrink the digits on big numbers so they always fit the cell.
function fontFor(v) {
  if (v < 100) return "clamp(20px, 7.5vw, 40px)";
  if (v < 1000) return "clamp(17px, 6.2vw, 34px)";
  if (v < 10000) return "clamp(14px, 5vw, 28px)";
  return "clamp(12px, 4vw, 22px)";
}

let _idSeq = 1;
const nextId = () => _idSeq++;

// A tile: { id, value, r, c, isNew?, mergedFrom? }. The board is just a flat
// list of tiles; an empty cell is the absence of a tile at that (r,c).
function emptyCells(tiles) {
  const occupied = new Set(tiles.map((t) => t.r * SIZE + t.c));
  const out = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!occupied.has(r * SIZE + c)) out.push({ r, c });
  return out;
}
function spawnTile(tiles) {
  const free = emptyCells(tiles);
  if (!free.length) return tiles;
  const { r, c } = free[Math.floor(Math.random() * free.length)];
  // Classic 90% / 10% split for 2 vs 4.
  const value = Math.random() < 0.9 ? 2 : 4;
  return [...tiles, { id: nextId(), value, r, c, isNew: true }];
}
function freshTiles() {
  let tiles = [];
  for (let i = 0; i < START_TILES; i++) tiles = spawnTile(tiles);
  return tiles;
}

// Build a SIZE-long line of tiles for a given row/column, ordered in the
// direction of travel (index 0 = the edge tiles slide toward).
function lineFor(tiles, index, axis, forward) {
  const get = (t) => (axis === "row" ? t.r : t.c);
  const along = (t) => (axis === "row" ? t.c : t.r);
  const line = tiles.filter((t) => get(t) === index).sort((a, b) => along(a) - along(b));
  return forward ? line.reverse() : line;
}

// Slide + merge one line toward the start. Returns the resulting tiles (with
// updated positions, merge flags) and the points scored. Mutates nothing.
function collapseLine(line, axis, index, forward, scoreRef) {
  const result = [];
  let pos = 0; // next slot from the edge
  let i = 0;
  while (i < line.length) {
    const a = line[i];
    const b = line[i + 1];
    const slot = forward ? SIZE - 1 - pos : pos;
    if (b && a.value === b.value) {
      // Merge a+b into a doubled tile that lands in this slot.
      const value = a.value * 2;
      scoreRef.points += value;
      result.push({
        id: a.id, // keep one id so a node survives; the other unmounts
        value,
        r: axis === "row" ? index : slot,
        c: axis === "row" ? slot : index,
        mergedFrom: [a.id, b.id],
      });
      i += 2;
    } else {
      result.push({
        id: a.id,
        value: a.value,
        r: axis === "row" ? index : slot,
        c: axis === "row" ? slot : index,
      });
      i += 1;
    }
    pos++;
  }
  return result;
}

// Apply a move. dir ∈ "left"|"right"|"up"|"down". Returns { tiles, points,
// moved } — `moved` is false when nothing shifted (so we don't spawn/score).
function move(tiles, dir) {
  const axis = dir === "left" || dir === "right" ? "row" : "col";
  const forward = dir === "right" || dir === "down";
  const scoreRef = { points: 0 };
  let next = [];
  for (let index = 0; index < SIZE; index++) {
    const line = lineFor(tiles, index, axis, forward);
    next = next.concat(collapseLine(line, axis, index, forward, scoreRef));
  }
  // Did anything actually change position or merge?
  const before = new Map(tiles.map((t) => [t.id, t]));
  let moved = next.length !== tiles.length; // a merge reduces the count
  if (!moved) {
    for (const t of next) {
      const o = before.get(t.id);
      if (!o || o.r !== t.r || o.c !== t.c) {
        moved = true;
        break;
      }
    }
  }
  return { tiles: next, points: scoreRef.points, moved };
}

// No legal move left → game over. (Board full AND no adjacent equal pair.)
function isStuck(tiles) {
  if (emptyCells(tiles).length) return false;
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const t of tiles) grid[t.r][t.c] = t.value;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (c + 1 < SIZE && grid[r][c + 1] === v) return false;
      if (r + 1 < SIZE && grid[r + 1][c] === v) return false;
    }
  return true;
}

// Strip transient flags before persisting / for a clean compare.
const cleanTiles = (tiles) => tiles.map(({ id, value, r, c }) => ({ id, value, r, c }));

export default function Game2048() {
  const navigate = useNavigate();
  const { submit, best } = useArcadeScore("game-2048");

  const [screen, setScreen] = useState(SCREEN.TITLE);
  const [tiles, setTiles] = useState([]);
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false); // hit 2048 — show banner, allow continue
  const [hasSave, setHasSave] = useState(false);

  // Title + game-over screens show the BACK chrome; gameplay hides it.
  useArcadeBackButton(screen !== SCREEN.PLAY);

  const wrapRef = useRef(null);
  const animating = useRef(false); // ignore input during a slide

  // Inject scoped styles once.
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  // Is there a game worth resuming? (Checked once for the title button.)
  useEffect(() => {
    const saved = lsGetJSON(STATE_KEY, null);
    setHasSave(!!(saved && Array.isArray(saved.tiles) && saved.tiles.length));
  }, []);

  // Belt-and-suspenders touchmove guard so a swipe never scrolls the page.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const stop = (e) => e.preventDefault();
    node.addEventListener("touchmove", stop, { passive: false });
    return () => node.removeEventListener("touchmove", stop);
  }, [screen]);

  // Persist on every change while playing (and clear on game over / new game).
  useEffect(() => {
    if (screen !== SCREEN.PLAY) return;
    lsSetJSON(STATE_KEY, { tiles: cleanTiles(tiles), score, won });
  }, [tiles, score, won, screen]);

  const startNew = useCallback(() => {
    _idSeq = 1;
    setTiles(freshTiles());
    setScore(0);
    setWon(false);
    animating.current = false;
    setScreen(SCREEN.PLAY);
  }, []);

  const resume = useCallback(() => {
    const saved = lsGetJSON(STATE_KEY, null);
    if (!saved || !Array.isArray(saved.tiles) || !saved.tiles.length) {
      startNew();
      return;
    }
    _idSeq = saved.tiles.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    setTiles(saved.tiles);
    setScore(saved.score || 0);
    setWon(!!saved.won);
    animating.current = false;
    setScreen(SCREEN.PLAY);
  }, [startNew]);

  const finish = useCallback(
    (finalScore, finalTiles) => {
      submit(finalScore);
      lsRemove(STATE_KEY); // run is over; nothing to resume
      setHasSave(false);
      setTiles(finalTiles);
      setScreen(SCREEN.OVER);
    },
    [submit]
  );

  // Keep the freshest tiles/score/won in refs so the input handler reads them
  // without re-subscribing the listeners every move (and without nested setState).
  const tilesRef = useRef(tiles);
  const scoreRef = useRef(score);
  const wonRef = useRef(won);
  useEffect(() => { tilesRef.current = tiles; }, [tiles]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { wonRef.current = won; }, [won]);

  const slideTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(slideTimer.current), []);

  // The one input path: try a move; if anything shifted, commit the slide, then
  // after the CSS transition drop the merge/new flags and spawn a fresh tile.
  const doMove = useCallback(
    (dir) => {
      if (animating.current) return;
      const { tiles: slid, points, moved } = move(tilesRef.current, dir);
      if (!moved) return;

      animating.current = true;
      const reached2048 = !wonRef.current && slid.some((t) => t.value >= WIN_VALUE);

      // First commit: tiles in their new positions (CSS animates the slide).
      setTiles(slid);
      setScore((s) => s + points);
      if (reached2048) setWon(true);

      // After the slide, strip flags and spawn the next tile. If the board is
      // then stuck, end the run (reading the up-to-date score from its setter).
      window.clearTimeout(slideTimer.current);
      slideTimer.current = window.setTimeout(() => {
        const stripped = slid.map(({ id, value, r, c }) => ({ id, value, r, c }));
        const withSpawn = spawnTile(stripped);
        animating.current = false;
        if (isStuck(withSpawn)) {
          finish(scoreRef.current, withSpawn);
        } else {
          setTiles(withSpawn);
        }
      }, SLIDE_MS);
    },
    [finish]
  );

  // Keyboard. preventDefault on arrows so the page never scrolls.
  useEffect(() => {
    if (screen !== SCREEN.PLAY) return undefined;
    const KEYMAP = {
      ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
      a: "left", d: "right", w: "up", s: "down",
      A: "left", D: "right", W: "up", S: "down",
    };
    const onKey = (e) => {
      const dir = KEYMAP[e.key];
      if (!dir) return;
      e.preventDefault();
      doMove(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, doMove]);

  // Swipe. A short, intentional drag past the threshold fires once per gesture.
  const touch = useRef(null);
  const onPointerDown = (e) => {
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < SWIPE_MIN) return;
    if (ax > ay) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
  };

  return (
    <div
      ref={wrapRef}
      className="g2048-root"
      style={{
        touchAction: "none",
        overscrollBehavior: "contain",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {screen === SCREEN.TITLE && (
        <div className="g2048-card">
          <div className="g2048-logo">2048</div>
          <p className="g2048-sub">Slide the tiles. Merge the matches. Reach 2048.</p>
          {best != null && <p className="g2048-best">BEST&nbsp;·&nbsp;{best.toLocaleString()}</p>}
          {hasSave && (
            <button className="g2048-btn g2048-btn-primary" onClick={resume}>↻ CONTINUE</button>
          )}
          <button className={`g2048-btn ${hasSave ? "" : "g2048-btn-primary"}`} onClick={startNew}>
            ▶ NEW GAME
          </button>
          <button className="g2048-btn" onClick={() => navigate("/")}>‹ BACK TO OURCADE</button>
          <p className="g2048-help">← → ↑ ↓ or WASD · or swipe</p>
        </div>
      )}

      {screen === SCREEN.PLAY && (
        <div className="g2048-play">
          <div className="g2048-bar">
            <div className="g2048-stat"><span>SCORE</span><b>{score.toLocaleString()}</b></div>
            <div className="g2048-stat"><span>BEST</span><b>{(best != null ? Math.max(best, score) : score).toLocaleString()}</b></div>
            <button className="g2048-new" onClick={startNew} aria-label="New game">↻</button>
          </div>

          <div className="g2048-board" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
            {/* Static background grid of cells. */}
            <div className="g2048-grid">
              {Array.from({ length: SIZE * SIZE }).map((_, i) => (
                <div key={i} className="g2048-cell" />
              ))}
            </div>
            {/* Tiles positioned absolutely; CSS transitions animate the slide. */}
            {tiles.map((t) => {
              const st = tileStyle(t.value);
              return (
                <div
                  key={t.id}
                  className={`g2048-tile${t.isNew ? " g2048-new-tile" : ""}${t.mergedFrom ? " g2048-merge" : ""}`}
                  style={{
                    "--r": t.r,
                    "--c": t.c,
                    background: st.bg,
                    color: st.fg,
                    fontSize: fontFor(t.value),
                  }}
                >
                  {t.value}
                </div>
              );
            })}
          </div>

          {won && (
            <p className="g2048-won">✦ You reached 2048 — keep going for a higher score.</p>
          )}
          <p className="g2048-help">← → ↑ ↓ · WASD · swipe</p>
        </div>
      )}

      {screen === SCREEN.OVER && (
        <div className="g2048-card">
          <div className="g2048-over">NO MOVES LEFT</div>
          <div className="g2048-stat big"><span>SCORE</span><b>{score.toLocaleString()}</b></div>
          {best != null && (
            <p className="g2048-best">
              {score >= best ? "🏆 NEW BEST!" : `BEST · ${best.toLocaleString()}`}
            </p>
          )}
          <button className="g2048-btn g2048-btn-primary" onClick={startNew}>▶ PLAY AGAIN</button>
          <button className="g2048-btn" onClick={() => navigate("/")}>‹ BACK TO OURCADE</button>
        </div>
      )}
    </div>
  );
}

const SLIDE_MS = 110; // tile slide duration; the settle waits this long
const SWIPE_MIN = 24; // px before a drag counts as a directional swipe

const CSS = `
.g2048-root{
  position:relative; width:100vw; height:100svh; overflow:hidden;
  background:radial-gradient(circle at 50% 0%, #14141f 0%, #0c0c13 60%, #08080c 100%);
  color:#e8e8f4;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  display:flex; align-items:center; justify-content:center;
}

/* ── Title / Game over cards ── */
.g2048-card{
  position:relative; z-index:2; display:flex; flex-direction:column;
  align-items:center; gap:14px; padding:28px; text-align:center; max-width:340px;
}
.g2048-logo{
  font-size:clamp(46px, 14vw, 80px); font-weight:900; letter-spacing:4px;
  color:#cdb24e;
}
.g2048-over{
  font-size:clamp(26px, 8vw, 44px); font-weight:900; letter-spacing:3px;
  color:#b8694e;
}
.g2048-sub{ color:#9aa0c0; margin:0; font-size:14px; }
.g2048-best{ color:#cdb24e; font-weight:700; margin:2px 0; letter-spacing:1px; }
.g2048-help{ color:#6b7095; font-size:11px; line-height:1.6; margin:6px 0 0; }
.g2048-won{ color:#8aa05c; font-size:12px; margin:8px 0 0; letter-spacing:.5px; }

.g2048-btn{
  appearance:none; border:2px solid #cdb24e; background:transparent; color:#cdb24e;
  font-family:inherit; font-weight:800; letter-spacing:2px; font-size:14px;
  padding:12px 22px; border-radius:10px; cursor:pointer; min-width:200px;
  transition:transform .06s ease, background .15s ease;
}
.g2048-btn:active{ transform:translateY(1px); }
.g2048-btn-primary{ background:#cdb24e; color:#161407; }

/* ── Play screen ── */
.g2048-play{
  position:relative; z-index:2; width:100%; height:100%;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:12px; box-sizing:border-box; gap:14px;
}
.g2048-bar{
  display:flex; align-items:center; gap:14px;
  width:min(92vw, 92svh, 460px);
}
.g2048-stat{ display:flex; flex-direction:column; line-height:1.1; }
.g2048-stat span{ font-size:10px; color:#7c81a8; letter-spacing:2px; }
.g2048-stat b{ font-size:20px; color:#e8e8f4; }
.g2048-stat.big{ align-items:center; margin:4px 0; }
.g2048-stat.big b{ font-size:40px; color:#cdb24e; }
.g2048-new{
  margin-left:auto; appearance:none; background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.18); color:#e8e8f4; border-radius:9px;
  width:42px; height:38px; font-size:18px; cursor:pointer;
}
.g2048-new:active{ background:rgba(255,255,255,.12); }

/* The board is a square sized to the smaller viewport dimension. Cell metrics
   are driven by CSS vars so the tiles can position with the same math. */
.g2048-board{
  --pad: 3.5%;          /* gap as a fraction of the board */
  --cell: 21.875%;      /* (100% - 5*pad) / 4 */
  position:relative;
  width:min(92vw, 92svh, 460px); height:min(92vw, 92svh, 460px);
  background:#1a1a26; border-radius:12px; padding:0; box-sizing:border-box;
  touch-action:none;
}
.g2048-grid{
  position:absolute; inset:0; padding:var(--pad); box-sizing:border-box;
  display:grid; grid-template-columns:repeat(4, 1fr); grid-template-rows:repeat(4, 1fr);
  gap:var(--pad);
}
.g2048-cell{ background:#23232f; border-radius:9px; }

.g2048-tile{
  position:absolute;
  width:var(--cell); height:var(--cell);
  /* position = pad + index * (cell + pad) */
  left:calc(var(--pad) + var(--c) * (var(--cell) + var(--pad)));
  top:calc(var(--pad) + var(--r) * (var(--cell) + var(--pad)));
  display:flex; align-items:center; justify-content:center;
  border-radius:9px; font-weight:800; font-variant-numeric:tabular-nums;
  transition:left ${SLIDE_MS}ms ease, top ${SLIDE_MS}ms ease;
  will-change:left, top;
}
/* A freshly spawned tile fades+scales in gently (low-stim: short, soft). */
.g2048-new-tile{ animation:g2048-appear 140ms ease both; }
@keyframes g2048-appear{
  from{ transform:scale(.6); opacity:0; }
  to{ transform:scale(1); opacity:1; }
}
/* A merged tile does a single subtle pop. */
.g2048-merge{ animation:g2048-pop 140ms ease; }
@keyframes g2048-pop{
  0%{ transform:scale(1); }
  50%{ transform:scale(1.08); }
  100%{ transform:scale(1); }
}

/* Honor reduced-motion: drop slide/pop animations entirely. */
@media (prefers-reduced-motion: reduce){
  .g2048-tile{ transition:none; }
  .g2048-new-tile, .g2048-merge{ animation:none; }
}
`;
