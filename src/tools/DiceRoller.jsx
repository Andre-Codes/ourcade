import { useEffect, useRef, useState } from "react";
import { kImg } from "../lib/kenney.js";

// ── Dice & Coin Roller ───────────────────────────────────────────────────────
// Self-contained party/TTRPG tool. Injects its own theme. Single screen → the
// shell's "‹ BACK TO OURCADE" stays visible (no useArcadeBackButton needed).
//
// Dice are drawn as real Kenney die-shape sprites with the rolled value overlaid
// (d6 uses the pipped dice_1..6 faces directly — no overlay needed). The coin uses
// the Kenney flip_head/flip_tails sprites.

const DICE = [4, 6, 8, 10, 12, 20];
const MAX_COUNT = 12;

const dieSprite = (d) => kImg("dice", `d${d}`);
const d6Face = (v) => kImg("dice", `dice_${v}`);
const coinSprite = (side) => kImg("dice", side === "HEADS" ? "flip_head" : "flip_tails");

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #07080f;
    color: #eef0ff;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }

  .dice-app {
    min-height: 100vh; padding: 28px 16px 80px;
    background:
      radial-gradient(ellipse 55% 40% at 18% 6%, rgba(63,255,208,.10), transparent 70%),
      radial-gradient(ellipse 50% 50% at 84% 92%, rgba(180,77,255,.09), transparent 65%),
      #07080f;
  }

  .dice-head { text-align: center; margin-bottom: 22px; }
  .dice-head h1 {
    font-family: 'Black Ops One', 'Impact', sans-serif;
    font-size: clamp(2rem, 7vw, 3.2rem); letter-spacing: 0.06em;
    background: linear-gradient(180deg, #fffbe6, #3fffd0 50%, #b44dff 110%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 0 28px rgba(63,255,208,.3);
  }
  .dice-head .sub { font-size: 0.62rem; letter-spacing: 0.3em; text-transform: uppercase; color: #6b708f; margin-top: 6px; }

  .dice-wrap { max-width: 640px; margin: 0 auto; }

  .dice-modes { display: flex; gap: 4px; padding: 4px; margin-bottom: 22px;
    background: #0e101a; border: 2px solid #2a2f4a; border-radius: 10px; }
  .dice-mode {
    flex: 1; padding: 12px; cursor: pointer; border: none; border-radius: 7px;
    background: transparent; color: #6b708f;
    font-family: 'Press Start 2P', monospace; font-size: 0.66rem; letter-spacing: 0.05em;
    transition: all .15s ease;
  }
  .dice-mode.active { color: #0a0a12; background: linear-gradient(180deg, #fff, #3fffd0); }

  .dice-pick { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 18px; }
  .dice-chip {
    min-width: 58px; padding: 12px 14px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P', monospace; font-size: 0.72rem;
    color: #cfd3f5; background: #13162a; border: 2px solid #2a2f4a;
    transition: all .12s ease;
  }
  .dice-chip:hover { border-color: #3fffd0; }
  .dice-chip.active { color: #0a0a12; background: linear-gradient(180deg, #fff, #ffd23f); border-color: #0a0a12; }

  .dice-steppers { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; margin-bottom: 22px; }
  .dice-stepper { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .dice-stepper .lbl { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #6b708f; }
  .dice-stepper .ctl { display: flex; align-items: center; gap: 10px; }
  .dice-stepper button {
    width: 38px; height: 38px; cursor: pointer; border-radius: 8px;
    font-size: 1.2rem; color: #eef0ff; background: #13162a; border: 2px solid #2a2f4a;
  }
  .dice-stepper button:hover { border-color: #b44dff; }
  .dice-stepper .val { min-width: 46px; text-align: center; font-size: 1.4rem; color: #ffd23f; }

  .dice-roll {
    display: block; width: 100%; max-width: 320px; margin: 0 auto 26px;
    padding: 16px; cursor: pointer; border-radius: 10px;
    font-family: 'Press Start 2P', monospace; font-size: 0.9rem; letter-spacing: 0.06em;
    color: #0a0a12; background: linear-gradient(180deg, #fff, #b44dff);
    border: 2px solid #0a0a12;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.4), inset -2px -2px 0 rgba(0,0,0,.4), 0 6px 20px rgba(180,77,255,.3);
    transition: transform .08s ease, filter .15s ease;
  }
  .dice-roll:hover:not(:disabled) { filter: brightness(1.08); }
  .dice-roll:active:not(:disabled) { transform: translateY(2px); }
  .dice-roll:disabled { opacity: .5; cursor: not-allowed; }

  .dice-results { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; min-height: 78px; margin-bottom: 16px; }
  .die {
    position: relative; width: 68px; height: 68px;
    display: flex; align-items: center; justify-content: center;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,.5));
  }
  .die img { width: 100%; height: 100%; object-fit: contain; display: block;
    filter: drop-shadow(0 0 6px rgba(63,255,208,.35)); }
  /* rolled value overlaid on the die-shape sprite (not needed for d6 pip faces). */
  .die .pip {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-family: 'Black Ops One', sans-serif; font-size: 1.5rem; color: #fffbe6;
    text-shadow: 0 0 6px rgba(0,0,0,.9), 0 1px 2px rgba(0,0,0,.9); pointer-events: none;
    padding-top: 6px;
  }
  .die.dimmed { opacity: .32; filter: grayscale(.6) drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
  .die.rolling { animation: die-tumble .2s linear infinite; }
  @keyframes die-tumble {
    0% { transform: rotate(0) scale(1); } 25% { transform: rotate(10deg) scale(1.06); }
    50% { transform: rotate(0) scale(.98); } 75% { transform: rotate(-10deg) scale(1.06); }
    100% { transform: rotate(0) scale(1); }
  }

  /* advantage/disadvantage toggle (d20 only) */
  .dice-adv { display: flex; gap: 6px; justify-content: center; margin-bottom: 18px; }
  .dice-adv button {
    padding: 9px 14px; cursor: pointer; border-radius: 8px;
    font-family: 'Press Start 2P', monospace; font-size: 0.56rem; letter-spacing: 0.04em;
    color: #9aa0c8; background: #13162a; border: 2px solid #2a2f4a; transition: all .12s ease;
  }
  .dice-adv button.on-adv { color: #0a0a12; background: linear-gradient(180deg,#fff,#34c759); border-color: #0a0a12; }
  .dice-adv button.on-dis { color: #0a0a12; background: linear-gradient(180deg,#fff,#ff4d72); border-color: #0a0a12; }

  .dice-total { text-align: center; margin-bottom: 26px; }
  .dice-total .t-label { font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase; color: #6b708f; }
  .dice-total .t-val {
    font-family: 'Black Ops One', sans-serif; font-size: clamp(2.4rem, 12vw, 4rem);
    color: #ffd23f; line-height: 1; text-shadow: 0 0 26px rgba(255,210,63,.45);
  }
  .dice-total .t-break { font-size: 0.7rem; color: #6b708f; margin-top: 4px; }

  /* coin */
  .coin-stage { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 16px 0 28px; }
  .coin {
    width: 150px; height: 150px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 35% 30%, #ffe98a, #f2b705 60%, #b8860b);
    border: 5px solid #ffd23f;
    box-shadow: 0 0 30px rgba(255,210,63,.4), inset 0 -6px 12px rgba(0,0,0,.25);
  }
  .coin img { width: 64%; height: 64%; object-fit: contain; }
  .coin .coin-q { font-family: 'Black Ops One', sans-serif; font-size: 1.3rem; color: #2a1d00; }
  .coin.flipping { animation: coin-flip .9s cubic-bezier(.3,.1,.3,1); }
  @keyframes coin-flip {
    0% { transform: rotateX(0); }
    100% { transform: rotateX(2520deg); }
  }
  .coin-result { font-family: 'Black Ops One', sans-serif; font-size: 1.4rem; letter-spacing: 0.08em;
    color: #ffd23f; text-shadow: 0 0 18px rgba(255,210,63,.5); }

  .dice-hist-label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #6b708f; margin: 8px 0 8px; }
  .dice-hist { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .dice-hist li {
    display: flex; justify-content: space-between; gap: 12px;
    padding: 9px 12px; border-radius: 7px;
    background: #0e101a; border: 1px solid #1c2035; font-size: 0.82rem;
  }
  .dice-hist .h-roll { color: #b8bcd8; }
  .dice-hist .h-roll b { color: #3fffd0; }
  .dice-hist .h-total { color: #ffd23f; font-weight: 700; }
  .dice-hist-empty { color: #444a6b; font-size: 0.8rem; text-align: center; padding: 8px; }
`;

export default function DiceRoller() {
  const [mode, setMode] = useState("dice");
  const [die, setDie] = useState(6);
  const [count, setCount] = useState(2);
  const [modifier, setModifier] = useState(0);
  const [advantage, setAdvantage] = useState("none"); // none | adv | dis (d20 only)
  const [results, setResults] = useState([]);
  const [dropped, setDropped] = useState(-1); // index of the discarded d20 (adv/dis)
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState([]);

  const [coinResult, setCoinResult] = useState(null);
  const [coinFlipping, setCoinFlipping] = useState(false);

  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);

  // Advantage/disadvantage only applies to a single d20.
  const advActive = die === 20 && count === 1 && advantage !== "none";
  const modText = modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`;

  const rollOnce = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * die));

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setDropped(-1);
    // adv/dis rolls 2×d20 and keeps the higher/lower; otherwise roll `count` dice.
    const n = advActive ? 2 : count;
    const finals = rollOnce(n);
    let ticks = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      ticks++;
      if (ticks >= 9) {
        clearInterval(timer.current);
        setResults(finals);
        let dropIdx = -1;
        if (advActive) {
          const keepHigh = advantage === "adv";
          dropIdx = (finals[0] >= finals[1]) === keepHigh ? 1 : 0;
        }
        setDropped(dropIdx);
        setRolling(false);
        const kept = dropIdx < 0 ? finals : finals.filter((_, i) => i !== dropIdx);
        const total = kept.reduce((a, b) => a + b, 0) + modifier;
        const label = advActive
          ? `d20 ${advantage === "adv" ? "adv" : "dis"}${modText}`
          : `${count}d${die}${modText}`;
        setHistory((h) => [
          { id: Date.now(), label, rolls: kept, total },
          ...h,
        ].slice(0, 10));
      } else {
        setResults(rollOnce(n));
      }
    }, 55);
  };

  const flip = () => {
    if (coinFlipping) return;
    setCoinFlipping(true);
    setCoinResult(null);
    const res = Math.random() < 0.5 ? "HEADS" : "TAILS";
    setTimeout(() => {
      setCoinResult(res);
      setCoinFlipping(false);
      setHistory((h) => [
        { id: Date.now(), label: "coin", rolls: [], total: res, isCoin: true },
        ...h,
      ].slice(0, 10));
    }, 900);
  };

  const kept = dropped < 0 ? results : results.filter((_, i) => i !== dropped);
  const diceSum = kept.reduce((a, b) => a + b, 0);

  // A single die: pipped face for d6, otherwise die-shape sprite + overlaid value.
  const Die = ({ value, dimmed }) => (
    <div className={`die ${rolling ? "rolling" : ""} ${dimmed ? "dimmed" : ""}`}>
      {die === 6 ? (
        <img src={d6Face(value)} alt={`${value}`} />
      ) : (
        <>
          <img src={dieSprite(die)} alt={`d${die}`} />
          <span className="pip">{value}</span>
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{style}</style>
      <div className="dice-app">
        <div className="dice-head">
          <h1>DICE &amp; COIN</h1>
          <div className="sub">roll the bones · call it in the air</div>
        </div>

        <div className="dice-wrap">
          <div className="dice-modes">
            <button className={`dice-mode ${mode === "dice" ? "active" : ""}`} onClick={() => setMode("dice")}>🎲 DICE</button>
            <button className={`dice-mode ${mode === "coin" ? "active" : ""}`} onClick={() => setMode("coin")}>🪙 COIN</button>
          </div>

          {mode === "dice" ? (
            <>
              <div className="dice-pick">
                {DICE.map((d) => (
                  <button key={d} className={`dice-chip ${die === d ? "active" : ""}`} onClick={() => setDie(d)}>
                    d{d}
                  </button>
                ))}
              </div>

              <div className="dice-steppers">
                <div className="dice-stepper">
                  <span className="lbl">How many</span>
                  <div className="ctl">
                    <button onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
                    <span className="val">{count}</span>
                    <button onClick={() => setCount((c) => Math.min(MAX_COUNT, c + 1))}>+</button>
                  </div>
                </div>
                <div className="dice-stepper">
                  <span className="lbl">Modifier</span>
                  <div className="ctl">
                    <button onClick={() => setModifier((m) => m - 1)}>−</button>
                    <span className="val">{modifier > 0 ? `+${modifier}` : modifier}</span>
                    <button onClick={() => setModifier((m) => m + 1)}>+</button>
                  </div>
                </div>
              </div>

              {die === 20 && count === 1 && (
                <div className="dice-adv">
                  <button
                    className={advantage === "adv" ? "on-adv" : ""}
                    onClick={() => setAdvantage((a) => (a === "adv" ? "none" : "adv"))}
                  >ADVANTAGE</button>
                  <button
                    className={advantage === "dis" ? "on-dis" : ""}
                    onClick={() => setAdvantage((a) => (a === "dis" ? "none" : "dis"))}
                  >DISADVANTAGE</button>
                </div>
              )}

              <button className="dice-roll" onClick={roll} disabled={rolling}>
                {rolling
                  ? "ROLLING…"
                  : advActive
                    ? `ROLL d20 ${advantage === "adv" ? "ADV" : "DIS"}${modText}`
                    : `ROLL ${count}d${die}${modText}`}
              </button>

              <div className="dice-results">
                {results.map((v, i) => (
                  <Die key={i} value={v} dimmed={i === dropped} />
                ))}
              </div>

              {results.length > 0 && !rolling && (
                <div className="dice-total">
                  <div className="t-label">Total</div>
                  <div className="t-val">{diceSum + modifier}</div>
                  {(kept.length > 1 || modifier !== 0 || advActive) && (
                    <div className="t-break">
                      {kept.join(" + ")}{modText ? ` (${modText})` : ""}
                      {advActive ? ` · ${advantage === "adv" ? "advantage" : "disadvantage"}` : ""}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="coin-stage">
              <div className={`coin ${coinFlipping ? "flipping" : ""}`}>
                {coinResult && !coinFlipping ? (
                  <img src={coinSprite(coinResult)} alt={coinResult} />
                ) : (
                  <span className="coin-q">?</span>
                )}
              </div>
              {coinResult && !coinFlipping && <div className="coin-result">{coinResult}</div>}
              <button className="dice-roll" style={{ background: "linear-gradient(180deg,#fff,#ffd23f)" }} onClick={flip} disabled={coinFlipping}>
                {coinFlipping ? "FLIPPING…" : "FLIP COIN"}
              </button>
            </div>
          )}

          <div className="dice-hist-label">Recent rolls</div>
          {history.length === 0 ? (
            <div className="dice-hist-empty">— nothing yet —</div>
          ) : (
            <ul className="dice-hist">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="h-roll">
                    {h.isCoin ? "🪙 coin flip" : <>{h.label} → <b>{h.rolls.join(", ")}</b></>}
                  </span>
                  <span className="h-total">{h.isCoin ? h.total : `= ${h.total}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
