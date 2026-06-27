import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { cardImg, cardBackImg, chipImg, CHIP_ORDER } from "../lib/kenney.js";
import { playSfxVariant } from "../lib/sfx.js";
import { useFx, FxLayer } from "../lib/fx.jsx";
import { HAND, HAND_NAME } from "./poker/handEval.js";
import {
  deal, draw, payout, JACKS_OR_BETTER_PAYTABLE, MAX_BET,
} from "./poker/videoPoker.js";

// ── Video Poker (Jacks or Better) ─────────────────────────────────────────────
// The quintessential casino-cabinet machine. Bet 1–5 credits, deal five, tap
// cards to HOLD, DRAW to replace the rest, get paid by the paytable. Pair of
// Jacks-or-better is the minimum paying hand; a 5-credit royal pays the 4000
// jackpot. Scored by best CREDITS bankroll (dir:"desc"). Self-contained .vp-* CSS.

const GAME_ID = "video-poker";
const START_CREDITS = 100;
const FEED_MS = 2200; // result-panel visible duration

// Paytable rows shown on the machine, best → worst (skip High Card; it pays 0).
const PAY_ROWS = [
  HAND.ROYAL_FLUSH, HAND.STRAIGHT_FLUSH, HAND.FOUR, HAND.FULL_HOUSE,
  HAND.FLUSH, HAND.STRAIGHT, HAND.THREE, HAND.TWO_PAIR, HAND.PAIR,
];
const PAY_LABEL = { ...HAND_NAME, [HAND.PAIR]: "Jacks or Better" };

