import { useEffect, useRef, useState } from "react";
import { playRare, playEpic, playLegendary } from "../lib/blips.js";
import { renderNameCard } from "../lib/nameCard.js";
import { shareImage } from "../lib/share.js";
import {
  VERDICTS as RAW_VERDICTS,
  RANK_TITLES,
  METRICS,
  LOG_LINES,
} from "../data/manual/nameOTron.js";

// ── Name-O-Tron 3000 ─────────────────────────────────────────────────────────
// Self-contained novelty "analyzer." Type a name, hit ANALYZE, and a fake
// supercomputer prints a personality readout: six stat bars + a verdict + a
// rank, wrapped in a scrolling "computation" log and stamped with an opaque
// signature. Injects its own theme (arcade shell CSS is all `arcade-` prefixed,
// so a local reset is safe). Single screen → the shell's "‹ BACK TO OURCADE"
// stays visible (no useArcadeBackButton needed).
//
// Everything is DETERMINISTIC and offline: we read real features of the input
// (length, vowels, rare letters, symmetry…), fold them with a seeded jitter
// into each bar, then pick a verdict from a tagged pool by what the analysis
// "found." Same input → identical bars, verdict, rank, log, and signature, so a
// shared card reproduces for whoever opens it — but the mapping is deliberately
// opaque, so it reads like a real machine sized you up. The witty lines live in
// src/data/manual/nameOTron.js (hand-edited / pasted), NOT here.

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

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Normalize the raw pool entries (bare string OR {text, tags, tier}) once.
const VERDICTS = (Array.isArray(RAW_VERDICTS) ? RAW_VERDICTS : [])
  .map((v) =>
    typeof v === "string"
      ? { text: v, tags: [], tier: "common" }
      : { text: v.text, tags: v.tags || [], tier: v.tier || "common" }
  )
  .filter((v) => v && typeof v.text === "string" && v.text.length);

// Last-resort line so the toy never renders undefined even with an empty pool.
const FALLBACK_VERDICT = "The Name-O-Tron is recalibrating. Try again.";

// Built-in static rank labels (used when a RANK_TITLES tier pool is empty).
const RANK_BASE = {
  S: { label: "S — LEGENDARY", color: "#ffd23f" },
  A: { label: "A — ELITE", color: "#3fffd0" },
  B: { label: "B — SOLID", color: "#3fa9ff" },
  C: { label: "C — PROMISING", color: "#b44dff" },
  D: { label: "D — A WORK IN PROGRESS", color: "#ff6a8a" },
};

const RARITY = {
  rare: { weight: 1 / 12, label: "⚠ ANOMALY DETECTED", color: "#3fa9ff" },
  secret: { weight: 1 / 60, label: "✦ LEGENDARY SIGNAL ✦", color: "#ffd23f" },
};

// ── feature extraction ──────────────────────────────────────────────────────
// Everything the "analysis" pretends to read. All guarded so weird input
// (emoji, symbols-only, one char, non-Latin) never produces NaN.
function extractFeatures(raw) {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, "");
  const len = trimmed.length;
  const lettersLen = letters.length || 0;
  const vowels = (letters.match(/[aeiou]/g) || []).length;
  const vowelRatio = lettersLen ? vowels / lettersLen : 0.5;
  const uniqueLetters = new Set(letters).size;
  const rareLetters = (letters.match(/[qxzjkvw]/g) || []).length;
  const doubled = (lower.match(/(.)\1/g) || []).length;
  const hasDigit = /\d/.test(trimmed);
  const hasSymbol = /[^a-z0-9\s]/i.test(trimmed);
  const allCaps = /[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase();
  // letterSum: a→1…z→26, folded to 0..1
  let sum = 0;
  for (const ch of letters) sum += ch.charCodeAt(0) - 96;
  const letterSum01 = lettersLen ? (sum % 101) / 100 : 0.5;
  const canon = letters || lower.replace(/\s/g, "");
  const palindrome = canon.length > 2 && canon === [...canon].reverse().join("");
  const firstCharCode = trimmed ? trimmed.charCodeAt(0) : 0;
  return {
    len,
    lettersLen,
    vowelRatio,
    uniqueLetters,
    rareLetters,
    doubled,
    hasDigit,
    hasSymbol,
    allCaps,
    letterSum01,
    palindrome,
    firstCharCode,
    long: len >= 14,
  };
}

