import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON, recordRelic, getDiscoveredRelics, mirrorRelicRunStreak } from "../lib/store.js";
import { relicById } from "../data/relics.js";
import { useArcadeScore } from "../lib/scores.js";
import ShareButton from "../components/ShareButton.jsx";
import RelicCelebration from "../components/RelicCelebration.jsx";
import {
  dailyChallenge, node, runNumber, shareText, rating, prettyEra, streakMilestone,
} from "./relic-run/logic.js";

/* DAILY RELIC RUN — a deterministic "old internet maze". Everyone gets the same
   seeded start page and target page each local day and surfs fake retro web
   pages (Flash games, memes, GeoCities relics, old devices, 404s…) trying to
   reach the relic in the fewest clicks.

   Self-contained cabinet: injects its own scoped CSS (`.rr-*`), stays on one
   route so the arcade shell's "‹ BACK" button remains visible (no
   useArcadeBackButton). All puzzle truth lives in relic-run/logic.js so the
   headless check measures the exact same daily puzzle. Per-day progress persists
   under ourcade:relic:state so a reload resumes mid-run (or shows the result)
   instead of letting you replay the day. Par + hints are HIDDEN during play —
   par is only revealed on the win screen.

   The board (Arcade Score Standard, dir:"asc") ranks the daily run by fewest
   clicks. Free-play "Random Relic Run" never submits. */

const STATE_KEY = "relic:state";   // { day, path:[ids], clicks, done, won, startedAt, elapsedMs }
const STREAK_KEY = "relic:streak"; // { last:dayKey, streak, best }

// Tiny glyph for a node's hidden relic, by its `where` flavor (relicNodes.js).
// Deliberately understated so it reads as part of the page, not a button.
const RELIC_EGG_GLYPH = {
  sign: "🚧",
  button: "▪",
  signature: "✍",
  token: "◈",
  pixel: "▫",
};

function freshState(day, start) {
  return { day, path: [start], clicks: 0, done: false, won: false, startedAt: null, elapsedMs: 0 };
}

function loadDayState(day, start) {
  const s = lsGetJSON(STATE_KEY, null);
  if (s && s.day === day && Array.isArray(s.path) && s.path[0] === start) return s;
  return freshState(day, start);
}

