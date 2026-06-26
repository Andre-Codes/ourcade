import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { cardImg, chipImg } from "../lib/kenney.js";
import { playSfxVariant } from "../lib/sfx.js";
import {
  newGame, nextCard, placeCard, toggleChip, useDiscard, canPlace,
  levelFor, fallIntervalMs, COLS, ROWS, START_LIVES,
} from "./chip-panic/logic.js";

/* ─────────────────────────────────────────────────────────────────────────
   CHIP PANIC — Tetris-meets-Video-Poker, a novel Ourcade cabinet.

   Cards fall one at a time. Tap a column to drop the card there; a column fills
   at 5 cards. Only a PAYING hand (pair or better) scores and clears — a column
   that fills as a High Card LOCKS as a dead lane (dead weight). Drop a CHIP on a
   column first to BET it: a paying hand pays ×3, a junk lane still costs a life.
   You get ONE discard to throw away the held card; it recharges each time a lane
   clears. A "panic timer" auto-drops the held card into the leftmost open column
   if you dawdle — and it shrinks as the level climbs. Out of lives / overflow =
   game over. Score feeds the Arcade Score Standard board (`chip-panic`).

   Real-time pacing lives in refs + a single rAF loop (the Tetris pattern); React
   state drives only the board render + HUD + screen transitions.
   ───────────────────────────────────────────────────────────────────────── */

const GAME_ID = "chip-panic";
const SCREEN = { TITLE: "title", PLAY: "play", OVER: "over" };

