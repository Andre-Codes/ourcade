import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { useArcadeScore } from "../lib/scores.js";
import ShareButton from "../components/ShareButton.jsx";
import {
  answerFor, grade, isValidGuess, shareGrid, quarterNumber,
  WORD_LEN, MAX_GUESSES,
} from "./quarter/logic.js";

/* THE DAILY QUARTER — one Wordle-style puzzle a day, the same word for everyone.

   Self-contained cabinet: injects its own scoped CSS (`.qtr-*`), one screen, so
   the arcade shell's "‹ BACK TO OURCADE" button stays visible (no
   useArcadeBackButton needed). All puzzle truth lives in quarter/logic.js so the
   NPC texter computes the identical word. Per-day progress persists under
   ourcade:quarter:state so reloading mid-puzzle (or after solving) resumes /
   shows the result instead of letting you replay the day. Streak + the optional
   "fewest guesses" board piggyback on the existing app machinery. */

const STATE_KEY = "quarter:state";   // { day, guesses:[word…], done, won }
const STREAK_KEY = "quarter:streak"; // { last:dayKey, streak, best }
const ROW = [...Array(WORD_LEN)];

// On-screen keyboard layout (mobile-friendly; physical keys also work).
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function loadDayState(day) {
  const s = lsGetJSON(STATE_KEY, null);
  if (s && s.day === day && Array.isArray(s.guesses)) return s;
  return { day, guesses: [], done: false, won: false };
}

function bumpStreak(day, won) {
  const prev = lsGetJSON(STREAK_KEY, null) || { last: null, streak: 0, best: 0 };
  if (prev.last === day) return prev; // already counted today
  let streak;
  if (!won) {
    streak = 0; // a miss breaks the chain
  } else if (prev.last && dayNumberFromKey(day) - dayNumberFromKey(prev.last) === 1) {
    streak = (prev.streak || 0) + 1; // consecutive day
  } else {
    streak = 1; // first solve, or a gap
  }
  const next = { last: day, streak, best: Math.max(prev.best || 0, streak) };
  lsSetJSON(STREAK_KEY, next);
  return next;
}

// Best mark a key has earned across all guesses (drives keyboard colouring).
const RANK = { correct: 3, present: 2, absent: 1, none: 0 };

