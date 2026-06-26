import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGet, lsSet } from "../lib/store.js";
import { cardImg, cardBackImg, chipImg } from "../lib/kenney.js";
import { playSfxVariant } from "../lib/sfx.js";
import { HAND_NAME } from "./poker/handEval.js";
import {
  newGame, placeCard, useDiscard, burnCard, cycleBet, canBet, canPlace,
  BET_TIERS, NO_BET, START_CHIPS,
} from "./chip-panic/logic.js";

/* ─────────────────────────────────────────────────────────────────────────
   HIGH CARD BUST — poker solitaire for the Ourcade cabinet `chip-panic`.

   Draw ONE card into the tray, then tap a lane to drop it there (or spend your
   discard to throw it away). A lane fills at five cards: a PAIR or better SCORES
   and CLEARS it; a HIGH CARD BUSTS and LOCKS it forever. No lives — the run ends
   when all five lanes are locked. Tap a lane's chip to PREVIEW a wager tier
   (Blue/Red/Gold/Black); it COMMITS on your next draw and must land within five
   draws. Winning a bet multiplies the lane's score and pays profit; any failure
   forfeits the stake. Classic mode is untimed; Panic mode puts a clock on each
   card and BURNS it if you dawdle. Score feeds the Arcade Score Standard board.

   The game is turn-based, so the engine state lives in plain React state and is
   reassigned on each action — no rAF game loop. The only timer is Panic mode's
   per-card placement clock (a setTimeout + a CSS-driven bar).
   ───────────────────────────────────────────────────────────────────────── */

const GAME_ID = "chip-panic";
const SCREEN = { TITLE: "title", PLAY: "play", OVER: "over" };
const MODE = { CLASSIC: "classic", PANIC: "panic" };
const PANIC_MS = 5000; // fixed placement clock in Panic mode (doc §17)