const CP_CSS = `
  .cp-root {
    position: relative; width: 100vw; height: 100svh; overflow: hidden;
    display: flex; flex-direction: column; align-items: center;
    color: #eef0ff; font-family: 'Share Tech Mono','Courier New',monospace;
    background:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(191,90,242,.10), transparent 70%),
      radial-gradient(circle at 50% 65%, #2a1c47, #160e2b 70%, #0c0719);
    user-select: none; -webkit-user-select: none; touch-action: manipulation;
  }
  .cp-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; width: 100%; box-sizing: border-box; flex: 0 0 auto; }
  .cp-bar .sp { flex: 1; }
  .cp-btn {
    cursor: pointer; border-radius: 8px; padding: 8px 12px;
    font-family: 'Press Start 2P',monospace; font-size: .56rem; letter-spacing: .04em;
    color: #eef0ff; background: rgba(0,0,0,.32); border: 2px solid #6a3f9f;
  }
  .cp-btn:hover { border-color: #bf5af2; }
  .cp-stat { font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; color: #c9b3ec; }
  .cp-stat b { color: #ffd23f; }
  .cp-lives { letter-spacing: 2px; }

  .cp-stage { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 8px; padding: 6px 8px 12px; min-height: 0; width: 100%; box-sizing: border-box; }

  /* The held card + panic timer */
  .cp-held { display: flex; flex-direction: column; align-items: center; gap: 4px; height: calc(var(--cw) * 1.42); }
  .cp-held .cp-card { box-shadow: 0 0 0 2px #bf5af2, 0 4px 14px rgba(191,90,242,.5); }
  .cp-timer { width: min(60vw, 320px); height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; }
  .cp-timer i { display: block; height: 100%; background: linear-gradient(90deg,#3fffd0,#ffd23f,#ff6b6b); transition: width .05s linear; }

  /* held-card row: card on the left, discard button on the right */
  .cp-heldrow { display: flex; align-items: center; gap: 12px; }
  .cp-discard {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    cursor: pointer; border-radius: 8px; padding: 7px 9px;
    border: 2px solid #6a3f9f; background: rgba(0,0,0,.32); color: #eef0ff;
    font-family: 'Press Start 2P',monospace;
  }
  .cp-discard:hover:not(:disabled) { border-color: #bf5af2; }
  .cp-discard span { font-size: 1.1rem; line-height: 1; }
  .cp-discard small { font-size: .42rem; letter-spacing: .08em; color: #c9b3ec; }
  .cp-discard:disabled { opacity: .3; cursor: not-allowed; }

  /* The 5 columns */
  .cp-cols { display: flex; gap: min(2vw, 12px); align-items: flex-end; justify-content: center; flex: 1 1 auto; }
  .cp-col { display: flex; flex-direction: column-reverse; align-items: center; gap: 0; cursor: pointer; flex: 0 0 auto; }
  .cp-colcards {
    display: flex; flex-direction: column-reverse; gap: 2px;
    box-sizing: border-box; align-items: center;
    width: calc(var(--cw) + 8px); /* card + 4px padding each side — fixed so empty lanes don't shrink */
    min-height: calc(var(--ch) * 5 + 8px); justify-content: flex-end;
    padding: 4px; border-radius: 8px; border: 2px dashed rgba(255,255,255,.12);
    background: rgba(0,0,0,.18);
  }
  .cp-col.bet .cp-colcards { border-color: #ffd23f; box-shadow: 0 0 12px rgba(255,210,63,.3) inset; }
  .cp-col.full .cp-colcards { border-color: #ff6b6b; }
  /* dead lane: junk-locked, unusable */
  .cp-col.dead { cursor: default; }
  .cp-col.dead .cp-colcards { border-color: #555; border-style: solid; box-shadow: none; background: rgba(0,0,0,.4); }
  .cp-col.dead .cp-card { filter: grayscale(1) brightness(.55); }
  .cp-col.dead .cp-colcards { position: relative; }
  .cp-col.dead .cp-colcards::after {
    content: "✕"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--cw) * .9); color: rgba(255,107,107,.7); font-family: 'Black Ops One',sans-serif;
    pointer-events: none;
  }
  .cp-card {
    width: var(--cw); height: var(--ch); border-radius: calc(var(--cw)*.09);
    display: block;
  }
  .cp-card img { width: 100%; height: 100%; display: block; border-radius: inherit; }
  /* chip toggle button under each column */
  .cp-chipbtn {
    margin-top: 6px; width: 36px; height: 36px; cursor: pointer;
    border-radius: 50%; border: 2px solid rgba(255,255,255,.18);
    background: rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center;
    padding: 0;
  }
  .cp-chipbtn img { width: 30px; height: 30px; opacity: .35; transition: opacity .1s; }
  .cp-chipbtn.on { border-color: #ffd23f; }
  .cp-chipbtn.on img { opacity: 1; }
  .cp-chipbtn:disabled { opacity: .3; cursor: not-allowed; }

  .cp-toast {
    position: absolute; top: 22%; left: 50%; transform: translateX(-50%);
    font-family: 'Black Ops One',sans-serif; font-size: clamp(1.1rem,4.5vw,1.8rem);
    color: #ffd23f; text-shadow: 0 2px 10px rgba(0,0,0,.6); pointer-events: none;
    opacity: 0; transition: opacity .15s; text-align: center; white-space: nowrap;
  }
  .cp-toast.show { opacity: 1; }
  .cp-toast.bad { color: #ff6b6b; }
  .cp-toast.big { color: #3fffd0; }

  .cp-overlay {
    position: absolute; inset: 0; z-index: 80; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px; text-align: center;
    background: rgba(12,7,25,.92); backdrop-filter: blur(4px); padding: 24px;
  }
  .cp-overlay h1 {
    font-family: 'Black Ops One',sans-serif; font-size: clamp(2rem,9vw,3.6rem);
    background: linear-gradient(180deg,#fffbe6,#bf5af2 55%,#3fffd0);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .cp-overlay .sub { font-size: .72rem; letter-spacing: .22em; text-transform: uppercase; color: #c9b3ec; max-width: 30ch; line-height: 1.7; }
  .cp-big {
    padding: 13px 20px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P',monospace; font-size: .72rem; letter-spacing: .04em;
    color: #0a0a12; background: linear-gradient(180deg,#fff,#bf5af2); border: 2px solid #0a0a12;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4);
  }
  .cp-big:hover { filter: brightness(1.08); }
`;