export default function QuarterGame() {
  const day = useMemo(() => todayKey(), []);
  const answer = useMemo(() => answerFor(day), [day]);
  const qNum = useMemo(() => quarterNumber(day), [day]);
  const { submit } = useArcadeScore("quarter");

  const [state, setState] = useState(() => loadDayState(day));
  const [current, setCurrent] = useState("");
  const [toast, setToast] = useState(null);
  const [shake, setShake] = useState(false);
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const submittedRef = useRef(false);

  // Persist per-day progress whenever it changes.
  useEffect(() => { lsSetJSON(STATE_KEY, state); }, [state]);

  // Submit the "fewest guesses" score once, the first time we land on a solved
  // state (covers both a fresh win and a reload of an already-won day).
  useEffect(() => {
    if (state.done && state.won && !submittedRef.current) {
      submittedRef.current = true;
      submit(state.guesses.length); // dir:"asc" — fewer is better
    }
  }, [state.done, state.won, state.guesses.length, submit]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setShake(true);
    setTimeout(() => setShake(false), 420);
    setTimeout(() => setToast(null), 1400);
  }, []);

  const graded = useMemo(
    () => state.guesses.map((g) => ({ word: g, marks: grade(g, answer) })),
    [state.guesses, answer]
  );

  // Best status per letter for the keyboard.
  const keyStatus = useMemo(() => {
    const out = {};
    for (const { word, marks } of graded) {
      word.split("").forEach((ch, i) => {
        const m = marks[i];
        if (RANK[m] > RANK[out[ch] || "none"]) out[ch] = m;
      });
    }
    return out;
  }, [graded]);

  const submitGuess = useCallback(() => {
    if (state.done) return;
    if (current.length !== WORD_LEN) return flash("not enough letters");
    if (!isValidGuess(current)) return flash("not in word list");
    const guesses = [...state.guesses, current];
    const won = current === answer;
    const done = won || guesses.length >= MAX_GUESSES;
    setState({ day, guesses, done, won });
    setCurrent("");
    if (done) {
      const s = bumpStreak(day, won);
      setStreak(s);
      setTimeout(() => flash(won ? "🪙 nice quarter!" : `it was ${answer.toUpperCase()}`), 250);
    }
  }, [state, current, answer, day, flash]);

  const onKey = useCallback((k) => {
    if (state.done) return;
    if (k === "enter") return submitGuess();
    if (k === "back") return setCurrent((c) => c.slice(0, -1));
    if (/^[a-z]$/.test(k)) setCurrent((c) => (c.length < WORD_LEN ? c + k : c));
  }, [state.done, submitGuess]);

  // Physical keyboard.
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "enter") { e.preventDefault(); onKey("enter"); }
      else if (k === "backspace") { e.preventDefault(); onKey("back"); }
      else if (/^[a-z]$/.test(k)) { e.preventDefault(); onKey(k); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);

  const shareText = useMemo(
    () => shareGrid(day, graded.map((g) => g.marks), state.won),
    [day, graded, state.won]
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="qtr-app">
        <div className="qtr-head">
          <h1 className="qtr-title">🪙 THE DAILY QUARTER</h1>
          <div className="qtr-sub">
            #{qNum} · {prettyDate(day)}
            {streak.streak > 0 && <span className="qtr-streak"> · 🔥 {streak.streak}-day streak</span>}
          </div>
        </div>

        <div className={`qtr-board${shake ? " is-shake" : ""}`}>
          {[...Array(MAX_GUESSES)].map((_, r) => {
            const past = graded[r];
            const isCurrent = !state.done && r === state.guesses.length;
            return (
              <div className="qtr-row" key={r}>
                {ROW.map((_, c) => {
                  let ch = "", cls = "";
                  if (past) { ch = past.word[c].toUpperCase(); cls = past.marks[c]; }
                  else if (isCurrent && current[c]) { ch = current[c].toUpperCase(); cls = "filled"; }
                  return <div className={`qtr-tile ${cls}`} key={c}>{ch}</div>;
                })}
              </div>
            );
          })}
        </div>

        {toast && <div className="qtr-toast">{toast}</div>}

        {state.done ? (
          <div className="qtr-done">
            <p className="qtr-done-line">
              {state.won
                ? `Solved in ${state.guesses.length}/${MAX_GUESSES} 🪙`
                : `Out of tries — it was ${answer.toUpperCase()}`}
            </p>
            <pre className="qtr-grid">{shareText.split("\n").slice(1).join("\n")}</pre>
            <div className="qtr-actions">
              <ShareButton
                label="Share your Quarter"
                title="Ourcade — The Daily Quarter"
                text={shareText}
              />
            </div>
            <p className="qtr-next">a fresh Quarter drops at midnight, your time.</p>
          </div>
        ) : (
          <div className="qtr-kb">
            {KEYS.map((rowStr, i) => (
              <div className="qtr-kb-row" key={i}>
                {i === 2 && (
                  <button className="qtr-key qtr-key-wide" onClick={() => onKey("enter")}>ENTER</button>
                )}
                {rowStr.split("").map((ch) => (
                  <button
                    key={ch}
                    className={`qtr-key ${keyStatus[ch] || ""}`}
                    onClick={() => onKey(ch)}
                  >
                    {ch.toUpperCase()}
                  </button>
                ))}
                {i === 2 && (
                  <button className="qtr-key qtr-key-wide" onClick={() => onKey("back")}>⌫</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.qtr-app{min-height:100svh;background:radial-gradient(120% 120% at 50% 0%,#141029 0%,#08070f 60%);
  color:#f2ecff;display:flex;flex-direction:column;align-items:center;gap:14px;
  padding:64px 12px 28px;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box;}
.qtr-head{text-align:center}
.qtr-title{margin:0;font-family:'Press Start 2P','Black Ops One',monospace;font-size:1.05rem;
  letter-spacing:.04em;color:#ffd45e;text-shadow:0 0 18px rgba(255,212,94,.35)}
.qtr-sub{margin-top:8px;font-size:.82rem;color:#b9a8e6;font-family:'Share Tech Mono',monospace}
.qtr-streak{color:#ff9a52}
.qtr-board{display:grid;grid-template-rows:repeat(6,1fr);gap:7px;margin-top:6px}
.qtr-board.is-shake{animation:qtrShake .42s}
@keyframes qtrShake{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(5px)}50%{transform:translateX(-5px)}}
.qtr-row{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.qtr-tile{width:54px;height:54px;display:flex;align-items:center;justify-content:center;
  font-size:1.7rem;font-weight:800;text-transform:uppercase;border:2px solid #2c2740;
  border-radius:8px;background:#100d1c;color:#f2ecff;transition:transform .12s}
.qtr-tile.filled{border-color:#5a5078;transform:scale(1.04)}
.qtr-tile.correct{background:#3aa657;border-color:#3aa657;color:#fff}
.qtr-tile.present{background:#c9a227;border-color:#c9a227;color:#fff}
.qtr-tile.absent{background:#2a2740;border-color:#2a2740;color:#9a92b0}
.qtr-toast{background:#f2ecff;color:#100d1c;font-weight:700;padding:8px 16px;border-radius:8px;
  font-size:.85rem;box-shadow:0 6px 20px rgba(0,0,0,.4)}
.qtr-kb{display:flex;flex-direction:column;gap:7px;width:100%;max-width:484px;margin-top:4px}
.qtr-kb-row{display:flex;gap:5px;justify-content:center}
.qtr-key{flex:1;min-width:0;height:52px;border:0;border-radius:7px;background:#3a3357;color:#f2ecff;
  font-size:.95rem;font-weight:700;cursor:pointer;text-transform:uppercase;transition:background .1s}
.qtr-key:hover{background:#473e6b}
.qtr-key-wide{flex:1.6;font-size:.72rem}
.qtr-key.correct{background:#3aa657}
.qtr-key.present{background:#c9a227}
.qtr-key.absent{background:#211e30;color:#6f6885}
.qtr-done{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.qtr-done-line{margin:2px 0;font-size:1rem;font-weight:700;color:#ffd45e}
.qtr-grid{margin:0;font-size:1.15rem;line-height:1.2;letter-spacing:2px;font-family:monospace}
.qtr-actions{display:flex;gap:10px}
.qtr-next{margin:2px 0 0;font-size:.74rem;color:#8a82a4;font-family:'Share Tech Mono',monospace}
@media(max-width:380px){.qtr-tile{width:46px;height:46px;font-size:1.45rem}.qtr-key{height:46px}}
`;