const VP_CSS = `
  .vp-root {
    width: 100vw; height: 100svh; overflow: hidden; position: relative;
    display: flex; flex-direction: column; color: #eef0ff;
    font-family: 'Share Tech Mono','Courier New',monospace;
    background:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,210,63,.07), transparent 70%),
      radial-gradient(circle at 50% 70%, #122a4a, #0a1830 70%, #060f1f);
    user-select: none; -webkit-user-select: none; touch-action: manipulation;
  }
  .vp-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex: 0 0 auto; }
  .vp-bar .sp { flex: 1; }
  .vp-btn {
    cursor: pointer; border-radius: 8px; padding: 8px 12px;
    font-family: 'Press Start 2P',monospace; font-size: .56rem; letter-spacing: .04em;
    color: #eef0ff; background: rgba(0,0,0,.32); border: 2px solid #355a8f;
  }
  .vp-btn:hover { border-color: #ffd23f; }
  .vp-stat { font-size: .66rem; letter-spacing: .14em; text-transform: uppercase; color: #9fc4ec; }
  .vp-stat b { color: #ffd23f; }

  .vp-stage { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 8px 12px; min-height: 0; }

  /* Centered credits / bet readout above the screen — the prominent numbers. */
  .vp-readout { display: flex; gap: 22px; align-items: baseline; justify-content: center; }
  .vp-readout .ro { font-size: .62rem; letter-spacing: .18em; text-transform: uppercase; color: #9fc4ec; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .vp-readout .ro b { font-family: 'Press Start 2P',monospace; font-size: 1.1rem; color: #ffd23f; letter-spacing: 0; }

  /* CSS-only CRT "video poker screen" — a chunky dark cabinet bezel framing a
     glowing recessed glass panel with scanlines + a curved vignette. Wraps the
     paytable + hand; the FX layer and feed panel sit on top.
     box-sizing:border-box so padding/border stay inside the declared width — the
     content (paytable + 5 cards) never spills past the bezel. */
  .vp-screen {
    box-sizing: border-box;
    position: relative; width: min(620px, 96vw); max-width: 100%;
    display: flex; flex-direction: column; align-items: center; gap: 14px;
    padding: 20px 18px; border-radius: 20px;
    /* the cabinet bezel */
    background: linear-gradient(160deg, #1a2740, #0c1322 60%, #060c16);
    border: 2px solid #2c3e60;
    box-shadow:
      0 12px 34px rgba(0,0,0,.6),
      inset 0 1px 0 rgba(120,160,220,.18),
      inset 0 -2px 6px rgba(0,0,0,.6);
  }
  /* the recessed glass panel (the actual "screen"), behind the content */
  .vp-screen::before {
    content: ""; position: absolute; inset: 10px; border-radius: 12px; pointer-events: none; z-index: 0;
    background:
      radial-gradient(ellipse 75% 60% at 50% 38%, rgba(63,191,255,.16), transparent 70%),
      radial-gradient(ellipse 120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,.55) 100%),
      linear-gradient(180deg, #0a1a30, #050f1f);
    box-shadow:
      inset 0 0 26px rgba(0,0,0,.85),
      inset 0 0 70px rgba(63,191,255,.10),
      0 0 14px rgba(63,191,255,.10);
  }
  /* visible scanlines layered over the glass */
  .vp-screen::after {
    content: ""; position: absolute; inset: 10px; border-radius: 12px; pointer-events: none; z-index: 3;
    background: repeating-linear-gradient(rgba(0,0,0,.28) 0 1px, transparent 1px 3px);
    opacity: .55;
  }

  /* Paytable */
  .vp-pay {
    box-sizing: border-box;
    width: 100%; border: 2px solid #355a8f; border-radius: 10px;
    background: rgba(2,10,22,.55); padding: 8px 12px; font-size: .8rem;
    position: relative; z-index: 1;
  }
  .vp-pay table { width: 100%; border-collapse: collapse; }
  .vp-pay td { padding: 2px 4px; white-space: nowrap; }
  .vp-pay td.n { text-align: right; color: #ffd23f; font-variant-numeric: tabular-nums; }
  .vp-pay tr.lit td { color: #34c759; }
  .vp-pay tr.lit td.n { color: #34c759; }
  .vp-pay .betcol { color: #9fc4ec; }
  .vp-pay .betcol.on { color: #ffd23f; font-weight: bold; }

  /* Hand */
  .vp-hand { display: flex; gap: min(2.2vw, 14px); justify-content: center; position: relative; z-index: 1; }
  .vp-cardwrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .vp-card {
    width: min(15.5vw, 96px); aspect-ratio: 200 / 271.4;
    border-radius: 7px; box-shadow: 0 2px 6px rgba(0,0,0,.5);
    cursor: pointer; position: relative; transition: transform .08s ease;
  }
  .vp-card img { width: 100%; height: 100%; display: block; border-radius: inherit; }
  .vp-card.held { transform: translateY(-8px); }
  .vp-card.held::after {
    content: "HELD"; position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
    font-family: 'Press Start 2P',monospace; font-size: .5rem; color: #0a0a12;
    background: #ffd23f; padding: 3px 5px; border-radius: 4px; letter-spacing: .04em;
  }
  .vp-holdslot { height: 14px; }

  /* Controls */
  .vp-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .vp-chip { width: 30px; height: 30px; image-rendering: auto; }
  .vp-big {
    padding: 13px 20px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P',monospace; font-size: .72rem; letter-spacing: .04em;
    color: #0a0a12; background: linear-gradient(180deg,#fff,#ffd23f); border: 2px solid #0a0a12;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4);
  }
  .vp-big:hover { filter: brightness(1.08); }
  .vp-big.alt { background: linear-gradient(180deg,#fff,#3fbfff); }
  .vp-big:disabled { opacity: .4; cursor: not-allowed; filter: none; }
  .vp-betbtn {
    padding: 9px 12px; cursor: pointer; border-radius: 8px;
    font-family: 'Press Start 2P',monospace; font-size: .58rem;
    color: #9fc4ec; background: #0e2240; border: 2px solid #355a8f;
  }
  /* Centered result panel — cloned from High Card Bust's .hcb-feed, re-themed to
     the blue/gold cabinet palette. Auto-fades after FEED_MS. */
  .vp-feed {
    position: absolute; top: 42%; left: 50%; transform: translate(-50%,-50%);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    pointer-events: none; opacity: 0; transition: opacity .2s ease; text-align: center;
    z-index: 72; max-width: min(90vw, 460px);
    padding: 14px 24px; border-radius: 16px;
    background: rgba(6, 15, 31, .74); backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,.10); box-shadow: 0 8px 30px rgba(0,0,0,.45);
  }
  .vp-feed.show { opacity: 1; }
  .vp-feed .hand { font-family: 'Black Ops One',sans-serif; font-size: clamp(1.3rem,6vw,2.4rem); line-height: 1.05; color: #ffd23f; text-shadow: 0 2px 10px rgba(0,0,0,.6); }
  .vp-feed .math { font-family: 'Press Start 2P',monospace; font-size: .8rem; letter-spacing: .04em; color: #eef0ff; }
  .vp-feed.win .hand { color: #34c759; text-shadow: 0 0 12px rgba(52,199,89,.55), 0 2px 10px rgba(0,0,0,.6); }
  .vp-feed.win .math { color: #3fffd0; }
  .vp-feed.lose .hand { color: #9fc4ec; text-shadow: 0 2px 10px rgba(0,0,0,.6); }

  /* fx layer: chips flying from the hand up to the credits readout on a win */
  .vp-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 70; }
  .vp-fx .fx-chip { position: absolute; width: 28px; height: 28px; transform: translate(-50%,-50%); will-change: transform,opacity; filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
  .vp-fx .fx-chip img { width: 100%; height: 100%; display: block; }
  .vp-fx .fx-chip.fly { animation: vp-chipfly 700ms cubic-bezier(.4,.05,.5,1) forwards; }
  @keyframes vp-chipfly {
    0%   { opacity: 0; transform: translate(-50%,-50%) translate(0,0) scale(.7); }
    12%  { opacity: 1; transform: translate(-50%,-50%) translate(calc(var(--dx)*.12), calc(var(--dy)*.12 + var(--arc))) scale(1); }
    70%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.6); }
  }
  @media (prefers-reduced-motion: reduce) {
    .vp-fx .fx-chip, .vp-feed { animation-duration: 1ms !important; transition: none !important; }
  }

  .vp-overlay {
    position: absolute; inset: 0; z-index: 80; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px; text-align: center;
    background: rgba(6,15,31,.9); backdrop-filter: blur(4px); padding: 24px;
  }
  .vp-overlay h1 {
    font-family: 'Black Ops One',sans-serif; font-size: clamp(2rem,8vw,3.4rem);
    background: linear-gradient(180deg,#fffbe6,#ffd23f 60%,#3fbfff);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .vp-overlay .sub { font-size: .72rem; letter-spacing: .26em; text-transform: uppercase; color: #9fc4ec; }
`;

