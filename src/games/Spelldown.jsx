import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey, shiftDayKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { useArcadeScore } from "../lib/scores.js";
import ShareButton from "../components/ShareButton.jsx";
import {
  boardFor, judge, isPangram, rankFor, shareLine, spelldownNumber, MIN_LEN,
} from "./spelldown/logic.js";

/* SPELLDOWN — Ourcade's daily word-finder (a Spelling-Bee-shaped cabinet).

   Seven letters, one REQUIRED center; make as many real words (4+ letters) as
   you can using only those letters, every word including the center. Using all
   seven is the pangram (🐝). The same board for everyone each day = the shared
   daily ritual, like the parked Quarter it borrows its scaffold from.

   Self-contained cabinet: injects its own scoped CSS (`.spd-*`), one screen, so
   the arcade shell's "‹ BACK TO OURCADE" stays visible. All puzzle truth lives
   in spelldown/logic.js (board pick, judging, ranks) so a headless check / NPC
   texter computes the identical board. Per-day progress persists under
   ourcade:spelldown:state so a mid-day reload resumes your found words. The
   streak + the "most words" leaderboard piggyback on the existing app machinery
   (bumpStreak mirrors Quarter; useArcadeScore submits the found-count). */

const STATE_KEY = "spelldown:state"; // { day, found:[word…] }
const STREAK_KEY = "spelldown:streak"; // { last:dayKey, streak, best }

function loadDayState(day) {
  const s = lsGetJSON(STATE_KEY, null);
  if (s && s.day === day && Array.isArray(s.found)) return { day, found: s.found };
  return { day, found: [] };
}

// Visit-streak bump: counts the day the FIRST word is found (so opening the page
// and leaving doesn't claim a streak day). Idempotent within a day. Mirrors
// QuarterGame.bumpStreak but with no win/lose — finding ≥1 word "shows up".
function bumpStreak(day) {
  const prev = lsGetJSON(STREAK_KEY, null) || { last: null, streak: 0, best: 0 };
  if (prev.last === day) return prev; // already counted today
  let streak;
  if (prev.last && dayNumberFromKey(day) - dayNumberFromKey(prev.last) === 1) {
    streak = (prev.streak || 0) + 1; // consecutive day
  } else {
    streak = 1; // first ever, or a gap
  }
  const next = { last: day, streak, best: Math.max(prev.best || 0, streak) };
  lsSetJSON(STREAK_KEY, next);
  return next;
}

// Toast copy per judge() verdict.
const TOAST = {
  short: `too short — ${MIN_LEN} letters minimum`,
  badletter: "uses a letter that isn't here",
  nocenter: "must use the center letter",
  notword: "not in the word list",
  already: "already found",
};

