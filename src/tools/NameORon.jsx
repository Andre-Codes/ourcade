import { useEffect, useMemo, useRef, useState } from "react";
import { playRare, playEpic } from "../lib/blips.js";
import { renderNameCard } from "../lib/nameCard.js";
import { shareImage } from "../lib/share.js";

// ── Name-O-Tron 3000 ─────────────────────────────────────────────────────────
// Self-contained novelty tool — a GeoCities-quiz "analyzer." Type a name, hit
// ANALYZE, and a fake supercomputer prints a personality readout: animated %
// bars + a punchy verdict. Injects its own theme (arcade shell CSS is all
// `arcade-` prefixed, so a local reset is safe). Single screen → the shell's
// "‹ BACK TO OURCADE" stays visible (no useArcadeBackButton needed).
//
// Everything is DETERMINISTIC: the same input always yields the same readout.
// We hash the normalized input to a 32-bit seed, then a small PRNG draws each
// stat and indexes the verdict — so a shared card matches what the friend sees.

// FNV-1a string hash → unsigned 32-bit. Stable across reloads/browsers.
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 — tiny seeded PRNG. Returns a function yielding floats in [0,1).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const METRICS = [
  "COOLNESS",
  "MYSTERY",
  "ARCADE SKILL",
  "GIGABYTES OF CHARISMA",
  "DIAL-UP PATIENCE",
  "LEADERBOARD DESTINY",
];

// Verdicts, in the 8-Ball's voice — old-internet + arcade flavored.
const VERDICTS = [
  "Born to top the leaderboard.",
  "404: chill not found.",
  "Certified webring royalty.",
  "Would absolutely beat the final boss on the first try.",
  "Powered entirely by Mountain Dew and spite.",
  "The dial-up gods smile upon this one.",
  "Suspiciously good at hiding the browser tab.",
  "A rare drop. Handle with care.",
  "Peaked during the GeoCities era. Still peaking.",
  "Has definitely rage-quit at least once today.",
  "The kind of legend forums whisper about.",
  "Reads the patch notes. All of them.",
  "Secretly the high score you can't beat.",
  "Loading personality… 99%… (it's fine).",
  "Touch grass? Couldn't be this one.",
  "Built different. Possibly out of LEGO.",
  "The chosen one of the computer lab.",
  "Mostly harmless. Occasionally glorious.",
  "Would survive a kernel panic with grace.",
  "Speedrun of life: any%, no resets.",
  "Guestbook says: an absolute icon.",
  "Has a lucky controller and isn't afraid to use it.",
  "Runs at a stable 60fps under pressure.",
  "Probably hoarding rare floppy disks.",
];

// Rank tier from the average score — drives the headline color + label.
function rankOf(avg) {
  if (avg >= 85) return { label: "S — LEGENDARY", color: "#ffd23f" };
  if (avg >= 70) return { label: "A — ELITE", color: "#3fffd0" };
  if (avg >= 55) return { label: "B — SOLID", color: "#3fa9ff" };
  if (avg >= 40) return { label: "C — PROMISING", color: "#b44dff" };
  return { label: "D — A WORK IN PROGRESS", color: "#ff6a8a" };
}

// Pure analysis: normalized input → { stats, verdict, rank, avg }.
function analyze(rawName) {
  const name = rawName.trim().toLowerCase().replace(/\s+/g, " ");
  const seed = hashString(name || "anonymous");
  const rng = mulberry32(seed);
  const stats = METRICS.map((label) => ({
    label,
    // bias toward the readable middle-high range so it feels flattering-ish
    value: Math.round(18 + rng() * 80),
  }));
  const verdict = VERDICTS[seed % VERDICTS.length];
  const avg = Math.round(stats.reduce((s, m) => s + m.value, 0) / stats.length);
  return { stats, verdict, rank: rankOf(avg), avg };
}