export default function VideoPoker() {
  const navigate = useNavigate();
  const { submit, best } = useArcadeScore(GAME_ID);

  const [phase, setPhase] = useState("start"); // start | bet | draw | over
  const [credits, setCredits] = useState(START_CREDITS);
  const [bet, setBet] = useState(1);
  const [hand, setHand] = useState(null); // Card[5] | null
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [deck, setDeck] = useState([]);
  const [feed, setFeed] = useState(null); // { hand, math, kind, on } | null
  const [bestBankroll, setBestBankroll] = useState(START_CREDITS);

  const rootRef = useRef(null);
  const handRef = useRef(null);
  const readoutRef = useRef(null);
  const feedTimer = useRef(null);
  const { parts, spawn, clear: clearFx } = useFx();

  useArcadeBackButton(false);

  // Inject scoped CSS.
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = VP_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  // Track the high-water bankroll and submit it (best CREDITS, dir:"desc").
  useEffect(() => {
    if (credits > bestBankroll) setBestBankroll(credits);
  }, [credits, bestBankroll]);

  useEffect(() => () => clearTimeout(feedTimer.current), []);

  // Centered result panel, auto-fading after FEED_MS (mirrors HCB's showFeed).
  function showFeed(f) {
    clearTimeout(feedTimer.current);
    setFeed({ ...f, on: true });
    feedTimer.current = setTimeout(() => setFeed((x) => (x ? { ...x, on: false } : x)), FEED_MS);
  }

  function newSession() {
    clearFx();
    setCredits(START_CREDITS);
    setBestBankroll(START_CREDITS);
    setBet(1);
    setHand(null);
    setFeed(null);
    setPhase("bet");
  }

  function changeBet(d) {
    setBet((b) => Math.max(1, Math.min(MAX_BET, Math.min(credits, b + d))));
  }

  // DEAL: take the bet, deal five face-up, move to the draw (hold) phase.
  function onDeal() {
    if (credits < bet) return;
    const st = deal(bet);
    setCredits((c) => c - bet);
    setHand(st.hand);
    setDeck(st.deck);
    setHeld([false, false, false, false, false]);
    setFeed(null);
    setPhase("draw");
    playSfxVariant("card-place", [1, 3]);
  }

  function toggleHold(i) {
    if (phase !== "draw") return;
    setHeld((h) => h.map((v, j) => (j === i ? !v : v)));
    playSfxVariant("card-slide", [1, 3]);
  }

  // DRAW: replace the non-held cards, settle against the paytable, pay out.
  function onDraw() {
    const d = draw({ hand, deck }, held);
    setHand(d.hand);
    playSfxVariant("card-place", [1, 3]);
    const pay = payout(d.hand, bet);
    if (pay.payout > 0) {
      setCredits((c) => c + pay.payout);
      // Royal at max bet is the flat 4000 jackpot; everything else is base × bet.
      const isJackpot = pay.hand.rank === HAND.ROYAL_FLUSH && bet >= MAX_BET;
      const base = JACKS_OR_BETTER_PAYTABLE[pay.hand.rank] || 0;
      const math = isJackpot ? `JACKPOT +${pay.payout}` : `${base} × ${bet} = ${pay.payout}`;
      showFeed({ hand: pay.hand.name, math, kind: "win" });
      playSfxVariant("chips-stack", [1, 3]);
      flyPayoutChips();
    } else {
      showFeed({ hand: "No Win", math: "", kind: "lose" });
    }
    // Settle: ready for the next hand, or game over if broke.
    setPhase("settled");
  }

  // Payout flourish: chips fly from the hand up to the centered CREDITS readout.
  function flyPayoutChips() {
    const root = rootRef.current, src = handRef.current, tgt = readoutRef.current;
    if (!root || !src || !tgt) return;
    const rb = root.getBoundingClientRect();
    const sb = src.getBoundingClientRect();
    const tb = tgt.getBoundingClientRect();
    const sx = sb.left - rb.left + sb.width / 2;
    const sy = sb.top - rb.top + sb.height / 2;
    const dx = (tb.left + tb.width / 2) - (sb.left + sb.width / 2);
    const dy = (tb.top + tb.height / 2) - (sb.top + sb.height / 2);
    const colors = [...CHIP_ORDER, CHIP_ORDER[0]]; // blue, red, green, black, blue
    for (let i = 0; i < 5; i++) {
      spawn({
        kind: "chip", x: sx + (i - 2) * 24, y: sy, src: chipImg(colors[i]),
        dx, dy, arc: -55, delay: i * 60, ttl: 760,
      });
    }
  }

  // After a settled hand: continue to the next bet, or end the session if broke.
  function nextHand() {
    if (credits <= 0) {
      submit(bestBankroll);
      setPhase("over");
      return;
    }
    clearFx();
    setBet((b) => Math.min(b, credits, MAX_BET));
    setHand(null);
    setFeed(null);
    setPhase("bet");
  }

  function cashOut() {
    submit(bestBankroll);
    setPhase("over");
  }

  // ── render helpers ─────────────────────────────────────────────────────────
  // Per-row payout for the current bet (royal shows the max-bet jackpot at bet 5).
  function rowPay(rank) {
    if (rank === HAND.ROYAL_FLUSH && bet >= MAX_BET) return 4000;
    return (JACKS_OR_BETTER_PAYTABLE[rank] || 0) * bet;
  }
  // Bet-chip color by tier, through the canonical CHIP_ORDER (blue, red, green,
  // black) so it matches Blackjack / High Card Bust: 1→blue, 2→red, 3-4→green, 5→black.
  function betChipColor(b) {
    const tier = b >= 5 ? 3 : b >= 3 ? 2 : b >= 2 ? 1 : 0;
    return CHIP_ORDER[tier];
  }
  // Which paytable row is lit by the current shown hand (settled phase only).
  const settled = phase === "settled" && hand ? payout(hand, bet) : null;
  const litRank = settled && settled.paying ? settled.hand.rank : null;

  return (
    <div className="vp-root" ref={rootRef}>
      <div className="vp-bar">
        <button className="vp-btn" onClick={() => navigate("/")}>← EXIT</button>
        {phase !== "start" && <button className="vp-btn" onClick={cashOut}>CASH OUT</button>}
        <span className="sp" />
      </div>

      <div className="vp-stage">
        {phase !== "start" && (
          <div className="vp-readout" ref={readoutRef}>
            <span className="ro">CREDITS<b>{credits}</b></span>
            <span className="ro">BET<b>{bet}</b></span>
          </div>
        )}

        {phase !== "start" && (
          <div className="vp-screen">
            <div className="vp-pay">
              <table>
                <tbody>
                  {PAY_ROWS.map((rank) => (
                    <tr key={rank} className={litRank === rank ? "lit" : ""}>
                      <td>{PAY_LABEL[rank]}</td>
                      <td className="n">{rowPay(rank)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hand && (
              <div className="vp-hand" ref={handRef}>
                {hand.map((card, i) => (
                  <div className="vp-cardwrap" key={i}>
                    <div className="vp-holdslot" />
                    <div
                      className={`vp-card ${held[i] ? "held" : ""}`}
                      onPointerDown={() => toggleHold(i)}
                    >
                      <img src={card.faceUp ? cardImg(card.id) : cardBackImg()} alt={card.id} draggable="false" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === "bet" && (
          <div className="vp-controls">
            <button className="vp-betbtn" onPointerDown={() => changeBet(-1)}>− BET</button>
            <img className="vp-chip" src={chipImg(betChipColor(bet))} alt="" draggable="false" />
            <button className="vp-betbtn" onPointerDown={() => changeBet(1)}>BET +</button>
            <button className="vp-betbtn" onPointerDown={() => setBet(Math.min(MAX_BET, credits))}>MAX</button>
            <button className="vp-big" onPointerDown={onDeal} disabled={credits < bet}>DEAL</button>
          </div>
        )}

        {phase === "draw" && (
          <div className="vp-controls">
            <button className="vp-big" onPointerDown={onDraw}>DRAW</button>
            <span className="vp-stat">tap cards to HOLD</span>
          </div>
        )}

        {phase === "settled" && (
          <div className="vp-controls">
            <button className="vp-big alt" onPointerDown={nextHand}>
              {credits <= 0 ? "GAME OVER" : "NEXT HAND"}
            </button>
          </div>
        )}
      </div>

      {feed && (
        <div className={`vp-feed ${feed.kind || ""} ${feed.on ? "show" : ""}`}>
          <span className="hand">{feed.hand}</span>
          {feed.math && <span className="math">{feed.math}</span>}
        </div>
      )}

      <FxLayer parts={parts} className="vp-fx" />

      {phase === "start" && (
        <div className="vp-overlay">
          <h1>VIDEO POKER</h1>
          <div className="sub">jacks or better · hold &amp; draw</div>
          <button className="vp-big" onPointerDown={newSession}>INSERT 100 CREDITS</button>
          {best != null && <div className="sub">best bankroll · {best}</div>}
        </div>
      )}

      {phase === "over" && (
        <div className="vp-overlay">
          <h1>{bestBankroll > START_CREDITS ? "YOU WIN!" : "OUT OF CREDITS"}</h1>
          <div className="sub">best bankroll this session · {bestBankroll}</div>
          {best != null && bestBankroll >= best && <div className="sub" style={{ color: "#34c759" }}>★ new best ★</div>}
          <button className="vp-big" onPointerDown={newSession}>PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}
