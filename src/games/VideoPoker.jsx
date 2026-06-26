import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { cardImg, cardBackImg, chipImg } from "../lib/kenney.js";
import { playSfxVariant } from "../lib/sfx.js";
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

  /* Paytable */
  .vp-pay {
    width: min(560px, 94vw); border: 2px solid #355a8f; border-radius: 10px;
    background: rgba(0,0,0,.34); padding: 6px 10px; font-size: .62rem;
  }
  .vp-pay table { width: 100%; border-collapse: collapse; }
  .vp-pay td { padding: 2px 4px; white-space: nowrap; }
  .vp-pay td.n { text-align: right; color: #ffd23f; font-variant-numeric: tabular-nums; }
  .vp-pay tr.lit td { color: #34c759; }
  .vp-pay tr.lit td.n { color: #34c759; }
  .vp-pay .betcol { color: #9fc4ec; }
  .vp-pay .betcol.on { color: #ffd23f; font-weight: bold; }

  /* Hand */
  .vp-hand { display: flex; gap: min(2.2vw, 14px); justify-content: center; }
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
  .vp-result { font-family: 'Black Ops One',sans-serif; font-size: clamp(1.2rem,4.5vw,2rem); text-align: center; min-height: 1.4em; }
  .vp-result.win { color: #34c759; }
  .vp-result.lose { color: #9fc4ec; }

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
  const [result, setResult] = useState(null); // { text, win } | null
  const [bestBankroll, setBestBankroll] = useState(START_CREDITS);

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

  function newSession() {
    setCredits(START_CREDITS);
    setBestBankroll(START_CREDITS);
    setBet(1);
    setHand(null);
    setResult(null);
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
    setResult(null);
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
      setResult({ text: `${pay.hand.name} · +${pay.payout}`, win: true });
      playSfxVariant("chips-stack", [1, 3]);
    } else {
      setResult({ text: "No win", win: false });
    }
    // Settle: ready for the next hand, or game over if broke.
    setPhase("settled");
  }

  // After a settled hand: continue to the next bet, or end the session if broke.
  function nextHand() {
    if (credits <= 0) {
      submit(bestBankroll);
      setPhase("over");
      return;
    }
    setBet((b) => Math.min(b, credits, MAX_BET));
    setHand(null);
    setResult(null);
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
  // Which paytable row is lit by the current shown hand (settled phase only).
  const settled = phase === "settled" && hand ? payout(hand, bet) : null;
  const litRank = settled && settled.paying ? settled.hand.rank : null;

  return (
    <div className="vp-root">
      <div className="vp-bar">
        <button className="vp-btn" onClick={() => navigate("/")}>← EXIT</button>
        {phase !== "start" && <button className="vp-btn" onClick={cashOut}>CASH OUT</button>}
        <span className="sp" />
        <span className="vp-stat">CREDITS <b>{credits}</b></span>
        <span className="vp-stat">BET <b>{bet}</b></span>
      </div>

      <div className="vp-stage">
        {phase !== "start" && (
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
        )}

        {hand && (
          <div className="vp-hand">
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

        {result && <div className={`vp-result ${result.win ? "win" : "lose"}`}>{result.text}</div>}

        {phase === "bet" && (
          <div className="vp-controls">
            <button className="vp-betbtn" onPointerDown={() => changeBet(-1)}>− BET</button>
            <img className="vp-chip" src={chipImg(bet >= 5 ? "black" : bet >= 3 ? "green" : bet >= 2 ? "blue" : "red")} alt="" draggable="false" />
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
