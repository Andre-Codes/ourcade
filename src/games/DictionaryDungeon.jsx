import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON, lsRemove } from "../lib/store.js";
import { useArcadeScore } from "../lib/scores.js";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useQuitConfirm } from "../lib/useQuitConfirm.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import ShareButton from "../components/ShareButton.jsx";

/* DICTIONARY DUNGEON — a daily text roguelike where language is the weapon.

   Type valid words to satisfy each room's rule and damage what's in your way.
   Same dungeon for everyone each day (the shared ritual), plus a Practice run
   with a random seed and no leaderboard.

   Render-only cabinet: ALL run truth lives in dictionary-dungeon/logic.js (a
   node-pure module the headless validator drives too), so the game the browser
   plays is exactly the one scripts/dungeon-check.js proves solvable. The ~1.6 MB
   generated dictionary is behind a DYNAMIC import of the logic module, so it
   loads only when the game opens — never in the main bundle. Per-day run state
   persists under ourcade:dictionary-dungeon:save so a mid-run reload resumes. */

const GAME_ID = "dictionary-dungeon";
const SAVE_KEY = "dictionary-dungeon:save"; // { ...serializeGame(state), mode }
const LOG_DIVIDER = "---"; // sentinel line → renders as a stage divider (see renderLogLine)
const LOG_CAP = 80;

// Append a batch of log lines as a distinct "stage": prefix a divider (unless the
// log is empty) so each turn/scroll/event reads as its own block, then cap length.
function appendLog(prev, lines) {
  const batch = prev.length ? [LOG_DIVIDER, ...lines] : [...lines];
  return [...prev, ...batch].slice(-LOG_CAP);
}

// The logic module is loaded lazily (it pulls the big dictionary payload). We
// cache the promise so re-mounts don't re-import.
let _logicPromise = null;
function loadLogic() {
  if (!_logicPromise) _logicPromise = import("./dictionary-dungeon/logic.js");
  return _logicPromise;
}