// Per-metric formulas, indexed to METRICS order. Each blends real features with
// a seeded jitter, then clamps to a flattering-ish 12..98 range. The exact mix
// is intentionally opaque — bars visibly move with the name without being
// predictable. `j` is a fresh jitter in [-1,1] per metric.
const METRIC_FORMULAS = [
  // 0 COOLNESS — rare letters + symmetry + swagger jitter
  (f, j) => 52 + f.rareLetters * 9 + (f.palindrome ? 14 : 0) + j * 22,
  // 1 MYSTERY — symbols/digits/rare letters up; very short or super-common down
  (f, j) => 40 + (f.hasSymbol ? 16 : 0) + (f.hasDigit ? 10 : 0) + f.rareLetters * 7 + j * 24,
  // 2 ARCADE SKILL — letterSum resonance + seeded skill
  (f, j) => 30 + f.letterSum01 * 50 + j * 26,
  // 3 GIGABYTES OF CHARISMA — vowels carry charisma
  (f, j) => 28 + f.vowelRatio * 60 + j * 20,
  // 4 DIAL-UP PATIENCE — length helps, doubled letters (stutters) hurt
  (f, j) => 34 + clamp(f.len * 2.4, 0, 40) - f.doubled * 8 + j * 18,
  // 5 LEADERBOARD DESTINY — unique letters + first-letter fate + jitter
  (f, j) => 36 + f.uniqueLetters * 4 + (f.firstCharCode % 17) + j * 20,
];

// Map a dominant metric index → the verdict tag it themes to (METRICS order).
const METRIC_TAGS = ["coolness", "mystery", "skill", "charisma", "patience", "destiny"];

