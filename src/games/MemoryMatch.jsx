import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { kImg, MEMORY_ICONS } from "../lib/kenney.js";
import { playSfx, playSfxVariant } from "../lib/sfx.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useQuitConfirm } from "../lib/useQuitConfirm.js";

// ── Memory Match ──────────────────────────────────────────────────────────────
// Concentration grid using the nostalgic Kenney object icons (floppy, CD, gamepad,
// …). Flip two tiles, find pairs, clear the board. Self-contained cabinet: scoped
// .mem-* CSS, own back button, full-viewport. Scored by FEWEST MOVES (dir:"asc").

const GAME_ID = "memory-match";

// Always 4 columns — bigger boards add ROWS, not columns, so the grid grows
// vertically (and scrolls) on phones rather than squeezing tiles narrower.
const COLS = 4;
const LEVELS = [
  { id: "easy", label: "4 × 4", pairs: 8 },
  { id: "med", label: "4 × 5", pairs: 10 },
  { id: "hard", label: "4 × 6", pairs: 12 },
];

const memIcon = (name) => kImg("memory", name);

// Fisher–Yates (free-play → Math.random is fine).
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(pairs) {
  const icons = shuffled(MEMORY_ICONS).slice(0, pairs);
  const deck = icons.flatMap((icon, p) => [
    { id: p * 2, icon, flipped: false, matched: false },
    { id: p * 2 + 1, icon, flipped: false, matched: false },
  ]);
  return shuffled(deck);
}

const MEM_CSS = `
  .mem-root {
    width: 100vw; min-height: 100svh; overflow-y: auto; overflow-x: hidden; position: relative;
    display: flex; flex-direction: column; align-items: center;
    color: #eef0ff; font-family: 'Share Tech Mono','Courier New',monospace;
    background:
      radial-gradient(ellipse 55% 40% at 18% 6%, rgba(63,255,208,.10), transparent 70%),
      radial-gradient(ellipse 50% 50% at 84% 94%, rgba(180,77,255,.09), transparent 65%),
      #08080f;
    touch-action: manipulation;
  }
  .mem-back {
    position: absolute; top: 14px; left: 14px; z-index: 5;
    width: 42px; height: 42px; cursor: pointer; border-radius: 9px;
    font-size: 1.3rem; color: #eef0ff; background: #13162a; border: 2px solid #2a2f4a;
  }
  .mem-back:hover { border-color: #3fffd0; }

  .mem-head { text-align: center; margin: 18px 0 6px; }
  .mem-head h1 {
    font-family: 'Black Ops One','Impact',sans-serif; font-size: clamp(1.6rem, 5.5vw, 2.6rem);
    letter-spacing: .05em;
    background: linear-gradient(180deg,#fffbe6,#3fffd0 50%,#b44dff 110%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .mem-stats { display: flex; gap: 22px; justify-content: center; margin: 6px 0 10px;
    font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: #6b708f; }
  .mem-stats b { color: #ffd23f; font-size: 1rem; }

  /* fixed 4 columns — taller boards add rows; cap width so tiles stay a comfy
     touch size and the board grows downward (root scrolls) rather than sideways. */
  .mem-grid { display: grid; gap: 10px; padding: 4px 4px 24px;
    width: min(92vw, 420px); margin: 10px auto 0; flex: 0 0 auto; }
  .mem-tile {
    aspect-ratio: 1; cursor: pointer; border: none; padding: 0; background: none;
    perspective: 600px; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  .mem-tile-inner {
    position: relative; display: block; width: 100%; height: 100%;
    transition: transform .35s cubic-bezier(.4,.1,.3,1);
    transform-style: preserve-3d; -webkit-transform-style: preserve-3d;
  }
  .mem-tile.up .mem-tile-inner, .mem-tile.matched .mem-tile-inner {
    transform: rotateY(180deg); -webkit-transform: rotateY(180deg);
  }
  .mem-face {
    position: absolute; inset: 0; border-radius: 11px;
    backface-visibility: hidden; -webkit-backface-visibility: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .mem-back-face {
    background: linear-gradient(150deg,#1a1f3a,#0e1124);
    border: 2px solid #2a2f4a; color: #3a4170; font-size: 1.5rem;
  }
  .mem-back-face::after { content: "?"; font-family: 'Black Ops One',sans-serif; }
  .mem-front-face {
    transform: rotateY(180deg); -webkit-transform: rotateY(180deg);
    background: linear-gradient(150deg,#fff,#d7f6ee);
    border: 2px solid #3fffd0; padding: 14%;
  }
  .mem-front-face img { width: 100%; height: 100%; object-fit: contain; }
  .mem-tile.matched .mem-front-face {
    border-color: #34c759; box-shadow: 0 0 16px rgba(52,199,89,.5);
    animation: mem-pulse .4s ease;
  }
  @keyframes mem-pulse {
    0% { transform: rotateY(180deg) scale(1); -webkit-transform: rotateY(180deg) scale(1); }
    50% { transform: rotateY(180deg) scale(1.1); -webkit-transform: rotateY(180deg) scale(1.1); }
    100% { transform: rotateY(180deg) scale(1); -webkit-transform: rotateY(180deg) scale(1); } }

  .mem-overlay {
    position: absolute; inset: 0; z-index: 6; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px; text-align: center;
    background: rgba(8,8,15,.86); backdrop-filter: blur(4px); padding: 24px;
  }
  .mem-overlay h2 {
    font-family: 'Black Ops One',sans-serif; font-size: clamp(1.8rem,7vw,3rem);
    background: linear-gradient(180deg,#fffbe6,#3fffd0 60%,#b44dff);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .mem-overlay .sub { font-size: .72rem; letter-spacing: .26em; text-transform: uppercase; color: #6b708f; }
  .mem-levels { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .mem-btn {
    padding: 13px 18px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P',monospace; font-size: .7rem; letter-spacing: .04em;
    color: #0a0a12; background: linear-gradient(180deg,#fff,#3fffd0); border: 2px solid #0a0a12;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4);
  }
  .mem-btn:hover { filter: brightness(1.08); }
  .mem-btn.alt { background: linear-gradient(180deg,#fff,#ffd23f); }
  .mem-win-stats { display: flex; gap: 28px; justify-content: center; }
  .mem-win-stats div { font-size: .66rem; letter-spacing: .2em; text-transform: uppercase; color: #6b708f; }
  .mem-win-stats b { display: block; font-family: 'Black Ops One',sans-serif; font-size: 2rem; color: #ffd23f; margin-top: 4px; }
  .mem-newbest { color: #34c759; font-size: .8rem; letter-spacing: .2em; text-transform: uppercase; }
`;

