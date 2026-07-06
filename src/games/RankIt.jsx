import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { useArcadeScore } from "../lib/scores.js";
import ShareButton from "../components/ShareButton.jsx";
import {
  puzzleFor, displayWords, scoreOrder, shareLine, rankitNumber,
} from "./rankit/logic.js";

/* RANK IT — Ourcade's daily "how common is it?" word game.

   Five common words a day; drag them into their true order of commonness
   (most-used → least-used in English). Only possible because our curated list
   (google-10000-english) is FREQUENCY-ORDERED, so the answer is objective. One
   lock-in per day, Wordle-style, then the true order is revealed with per-slot
   colour and a spoiler-free share row.

   Mobile-first: the whole surface is touch-locked (touch-action:none + a
   non-passive touchmove guard) so a vertical drag reorders a row and NEVER
   scrolls the page — the same discipline as Game2048.jsx. Reordering also works
   without a drag via ▲/▼ chevrons and the keyboard, for phones-with-a-glitch and
   a11y. All puzzle truth lives in rankit/logic.js. */

const STATE_KEY = "rankit:state"; // { day, order:[word…], locked:bool }
const STREAK_KEY = "rankit:streak"; // { last:dayKey, streak, best }

function loadDayState(day, initialOrder) {
  const s = lsGetJSON(STATE_KEY, null);
  if (s && s.day === day && Array.isArray(s.order)) {
    return { day, order: s.order, locked: !!s.locked };
  }
  return { day, order: initialOrder, locked: false };
}

// Streak bumps on the day you LOCK IN (mirrors Spelldown's first-action bump).
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

const ROW_H = 56; // px — row height + gap, used for drag math