export default function DictionaryDungeon() {
  const [logic, setLogic] = useState(null); // the loaded logic module
  const [state, setState] = useState(null); // live run state (null = title)
  const [log, setLog] = useState([]); // scrolling result log lines
  const [input, setInput] = useState("");
  const [toast, setToast] = useState(null);
  const [screen, setScreen] = useState("title"); // title | play | over
  const [hitFx, setHitFx] = useState(null); // transient enemy-card fx: "hit" | "slain"
  const [reveal, setReveal] = useState(null); // transient showcase card { kind, ... }
  const rootRef = useRef(null);
  const logRef = useRef(null);
  const revealSig = useRef(null); // last-shown encounter signature (dedupe reveals)
  const fxTimers = useRef([]); // pending setTimeouts (paced log / fx) to clear
  const quit = useQuitConfirm();
  const { submit } = useArcadeScore(GAME_ID);
  const day = todayKey();

  // Title screen shows the shell back-button; hide it during play.
  useArcadeBackButton(screen !== "play");

  // Lazy-load the logic (+ dictionary) on mount.
  useEffect(() => {
    let alive = true;
    loadLogic().then((m) => {
      if (alive) setLogic(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Resume an in-progress save once logic is ready — but ONLY on first load.
  // Without this guard, returning to the title (which sets state=null) would
  // re-trigger this effect and yank the player straight back into the run.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!logic || state || resumedRef.current) return;
    resumedRef.current = true;
    const saved = lsGetJSON(SAVE_KEY, null);
    const hydrated = saved && logic.hydrateGame(saved);
    if (hydrated) {
      // Only auto-resume a DAILY run that matches today; a stale daily is dropped.
      if (hydrated.mode === "practice" || hydrated.dayKey === day) {
        setState(hydrated);
        setScreen("play");
      } else {
        lsRemove(SAVE_KEY);
      }
    }
  }, [logic, state, day]);

  // Persist the run (or clear it when finished / on the title).
  useEffect(() => {
    if (!logic) return;
    if (state && logic.isSaveable(state)) {
      lsSetJSON(SAVE_KEY, logic.serializeGame(state));
    } else if (state && state.over) {
      lsRemove(SAVE_KEY);
    }
  }, [logic, state]);

  // Auto-scroll the log to the newest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // ── Lock the PAGE; make the cabinet its own scroller. ───────────────────────
  // The play screen is usually taller than the viewport (status + card + keyboard
  // + actions + log), so if we let the document scroll, every finger drag drags
  // the whole page — exactly the annoyance we're killing. Instead:
  //   1. While the game is mounted, freeze <html>/<body> (position:fixed, no
  //      document scroll) so nothing rubber-bands.
  //   2. `.dd-root` becomes the ONE scroll container (height:100dvh; overflow-y:
  //      auto), so it scrolls INTERNALLY only when content overflows (merchant/
  //      treasure panels), and the log scrolls within it.
  //   3. A non-passive touchmove guard on the root preventDefaults any drag that
  //      no inner scroller (the log) or the root itself can actually absorb — so a
  //      short screen never rubber-bands, but overflow content stays reachable.
  useEffect(() => {
    const { style: body } = document.body;
    const { style: html } = document.documentElement;
    const prev = {
      bodyOverflow: body.overflow, bodyPosition: body.position, bodyWidth: body.width,
      bodyHeight: body.height, bodyTop: body.top, htmlOverflow: html.overflow,
      htmlOverscroll: html.overscrollBehavior,
    };
    const scrollY = window.scrollY;
    body.overflow = "hidden";
    body.position = "fixed";
    body.top = `-${scrollY}px`;
    body.width = "100%";
    body.height = "100%";
    html.overflow = "hidden";
    html.overscrollBehavior = "none";
    return () => {
      body.overflow = prev.bodyOverflow;
      body.position = prev.bodyPosition;
      body.width = prev.bodyWidth;
      body.height = prev.bodyHeight;
      body.top = prev.bodyTop;
      html.overflow = prev.htmlOverflow;
      html.overscrollBehavior = prev.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    let startY = 0;
    const onStart = (e) => { startY = e.touches[0]?.clientY ?? 0; };
    // Does `el` scroll vertically, with room to move in `dir` (>0 down / <0 up)?
    const canAbsorb = (el, dir) => {
      const style = window.getComputedStyle(el);
      if (!/(auto|scroll)/.test(style.overflowY) || el.scrollHeight <= el.clientHeight) return false;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      return !((dir > 0 && atTop) || (dir < 0 && atBottom));
    };
    const onMove = (e) => {
      if (e.touches.length > 1) return; // pinch/zoom — leave alone
      const dy = (e.touches[0]?.clientY ?? 0) - startY; // >0 drag down, <0 drag up
      if (dy === 0) return;
      // Walk from the touch target UP TO AND INCLUDING the root. If any of them
      // (the log, or the root itself when panels overflow) can take the scroll,
      // let it happen natively.
      let el = e.target;
      while (el) {
        if (el.nodeType === 1 && canAbsorb(el, dy)) return;
        if (el === node) break;
        el = el.parentNode;
      }
      // Nothing can absorb the drag → it would only rubber-band. Block it.
      e.preventDefault();
    };
    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
    };
  }, []);

  // Clear any pending fx/log timers on unmount.
  useEffect(() => () => fxTimers.current.forEach(window.clearTimeout), []);

  // Showcase reveal cards: when the player reaches a NEW level, a NEW enemy, or a
  // boss shifts to a NEW phase, pop a card ("You've encountered a Cave Bat", its
  // HP + intent) before the fight. Purely presentational — driven off the current
  // target/level signature. The card PERSISTS until the player explicitly closes
  // it (tapping the backdrop does nothing); this keeps encounter info readable.
  useEffect(() => {
    if (screen !== "play" || !logic || !state) return;
    const lvl = logic.currentLevel(state);
    const target = logic.currentTarget(state);
    const isFirstRoom = state.roomIdx === 0 && !logic.isBossRoom(state);
    // Signature: what encounter are we looking at right now?
    const sig = [
      lvl?.id,
      state.levelIdx,
      logic.isBossRoom(state) ? `boss:${state.bossPhase}` : `room:${state.roomIdx}`,
      target?.name || "none",
    ].join("|");
    if (sig === revealSig.current) return; // already shown this encounter
    revealSig.current = sig;

    // Decide what (if anything) to showcase. New level entry wins; else a new
    // enemy or a new boss phase. Non-combat rooms (gate/treasure/merchant/event)
    // still get a level-entry card on the first room but no enemy card otherwise.
    let next = null;
    if (isFirstRoom) {
      next = { kind: "level", name: lvl?.name, tone: lvl?.tone };
    } else if (target?.kind === "boss") {
      next = {
        kind: "phase", name: target.name, emoji: target.emoji,
        hp: target.hp, maxHP: target.maxHP, intent: target.intent,
        phase: target.phase + 1, phaseCount: target.phaseCount,
      };
    } else if (target && (target.kind === "monster" || target.kind === "trap")) {
      next = {
        kind: "enemy", name: target.name, emoji: target.emoji,
        hp: target.hp, maxHP: target.maxHP, intent: target.intent,
      };
    }
    if (!next) { setReveal(null); return; }
    setReveal(next);
  }, [screen, logic, state]);
  const dismissReveal = useCallback(() => setReveal(null), []);

  // Flash a toast for a moment.
  const flash = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const startRun = useCallback(
    (mode) => {
      if (!logic) return;
      const s = logic.buildRun(mode === "daily" ? day : null);
      setState(s);
      const lvl = logic.currentLevel(s);
      setLog([`> ${lvl?.rooms?.[0]?.intro || "You descend into the dungeon."}`]);
      setInput("");
      setHitFx(null);
      setReveal(null);
      revealSig.current = null; // let the first room re-trigger a level reveal
      setScreen("play");
    },
    [logic, day]
  );

  const onSubmit = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (!logic || !state || state.over) return;
      const word = input.trim();
      if (!word) return;
      // Clear any pending paced-log / fx timers from a previous fast turn.
      fxTimers.current.forEach(window.clearTimeout);
      fxTimers.current = [];
      // resolveTurn mutates a copy; deep-ish clone the parts it touches. The run
      // is plain data, so a structuredClone keeps it simple and correct.
      const working = structuredClone(state);
      const res = logic.resolveTurn(working, word);
      setInput("");

      // A kill or boss-phase change should READ, not flash by. Split the log so
      // the hit + damage lines land immediately (the HP bar drains, the enemy
      // card pulses), then the "it crumbles" / "shifts" resolution lines follow
      // a beat later. `resolveTurn` always emits the resolution flavor AFTER the
      // "N damage." line, so we split on the last damage line.
      const paced = res.accepted && (res.cleared || res.bossPhaseChanged);
      if (paced) {
        const lines = res.logLines;
        let cut = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (/\d+ damage\./.test(lines[i])) { cut = i; break; }
        }
        const hitLines = cut >= 0 ? lines.slice(0, cut + 1) : lines;
        const afterLines = cut >= 0 ? lines.slice(cut + 1) : [];
        setState(working);
        setLog((prev) => appendLog(prev, hitLines));
        setHitFx(res.cleared ? "slain" : "hit");
        if (afterLines.length) {
          // The resolution lines belong to the SAME stage as the hit — append
          // them without a fresh divider (plain concat, still capped).
          fxTimers.current.push(
            window.setTimeout(() => setLog((prev) => [...prev, ...afterLines].slice(-LOG_CAP)), 560)
          );
        }
        fxTimers.current.push(window.setTimeout(() => setHitFx(null), 620));
      } else {
        setState(working);
        setLog((prev) => appendLog(prev, res.logLines));
        if (res.accepted && res.damage > 0) {
          setHitFx("hit");
          fxTimers.current.push(window.setTimeout(() => setHitFx(null), 260));
        }
      }

      if (!res.accepted) {
        flash(
          res.reason === "invalid"
            ? "Not a word"
            : res.reason === "repeat"
              ? "Already used this run"
              : "Breaks the room's rule"
        );
      }
      if (working.over) {
        // Let the paced resolution lines land before the over-screen swap.
        fxTimers.current.push(window.setTimeout(() => finishRun(working), paced ? 950 : 650));
      }
    },
    [logic, state, input, flash]
  );

  // On-screen keyboard: feed key taps into the same input the form uses. Letters
  // append (cap 16), ⌫ pops, ENTER submits. A physical-keyboard bridge (below)
  // routes real keystrokes here too, so desktop typing still works.
  const onKey = useCallback(
    (k) => {
      if (k === "enter") { onSubmit(); return; }
      if (k === "back") { setInput((v) => v.slice(0, -1)); return; }
      if (/^[a-z]$/i.test(k)) setInput((v) => (v.length >= 16 ? v : v + k.toUpperCase()));
    },
    [onSubmit]
  );

  // Physical-keyboard bridge: route real keystrokes into the on-screen keyboard
  // handler so desktop typing works even though there's no focusable <input>.
  // Only active during a live run (not on title/over screens).
  useEffect(() => {
    if (screen !== "play") return;
    const onDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") { e.preventDefault(); onKey("enter"); }
      else if (e.key === "Backspace") { e.preventDefault(); onKey("back"); }
      else if (/^[a-z]$/i.test(e.key)) onKey(e.key);
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [screen, onKey]);

  const finishRun = useCallback(
    (finalState) => {
      setScreen("over");
      if (finalState.mode === "daily") {
        submit(logic.runScore(finalState));
      }
    },
    [logic, submit]
  );

  const onUseScroll = useCallback(
    (scrollId) => {
      if (!logic || !state) return;
      const working = structuredClone(state);
      const r = logic.useScroll(working, scrollId);
      if (r.ok) {
        setState(working);
        setLog((prev) => appendLog(prev, [`> ${r.message}`]));
      } else {
        flash(r.message);
      }
    },
    [logic, state, flash]
  );

  const onTakeRelic = useCallback(
    (relicId) => {
      if (!logic || !state) return;
      const working = structuredClone(state);
      const r = logic.takeRelic(working, relicId);
      if (r.ok) {
        setState(working);
        setLog((prev) => appendLog(prev, r.logLines || []));
      }
    },
    [logic, state]
  );

  const onBuy = useCallback(
    (offerIdx) => {
      if (!logic || !state) return;
      const working = structuredClone(state);
      const r = logic.buyItem(working, offerIdx);
      if (r.ok) {
        setState(working);
        setLog((prev) => appendLog(prev, [`> ${r.message}`]));
      } else {
        flash(r.message);
      }
    },
    [logic, state, flash]
  );

  const onLeaveMerchant = useCallback(() => {
    if (!logic || !state) return;
    const working = structuredClone(state);
    const r = logic.leaveMerchant(working);
    if (r.ok) {
      setState(working);
      setLog((prev) => appendLog(prev, r.logLines || []));
    }
  }, [logic, state]);

  const onEvent = useCallback(
    (choiceIdx) => {
      if (!logic || !state) return;
      const working = structuredClone(state);
      const r = logic.resolveEvent(working, choiceIdx);
      if (r.ok) {
        setState(working);
        setLog((prev) => appendLog(prev, r.logLines || []));
        if (working.over) setTimeout(() => finishRun(working), 650);
      } else if (r.message) {
        flash(r.message);
      }
    },
    [logic, state, flash]
  );

  // Endless: descend one deeper floor after a clear.
  const onDescend = useCallback(() => {
    if (!logic || !state) return;
    const working = structuredClone(state);
    const r = logic.descend(working);
    setState(working);
    setLog((prev) => appendLog(prev, r.logLines || []));
    setInput("");
    setHitFx(null);
  }, [logic, state]);

  // Endless: bank the score and end the run here.
  const onEndHere = useCallback(() => {
    if (!logic || !state) return;
    const working = structuredClone(state);
    logic.endRun(working);
    setState(working);
    finishRun(working);
  }, [logic, state, finishRun]);

  const goTitle = useCallback(() => {
    quit.request(
      () => {
        setState(null);
        setScreen("title");
        setLog([]);
      },
      { armed: !!state && !state.over }
    );
  }, [quit, state]);

  // ── render ──────────────────────────────────────────────────────────────────
  if (!logic) {
    return (
      <div className="dd-root" ref={rootRef}>
        <style>{CSS}</style>
        <div className="dd-loading">Opening the lexicon…</div>
      </div>
    );
  }

  return (
    <div className="dd-root" ref={rootRef}>
      <style>{CSS}</style>
      {screen === "title" && <Title logic={logic} day={day} onStart={startRun} />}
      {screen === "play" && state && (
        <Play
          logic={logic}
          state={state}
          log={log}
          input={input}
          onKey={onKey}
          onUseScroll={onUseScroll}
          onTakeRelic={onTakeRelic}
          onBuy={onBuy}
          onLeaveMerchant={onLeaveMerchant}
          onEvent={onEvent}
          onQuit={goTitle}
          toast={toast}
          hitFx={hitFx}
          logRef={logRef}
        />
      )}
      {screen === "play" && state && reveal && !state.canDescend && (
        <Reveal reveal={reveal} onDismiss={dismissReveal} />
      )}
      {screen === "play" && state && state.canDescend && !state.over && (
        <Descend logic={logic} state={state} onDescend={onDescend} onEndHere={onEndHere} />
      )}
      {screen === "over" && state && (
        <Over logic={logic} state={state} onAgain={() => setScreen("title") || setState(null)} />
      )}
      <ConfirmDialog
        open={quit.open}
        title="Leave the dungeon?"
        message="Your run is saved — you can resume it later today."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onConfirm={quit.confirm}
        onCancel={quit.cancel}
      />
    </div>
  );
}

// ── title ─────────────────────────────────────────────────────────────────────
function Title({ logic, day, onStart }) {
  const n = logic.dungeonNumber(day);
  return (
    <div className="dd-title">
      <div className="dd-crest">📖</div>
      <h1 className="dd-name">Dictionary Dungeon</h1>
      <p className="dd-tag">A text roguelike where language is the weapon.</p>
      <div className="dd-daily-card">
        <div className="dd-daily-num">Dungeon #{n}</div>
        <div className="dd-daily-sub">Same run for everyone today · resets tomorrow</div>
      </div>
      <button className="dd-btn dd-btn-primary" onClick={() => onStart("daily")}>
        Enter Today's Dungeon
      </button>
      <button className="dd-btn dd-btn-ghost" onClick={() => onStart("practice")}>
        Practice (random, no score)
      </button>
      <ul className="dd-help">
        <li>Type any real word that satisfies the room's rule.</li>
        <li>Longer, rarer words hit harder. Some words have hidden power.</li>
        <li>A ⚔️ word cuts flesh; 🔥 burns; ✝️ smites the undead. Match your word to the foe.</li>
        <li>A 🛡️ word (SHIELD, PARRY, BLOCK…) turns aside the next blow — then needs a few turns to ready again.</li>
        <li>Lose all ❤ and the run ends. Clear the Lich… then descend deeper.</li>
      </ul>
    </div>
  );
}

// ── play ──────────────────────────────────────────────────────────────────────
function Play({ logic, state, log, input, onKey, onUseScroll, onTakeRelic, onBuy, onLeaveMerchant, onEvent, onQuit, toast, hitFx, logRef }) {
  const lvl = logic.currentLevel(state);
  const target = logic.currentTarget(state);
  const rule = logic.activeRule(state);
  const prog = logic.runProgress(state);
  const choice = logic.isChoiceRoom(state);
  const merchant = logic.isMerchantRoom(state);
  const event = logic.isEventRoom(state);
  const special = choice || merchant || event; // non-word rooms
  const room = logic.currentRoom(state);
  const boss = target?.kind === "boss";
  const hpPct = target && target.hp != null ? Math.max(0, (target.hp / target.maxHP) * 100) : 0;

  const accent = lvl?.accent || "#d9b45e";

  return (
    <div className="dd-play" style={{ "--accent": accent }}>
      {/* status bar */}
      <div className="dd-status">
        <span className="dd-stat">❤ <b>{state.hearts}</b>/{state.maxHearts}</span>
        <span className="dd-stat">🪙 <b>{state.coins}</b></span>
        <span className="dd-stat">Floor <b>{logic.floorLabel(state)}</b></span>
        <div className="dd-meter"><div className="dd-meter-fill" style={{ width: `${prog.pct * 100}%` }} /></div>
        <button className="dd-x" onClick={onQuit} aria-label="Leave">✕</button>
      </div>

      {/* persistent RPG title earned from the first word (cosmetic nameplate) */}
      {state.title?.title && (
        <div className="dd-title-banner">
          <span className="dd-title-mark">✦</span>
          <span className="dd-title-text">{state.title.title}</span>
        </div>
      )}

      {/* room card */}
      <div className="dd-card">
        <div className="dd-room-title">
          {lvl?.name}{boss ? " — Boss" : room ? ` — Room ${state.roomIdx + 1}` : ""}
        </div>
        <div className="dd-scene">{lvl?.tone && `A place of ${lvl.tone}.`}</div>

        {target?.name && (
          <div className={`dd-enemy${hitFx ? ` dd-enemy-${hitFx}` : ""}`}>
            <div className="dd-enemy-row">
              <span className="dd-enemy-emoji">{target.emoji}</span>
              <span className="dd-enemy-name">{target.name}</span>
              {boss && <span className="dd-phase">phase {target.phase + 1}/{target.phaseCount}</span>}
            </div>
            {target.hp != null && (
              <>
                <div className="dd-hp-label">HP {target.hp} / {target.maxHP}</div>
                <div className="dd-hpbar"><div className="dd-hpbar-fill" style={{ width: `${hpPct}%` }} /></div>
              </>
            )}
            {target.intent && <div className="dd-intent">Intent: {target.intent}</div>}
          </div>
        )}

        {/* event body OR the parchment rule box (word rooms only) */}
        {event ? (
          <div className="dd-event-body">{room.event.bodyText}</div>
        ) : merchant ? (
          <div className="dd-scene">A hooded merchant spreads their wares. Spend your coin.</div>
        ) : (
          <div className="dd-rule">{rule.displayText}</div>
        )}
      </div>

      {/* treasure / merchant / event panels OR word input */}
      {choice ? (
        <div className="dd-treasure">
          <div className="dd-treasure-head">You uncover a cache of forgotten relics — take one.</div>
          <div className="dd-relic-choices">
            {room.relicChoices.map((id) => {
              const r = relicMeta(logic, id);
              return (
                <button key={id} className="dd-relic-card" onClick={() => onTakeRelic(id)}>
                  <div className="dd-relic-emoji">{r?.emoji}</div>
                  <div className="dd-relic-name">{r?.name}</div>
                  <div className="dd-relic-desc">{r?.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : merchant ? (
        <div className="dd-treasure">
          <div className="dd-treasure-head">🛒 Merchant · 🪙 {state.coins}</div>
          <div className="dd-relic-choices">
            {room.offers.map((o, i) => {
              const afford = state.coins >= o.price && !o.sold;
              return (
                <button
                  key={o.id + i}
                  className="dd-relic-card dd-shop-card"
                  disabled={!afford}
                  onClick={() => onBuy(i)}
                >
                  <div className="dd-relic-emoji">{o.emoji}</div>
                  <div className="dd-relic-name">{o.name} <span className="dd-price">{o.sold ? "SOLD" : `🪙 ${o.price}`}</span></div>
                  <div className="dd-relic-desc">{o.description}</div>
                </button>
              );
            })}
          </div>
          <button className="dd-btn dd-btn-ghost dd-leave" onClick={onLeaveMerchant}>Leave shop</button>
        </div>
      ) : event ? (
        <div className="dd-treasure">
          <div className="dd-relic-choices">
            {room.event.choices.map((c, i) => {
              const gated = c.requires?.coins != null && state.coins < c.requires.coins;
              return (
                <button key={i} className="dd-relic-card" disabled={gated} onClick={() => onEvent(i)}>
                  <div className="dd-relic-name">{c.label}{gated ? ` (need 🪙 ${c.requires.coins})` : ""}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="dd-entry">
          {/* current word — read-only so no device keyboard pops up over the UI */}
          <div className={`dd-word${input ? "" : " dd-word-empty"}`} aria-live="polite">
            {input || "Your word…"}
          </div>
          <Keyboard onKey={onKey} />
        </div>
      )}

      {/* action buttons — only in word rooms. ENTER lives here now (the primary
          "cast the word" CTA), next to the Scrolls / Relics menus. */}
      {!special && (
        <div className="dd-actions">
          <button type="button" className="dd-act dd-act-enter" onClick={() => onKey("enter")}>ENTER</button>
          <ScrollMenu logic={logic} scrolls={state.scrolls} onUse={onUseScroll} />
          <RelicMenu logic={logic} relics={state.relics} />
        </div>
      )}

      {/* result log */}
      <div className="dd-log" ref={logRef}>
        {log.map((line, i) => (
          <div key={i} className="dd-logline">{renderLogLine(line)}</div>
        ))}
      </div>

      {toast && <div className="dd-toast">{toast}</div>}
    </div>
  );
}

// On-screen QWERTY. Taps route through onKey (same handler the physical keyboard
// bridges into). Kept in-cabinet so no device keyboard pops up to shift/cover
// the UI. Pattern mirrors QuarterGame.jsx. ENTER lives in the actions row (see
// Play); the keyboard's row-3 trailing slot is the ⌫ backspace.
const KB_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
function Keyboard({ onKey }) {
  return (
    <div className="dd-kb">
      {KB_ROWS.map((row, i) => (
        <div className="dd-kb-row" key={i}>
          {row.split("").map((ch) => (
            <button type="button" key={ch} className="dd-key" onClick={() => onKey(ch)}>{ch.toUpperCase()}</button>
          ))}
          {i === 2 && (
            <button type="button" className="dd-key dd-key-wide" onClick={() => onKey("back")} aria-label="Backspace">⌫</button>
          )}
        </div>
      ))}
    </div>
  );
}

// Colorize known tokens in a log line at render time (the logic layer still
// emits plain strings). Any line that matches nothing renders verbatim. Tokens,
// in priority order: the "✦ …" secret/title lines, damage numbers, the played
// word, heals, and coins.
const LOG_TOKEN = new RegExp(
  [
    "(?<secret>^> ✦.*$)", // whole starting-secret / title line
    "(?<dmg>\\d+ damage)",
    "(?<played>(?<=played )[A-Z]{2,}|(?<=plays )[A-Z]{2,})",
    "(?<heal>recover \\d+ heart[s]?|❤ ?\\d+|❤)",
    "(?<coin>\\+\\d+ coins|🪙 ?\\d+)",
  ].join("|"),
  "gu"
);
function renderLogLine(line) {
  const text = String(line);
  // Stage divider between distinct turns/actions.
  if (text === LOG_DIVIDER) return <hr className="dd-log-div" />;
  // The whole-line secret/title styling is simplest handled up front.
  if (/^> ✦/.test(text)) return <span className="dd-log-secret">{text}</span>;
  const out = [];
  let last = 0;
  let m;
  LOG_TOKEN.lastIndex = 0;
  while ((m = LOG_TOKEN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const g = m.groups || {};
    const cls = g.dmg ? "dd-log-dmg" : g.played ? "dd-log-word" : g.heal ? "dd-log-heal" : g.coin ? "dd-log-coin" : null;
    out.push(cls ? <span key={m.index} className={cls}>{m[0]}</span> : m[0]);
    last = m.index + m[0].length;
    if (m[0].length === 0) LOG_TOKEN.lastIndex++; // guard against zero-width
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ScrollMenu({ logic, scrolls, onUse }) {
  const [open, setOpen] = useState(false);
  if (!scrolls?.length) return <button className="dd-act" disabled>📜 No scrolls</button>;
  return (
    <div className="dd-menu">
      <button className="dd-act" onClick={() => setOpen((o) => !o)}>📜 Scrolls ({scrolls.length})</button>
      {open && (
        <div className="dd-pop">
          {scrolls.map((id, i) => {
            const s = scrollMeta(logic, id);
            return (
              <button key={id + i} className="dd-pop-item" onClick={() => { onUse(id); setOpen(false); }}>
                <b>{s?.emoji} {s?.name}</b>
                <span>{s?.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RelicMenu({ logic, relics }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dd-menu">
      <button className="dd-act" onClick={() => setOpen((o) => !o)}>💠 Relics ({relics.length})</button>
      {open && (
        <div className="dd-pop dd-pop-right">
          {relics.length === 0 && <div className="dd-pop-empty">No relics yet.</div>}
          {relics.map((id, i) => {
            const r = relicMeta(logic, id);
            return (
              <div key={id + i} className="dd-pop-item static">
                <b>{r?.emoji} {r?.name}</b>
                <span>{r?.description}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── reveal (showcase card for new levels / enemies / boss phases) ─────────────
// An overlay that pops in and PERSISTS until the player taps Continue. Tapping the
// backdrop does nothing (so an accidental tap can't skip the encounter info).
// Purely presentational.
function Reveal({ reveal, onDismiss }) {
  const isEnemy = reveal.kind === "enemy" || reveal.kind === "phase";
  return (
    <div className="dd-reveal-overlay">
      <div className={`dd-reveal-card dd-reveal-${reveal.kind}`}>
        {reveal.kind === "level" && (
          <>
            <div className="dd-reveal-kicker">You descend into</div>
            <div className="dd-reveal-name">{reveal.name}</div>
            {reveal.tone && <div className="dd-reveal-tone">A place of {reveal.tone}.</div>}
          </>
        )}
        {isEnemy && (
          <>
            <div className="dd-reveal-kicker">
              {reveal.kind === "phase"
                ? `${reveal.name} shifts — Phase ${reveal.phase}/${reveal.phaseCount}`
                : `You've encountered a`}
            </div>
            <div className="dd-reveal-emoji">{reveal.emoji}</div>
            {reveal.kind === "enemy" && <div className="dd-reveal-name">{reveal.name}</div>}
            {reveal.hp != null && <div className="dd-reveal-hp">HP {reveal.hp} / {reveal.maxHP}</div>}
            {reveal.intent && <div className="dd-reveal-intent">Intent: {reveal.intent}</div>}
          </>
        )}
        <button className="dd-btn dd-btn-primary dd-reveal-go" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}

// ── descend (endless prompt after a clear) ────────────────────────────────────
// Shown when the last level is cleared. The FIRST clear (the fixed Lich) reads as
// the triumphant win; deeper clears are survival milestones. Either way: descend
// into a harder floor, or bank the score and end here.
function Descend({ logic, state, onDescend, onEndHere }) {
  const depth = state.descentCycle || 0;
  const firstWin = depth === 0; // just beat the base dungeon
  const score = logic.runScore(state);
  return (
    <div className="dd-descend-overlay">
      <div className="dd-descend">
        <div className="dd-descend-crest">{firstWin ? "🏆" : "🕳️"}</div>
        <h2 className="dd-descend-title">
          {firstWin ? "You cleared the Unabridged Lich!" : `Depth ${depth} survived`}
        </h2>
        <p className="dd-descend-sub">
          {firstWin
            ? "The dungeon is beaten — but the pages don't end. There is always a deeper shelf."
            : "The dark keeps unfolding. How far can you read?"}
        </p>
        <div className="dd-descend-score">{score.toLocaleString()}</div>
        <div className="dd-descend-actions">
          <button className="dd-btn dd-btn-primary" onClick={onDescend}>Descend Deeper ↓</button>
          <button className="dd-btn dd-btn-ghost" onClick={onEndHere}>
            {firstWin ? "Take the win (bank score)" : "Stop here (bank score)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── over ──────────────────────────────────────────────────────────────────────
function Over({ logic, state, onAgain }) {
  const recap = logic.runRecap(state);
  const share = logic.shareLine(state);
  return (
    <div className="dd-over">
      <div className="dd-over-crest">{recap.depth > 0 ? "🕳️" : recap.won ? "🏆" : "💀"}</div>
      <h2 className="dd-over-title">
        {recap.depth > 0
          ? `Cleared the dungeon — fell at Depth ${recap.depth}`
          : recap.won ? "You cleared the dungeon!" : "You fell in the dark."}
      </h2>
      {recap.title && <p className="dd-over-named">✦ {recap.title}</p>}
      {recap.deathCause && (recap.depth > 0 || !recap.won) && <p className="dd-over-cause">{recap.deathCause}.</p>}
      <div className="dd-over-score">{recap.score.toLocaleString()}</div>
      <div className="dd-over-grid">
        <Stat label="Floor reached" value={recap.floor} />
        <Stat label="Hearts left" value={`❤ ${recap.hearts}`} />
        <Stat label="Coins" value={`🪙 ${recap.coins}`} />
        <Stat label="Words played" value={recap.words} />
        <Stat label="Best word" value={recap.best || "—"} />
        <Stat label="Rarest word" value={recap.rarest || "—"} />
      </div>
      {recap.badges?.length > 0 && (
        <div className="dd-over-relics">
          {recap.badges.map((b, i) => (
            <span key={i} className="dd-over-relic dd-over-badge">✦ {b.name}</span>
          ))}
        </div>
      )}
      {recap.relics.length > 0 && (
        <div className="dd-over-relics">
          {recap.relics.map((id) => {
            const r = relicMeta(logic, id);
            return <span key={id} className="dd-over-relic" title={r?.description}>{r?.emoji} {r?.name}</span>;
          })}
        </div>
      )}
      <div className="dd-over-actions">
        <ShareButton title="Dictionary Dungeon" text={share} label="Share result" />
        <button className="dd-btn dd-btn-ghost" onClick={onAgain}>Back to menu</button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="dd-statcard">
      <div className="dd-statcard-v">{value}</div>
      <div className="dd-statcard-l">{label}</div>
    </div>
  );
}

// ── metadata lookups (logic exports the pools indirectly) ─────────────────────
// logic re-exports nothing pool-shaped by default, so resolve names via the
// serialized ids using small maps the logic module attaches at import.
function relicMeta(logic, id) {
  return (logic.RELIC_BY_ID || {})[id] || { id, name: id, emoji: "💠", description: "" };
}
function scrollMeta(logic, id) {
  return (logic.SCROLL_BY_ID || {})[id] || { id, name: id, emoji: "📜", description: "" };
}

// ── styles ────────────────────────────────────────────────────────────────────
const CSS = `
.dd-root {
  --stone: #12100e; --stone2: #1c1814; --gold: #d9b45e; --parch: #e8dcc0;
  color: #e7ddc9; font-family: 'Georgia', 'Times New Roman', serif;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(120,90,40,.18), transparent 60%),
    linear-gradient(180deg, #17130f 0%, #0d0b09 100%);
  padding: 16px; display: flex; flex-direction: column; align-items: center;
  /* The cabinet is the ONE scroll container: it fills the viewport and scrolls
     internally only when content overflows (merchant/treasure panels). The page
     behind it is frozen (see the body-lock effect), so finger drags never
     rubber-band; the touchmove guard blocks drags nothing here can absorb. */
  height: 100vh; height: 100dvh; overflow-y: auto; -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain; touch-action: pan-y;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.dd-loading { padding: 60px 0; color: var(--gold); letter-spacing: .1em; font-size: .95rem; opacity: .8; }

/* title */
.dd-title { max-width: 460px; width: 100%; text-align: center; padding-top: 10px; }
.dd-crest { font-size: 2.6rem; }
.dd-name { font-size: 1.9rem; margin: 4px 0 2px; color: var(--gold); letter-spacing: .04em;
  text-shadow: 0 2px 10px rgba(217,180,94,.25); font-variant: small-caps; }
.dd-tag { opacity: .78; margin: 0 0 16px; font-style: italic; }
.dd-daily-card { border: 1px solid rgba(217,180,94,.35); border-radius: 12px; padding: 12px;
  background: linear-gradient(180deg, rgba(217,180,94,.08), rgba(0,0,0,.2)); margin-bottom: 16px; }
.dd-daily-num { font-size: 1.15rem; color: var(--gold); letter-spacing: .06em; }
.dd-daily-sub { font-size: .8rem; opacity: .7; margin-top: 2px; }
.dd-btn { display: block; width: 100%; padding: 13px; margin: 8px 0; border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 1rem; letter-spacing: .04em; border: 1px solid transparent; transition: transform .08s, filter .15s; }
.dd-btn:active { transform: translateY(1px); }
.dd-btn-primary { background: linear-gradient(180deg, #e5c069, #b8892f); color: #221703;
  border-color: rgba(255,240,200,.4); font-weight: 700; box-shadow: 0 6px 20px rgba(184,137,47,.3); }
.dd-btn-primary:hover { filter: brightness(1.06); }
.dd-btn-ghost { background: rgba(255,255,255,.04); color: #d8ccae; border-color: rgba(217,180,94,.3); }
.dd-help { text-align: left; margin: 18px auto 0; padding: 0 0 0 18px; max-width: 400px; opacity: .78; font-size: .86rem; line-height: 1.6; }
.dd-help li { margin: 5px 0; }

/* play */
.dd-play { max-width: 500px; width: 100%; overflow-x: hidden; }
.dd-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: .85rem;
  padding: 8px 4px; border-bottom: 1px solid rgba(217,180,94,.2); margin-bottom: 10px; }
.dd-stat b { color: var(--gold); }
.dd-meter { flex: 1; min-width: 60px; height: 6px; background: rgba(255,255,255,.08); border-radius: 4px; overflow: hidden; }
.dd-meter-fill { height: 100%; background: linear-gradient(90deg, #8f6bb0, var(--accent, var(--gold))); transition: width .35s; }
.dd-x { background: none; border: none; color: #a99; font-size: 1rem; cursor: pointer; padding: 2px 6px; }
.dd-x:hover { color: #fff; }

.dd-card { border: 1px solid rgba(217,180,94,.28); border-radius: 14px; padding: 14px;
  background: linear-gradient(180deg, rgba(30,24,18,.9), rgba(14,11,9,.9));
  box-shadow: inset 0 0 40px rgba(0,0,0,.4); margin-bottom: 12px;
  /* Fixed footprint so entering a no-enemy room doesn't shift everything below
     it vs a fight (title + scene + enemy block + HP bar + intent + rule box). */
  min-height: 210px; position: relative; }
.dd-room-title { font-size: 1.25rem; color: var(--accent, var(--gold)); text-align: center;
  font-variant: small-caps; letter-spacing: .04em; margin-bottom: 4px; }
.dd-scene { text-align: center; font-style: italic; opacity: .7; font-size: .88rem; margin-bottom: 10px; }
.dd-enemy { border-top: 1px solid rgba(255,255,255,.08); padding-top: 10px; }
.dd-enemy-row { display: flex; align-items: center; gap: 8px; }
.dd-enemy-emoji { font-size: 1.4rem; }
.dd-enemy-name { font-size: 1.05rem; color: #f0e4c8; }
.dd-phase { margin-left: auto; font-size: .72rem; opacity: .65; letter-spacing: .05em; }
.dd-hp-label { font-size: .78rem; opacity: .75; margin: 6px 0 3px; }
.dd-hpbar { height: 9px; background: rgba(255,255,255,.09); border-radius: 5px; overflow: hidden; }
.dd-hpbar-fill { height: 100%; background: linear-gradient(90deg, #c0392b, #e05a4a); transition: width .35s; }
.dd-intent { font-size: .8rem; opacity: .7; margin-top: 6px; font-style: italic; }
/* hit / kill feedback on the enemy card */
.dd-enemy-hit { animation: ddHit .26s ease-out; }
.dd-enemy-slain { animation: ddSlain .6s ease-out; }
@keyframes ddHit {
  0% { transform: translateX(0); }
  25% { transform: translateX(-4px); } 55% { transform: translateX(5px); }
  80% { transform: translateX(-2px); } 100% { transform: translateX(0); }
}
@keyframes ddSlain {
  0% { transform: scale(1); filter: none; opacity: 1; }
  30% { transform: scale(1.03); filter: brightness(1.8) saturate(0); }
  100% { transform: scale(.96); filter: grayscale(1) brightness(.6); opacity: .55; }
}

/* showcase reveal cards (new level / enemy / boss phase) */
.dd-reveal-overlay { position: fixed; inset: 0; z-index: 25; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: radial-gradient(120% 90% at 50% 40%, rgba(14,10,7,.7), rgba(6,5,4,.86));
  animation: ddRevealFade .3s ease-out; }
.dd-reveal-card { min-width: 220px; max-width: 360px; text-align: center; padding: 22px 22px 20px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(34,27,19,.98), rgba(16,12,9,.98));
  border: 1px solid rgba(217,180,94,.45); box-shadow: 0 18px 60px rgba(0,0,0,.65), inset 0 0 40px rgba(0,0,0,.4);
  animation: ddReveal .45s cubic-bezier(.2,1.4,.5,1) both; }
.dd-reveal-kicker { font-size: .82rem; letter-spacing: .08em; text-transform: uppercase; opacity: .7; color: var(--parch); }
.dd-reveal-name { font-size: 1.5rem; color: var(--gold); font-variant: small-caps; letter-spacing: .03em; margin: 4px 0;
  text-shadow: 0 2px 12px rgba(217,180,94,.3); }
.dd-reveal-tone { font-style: italic; opacity: .75; font-size: .9rem; margin-top: 4px; }
.dd-reveal-emoji { font-size: 3rem; margin: 8px 0 4px; animation: ddRevealPop .5s ease-out both; }
.dd-reveal-hp { font-size: .9rem; opacity: .85; margin-top: 4px; color: #e8a99c; }
.dd-reveal-intent { font-size: .85rem; opacity: .75; font-style: italic; margin-top: 6px; }
.dd-reveal-go { margin-top: 16px; }
@keyframes ddReveal {
  0% { transform: scale(.7); opacity: 0; }
  60% { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes ddRevealFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ddRevealPop {
  0% { transform: scale(0) rotate(-12deg); }
  70% { transform: scale(1.15) rotate(4deg); }
  100% { transform: scale(1) rotate(0); }
}
@media (prefers-reduced-motion: reduce) {
  .dd-reveal-card, .dd-reveal-emoji, .dd-descend-overlay { animation-duration: .12s; }
}

/* persistent RPG title nameplate */
.dd-title-banner { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 0 0 10px;
  padding: 5px 12px; border-radius: 20px; align-self: center; width: fit-content; max-width: 100%;
  background: linear-gradient(180deg, rgba(217,180,94,.16), rgba(217,180,94,.05));
  border: 1px solid rgba(217,180,94,.4); box-shadow: 0 2px 10px rgba(0,0,0,.3); }
.dd-title-mark { color: var(--gold); font-size: .8rem; }
.dd-title-text { color: #f0e4c8; font-variant: small-caps; letter-spacing: .06em; font-size: .95rem; font-weight: 600;
  text-shadow: 0 1px 6px rgba(217,180,94,.3); }

.dd-rule { margin-top: 12px; padding: 12px 14px; text-align: center; font-size: 1rem;
  color: #2a2013; border-radius: 8px;
  background: linear-gradient(180deg, #ece0c4, #d8c9a4); border: 1px solid #b8a67e;
  box-shadow: 0 3px 12px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.4); font-weight: 600; }

/* word entry + on-screen keyboard */
.dd-entry { margin-bottom: 10px; }
.dd-word { min-height: 42px; padding: 8px 14px; border-radius: 10px; font-size: 1.25rem; letter-spacing: .14em;
  text-transform: uppercase; text-align: center; font-family: inherit; color: #f4ecd8; user-select: none;
  background: rgba(0,0,0,.35); border: 1px solid rgba(217,180,94,.4); margin-bottom: 8px;
  display: flex; align-items: center; justify-content: center; min-width: 0; overflow: hidden; }
.dd-word-empty { color: rgba(244,236,216,.35); letter-spacing: .08em; text-transform: none; font-style: italic; }
.dd-kb { display: flex; flex-direction: column; gap: 6px; }
.dd-kb-row { display: flex; gap: 5px; justify-content: center; }
.dd-key { flex: 1; min-width: 0; height: 46px; border-radius: 7px; cursor: pointer; font-family: inherit;
  font-size: .98rem; font-weight: 700; color: #ecdfbe; border: 1px solid rgba(217,180,94,.28);
  background: linear-gradient(180deg, rgba(70,58,40,.7), rgba(40,32,22,.7)); transition: filter .1s, transform .06s; }
.dd-key:hover { filter: brightness(1.15); }
.dd-key:active { transform: translateY(1px); filter: brightness(.95); }
.dd-key-wide { flex: 1.5; font-size: .74rem; letter-spacing: .04em; }
.dd-key-enter { color: #221703; border-color: rgba(255,240,200,.4); background: linear-gradient(180deg, #e5c069, #b8892f); }

.dd-treasure { margin-bottom: 12px; }
.dd-treasure-head { text-align: center; color: var(--gold); margin-bottom: 8px; letter-spacing: .04em; }
.dd-relic-choices { display: grid; gap: 8px; }
.dd-relic-card { text-align: left; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-family: inherit;
  background: rgba(217,180,94,.06); border: 1px solid rgba(217,180,94,.3); color: #e7ddc9; }
.dd-relic-card:hover { background: rgba(217,180,94,.14); }
.dd-relic-emoji { font-size: 1.2rem; }
.dd-relic-name { color: var(--gold); font-weight: 700; margin: 2px 0; }
.dd-relic-desc { font-size: .82rem; opacity: .8; }
.dd-relic-card:disabled { opacity: .45; cursor: default; }
.dd-shop-card { display: flex; flex-direction: column; }
.dd-price { float: right; font-size: .82rem; color: #e7ddc9; font-weight: 400; }
.dd-leave { margin-top: 4px; }
.dd-event-body { margin-top: 12px; padding: 12px 14px; font-style: italic; line-height: 1.6;
  color: #e7ddc9; border-left: 3px solid var(--accent, var(--gold)); background: rgba(255,255,255,.03);
  border-radius: 0 8px 8px 0; }

.dd-actions { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; position: relative; }
.dd-act { flex: 1; min-width: 90px; padding: 9px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: .82rem;
  background: rgba(255,255,255,.05); border: 1px solid rgba(217,180,94,.25); color: #d8ccae; }
.dd-act:disabled { opacity: .4; cursor: default; }
.dd-act:not(:disabled):hover { background: rgba(217,180,94,.12); }
/* ENTER — the primary "cast the word" CTA, moved out of the keyboard. */
.dd-act-enter { color: #221703; font-weight: 700; letter-spacing: .06em;
  border-color: rgba(255,240,200,.4); background: linear-gradient(180deg, #e5c069, #b8892f); }
.dd-act-enter:not(:disabled):hover { filter: brightness(1.06); background: linear-gradient(180deg, #e5c069, #b8892f); }
.dd-menu { flex: 1; min-width: 90px; position: relative; }
.dd-menu .dd-act { width: 100%; }
.dd-pop { position: absolute; bottom: calc(100% + 6px); left: 0; right: 0; z-index: 5;
  min-width: 220px; max-width: min(320px, 90vw);
  background: #1a1611; border: 1px solid rgba(217,180,94,.4); border-radius: 10px; padding: 6px;
  box-shadow: 0 10px 30px rgba(0,0,0,.6); max-height: 240px; overflow-y: auto; overflow-x: hidden; }
/* Relics is the rightmost menu; a left-anchored min-width popup would spill past
   the viewport's right edge and shift the whole page. Anchor it to the right. */
.dd-pop-right { left: auto; right: 0; }
.dd-pop-item { display: block; width: 100%; min-width: 0; text-align: left; padding: 8px; border-radius: 7px;
  cursor: pointer; background: none; border: none; color: #e7ddc9; font-family: inherit; }
.dd-pop-item.static { cursor: default; }
.dd-pop-item:not(.static):hover { background: rgba(217,180,94,.12); }
.dd-pop-item b { display: block; color: var(--gold); font-size: .85rem; word-break: break-word; }
.dd-pop-item span { display: block; font-size: .76rem; opacity: .78; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
.dd-pop-empty { padding: 8px; opacity: .6; font-size: .82rem; }

.dd-log { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.07); border-radius: 10px;
  padding: 10px 12px; height: 168px; overflow-y: auto; font-family: 'Courier New', monospace;
  font-size: .84rem; line-height: 1.55; color: #cdbf9f; }
.dd-logline { margin: 1px 0; white-space: pre-wrap; word-break: break-word; }
.dd-log-div { border: none; border-top: 1px dashed rgba(217,180,94,.28); margin: 6px 0; }
.dd-log-dmg { color: #ef6a5a; font-weight: 700; }
.dd-log-word { color: var(--gold); font-weight: 700; letter-spacing: .04em; }
.dd-log-heal { color: #7fce7f; font-weight: 700; }
.dd-log-coin { color: #ecc25a; font-weight: 700; }
.dd-log-secret { color: #d9b6e8; font-style: italic; }

.dd-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 20;
  background: #2a2013; color: var(--parch); padding: 9px 18px; border-radius: 20px;
  border: 1px solid rgba(217,180,94,.45); font-size: .88rem; box-shadow: 0 6px 24px rgba(0,0,0,.5); }

/* descend (endless prompt) — overlay over the play screen */
.dd-descend-overlay { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: radial-gradient(120% 90% at 50% 30%, rgba(20,14,10,.82), rgba(6,5,4,.94));
  animation: ddReveal .35s ease-out; }
.dd-descend { max-width: 420px; width: 100%; text-align: center; padding: 22px 18px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(30,24,18,.96), rgba(14,11,9,.96));
  border: 1px solid rgba(217,180,94,.4); box-shadow: 0 16px 50px rgba(0,0,0,.6); }
.dd-descend-crest { font-size: 2.6rem; }
.dd-descend-title { font-size: 1.3rem; color: var(--gold); margin: 6px 0 4px; font-variant: small-caps; letter-spacing: .03em; }
.dd-descend-sub { opacity: .8; font-style: italic; margin: 0 0 12px; font-size: .9rem; line-height: 1.5; }
.dd-descend-score { font-size: 2rem; color: #f0e4c8; font-weight: 700; letter-spacing: .03em; margin-bottom: 14px; }
.dd-descend-actions { display: flex; flex-direction: column; gap: 8px; }

/* over */
.dd-over { max-width: 460px; width: 100%; text-align: center; padding-top: 8px; }
.dd-over-crest { font-size: 3rem; }
.dd-over-title { font-size: 1.4rem; color: var(--gold); margin: 4px 0 6px; font-variant: small-caps; }
.dd-over-cause { opacity: .7; font-style: italic; margin: 0 0 8px; }
.dd-over-named { color: var(--gold); font-variant: small-caps; letter-spacing: .06em; font-size: 1.05rem;
  margin: 0 0 8px; text-shadow: 0 1px 8px rgba(217,180,94,.3); }
.dd-over-score { font-size: 2.6rem; color: #f0e4c8; font-weight: 700; letter-spacing: .03em; }
.dd-over-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0; }
.dd-statcard { background: rgba(255,255,255,.04); border: 1px solid rgba(217,180,94,.2); border-radius: 9px; padding: 10px 6px; }
.dd-statcard-v { font-size: 1rem; color: #f0e4c8; word-break: break-word; }
.dd-statcard-l { font-size: .7rem; opacity: .65; margin-top: 3px; letter-spacing: .02em; }
.dd-over-relics { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 16px; }
.dd-over-relic { font-size: .78rem; padding: 5px 9px; border-radius: 14px; background: rgba(217,180,94,.1);
  border: 1px solid rgba(217,180,94,.3); }
.dd-over-badge { background: rgba(217,182,232,.1); border-color: rgba(217,182,232,.35); color: #e6d3f0; }
.dd-over-actions { display: flex; flex-direction: column; gap: 8px; align-items: center; }

@media (max-width: 380px) {
  .dd-key { height: 42px; font-size: .9rem; }
  .dd-kb { gap: 5px; }
  .dd-kb-row { gap: 4px; }
  .dd-word { font-size: 1.1rem; min-height: 38px; padding: 6px 12px; }
}
`;
