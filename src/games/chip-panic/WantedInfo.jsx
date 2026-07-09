import { useEffect } from "react";
import { HAND_NAME } from "../poker/handEval.js";
import { wantedHint, currentAnte } from "./logic.js";

/* WantedInfo — a self-contained "rules status" popup for Deadlock Poker, opened by
   tapping the WANTED bar. Read-only info panel (not a yes/no), modeled on
   ConfirmDialog's backdrop + click-outside + Escape structure with its own scoped
   .hcbi-* styles injected once.

   Shows, in one place:
     • the current WANTED objective + a plain-English "how to complete it" line
     • the streak-reward ladder (milestones at 2/3/4/5), achieved ones lit and
       future ones shown disabled / not-yet
     • the current ANTE (rising cost to open a lane)
     • a terse JACKPOT reminder

   Props:
     open   — render + show when true
     game   — the live engine state (for wanted, streak, ante)
     onClose — dismiss (also click-outside / Escape / "Got it") */

const HCBI_CSS = `
  .hcbi-bg {
    position: fixed; inset: 0; z-index: 9000; display: flex;
    align-items: center; justify-content: center; padding: 20px;
    background: rgba(4, 2, 12, .62); backdrop-filter: blur(4px);
    animation: hcbi-fade 140ms ease-out;
  }
  @keyframes hcbi-fade { from { opacity: 0; } to { opacity: 1; } }
  .hcbi-box {
    width: min(92vw, 400px); box-sizing: border-box;
    background: linear-gradient(180deg, #161226, #100c1e);
    border: 1px solid rgba(255,210,63,.28); border-radius: 16px;
    box-shadow: 0 18px 60px rgba(0,0,0,.6); padding: 20px 20px 16px;
    text-align: center; animation: hcbi-pop 160ms cubic-bezier(.2,.8,.3,1.2);
    max-height: 86vh; overflow-y: auto;
  }
  @keyframes hcbi-pop { from { transform: scale(.9); opacity: .4; } to { transform: scale(1); opacity: 1; } }
  .hcbi-box h2 { margin: 0 0 4px; font-family: 'Black Ops One', sans-serif; font-size: 1.1rem; letter-spacing: .04em; color: #ffd23f; }
  .hcbi-obj { font-family: 'Black Ops One', sans-serif; font-size: 1.3rem; letter-spacing: .03em; color: #ffd23f; margin: 2px 0 4px; }
  .hcbi-hint { font-family: 'Press Start 2P', monospace; font-size: .5rem; line-height: 1.7; letter-spacing: .03em; color: #cdd2ee; margin: 0 0 4px; }
  .hcbi-rew { font-family: 'Press Start 2P', monospace; font-size: .52rem; letter-spacing: .03em; color: #9be7d8; margin: 0 0 14px; }
  .hcbi-rew b { color: #3fffd0; }

  .hcbi-sec { text-align: left; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.1); }
  .hcbi-sec-h { font-family: 'Press Start 2P', monospace; font-size: .5rem; letter-spacing: .08em; color: #c9b3ec; text-transform: uppercase; margin: 0 0 8px; }

  .hcbi-ladder { display: flex; flex-direction: column; gap: 5px; }
  .hcbi-rung {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px;
    font-family: 'Press Start 2P', monospace; font-size: .48rem; letter-spacing: .02em; line-height: 1.5;
    border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03); color: #9b86c4;
  }
  .hcbi-rung .n { flex: 0 0 auto; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.06); color: #cdd2ee; }
  .hcbi-rung .txt { flex: 1 1 auto; }
  .hcbi-rung.done { border-color: rgba(63,255,208,.4); background: rgba(63,255,208,.08); color: #d7fff5; }
  .hcbi-rung.done .n { background: #3fffd0; color: #0a0a12; }
  .hcbi-rung.locked { opacity: .5; }
  .hcbi-rung .tag { flex: 0 0 auto; font-size: .42rem; letter-spacing: .06em; text-transform: uppercase; }
  .hcbi-rung.done .tag { color: #3fffd0; }
  .hcbi-rung.locked .tag { color: #7a6ba0; }

  .hcbi-lines { display: flex; flex-direction: column; gap: 6px; }
  .hcbi-line { display: flex; justify-content: space-between; gap: 10px; font-family: 'Press Start 2P', monospace; font-size: .5rem; letter-spacing: .02em; color: #cdd2ee; }
  .hcbi-line .v { color: #ffd23f; }
  .hcbi-line .v.jack { color: #3fffd0; }

  .hcbi-close {
    margin-top: 16px; width: 100%; cursor: pointer; border-radius: 9px; padding: 11px 14px;
    font-family: 'Press Start 2P', monospace; font-size: .58rem; letter-spacing: .04em;
    color: #0a0a12; border: 2px solid #0a0a12; background: linear-gradient(180deg, #fff, #bf5af2);
  }
  @media (prefers-reduced-motion: reduce) { .hcbi-bg, .hcbi-box { animation: none; } }
`;

let injected = false;
function useHcbiStyles() {
  useEffect(() => {
    if (injected) return undefined;
    const s = document.createElement("style");
    s.setAttribute("data-hcbi", "");
    s.textContent = HCBI_CSS;
    document.head.appendChild(s);
    injected = true;
    return undefined; // shared once; leave it mounted
  }, []);
}

// The streak-milestone ladder, mirroring streakBonus() in logic.js.
const LADDER = [
  { at: 2, txt: "+25% Wanted points" },
  { at: 3, txt: "+1 bonus chip" },
  { at: 4, txt: "+50% Wanted points" },
  { at: 5, txt: "unlock a locked lane" },
];

export default function WantedInfo({ open, game, onClose }) {
  useHcbiStyles();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !game) return null;
  const w = game.wanted;
  const streak = game.streak || 0;
  const objName = (w?.name || (w ? HAND_NAME[w.hand] : "")) || "";

  return (
    <div className="hcbi-bg" onPointerDown={() => onClose?.()}>
      <div
        className="hcbi-box"
        role="dialog"
        aria-modal="true"
        aria-label="Deadlock Poker — rules status"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2>WANTED</h2>
        <div className="hcbi-obj">{objName.toUpperCase()}</div>
        {w && <p className="hcbi-hint">{wantedHint(w)} — and the lane must still score (two pair+)</p>}
        {w && <p className="hcbi-rew">reward: <b>+{w.bonusPts}</b> pts · <b>+{w.bonusChips}</b> chips</p>}

        <div className="hcbi-sec">
          <p className="hcbi-sec-h">Streak rewards · current streak {streak}</p>
          <div className="hcbi-ladder">
            {LADDER.map((rung) => {
              const done = streak >= rung.at;
              return (
                <div key={rung.at} className={`hcbi-rung ${done ? "done" : "locked"}`}>
                  <span className="n">{rung.at}</span>
                  <span className="txt">{rung.txt}</span>
                  <span className="tag">{done ? "✓ got it" : "not yet"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hcbi-sec">
          <p className="hcbi-sec-h">Run status</p>
          <div className="hcbi-lines">
            <div className="hcbi-line"><span>Ante to open a lane</span><span className="v">{currentAnte(game)} chips</span></div>
            <div className="hcbi-line"><span>Bust · below Two Pair</span><span className="v">locks the lane</span></div>
            <div className="hcbi-line"><span>Jackpot · SF / Royal</span><span className="v jack">+1000 / +2500</span></div>
          </div>
        </div>

        <button type="button" className="hcbi-close" onPointerDown={onClose}>Got it</button>
      </div>
    </div>
  );
}