export default function MemoryMatch() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState("start"); // start | playing | won
  const [level, setLevel] = useState(LEVELS[0]);

  // Each grid size has its OWN leaderboard — a 4×4 (8-pair) win and a 4×6
  // (12-pair) win aren't comparable on a raw fewest-moves ladder, so scores
  // submit under a size-specific board id (registered in src/data/games.js).
  const boardId = `${GAME_ID}-${level.id}`;
  const { submit, best } = useArcadeScore(boardId);

  const [deck, setDeck] = useState([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [picks, setPicks] = useState([]); // indices currently face-up & unmatched
  const [locked, setLocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Hide the shell back button on every screen — we draw our own.
  useArcadeBackButton(false);

  // Guard the back arrow: confirm only when a game is in progress (memory match
  // has no save state, so leaving mid-game forfeits the run).
  const quit = useQuitConfirm();
  const onBack = () => quit.request(() => navigate("/"), { armed: phase === "playing" && moves > 0 });

  const flipTimer = useRef(null);
  const tickTimer = useRef(null);
  useEffect(() => () => { clearTimeout(flipTimer.current); clearInterval(tickTimer.current); }, []);

  // Inject scoped CSS.
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = MEM_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  const matchedCount = deck.filter((t) => t.matched).length;

  function startGame(lvl) {
    clearTimeout(flipTimer.current);
    clearInterval(tickTimer.current);
    setLevel(lvl);
    setDeck(buildDeck(lvl.pairs));
    setMoves(0);
    setSeconds(0);
    setPicks([]);
    setLocked(false);
    setSubmitted(false);
    setPhase("playing");
    tickTimer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function flip(i) {
    if (locked || phase !== "playing") return;
    const tile = deck[i];
    if (tile.flipped || tile.matched) return;
    if (picks.length === 2) return;

    const next = deck.map((t, idx) => (idx === i ? { ...t, flipped: true } : t));
    setDeck(next);
    playSfxVariant("card-slide", [1, 3]);
    const newPicks = [...picks, i];
    setPicks(newPicks);

    if (newPicks.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newPicks;
      if (next[a].icon === next[b].icon) {
        // Match — mark matched, clear picks.
        const matched = next.map((t, idx) =>
          idx === a || idx === b ? { ...t, matched: true } : t
        );
        setDeck(matched);
        setPicks([]);
        playSfxVariant("card-place", [1, 3]);
        playSfx("confirmation");
        if (matched.every((t) => t.matched)) finish();
      } else {
        // No match — flip both back after a beat.
        setLocked(true);
        flipTimer.current = setTimeout(() => {
          setDeck((d) => d.map((t, idx) => (idx === a || idx === b ? { ...t, flipped: false } : t)));
          setPicks([]);
          setLocked(false);
        }, 750);
      }
    }
  }

  function finish() {
    clearInterval(tickTimer.current);
    setPhase("won");
  }

  // Submit once when we reach the win screen (moves = the score, lower better).
  const finalMoves = moves;
  useEffect(() => {
    if (phase === "won" && !submitted) {
      submit(finalMoves);
      setSubmitted(true);
    }
  }, [phase, submitted, finalMoves, submit]);

  const isNewBest = phase === "won" && best != null && finalMoves <= best;

  // Fixed COLS columns — the board grows in rows as pair count rises.
  const gridStyle = { gridTemplateColumns: `repeat(${COLS}, 1fr)` };

  return (
    <div className="mem-root">
      <button className="mem-back" onClick={onBack} aria-label="Back">←</button>

      <div className="mem-head"><h1>MEMORY MATCH</h1></div>
      <div className="mem-stats">
        <span>Moves <b>{moves}</b></span>
        <span>Pairs <b>{matchedCount / 2}/{level.pairs}</b></span>
        <span>Time <b>{seconds}s</b></span>
      </div>

      <div className="mem-grid" style={gridStyle}>
        {deck.map((t, i) => (
          <button
            key={t.id}
            className={`mem-tile ${t.matched ? "matched" : t.flipped ? "up" : ""}`}
            onClick={() => flip(i)}
            aria-label={t.flipped || t.matched ? t.icon : "hidden tile"}
          >
            <span className="mem-tile-inner">
              <span className="mem-face mem-back-face" />
              <span className="mem-face mem-front-face">
                <img src={memIcon(t.icon)} alt={t.icon} />
              </span>
            </span>
          </button>
        ))}
      </div>

      {phase === "start" && (
        <div className="mem-overlay">
          <h2>MEMORY MATCH</h2>
          <div className="sub">flip two · find the pair · clear the board</div>
          <div className="mem-levels">
            {LEVELS.map((lvl) => (
              <button key={lvl.id} className="mem-btn" onClick={() => startGame(lvl)}>
                {lvl.label}
              </button>
            ))}
          </div>
          {best != null && <div className="sub">best · {best} moves</div>}
        </div>
      )}

      {phase === "won" && (
        <div className="mem-overlay">
          <h2>CLEARED!</h2>
          <div className="mem-win-stats">
            <div>Moves<b>{finalMoves}</b></div>
            <div>Time<b>{seconds}s</b></div>
          </div>
          {isNewBest && <div className="mem-newbest">★ new best ★</div>}
          <div className="mem-levels">
            <button className="mem-btn" onClick={() => startGame(level)}>PLAY AGAIN</button>
            <button className="mem-btn alt" onClick={() => setPhase("start")}>CHANGE SIZE</button>
          </div>
          <Link className="sub" to={`/scores/${boardId}`} style={{ color: "#3fffd0", textDecoration: "none" }}>
            view {level.label} leaderboard →
          </Link>
        </div>
      )}

      <ConfirmDialog
        open={quit.open}
        title="Quit this game?"
        message="Your progress will be lost — memory match doesn't save mid-game."
        confirmLabel="Quit"
        cancelLabel="Keep playing"
        onConfirm={quit.confirm}
        onCancel={quit.cancel}
      />
    </div>
  );
}