// Idempotent daily streak bump (same shape/rules as Quarter's): a finished run
// counts once per day; a consecutive solved day extends, a gap or any reload
// after a non-solve breaks it. Relic Run "wins" by definition (you always reach
// the relic eventually), so streak tracks days played to completion.
function bumpStreak(day) {
  const prev = lsGetJSON(STREAK_KEY, null) || { last: null, streak: 0, best: 0 };
  if (prev.last === day) return prev;
  const consecutive = prev.last && dayNumberFromKey(day) - dayNumberFromKey(prev.last) === 1;
  const streak = consecutive ? (prev.streak || 0) + 1 : 1;
  const next = { last: day, streak, best: Math.max(prev.best || 0, streak) };
  lsSetJSON(STREAK_KEY, next);
  return next;
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function RelicRun() {
  const day = useMemo(() => todayKey(), []);
  const rNum = useMemo(() => runNumber(day), [day]);
  const { submit } = useArcadeScore("relic-run");

  // The daily puzzle. A "random" free-play run swaps in a different challenge
  // (seeded off a throwaway key) and is flagged so it never persists or submits.
  const [chal, setChal] = useState(() => dailyChallenge(day));
  const [random, setRandom] = useState(false);

  const [started, setStarted] = useState(false);
  const [state, setState] = useState(() => loadDayState(day, chal.start));
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const [milestone, setMilestone] = useState(null); // celebratory line when a streak threshold is freshly crossed
  const submittedRef = useRef(false);

  // Site-wide relics (easter eggs): which ones THIS device has already found, so
  // a node's hidden trinket shows only until it's collected. Finding a relic
  // never costs a click or affects par. The reveal scales with the tier: a rare
  // CRYSTAL relic pops the grand, site-wide RelicCelebration overlay; lesser
  // tiers get a quick in-cabinet toast.
  const [foundRelics, setFoundRelics] = useState(() => new Set(getDiscoveredRelics().map((r) => r.id)));
  const [relicToast, setRelicToast] = useState(null); // string | null
  const [relicCele, setRelicCele] = useState(null);    // { relic, isNew } | null
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const grabRelic = useCallback((relicId) => {
    const { isNew } = recordRelic(relicId);
    setFoundRelics((prev) => new Set(prev).add(relicId));
    const def = relicById(relicId);
    if (def?.rarity === "crystal") {
      // The top tier always earns the grand reveal — even on a re-find, since the
      // overlay distinguishes NEW vs already-collected itself.
      setRelicCele({ relic: def, isNew });
      return;
    }
    if (isNew) {
      setRelicToast(def?.text ? `🏺 You unearthed a relic!\n${def.text}` : "🏺 You unearthed a relic!");
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setRelicToast(null), 3200);
    }
  }, []);

  const current = state.path[state.path.length - 1];
  const cur = node(current);
  const target = node(chal.target);

  // If the saved state is already done, jump straight past the start screen.
  useEffect(() => {
    if (!random && state.done) setStarted(true);
  }, [random, state.done]);

  // Persist per-day progress whenever it changes (skip free-play runs).
  useEffect(() => {
    if (!random) lsSetJSON(STATE_KEY, state);
  }, [state, random]);

  // On the FIRST landing on a solved state (a fresh finish OR a reload of an
  // already-finished day), once and never for free-play: submit the score AND
  // bump the daily streak. bumpStreak is idempotent per day, so a reload won't
  // double-count; we diff prev→next to know whether THIS finish advanced the
  // streak (only then do we celebrate a milestone). Best streak is mirrored up.
  useEffect(() => {
    if (random) return;
    if (state.done && state.won && !submittedRef.current) {
      submittedRef.current = true;
      submit(state.clicks); // dir:"asc" — fewer clicks is better
      const prev = lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 };
      const next = bumpStreak(state.day);
      setStreak(next);
      const advanced = prev.last !== state.day; // this call actually moved it
      if (advanced) {
        if (next.best > (prev.best || 0)) mirrorRelicRunStreak(next.best);
        const m = streakMilestone(next.streak);
        if (m) setMilestone(m);
      }
    }
  }, [random, state.done, state.won, state.clicks, state.day, submit]);

  // Only read on the win screen (where state.done is true); the timer is not
  // shown during play, so no live tick is needed.
  const elapsedMs = state.elapsedMs;

  const beginRun = useCallback(() => {
    setStarted(true);
    setState((s) => (s.startedAt ? s : { ...s, startedAt: Date.now() }));
  }, []);

  const goTo = useCallback((id) => {
    setState((s) => {
      if (s.done) return s;
      const path = [...s.path, id];
      const clicks = s.clicks + 1;
      const won = id === chal.target;
      const elapsedMs = s.startedAt ? Date.now() - s.startedAt : 0;
      if (won) {
        // Streak bump + milestone now happen in the win effect (idempotent,
        // fires once on first solved-landing) — not here in the reducer.
        return { ...s, path, clicks, done: true, won: true, elapsedMs };
      }
      return { ...s, path, clicks };
    });
  }, [chal.target, random]);

  // Start a fresh random run (free-play). Seeded off a throwaway key so it's a
  // valid in-par puzzle, but it does NOT touch saved progress or the board.
  const startRandom = useCallback(() => {
    const key = `random-${Math.random().toString(36).slice(2)}`;
    const rc = dailyChallenge(key);
    submittedRef.current = true; // belt-and-suspenders: never submit a random run
    setChal(rc);
    setRandom(true);
    setState({ day: key, path: [rc.start], clicks: 0, done: false, won: false, startedAt: Date.now(), elapsedMs: 0 });
    setStarted(true);
  }, []);

  // Replay an archived day via the ?day= override (deterministic, like Quarter's
  // archive). Simplest reliable path: navigate with the query and reload.
  const playArchive = useCallback(() => {
    const input = window.prompt("Play which day? (YYYY-MM-DD)", day);
    if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return;
    const base = window.location.href.split("?")[0].split("#")[0];
    const hash = window.location.hash.split("?")[0] || "";
    window.location.href = `${base}${hash}?day=${input}`;
    window.location.reload();
  }, [day]);

  const share = useMemo(
    () => shareText(random ? day : day, state.clicks, chal.par),
    [random, day, state.clicks, chal.par]
  );

  // ── START SCREEN ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <>
        <style>{CSS}</style>
        <div className="rr-app">
          <div className="rr-start">
            <h1 className="rr-title">🖱️ DAILY RELIC RUN</h1>
            <div className="rr-sub">#{rNum} · {prettyDate(day)}</div>

            <div className="rr-startcard">
              <div className="rr-startrow">
                <span className="rr-startlabel">START</span>
                <span className="rr-startval">{node(chal.start).title}</span>
              </div>
              <div className="rr-startarrow">▼</div>
              <div className="rr-startrow">
                <span className="rr-startlabel rr-target">TARGET</span>
                <span className="rr-startval rr-target">{target.title}</span>
              </div>
            </div>

            <p className="rr-blurb">
              Find today's lost internet relic in as few clicks as possible.
              Everyone gets the same maze today — links move you page to page.
              No par, no hints. Just surf.
            </p>

            <p className="rr-tip">
              🔎 Stuck? Googling each relic is half the fun — dig into what these
              old pages, games, and gadgets actually were and you'll start spotting
              how they connect. And keep your eyes peeled: a few pages hide a relic
              worth pocketing.
            </p>

            <button className="rr-go" onClick={beginRun}>Start Surfing →</button>
            {streak.streak > 0 && (
              <div className="rr-streak">
                🔥 {streak.streak}-day streak
                {streak.best > streak.streak ? ` · best ${streak.best}` : ""}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── WIN MODAL ─────────────────────────────────────────────────────────────
  if (state.done) {
    return (
      <>
        <style>{CSS}</style>
        <div className="rr-app">
          <div className="rr-win">
            <div className="rr-winbang">You found {random ? "the" : "today's"} relic.</div>
            <div className="rr-wintarget">{target.title}</div>

            <div className="rr-stats">
              <div className="rr-stat"><b>{state.clicks}</b><span>CLICKS</span></div>
              <div className="rr-stat"><b>{chal.par}</b><span>PAR</span></div>
              <div className="rr-stat"><b>{fmtTime(elapsedMs)}</b><span>TIME</span></div>
            </div>

            <div className="rr-rating">{rating(state.clicks, chal.par)}</div>

            {!random && streak.streak > 0 && (
              <div className="rr-winstreak">🔥 {streak.streak}-day streak</div>
            )}
            {milestone && (
              <div className="rr-milestone">{milestone}</div>
            )}

            <div className="rr-trail">
              {state.path.map((id, i) => (
                <div className="rr-trailrow" key={i}>
                  {i > 0 && <span className="rr-trailarrow">→</span>}
                  <span className={`rr-trailname${id === chal.target ? " rr-target" : ""}`}>
                    {node(id).title}
                  </span>
                </div>
              ))}
            </div>

            <div className="rr-actions">
              {!random && (
                <ShareButton
                  label="Copy Result"
                  title="Ourcade — Daily Relic Run"
                  text={share}
                />
              )}
              <button className="rr-btn" onClick={playArchive}>Play Archive</button>
              <button className="rr-btn" onClick={startRandom}>Random Relic Run</button>
            </div>
            {!random && (
              <p className="rr-next">a fresh relic drops at midnight, your time.</p>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── SURFING ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="rr-app">
        {relicToast && (
          <div className="rr-toast" role="status">{relicToast}</div>
        )}
        {relicCele && (
          <RelicCelebration
            relic={relicCele.relic}
            isNew={relicCele.isNew}
            onClose={() => setRelicCele(null)}
          />
        )}
        <div className="rr-statusbar">
          <span className="rr-status"><b className="rr-target">◎ {target.title}</b></span>
          <span className="rr-status">🖱️ {state.clicks}</span>
        </div>

        <div className="rr-browser">
          <div className="rr-chrome">
            <span className="rr-dot rr-dot-r" /><span className="rr-dot rr-dot-y" /><span className="rr-dot rr-dot-g" />
            <span className="rr-address">Address: ourcade://relic/{cur.id}</span>
          </div>

          <div className="rr-page">
            <h2 className="rr-pagetitle">{cur.title}</h2>
            <div className="rr-badges">
              <span className="rr-badge">{cur.category}</span>
              <span className="rr-badge rr-badge-era">{prettyEra(cur.era)}</span>
            </div>
            <p className="rr-body">{cur.body}</p>
            {cur.tags?.length > 0 && (
              <div className="rr-tags">{cur.tags.map((t) => <span className="rr-tag" key={t}>{t}</span>)}</div>
            )}

            {/* Hidden relic: a subtle, oddly-clickable trinket some pages carry.
                Clicking it pockets a collectible — it does NOT navigate, cost a
                click, or change par. Once found, it's gone for this device. */}
            {cur.relic && !foundRelics.has(cur.relic.id) && (
              <button
                type="button"
                className="rr-egg"
                aria-label="something glints on this page"
                title="…huh, that looks clickable."
                onClick={() => grabRelic(cur.relic.id)}
              >
                {RELIC_EGG_GLYPH[cur.relic.where] || "✦"}
              </button>
            )}

            <div className="rr-linkshead">Related links</div>
            <div className="rr-links">
              {cur.links.map((id) => {
                const ln = node(id);
                const seen = state.path.includes(id);
                return (
                  <button
                    key={id}
                    className={`rr-link${seen ? " rr-link-seen" : ""}`}
                    onClick={() => goTo(id)}
                  >
                    <span className="rr-linktitle">🔗 {ln.title}</span>
                    <span className="rr-linkmeta">{ln.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {state.path.length > 1 && (
          <div className="rr-breadcrumbs">
            {state.path.map((id, i) => (
              <span key={i} className="rr-crumb">
                {i > 0 && " › "}{node(id).title}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.rr-app{min-height:100svh;background:radial-gradient(120% 120% at 50% 0%,#0d1626 0%,#070a12 60%);
  color:#e9f3ff;display:flex;flex-direction:column;align-items:center;gap:14px;
  padding:60px 12px 32px;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box}
.rr-title{margin:0;font-family:'Press Start 2P','Black Ops One',monospace;font-size:1.05rem;
  letter-spacing:.04em;color:#3fffd0;text-shadow:0 0 18px rgba(63,255,208,.35);text-align:center}
.rr-sub{margin-top:8px;font-size:.82rem;color:#7fb6c9;font-family:'Share Tech Mono',monospace;text-align:center}
.rr-target{color:#ffd23f !important}

/* start screen */
.rr-start{display:flex;flex-direction:column;align-items:center;gap:16px;max-width:520px;text-align:center}
.rr-startcard{width:100%;background:#0e1726;border:2px solid #1c2c44;border-radius:12px;padding:18px 16px;
  display:flex;flex-direction:column;align-items:center;gap:6px;box-shadow:inset 0 0 0 1px rgba(63,255,208,.06)}
.rr-startrow{display:flex;flex-direction:column;gap:3px}
.rr-startlabel{font-family:'Share Tech Mono',monospace;font-size:.66rem;letter-spacing:.18em;color:#5f87a0}
.rr-startval{font-size:1.18rem;font-weight:800;color:#e9f3ff}
.rr-startarrow{color:#3a5a72;font-size:.9rem;margin:2px 0}
.rr-blurb{font-size:.86rem;line-height:1.5;color:#9fb6c9;margin:2px 0}
.rr-tip{font-size:.82rem;line-height:1.5;color:#9fe0d0;margin:0;background:rgba(63,255,208,.06);
  border:1px solid rgba(63,255,208,.22);border-radius:9px;padding:10px 13px}
.rr-go{font-family:'Press Start 2P',monospace;font-size:.78rem;background:#3fffd0;color:#06141a;border:0;
  border-radius:10px;padding:14px 22px;cursor:pointer;box-shadow:0 6px 22px rgba(63,255,208,.3);transition:transform .1s}
.rr-go:hover{transform:translateY(-2px)}
.rr-streak{font-size:.8rem;color:#ff9a52;font-family:'Share Tech Mono',monospace}

/* status bar */
.rr-statusbar{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center;
  font-family:'Share Tech Mono',monospace;font-size:.82rem;color:#9fb6c9;max-width:680px;width:100%}
.rr-status b{font-weight:700}

/* fake browser */
.rr-browser{width:100%;max-width:680px;background:#0a1220;border:2px solid #1c2c44;border-radius:12px;overflow:hidden;
  box-shadow:0 14px 40px rgba(0,0,0,.5)}
.rr-chrome{display:flex;align-items:center;gap:7px;padding:9px 12px;background:#11203a;border-bottom:2px solid #1c2c44}
.rr-dot{width:11px;height:11px;border-radius:50%;display:inline-block}
.rr-dot-r{background:#ff5f57}.rr-dot-y{background:#febc2e}.rr-dot-g{background:#28c840}
.rr-address{margin-left:8px;font-family:'Share Tech Mono',monospace;font-size:.74rem;color:#6f93ad;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rr-page{padding:18px 18px 22px}
.rr-pagetitle{margin:0 0 8px;font-size:1.5rem;font-weight:800;color:#e9f3ff;line-height:1.15}
.rr-badges{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.rr-badge{font-family:'Share Tech Mono',monospace;font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;
  background:#16273f;color:#9fd9ff;border:1px solid #25415f;border-radius:5px;padding:3px 8px}
/* Era keeps its natural mixed case (NOT uppercased): a capital pixel "S" reads
   like a "5", so "2000s" would look like "20005". Lowercase "s" is unambiguous. */
.rr-badge-era{color:#9fb6c9;text-transform:none;letter-spacing:.02em}
.rr-body{font-size:.95rem;line-height:1.55;color:#c4d6e6;margin:0 0 14px}
.rr-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.rr-tag{font-family:'Share Tech Mono',monospace;font-size:.66rem;color:#6f93ad;background:#0e1a2c;
  border:1px solid #1c2c44;border-radius:4px;padding:2px 7px}

/* hidden relic trinket — understated, but a faint glint on hover/focus rewards
   the curious without screaming "button". Never affects clicks/par. */
.rr-egg{position:relative;display:inline-flex;align-items:center;justify-content:center;
  margin:0 0 14px;padding:2px 6px;font-size:.82rem;line-height:1;background:transparent;
  border:1px solid transparent;border-radius:5px;color:#3a5a72;cursor:pointer;opacity:.6;
  transition:opacity .15s,color .15s,border-color .15s,text-shadow .15s}
.rr-egg:hover,.rr-egg:focus-visible{opacity:1;color:#ffd23f;border-color:#3a5a72;
  text-shadow:0 0 10px rgba(255,210,63,.6);outline:none}

/* relic-found toast — floats over the cabinet for a few seconds */
.rr-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:20;max-width:min(92vw,440px);
  white-space:pre-line;text-align:center;font-family:'Share Tech Mono',monospace;font-size:.82rem;line-height:1.45;
  color:#06141a;background:linear-gradient(180deg,#ffe27a,#ffd23f);border:2px solid #b8902a;border-radius:10px;
  padding:11px 16px;box-shadow:0 10px 30px rgba(0,0,0,.5);animation:rr-toast-in .22s ease both}
@keyframes rr-toast-in{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.rr-linkshead{font-family:'Share Tech Mono',monospace;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
  color:#5f87a0;margin-bottom:9px}
.rr-links{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:9px}
.rr-link{display:flex;flex-direction:column;gap:3px;text-align:left;background:#0e1a2c;
  border:2px solid #20344f;border-radius:9px;padding:11px 12px;cursor:pointer;transition:transform .08s,border-color .12s,background .12s}
.rr-link:hover{transform:translateY(-2px);border-color:#3fffd0;background:#11233a}
.rr-link-seen{opacity:.55}
.rr-linktitle{font-size:.92rem;font-weight:700;color:#e9f3ff}
.rr-linkmeta{font-family:'Share Tech Mono',monospace;font-size:.64rem;color:#6f93ad;text-transform:uppercase;letter-spacing:.04em}

/* breadcrumbs */
.rr-breadcrumbs{max-width:680px;width:100%;font-family:'Share Tech Mono',monospace;font-size:.7rem;color:#4f6f88;
  line-height:1.5;text-align:center}
.rr-crumb{color:#6f93ad}

/* win */
.rr-win{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;max-width:560px;width:100%}
.rr-winbang{font-family:'Press Start 2P',monospace;font-size:.82rem;color:#3fffd0;line-height:1.5}
.rr-wintarget{font-size:1.5rem;font-weight:800;color:#ffd23f}
.rr-stats{display:flex;gap:26px;margin:6px 0}
.rr-stat{display:flex;flex-direction:column;align-items:center;gap:3px}
.rr-stat b{font-size:1.7rem;color:#e9f3ff}
.rr-stat span{font-family:'Share Tech Mono',monospace;font-size:.64rem;letter-spacing:.12em;color:#5f87a0}
.rr-rating{font-family:'Press Start 2P',monospace;font-size:.72rem;color:#ff9a52}
.rr-winstreak{font-family:'Share Tech Mono',monospace;font-size:.84rem;color:#ff9a52}
.rr-milestone{font-family:'Share Tech Mono',monospace;font-size:.86rem;color:#06141a;text-align:center;
  background:linear-gradient(180deg,#ffe27a,#ffd23f);border:2px solid #b8902a;border-radius:9px;
  padding:8px 14px;box-shadow:0 6px 18px rgba(255,210,63,.3)}
.rr-trail{width:100%;background:#0e1726;border:2px solid #1c2c44;border-radius:10px;padding:12px 14px;
  display:flex;flex-direction:column;gap:2px;text-align:left}
.rr-trailrow{display:flex;align-items:center;gap:7px}
.rr-trailarrow{color:#3a5a72;font-size:.8rem}
.rr-trailname{font-size:.9rem;color:#c4d6e6}
.rr-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.rr-btn{font-size:.82rem;font-weight:700;background:#16273f;color:#9fd9ff;border:2px solid #25415f;border-radius:9px;
  padding:9px 14px;cursor:pointer;transition:border-color .12s,transform .08s}
.rr-btn:hover{border-color:#3fffd0;transform:translateY(-1px)}
.rr-next{margin:4px 0 0;font-size:.74rem;color:#5f7a90;font-family:'Share Tech Mono',monospace}

@media(max-width:420px){
  .rr-pagetitle{font-size:1.25rem}
  .rr-links{grid-template-columns:1fr}
  .rr-stats{gap:18px}
  .rr-stat b{font-size:1.4rem}
}
`;
