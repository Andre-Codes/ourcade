import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { cardImg, cardBackImg } from "../lib/kenney.js";
import { shareImage } from "../lib/share.js";
import { playSfx, playSfxVariant } from "../lib/sfx.js";
import {
  deal, drawFromStock, wasteToTableau, wasteToFoundation,
  tableauToTableau, tableauToFoundation, autoToFoundation,
  autoCompleteStep, canAutoComplete, isWon, rating,
} from "./solitaire/logic.js";

// ── Klondike Solitaire ────────────────────────────────────────────────────────
// The signature Windows-nostalgia cabinet. Real Kenney card faces, tap-to-move
// (tap source → tap destination), double-tap auto-to-foundation, auto-complete
// when solved. Scored by FEWEST MOVES (dir:"asc"). Self-contained .sol-* CSS.

const GAME_ID = "solitaire";

// mm:ss elapsed-time format.
const fmtTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const SOL_CSS = `
  .sol-root {
    width: 100vw; height: 100svh; overflow: hidden; position: relative;
    display: flex; flex-direction: column; color: #eef0ff;
    font-family: 'Share Tech Mono','Courier New',monospace;
    background:
      radial-gradient(ellipse 60% 50% at 50% 0%, rgba(63,255,208,.08), transparent 70%),
      radial-gradient(circle at 50% 60%, #0c3b30, #07211b 70%, #05140f);
    --cw: min(11.5vw, 84px); --ch: calc(var(--cw) * 1.357);
    --fan: calc(var(--cw) * 0.30);
    --fanup: calc(var(--cw) * 0.18);
    user-select: none; -webkit-user-select: none; touch-action: manipulation;
  }
  .sol-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex: 0 0 auto; }
  .sol-bar .sp { flex: 1; }
  .sol-btn {
    cursor: pointer; border-radius: 8px; padding: 8px 12px;
    font-family: 'Press Start 2P',monospace; font-size: .56rem; letter-spacing: .04em;
    color: #eef0ff; background: rgba(0,0,0,.32); border: 2px solid #2a5f50;
  }
  .sol-btn:hover { border-color: #3fffd0; }
  .sol-stat { font-size: .66rem; letter-spacing: .14em; text-transform: uppercase; color: #9fdccb; }
  .sol-stat b { color: #ffd23f; }

  .sol-top { display: flex; gap: 8px; padding: 4px 12px 8px; flex: 0 0 auto; }
  .sol-stock-area, .sol-found-area { display: flex; gap: 8px; }
  .sol-found-area { margin-left: auto; }

  .sol-tableau {
    display: flex; gap: 8px; padding: 4px 12px 16px; flex: 1 1 auto;
    align-items: flex-start; overflow: hidden;
  }
  .sol-col { flex: 1 1 0; min-width: 0; position: relative; }

  .sol-slot {
    width: var(--cw); height: var(--ch); border-radius: calc(var(--cw)*.09);
    border: 2px dashed rgba(255,255,255,.16); background: rgba(0,0,0,.16);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,.25); font-size: 1.2rem;
  }
  .sol-card {
    position: absolute; width: var(--cw); height: var(--ch);
    border-radius: calc(var(--cw)*.09);
    box-shadow: 0 1px 3px rgba(0,0,0,.5);
    cursor: pointer; transition: box-shadow .1s ease;
  }
  .sol-card img { width: 100%; height: 100%; display: block; border-radius: inherit; }
  .sol-card.sel { box-shadow: 0 0 0 3px #ffd23f, 0 4px 14px rgba(255,210,63,.5); z-index: 50; }
  .sol-card.hint { box-shadow: 0 0 0 3px #3fffd0; }
  /* stock/waste/foundation single-card holders */
  .sol-hold { position: relative; width: var(--cw); height: var(--ch); }
  .sol-hold .sol-card { position: absolute; inset: 0; }

  .sol-overlay {
    position: absolute; inset: 0; z-index: 80; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px; text-align: center;
    background: rgba(5,18,14,.86); backdrop-filter: blur(4px); padding: 24px;
  }
  .sol-overlay h1, .sol-overlay h2 {
    font-family: 'Black Ops One',sans-serif;
    background: linear-gradient(180deg,#fffbe6,#3fffd0 60%,#b44dff);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .sol-overlay h1 { font-size: clamp(2rem,8vw,3.4rem); }
  .sol-overlay h2 { font-size: clamp(1.6rem,6vw,2.6rem); }
  .sol-overlay .sub { font-size: .72rem; letter-spacing: .26em; text-transform: uppercase; color: #9fdccb; }
  .sol-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .sol-big {
    padding: 13px 18px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P',monospace; font-size: .7rem; letter-spacing: .04em;
    color: #0a0a12; background: linear-gradient(180deg,#fff,#3fffd0); border: 2px solid #0a0a12;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4);
  }
  .sol-big.alt { background: linear-gradient(180deg,#fff,#ffd23f); }
  .sol-big:hover { filter: brightness(1.08); }
  .sol-winstats { display: flex; gap: 30px; justify-content: center; }
  .sol-winstats div { font-size: .64rem; letter-spacing: .2em; text-transform: uppercase; color: #9fdccb; }
  .sol-winstats b { display: block; font-family: 'Black Ops One',sans-serif; font-size: 1.9rem; color: #ffd23f; margin-top: 4px; }
  .sol-draw-toggle { display: flex; gap: 6px; }
  .sol-draw-toggle button {
    padding: 9px 14px; cursor: pointer; border-radius: 8px;
    font-family: 'Press Start 2P',monospace; font-size: .58rem;
    color: #9aa0c8; background: #0e2a24; border: 2px solid #2a5f50;
  }
  .sol-draw-toggle button.on { color: #0a0a12; background: linear-gradient(180deg,#fff,#3fffd0); border-color:#0a0a12; }
`;