export default function RankIt() {
  const day = useMemo(() => todayKey(), []);
  const puzzle = useMemo(() => puzzleFor(day), [day]);
  const num = useMemo(() => rankitNumber(day), [day]);
  const initialOrder = useMemo(() => displayWords(puzzle, day), [puzzle, day]);
  const { submit } = useArcadeScore("rank-it");

  const [state, setState] = useState(() => loadDayState(day, initialOrder));
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const [focusIdx, setFocusIdx] = useState(0);
  const wrapRef = useRef(null);

  const order = state.order;
  const locked = state.locked;
  const result = useMemo(() => (locked ? scoreOrder(order, puzzle) : null), [locked, order, puzzle]);

  // Persist on every change.
  useEffect(() => { lsSetJSON(STATE_KEY, state); }, [state]);

  // Belt-and-suspenders: a non-passive touchmove guard so a drag never
  // rubber-band-scrolls the page on iOS Safari (touch-action:none alone isn't
  // enough there). Mirrors Game2048.jsx.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const stop = (e) => { if (draggingRef.current) e.preventDefault(); };
    node.addEventListener("touchmove", stop, { passive: false });
    return () => node.removeEventListener("touchmove", stop);
  }, []);

  const moveRow = useCallback((from, to) => {
    if (locked) return;
    setState((s) => {
      if (to < 0 || to >= s.order.length || to === from) return s;
      const next = s.order.slice();
      const [w] = next.splice(from, 1);
      next.splice(to, 0, w);
      return { ...s, order: next };
    });
  }, [locked]);

  // ── pointer-capture drag reorder ────────────────────────────────────────────
  const draggingRef = useRef(false);
  const [drag, setDrag] = useState(null); // { idx, startY, dy }
  const dragRef = useRef(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);

  const onRowPointerDown = useCallback((e, idx) => {
    if (locked) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    setFocusIdx(idx);
    setDrag({ idx, startY: e.clientY, dy: 0 });
  }, [locked]);

  const onRowPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    // How many row-slots have we crossed?
    const shift = Math.round(dy / ROW_H);
    const target = Math.max(0, Math.min(order.length - 1, d.idx + shift));
    if (target !== d.idx) {
      moveRow(d.idx, target);
      setDrag({ idx: target, startY: e.clientY, dy: 0 });
    } else {
      setDrag({ ...d, dy });
    }
  }, [moveRow, order.length]);

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    setDrag(null);
  }, []);

  const lockIn = useCallback(() => {
    if (locked) return;
    const scored = scoreOrder(order, puzzle);
    submit(scored.score);
    setStreak(bumpStreak(day));
    setState((s) => ({ ...s, locked: true }));
  }, [locked, order, puzzle, submit, day]);

  const share = useMemo(
    () => (locked ? shareLine(day, order, puzzle) : ""),
    [locked, day, order, puzzle]
  );

  // Keyboard: ↑/↓ move focus; with Shift (or Space held) reorder the focused row.
  useEffect(() => {
    const onKey = (e) => {
      if (locked) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (e.shiftKey) { moveRow(focusIdx, focusIdx - 1); setFocusIdx((i) => Math.max(0, i - 1)); }
        else setFocusIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (e.shiftKey) { moveRow(focusIdx, focusIdx + 1); setFocusIdx((i) => Math.min(order.length - 1, i + 1)); }
        else setFocusIdx((i) => Math.min(order.length - 1, i + 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        lockIn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, focusIdx, order.length, moveRow, lockIn]);

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={wrapRef}
        className="rki-app"
        style={{
          touchAction: "none",
          overscrollBehavior: "contain",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        <div className="rki-head">
          <h1 className="rki-title">📊 RANK IT</h1>
          <div className="rki-sub">
            #{num} · {prettyDate(day)}
            {streak.streak > 0 && <span className="rki-streak"> · 🔥 {streak.streak}-day streak</span>}
          </div>
        </div>

        <p className="rki-prompt">
          {locked ? "The true order, most → least common:" : "Drag into order — most common at the top."}
        </p>

        <div className="rki-scale">
          <span>▲ most used</span><span>least used ▼</span>
        </div>

        <div className="rki-list">
          {order.map((w, i) => {
            const isDrag = drag && drag.idx === i;
            const mark = result ? result.marks[i] : null;
            return (
              <div
                key={w}
                className={`rki-row${isDrag ? " is-drag" : ""}${focusIdx === i && !locked ? " is-focus" : ""}${mark ? ` is-${mark}` : ""}`}
                style={isDrag && drag.dy ? { transform: `translateY(${drag.dy}px)` } : undefined}
                onPointerDown={locked ? undefined : (e) => onRowPointerDown(e, i)}
                onPointerMove={locked ? undefined : onRowPointerMove}
                onPointerUp={locked ? undefined : endDrag}
                onPointerCancel={locked ? undefined : endDrag}
              >
                <span className="rki-num">{i + 1}</span>
                <span className="rki-word">{w}</span>
                {locked ? (
                  <span className="rki-mark">{mark === "exact" ? "✓" : "•"}</span>
                ) : (
                  <span className="rki-handle" aria-hidden="true">
                    <button
                      type="button"
                      className="rki-chev"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => moveRow(i, i - 1)}
                      aria-label={`Move ${w} up`}
                    >▲</button>
                    <button
                      type="button"
                      className="rki-chev"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => moveRow(i, i + 1)}
                      aria-label={`Move ${w} down`}
                    >▼</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {!locked ? (
          <button type="button" className="rki-lock" onClick={lockIn}>LOCK IN</button>
        ) : (
          <div className="rki-result">
            <div className="rki-score">
              <span className="rki-score-n">{result.score}</span>
              <span className="rki-score-l">/100 · {result.exact}/{order.length} in place</span>
            </div>
            <div className="rki-actions">
              <ShareButton label="Share your Rank It" title="Ourcade — Rank It" text={share} />
            </div>
          </div>
        )}

        <p className="rki-next">a fresh five drops at midnight, your time.</p>
      </div>
    </>
  );
}

const CSS = `
.rki-app{min-height:100svh;background:radial-gradient(120% 120% at 50% 0%,#0b1420 0%,#060a10 60%);
  color:#eaf2ff;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:60px 12px 28px;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box}
.rki-head{text-align:center}
.rki-title{margin:0;font-family:'Press Start 2P','Black Ops One',monospace;font-size:1.05rem;
  letter-spacing:.04em;color:#5ac8fa;text-shadow:0 0 18px rgba(90,200,250,.4)}
.rki-sub{margin-top:8px;font-size:.8rem;color:#8aa4c8;font-family:'Share Tech Mono',monospace}
.rki-streak{color:#ff9a52}
.rki-prompt{margin:2px 0 0;font-size:.86rem;color:#cfe0f5;text-align:center;max-width:420px}
.rki-scale{width:100%;max-width:420px;display:flex;justify-content:space-between;
  font-size:.66rem;color:#6f89ad;font-family:'Share Tech Mono',monospace;letter-spacing:.02em}
.rki-list{width:100%;max-width:420px;display:flex;flex-direction:column;gap:8px}
.rki-row{display:flex;align-items:center;gap:10px;height:48px;padding:0 10px 0 12px;
  background:#12202f;border:1px solid #23374d;border-radius:12px;box-sizing:border-box;
  touch-action:none;cursor:grab;transition:background .12s,border-color .12s,transform .06s}
.rki-row.is-focus{border-color:#5ac8fa}
.rki-row.is-drag{cursor:grabbing;background:#183049;border-color:#5ac8fa;
  box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:3;position:relative}
.rki-row.is-exact{background:#12301f;border-color:#34c759}
.rki-row.is-off{background:#301a1a;border-color:#ff6b6b}
.rki-num{font-family:'Press Start 2P',monospace;font-size:.72rem;color:#5ac8fa;min-width:20px;text-align:center}
.rki-row.is-exact .rki-num{color:#34c759}
.rki-row.is-off .rki-num{color:#ff8a8a}
.rki-word{flex:1;font-size:1.05rem;font-weight:800;letter-spacing:.02em;text-transform:uppercase}
.rki-mark{font-size:1rem;color:#8aa4c8}
.rki-row.is-exact .rki-mark{color:#34c759}
.rki-handle{display:flex;flex-direction:column;gap:2px}
.rki-chev{width:34px;height:22px;border:0;border-radius:6px;background:#20344a;color:#bcd3ee;
  font-size:.7rem;line-height:1;cursor:pointer;padding:0;touch-action:manipulation}
.rki-chev:active{background:#2b4a68}
.rki-lock{margin-top:6px;height:50px;padding:0 30px;border:0;border-radius:12px;
  background:linear-gradient(180deg,#7fd7ff,#5ac8fa);color:#06121f;font-family:'Press Start 2P',monospace;
  font-size:.72rem;letter-spacing:.04em;cursor:pointer;box-shadow:0 6px 18px rgba(90,200,250,.35)}
.rki-lock:active{transform:translateY(1px)}
.rki-result{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:4px}
.rki-score{display:flex;align-items:baseline;gap:6px}
.rki-score-n{font-family:'Press Start 2P',monospace;font-size:1.6rem;color:#5ac8fa}
.rki-score-l{font-size:.82rem;color:#8aa4c8;font-family:'Share Tech Mono',monospace}
.rki-actions{display:flex;gap:10px}
.rki-next{margin:2px 0 0;font-size:.72rem;color:#5b7194;font-family:'Share Tech Mono',monospace}
@media(max-width:380px){
  .rki-word{font-size:.95rem}
  .rki-row{height:46px}
}
`;
