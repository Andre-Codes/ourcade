import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGet, lsSet } from "../lib/store.js";
import { cardImg, cardBackImg, chipImg } from "../lib/kenney.js";
import { playSfxVariant } from "../lib/sfx.js";
import { useFx, FxLayer } from "../lib/fx.jsx";
import { HAND_NAME } from "./poker/handEval.js";
import {
  newGame, placeCard, useDiscard, burnCard, cycleRaise, canRaise, canPlace,
  TIERS, ANTE_TIER, ANTE_COST, NO_RAISE, START_CHIPS,
} from "./chip-panic/logic.js";

/* ─────────────────────────────────────────────────────────────────────────
   HIGH CARD BUST — poker solitaire with a chip economy + rotating objectives.

   Draw ONE card into the tray, then tap a lane to drop it (or spend your discard).
   Opening an empty lane costs a Blue ANTE (1 chip). A lane fills at five cards and
   resolves three ways: a HIGH CARD busts + locks it (ante lost), ANY PAIR is a
   defensive SAVE (clears the lane but scores 0 and burns the ante), and TWO PAIR or
   better truly SCORES (points, chips back, refreshes the discard). Raise above the
   ante (Red/Gold/Black) for a multiplier — raises need stronger hands and expire.
   Chase the WANTED hand up top for bonus points + chips and build a streak (resets
   when a lane busts). The run ends when all five lanes lock — or you're out of
   chips with nowhere legal to place. Score feeds the Arcade Score Standard board.

   Turn-based: engine state lives in plain React state. The only timer is Panic
   mode's per-card placement clock.
   ───────────────────────────────────────────────────────────────────────── */