const BAR_COLORS = ["#3fffd0", "#ffd23f", "#b44dff", "#ff6a8a", "#3fa9ff", "#e8ff47"];

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #07080f;
    color: #eef0ff;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }

  .not-app {
    min-height: 100vh; padding: 28px 16px 80px;
    display: flex; flex-direction: column; align-items: center;
    background:
      radial-gradient(ellipse 60% 45% at 50% 0%, rgba(180,77,255,.12), transparent 70%),
      radial-gradient(ellipse 50% 50% at 50% 100%, rgba(63,255,208,.08), transparent 65%),
      #07080f;
  }

  .not-head { text-align: center; margin-bottom: 22px; }
  .not-head h1 {
    font-family: 'Black Ops One', 'Impact', sans-serif;
    font-size: clamp(2rem, 7vw, 3.2rem); letter-spacing: 0.05em;
    background: linear-gradient(180deg, #fff, #b44dff 60%, #3fffd0 120%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 0 28px rgba(180,77,255,.35);
  }
  .not-head .sub {
    font-size: 0.62rem; letter-spacing: 0.3em; text-transform: uppercase;
    color: #6b708f; margin-top: 6px;
  }

  .not-ask { width: min(460px, 94vw); display: flex; gap: 8px; margin-bottom: 28px; }
  .not-input {
    flex: 1; padding: 13px 14px; border-radius: 9px;
    background: #0e101a; color: #eef0ff; border: 2px solid #2a2f4a;
    font-family: 'Share Tech Mono', monospace; font-size: 0.95rem;
  }
  .not-input:focus { outline: none; border-color: #b44dff; }
  .not-go {
    padding: 0 18px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P', monospace; font-size: 0.62rem; letter-spacing: 0.05em;
    color: #0a0a12; background: linear-gradient(180deg, #fff, #b44dff); border: 2px solid #0a0a12;
  }
  .not-go:disabled { opacity: .5; cursor: not-allowed; }

  /* ── analyzing beat ──────────────────────────────────────────────────────── */
  .not-analyzing {
    width: min(560px, 94vw); text-align: center; padding: 40px 0;
    font-family: 'Press Start 2P', monospace; font-size: 0.8rem; letter-spacing: 0.08em;
    color: #3fffd0; text-shadow: 0 0 14px rgba(63,255,208,.5);
    animation: not-blink 0.7s steps(2) infinite;
  }
  @keyframes not-blink { 50% { opacity: .35; } }

  /* ── readout panel ───────────────────────────────────────────────────────── */
  .not-panel {
    width: min(560px, 94vw); background: #0b0d16; border: 2px solid #2a2f4a;
    border-radius: 14px; padding: 22px 22px 26px;
    box-shadow: 0 0 44px rgba(180,77,255,.12);
    animation: not-rise .4s ease;
  }
  @keyframes not-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

  .not-subject {
    text-align: center; font-family: 'Black Ops One', sans-serif;
    font-size: clamp(1.4rem, 6vw, 2.2rem); letter-spacing: 0.04em;
    color: #3fffd0; text-shadow: 0 0 16px rgba(63,255,208,.45);
    word-break: break-word;
  }
  .not-rank {
    text-align: center; margin: 6px 0 20px;
    font-family: 'Press Start 2P', monospace; font-size: 0.7rem; letter-spacing: 0.08em;
    color: var(--rank, #fff); text-shadow: 0 0 12px var(--rank, #fff);
  }

  .not-bar { margin-bottom: 14px; }
  .not-bar-top {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 0.78rem; margin-bottom: 5px;
  }
  .not-bar-label { color: #c9d4ff; letter-spacing: 0.04em; }
  .not-bar-pct { font-weight: 700; color: var(--c, #3fffd0); }
  .not-bar-track {
    height: 16px; border-radius: 8px; background: #161a2b; overflow: hidden;
  }
  .not-bar-fill {
    height: 100%; border-radius: 8px; background: var(--c, #3fffd0);
    box-shadow: 0 0 10px var(--c, #3fffd0);
    width: 0; transition: width .9s cubic-bezier(.2,.9,.3,1);
  }

  .not-verdict {
    margin-top: 18px; text-align: center; font-style: italic; font-weight: 700;
    font-size: clamp(1rem, 4vw, 1.3rem); line-height: 1.5; color: #ffd23f;
    text-shadow: 0 0 14px rgba(255,210,63,.4);
  }

  .not-actions { margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .not-pill {
    font-family: 'Press Start 2P', monospace; font-size: 0.56rem; letter-spacing: 0.06em;
    padding: 10px 13px; border-radius: 8px; cursor: pointer;
    color: #eef0ff; background: #0e101a; border: 2px solid #2a2f4a;
  }
  .not-pill:hover { border-color: #b44dff; }
  .not-pill.share { color: #3fffd0; border-color: #16463c; }
  .not-pill.share:hover { border-color: #3fffd0; }
  .not-pill:disabled { opacity: .6; cursor: default; }

  .not-hint {
    margin-top: 22px; font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: #6b708f; text-align: center;
  }
`;

export default function NameORon() {
  const [name, setName] = useState("");
  const [result, setResult] = useState(null); // { subject, stats, verdict, rank }
  const [analyzing, setAnalyzing] = useState(false);
  const [revealed, setRevealed] = useState(false); // drives the bar-fill transition
  const [shareStatus, setShareStatus] = useState(null);
  const beatTimer = useRef(null);
  const revealTimer = useRef(null);
  const shareTimer = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(beatTimer.current);
      clearTimeout(revealTimer.current);
      clearTimeout(shareTimer.current);
    },
    []
  );

  const run = () => {
    const subject = name.trim();
    if (!subject || analyzing) return;
    setAnalyzing(true);
    setRevealed(false);
    setResult(null);
    setShareStatus(null);
    playRare(); // "analyzing" cue, gated by this click gesture
    clearTimeout(beatTimer.current);
    beatTimer.current = setTimeout(() => {
      const { stats, verdict, rank } = analyze(subject);
      setResult({ subject, stats, verdict, rank });
      setAnalyzing(false);
      playEpic(); // "done" flourish
      // next frame: flip `revealed` so the bars animate from 0 → value
      clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealed(true), 60);
    }, 750);
  };

  const shareVerdict = async () => {
    if (!result || shareStatus === "working") return;
    setShareStatus("working");
    try {
      const blob = await renderNameCard({
        name: result.subject,
        stats: result.stats,
        verdict: result.verdict,
      });
      const status = await shareImage({
        blob,
        filename: "ourcade-name-o-tron.png",
        title: "Ourcade — Name-O-Tron 3000",
        text: `The Name-O-Tron analyzed "${result.subject}": ${result.verdict}`,
      });
      setShareStatus(status === "cancelled" ? null : status);
    } catch {
      setShareStatus("failed");
    }
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareStatus(null), 2200);
  };

  const shareLabel =
    shareStatus === "shared" ? "✓ Shared!"
    : shareStatus === "saved" ? "✓ Saved!"
    : shareStatus === "failed" ? "Couldn’t share"
    : shareStatus === "working" ? "…rendering"
    : "📸 Share this verdict";

  return (
    <>
      <style>{style}</style>
      <div className="not-app">
        <div className="not-head">
          <h1>NAME-O-TRON 3000</h1>
          <div className="sub">a 100% scientific name analyzer</div>
        </div>

        <form
          className="not-ask"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <input
            className="not-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="enter a name or word…"
            maxLength={40}
            aria-label="Name to analyze"
          />
          <button className="not-go" type="submit" disabled={analyzing || !name.trim()}>
            ANALYZE
          </button>
        </form>

        {analyzing && (
          <div className="not-analyzing">▚ ANALYZING ▚ crunching the bits…</div>
        )}

        {result && !analyzing && (
          <div className="not-panel">
            <div className="not-subject">{result.subject}</div>
            <div className="not-rank" style={{ "--rank": result.rank.color }}>
              RANK: {result.rank.label}
            </div>

            {result.stats.map((s, i) => {
              const c = BAR_COLORS[i % BAR_COLORS.length];
              return (
                <div className="not-bar" key={s.label} style={{ "--c": c }}>
                  <div className="not-bar-top">
                    <span className="not-bar-label">{s.label}</span>
                    <span className="not-bar-pct">{s.value}%</span>
                  </div>
                  <div className="not-bar-track">
                    <div
                      className="not-bar-fill"
                      style={{ width: revealed ? `${s.value}%` : 0 }}
                    />
                  </div>
                </div>
              );
            })}

            <p className="not-verdict">“{result.verdict}”</p>

            <div className="not-actions">
              <button className="not-pill share" onClick={shareVerdict} disabled={shareStatus === "working"}>
                {shareLabel}
              </button>
            </div>
          </div>
        )}

        <div className="not-hint">
          — same name, same result. it&apos;s science. —
        </div>
      </div>
    </>
  );
}
