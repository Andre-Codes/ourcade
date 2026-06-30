import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { getBank, setBank, bankBest } from "../lib/chipBank.js";
import { cardImg, cardBackImg, chipImg, CHIP_ORDER } from "../lib/kenney.js";
import { playSfx, playSfxVariant } from "../lib/sfx.js";
import { useFx, FxLayer } from "../lib/fx.jsx";
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
const FEED_MS = 2400;          // result-panel visible duration
const DEALER_STEP_MS = 780;    // pause between each dealer card reveal
// Denominations low → high paired with the canonical CHIP_ORDER (blue, red, green,
// black) so chips read the same across every cabinet. Displayed high → low below.
const CHIP_DENOMS = [1, 5, 10, 25]
  .map((v, i) => ({ v, color: CHIP_ORDER[i] }))
  .reverse();

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
  .bj-stat { font-size: .84rem; letter-spacing: .14em; text-transform: uppercase; color: #9fdcb4; }
  .bj-stat b { color: #ffd23f; }

  .bj-felt { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 6px 12px; gap: 14px; min-height: 0; }
  .bj-side { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .bj-label { font-size: .82rem; letter-spacing: .2em; text-transform: uppercase; color: #9fdcb4; }
  .bj-label b { color: #fff; }
  .bj-cards { display: flex; gap: 6px; min-height: calc(min(15vw,92px) * 1.357); }
  .bj-card {
    width: min(15vw, 92px); aspect-ratio: 200 / 271.4;
    border-radius: 7px; box-shadow: 0 2px 6px rgba(0,0,0,.5);
  }
  .bj-card img { width: 100%; height: 100%; display: block; border-radius: inherit; }

  .bj-mid { display: flex; flex-direction: column; align-items: center; gap: 10px; }

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

  .bj-betrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; margin-top: 18px; }
  .bj-chip { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .bj-chip img { width: 44px; height: 44px; }
  .bj-chip span { font-family: 'Press Start 2P',monospace; font-size: .5rem; color: #9fdcb4; }

  /* Visible bet stack — the chips you've wagered, piled. Also the fly-animation
     landing target during the bet phase. */
  .bj-pile { position: relative; height: 56px; display: flex; align-items: flex-end; justify-content: center; }
  .bj-pile .pchip { position: absolute; width: 40px; height: 40px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
  .bj-pile .ptotal { font-family: 'Press Start 2P',monospace; font-size: .6rem; color: #ffd23f; }
  .bj-betlabel { font-size: .56rem; letter-spacing: .2em; text-transform: uppercase; color: #9fdcb4; }

  /* Chip-stack bank under the player hand — derived from the bankroll, so it grows
     and shrinks with it; bumps on change. */
  .bj-bank { display: flex; align-items: center; gap: 10px; }
  .bj-bank .bpile { position: relative; width: 132px; height: 30px; }
  .bj-bank .bchip { position: absolute; bottom: 0; width: 28px; height: 28px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
  .bj-bank .btotal { font-family: 'Press Start 2P',monospace; font-size: .64rem; color: #ffd23f; }
  .bj-bank.bump .btotal { animation: bj-bankbump 360ms ease-out; }
  @keyframes bj-bankbump { 50% { transform: scale(1.28); color: #fff; } }

  /* Centered result panel — single home for the outcome + chips won/lost, cloned
     from High Card Bust's .hcb-feed, re-themed to the green felt. */
  .bj-feed {
    position: absolute; top: 38%; left: 50%; transform: translate(-50%,-50%);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    pointer-events: none; opacity: 0; transition: opacity .2s ease; text-align: center;
    z-index: 72; max-width: min(90vw, 460px);
    padding: 14px 24px; border-radius: 16px;
    background: rgba(7, 33, 15, .72); backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,.10); box-shadow: 0 8px 30px rgba(0,0,0,.45);
  }
  .bj-feed.show { opacity: 1; }
  .bj-feed .hand { font-family: 'Black Ops One',sans-serif; font-size: clamp(1.3rem,6vw,2.4rem); line-height: 1.05; color: #ffd23f; text-shadow: 0 2px 10px rgba(0,0,0,.6); }
  .bj-feed .math { font-family: 'Press Start 2P',monospace; font-size: .8rem; letter-spacing: .04em; color: #eef0ff; }
  .bj-feed.win .hand { color: #3fffd0; text-shadow: 0 0 12px rgba(63,255,208,.6), 0 2px 10px rgba(0,0,0,.6); }
  .bj-feed.lose .hand { color: #ff6b6b; text-shadow: 0 0 12px rgba(255,107,107,.5), 0 2px 10px rgba(0,0,0,.6); }
  .bj-feed.push .hand { color: #ffd23f; text-shadow: 0 0 12px rgba(255,210,63,.5), 0 2px 10px rgba(0,0,0,.6); }
  .bj-feed.win .math { color: #3fffd0; }
  .bj-feed.lose .math { color: #ff6b6b; }

  /* fx layer: flying chips (bet → stack, payout → bank) */
  .bj-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 70; }
  .bj-fx .fx-chip { position: absolute; width: 30px; height: 30px; transform: translate(-50%,-50%); will-change: transform,opacity; filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
  .bj-fx .fx-chip img { width: 100%; height: 100%; display: block; }
  .bj-fx .fx-chip.fly { animation: bj-chipfly 640ms cubic-bezier(.4,.05,.5,1) forwards; }
  @keyframes bj-chipfly {
    0%   { opacity: 0; transform: translate(-50%,-50%) translate(0,0) scale(.7); }
    12%  { opacity: 1; transform: translate(-50%,-50%) translate(calc(var(--dx)*.12), calc(var(--dy)*.12 + var(--arc))) scale(1); }
    70%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.7); }
  }
  @media (prefers-reduced-motion: reduce) {
    .bj-fx .fx-chip, .bj-feed { animation-duration: 1ms !important; transition: none !important; }
  }

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
  // Chips ride the shared casino bank (persists across sessions, shared with
  // Video Poker; auto-tops to the stake if you walked away broke).
  const [chips, setChips] = useState(() => getBank().chips);
  const [bestBankroll, setBestBankroll] = useState(() => getBank().chips);
  const [bet, setBet] = useState(0);
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [doubled, setDoubled] = useState(false);
  const [feed, setFeed] = useState(null); // { hand, math, kind, on } | null
  const [bankBump, setBankBump] = useState(false);
  const shoe = useRef([]);
  const rootRef = useRef(null);
  const pileRef = useRef(null);
  const bankRef = useRef(null);
  const feedTimer = useRef(null);
  const dealerTimer = useRef(null);
  const bumpTimer = useRef(null);

  const { parts, spawn, clear: clearFx } = useFx();

  useArcadeBackButton(false);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = BJ_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  // Track the session high-water bankroll (drives the YOU WIN over-screen) and
  // write the live balance back to the shared bank (which advances the all-time
  // peak that the leaderboard scores on).
  useEffect(() => {
    if (chips > bestBankroll) setBestBankroll(chips);
    setBank(chips);
  }, [chips, bestBankroll]);

  // Bump the bank pile whenever the bankroll changes (skip the initial mount).
  const prevChips = useRef(chips);
  useEffect(() => {
    if (prevChips.current !== chips) {
      prevChips.current = chips;
      setBankBump(true);
      clearTimeout(bumpTimer.current);
      bumpTimer.current = setTimeout(() => setBankBump(false), 380);
    }
  }, [chips]);

  // Clear any in-flight timers on unmount.
  useEffect(() => () => {
    clearTimeout(feedTimer.current);
    clearTimeout(dealerTimer.current);
    clearTimeout(bumpTimer.current);
  }, []);

  // Centered result panel, auto-fading after FEED_MS (mirrors HCB's showFeed).
  function showFeed(f) {
    clearTimeout(feedTimer.current);
    setFeed({ ...f, on: true });
    feedTimer.current = setTimeout(() => setFeed((x) => (x ? { ...x, on: false } : x)), FEED_MS);
  }

  function newSession() {
    shoe.current = freshShoe();
    clearTimeout(dealerTimer.current);
    clearFx();
    const bank = getBank().chips; // current balance, auto-topped to the stake if broke
    setChips(bank);
    setBestBankroll(bank);
    setBet(0);
    setPlayer([]);
    setDealer([]);
    setFeed(null);
    setPhase("bet");
  }

  // Fly a chip from a tapped source rect up into the bet pile (coords relative to
  // the position:relative root). Falls back to no animation if refs aren't ready.
  function flyChipTo(targetRef, srcRect, color) {
    const root = rootRef.current;
    const tgt = targetRef.current;
    if (!root || !tgt || !srcRect) return;
    const rb = root.getBoundingClientRect();
    const tb = tgt.getBoundingClientRect();
    const x = srcRect.left - rb.left + srcRect.width / 2;
    const y = srcRect.top - rb.top + srcRect.height / 2;
    const dx = (tb.left + tb.width / 2) - (srcRect.left + srcRect.width / 2);
    const dy = (tb.top + tb.height / 2) - (srcRect.top + srcRect.height / 2);
    spawn({ kind: "chip", x, y, src: chipImg(color), dx, dy, arc: -50, ttl: 660 });
  }

  function addBet(v) {
    if (phase !== "bet") return;
    const next = Math.min(MAX_BET, chips, bet + v);
    if (next === bet) return; // capped out — no chip added
    // First chip of the round → chip-lay-3, subsequent → chip-lay-1.
    playSfx(bet === 0 ? "chip-lay-3" : "chip-lay-1");
    // The wagered chip simply appears in the bet stack — no fly-to-stack animation.
    setBet(next);
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
    setFeed(null);
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

  // Dealer reveals the hole card, then deals each extra card on a timer so the
  // turn plays out one card at a time, then settles.
  function runDealer(playerHand, dbl) {
    setPhase("dealer");
    const finalDealer = dealerPlay(dealer, shoe.current).map((c) => ({ ...c, faceUp: true }));
    // Reveal the two starting cards immediately (hole card flips up).
    let shown = 2;
    setDealer(finalDealer.slice(0, shown));
    playSfxVariant("card-place", [1, 3]);

    const step = () => {
      if (shown >= finalDealer.length) {
        finish(playerHand, finalDealer, dbl);
        return;
      }
      shown += 1;
      setDealer(finalDealer.slice(0, shown));
      playSfxVariant("card-place", [1, 3]);
      dealerTimer.current = setTimeout(step, DEALER_STEP_MS);
    };
    // Brief beat before drawing the first extra card (or settling on a 2-card stand).
    dealerTimer.current = setTimeout(step, DEALER_STEP_MS);
  }

  // Settle the round: apply chip delta, show the outcome panel.
  function finish(playerHand, dealerHand, dbl) {
    const revealed = dealerHand.map((c) => ({ ...c, faceUp: true }));
    setDealer(revealed);
    const { outcome, delta } = settle(playerHand, revealed, bet, dbl);
    setChips((c) => c + delta);
    const math = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "PUSH";
    showFeed({ hand: RESULT_TEXT[outcome], math, kind: KIND[outcome] });
    if (delta > 0) {
      playSfxVariant("chips-stack", [1, 3]);
      // Payout flourish: a few chips fly from the bet pile up to the bank.
      const root = rootRef.current, pile = pileRef.current;
      if (root && pile && bankRef.current) {
        const pr = pile.getBoundingClientRect();
        for (let i = 0; i < 4; i++) {
          flyChipTo(bankRef, { left: pr.left + i * 6, top: pr.top, width: pr.width, height: pr.height }, CHIP_DENOMS[i % CHIP_DENOMS.length].color);
        }
      }
    }
    setPhase("settled");
  }

  function nextHand() {
    if (chips <= 0) {
      submit(bankBest());
      setPhase("over");
      return;
    }
    clearFx();
    setBet((b) => Math.min(b, chips));
    setPlayer([]);
    setDealer([]);
    setFeed(null);
    setPhase("bet");
  }

  function cashOut() {
    submit(bankBest());
    setPhase("over");
  }

  // Decompose an amount into chip colors, largest denom first, for piling.
  function chipsFor(amount, cap = 10) {
    const out = [];
    let rem = amount;
    for (const d of CHIP_DENOMS) {
      while (rem >= d.v && out.length < cap) { out.push(d.color); rem -= d.v; }
    }
    return out;
  }

  // ── render ───────────────────────────────────────────────────────────────────
  const pv = player.length ? handValue(player) : null;
  const showDealerVal = phase === "dealer" || phase === "settled" || phase === "over";
  const dv = dealer.length && showDealerVal ? handValue(dealer) : null;
  const fmtVal = (v) => (v.soft && v.total <= 21 ? `${v.total - 10}/${v.total}` : v.total);

  return (
    <div className="bj-root" ref={rootRef}>
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
          {phase === "bet" && (
            <>
              <div className="bj-betlabel">YOUR BET</div>
              <div className="bj-pile" ref={pileRef}>
                {bet > 0
                  ? chipsFor(bet).map((color, i) => (
                      <img className="pchip" key={i} src={chipImg(color)} alt=""
                        style={{ bottom: `${i * 5}px`, zIndex: i }} draggable="false" />
                    ))
                  : <span className="ptotal">—</span>}
              </div>
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
          {phase !== "start" && (
            <div className={`bj-bank ${bankBump ? "bump" : ""}`}>
              <div className="bpile" ref={bankRef}>
                {chipsFor(chips, 12).map((color, i) => (
                  <img className="bchip" key={i} src={chipImg(color)} alt=""
                    style={{ left: `${i * 9}px`, zIndex: i }} draggable="false" />
                ))}
              </div>
              <span className="btotal">{chips}</span>
            </div>
          )}
        </div>
      </div>

      {feed && (
        <div className={`bj-feed ${feed.kind || ""} ${feed.on ? "show" : ""}`}>
          <span className="hand">{feed.hand}</span>
          {feed.math && <span className="math">{feed.math}</span>}
        </div>
      )}

      <FxLayer parts={parts} className="bj-fx" />

      {phase === "start" && (
        <div className="bj-overlay">
          <h1>BLACKJACK</h1>
          <div className="sub">dealer stands on 17 · blackjack pays 3:2</div>
          <button className="bj-big" onPointerDown={newSession}>SIT DOWN · {chips} CHIPS</button>
          <div className="sub">your bank carries between the tables</div>
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
