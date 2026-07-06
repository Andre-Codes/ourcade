import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { useArcadeScore } from "../lib/scores.js";
import ShareButton from "../components/ShareButton.jsx";
import {
  puzzleFor, judgeStep, isSolved, nextHint, shareLine, laddergramNumber,
} from "./laddergram/logic.js";

/* LADDERGRAM — Ourcade's daily word ladder, as a real cabinet.

   START → END, change ONE letter at a time, every rung a common word, reach END
   in as few steps as possible. Par is the shortest ladder; beat or match it. One
   ladder a day for everyone; a streak for showing up, a leaderboard by steps
   (fewer is better). The static Solve-This "Word Ladder" minis stay separate for
   quick perusers — this shares only the BFS/hop engine.

   Mobile-first: a real <input> so the phone keyboard appears (no custom keypad),
   with autocorrect/caps off; the rung list scrolls but the entry stays above the
   fold. All truth in laddergram/logic.js. */

const STATE_KEY = "laddergram:state"; // { day, chain:[word…], hintsUsed, done }
const STREAK_KEY = "laddergram:streak";

function loadDayState(day, start) {
  const s = lsGetJSON(STATE_KEY, null);
  if (s && s.day === day && Array.isArray(s.chain) && s.chain.length) {
    return { day, chain: s.chain, hintsUsed: s.hintsUsed || 0, done: !!s.done };
  }
  return { day, chain: [start], hintsUsed: 0, done: false };
}

function bumpStreak(day) {
  const prev = lsGetJSON(STREAK_KEY, null) || { last: null, streak: 0, best: 0 };
  if (prev.last === day) return prev;
  let streak;
  if (prev.last && dayNumberFromKey(day) - dayNumberFromKey(prev.last) === 1) {
    streak = (prev.streak || 0) + 1;
  } else {
    streak = 1;
  }
  const next = { last: day, streak, best: Math.max(prev.best || 0, streak) };
  lsSetJSON(STREAK_KEY, next);
  return next;
}

const TOAST = {
  badlen: "must be the same length",
  nothop: "change exactly one letter",
  notword: "not in the word list",
  already: "already used that word",
};

export default function Laddergram() {
  const day = useMemo(() => todayKey(), []);
  const puzzle = useMemo(() => puzzleFor(day), [day]);
  const num = useMemo(() => laddergramNumber(day), [day]);
  const { submit } = useArcadeScore("laddergram");

  const [state, setState] = useState(() => loadDayState(day, puzzle.start));
  const [entry, setEntry] = useState("");
  const [toast, setToast] = useState(null);
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const inputRef = useRef(null);
  const submittedRef = useRef(false);

  const chain = state.chain;
  const done = state.done;
  const steps = chain.length - 1;
  const last = chain[chain.length - 1];

  useEffect(() => { lsSetJSON(STATE_KEY, state); }, [state]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  }, []);

  // Submit the step count once, the day it's solved.
  useEffect(() => {
    if (done && !submittedRef.current) {
      submittedRef.current = true;
      submit(steps);
      setStreak(bumpStreak(day));
    }
  }, [done, steps, submit, day]);

  const addWord = useCallback((raw) => {
    const w = (raw || "").trim().toUpperCase();
    if (!w || done) return;
    const verdict = judgeStep(w, last, chain);
    if (verdict !== "ok") { flash(TOAST[verdict] || "nope"); return; }
    setState((s) => {
      const nextChain = [...s.chain, w];
      const solved = w === puzzle.end.toUpperCase();
      return { ...s, chain: nextChain, done: solved };
    });
    setEntry("");
  }, [done, last, chain, puzzle.end, flash]);

  const undo = useCallback(() => {
    if (done) return;
    setState((s) => (s.chain.length > 1 ? { ...s, chain: s.chain.slice(0, -1) } : s));
    setEntry("");
  }, [done]);

  const hint = useCallback(() => {
    if (done) return;
    const nx = nextHint(last, puzzle);
    if (nx) { setEntry(nx); flash("💡 try this"); }
    else flash("no hint from here — try undo");
    setState((s) => ({ ...s, hintsUsed: (s.hintsUsed || 0) + 1 }));
    inputRef.current?.focus();
  }, [done, last, puzzle, flash]);

  const onSubmit = useCallback((e) => { e.preventDefault(); addWord(entry); }, [addWord, entry]);

  const share = useMemo(
    () => (done ? shareLine(day, steps, puzzle) : ""),
    [done, day, steps, puzzle]
  );

  return (
    <>
      <style>{CSS}</style>
      <div
        className="ldg-app"
        style={{ overscrollBehavior: "contain", WebkitTouchCallout: "none" }}
      >
        <div className="ldg-head">
          <h1 className="ldg-title">🪜 LADDERGRAM</h1>
          <div className="ldg-sub">
            #{num} · {prettyDate(day)}
            {streak.streak > 0 && <span className="ldg-streak"> · 🔥 {streak.streak}-day streak</span>}
          </div>
        </div>

        <div className="ldg-goal">
          <span className="ldg-goal-w">{puzzle.start}</span>
          <span className="ldg-goal-arrow">→</span>
          <span className="ldg-goal-w">{puzzle.end}</span>
          <span className="ldg-par">par {puzzle.par}</span>
        </div>

        <div className="ldg-rungs">
          {chain.map((w, i) => {
            const isStart = i === 0;
            const isEnd = done && i === chain.length - 1;
            return (
              <div key={w + i} className={`ldg-rung${isStart ? " is-start" : ""}${isEnd ? " is-end" : ""}`}>
                <span className="ldg-rung-n">{i === 0 ? "•" : i}</span>
                <span className="ldg-rung-w">{w}</span>
              </div>
            );
          })}
        </div>

        {!done ? (
          <>
            <form className="ldg-entry" onSubmit={onSubmit}>
              <input
                ref={inputRef}
                className="ldg-input"
                value={entry}
                onChange={(e) => setEntry(e.target.value.replace(/[^a-zA-Z]/g, ""))}
                maxLength={puzzle.start.length}
                placeholder={`${puzzle.start.length} letters…`}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                aria-label="Next rung"
              />
              <button type="submit" className="ldg-add">ADD</button>
            </form>
            <div className="ldg-controls">
              <button type="button" className="ldg-btn" onClick={undo} disabled={chain.length <= 1}>⌫ undo</button>
              <button type="button" className="ldg-btn" onClick={hint}>💡 hint</button>
            </div>
            {toast && <div className="ldg-toast">{toast}</div>}
          </>
        ) : (
          <div className="ldg-win">
            <p className="ldg-win-h">
              {steps <= puzzle.par ? "🎉 solved on par!" : `solved in ${steps} steps`}
            </p>
            <p className="ldg-win-s">{steps} step{steps === 1 ? "" : "s"} · par {puzzle.par}</p>
            <ShareButton label="Share your Laddergram" title="Ourcade — Laddergram" text={share} />
          </div>
        )}

        <p className="ldg-next">a fresh ladder drops at midnight, your time.</p>
      </div>
    </>
  );
}