// Deterministic hex signature from the seed, e.g. "7F3A-1C09".
function signature(seed) {
  const a = (seed >>> 16).toString(16).toUpperCase().padStart(4, "0");
  const b = (seed & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return `${a}-${b}`;
}

function rankOf(avg, rng) {
  let tier;
  if (avg >= 85) tier = "S";
  else if (avg >= 70) tier = "A";
  else if (avg >= 55) tier = "B";
  else if (avg >= 40) tier = "C";
  else tier = "D";
  const base = RANK_BASE[tier];
  const pool = (RANK_TITLES && RANK_TITLES[tier]) || [];
  const label = pool.length ? pool[Math.floor(rng() * pool.length)] : base.label;
  return { tier, label, color: base.color };
}

// Pick a verdict: feature-triggered first, then a seeded rarity roll, then the
// dominant-stat themed bucket, then common. Always falls back to common, then
// to a built-in line. Returns { text, tier } where tier marks rare/secret for
// the ANOMALY chip.
function pickVerdict(features, dominantTag, rng) {
  if (!VERDICTS.length) return { text: FALLBACK_VERDICT, tier: "common" };

  const byTag = (tag) => VERDICTS.filter((v) => v.tags.includes(tag));
  const choose = (pool) => pool[Math.floor(rng() * pool.length)];

  // 1. Hard feature triggers (the machine "noticed" structure) — highest priority.
  if (features.palindrome) {
    const p = byTag("palindrome");
    if (p.length) return { ...choose(p) };
  }
  if (features.allCaps) {
    const p = byTag("allcaps");
    if (p.length) return { ...choose(p) };
  }

  // 2. Seeded rarity roll — secret first (rarest), then rare.
  const roll = rng();
  if (roll < RARITY.secret.weight) {
    const p = VERDICTS.filter((v) => v.tier === "secret");
    if (p.length) return { ...choose(p) };
  }
  if (roll < RARITY.secret.weight + RARITY.rare.weight) {
    const p = VERDICTS.filter((v) => v.tier === "rare");
    if (p.length) return { ...choose(p) };
  }

  // 3. Soft feature flavor (digit / long) — only sometimes, so it stays special.
  if (features.hasDigit && rng() < 0.4) {
    const p = byTag("hasdigit");
    if (p.length) return { ...choose(p) };
  }
  if (features.long && rng() < 0.4) {
    const p = byTag("long");
    if (p.length) return { ...choose(p) };
  }

  // 4. Dominant-stat themed bucket — the reading "says" what it found.
  if (dominantTag && rng() < 0.65) {
    const p = byTag(dominantTag);
    if (p.length) return { ...choose(p) };
  }

  // 5. Common pool (anything untagged, non-tiered) → else anything.
  const common = VERDICTS.filter((v) => v.tier === "common" && !v.tags.length);
  return { ...choose(common.length ? common : VERDICTS) };
}

// Build the deterministic scrolling log from LOG_LINES (with {n}/{sig} fills).
function buildLog(seed, sig, rng) {
  const lines = Array.isArray(LOG_LINES) ? LOG_LINES.slice() : [];
  if (!lines.length) return ["COMPILING VERDICT…"];
  // Always end on the last entry ("compiling"); pick 3–4 of the rest in order.
  const tail = lines[lines.length - 1];
  const head = lines.slice(0, -1);
  // deterministic subset preserving order
  const want = 3 + Math.floor(rng() * 2);
  const chosen = head.filter(() => rng() < 0.6).slice(0, want);
  const picked = (chosen.length ? chosen : head.slice(0, want)).concat(tail);
  return picked.map((l) =>
    l.replace(/\{n\}/g, String(1 + Math.floor(rng() * 4))).replace(/\{sig\}/g, `0x${sig.split("-")[0]}`)
  );
}

// Full deterministic analysis: normalized input → everything the panel renders.
function analyze(rawName) {
  const subject = rawName.trim();
  const norm = subject.toLowerCase().replace(/\s+/g, " ");
  const seed = hashString(norm || "anonymous");
  const features = extractFeatures(subject);

  // Bars: feature mix + per-metric seeded jitter.
  const barRng = mulberry32(seed);
  const stats = METRICS.map((label, i) => {
    const j = barRng() * 2 - 1; // [-1,1]
    const formula = METRIC_FORMULAS[i % METRIC_FORMULAS.length];
    const value = Math.round(clamp(formula(features, j), 12, 98));
    return { label, value };
  });

  const avg = Math.round(stats.reduce((s, m) => s + m.value, 0) / stats.length);
  const dominantIdx = stats.reduce((best, s, i, arr) => (s.value > arr[best].value ? i : best), 0);
  const dominantTag = METRIC_TAGS[dominantIdx % METRIC_TAGS.length];

  // Separate, offset RNG streams so verdict / rank / log don't move in lockstep.
  const verdict = pickVerdict(features, dominantTag, mulberry32((seed ^ 0x9e3779b9) >>> 0));
  const rank = rankOf(avg, mulberry32((seed ^ 0x85ebca6b) >>> 0));
  const sig = signature(seed);
  const confidence = (90 + (seed % 100) / 10).toFixed(1); // 90.0–99.9, deterministic
  const log = buildLog(seed, sig, mulberry32((seed ^ 0xc2b2ae35) >>> 0));

  return { subject, stats, avg, verdict, rank, sig, confidence, log };
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

  /* ── analyzing beat: scrolling fake-process log ─────────────────────────── */
  .not-analyzing {
    width: min(560px, 94vw); min-height: 150px; padding: 18px 20px;
    background: #06070d; border: 2px solid #1c2740; border-radius: 12px;
    font-family: 'Share Tech Mono', monospace; font-size: 0.82rem; line-height: 1.8;
    color: #3fffd0; text-shadow: 0 0 8px rgba(63,255,208,.4);
    box-shadow: inset 0 0 30px rgba(63,255,208,.06);
  }
  .not-log-line { white-space: pre-wrap; animation: not-type .25s ease both; }
  .not-log-line::before { content: "> "; color: #6b708f; }
  .not-log-cursor { display: inline-block; width: 9px; height: 1em; vertical-align: -2px;
    background: #3fffd0; animation: not-blink .7s steps(2) infinite; }
  @keyframes not-type { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }
  @keyframes not-blink { 50% { opacity: 0; } }

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
    text-align: center; margin: 6px 0 4px;
    font-family: 'Press Start 2P', monospace; font-size: 0.7rem; letter-spacing: 0.08em;
    color: var(--rank, #fff); text-shadow: 0 0 12px var(--rank, #fff);
  }

  /* provenance strip — signature + confidence (pure mystique) */
  .not-meta {
    display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;
    margin-bottom: 16px; font-size: 0.58rem; letter-spacing: 0.14em;
    text-transform: uppercase; color: #5b6386;
  }
  .not-meta b { color: #9fb4ff; font-weight: 400; }

  /* anomaly chip (rare/secret tiers) */
  .not-anomaly {
    display: block; width: fit-content; margin: 0 auto 14px;
    font-family: 'Press Start 2P', monospace; font-size: 0.5rem; letter-spacing: 0.12em;
    padding: 5px 9px; border-radius: 5px; text-transform: uppercase;
    color: var(--a, #fff); border: 1px solid var(--a, #fff);
    background: rgba(0,0,0,.4); box-shadow: 0 0 12px var(--a, #fff);
    animation: not-anomaly-pop .45s cubic-bezier(.2,1.5,.4,1);
  }
  @keyframes not-anomaly-pop { from { opacity: 0; transform: scale(.5); } to { opacity: 1; transform: scale(1); } }

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
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [logShown, setLogShown] = useState(0); // how many log lines are visible
  const [revealed, setRevealed] = useState(false); // drives the bar-fill transition
  const [shareStatus, setShareStatus] = useState(null);
  const pendingLog = useRef([]);
  const logTimer = useRef(null);
  const revealTimer = useRef(null);
  const shareTimer = useRef(null);

  useEffect(
    () => () => {
      clearInterval(logTimer.current);
      clearTimeout(revealTimer.current);
      clearTimeout(shareTimer.current);
    },
    []
  );

  const run = () => {
    const subject = name.trim();
    if (!subject || analyzing) return;
    const data = analyze(subject);

    setAnalyzing(true);
    setRevealed(false);
    setResult(null);
    setShareStatus(null);
    setLogShown(0);
    pendingLog.current = data.log;
    playRare(); // "analyzing" cue, gated by this click gesture

    // Reveal log lines one at a time (~190ms each), then show the result.
    clearInterval(logTimer.current);
    let i = 0;
    logTimer.current = setInterval(() => {
      i += 1;
      setLogShown(i);
      if (i >= pendingLog.current.length) {
        clearInterval(logTimer.current);
        setResult(data);
        setAnalyzing(false);
        if (data.verdict.tier === "secret") playLegendary();
        else playEpic();
        clearTimeout(revealTimer.current);
        revealTimer.current = setTimeout(() => setRevealed(true), 60);
      }
    }, 190);
  };

  const shareVerdict = async () => {
    if (!result || shareStatus === "working") return;
    setShareStatus("working");
    try {
      const blob = await renderNameCard({
        name: result.subject,
        stats: result.stats,
        verdict: result.verdict.text,
        rank: result.rank.label,
        signature: result.sig,
        confidence: result.confidence,
        anomaly: RARITY[result.verdict.tier] ? RARITY[result.verdict.tier].label : null,
      });
      const status = await shareImage({
        blob,
        filename: "ourcade-name-o-tron.png",
        title: "Ourcade — Name-O-Tron 3000",
        text: `The Name-O-Tron analyzed "${result.subject}": ${result.verdict.text}`,
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

  const anomaly = result && RARITY[result.verdict.tier];

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
          <div className="not-analyzing" aria-live="polite">
            {pendingLog.current.slice(0, logShown).map((line, i) => (
              <div className="not-log-line" key={i}>
                {line}
                {i === logShown - 1 && <span className="not-log-cursor" />}
              </div>
            ))}
          </div>
        )}

        {result && !analyzing && (
          <div className="not-panel">
            <div className="not-subject">{result.subject}</div>
            <div className="not-rank" style={{ "--rank": result.rank.color }}>
              RANK: {result.rank.label}
            </div>
            <div className="not-meta">
              <span>SIG: <b>{result.sig}</b></span>
              <span>CONFIDENCE: <b>{result.confidence}%</b></span>
            </div>

            {anomaly && (
              <span className="not-anomaly" style={{ "--a": anomaly.color }}>
                {anomaly.label}
              </span>
            )}

            {result.stats.map((s, i) => {
              const c = BAR_COLORS[i % BAR_COLORS.length];
              return (
                <div className="not-bar" key={`${s.label}-${i}`} style={{ "--c": c }}>
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

            <p className="not-verdict">“{result.verdict.text}”</p>

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
