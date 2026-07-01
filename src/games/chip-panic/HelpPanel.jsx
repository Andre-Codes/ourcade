import { useEffect } from "react";

/* HelpPanel — a self-contained "how to play" modal for High Card Bust, opened from
   the title screen's HELP button. Read-only reference (not a yes/no), modeled on
   WantedInfo/ConfirmDialog: backdrop + click-outside + Escape close, with its own
   scoped .hcbh-* styles injected once. Static content (no game state) — the
   authoritative rule numbers mirror src/games/chip-panic/logic.js.

   Props:
     open    — render + show when true
     onClose — dismiss (also click-outside / Escape / "Got it") */

const HCBH_CSS = `
  .hcbh-bg {
    position: fixed; inset: 0; z-index: 9000; display: flex;
    align-items: center; justify-content: center; padding: 20px;
    background: rgba(4, 2, 12, .62); backdrop-filter: blur(4px);
    animation: hcbh-fade 140ms ease-out;
  }
  @keyframes hcbh-fade { from { opacity: 0; } to { opacity: 1; } }
  .hcbh-box {
    width: min(94vw, 440px); box-sizing: border-box;
    background: linear-gradient(180deg, #161226, #100c1e);
    border: 1px solid rgba(191,90,242,.35); border-radius: 16px;
    box-shadow: 0 18px 60px rgba(0,0,0,.6); padding: 22px 20px 16px;
    text-align: center; animation: hcbh-pop 160ms cubic-bezier(.2,.8,.3,1.2);
    max-height: 88vh; overflow-y: auto;
  }
  @keyframes hcbh-pop { from { transform: scale(.9); opacity: .4; } to { transform: scale(1); opacity: 1; } }
  .hcbh-box h2 {
    margin: 0 0 4px; font-family: 'Black Ops One', sans-serif; font-size: 1.4rem; letter-spacing: .04em;
    background: linear-gradient(180deg,#fffbe6,#bf5af2 55%,#3fffd0);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .hcbh-tag { font-family: 'Press Start 2P', monospace; font-size: .5rem; line-height: 1.7; letter-spacing: .03em; color: #cdd2ee; margin: 0 0 6px; }

  .hcbh-sec { text-align: left; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.1); }
  .hcbh-sec-h { font-family: 'Press Start 2P', monospace; font-size: .5rem; letter-spacing: .08em; color: #c9b3ec; text-transform: uppercase; margin: 0 0 8px; }
  .hcbh-p { font-family: 'Press Start 2P', monospace; font-size: .48rem; line-height: 1.8; letter-spacing: .02em; color: #cdd2ee; margin: 0 0 6px; }
  .hcbh-p:last-child { margin-bottom: 0; }
  .hcbh-p b { color: #ffd23f; }

  /* the three-way resolution, color-keyed like the in-game .hcb-feed states */
  .hcbh-res { display: flex; flex-direction: column; gap: 6px; }
  .hcbh-row {
    display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px; border-radius: 8px;
    font-family: 'Press Start 2P', monospace; font-size: .46rem; letter-spacing: .02em; line-height: 1.6;
    border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03); color: #cdd2ee;
  }
  .hcbh-row .k { flex: 0 0 auto; font-weight: 700; }
  .hcbh-row.win { border-color: rgba(63,255,208,.4); background: rgba(63,255,208,.08); }
  .hcbh-row.win .k { color: #3fffd0; }
  .hcbh-row.save { border-color: rgba(255,180,84,.4); background: rgba(255,180,84,.08); }
  .hcbh-row.save .k { color: #ffb454; }
  .hcbh-row.bust { border-color: rgba(255,107,107,.4); background: rgba(255,107,107,.08); }
  .hcbh-row.bust .k { color: #ff6b6b; }

  /* raise-tier table */
  .hcbh-tiers { display: flex; flex-direction: column; gap: 5px; }
  .hcbh-tier { display: flex; align-items: center; gap: 8px; font-family: 'Press Start 2P', monospace; font-size: .46rem; letter-spacing: .02em; color: #cdd2ee; }
  .hcbh-tier .dot { flex: 0 0 auto; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
  .hcbh-tier .mul { flex: 0 0 auto; width: 34px; color: #ffd23f; }
  .hcbh-tier .req { flex: 1 1 auto; text-align: right; color: #9b86c4; }

  .hcbh-close {
    margin-top: 16px; width: 100%; cursor: pointer; border-radius: 9px; padding: 11px 14px;
    font-family: 'Press Start 2P', monospace; font-size: .58rem; letter-spacing: .04em;
    color: #0a0a12; border: 2px solid #0a0a12; background: linear-gradient(180deg, #fff, #bf5af2);
  }
  @media (prefers-reduced-motion: reduce) { .hcbh-bg, .hcbh-box { animation: none; } }
`;

