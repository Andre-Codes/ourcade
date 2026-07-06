import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";
import { useArcadeScore } from "../lib/scores.js";
import { encodeScore, fmtClock } from "../lib/scoretime.js";
import { useStopwatch } from "../lib/useStopwatch.js";
import ShareButton from "../components/ShareButton.jsx";
import {
  puzzleFor, judge, nextLetter, shareLine, chainNumber,
} from "./chain/logic.js";

/* CHAIN — Ourcade's daily last-first word chain.

   Each word must start with the LAST letter of the previous one, be a common word,
   and not repeat. Build the longest chain you can from the day's seed; beat par.
   Same seed for everyone; a streak for showing up; leaderboard by chain length.

   Mobile-first: a real <input> so the phone keyboard appears; the chain scrolls
   while the entry stays put. All truth in chain/logic.js. */

const STATE_KEY = "chain:state"; // { day, chain:[word…], startedAt }
const STREAK_KEY = "chain:streak";

function loadDayState(day, seed) {
  const s = lsGetJSON(STATE_KEY, null);
  if (s && s.day === day && Array.isArray(s.chain) && s.chain.length) {
    return { day, chain: s.chain, startedAt: s.startedAt || null };
  }
  return { day, chain: [seed], startedAt: null };
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

const TOAST = {
  badstart: "must start with the last letter",
  notword: "not in the word list",
  already: "already used that word",
};

export default function Chain() {
  const day = useMemo(() => todayKey(), []);
  const puzzle = useMemo(() => puzzleFor(day), [day]);
  const num = useMemo(() => chainNumber(day), [day]);
  const { submit } = useArcadeScore("chain");

  const [state, setState] = useState(() => loadDayState(day, puzzle.seed));
  const [entry, setEntry] = useState("");
  const [toast, setToast] = useState(null);
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const lastSubmitRef = useRef(-1);
  const streakedRef = useRef(false);

  const chain = state.chain;
  const links = chain.length - 1;
  const last = chain[chain.length - 1];
  const need = nextLetter(last);

  useEffect(() => { lsSetJSON(STATE_KEY, state); }, [state]);

  // Live clock — starts on the first word, runs while the cabinet is open (Chain
  // has no finish line, so time is only a tiebreaker between equal-length runs).
  const liveSecs = useStopwatch(state.startedAt, true);

  // Submit chain length + time-to-reach-it as it grows; longer wins, and among
  // equal lengths the faster builder ranks higher (encoded for the "desc" board).
  // Bump streak on the first added link.
  useEffect(() => {
    if (links > 0 && links !== lastSubmitRef.current) {
      lastSubmitRef.current = links;
      const secs = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
      submit(encodeScore(links, secs, "desc"));
      if (!streakedRef.current) { streakedRef.current = true; setStreak(bumpStreak(day)); }
    }
  }, [links, submit, day, state.startedAt]);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  }, []);

  const addWord = useCallback((raw) => {
    const w = (raw || "").trim().toUpperCase();
    if (!w) return;
    const verdict = judge(w, last, chain);
    if (verdict !== "ok") { flash(TOAST[verdict] || "nope"); return; }
    setState((s) => ({ ...s, chain: [...s.chain, w], startedAt: s.startedAt || Date.now() }));
    setEntry("");
  }, [last, chain, flash]);

  const undo = useCallback(() => {
    setState((s) => (s.chain.length > 1 ? { ...s, chain: s.chain.slice(0, -1) } : s));
    setEntry("");
  }, []);

  const onSubmit = useCallback((e) => { e.preventDefault(); addWord(entry); }, [addWord, entry]);

  const share = useMemo(() => shareLine(day, links, puzzle), [day, links, puzzle]);
  const beatPar = links >= puzzle.par;

  return (
    <>
      <style>{CSS}</style>
      <div className="chn-app" style={{ overscrollBehavior: "contain", WebkitTouchCallout: "none" }}>
        <div className="chn-head">
          <h1 className="chn-title">🔗 CHAIN</h1>
          <div className="chn-sub">
            #{num} · {prettyDate(day)}
            {streak.streak > 0 && <span className="chn-streak"> · 🔥 {streak.streak}-day streak</span>}
          </div>
        </div>

        <div className="chn-goal">
          <span>from <b>{puzzle.seed}</b></span>
          <span className={`chn-par${beatPar ? " beat" : ""}`}>{links}/{puzzle.par} links{beatPar ? " ✓" : ""}</span>
          {state.startedAt && <span className="chn-clock">⏱ {fmtClock(liveSecs)}</span>}
        </div>

        <div className="chn-list">
          {chain.map((w, i) => (
            <div key={w + i} className={`chn-word${i === 0 ? " is-seed" : ""}`}>
              <span className="chn-n">{i === 0 ? "•" : i}</span>
              <span className="chn-w">{w}</span>
            </div>
          ))}
        </div>

        <form className="chn-entry" onSubmit={onSubmit}>
          <span className="chn-need" aria-label={`Next word starts with ${need}`}>{need}…</span>
          <input
            className="chn-input"
            value={entry}
            onChange={(e) => setEntry(e.target.value.replace(/[^a-zA-Z]/g, ""))}
            placeholder={`start with ${need}`}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-label="Next word"
          />
          <button type="submit" className="chn-add">ADD</button>
        </form>
        <div className="chn-controls">
          <button type="button" className="chn-btn" onClick={undo} disabled={chain.length <= 1}>⌫ undo</button>
        </div>
        {toast && <div className="chn-toast">{toast}</div>}

        <div className="chn-actions">
          <ShareButton label="Share your Chain" title="Ourcade — Chain" text={share} />
        </div>
        <p className="chn-next">a fresh seed drops at midnight, your time.</p>
      </div>
    </>
  );
}