const HCB_CSS = `
  .hcb-root {
    position: relative; width: 100vw; height: 100svh; overflow: hidden;
    display: flex; flex-direction: column; align-items: center;
    color: #eef0ff; font-family: 'Share Tech Mono','Courier New',monospace;
    background:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(191,90,242,.10), transparent 70%),
      radial-gradient(circle at 50% 70%, #2a1c47, #160e2b 70%, #0c0719);
    user-select: none; -webkit-user-select: none; touch-action: manipulation;
  }
  .hcb-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; width: 100%; box-sizing: border-box; flex: 0 0 auto; }
  .hcb-bar .sp { flex: 1; }
  .hcb-btn {
    cursor: pointer; border-radius: 8px; padding: 8px 12px;
    font-family: 'Press Start 2P',monospace; font-size: .56rem; letter-spacing: .04em;
    color: #eef0ff; background: rgba(0,0,0,.32); border: 2px solid #6a3f9f;
  }
  .hcb-btn:hover { border-color: #bf5af2; }
  .hcb-stat { font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; color: #c9b3ec; white-space: nowrap; }
  .hcb-stat b { color: #ffd23f; }
  .hcb-stat.chips b { color: #3fffd0; }
  .hcb-stat.mode b { color: #bf5af2; }

  .hcb-stage { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 8px 12px; min-height: 0; width: 100%; box-sizing: border-box; }

  /* draw pile + tray + discard, centered up top */
  .hcb-top { display: flex; align-items: center; justify-content: center; gap: 16px; flex: 0 0 auto; }
  .hcb-pile { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .hcb-pile small, .hcb-tray small, .hcb-discard small { font-size: .42rem; letter-spacing: .1em; color: #9b86c4; text-transform: uppercase; }
  .hcb-tray { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .hcb-tray .hcb-card { box-shadow: 0 0 0 2px #bf5af2, 0 4px 16px rgba(191,90,242,.55); }
  .hcb-discard {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    cursor: pointer; border-radius: 9px; padding: 8px 10px;
    border: 2px solid #6a3f9f; background: rgba(0,0,0,.32); color: #eef0ff;
    font-family: 'Press Start 2P',monospace;
  }
  .hcb-discard:hover:not(:disabled) { border-color: #bf5af2; }
  .hcb-discard .ic { font-size: 1.2rem; line-height: 1; }
  .hcb-discard.ready { border-color: #3fffd0; box-shadow: 0 0 12px rgba(63,255,208,.35); }
  .hcb-discard:disabled { opacity: .35; cursor: not-allowed; }

  /* panic placement clock under the tray */
  .hcb-clock { width: min(58vw, 300px); height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; }
  .hcb-clock i { display: block; height: 100%; background: linear-gradient(90deg,#3fffd0,#ffd23f,#ff6b6b); }

  /* the five lanes */
  .hcb-lanes { display: flex; gap: min(2.2vw, 14px); align-items: flex-start; justify-content: center; flex: 1 1 auto; min-height: 0; }
  .hcb-lane { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 0 0 auto; }
  .hcb-slots {
    --tier: #ffd23f;
    display: flex; flex-direction: column-reverse; gap: 2px; cursor: pointer;
    box-sizing: border-box; align-items: center;
    width: calc(var(--cw) + 8px);
    min-height: calc(var(--ch) * 5 + 8px); justify-content: flex-end;
    padding: 4px; border-radius: 9px; border: 2px dashed rgba(255,255,255,.14);
    background: rgba(0,0,0,.18); position: relative;
  }
  .hcb-lane.betted .hcb-slots { border-style: dotted; border-color: var(--tier); box-shadow: 0 0 14px color-mix(in srgb, var(--tier) 45%, transparent) inset; }
  .hcb-lane.expiring .hcb-slots { animation: hcb-pulse .7s ease-in-out infinite; }
  @keyframes hcb-pulse { 0%,100% { box-shadow: 0 0 6px var(--tier) inset; } 50% { box-shadow: 0 0 20px var(--tier) inset, 0 0 12px var(--tier); } }
  .hcb-lane.scored .hcb-slots { border-color: #3fffd0; border-style: solid; box-shadow: 0 0 22px rgba(63,255,208,.55); }
  .hcb-lane.busted .hcb-slots, .hcb-lane.locked .hcb-slots { border-color: #555; border-style: solid; background: rgba(0,0,0,.42); cursor: default; box-shadow: none; }
  .hcb-lane.locked .hcb-card { filter: grayscale(1) brightness(.5); }
  .hcb-lane.locked .hcb-slots::after {
    content: "✕"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--cw) * .95); color: rgba(255,107,107,.7); font-family: 'Black Ops One',sans-serif; pointer-events: none;
  }
  .hcb-card { width: var(--cw); height: var(--ch); border-radius: calc(var(--cw)*.09); display: block; }
  .hcb-card img { width: 100%; height: 100%; display: block; border-radius: inherit; }
  .hcb-card.back img { opacity: .9; }

  /* per-lane chip + bet readout */
  .hcb-betbox { display: flex; flex-direction: column; align-items: center; gap: 2px; height: 58px; justify-content: flex-start; }
  .hcb-chip {
    width: 38px; height: 38px; cursor: pointer; padding: 0;
    border-radius: 50%; border: 2px solid rgba(255,255,255,.18);
    background: rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center; position: relative;
  }
  .hcb-chip img { width: 32px; height: 32px; display: block; }
  .hcb-chip.empty { font-family:'Press Start 2P',monospace; font-size:.5rem; color:#9b86c4; }
  .hcb-chip:hover:not(:disabled) { border-color: #bf5af2; }
  .hcb-chip:disabled { opacity: .35; cursor: not-allowed; }
  .hcb-chip .cd {
    position: absolute; right: -6px; top: -6px; min-width: 17px; height: 17px; padding: 0 3px;
    border-radius: 9px; background: #ff6b6b; color: #1a0a0a; font-family:'Press Start 2P',monospace;
    font-size: .46rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  }
  .hcb-chip .cd.warn { background: #ffd23f; }
  .hcb-req { font-size: .42rem; letter-spacing: .04em; color: #c9b3ec; text-transform: uppercase; min-height: .7em; text-align: center; }

  .hcb-feed {
    position: absolute; top: 16%; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    pointer-events: none; opacity: 0; transition: opacity .18s; text-align: center; white-space: nowrap; z-index: 60;
  }
  .hcb-feed.show { opacity: 1; }
  .hcb-feed .hand { font-family: 'Black Ops One',sans-serif; font-size: clamp(1.1rem,4.6vw,1.9rem); color: #ffd23f; text-shadow: 0 2px 10px rgba(0,0,0,.6); }
  .hcb-feed .math { font-size: .7rem; letter-spacing: .12em; color: #eef0ff; }
  .hcb-feed.win .hand { color: #3fffd0; }
  .hcb-feed.bad .hand { color: #ff6b6b; }
  .hcb-feed .why { font-size: .56rem; letter-spacing: .1em; color: #ff9b9b; text-transform: uppercase; }

  .hcb-overlay {
    position: absolute; inset: 0; z-index: 80; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px; text-align: center;
    background: rgba(12,7,25,.93); backdrop-filter: blur(4px); padding: 24px;
  }
  .hcb-overlay h1 {
    font-family: 'Black Ops One',sans-serif; font-size: clamp(2rem,9vw,3.6rem); margin: 0;
    background: linear-gradient(180deg,#fffbe6,#bf5af2 55%,#3fffd0);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .hcb-overlay .sub { font-size: .72rem; letter-spacing: .18em; text-transform: uppercase; color: #c9b3ec; max-width: 34ch; line-height: 1.7; }
  .hcb-modes { display: flex; gap: 10px; }
  .hcb-mode {
    cursor: pointer; border-radius: 9px; padding: 10px 14px; min-width: 96px;
    font-family: 'Press Start 2P',monospace; font-size: .58rem; letter-spacing: .04em;
    color: #eef0ff; background: rgba(0,0,0,.32); border: 2px solid #6a3f9f;
  }
  .hcb-mode small { display:block; margin-top:6px; font-size:.42rem; color:#9b86c4; letter-spacing:.06em; }
  .hcb-mode.on { border-color: #3fffd0; box-shadow: 0 0 12px rgba(63,255,208,.3); color:#fff; }
  .hcb-big {
    padding: 13px 22px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P',monospace; font-size: .72rem; letter-spacing: .04em;
    color: #0a0a12; background: linear-gradient(180deg,#fff,#bf5af2); border: 2px solid #0a0a12;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4);
  }
  .hcb-big:hover { filter: brightness(1.08); }
`;

