import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { cardImg, cardBackImg, chipImg } from "../lib/kenney.js";
import { playSfxVariant } from "../lib/sfx.js";
import {
  freshShoe, deal, drawCard, dealerPlay, settle, handValue,
  isBust, isBlackjack, RESHUFFLE_AT,
} from "./blackjack/logic.js";

// ── Blackjack (vs. dealer) ────────────────────────────────────────────────────
// Beat the house: hit/stand/double, blackjack pays 3:2, dealer stands on 17.
// Bet from your chip stack; best CHIPS bankroll wins (dir:"desc"). 6-deck shoe.
// Self-contained .bj-* CSS.

const GAME_ID = "blackjack";
const START_CHIPS = 100;
const MAX_BET = 50;
const CHIP_DENOMS = [
  { v: 25, color: "black" }, { v: 10, color: "blue" },
  { v: 5, color: "green" }, { v: 1, color: "red" },
];

const BJ_CSS = `
  .bj-root {
    width: 100vw; height: 100svh; overflow: hidden; position: relative;
    display: flex; flex-direction: column; color: #eef0ff;
    font-family: 'Share Tech Mono','Courier New',monospace;
    background:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(63,255,208,.06), transparent 70%),
      radial-gradient(circle at 50% 55%, #1b4d2e, #0e3320 70%, #07210f);
    user-select: none; -webkit-user-select: none; touch-action: manipulation;
  }
  .bj-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex: 0 0 auto; }
  .bj-bar .sp { flex: 1; }
  .bj-btn {
    cursor: pointer; border-radius: 8px; padding: 8px 12px;
    font-family: 'Press Start 2P',monospace; font-size: .56rem; letter-spacing: .04em;
    color: #eef0ff; background: rgba(0,0,0,.32); border: 2px solid #2f6f48;
  }
  .bj-btn:hover { border-color: #3fffd0; }
  .bj-stat { font-size: .66rem; letter-spacing: .14em; text-transform: uppercase; color: #9fdcb4; }
  .bj-stat b { color: #ffd23f; }

  .bj-felt { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 10px 12px; gap: 8px; min-height: 0; }
  .bj-side { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .bj-label { font-size: .6rem; letter-spacing: .2em; text-transform: uppercase; color: #9fdcb4; }
  .bj-label b { color: #fff; }
  .bj-cards { display: flex; gap: 6px; min-height: calc(min(15vw,92px) * 1.357); }
  .bj-card {
    width: min(15vw, 92px); aspect-ratio: 200 / 271.4;
    border-radius: 7px; box-shadow: 0 2px 6px rgba(0,0,0,.5);
  }
  .bj-card img { width: 100%; height: 100%; display: block; border-radius: inherit; }

  .bj-mid { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .bj-result { font-family: 'Black Ops One',sans-serif; font-size: clamp(1.3rem,5vw,2.2rem); text-align: center; min-height: 1.2em; }
  .bj-result.win { color: #34c759; }
  .bj-result.lose { color: #ff6b6b; }
  .bj-result.push { color: #ffd23f; }

  .bj-controls { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; align-items: center; }
  .bj-big {
    padding: 13px 18px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P',monospace; font-size: .68rem; letter-spacing: .04em;
    color: #0a0a12; background: linear-gradient(180deg,#fff,#3fffd0); border: 2px solid #0a0a12;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4);
  }
  .bj-big:hover { filter: brightness(1.08); }
  .bj-big.alt { background: linear-gradient(180deg,#fff,#ffd23f); }
  .bj-big:disabled { opacity: .4; cursor: not-allowed; filter: none; }

  .bj-betrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .bj-chip { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .bj-chip img { width: 44px; height: 44px; }
  .bj-chip span { font-family: 'Press Start 2P',monospace; font-size: .5rem; color: #9fdcb4; }
  .bj-betpile { font-size: .8rem; letter-spacing: .14em; color: #ffd23f; }

  .bj-overlay {
    position: absolute; inset: 0; z-index: 80; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px; text-align: center;
    background: rgba(7,33,15,.9); backdrop-filter: blur(4px); padding: 24px;
  }
  .bj-overlay h1 {
    font-family: 'Black Ops One',sans-serif; font-size: clamp(2rem,8vw,3.4rem);
    background: linear-gradient(180deg,#fffbe6,#3fffd0 60%,#ffd23f);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .bj-overlay .sub { font-size: .72rem; letter-spacing: .26em; text-transform: uppercase; color: #9fdcb4; }
`;