const GAME_ID = "chip-panic";
const SCREEN = { TITLE: "title", PLAY: "play", OVER: "over" };
const MODE = { CLASSIC: "classic", PANIC: "panic" };
const PANIC_MS = 5000;

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
  .hcb-stat { font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: #c9b3ec; white-space: nowrap; }
  .hcb-stat b { color: #ffd23f; font-size: 1.15rem; vertical-align: -.06em; }
  .hcb-stat.chips b { color: #3fffd0; text-shadow: 0 0 8px rgba(63,255,208,.45); }
  .hcb-stat.mode b { color: #bf5af2; font-size: .72rem; vertical-align: 0; }

  /* WANTED banner — the rotating objective */
  .hcb-wanted {
    display: flex; align-items: center; gap: 10px; flex: 0 0 auto;
    margin: 2px 8px 0; padding: 6px 14px; border-radius: 999px;
    border: 2px solid #ffd23f; background: linear-gradient(180deg, rgba(255,210,63,.12), rgba(0,0,0,.3));
    box-shadow: 0 0 14px rgba(255,210,63,.2);
  }
  .hcb-wanted .star { font-size: 1rem; line-height: 1; filter: drop-shadow(0 0 6px rgba(255,210,63,.8)); }
  .hcb-wanted .lbl { font-family: 'Black Ops One',sans-serif; letter-spacing: .08em; color: #ffd23f; font-size: .95rem; }
  .hcb-wanted .rew { font-size: .56rem; letter-spacing: .06em; color: #9be7d8; text-transform: uppercase; }
  .hcb-wanted .rew b { color: #3fffd0; }
  .hcb-wanted .streak { margin-left: 6px; font-size: .58rem; letter-spacing: .08em; color: #c9b3ec; text-transform: uppercase; }
  .hcb-wanted .streak b { color: #ff9f43; font-family: 'Press Start 2P',monospace; font-size: .62rem; }
  .hcb-wanted.claim { animation: hcb-wanted-claim 700ms ease-out; }
  @keyframes hcb-wanted-claim { 0%{ transform: scale(1); } 30%{ transform: scale(1.06); box-shadow: 0 0 28px rgba(63,255,208,.7); border-color: #3fffd0; } 100%{ transform: scale(1); } }

  .hcb-stage { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 10px; padding: clamp(12px, 3.5vh, 30px) 8px 12px; min-height: 0; width: 100%; box-sizing: border-box; }

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

  .hcb-clock { width: min(58vw, 300px); height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; }
  .hcb-clock i { display: block; height: 100%; background: linear-gradient(90deg,#3fffd0,#ffd23f,#ff6b6b); }

  .hcb-lanes { display: flex; gap: min(2.2vw, 14px); align-items: flex-start; justify-content: center; flex: 1 1 auto; min-height: 0; margin-top: clamp(8px, 2.5vh, 24px); }
  .hcb-lane { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 0 0 auto; }
  .hcb-slots {
    --tier: #ffd23f;
    display: flex; flex-direction: column-reverse; gap: 2px; cursor: pointer;
    box-sizing: border-box; align-items: center;
    width: calc(var(--cw) + 8px);
    height: calc(var(--ch) * 5 + 8px + 8px); justify-content: flex-end;
    padding: 4px; border-radius: 9px; border: 2px dashed rgba(255,255,255,.14);
    background: rgba(0,0,0,.18); position: relative;
  }
  .hcb-lane.anted .hcb-slots { border-style: solid; border-color: rgba(58,160,255,.5); }
  .hcb-lane.betted .hcb-slots { border-style: dotted; border-color: var(--tier); box-shadow: 0 0 14px color-mix(in srgb, var(--tier) 45%, transparent) inset; }
  .hcb-lane.expiring .hcb-slots { animation: hcb-pulse .7s ease-in-out infinite; }
  @keyframes hcb-pulse { 0%,100% { box-shadow: 0 0 6px var(--tier) inset; } 50% { box-shadow: 0 0 20px var(--tier) inset, 0 0 12px var(--tier); } }
  .hcb-lane.scored .hcb-slots { border-color: #3fffd0; border-style: solid; box-shadow: 0 0 22px rgba(63,255,208,.55); }
  .hcb-lane.saved .hcb-slots { border-color: #ffb454; border-style: solid; box-shadow: 0 0 16px rgba(255,180,84,.4); }
  .hcb-lane.busted .hcb-slots, .hcb-lane.locked .hcb-slots { border-color: #555; border-style: solid; background: rgba(0,0,0,.42); cursor: default; box-shadow: none; }
  .hcb-lane.locked .hcb-card { filter: grayscale(1) brightness(.5); }
  .hcb-lane.locked .hcb-slots::after {
    content: "✕"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--cw) * .95); color: rgba(255,107,107,.7); font-family: 'Black Ops One',sans-serif; pointer-events: none;
  }
  /* "open this lane" hint on an empty, affordable lane */
  .hcb-slots .hcb-open {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    color: #7fb6ff; pointer-events: none; opacity: .8;
  }
  .hcb-slots .hcb-open img { width: 30px; height: 30px; opacity: .7; }
  .hcb-slots .hcb-open small { font-family: 'Press Start 2P',monospace; font-size: .42rem; letter-spacing: .04em; color: #7fb6ff; }
  .hcb-lane.cant .hcb-slots { opacity: .5; cursor: not-allowed; }
  .hcb-lane.cant .hcb-open { color: #ff8a8a; }
  .hcb-lane.cant .hcb-open small { color: #ff8a8a; }

  .hcb-card { width: var(--cw); height: var(--ch); border-radius: calc(var(--cw)*.09); display: block; }
  .hcb-card img { width: 100%; height: 100%; display: block; border-radius: inherit; }
  .hcb-card.back img { opacity: .9; }

  .hcb-betbox { display: flex; flex-direction: column; align-items: center; gap: 2px; height: 58px; justify-content: flex-start; }
  .hcb-chip {
    width: 38px; height: 38px; cursor: pointer; padding: 0;
    border-radius: 50%; border: 2px solid rgba(255,255,255,.18);
    background: rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center; position: relative;
  }
  .hcb-chip img { width: 32px; height: 32px; display: block; }
  .hcb-chip.empty { font-family:'Press Start 2P',monospace; font-size:.46rem; color:#9b86c4; }
  .hcb-chip:hover:not(:disabled) { border-color: #bf5af2; }
  .hcb-chip:disabled { opacity: .4; cursor: default; }
  .hcb-chip .cd {
    position: absolute; right: -6px; top: -6px; min-width: 17px; height: 17px; padding: 0 3px;
    border-radius: 9px; background: #ff6b6b; color: #1a0a0a; font-family:'Press Start 2P',monospace;
    font-size: .46rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  }
  .hcb-chip .cd.warn { background: #ffd23f; }
  .hcb-req { font-size: .42rem; letter-spacing: .04em; color: #c9b3ec; text-transform: uppercase; min-height: .7em; text-align: center; }

  .hcb-feed {
    position: absolute; top: 22%; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    pointer-events: none; opacity: 0; transition: opacity .18s; text-align: center; white-space: nowrap; z-index: 60;
  }
  .hcb-feed.show { opacity: 1; }
  .hcb-feed .hand { font-family: 'Black Ops One',sans-serif; font-size: clamp(1.1rem,4.6vw,1.9rem); color: #ffd23f; text-shadow: 0 2px 10px rgba(0,0,0,.6); }
  .hcb-feed .math { font-size: .7rem; letter-spacing: .12em; color: #eef0ff; }
  .hcb-feed.win .hand { color: #3fffd0; }
  .hcb-feed.bad .hand { color: #ff6b6b; }
  .hcb-feed.save .hand { color: #ffb454; }
  .hcb-feed .why { font-size: .56rem; letter-spacing: .1em; color: #ff9b9b; text-transform: uppercase; }

  /* ── fx layer: lane-anchored burst, flying/falling chips, coral bloom, wanted claim ── */
  .hcb-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 70; }
  .hcb-fx .fx-burst {
    position: absolute; transform: translate(-50%,-100%); white-space: nowrap; text-align: center;
    font-family: 'Black Ops One',sans-serif; font-size: clamp(1.4rem,7vw,2.6rem); color: #3fffd0;
    text-shadow: 0 0 10px rgba(63,255,208,.7), 0 2px 14px rgba(0,0,0,.7);
    animation: hcb-burst 1100ms cubic-bezier(.18,.9,.24,1) forwards;
  }
  .hcb-fx .fx-burst.bad { color: #ff6b6b; text-shadow: 0 0 10px rgba(255,107,107,.7), 0 2px 14px rgba(0,0,0,.7); }
  .hcb-fx .fx-burst.save { color: #ffb454; text-shadow: 0 0 10px rgba(255,180,84,.6), 0 2px 14px rgba(0,0,0,.7); }
  .hcb-fx .fx-burst .pts { display: block; font-family: 'Press Start 2P',monospace; font-size: .7rem; color: #ffd23f; margin-top: 5px; text-shadow: 0 2px 6px rgba(0,0,0,.7); }
  @keyframes hcb-burst {
    0%   { opacity: 0; transform: translate(-50%,-90%)  scale(.6); }
    18%  { opacity: 1; transform: translate(-50%,-100%) scale(1.18); }
    32%  {            transform: translate(-50%,-100%) scale(1); }
    78%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%,-150%) scale(1.02); }
  }
  .hcb-fx .fx-chip { position: absolute; width: 26px; height: 26px; transform: translate(-50%,-50%); will-change: transform,opacity; filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
  .hcb-fx .fx-chip img { width: 100%; height: 100%; display: block; }
  .hcb-fx .fx-chip.fly  { animation: hcb-chipfly 720ms cubic-bezier(.4,.05,.5,1) forwards; }
  .hcb-fx .fx-chip.fall { animation: hcb-chipfall 760ms ease-in forwards; }
  @keyframes hcb-chipfly {
    0%   { opacity: 0; transform: translate(-50%,-50%) translate(0,0) scale(.7); }
    12%  { opacity: 1; transform: translate(-50%,-50%) translate(calc(var(--dx)*.12), calc(var(--dy)*.12 + var(--arc))) scale(1); }
    70%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.6); }
  }
  @keyframes hcb-chipfall {
    0%   { opacity: 1; transform: translate(-50%,-50%) translateY(0) rotate(0); }
    100% { opacity: 0; transform: translate(-50%,-50%) translateY(var(--fall)) rotate(var(--spin)); }
  }
  .hcb-fx .fx-flash { position: absolute; inset: 0; background: radial-gradient(circle at var(--fx,50%) 42%, rgba(255,107,107,.30), transparent 60%); animation: hcb-flash 400ms ease-out forwards; }
  @keyframes hcb-flash { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }

  .hcb-stat.chips.bump b { animation: hcb-hudbump 360ms ease-out; }
  @keyframes hcb-hudbump { 50% { transform: scale(1.28); color: #fff; } }

  /* WANTED CLAIMED splash */
  .hcb-claim {
    position: absolute; top: 30%; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 3px; z-index: 75;
    pointer-events: none; text-align: center; opacity: 0;
  }
  .hcb-claim.show { animation: hcb-claim 1500ms ease-out forwards; }
  @keyframes hcb-claim { 0%{opacity:0; transform:translate(-50%,8px) scale(.9);} 12%{opacity:1; transform:translate(-50%,0) scale(1.05);} 22%{transform:translate(-50%,0) scale(1);} 80%{opacity:1;} 100%{opacity:0; transform:translate(-50%,-14px) scale(1);} }
  .hcb-claim .tag { font-family:'Press Start 2P',monospace; font-size:.6rem; letter-spacing:.1em; color:#ffd23f; text-shadow:0 0 8px rgba(255,210,63,.7); }
  .hcb-claim .hand { font-family:'Black Ops One',sans-serif; font-size: clamp(1.3rem,6vw,2.2rem); color:#3fffd0; text-shadow:0 0 12px rgba(63,255,208,.7),0 2px 10px rgba(0,0,0,.7); }
  .hcb-claim .rew { font-family:'Press Start 2P',monospace; font-size:.56rem; color:#9be7d8; }
  .hcb-claim .rew b { color:#3fffd0; }

  @media (prefers-reduced-motion: reduce) {
    .hcb-fx .fx-burst, .hcb-fx .fx-chip, .hcb-fx .fx-flash, .hcb-claim.show, .hcb-wanted.claim { animation-duration: 1ms !important; }
  }

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
  .hcb-overlay .sub { font-size: .72rem; letter-spacing: .18em; text-transform: uppercase; color: #c9b3ec; max-width: 36ch; line-height: 1.7; }
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
  const [feed, setFeed] = useState(null);
  const [claim, setClaim] = useState(null); // { hand, pts, chips, streak, on } — WANTED CLAIMED splash
  const [panicPct, setPanicPct] = useState(1);
  const [flash, setFlash] = useState({}); // lane index → "scored"|"saved"|"busted"
  const [hudBump, setHudBump] = useState(false);
  const [bannerClaim, setBannerClaim] = useState(false); // pulse the WANTED banner

  useArcadeBackButton(screen !== SCREEN.PLAY);

  const { parts, spawn, clear: clearFx } = useFx();

  const feedTimer = useRef(null);
  const flashTimer = useRef(null);
  const panicTimer = useRef(null);
  const bumpTimer = useRef(null);
  const claimTimer = useRef(null);
  const bannerTimer = useRef(null);
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  const rootRef = useRef(null);
  const laneRefs = useRef([]);
  const chipHudRef = useRef(null);
  const reduceMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    reduceMotion.current = !!mq?.matches;
    const on = (e) => { reduceMotion.current = e.matches; };
    mq?.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);

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

  const bumpHud = useCallback((delay = 0) => {
    clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(() => {
      setHudBump(true);
      setTimeout(() => setHudBump(false), 380);
    }, delay);
  }, []);

  const fxFromLane = useCallback((lane) => {
    const rootEl = rootRef.current;
    const laneEl = laneRefs.current[lane];
    if (!rootEl || !laneEl) return null;
    const root = rootEl.getBoundingClientRect();
    const lr = laneEl.getBoundingClientRect();
    const hr = chipHudRef.current?.getBoundingClientRect();
    const laneX = lr.left - root.left + lr.width / 2;
    return {
      laneX,
      laneTop: lr.top - root.top,
      laneMidY: lr.top - root.top + lr.height * 0.35,
      hudX: hr ? hr.left - root.left + hr.width / 2 : laneX,
      hudY: hr ? hr.top - root.top + hr.height / 2 : 0,
      lanePct: root.width ? (laneX / root.width) * 100 : 50,
    };
  }, []);

  const spawnChipsTo = useCallback((color, n, laneX, laneMidY, hudX, hudY) => {
    const src = chipImg(color);
    const count = Math.min(n, 8);
    for (let i = 0; i < count; i++) {
      spawn({
        kind: "chip", src, x: laneX + (Math.random() * 18 - 9), y: laneMidY,
        dx: hudX - laneX, dy: hudY - laneMidY, arc: -40 - Math.random() * 24,
        delay: i * 55, ttl: 720 + i * 55 + 60,
      });
    }
    bumpHud((count - 1) * 55 + 360);
  }, [spawn, bumpHud]);

  const spawnFallingChips = useCallback((color, n, laneX, laneMidY) => {
    const src = chipImg(color);
    const count = Math.min(n, 6);
    for (let i = 0; i < count; i++) {
      spawn({
        kind: "chip", src, x: laneX + (Math.random() * 30 - 15), y: laneMidY,
        fall: 90 + Math.random() * 70, spin: Math.random() * 360 - 180,
        delay: i * 40, ttl: 760 + i * 40,
      });
    }
  }, [spawn]);

  // ── apply an engine result: store new state, animate, end the run if over ──────
  const applyResult = useCallback((next, result) => {
    setGame(next);

    if (result.type === "place") playSfxVariant("card-place", [1, 3]);
    else if (result.burned) playSfxVariant("card-place", [1, 3]);

    const res = result.resolution;
    if (res) {
      const lane = res.laneIndex;
      const geo = reduceMotion.current ? null : fxFromLane(lane);

      if (res.scored) {
        const pts = res.multiplier > 1 ? `${res.basePoints} × ${res.multiplier} = ${res.points}` : `+${res.points}`;
        if (geo) spawn({ kind: "burst", x: geo.laneX, y: geo.laneTop, text: res.hand.name, pts, ttl: 1150 });
        if (geo && res.chipsReturned > 0) {
          const color = res.raise && res.raise.won ? TIERS[res.raise.tier].color : TIERS[ANTE_TIER].color;
          spawnChipsTo(color, res.chipsReturned, geo.laneX, geo.laneMidY, geo.hudX, geo.hudY);
        }
        if (res.raise && !res.raise.won) {
          showFeed({ hand: "", math: "", why: `raise failed · needed ${TIERS[res.raise.tier].reqLabel}`, kind: "bad" });
        }
        playSfxVariant("chips-stack", [1, 3]);
        setFlash((f) => ({ ...f, [lane]: "scored" }));
      } else if (res.saved) {
        if (geo) spawn({ kind: "burst", x: geo.laneX, y: geo.laneTop, text: res.hand.name, pts: "SAVE · no score", save: true, ttl: 1150 });
        if (geo && res.chipsLost > 0) spawnFallingChips(TIERS[ANTE_TIER].color, res.chipsLost, geo.laneX, geo.laneMidY);
        showFeed({ hand: "", math: "", why: "pair only — ante lost", kind: "save" });
        setFlash((f) => ({ ...f, [lane]: "saved" }));
      } else {
        // bust
        if (geo) {
          spawn({ kind: "flash", fxPct: geo.lanePct, ttl: 420 });
          spawn({ kind: "burst", x: geo.laneX, y: geo.laneTop, text: res.hand.name, pts: "BUST", bad: true, ttl: 1150 });
          if (res.chipsLost > 0) spawnFallingChips(TIERS[ANTE_TIER].color, res.chipsLost, geo.laneX, geo.laneMidY);
        }
        showFeed({ hand: "", math: "", why: result.streakReset ? "high card bust · streak lost" : "high card bust", kind: "bad" });
        setFlash((f) => ({ ...f, [lane]: "busted" }));
      }
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash({}), 700);
    } else if (result.expired && result.expired.length) {
      showFeed({ hand: "RAISE EXPIRED", math: "", why: "ran out of draws", kind: "bad" });
    }

    // WANTED CLAIMED splash (stacks on top of the score burst)
    if (result.wanted && result.wanted.hit) {
      const w = result.wanted;
      clearTimeout(claimTimer.current);
      setClaim({ hand: HAND_NAME[w.hand], pts: w.totalPts, chips: w.totalChips, streak: w.streak, on: true });
      claimTimer.current = setTimeout(() => setClaim((c) => (c ? { ...c, on: false } : c)), 1500);
      clearTimeout(bannerTimer.current);
      setBannerClaim(true);
      bannerTimer.current = setTimeout(() => setBannerClaim(false), 720);
      playSfxVariant("chips-stack", [1, 3]);
    }

    if (next.over) {
      clearPanic();
      submit(next.score);
      setScreen(SCREEN.OVER);
    }
  }, [showFeed, fxFromLane, spawn, spawnChipsTo, spawnFallingChips, clearPanic, submit]);

  // ── Panic placement clock ──────────────────────────────────────────────────
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
      const gg = gameRef.current;
      if (!gg || gg.over || gg.tray == null) return;
      const { state, result } = burnCard(gg);
      showFeed({ hand: "BURNED", math: "", why: "out of time", kind: "bad" });
      applyResult(state, result);
    }, PANIC_MS);
    panicTimer.current = { id, raf: requestAnimationFrame(tick), start };
    return clearPanic;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, mode, game && game.tray && game.tray.id, game && game.draws]);

  useEffect(() => () => {
    clearTimeout(feedTimer.current); clearTimeout(flashTimer.current);
    clearTimeout(bumpTimer.current); clearTimeout(claimTimer.current);
    clearTimeout(bannerTimer.current); clearPanic();
  }, [clearPanic]);

  // ── actions ────────────────────────────────────────────────────────────────
  const start = useCallback((m) => {
    const chosen = m || mode;
    setMode(chosen);
    lsSet("chip-panic:mode", chosen);
    setGame(newGame());
    setFeed(null);
    setClaim(null);
    setFlash({});
    setHudBump(false);
    setBannerClaim(false);
    clearFx();
    setPanicPct(1);
    setScreen(SCREEN.PLAY);
  }, [mode, clearFx]);

  const onLane = useCallback((l) => {
    const gg = gameRef.current;
    if (!gg || gg.over || !canPlace(gg, l)) return;
    const { state, result } = placeCard(gg, l);
    applyResult(state, result);
  }, [applyResult]);

  const onChip = useCallback((l) => {
    const gg = gameRef.current;
    if (!gg || gg.over) return;
    const next = cycleRaise(gg, l);
    if (next !== gg) playSfxVariant("chip-lay", [1, 3]);
    setGame(next);
  }, []);

  const onDiscard = useCallback(() => {
    const gg = gameRef.current;
    if (!gg || gg.over || !gg.discard) return;
    const { state, result } = useDiscard(gg);
    playSfxVariant("card-place", [1, 3]);
    applyResult(state, result);
  }, [applyResult]);

  // ── render ───────────────────────────────────────────────────────────────────
  const rootStyle = { "--cw": "min(15vw, 66px)", "--ch": "calc(var(--cw) * 1.357)" };
  const g = game;
  const w = g?.wanted;

  return (
    <div className="hcb-root" style={rootStyle} ref={rootRef}>
      <div className="hcb-bar">
        <button className="hcb-btn" onClick={() => (screen === SCREEN.PLAY ? (clearPanic(), submit(g?.score || 0), setScreen(SCREEN.OVER)) : navigate("/"))}>
          {screen === SCREEN.PLAY ? "QUIT" : "← EXIT"}
        </button>
        <span className="sp" />
        <span className="hcb-stat">SCORE <b>{(g?.score || 0).toLocaleString()}</b></span>
        <span className={`hcb-stat chips${hudBump ? " bump" : ""}`} ref={chipHudRef}>CHIPS <b>{g?.chips ?? START_CHIPS}</b></span>
        {screen === SCREEN.PLAY && (
          <span className="hcb-stat mode"><b>{mode === MODE.PANIC ? "PANIC" : "CLASSIC"}</b></span>
        )}
      </div>

      {screen === SCREEN.PLAY && g && w && (
        <div className={`hcb-wanted${bannerClaim ? " claim" : ""}`}>
          <span className="star">🤠</span>
          <span className="lbl">WANTED: {HAND_NAME[w.hand]?.toUpperCase()}</span>
          <span className="rew"><b>+{w.bonusPts}</b> / <b>+{w.bonusChips}</b> chips</span>
          <span className="streak">streak <b>{g.streak}</b></span>
        </div>
      )}

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
              const anted = g.anted[l];
              const sel = g.raiseSel[l];
              const committed = g.raise[l];
              const tierIdx = committed ? committed.tier : sel;
              const tier = TIERS[tierIdx] || TIERS[0];
              const empty = lane.length === 0 && !anted;
              const canOpen = empty && (g.chips >= ANTE_COST);
              const cant = empty && !canOpen && !locked;
              const betted = !!committed || sel !== NO_RAISE;
              const expiring = committed && committed.draws <= 1;
              const fl = flash[l];
              // raise chip is tappable only on an anted lane with something to cycle
              const canCycle = anted && !locked && !committed &&
                (sel !== NO_RAISE || TIERS.some((_, t) => t !== NO_RAISE && canRaise(g, l, t)));
              return (
                <div
                  key={l}
                  ref={(el) => { laneRefs.current[l] = el; }}
                  className={`hcb-lane ${anted ? "anted" : ""} ${betted ? "betted" : ""} ${expiring ? "expiring" : ""} ${locked ? "locked" : ""} ${cant ? "cant" : ""} ${fl || ""}`}
                  style={{ "--tier": glow(tier.color) }}
                >
                  <div className="hcb-slots" onPointerDown={() => onLane(l)}>
                    {lane.map((card, i) => (
                      <span className="hcb-card" key={card.id + i}>
                        <img src={cardImg(card.id)} alt={card.id} draggable="false" />
                      </span>
                    ))}
                    {empty && !locked && (
                      <span className="hcb-open">
                        <img src={chipImg("blue")} alt="" draggable="false" />
                        <small>{canOpen ? "ANTE 1" : "NEED 1"}</small>
                      </span>
                    )}
                  </div>
                  <div className="hcb-betbox">
                    <button
                      className={`hcb-chip ${!anted || (sel === NO_RAISE && !committed) ? "empty" : ""}`}
                      disabled={!canCycle}
                      onPointerDown={(e) => { e.stopPropagation(); onChip(l); }}
                      aria-label={`Raise lane ${l + 1}`}
                    >
                      {committed
                        ? <img src={chipImg(TIERS[committed.tier].color)} alt={TIERS[committed.tier].label} draggable="false" />
                        : sel !== NO_RAISE
                          ? <img src={chipImg(TIERS[sel].color)} alt={TIERS[sel].label} draggable="false" />
                          : anted
                            ? <img src={chipImg(TIERS[ANTE_TIER].color)} alt="ante" draggable="false" />
                            : "—"}
                      {committed && (
                        <span className={`cd ${committed.draws <= 1 ? "" : "warn"}`}>{committed.draws}</span>
                      )}
                    </button>
                    <span className="hcb-req">
                      {tierIdx !== NO_RAISE ? tier.reqLabel : (anted ? "RAISE?" : "")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <FxLayer parts={parts} className="hcb-fx" />

      <div className={`hcb-feed ${feed?.kind || ""} ${feed?.on ? "show" : ""}`}>
        {feed?.hand && <span className="hand">{feed.hand}</span>}
        {feed?.math && <span className="math">{feed.math}</span>}
        {feed?.why && <span className="why">{feed.why}</span>}
      </div>

      <div className={`hcb-claim ${claim?.on ? "show" : ""}`}>
        {claim && <>
          <span className="tag">★ WANTED CLAIMED ★</span>
          <span className="hand">{claim.hand}</span>
          <span className="rew"><b>+{claim.pts}</b> pts · <b>+{claim.chips}</b> chips · streak ×{claim.streak}</span>
        </>}
      </div>

      {screen === SCREEN.TITLE && (
        <div className="hcb-overlay">
          <h1>HIGH CARD BUST</h1>
          <div className="sub">open a lane for 1 chip · fill five — TWO PAIR+ scores, any PAIR only saves the lane (no score, ante lost), a HIGH CARD locks it · raise for a multiplier · chase the WANTED hand for bonus chips & points · all five locked ends the run</div>
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