const CSS = `
.ldg-app{min-height:100svh;background:radial-gradient(120% 120% at 50% 0%,#0a1410 0%,#05100a 60%);
  color:#e8f5ee;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:60px 12px 28px;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box}
.ldg-head{text-align:center}
.ldg-title{margin:0;font-family:'Press Start 2P','Black Ops One',monospace;font-size:1rem;
  letter-spacing:.04em;color:#4fdd8a;text-shadow:0 0 18px rgba(79,221,138,.4)}
.ldg-sub{margin-top:8px;font-size:.78rem;color:#8fc0a4;font-family:'Share Tech Mono',monospace}
.ldg-streak{color:#ff9a52}
.ldg-goal{display:flex;align-items:center;gap:10px;font-family:'Press Start 2P',monospace;font-size:.82rem}
.ldg-goal-w{color:#e8f5ee;letter-spacing:.04em}
.ldg-goal-arrow{color:#4fdd8a}
.ldg-par{font-family:'Share Tech Mono',monospace;font-size:.72rem;color:#6f9a80;margin-left:2px}
.ldg-rungs{display:flex;flex-direction:column;gap:5px;width:100%;max-width:320px;
  max-height:38vh;overflow-y:auto;padding:2px}
.ldg-rung{display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;
  background:#0f2418;border:1px solid #1f4331;border-radius:10px}
.ldg-rung.is-start{border-color:#3a6b52;background:#123020}
.ldg-rung.is-end{border-color:#4fdd8a;background:#123f28;box-shadow:0 0 12px rgba(79,221,138,.3)}
.ldg-rung-n{font-family:'Press Start 2P',monospace;font-size:.62rem;color:#4fdd8a;min-width:16px;text-align:center}
.ldg-rung-w{font-size:1.1rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.ldg-entry{display:flex;gap:8px;width:100%;max-width:320px;margin-top:2px}
.ldg-input{flex:1;height:48px;border:2px solid #1f4331;border-radius:10px;background:#0a1c12;
  color:#e8f5ee;font-size:1.2rem;font-weight:800;letter-spacing:.18em;text-align:center;
  text-transform:uppercase;outline:none;box-sizing:border-box}
.ldg-input:focus{border-color:#4fdd8a}
.ldg-add{height:48px;padding:0 18px;border:0;border-radius:10px;background:#4fdd8a;color:#05100a;
  font-family:'Press Start 2P',monospace;font-size:.64rem;letter-spacing:.03em;cursor:pointer}
.ldg-add:active{transform:translateY(1px)}
.ldg-controls{display:flex;gap:8px}
.ldg-btn{height:40px;padding:0 16px;border:0;border-radius:9px;background:#13291d;color:#cfeadd;
  font-size:.82rem;font-weight:700;cursor:pointer}
.ldg-btn:disabled{opacity:.4;cursor:default}
.ldg-btn:active:not(:disabled){background:#1c3a29}
.ldg-toast{background:rgba(232,245,238,.94);color:#05100a;font-weight:700;padding:7px 15px;
  border-radius:8px;font-size:.82rem;box-shadow:0 6px 20px rgba(0,0,0,.5)}
.ldg-win{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:4px}
.ldg-win-h{margin:0;font-family:'Press Start 2P',monospace;font-size:.82rem;color:#4fdd8a}
.ldg-win-s{margin:0;font-size:.82rem;color:#8fc0a4;font-family:'Share Tech Mono',monospace}
.ldg-next{margin:2px 0 0;font-size:.72rem;color:#5f8570;font-family:'Share Tech Mono',monospace}
@media(max-width:380px){ .ldg-rung-w{font-size:1rem} .ldg-input{font-size:1.05rem} }
`;