let injected = false;
function useHcbhStyles() {
  useEffect(() => {
    if (injected) return undefined;
    const s = document.createElement("style");
    s.setAttribute("data-hcbh", "");
    s.textContent = HCBH_CSS;
    document.head.appendChild(s);
    injected = true;
    return undefined; // shared once; leave it mounted
  }, []);
}

// Raise tiers — mirrors TIERS in logic.js (Red/Gold/Black; ante-Blue isn't a raise).
const TIERS = [
  { color: "#ff5a5a", mult: "×3", req: "needs trips+" },
  { color: "#3fd07a", mult: "×5", req: "needs straight+" },
  { color: "#cbb4ff", mult: "×8", req: "needs full house+" },
];

export default function HelpPanel({ open, onClose }) {
  useHcbhStyles();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="hcbh-bg" onPointerDown={() => onClose?.()}>
      <div
        className="hcbh-box"
        role="dialog"
        aria-modal="true"
        aria-label="High Card Bust — how to play"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2>HOW TO PLAY</h2>
        <p className="hcbh-tag">Build poker hands across four lanes — survive on chips, chase points.</p>

        <div className="hcbh-sec">
          <p className="hcbh-sec-h">The goal</p>
          <p className="hcbh-p">
            Open lanes and fill each with <b>5 cards</b> — a poker hand. Strong hands score
            points; weak ones cost you. You start with <b>12 chips</b>; the run ends when you run
            out of room.
          </p>
        </div>

        <div className="hcbh-sec">
          <p className="hcbh-sec-h">Your turn</p>
          <p className="hcbh-p">
            One card is drawn into your tray. <b>Tap a lane twice</b> to drop it there (the first
            tap greenlights the lane), or spend your one <b>discard</b> to throw it away. Opening
            an empty lane costs the <b>ante</b> (starts at 1 chip, rises over the run).
          </p>
        </div>

        <div className="hcbh-sec">
          <p className="hcbh-sec-h">When a lane fills (5 cards)</p>
          <div className="hcbh-res">
            <div className="hcbh-row win">
              <span className="k">SCORE</span>
              <span>Two Pair or better — points scored, ante back +1 profit, discard refreshes.</span>
            </div>
            <div className="hcbh-row save">
              <span className="k">SAVE</span>
              <span>Any single Pair — the lane clears but scores 0, and the ante is lost.</span>
            </div>
            <div className="hcbh-row bust">
              <span className="k">BUST</span>
              <span>High Card — the lane locks for good, ante + any raise lost, streak resets.</span>
            </div>
          </div>
        </div>

        <div className="hcbh-sec">
          <p className="hcbh-sec-h">Raises — bet for a multiplier</p>
          <p className="hcbh-p">
            Tap the chip under an open lane (at 3 cards or fewer) to wager more for a bigger
            multiplier. A raise commits on your next draw and must land within <b>5 draws</b>:
          </p>
          <div className="hcbh-tiers">
            {TIERS.map((t) => (
              <div className="hcbh-tier" key={t.mult}>
                <span className="dot" style={{ background: t.color, color: t.color }} />
                <span className="mul">{t.mult}</span>
                <span className="req">{t.req}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hcbh-sec">
          <p className="hcbh-sec-h">Wanted &amp; jackpot</p>
          <p className="hcbh-p">
            The <b>WANTED</b> bar up top shows a rotating target — complete it on a scoring lane
            for bonus points + chips and build a <b>streak</b> (rewards at 2/3/4/5). Tap the bar
            in-game for live details. Land a <b>Straight Flush</b> (+1000) or <b>Royal Flush</b>
            (+2500) anytime for the <b>JACKPOT</b>.
          </p>
        </div>

        <div className="hcbh-sec">
          <p className="hcbh-sec-h">Scoring &amp; the end</p>
          <p className="hcbh-p">
            Your score is each hand's base points × any winning raise multiplier, plus wanted and
            jackpot bonuses — it feeds the arcade leaderboard. The run <b>ends</b> when all four
            lanes are locked, or your drawn card has no legal lane to go in.
          </p>
        </div>

        <button type="button" className="hcbh-close" onPointerDown={onClose}>Got it</button>
      </div>
    </div>
  );
}