export default function ChipPanic() {
  const navigate = useNavigate();
  const { submit, best } = useArcadeScore(GAME_ID);

  const [screen, setScreen] = useState(SCREEN.TITLE);
  const [, force] = useState(0); // bump to re-render the board from the ref
  const rerender = useCallback(() => force((n) => n + 1), []);
  const [hud, setHud] = useState({ score: 0, level: 1, lives: START_LIVES });
  const [timerPct, setTimerPct] = useState(1);
  const [toast, setToast] = useState({ text: "", kind: "", on: false });

  useArcadeBackButton(screen !== SCREEN.PLAY);

  // All mutable game state lives here so the rAF loop never forces a render
  // except where we explicitly call rerender()/setHud().
  const G = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = CP_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  function flashToast(text, kind = "") {
    clearTimeout(toastTimer.current);
    setToast({ text, kind, on: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, on: false })), 900);
  }

  const start = useCallback(() => {
    const state = newGame();
    const held = nextCard(state);
    G.current = { state, held, fallAcc: 0, last: 0, raf: 0 };
    setHud({ score: 0, level: 1, lives: START_LIVES });
    setTimerPct(1);
    setScreen(SCREEN.PLAY);
  }, []);

  // Drop the held card into column c (player tap or auto-drop). Resolves a clear,
  // updates HUD, queues the next card, ends the game on overflow / no lives.
  function drop(c) {
    const g = G.current;
    if (!g || g.state.over) return;
    if (!canPlace(g.state, c)) { flashToast("COLUMN FULL!", "bad"); return; }
    const { state, event } = placeCard(g.state, c, g.held);
    g.state = state;
    g.fallAcc = 0;
    playSfxVariant("card-place", [1, 3]);

    if (event) {
      if (event.dead) {
        flashToast(`${event.hand.name} — LANE DEAD`, "bad");
      } else if (event.lostLife) {
        flashToast(`${event.hand.name} — BAD BET`, "bad");
      } else if (event.chipped && event.paying) {
        flashToast(`${event.hand.name} ×3  +${event.points}`, "big");
        playSfxVariant("chips-stack", [1, 3]);
      } else if (event.hand.rank >= 4) {
        flashToast(`${event.hand.name}!  +${event.points}`, "big");
        playSfxVariant("chips-stack", [1, 3]);
      } else {
        flashToast(`${event.hand.name}  +${event.points}`);
      }
    }

    setHud({ score: state.score, level: levelFor(state.cleared), lives: state.lives });

    if (state.over) {
      endGame();
      return;
    }
    g.held = nextCard(g.state);
    rerender();
  }

  function onChip(c) {
    const g = G.current;
    if (!g || g.state.over) return;
    if (g.state.dead[c] || canPlace(g.state, c) === false) return; // dead/full: no bet
    g.state = toggleChip(g.state, c);
    playSfxVariant("chip-lay", [1, 3]);
    rerender();
  }

  // Throw away the held card (single use; recharges when a lane clears).
  function onDiscard() {
    const g = G.current;
    if (!g || g.state.over || !g.state.discard) return;
    g.state = useDiscard(g.state);
    g.held = nextCard(g.state);
    g.fallAcc = 0;
    playSfxVariant("card-place", [1, 3]);
    rerender();
  }

  function endGame() {
    const g = G.current;
    submit(g.state.score);
    setScreen(SCREEN.OVER);
  }

  // ── panic loop: the held card auto-drops when the timer runs out ──────────────
  useEffect(() => {
    if (screen !== SCREEN.PLAY) return undefined;
    const loop = (t) => {
      const g = G.current;
      if (!g || g.state.over) return;
      if (!g.last) g.last = t;
      let dt = t - g.last;
      g.last = t;
      if (dt > 100) dt = 100; // clamp after tab-away

      const interval = fallIntervalMs(g.state.cleared) * ROWS; // full panic window
      g.fallAcc += dt;
      const pct = Math.max(0, 1 - g.fallAcc / interval);
      setTimerPct(pct);

      if (g.fallAcc >= interval) {
        // Auto-drop into the leftmost open column (or any), else overflow.
        let target = -1;
        for (let c = 0; c < COLS; c++) if (canPlace(g.state, c)) { target = c; break; }
        if (target === -1) {
          g.state = { ...g.state, over: true };
          endGame();
          return;
        }
        drop(target);
      }
      g.raf = requestAnimationFrame(loop);
    };
    G.current.last = 0;
    G.current.raf = requestAnimationFrame(loop);
    return () => {
      const g = G.current;
      if (g && g.raf) cancelAnimationFrame(g.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── render ───────────────────────────────────────────────────────────────────
  const g = G.current;
  // Card width sized so 5 columns of cards fit comfortably across the screen.
  const rootStyle = { "--cw": "min(15vw, 70px)", "--ch": "calc(var(--cw) * 1.357)" };

  return (
    <div className="cp-root" style={rootStyle}>
      <div className="cp-bar">
        <button className="cp-btn" onClick={() => (screen === SCREEN.PLAY ? endGame() : navigate("/"))}>
          {screen === SCREEN.PLAY ? "QUIT" : "← EXIT"}
        </button>
        <span className="sp" />
        <span className="cp-stat">SCORE <b>{hud.score.toLocaleString()}</b></span>
        <span className="cp-stat">LVL <b>{hud.level}</b></span>
        <span className="cp-stat cp-lives"><b>{"♥".repeat(Math.max(0, hud.lives))}</b></span>
      </div>

      {screen === SCREEN.PLAY && g && (
        <div className="cp-stage">
          <div className="cp-held">
            <div className="cp-heldrow">
              <span className="cp-card"><img src={cardImg(g.held.id)} alt={g.held.id} draggable="false" /></span>
              <button
                className="cp-discard"
                disabled={!g.state.discard}
                onPointerDown={(e) => { e.stopPropagation(); onDiscard(); }}
                aria-label="Discard held card"
              >
                <span>🗑</span>
                <small>{g.state.discard ? "DISCARD" : "USED"}</small>
              </button>
            </div>
            <div className="cp-timer"><i style={{ width: `${Math.round(timerPct * 100)}%` }} /></div>
          </div>

          <div className="cp-cols">
            {g.state.cols.map((col, c) => {
              const dead = g.state.dead[c];
              const full = col.length >= ROWS;
              const bet = g.state.chips[c];
              return (
                <div
                  key={c}
                  className={`cp-col ${bet ? "bet" : ""} ${full ? "full" : ""} ${dead ? "dead" : ""}`}
                >
                  <button
                    className={`cp-chipbtn ${bet ? "on" : ""}`}
                    disabled={full || dead}
                    onPointerDown={(e) => { e.stopPropagation(); onChip(c); }}
                    aria-label={`Bet column ${c + 1}`}
                  >
                    <img src={chipImg("red")} alt="" draggable="false" />
                  </button>
                  <div className="cp-colcards" onPointerDown={() => { if (!dead) drop(c); }}>
                    {col.map((card, i) => (
                      <span className="cp-card" key={card.id + i}>
                        <img src={cardImg(card.id)} alt={card.id} draggable="false" />
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`cp-toast ${toast.kind} ${toast.on ? "show" : ""}`}>{toast.text}</div>

      {screen === SCREEN.TITLE && (
        <div className="cp-overlay">
          <h1>CHIP PANIC</h1>
          <div className="sub">cards fall · tap a column to drop · fill 5 to score — only a PAIR or better clears, a HIGH CARD locks the lane dead · chip a column to bet it ×3 · one discard, recharges each hand</div>
          <button className="cp-big" onPointerDown={start}>PLAY</button>
          {best != null && <div className="sub">best · {best.toLocaleString()}</div>}
        </div>
      )}

      {screen === SCREEN.OVER && (
        <div className="cp-overlay">
          <h1>GAME OVER</h1>
          <div className="sub">score · {hud.score.toLocaleString()}</div>
          {best != null && hud.score >= best && <div className="sub" style={{ color: "#34c759" }}>★ new best ★</div>}
          <button className="cp-big" onPointerDown={start}>PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}