function Hand({ cards }) {
  return (
    <div className="bj-cards">
      {cards.map((c, i) => (
        <div className="bj-card" key={i}>
          <img src={c.faceUp ? cardImg(c.id) : cardBackImg()} alt={c.faceUp ? c.id : "face-down"} draggable="false" />
        </div>
      ))}
    </div>
  );
}

export default function Blackjack() {
  const navigate = useNavigate();
  const { submit, best } = useArcadeScore(GAME_ID);

  const [phase, setPhase] = useState("start"); // start | bet | player | dealer | settled | over
  const [chips, setChips] = useState(START_CHIPS);
  const [bestBankroll, setBestBankroll] = useState(START_CHIPS);
  const [bet, setBet] = useState(0);
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [result, setResult] = useState(null); // { text, kind } | null
  const [doubled, setDoubled] = useState(false);
  const shoe = useRef([]);

  useArcadeBackButton(false);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = BJ_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  useEffect(() => {
    if (chips > bestBankroll) setBestBankroll(chips);
  }, [chips, bestBankroll]);

  function newSession() {
    shoe.current = freshShoe();
    setChips(START_CHIPS);
    setBestBankroll(START_CHIPS);
    setBet(0);
    setPlayer([]);
    setDealer([]);
    setResult(null);
    setPhase("bet");
  }

  function addBet(v) {
    if (phase !== "bet") return;
    setBet((b) => Math.min(MAX_BET, chips, b + v));
    playSfxVariant("chip-lay", [1, 3]);
  }
  function clearBet() { setBet(0); }

  // DEAL: lock the bet, deal two each, check for naturals.
  function onDeal() {
    if (bet <= 0 || bet > chips) return;
    if (shoe.current.length < RESHUFFLE_AT) shoe.current = freshShoe();
    const d = deal(shoe.current);
    setPlayer(d.player);
    setDealer(d.dealer);
    setDoubled(false);
    setResult(null);
    playSfxVariant("card-place", [1, 3]);
    // Natural blackjack (either side) ends the hand immediately.
    if (isBlackjack(d.player) || isBlackjack(d.dealer)) {
      finish(d.player, d.dealer, false);
    } else {
      setPhase("player");
    }
  }

  function onHit() {
    const next = [...player, drawCard(shoe.current)];
    setPlayer(next);
    playSfxVariant("card-place", [1, 3]);
    if (isBust(next)) finish(next, dealer, doubled);
  }

  function onStand() {
    runDealer(player, doubled);
  }

  // DOUBLE: double the bet, take exactly one card, then stand.
  function onDouble() {
    if (chips < bet * 2) return;
    const next = [...player, drawCard(shoe.current)];
    setPlayer(next);
    setDoubled(true);
    playSfxVariant("card-place", [1, 3]);
    if (isBust(next)) finish(next, dealer, true);
    else runDealer(next, true);
  }

  // Dealer reveals + plays out, then settle.
  function runDealer(playerHand, dbl) {
    setPhase("dealer");
    const finalDealer = dealerPlay(dealer, shoe.current);
    setDealer(finalDealer);
    finish(playerHand, finalDealer, dbl);
  }

  // Settle the round: apply chip delta, show the outcome.
  function finish(playerHand, dealerHand, dbl) {
    const revealed = dealerHand.map((c) => ({ ...c, faceUp: true }));
    setDealer(revealed);
    const { outcome, delta } = settle(playerHand, revealed, bet, dbl);
    setChips((c) => c + delta);
    setResult({ text: RESULT_TEXT[outcome], kind: KIND[outcome] });
    if (delta > 0) playSfxVariant("chips-stack", [1, 3]);
    setPhase("settled");
  }

  function nextHand() {
    if (chips <= 0) {
      submit(bestBankroll);
      setPhase("over");
      return;
    }
    setBet((b) => Math.min(b, chips));
    setPlayer([]);
    setDealer([]);
    setResult(null);
    setPhase("bet");
  }

  function cashOut() {
    submit(bestBankroll);
    setPhase("over");
  }

  // ── render ───────────────────────────────────────────────────────────────────
  const pv = player.length ? handValue(player) : null;
  const showDealerVal = phase === "dealer" || phase === "settled" || phase === "over";
  const dv = dealer.length && showDealerVal ? handValue(dealer) : null;
  const fmtVal = (v) => (v.soft && v.total <= 21 ? `${v.total - 10}/${v.total}` : v.total);

  return (
    <div className="bj-root">
      <div className="bj-bar">
        <button className="bj-btn" onClick={() => navigate("/")}>← EXIT</button>
        {phase !== "start" && <button className="bj-btn" onClick={cashOut}>CASH OUT</button>}
        <span className="sp" />
        <span className="bj-stat">CHIPS <b>{chips}</b></span>
        <span className="bj-stat">BET <b>{bet}</b></span>
      </div>

      <div className="bj-felt">
        <div className="bj-side">
          <div className="bj-label">DEALER {dv && <b>· {fmtVal(dv)}</b>}</div>
          <Hand cards={dealer} />
        </div>

        <div className="bj-mid">
          {result && <div className={`bj-result ${result.kind}`}>{result.text}</div>}

          {phase === "bet" && (
            <>
              <div className="bj-betrow">
                {CHIP_DENOMS.map((d) => (
                  <div className="bj-chip" key={d.v} onPointerDown={() => addBet(d.v)}>
                    <img src={chipImg(d.color)} alt="" draggable="false" />
                    <span>{d.v}</span>
                  </div>
                ))}
              </div>
              <div className="bj-controls">
                <button className="bj-btn" onPointerDown={clearBet}>CLEAR</button>
                <button className="bj-big" onPointerDown={onDeal} disabled={bet <= 0}>DEAL</button>
              </div>
            </>
          )}

          {phase === "player" && (
            <div className="bj-controls">
              <button className="bj-big" onPointerDown={onHit}>HIT</button>
              <button className="bj-big alt" onPointerDown={onStand}>STAND</button>
              {player.length === 2 && chips >= bet * 2 && (
                <button className="bj-big" onPointerDown={onDouble}>DOUBLE</button>
              )}
            </div>
          )}

          {phase === "settled" && (
            <div className="bj-controls">
              <button className="bj-big alt" onPointerDown={nextHand}>
                {chips <= 0 ? "GAME OVER" : "NEXT HAND"}
              </button>
            </div>
          )}
        </div>

        <div className="bj-side">
          <Hand cards={player} />
          <div className="bj-label">YOU {pv && <b>· {fmtVal(pv)}</b>}</div>
        </div>
      </div>

      {phase === "start" && (
        <div className="bj-overlay">
          <h1>BLACKJACK</h1>
          <div className="sub">dealer stands on 17 · blackjack pays 3:2</div>
          <button className="bj-big" onPointerDown={newSession}>BUY IN · 100 CHIPS</button>
          {best != null && <div className="sub">best bankroll · {best}</div>}
        </div>
      )}

      {phase === "over" && (
        <div className="bj-overlay">
          <h1>{bestBankroll > START_CHIPS ? "YOU WIN!" : "BUSTED OUT"}</h1>
          <div className="sub">best bankroll this session · {bestBankroll}</div>
          {best != null && bestBankroll >= best && <div className="sub" style={{ color: "#34c759" }}>★ new best ★</div>}
          <button className="bj-big" onPointerDown={newSession}>PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}

const RESULT_TEXT = {
  blackjack: "BLACKJACK! 3:2",
  win: "YOU WIN",
  "dealer-bust": "DEALER BUSTS",
  push: "PUSH",
  lose: "DEALER WINS",
  bust: "BUST",
};
const KIND = {
  blackjack: "win", win: "win", "dealer-bust": "win",
  push: "push", lose: "lose", bust: "lose",
};