const CSS = `
.chn-app{min-height:100svh;background:radial-gradient(120% 120% at 50% 0%,#101c1e 0%,#07100f 60%);
  color:#e6f7f4;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:60px 12px 28px;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box}
.chn-head{text-align:center}
.chn-title{margin:0;font-family:'Press Start 2P','Black Ops One',monospace;font-size:1rem;
  letter-spacing:.04em;color:#39d6c4;text-shadow:0 0 18px rgba(57,214,196,.4)}
.chn-sub{margin-top:8px;font-size:.78rem;color:#88bdb6;font-family:'Share Tech Mono',monospace}
.chn-streak{color:#ff9a52}
.chn-goal{display:flex;align-items:center;gap:14px;font-size:.86rem;color:#cdeae6}
.chn-goal b{color:#e6f7f4;letter-spacing:.06em}
.chn-par{font-family:'Share Tech Mono',monospace;font-size:.76rem;color:#7faea8}
.chn-par.beat{color:#39d6c4;font-weight:700}
.chn-clock{font-family:'Share Tech Mono',monospace;font-size:.74rem;color:#39d6c4;letter-spacing:.02em}
.chn-list{display:flex;flex-direction:column;gap:5px;width:100%;max-width:320px;
  max-height:40vh;overflow-y:auto;padding:2px}
.chn-word{display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;
  background:#0f2321;border:1px solid #1e4340;border-radius:10px}
.chn-word.is-seed{border-color:#39d6c4;background:#123430;box-shadow:0 0 12px rgba(57,214,196,.25)}
.chn-n{font-family:'Press Start 2P',monospace;font-size:.6rem;color:#39d6c4;min-width:16px;text-align:center}
.chn-w{font-size:1.05rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.chn-entry{display:flex;gap:8px;width:100%;max-width:320px;align-items:center;margin-top:2px}
.chn-need{font-family:'Press Start 2P',monospace;font-size:.8rem;color:#39d6c4;min-width:34px}
.chn-input{flex:1;height:46px;border:2px solid #1e4340;border-radius:10px;background:#0a1817;
  color:#e6f7f4;font-size:1.1rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  padding:0 12px;outline:none;box-sizing:border-box;min-width:0}
.chn-input:focus{border-color:#39d6c4}
.chn-add{height:46px;padding:0 16px;border:0;border-radius:10px;background:#39d6c4;color:#07100f;
  font-family:'Press Start 2P',monospace;font-size:.62rem;cursor:pointer}
.chn-add:active{transform:translateY(1px)}
.chn-controls{display:flex;gap:8px}
.chn-btn{height:38px;padding:0 16px;border:0;border-radius:9px;background:#123230;color:#c6e8e3;
  font-size:.82rem;font-weight:700;cursor:pointer}
.chn-btn:disabled{opacity:.4;cursor:default}
.chn-btn:active:not(:disabled){background:#1a4642}
.chn-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
  background:rgba(230,247,244,.95);color:#07100f;font-weight:700;padding:7px 15px;border-radius:8px;
  font-size:.82rem;box-shadow:0 6px 20px rgba(0,0,0,.5);z-index:5}
.chn-actions{display:flex;gap:10px;margin-top:6px}
.chn-next{margin:2px 0 0;font-size:.72rem;color:#5f827c;font-family:'Share Tech Mono',monospace}
@media(max-width:380px){ .chn-w{font-size:.95rem} .chn-input{font-size:1rem} }
`;
