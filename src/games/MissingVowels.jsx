import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { useArcadeScore } from "../lib/scores.js";
import ShareButton from "../components/ShareButton.jsx";
import {
  puzzleFor, judge, vowelHint, shareLine, vowelsNumber,
} from "./missing-vowels/logic.js";

/* MISSING VOWELS — Ourcade's one-minute daily decode.

   A themed set of common words with the vowels stripped out (consonant skeleton).
   Type each word back in. Any common word matching a skeleton counts, not just the
   authored one. Same set for everyone; a streak for showing up; leaderboard by
   words restored.

   Mobile-first: a real <input> per row so the phone keyboard appears; the active
   row scrolls into view. All truth in missing-vowels/logic.js. */

const STATE_KEY = "vowels:state"; // { day, solved:{clue:word}, hints:[clue…] }
const STREAK_KEY = "vowels:streak";

function loadDayState(day) {
  const s = lsGetJSON(STATE_KEY, null);
  if (s && s.day === day && s.solved) return { day, solved: s.solved, hints: s.hints || [] };
  return { day, solved: {}, hints: [] };
}

function bumpStreak(day) {
  const prev = lsGetJSON(STREAK_KEY, null) || { last: null, streak: 0, best: 0 };
  if (prev.last === day) return prev;
  let streak;
  if (prev.last && dayNumberFromKey(day) - dayNumberFromKey(prev.last) === 1) streak = (prev.streak || 0) + 1;
  else streak = 1;
  const next = { last: day, streak, best: Math.max(prev.best || 0, streak) };
  lsSetJSON(STREAK_KEY, next);
  return next;
}