// Face-up card image, or the back for face-down.
function CardFace({ card }) {
  return <img src={card.faceUp ? cardImg(card.id) : cardBackImg()} alt={card.faceUp ? card.id : "face-down"} draggable="false" />;
}

export default function Solitaire() {
  const navigate = useNavigate();
  const { submit, best } = useArcadeScore(GAME_ID);

  const [phase, setPhase] = useState("start"); // start | playing | won
  const [drawMode, setDrawMode] = useState(1);
  const [game, setGame] = useState(null);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [sel, setSel] = useState(null); // { from:"waste"|"tab", col?, idx? }
  const [submitted, setSubmitted] = useState(false);

  useArcadeBackButton(false);

  const tick = useRef(null);
  const autoTimer = useRef(null);
  const lastTap = useRef({ key: null, t: 0 }); // manual double-tap detection
  useEffect(() => () => { clearInterval(tick.current); clearTimeout(autoTimer.current); }, []);

  // Was this target tapped twice within the double-tap window?
  function isDoubleTap(key) {
    const now = Date.now();
    const dbl = lastTap.current.key === key && now - lastTap.current.t < 280;
    lastTap.current = { key, t: now };
    return dbl;
  }

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = SOL_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  function startGame(dm) {
    clearInterval(tick.current);
    clearTimeout(autoTimer.current);
    setGame(deal(Math.random, dm));
    setDrawMode(dm);
    setMoves(0);
    setSeconds(0);
    setSel(null);
    setSubmitted(false);
    setPhase("playing");
    playSfx("card-shuffle");
    tick.current = setInterval(() => setSeconds((x) => x + 1), 1000);
  }

  // Apply a move result: bump moves, set state, clear selection, check win.
  function apply(next) {
    if (!next) return false;
    setGame(next);
    setMoves((m) => m + 1);
    setSel(null);
    playSfxVariant("card-place", [1, 3]);
    if (isWon(next)) win();
    return true;
  }

  function win() {
    clearInterval(tick.current);
    setPhase("won");
  }

  // Submit fewest-moves once at win.
  const finalMoves = moves;
  useEffect(() => {
    if (phase === "won" && !submitted) {
      submit(finalMoves);
      setSubmitted(true);
    }
  }, [phase, submitted, finalMoves, submit]);

  // ── interactions (all on pointerdown → instant, no click/dblclick delay) ──────
  function onStock() {
    const next = drawFromStock(game);
    if (next) { setGame(next); setSel(null); setMoves((m) => m + 1); playSfxVariant("card-shove", [1, 3]); }
  }

  function onWaste() {
    if (!game.waste.length) return;
    // Double-tap the waste top → auto to foundation.
    if (isDoubleTap("waste") && autoUp(null)) return;
    if (sel && sel.from === "waste") { setSel(null); return; }
    setSel({ from: "waste" });
  }

  // Send a card to foundation if any accepts it. Returns true if it moved.
  function autoUp(fromCol) {
    const r = autoToFoundation(game, fromCol);
    if (r) { apply(r.state); return true; }
    return false;
  }

  function onCardTap(col, idx) {
    const pile = game.tableau[col];
    const card = pile[idx];
    if (!card.faceUp) {
      // tapping a face-down card does nothing (auto-flip happens on a move).
      return;
    }
    const isTop = idx === pile.length - 1;
    // Double-tap the top card → auto to foundation (before treating as src/dest).
    if (isTop && isDoubleTap(`tab-${col}-${idx}`) && autoUp(col)) return;
    // If a source is already selected, treat this column as a destination.
    if (sel) {
      if (sel.from === "waste") { if (apply(wasteToTableau(game, col))) return; }
      else if (sel.from === "tab") {
        if (sel.col === col) { setSel(null); return; }
        if (apply(tableauToTableau(game, sel.col, sel.idx, col))) return;
      }
      // else: fall through to (re)select this card as the new source
    }
    // Select this card as the source (logic validates the actual move).
    if (sel && sel.from === "tab" && sel.col === col && sel.idx === idx) { setSel(null); return; }
    setSel({ from: "tab", col, idx });
  }

  function onFoundationTap(fIdx) {
    if (!sel) return;
    if (sel.from === "waste") apply(wasteToFoundation(game, fIdx));
    else if (sel.from === "tab") {
      // Only the single top card can go to a foundation.
      const pile = game.tableau[sel.col];
      if (sel.idx === pile.length - 1) apply(tableauToFoundation(game, sel.col, fIdx));
    }
  }

  function onEmptyColTap(col) {
    if (!sel) return;
    if (sel.from === "waste") apply(wasteToTableau(game, col));
    else if (sel.from === "tab" && sel.col !== col) apply(tableauToTableau(game, sel.col, sel.idx, col));
  }

  // Auto-complete: step every ~110ms until solved.
  function runAutoComplete() {
    setSel(null);
    const step = () => {
      setGame((g) => {
        const next = autoCompleteStep(g);
        if (!next) { if (g && isWon(g)) win(); return g; }
        setMoves((m) => m + 1);
        if (isWon(next)) { win(); return next; }
        autoTimer.current = setTimeout(step, 110);
        return next;
      });
    };
    step();
  }

  async function shareResult() {
    const blob = await makeResultCard(finalMoves, seconds);
    if (blob) {
      shareImage({
        blob,
        filename: "ourcade-solitaire.png",
        title: "Ourcade Solitaire",
        text: `I cleared Solitaire in ${finalMoves} moves on Ourcade!`,
      });
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────
  const selKey = (col, idx) =>
    sel && sel.from === "tab" && sel.col === col && sel.idx === idx;
  const selWaste = sel && sel.from === "waste";

  return (
    <div className="sol-root">
      <div className="sol-bar">
        <button className="sol-btn" onClick={() => navigate("/")}>← EXIT</button>
        <button className="sol-btn" onClick={() => startGame(drawMode)}>NEW</button>
        {phase === "playing" && canAutoComplete(game) && (
          <button className="sol-btn" onClick={runAutoComplete}>AUTO ▸</button>
        )}
        <span className="sp" />
        <span className="sol-stat">MOVES <b>{moves}</b></span>
        <span className="sol-stat">TIME <b>{fmtTime(seconds)}</b></span>
      </div>

      {game && (
        <>
          <div className="sol-top">
            <div className="sol-stock-area">
              {/* stock */}
              <div className="sol-hold" onPointerDown={onStock}>
                {game.stock.length ? (
                  <div className="sol-card"><CardFace card={{ faceUp: false }} /></div>
                ) : (
                  <div className="sol-slot">↻</div>
                )}
              </div>
              {/* waste */}
              <div className="sol-hold" onPointerDown={onWaste}>
                {game.waste.length ? (
                  <div className={`sol-card ${selWaste ? "sel" : ""}`}>
                    <CardFace card={game.waste[game.waste.length - 1]} />
                  </div>
                ) : (
                  <div className="sol-slot" />
                )}
              </div>
            </div>

            <div className="sol-found-area">
              {game.foundations.map((f, fIdx) => (
                <div className="sol-hold" key={fIdx} onPointerDown={() => onFoundationTap(fIdx)}>
                  {f.length ? (
                    <div className="sol-card"><CardFace card={f[f.length - 1]} /></div>
                  ) : (
                    <div className="sol-slot">♢</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="sol-tableau">
            {game.tableau.map((pile, col) => (
              <div
                className="sol-col"
                key={col}
                style={{ height: `calc(var(--ch) + ${Math.max(0, pile.length - 1)} * var(--fan))` }}
              >
                {pile.length === 0 ? (
                  <div className="sol-slot" onPointerDown={() => onEmptyColTap(col)} />
                ) : (
                  pile.map((card, idx) => (
                    <div
                      key={card.id + idx}
                      className={`sol-card ${selKey(col, idx) ? "sel" : ""}`}
                      style={{ top: `calc(${idx} * var(--fan))` }}
                      onPointerDown={() => onCardTap(col, idx)}
                    >
                      <CardFace card={card} />
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {phase === "start" && (
        <div className="sol-overlay">
          <h1>SOLITAIRE</h1>
          <div className="sub">klondike · tap a card, tap where it goes</div>
          <div className="sol-draw-toggle">
            <button className={drawMode === 1 ? "on" : ""} onClick={() => setDrawMode(1)}>DRAW 1</button>
            <button className={drawMode === 3 ? "on" : ""} onClick={() => setDrawMode(3)}>DRAW 3</button>
          </div>
          <button className="sol-big" onClick={() => startGame(drawMode)}>DEAL</button>
          {best != null && <div className="sub">best · {best} moves</div>}
        </div>
      )}

      {phase === "won" && (
        <div className="sol-overlay">
          <h2>YOU WIN!</h2>
          <div className="sub">{rating(finalMoves)}</div>
          <div className="sol-winstats">
            <div>Moves<b>{finalMoves}</b></div>
            <div>Time<b>{fmtTime(seconds)}</b></div>
          </div>
          {best != null && finalMoves <= best && <div className="sub" style={{ color: "#34c759" }}>★ new best ★</div>}
          <div className="sol-row">
            <button className="sol-big" onClick={() => startGame(drawMode)}>PLAY AGAIN</button>
            <button className="sol-big alt" onClick={shareResult}>SHARE</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Small self-contained result card (canvas) for the share button — same shape as
// the other *Card.js helpers but kept local since it's tiny.
async function makeResultCard(moves, seconds) {
  if (typeof document === "undefined") return null;
  const S = 1080;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#07211b"; ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S * 0.4, 60, S / 2, S * 0.45, S * 0.8);
  g.addColorStop(0, "rgba(63,255,208,0.18)"); g.addColorStop(1, "rgba(7,33,27,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#eef0ff"; ctx.font = "700 64px 'Black Ops One', Impact, sans-serif";
  ctx.fillText("♠ SOLITAIRE ♥", S / 2, 220);
  ctx.fillStyle = "#3fffd0"; ctx.font = "700 40px 'Press Start 2P', monospace";
  ctx.fillText("CLEARED", S / 2, 360);
  ctx.fillStyle = "#ffd23f"; ctx.font = "700 150px 'Black Ops One', sans-serif";
  ctx.fillText(String(moves), S / 2, 560);
  ctx.fillStyle = "#9fdccb"; ctx.font = "700 34px 'Press Start 2P', monospace";
  ctx.fillText("MOVES", S / 2, 680);
  ctx.fillText(fmtTime(seconds), S / 2, 760);
  ctx.fillStyle = "#6b708f"; ctx.font = "700 26px 'Press Start 2P', monospace";
  ctx.fillText("theourcade.com", S / 2, S - 90);
  return await new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}
