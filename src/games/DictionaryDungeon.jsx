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
  const logRef = useRef(null);
  const inputRef = useRef(null);
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
      setScreen("play");
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [logic, day]
  );

  const onSubmit = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (!logic || !state || state.over) return;
      const word = input.trim();
      if (!word) return;
      const next = { ...state };
      // resolveTurn mutates a copy; deep-ish clone the parts it touches. The run
      // is plain data, so a structuredClone keeps it simple and correct.
      const working = structuredClone(state);
      const res = logic.resolveTurn(working, word);
      setState(working);
      setLog((prev) => [...prev, ...res.logLines].slice(-80));
      setInput("");
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
        setTimeout(() => finishRun(working), 650);
      }
      setTimeout(() => inputRef.current?.focus(), 20);
    },
    [logic, state, input, flash]
  );

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
        setLog((prev) => [...prev, `> ${r.message}`].slice(-80));
      } else {
        flash(r.message);
      }
      setTimeout(() => inputRef.current?.focus(), 20);
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
        setLog((prev) => [...prev, ...(r.logLines || [])].slice(-80));
      }
      setTimeout(() => inputRef.current?.focus(), 20);
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
        setLog((prev) => [...prev, `> ${r.message}`].slice(-80));
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
      setLog((prev) => [...prev, ...(r.logLines || [])].slice(-80));
    }
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [logic, state]);

  const onEvent = useCallback(
    (choiceIdx) => {
      if (!logic || !state) return;
      const working = structuredClone(state);
      const r = logic.resolveEvent(working, choiceIdx);
      if (r.ok) {
        setState(working);
        setLog((prev) => [...prev, ...(r.logLines || [])].slice(-80));
        if (working.over) setTimeout(() => finishRun(working), 650);
      } else if (r.message) {
        flash(r.message);
      }
      setTimeout(() => inputRef.current?.focus(), 20);
    },
    [logic, state, flash]
  );

  const onHint = useCallback(() => {
    if (!logic || !state) return;
    const start = logic.hintStarter(state);
    flash(start ? `Try a word starting with ${start}` : "No easy hint here");
  }, [logic, state, flash]);

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
      <div className="dd-root">
        <style>{CSS}</style>
        <div className="dd-loading">Opening the lexicon…</div>
      </div>
    );
  }

  return (
    <div className="dd-root">
      <style>{CSS}</style>
      {screen === "title" && <Title logic={logic} day={day} onStart={startRun} />}
      {screen === "play" && state && (
        <Play
          logic={logic}
          state={state}
          log={log}
          input={input}
          setInput={setInput}
          onSubmit={onSubmit}
          onUseScroll={onUseScroll}
          onTakeRelic={onTakeRelic}
          onBuy={onBuy}
          onLeaveMerchant={onLeaveMerchant}
          onEvent={onEvent}
          onHint={onHint}
          onQuit={goTitle}
          toast={toast}
          logRef={logRef}
          inputRef={inputRef}
        />
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
        <li>Lose all ❤ and the run ends. Clear the Lich to win.</li>
      </ul>
    </div>
  );
}

// ── play ──────────────────────────────────────────────────────────────────────
function Play({ logic, state, log, input, setInput, onSubmit, onUseScroll, onTakeRelic, onBuy, onLeaveMerchant, onEvent, onHint, onQuit, toast, logRef, inputRef }) {
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

      {/* room card */}
      <div className="dd-card">
        <div className="dd-room-title">
          {lvl?.name}{boss ? " — Boss" : room ? ` — Room ${state.roomIdx + 1}` : ""}
        </div>
        <div className="dd-scene">{lvl?.tone && `A place of ${lvl.tone}.`}</div>

        {target?.name && (
          <div className="dd-enemy">
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
          <div className="dd-treasure-head">Choose a relic (free):</div>
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
        <form className="dd-inputrow" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            className="dd-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="your word"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
          />
          <button type="submit" className="dd-submit">Submit</button>
        </form>
      )}

      {/* action buttons — only in word rooms */}
      {!special && (
        <div className="dd-actions">
          <ScrollMenu logic={logic} scrolls={state.scrolls} onUse={onUseScroll} />
          <RelicMenu logic={logic} relics={state.relics} />
          <button className="dd-act" onClick={onHint}>💡 Hint</button>
        </div>
      )}

      {/* result log */}
      <div className="dd-log" ref={logRef}>
        {log.map((line, i) => (
          <div key={i} className="dd-logline">{line}</div>
        ))}
      </div>

      {toast && <div className="dd-toast">{toast}</div>}
    </div>
  );
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
        <div className="dd-pop">
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

// ── over ──────────────────────────────────────────────────────────────────────
function Over({ logic, state, onAgain }) {
  const recap = logic.runRecap(state);
  const share = logic.shareLine(state);
  return (
    <div className="dd-over">
      <div className="dd-over-crest">{recap.won ? "🏆" : "💀"}</div>
      <h2 className="dd-over-title">{recap.won ? "You cleared the dungeon!" : "You fell in the dark."}</h2>
      {!recap.won && recap.deathCause && <p className="dd-over-cause">{recap.deathCause}.</p>}
      <div className="dd-over-score">{recap.score.toLocaleString()}</div>
      <div className="dd-over-grid">
        <Stat label="Floor reached" value={recap.floor} />
        <Stat label="Hearts left" value={`❤ ${recap.hearts}`} />
        <Stat label="Coins" value={`🪙 ${recap.coins}`} />
        <Stat label="Words played" value={recap.words} />
        <Stat label="Best word" value={recap.best || "—"} />
        <Stat label="Rarest word" value={recap.rarest || "—"} />
      </div>
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
  min-height: 100%; color: #e7ddc9; font-family: 'Georgia', 'Times New Roman', serif;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(120,90,40,.18), transparent 60%),
    linear-gradient(180deg, #17130f 0%, #0d0b09 100%);
  padding: 16px; display: flex; flex-direction: column; align-items: center;
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
.dd-play { max-width: 500px; width: 100%; }
.dd-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: .85rem;
  padding: 8px 4px; border-bottom: 1px solid rgba(217,180,94,.2); margin-bottom: 10px; }
.dd-stat b { color: var(--gold); }
.dd-meter { flex: 1; min-width: 60px; height: 6px; background: rgba(255,255,255,.08); border-radius: 4px; overflow: hidden; }
.dd-meter-fill { height: 100%; background: linear-gradient(90deg, #8f6bb0, var(--accent, var(--gold))); transition: width .35s; }
.dd-x { background: none; border: none; color: #a99; font-size: 1rem; cursor: pointer; padding: 2px 6px; }
.dd-x:hover { color: #fff; }

.dd-card { border: 1px solid rgba(217,180,94,.28); border-radius: 14px; padding: 14px;
  background: linear-gradient(180deg, rgba(30,24,18,.9), rgba(14,11,9,.9));
  box-shadow: inset 0 0 40px rgba(0,0,0,.4); margin-bottom: 12px; }
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

.dd-rule { margin-top: 12px; padding: 12px 14px; text-align: center; font-size: 1rem;
  color: #2a2013; border-radius: 8px;
  background: linear-gradient(180deg, #ece0c4, #d8c9a4); border: 1px solid #b8a67e;
  box-shadow: 0 3px 12px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.4); font-weight: 600; }

.dd-inputrow { display: flex; gap: 8px; margin-bottom: 10px; }
.dd-input { flex: 1; padding: 12px 14px; border-radius: 10px; font-size: 1.15rem; letter-spacing: .12em;
  text-transform: uppercase; text-align: center; font-family: inherit; color: #f4ecd8;
  background: rgba(0,0,0,.35); border: 1px solid rgba(217,180,94,.4); }
.dd-input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 2px rgba(217,180,94,.25); }
.dd-submit { padding: 0 18px; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: .95rem;
  font-weight: 700; color: #221703; border: 1px solid rgba(255,240,200,.4);
  background: linear-gradient(180deg, #e5c069, #b8892f); }
.dd-submit:active { transform: translateY(1px); }

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
.dd-menu { flex: 1; min-width: 90px; position: relative; }
.dd-menu .dd-act { width: 100%; }
.dd-pop { position: absolute; bottom: calc(100% + 6px); left: 0; right: 0; z-index: 5;
  min-width: 220px; max-width: min(320px, 90vw);
  background: #1a1611; border: 1px solid rgba(217,180,94,.4); border-radius: 10px; padding: 6px;
  box-shadow: 0 10px 30px rgba(0,0,0,.6); max-height: 240px; overflow-y: auto; overflow-x: hidden; }
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

.dd-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 20;
  background: #2a2013; color: var(--parch); padding: 9px 18px; border-radius: 20px;
  border: 1px solid rgba(217,180,94,.45); font-size: .88rem; box-shadow: 0 6px 24px rgba(0,0,0,.5); }

/* over */
.dd-over { max-width: 460px; width: 100%; text-align: center; padding-top: 8px; }
.dd-over-crest { font-size: 3rem; }
.dd-over-title { font-size: 1.4rem; color: var(--gold); margin: 4px 0 6px; font-variant: small-caps; }
.dd-over-cause { opacity: .7; font-style: italic; margin: 0 0 8px; }
.dd-over-score { font-size: 2.6rem; color: #f0e4c8; font-weight: 700; letter-spacing: .03em; }
.dd-over-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0; }
.dd-statcard { background: rgba(255,255,255,.04); border: 1px solid rgba(217,180,94,.2); border-radius: 9px; padding: 10px 6px; }
.dd-statcard-v { font-size: 1rem; color: #f0e4c8; word-break: break-word; }
.dd-statcard-l { font-size: .7rem; opacity: .65; margin-top: 3px; letter-spacing: .02em; }
.dd-over-relics { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 16px; }
.dd-over-relic { font-size: .78rem; padding: 5px 9px; border-radius: 14px; background: rgba(217,180,94,.1);
  border: 1px solid rgba(217,180,94,.3); }
.dd-over-actions { display: flex; flex-direction: column; gap: 8px; align-items: center; }
`;
