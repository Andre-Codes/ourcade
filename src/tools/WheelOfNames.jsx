import { useEffect, useMemo, useRef, useState } from "react";

// ── Wheel of Names ──────────────────────────────────────────────────────────
// Self-contained party tool. Injects its own theme (only one tool mounts per
// route; the arcade shell CSS is all `arcade-` prefixed, so a global reset here
// is safe). Names persist to localStorage. Single screen → the shell's
// "‹ BACK TO ARCADE" button stays visible, so no useArcadeBackButton needed.

const STORAGE_KEY = "ourcade:wheel:names";
const DEFAULT_NAMES = ["Alex", "Sam", "Jordan", "Taylor", "Casey", "Riley"];

const SEGMENT_COLORS = [
  "#ff4d72", "#ffd23f", "#3fffd0", "#b44dff",
  "#ff8a3d", "#e8ff47", "#4db5ff", "#ff6ad5",
];

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #07080f;
    color: #eef0ff;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }

  .wheel-app {
    min-height: 100vh;
    padding: 28px 16px 80px;
    background:
      radial-gradient(ellipse 60% 40% at 20% 6%, rgba(180,77,255,.10), transparent 70%),
      radial-gradient(ellipse 50% 50% at 82% 94%, rgba(63,255,208,.08), transparent 65%),
      #07080f;
  }

  .wheel-head { text-align: center; margin-bottom: 26px; }
  .wheel-head h1 {
    font-family: 'Black Ops One', 'Impact', sans-serif;
    font-size: clamp(2rem, 7vw, 3.4rem);
    letter-spacing: 0.06em;
    background: linear-gradient(180deg, #fffbe6, #ffd23f 45%, #ff8a3d 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 0 30px rgba(255,210,63,.35);
  }
  .wheel-head .sub {
    font-size: 0.62rem; letter-spacing: 0.3em; text-transform: uppercase;
    color: #6b708f; margin-top: 6px;
  }

  .wheel-layout {
    display: flex; flex-wrap: wrap; gap: 28px;
    justify-content: center; align-items: flex-start;
    max-width: 880px; margin: 0 auto;
  }

  .wheel-stage { position: relative; width: min(380px, 86vw); flex: 0 0 auto; }

  .wheel-pointer {
    position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
    width: 0; height: 0; z-index: 3;
    border-left: 16px solid transparent;
    border-right: 16px solid transparent;
    border-top: 30px solid #ffd23f;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.6));
  }

  .wheel-svg {
    display: block; width: 100%; height: auto;
    filter: drop-shadow(0 0 24px rgba(0,0,0,.6));
    transition: transform 4.6s cubic-bezier(0.17, 0.67, 0.12, 1);
  }
  .wheel-hub {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 54px; height: 54px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #2a2f4a, #0c0e18);
    border: 3px solid #ffd23f; z-index: 2;
    box-shadow: 0 0 14px rgba(255,210,63,.5);
  }

  .wheel-seg-label { font-family: 'Share Tech Mono', monospace; font-weight: 700; }

  .wheel-side { flex: 1 1 240px; min-width: 240px; max-width: 360px; }

  .wheel-spin {
    width: 100%; padding: 16px;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: 0.8rem; letter-spacing: 0.05em;
    color: #0a0a12; cursor: pointer;
    background: linear-gradient(180deg, #fff, #3fffd0);
    border: 2px solid #0a0a12; border-radius: 8px;
    box-shadow: inset 2px 2px 0 rgba(255,255,255,.5), inset -2px -2px 0 rgba(0,0,0,.4), 0 6px 18px rgba(63,255,208,.25);
    transition: transform .08s ease, filter .15s ease;
  }
  .wheel-spin:hover:not(:disabled) { filter: brightness(1.08); }
  .wheel-spin:active:not(:disabled) { transform: translateY(2px); }
  .wheel-spin:disabled { opacity: .4; cursor: not-allowed; }

  .wheel-names-label {
    font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: #6b708f; margin: 22px 0 8px;
  }
  .wheel-textarea {
    width: 100%; min-height: 180px; resize: vertical;
    padding: 12px; border-radius: 8px;
    background: #0e101a; color: #eef0ff;
    border: 2px solid #2a2f4a;
    font-family: 'Share Tech Mono', monospace; font-size: 0.95rem; line-height: 1.6;
  }
  .wheel-textarea:focus { outline: none; border-color: #3fffd0; }

  .wheel-row { display: flex; gap: 8px; margin-top: 10px; }
  .wheel-mini {
    flex: 1; padding: 9px; cursor: pointer;
    font-family: 'Share Tech Mono', monospace; font-size: 0.7rem;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: #cfd3f5; background: #13162a;
    border: 2px solid #2a2f4a; border-radius: 6px;
    transition: border-color .15s ease, color .15s ease;
  }
  .wheel-mini:hover { border-color: #ff4d72; color: #fff; }
  .wheel-count { font-size: 0.62rem; color: #6b708f; margin-top: 8px; letter-spacing: 0.1em; }

  /* winner banner */
  .wheel-winner {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    background: rgba(4,5,11,.82); padding: 20px;
    animation: wheel-fade .25s ease;
  }
  @keyframes wheel-fade { from { opacity: 0; } to { opacity: 1; } }
  .wheel-winner-card {
    text-align: center; padding: 36px 40px; border-radius: 16px;
    background: linear-gradient(180deg, #14172a, #0a0c16);
    border: 3px solid #ffd23f;
    box-shadow: 0 0 60px rgba(255,210,63,.4);
    animation: wheel-pop .35s cubic-bezier(.18,.89,.32,1.28);
    max-width: 90vw;
  }
  @keyframes wheel-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .wheel-winner-card .label { font-size: 0.66rem; letter-spacing: 0.3em; text-transform: uppercase; color: #6b708f; }
  .wheel-winner-card .name {
    font-family: 'Black Ops One', sans-serif; font-size: clamp(1.8rem, 8vw, 3.4rem);
    color: #ffd23f; margin: 10px 0 22px; word-break: break-word;
    text-shadow: 0 0 26px rgba(255,210,63,.5);
  }
  .wheel-winner-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .wheel-winner-actions button {
    padding: 11px 16px; cursor: pointer; border-radius: 8px;
    font-family: 'Press Start 2P', monospace; font-size: 0.62rem; letter-spacing: 0.04em;
    border: 2px solid #0a0a12;
  }
  .wheel-btn-go { color: #0a0a12; background: linear-gradient(180deg, #fff, #3fffd0); }
  .wheel-btn-rm { color: #fff; background: linear-gradient(180deg, #ff7a93, #ff4d72); }
  .wheel-btn-x  { color: #cfd3f5; background: #13162a; border-color: #2a2f4a; }
`;

function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y} Z`;
}

function loadNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) { /* ignore */ }
  return DEFAULT_NAMES;
}

export default function WheelOfNames() {
  const [names, setNames] = useState(loadNames);
  const [text, setText] = useState(() => loadNames().join("\n"));
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const winnerIdx = useRef(null);

  // keep the names array (used by the wheel) in sync with the textarea
  useEffect(() => {
    const parsed = text.split("\n").map((s) => s.trim()).filter(Boolean);
    setNames(parsed);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch (e) { /* ignore */ }
  }, [text]);

  const N = names.length;
  const seg = N > 0 ? 360 / N : 360;
  const R = 190, CX = 200, CY = 200;

  const segments = useMemo(() => {
    if (N <= 1) return [];
    return names.map((name, i) => {
      const start = -90 + i * seg;
      const center = start + seg / 2;
      return {
        name,
        path: arcPath(CX, CY, R, start, start + seg),
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        labelTransform: `rotate(${center} ${CX} ${CY})`,
      };
    });
  }, [names, N, seg]);

  const spin = () => {
    if (spinning || N < 2) return;
    const target = Math.floor(Math.random() * N);
    winnerIdx.current = target;
    const centerOf = target * seg + seg / 2; // clockwise from pointer (top)
    const base = (360 - (centerOf % 360)) % 360;
    const current = ((rotation % 360) + 360) % 360;
    const delta = (base - current + 360) % 360;
    setWinner(null);
    setSpinning(true);
    setRotation((r) => r + 360 * 5 + delta);
  };

  const onSpinEnd = () => {
    if (!spinning) return;
    setSpinning(false);
    if (winnerIdx.current != null) setWinner(names[winnerIdx.current]);
  };

  const removeWinner = () => {
    if (winnerIdx.current == null) return;
    const next = names.filter((_, i) => i !== winnerIdx.current);
    setText(next.join("\n"));
    setWinner(null);
  };

  const shuffle = () => {
    const next = [...names];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setText(next.join("\n"));
  };

  return (
    <>
      <style>{style}</style>
      <div className="wheel-app">
        <div className="wheel-head">
          <h1>WHEEL OF NAMES</h1>
          <div className="sub">spin to pick · totally fair · probably</div>
        </div>

        <div className="wheel-layout">
          <div className="wheel-stage">
            <div className="wheel-pointer" />
            <svg
              className="wheel-svg"
              viewBox="0 0 400 400"
              style={{ transform: `rotate(${rotation}deg)` }}
              onTransitionEnd={onSpinEnd}
            >
              {N === 0 && (
                <circle cx={CX} cy={CY} r={R} fill="#13162a" stroke="#2a2f4a" strokeWidth="2" />
              )}
              {N === 1 && (
                <>
                  <circle cx={CX} cy={CY} r={R} fill={SEGMENT_COLORS[0]} />
                  <text x={CX} y={CY} fill="#0a0a12" fontSize="22" textAnchor="middle"
                    dominantBaseline="central" className="wheel-seg-label">
                    {names[0].slice(0, 16)}
                  </text>
                </>
              )}
              {segments.map((s, i) => (
                <g key={i}>
                  <path d={s.path} fill={s.color} stroke="#07080f" strokeWidth="2" />
                  <g transform={s.labelTransform}>
                    <text
                      x={CX + R * 0.58} y={CY}
                      fill="#0a0a12" fontSize={N > 12 ? 11 : 15}
                      textAnchor="middle" dominantBaseline="central"
                      className="wheel-seg-label"
                    >
                      {s.name.slice(0, 14)}
                    </text>
                  </g>
                </g>
              ))}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#ffd23f" strokeWidth="4" opacity="0.7" />
            </svg>
            <div className="wheel-hub" />
          </div>

          <div className="wheel-side">
            <button className="wheel-spin" onClick={spin} disabled={spinning || N < 2}>
              {spinning ? "SPINNING…" : "SPIN ▶"}
            </button>

            <div className="wheel-names-label">Names — one per line</div>
            <textarea
              className="wheel-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Add one name per line…"}
              spellCheck={false}
            />
            <div className="wheel-row">
              <button className="wheel-mini" onClick={shuffle}>↺ Shuffle</button>
              <button className="wheel-mini" onClick={() => setText("")}>✕ Clear</button>
            </div>
            <div className="wheel-count">{N} {N === 1 ? "entry" : "entries"} on the wheel</div>
          </div>
        </div>

        {winner != null && (
          <div className="wheel-winner" onClick={() => setWinner(null)}>
            <div className="wheel-winner-card" onClick={(e) => e.stopPropagation()}>
              <div className="label">🎉 The wheel chose</div>
              <div className="name">{winner}</div>
              <div className="wheel-winner-actions">
                <button className="wheel-btn-go" onClick={() => { setWinner(null); spin(); }}>SPIN AGAIN</button>
                <button className="wheel-btn-rm" onClick={removeWinner}>REMOVE WINNER</button>
                <button className="wheel-btn-x" onClick={() => setWinner(null)}>CLOSE</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