export default function MissingVowels() {
  const day = useMemo(() => todayKey(), []);
  const puzzle = useMemo(() => puzzleFor(day), [day]);
  const num = useMemo(() => vowelsNumber(day), [day]);
  const { submit } = useArcadeScore("missing-vowels");

  const [state, setState] = useState(() => loadDayState(day));
  const [entries, setEntries] = useState({}); // clue → current input text
  const [toast, setToast] = useState(null);
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const lastSubmitRef = useRef(-1);
  const streakedRef = useRef(false);

  const solvedCount = Object.keys(state.solved).length;

  useEffect(() => { lsSetJSON(STATE_KEY, state); }, [state]);

  // Submit words-restored as it grows; bump streak on the first solve.
  useEffect(() => {
    if (solvedCount > 0 && solvedCount !== lastSubmitRef.current) {
      lastSubmitRef.current = solvedCount;
      submit(solvedCount);
      if (!streakedRef.current) { streakedRef.current = true; setStreak(bumpStreak(day)); }
    }
  }, [solvedCount, submit, day]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1300);
  }, []);

  const tryWord = useCallback((item) => {
    if (state.solved[item.clue]) return;
    const guess = (entries[item.clue] || "").toUpperCase();
    if (!guess) return;
    const verdict = judge(guess, item.clue);
    if (verdict !== "ok") {
      flash(verdict === "notword" ? "not in the word list" : "doesn't fit the letters");
      return;
    }
    setState((s) => ({ ...s, solved: { ...s.solved, [item.clue]: guess } }));
    flash("✓ nice");
  }, [state.solved, entries, flash]);

  const useHint = useCallback((item) => {
    if (state.solved[item.clue]) return;
    const h = vowelHint(item);
    if (h) flash(`💡 has an ${h.ch}`);
    setState((s) => ({ ...s, hints: [...new Set([...s.hints, item.clue])] }));
  }, [state.solved, flash]);

  const share = useMemo(() => shareLine(day, solvedCount, puzzle), [day, solvedCount, puzzle]);
  const allDone = solvedCount === puzzle.items.length;

  return (
    <>
      <style>{CSS}</style>
      <div className="mvw-app" style={{ overscrollBehavior: "contain", WebkitTouchCallout: "none" }}>
        <div className="mvw-head">
          <h1 className="mvw-title">🔤 MISSING VOWELS</h1>
          <div className="mvw-sub">
            #{num} · {prettyDate(day)}
            {streak.streak > 0 && <span className="mvw-streak"> · 🔥 {streak.streak}-day streak</span>}
          </div>
        </div>

        <div className="mvw-theme">Theme · {puzzle.theme}</div>
        <div className="mvw-count">{solvedCount}/{puzzle.items.length} restored</div>

        <div className="mvw-list">
          {puzzle.items.map((item) => {
            const solved = state.solved[item.clue];
            const hinted = state.hints.includes(item.clue);
            const h = hinted ? vowelHint(item) : null;
            return (
              <div key={item.clue} className={`mvw-row${solved ? " is-solved" : ""}`}>
                <span className="mvw-clue">
                  {item.clue}
                  {h && !solved && <span className="mvw-hint-ch"> · {h.ch}?</span>}
                </span>
                {solved ? (
                  <span className="mvw-answer">{solved}</span>
                ) : (
                  <form
                    className="mvw-form"
                    onSubmit={(e) => { e.preventDefault(); tryWord(item); }}
                  >
                    <input
                      className="mvw-input"
                      value={entries[item.clue] || ""}
                      onChange={(e) =>
                        setEntries((m) => ({ ...m, [item.clue]: e.target.value.replace(/[^a-zA-Z]/g, "") }))
                      }
                      placeholder="type it…"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`Restore ${item.clue}`}
                    />
                    <button type="button" className="mvw-hint" onClick={() => useHint(item)} aria-label="Hint">💡</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        {toast && <div className="mvw-toast">{toast}</div>}

        <div className="mvw-actions">
          {allDone && <p className="mvw-done">🎉 all restored!</p>}
          <ShareButton label="Share your Missing Vowels" title="Ourcade — Missing Vowels" text={share} />
        </div>
        <p className="mvw-next">a fresh theme drops at midnight, your time.</p>
      </div>
    </>
  );
}

const CSS = `
.mvw-app{min-height:100svh;background:radial-gradient(120% 120% at 50% 0%,#1a1020 0%,#0d0710 60%);
  color:#f3e8ff;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:60px 12px 28px;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box}
.mvw-head{text-align:center}
.mvw-title{margin:0;font-family:'Press Start 2P','Black Ops One',monospace;font-size:.92rem;
  letter-spacing:.04em;color:#c77dff;text-shadow:0 0 18px rgba(199,125,255,.4)}
.mvw-sub{margin-top:8px;font-size:.78rem;color:#b39ac9;font-family:'Share Tech Mono',monospace}
.mvw-streak{color:#ff9a52}
.mvw-theme{font-family:'Press Start 2P',monospace;font-size:.66rem;color:#e0c3ff;letter-spacing:.04em}
.mvw-count{font-size:.74rem;color:#9c86b5;font-family:'Share Tech Mono',monospace}
.mvw-list{display:flex;flex-direction:column;gap:7px;width:100%;max-width:420px;margin-top:2px}
.mvw-row{display:flex;align-items:center;gap:10px;min-height:46px;padding:4px 10px 4px 12px;
  background:#1c1228;border:1px solid #382548;border-radius:11px;box-sizing:border-box}
.mvw-row.is-solved{border-color:#8b5cf6;background:#241736}
.mvw-clue{font-family:'Press Start 2P',monospace;font-size:.8rem;letter-spacing:.14em;color:#c77dff;
  min-width:88px}
.mvw-hint-ch{color:#7fe0c0;font-size:.62rem}
.mvw-answer{flex:1;font-size:1.05rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#f3e8ff}
.mvw-form{flex:1;display:flex;gap:6px;align-items:center}
.mvw-input{flex:1;height:38px;border:1px solid #382548;border-radius:8px;background:#120a1c;
  color:#f3e8ff;font-size:1rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  padding:0 10px;outline:none;box-sizing:border-box;min-width:0}
.mvw-input:focus{border-color:#c77dff}
.mvw-hint{width:38px;height:38px;border:0;border-radius:8px;background:#2a1b3d;cursor:pointer;font-size:1rem;padding:0}
.mvw-hint:active{background:#372350}
.mvw-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
  background:rgba(243,232,255,.95);color:#0d0710;font-weight:700;padding:7px 15px;border-radius:8px;
  font-size:.82rem;box-shadow:0 6px 20px rgba(0,0,0,.5);z-index:5}
.mvw-actions{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:6px}
.mvw-done{margin:0;font-family:'Press Start 2P',monospace;font-size:.72rem;color:#c77dff}
.mvw-next{margin:2px 0 0;font-size:.72rem;color:#7a6592;font-family:'Share Tech Mono',monospace}
@media(max-width:380px){ .mvw-clue{min-width:74px;font-size:.72rem} .mvw-answer{font-size:.95rem} }
`;