export default function Spelldown() {
  const day = useMemo(() => todayKey(), []);
  const board = useMemo(() => boardFor(day), [day]);
  const num = useMemo(() => spelldownNumber(day), [day]);
  const { submit } = useArcadeScore("spelldown");

  // Yesterday's board — revealed (full answer list) in a collapsed expander so a
  // player can see what they missed. Deterministic like today's; boardFor never
  // returns null, so the reveal is always safe.
  const prevDay = useMemo(() => shiftDayKey(day, 1), [day]);
  const prevBoard = useMemo(() => boardFor(prevDay), [prevDay]);
  const prevNum = useMemo(() => spelldownNumber(prevDay), [prevDay]);

  const [state, setState] = useState(() => loadDayState(day));
  const [entry, setEntry] = useState("");
  const [toast, setToast] = useState(null);
  const [shake, setShake] = useState(false);
  const [flashPangram, setFlashPangram] = useState(false);
  // Letter order in the ring; "shuffle" reorders the 6 outer letters for variety.
  const [order, setOrder] = useState(() => board.letters.split("").filter((c) => c !== board.center));
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const lastSubmitRef = useRef(-1);

  // Persist per-day progress whenever it changes.
  useEffect(() => { lsSetJSON(STATE_KEY, state); }, [state]);

  // Keep the leaderboard's "most words" in step with the found count (submit only
  // when it grows; the hook itself no-ops for anon users and worse scores).
  useEffect(() => {
    const n = state.found.length;
    if (n > 0 && n !== lastSubmitRef.current) {
      lastSubmitRef.current = n;
      submit(n);
    }
  }, [state.found.length, submit]);

  const foundPangram = useMemo(
    () => state.found.some((w) => isPangram(w, board)),
    [state.found, board]
  );
  const rank = useMemo(() => rankFor(state.found.length, board), [state.found.length, board]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setShake(true);
    setTimeout(() => setShake(false), 380);
    setTimeout(() => setToast(null), 1300);
  }, []);

  const commit = useCallback(() => {
    const word = entry.toUpperCase();
    if (!word) return;
    const verdict = judge(word, board, state.found);
    if (verdict !== "ok") {
      flash(TOAST[verdict] || "nope");
      if (verdict !== "already") setEntry("");
      return;
    }
    const pan = isPangram(word, board);
    setState((s) => {
      const next = { day, found: [...s.found, word] };
      if (s.found.length === 0) setStreak(bumpStreak(day)); // first word today
      return next;
    });
    setEntry("");
    if (pan) {
      setFlashPangram(true);
      setTimeout(() => setFlashPangram(false), 1200);
      flash("🐝 PANGRAM!");
    } else {
      flash(word.length >= 7 ? "🔥 nice and long!" : "✓ nice");
    }
  }, [entry, board, state.found, day, flash]);

  const press = useCallback((ch) => setEntry((e) => e + ch), []);
  const del = useCallback(() => setEntry((e) => e.slice(0, -1)), []);
  const shuffle = useCallback(() => {
    setOrder((prev) => {
      const a = prev.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  }, []);

  // Physical keyboard: letters in the set type; Enter submits; Backspace deletes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k === "ENTER") { e.preventDefault(); commit(); }
      else if (e.key === "Backspace") { e.preventDefault(); del(); }
      else if (/^[A-Z]$/.test(k) && board.letters.includes(k)) { e.preventDefault(); press(k); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, del, press, board.letters]);

  const share = useMemo(
    () => shareLine(day, state.found.length, board, foundPangram),
    [day, state.found.length, board, foundPangram]
  );

  // Sorted found list, longest first then alpha — pangrams flagged.
  const foundSorted = useMemo(
    () => [...state.found].sort((a, b) => b.length - a.length || a.localeCompare(b)),
    [state.found]
  );

  const pct = Math.round(rank.pct * 100);

  return (
    <>
      <style>{CSS}</style>
      <div className="spd-app">
        <div className="spd-head">
          <h1 className="spd-title">🐝 SPELLDOWN</h1>
          <div className="spd-sub">
            #{num} · {prettyDate(day)}
            {streak.streak > 0 && <span className="spd-streak"> · 🔥 {streak.streak}-day streak</span>}
          </div>
        </div>

        {/* rank + progress */}
        <div className="spd-rankbar">
          <span className="spd-rank">{rank.label}</span>
          <div className="spd-track">
            <div className="spd-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="spd-count">
            {state.found.length}/{board.maxWords}
          </span>
        </div>

        {/* current entry */}
        <div className={`spd-entry${shake ? " is-shake" : ""}`}>
          {entry
            ? entry.split("").map((ch, i) => (
                <span key={i} className={`spd-ch${ch === board.center ? " is-center" : ""}`}>
                  {ch}
                </span>
              ))
            : <span className="spd-entry-ph">type or tap…</span>}
        </div>

        {/* letter ring: center + 6 outer. The toast floats UP over the ring (an
            absolutely-positioned child) so notifications never shove the UI down. */}
        <div className={`spd-ring${flashPangram ? " is-pangram" : ""}`}>
          {toast && <div className="spd-toast">{toast}</div>}
          <button type="button" className="spd-hex is-center" onClick={() => press(board.center)}>
            {board.center}
          </button>
          {order.map((ch, i) => (
            <button
              type="button"
              key={ch}
              className={`spd-hex spd-pos-${i}`}
              onClick={() => press(ch)}
            >
              {ch}
            </button>
          ))}
        </div>

        {/* controls */}
        <div className="spd-controls">
          <button type="button" className="spd-btn" onClick={del}>⌫ delete</button>
          <button type="button" className="spd-btn spd-shuffle" onClick={shuffle}>⟳ shuffle</button>
          <button type="button" className="spd-btn spd-enter" onClick={commit}>enter</button>
        </div>

        {/* found words + share */}
        <div className="spd-found">
          <div className="spd-found-head">
            <span>{state.found.length} found</span>
            {foundPangram && <span className="spd-bee">🐝 pangram!</span>}
          </div>
          <div className="spd-found-list">
            {foundSorted.length === 0 && (
              <span className="spd-found-empty">your words show up here…</span>
            )}
            {foundSorted.map((w) => (
              <span key={w} className={`spd-word${isPangram(w, board) ? " is-pangram" : ""}`}>
                {w}
              </span>
            ))}
          </div>
        </div>

        {/* prior-day reveal: the full answer list for yesterday's board, so
            players get closure on what they missed. Collapsed by default. */}
        {prevNum >= 1 && (
          <details className="spd-prior">
            <summary>Yesterday's words · Spelldown #{prevNum}</summary>
            <div className="spd-prior-body">
              <div className="spd-prior-meta">
                <span className="spd-prior-letters">
                  {prevBoard.letters.split("").map((ch) => (
                    <span key={ch} className={ch === prevBoard.center ? "is-center" : ""}>{ch}</span>
                  ))}
                </span>
                <span className="spd-prior-count">{prevBoard.words.length} words</span>
              </div>
              <div className="spd-found-list">
                {prevBoard.words.map((w) => (
                  <span key={w} className={`spd-word${prevBoard.pangrams.includes(w) ? " is-pangram" : ""}`}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </details>
        )}

        <div className="spd-actions">
          <ShareButton label="Share your Spelldown" title="Ourcade — Spelldown" text={share} />
        </div>
        <p className="spd-next">a fresh board drops at midnight, your time.</p>
      </div>
    </>
  );
}

const CSS = `
.spd-app{min-height:100svh;background:radial-gradient(120% 120% at 50% 0%,#1a1606 0%,#0b0a05 60%);
  color:#fdf6e3;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:60px 12px 28px;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box}
.spd-head{text-align:center}
.spd-title{margin:0;font-family:'Press Start 2P','Black Ops One',monospace;font-size:1.05rem;
  letter-spacing:.04em;color:#ffd45e;text-shadow:0 0 18px rgba(255,212,94,.4)}
.spd-sub{margin-top:8px;font-size:.8rem;color:#cbb778;font-family:'Share Tech Mono',monospace}
.spd-streak{color:#ff9a52}
.spd-rankbar{display:flex;align-items:center;gap:10px;width:100%;max-width:420px}
.spd-rank{font-size:.78rem;font-weight:800;color:#ffd45e;min-width:74px;text-transform:uppercase;letter-spacing:.03em}
.spd-track{flex:1;height:8px;background:#2a2410;border-radius:99px;overflow:hidden}
.spd-fill{height:100%;background:linear-gradient(90deg,#c9a227,#ffd45e);border-radius:99px;transition:width .35s ease}
.spd-count{font-size:.78rem;color:#cbb778;font-family:'Share Tech Mono',monospace;min-width:46px;text-align:right}
.spd-entry{min-height:42px;display:flex;align-items:center;justify-content:center;gap:1px;
  font-size:1.8rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.spd-entry.is-shake{animation:spdShake .38s}
@keyframes spdShake{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(4px)}50%{transform:translateX(-4px)}}
.spd-entry-ph{font-size:.9rem;font-weight:500;color:#7a6f4a;letter-spacing:0;text-transform:none}
.spd-ch{color:#fdf6e3}
.spd-ch.is-center{color:#ffd45e}
/* toast floats up and hovers over the letter ring (absolute inside .spd-ring) so
   it never reflows the layout. Translucent + blurred so the letters read through;
   pointer-events off so it never blocks a tap. */
.spd-toast{position:absolute;left:50%;top:-14px;transform:translate(-50%,-100%);z-index:5;
  pointer-events:none;white-space:nowrap;background:rgba(253,246,227,.92);color:#1a1606;font-weight:700;
  padding:7px 15px;border-radius:8px;font-size:.82rem;box-shadow:0 6px 20px rgba(0,0,0,.5);
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:spdToast .22s ease-out}
@keyframes spdToast{from{opacity:0;transform:translate(-50%,-70%)}to{opacity:1;transform:translate(-50%,-100%)}}
@media (prefers-reduced-motion: reduce){.spd-toast{animation:none}}
/* letter ring — a simple responsive hex-ish cluster (center + 6 around) */
.spd-ring{position:relative;width:230px;height:204px;margin:4px 0}
.spd-ring.is-pangram .spd-hex{animation:spdPan .6s}
@keyframes spdPan{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.spd-hex{position:absolute;width:66px;height:66px;border:0;border-radius:14px;cursor:pointer;
  font-size:1.5rem;font-weight:800;color:#fdf6e3;background:#3a3115;text-transform:uppercase;
  transition:transform .08s,background .12s;display:flex;align-items:center;justify-content:center}
.spd-hex:hover{background:#4a3f1c}
.spd-hex:active{transform:scale(.92)}
.spd-hex.is-center{left:82px;top:69px;background:#c9a227;color:#1a1606;box-shadow:0 0 16px rgba(255,212,94,.45)}
.spd-hex.is-center:hover{background:#ffd45e}
.spd-pos-0{left:82px;top:0}
.spd-pos-1{left:160px;top:35px}
.spd-pos-2{left:160px;top:104px}
.spd-pos-3{left:82px;top:138px}
.spd-pos-4{left:4px;top:104px}
.spd-pos-5{left:4px;top:35px}
.spd-controls{display:flex;gap:8px}
.spd-btn{height:44px;padding:0 16px;border:0;border-radius:9px;background:#3a3115;color:#fdf6e3;
  font-size:.85rem;font-weight:700;cursor:pointer;transition:background .1s}
.spd-btn:hover{background:#4a3f1c}
.spd-shuffle{font-size:1rem}
.spd-enter{background:#c9a227;color:#1a1606}
.spd-enter:hover{background:#ffd45e}
.spd-found{width:100%;max-width:420px;margin-top:6px}
.spd-found-head{display:flex;justify-content:space-between;font-size:.76rem;color:#cbb778;
  font-family:'Share Tech Mono',monospace;margin-bottom:6px}
.spd-bee{color:#ffd45e}
.spd-found-list{display:flex;flex-wrap:wrap;gap:5px;min-height:30px;align-content:flex-start;
  max-height:150px;overflow-y:auto;padding:8px;background:#16130a;border-radius:10px}
.spd-found-empty{font-size:.78rem;color:#6f6543;font-style:italic}
.spd-word{font-size:.74rem;font-weight:700;letter-spacing:.02em;background:#2a2410;color:#e7dcc0;
  padding:3px 7px;border-radius:6px;text-transform:uppercase}
.spd-word.is-pangram{background:#c9a227;color:#1a1606}
.spd-prior{width:100%;max-width:420px;margin-top:2px}
.spd-prior>summary{list-style:none;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:.76rem;
  color:#cbb778;background:#16130a;border-radius:10px;padding:9px 12px;user-select:none;
  display:flex;align-items:center;gap:6px}
.spd-prior>summary::-webkit-details-marker{display:none}
.spd-prior>summary::before{content:"▸";color:#8a7d52;transition:transform .15s}
.spd-prior[open]>summary::before{transform:rotate(90deg)}
.spd-prior>summary:hover{color:#ffd45e}
.spd-prior-body{margin-top:6px}
.spd-prior-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.spd-prior-letters{display:flex;gap:3px}
.spd-prior-letters span{font-family:'Share Tech Mono',monospace;font-weight:700;font-size:.82rem;
  color:#e7dcc0;text-transform:uppercase}
.spd-prior-letters span.is-center{color:#ffd45e}
.spd-prior-count{font-size:.72rem;color:#8a7d52;font-family:'Share Tech Mono',monospace}
.spd-actions{display:flex;gap:10px;margin-top:4px}
.spd-next{margin:2px 0 0;font-size:.72rem;color:#8a7d52;font-family:'Share Tech Mono',monospace}
@media(max-width:380px){
  .spd-ring{width:212px;height:188px}
  .spd-hex{width:60px;height:60px;font-size:1.35rem}
  .spd-hex.is-center{left:76px;top:64px}
  .spd-pos-0{left:76px;top:0}.spd-pos-1{left:148px;top:32px}.spd-pos-2{left:148px;top:96px}
  .spd-pos-3{left:76px;top:128px}.spd-pos-4{left:4px;top:96px}.spd-pos-5{left:4px;top:32px}
}
`;