export default function ChipPanic() {
  const navigate = useNavigate();
  const { submit, best } = useArcadeScore(GAME_ID);

  const [screen, setScreen] = useState(SCREEN.TITLE);
  const [mode, setMode] = useState(() => lsGet("chip-panic:mode", MODE.CLASSIC));
  const [game, setGame] = useState(null);
  const [feed, setFeed] = useState(null); // { hand, math, why, kind, on }
  const [panicPct, setPanicPct] = useState(1);
  // transient per-lane flashes for the scored/busted burst (lane index → "scored"|"busted")
  const [flash, setFlash] = useState({});

  useArcadeBackButton(screen !== SCREEN.PLAY);

  const feedTimer = useRef(null);
  const flashTimer = useRef(null);
  const panicTimer = useRef(null); // { id, raf, start }
  const gameRef = useRef(game); // latest game for timer/handler closures
  useEffect(() => { gameRef.current = game; }, [game]);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = HCB_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  const clearPanic = useCallback(() => {
    const p = panicTimer.current;
    if (!p) return;
    clearTimeout(p.id);
    cancelAnimationFrame(p.raf);
    panicTimer.current = null;
  }, []);

  const showFeed = useCallback((f) => {
    clearTimeout(feedTimer.current);
    setFeed({ ...f, on: true });
    feedTimer.current = setTimeout(() => setFeed((x) => (x ? { ...x, on: false } : x)), 1500);
  }, []);

  // ── apply an engine result: store new state, animate, end the run if over ──────
  const applyResult = useCallback((next, result) => {
    setGame(next);

    if (result.type === "place") playSfxVariant("card-place", [1, 3]);
    else if (result.burned) playSfxVariant("card-place", [1, 3]);

    const res = result.resolution;
    if (res) {
      const lane = res.laneIndex;
      if (res.scored) {
        const won = res.bet && res.bet.won;
        const math = res.multiplier > 1
          ? `${res.basePoints} × ${res.multiplier} = ${res.points}`
          : `+${res.points}`;
        let why = "";
        if (res.bet && !won) why = `bet failed · needed ${HAND_NAME[BET_TIERS[res.bet.tier].min]}+`;
        showFeed({ hand: res.hand.name, math, why, kind: won ? "win" : (res.bet ? "bad" : "") });
        playSfxVariant("chips-stack", [1, 3]);
        setFlash((f) => ({ ...f, [lane]: "scored" }));
      } else {
        const why = res.bet ? "high card bust · bet lost" : "high card bust";
        showFeed({ hand: res.hand.name, math: "lane locked", why, kind: "bad" });
        setFlash((f) => ({ ...f, [lane]: "busted" }));
      }
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash({}), 650);
    } else if (result.expired && result.expired.length) {
      showFeed({ hand: "BET EXPIRED", math: "", why: "ran out of draws", kind: "bad" });
    }

    if (next.over) {
      clearPanic();
      submit(next.score);
      setScreen(SCREEN.OVER);
    }
  }, [showFeed, clearPanic, submit]);

  // ── Panic placement clock: arm a fresh timer whenever the tray changes ─────────
  useEffect(() => {
    if (screen !== SCREEN.PLAY || mode !== MODE.PANIC) return undefined;
    if (!game || game.over || game.tray == null) return undefined;
    clearPanic();
    const start = performance.now();
    setPanicPct(1);
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.max(0, 1 - elapsed / PANIC_MS);
      setPanicPct(pct);
      if (pct > 0) panicTimer.current.raf = requestAnimationFrame(tick);
    };
    const id = setTimeout(() => {
      // time's up: burn the tray card (never auto-place — doc §14)
      const g = gameRef.current;
      if (!g || g.over || g.tray == null) return;
      const { state, result } = burnCard(g);
      showFeed({ hand: "BURNED", math: "", why: "out of time", kind: "bad" });
      applyResult(state, result);
    }, PANIC_MS);
    panicTimer.current = { id, raf: requestAnimationFrame(tick), start };
    return clearPanic;
    // re-arm when the tray identity changes (a new card was drawn) or mode/screen flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, mode, game && game.tray && game.tray.id, game && game.draws]);

  useEffect(() => () => { clearTimeout(feedTimer.current); clearTimeout(flashTimer.current); clearPanic(); }, [clearPanic]);

  // ── actions ────────────────────────────────────────────────────────────────
  const start = useCallback((m) => {
    const chosen = m || mode;
    setMode(chosen);
    lsSet("chip-panic:mode", chosen);
    const g = newGame();
    setGame(g);
    setFeed(null);
    setFlash({});
    setPanicPct(1);
    setScreen(SCREEN.PLAY);
  }, [mode]);

  const onLane = useCallback((l) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    if (!canPlace(g, l)) return;
    const { state, result } = placeCard(g, l);
    applyResult(state, result);
  }, [applyResult]);

  const onChip = useCallback((l) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    const next = cycleBet(g, l);
    if (next !== g) playSfxVariant("chip-lay", [1, 3]);
    setGame(next);
  }, []);

  const onDiscard = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.over || !g.discard) return;
    const { state, result } = useDiscard(g);
    playSfxVariant("card-place", [1, 3]);
    applyResult(state, result);
  }, [applyResult]);

  // ── render ───────────────────────────────────────────────────────────────────
  const rootStyle = { "--cw": "min(15vw, 66px)", "--ch": "calc(var(--cw) * 1.357)" };
  const g = game;

  return (
    <div className="hcb-root" style={rootStyle}>
      <div className="hcb-bar">
        <button className="hcb-btn" onClick={() => (screen === SCREEN.PLAY ? (clearPanic(), submit(g?.score || 0), setScreen(SCREEN.OVER)) : navigate("/"))}>
          {screen === SCREEN.PLAY ? "QUIT" : "← EXIT"}
        </button>
        <span className="sp" />
        <span className="hcb-stat">SCORE <b>{(g?.score || 0).toLocaleString()}</b></span>
        <span className="hcb-stat chips">CHIPS <b>{g?.chips ?? START_CHIPS}</b></span>
        {screen === SCREEN.PLAY && (
          <span className="hcb-stat mode"><b>{mode === MODE.PANIC ? "PANIC" : "CLASSIC"}</b></span>
        )}
      </div>

      {screen === SCREEN.PLAY && g && (
        <div className="hcb-stage">
          <div className="hcb-top">
            <div className="hcb-pile">
              <span className="hcb-card back"><img src={cardBackImg()} alt="deck" draggable="false" /></span>
              <small>DECK</small>
            </div>
            <div className="hcb-tray">
              <span className="hcb-card">
                {g.tray && <img src={cardImg(g.tray.id)} alt={g.tray.id} draggable="false" />}
              </span>
              {mode === MODE.PANIC
                ? <div className="hcb-clock"><i style={{ width: `${Math.round(panicPct * 100)}%` }} /></div>
                : <small>YOUR CARD</small>}
            </div>
            <button
              className={`hcb-discard ${g.discard ? "ready" : ""}`}
              disabled={!g.discard}
              onPointerDown={(e) => { e.stopPropagation(); onDiscard(); }}
              aria-label="Discard the drawn card"
            >
              <span className="ic">🗑</span>
              <small>{g.discard ? "DISCARD" : "SPENT"}</small>
            </button>
          </div>

          <div className="hcb-lanes">
            {g.lanes.map((lane, l) => {
              const locked = g.locked[l];
              const sel = g.betSel[l];
              const committed = g.bet[l];
              const tierIdx = committed ? committed.tier : sel;
              const tier = BET_TIERS[tierIdx] || BET_TIERS[0];
              const betted = !!committed || sel !== NO_BET;
              const expiring = committed && committed.draws <= 1;
              const fl = flash[l];
              // chip is tappable when no bet is committed yet and there's something
              // to cycle: a real tier you can afford, or a preview to clear.
              const canCycle = sel !== NO_BET ||
                BET_TIERS.some((_, t) => t !== NO_BET && canBet(g, l, t));
              return (
                <div
                  key={l}
                  className={`hcb-lane ${betted ? "betted" : ""} ${expiring ? "expiring" : ""} ${locked ? "locked" : ""} ${fl || ""}`}
                  style={{ "--tier": glow(tier.color) }}
                >
                  <div className="hcb-slots" onPointerDown={() => onLane(l)}>
                    {lane.map((card, i) => (
                      <span className="hcb-card" key={card.id + i}>
                        <img src={cardImg(card.id)} alt={card.id} draggable="false" />
                      </span>
                    ))}
                  </div>
                  <div className="hcb-betbox">
                    <button
                      className={`hcb-chip ${sel === NO_BET && !committed ? "empty" : ""}`}
                      disabled={locked || !!committed || !canCycle}
                      onPointerDown={(e) => { e.stopPropagation(); onChip(l); }}
                      aria-label={`Cycle bet on lane ${l + 1}`}
                    >
                      {tier.color
                        ? <img src={chipImg(tier.color)} alt={tier.label} draggable="false" />
                        : "BET"}
                      {committed && (
                        <span className={`cd ${committed.draws <= 1 ? "" : "warn"}`}>{committed.draws}</span>
                      )}
                    </button>
                    <span className="hcb-req">
                      {tierIdx !== NO_BET ? `${HAND_NAME[tier.min]}+` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`hcb-feed ${feed?.kind || ""} ${feed?.on ? "show" : ""}`}>
        {feed && <span className="hand">{feed.hand}</span>}
        {feed?.math && <span className="math">{feed.math}</span>}
        {feed?.why && <span className="why">{feed.why}</span>}
      </div>

      {screen === SCREEN.TITLE && (
        <div className="hcb-overlay">
          <h1>HIGH CARD BUST</h1>
          <div className="sub">draw a card · drop it in a lane · fill five to score — a PAIR+ clears the lane, a HIGH CARD locks it for good · all five locked ends the run · chip a lane to bet a multiplier (it must land in 5 draws)</div>
          <div className="hcb-modes">
            <button className={`hcb-mode ${mode === MODE.CLASSIC ? "on" : ""}`} onPointerDown={() => { setMode(MODE.CLASSIC); lsSet("chip-panic:mode", MODE.CLASSIC); }}>
              CLASSIC<small>no timer · pure strategy</small>
            </button>
            <button className={`hcb-mode ${mode === MODE.PANIC ? "on" : ""}`} onPointerDown={() => { setMode(MODE.PANIC); lsSet("chip-panic:mode", MODE.PANIC); }}>
              PANIC<small>5s per card · burns if slow</small>
            </button>
          </div>
          <button className="hcb-big" onPointerDown={() => start()}>PLAY</button>
          {best != null && <div className="sub">best · {best.toLocaleString()}</div>}
        </div>
      )}

      {screen === SCREEN.OVER && (
        <div className="hcb-overlay">
          <h1>GAME OVER</h1>
          <div className="sub">score · {(g?.score || 0).toLocaleString()}</div>
          {best != null && (g?.score || 0) >= best && <div className="sub" style={{ color: "#34c759" }}>★ new best ★</div>}
          <button className="hcb-big" onPointerDown={() => start()}>PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}

// Map a Kenney chip color name to a CSS glow color for the lane border/pulse.
function glow(color) {
  return ({ blue: "#3aa0ff", red: "#ff5a5a", green: "#3fd07a", black: "#cbb4ff", white: "#eef0ff" })[color] || "#ffd23f";
}
