import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayKey, prettyDate, dayNumberFromKey } from "../lib/daily.js";
import { lsGetJSON, lsSetJSON, recordRelic, getDiscoveredRelics, mirrorRelicRunStreak, recordRelicRun, getRelicRunStats } from "../lib/store.js";
import { relicById } from "../data/relics.js";
import { useArcadeScore } from "../lib/scores.js";
import ShareButton from "../components/ShareButton.jsx";
import RelicCelebration from "../components/RelicCelebration.jsx";
import {
  dailyChallenge, node, runNumber, shareText, rating, prettyEra, streakMilestone,
} from "./relic-run/logic.js";
import { parseArticleText } from "./relic-run/article.js";

/* DAILY RUN — a deterministic "old internet maze". Everyone gets the same
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

// Render one wiki-token prose field into text runs + inline link buttons. A
// link token becomes a real <button> styled as a classic blue link so it can
// drive goTo; a relic-armed token (or the [[#|…]] sentinel) pockets the relic
// instead of navigating, and — until found — wears the faintest glint. Visited
// links go visited-purple via rr-wlink-seen, mirroring the old grid's seen state.
function renderProse(src, { path, onNav, onRelic, relicFound }) {
  return parseArticleText(src, (id) => node(id).title).map((seg, i) => {
    if (seg.text != null) return <span key={i}>{seg.text}</span>;
    const isRelic = seg.relic && !relicFound;
    if (seg.link === "#" || isRelic) {
      // Relic anchor: looks like a link, but does not navigate.
      return (
        <button
          key={i}
          type="button"
          className={`rr-wlink${isRelic ? " rr-wlink-relic" : ""}`}
          aria-label={isRelic ? "something glints here" : undefined}
          title={isRelic ? "…huh, that looks clickable." : undefined}
          onClick={isRelic ? onRelic : undefined}
        >
          {seg.label}
        </button>
      );
    }
    const seen = path.includes(seg.link);
    return (
      <button
        key={i}
        type="button"
        className={`rr-wlink${seen ? " rr-wlink-seen" : ""}`}
        onClick={() => onNav(seg.link)}
      >
        {seg.label}
      </button>
    );
  });
}

// The readable fake-wiki page for the current node: a lead paragraph, optional
// History/Legacy sections, and a "See also" list for any links not woven into
// prose. All links (and the hidden relic) live inside the prose now — there is
// no separate "Related links" grid.
function Article({ article, ctx }) {
  return (
    <div className="rr-article">
      <p className="rr-lead">{renderProse(article.lead, ctx)}</p>
      {article.history && (
        <>
          <h3 className="rr-h">History</h3>
          <p className="rr-para">{renderProse(article.history, ctx)}</p>
        </>
      )}
      {article.legacy && (
        <>
          <h3 className="rr-h">Legacy</h3>
          <p className="rr-para">{renderProse(article.legacy, ctx)}</p>
        </>
      )}
      {article.seeAlso?.length > 0 && (
        <>
          <h3 className="rr-h">See also</h3>
          <ul className="rr-seealso">
            {article.seeAlso.map((id) => {
              const seen = ctx.path.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`rr-wlink${seen ? " rr-wlink-seen" : ""}`}
                    onClick={() => ctx.onNav(id)}
                  >
                    {node(id).title}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// The "View Stats" overlay: an aggregate of every Web Run this device has
// finished (clicks vs par over time) plus the live streak. Read lazily on open
// so it always reflects the latest recorded run.
function StatsOverlay({ streak, onClose }) {
  const stats = useMemo(() => getRelicRunStats(), []);
  return (
    <div className="rr-statswrap" role="dialog" aria-label="Web Run stats" onClick={onClose}>
      <div className="rr-statscard" onClick={(e) => e.stopPropagation()}>
        <div className="rr-statshead">📊 YOUR WEB RUN STATS</div>
        {stats.runs === 0 ? (
          <p className="rr-statsempty">Play a few runs and your stats show up here.</p>
        ) : (
          <>
            <div className="rr-statsgrid">
              <div className="rr-stat"><b>{stats.runs}</b><span>RUNS</span></div>
              <div className="rr-stat"><b>{stats.avgClicks}</b><span>AVG CLICKS</span></div>
              <div className="rr-stat"><b>{stats.avgPar}</b><span>AVG PAR</span></div>
              <div className="rr-stat"><b>{stats.best}</b><span>BEST</span></div>
            </div>
            {streak.streak > 0 && (
              <div className="rr-statsstreak">
                🔥 {streak.streak}-day streak
                {streak.best > streak.streak ? ` · best ${streak.best}` : ""}
              </div>
            )}
          </>
        )}
        <button className="rr-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function RelicRun() {
  const day = useMemo(() => todayKey(), []);
  const rNum = useMemo(() => runNumber(day), [day]);
  const { submit } = useArcadeScore("relic-run");

  // The daily puzzle.
  const [chal] = useState(() => dailyChallenge(day));

  const [started, setStarted] = useState(false);
  const [state, setState] = useState(() => loadDayState(day, chal.start));
  const [streak, setStreak] = useState(() => lsGetJSON(STREAK_KEY, null) || { streak: 0, best: 0 });
  const [milestone, setMilestone] = useState(null); // celebratory line when a streak threshold is freshly crossed
  const [showStats, setShowStats] = useState(false); // the "View Stats" aggregate overlay
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
    if (state.done) setStarted(true);
  }, [state.done]);

  // Persist per-day progress whenever it changes.
  useEffect(() => {
    lsSetJSON(STATE_KEY, state);
  }, [state]);

  // On the FIRST landing on a solved state (a fresh finish OR a reload of an
  // already-finished day), once: submit the score AND bump the daily streak.
  // bumpStreak is idempotent per day, so a reload won't double-count; we diff
  // prev→next to know whether THIS finish advanced the streak (only then do we
  // celebrate a milestone). Best streak is mirrored up.
  useEffect(() => {
    if (state.done && state.won && !submittedRef.current) {
      submittedRef.current = true;
      submit(state.clicks); // dir:"asc" — fewer clicks is better
      // Log this day's result for the "View Stats" aggregate. Idempotent per day
      // (replaces same-day entry), so a reload of a finished run won't double it.
      recordRelicRun(state.day, state.clicks, chal.par);
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
  }, [state.done, state.won, state.clicks, state.day, chal.par, submit]);

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
  }, [chal.target]);

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
    () => shareText(day, state.clicks, chal.par),
    [day, state.clicks, chal.par]
  );

  // ── START SCREEN ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <>
        <style>{CSS}</style>
        <div className="rr-app">
          <div className="rr-start">
            <h1 className="rr-title">🖱️ WEB RUN</h1>
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
              Find today's lost internet page in as few clicks as possible.
              Everyone gets the same maze today — links move you page to page.
              Just surf.
            </p>

            <p className="rr-tip">
              🔎 Stuck? Googling each page is half the fun — dig into what these
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
            <button className="rr-statslink" onClick={() => setShowStats(true)}>📊 View Stats</button>
          </div>
        </div>
        {showStats && <StatsOverlay streak={streak} onClose={() => setShowStats(false)} />}
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
            <div className="rr-winbang">You found today's page.</div>
            <div className="rr-wintarget">{target.title}</div>

            <div className="rr-stats">
              <div className="rr-stat"><b>{state.clicks}</b><span>CLICKS</span></div>
              <div className="rr-stat"><b>{chal.par}</b><span>PAR</span></div>
              <div className="rr-stat"><b>{fmtTime(elapsedMs)}</b><span>TIME</span></div>
            </div>

            <div className="rr-rating">{rating(state.clicks, chal.par)}</div>

            {streak.streak > 0 && (
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
              <ShareButton
                label="Copy Result"
                title="Ourcade — Web Run"
                text={share}
              />
              <button className="rr-btn" onClick={() => setShowStats(true)}>📊 View Stats</button>
              <button className="rr-btn" onClick={playArchive}>Play Archive</button>
            </div>
            <p className="rr-next">a fresh run drops at midnight, your time.</p>
          </div>
        </div>
        {showStats && <StatsOverlay streak={streak} onClose={() => setShowStats(false)} />}
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
            {/* The readable article. Every neighbor link is woven into the prose
                as an inline blue link (clicking navigates + costs a click); the
                hidden relic, if any, is a disguised word in the text that pockets
                a collectible WITHOUT navigating or costing a click. */}
            <Article
              article={cur.article}
              ctx={{
                path: state.path,
                onNav: goTo,
                onRelic: () => cur.relic && grabRelic(cur.relic.id),
                relicFound: cur.relic ? foundRelics.has(cur.relic.id) : false,
              }}
            />

            {cur.tags?.length > 0 && (
              <div className="rr-tags">{cur.tags.map((t) => <span className="rr-tag" key={t}>{t}</span>)}</div>
            )}
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

/* fake-wiki article: a lead paragraph, History/Legacy sections, See also list */
.rr-article{margin:0 0 6px}
.rr-lead{font-size:1rem;line-height:1.62;color:#c4d6e6;margin:0 0 14px}
.rr-h{font-family:'Share Tech Mono',monospace;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
  color:#5f87a0;margin:18px 0 6px;border-bottom:1px solid #1c2c44;padding-bottom:4px}
.rr-para{font-size:.95rem;line-height:1.6;color:#c4d6e6;margin:0 0 12px}
.rr-seealso{margin:0 0 4px;padding-left:18px;color:#c4d6e6}
.rr-seealso li{margin:3px 0}
/* inline blue wiki-link rendered as a button so it can drive goTo. Resets to
   inline text so it wraps mid-sentence like a real link. */
.rr-wlink{display:inline;font:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;
  color:#6cb6ff;text-decoration:underline;text-underline-offset:2px;border-radius:2px}
.rr-wlink:hover{color:#9fd2ff}
.rr-wlink:focus-visible{outline:2px solid #3fffd0;outline-offset:2px}
.rr-wlink-seen{color:#9a7fb6}            /* visited-link purple, the classic tell */
/* relic anchor: visually a normal link — the secret is it pockets a relic and
   doesn't navigate. Only the faintest glint on hover rewards the curious. */
.rr-wlink-relic:hover{color:#ffd23f;text-shadow:0 0 8px rgba(255,210,63,.55)}

.rr-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.rr-tag{font-family:'Share Tech Mono',monospace;font-size:.66rem;color:#6f93ad;background:#0e1a2c;
  border:1px solid #1c2c44;border-radius:4px;padding:2px 7px}

/* relic-found toast — floats over the cabinet for a few seconds */
.rr-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:20;max-width:min(92vw,440px);
  white-space:pre-line;text-align:center;font-family:'Share Tech Mono',monospace;font-size:.82rem;line-height:1.45;
  color:#06141a;background:linear-gradient(180deg,#ffe27a,#ffd23f);border:2px solid #b8902a;border-radius:10px;
  padding:11px 16px;box-shadow:0 10px 30px rgba(0,0,0,.5);animation:rr-toast-in .22s ease both}
@keyframes rr-toast-in{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}

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

/* start-screen "View Stats" link — quiet, sits under the streak line */
.rr-statslink{background:none;border:0;cursor:pointer;color:#7fb6c9;font-family:'Share Tech Mono',monospace;
  font-size:.78rem;letter-spacing:.04em;text-decoration:underline;text-underline-offset:3px;padding:2px 4px;margin-top:2px}
.rr-statslink:hover{color:#3fffd0}

/* stats overlay — dimmed backdrop + a centered card with the aggregate */
.rr-statswrap{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(4,7,14,.72);backdrop-filter:blur(2px);animation:rr-toast-in .18s ease both}
.rr-statscard{width:100%;max-width:440px;background:#0e1726;border:2px solid #1c2c44;border-radius:14px;
  padding:20px 18px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;
  box-shadow:0 18px 50px rgba(0,0,0,.6),inset 0 0 0 1px rgba(63,255,208,.06)}
.rr-statshead{font-family:'Press Start 2P',monospace;font-size:.7rem;letter-spacing:.04em;color:#3fffd0;line-height:1.5}
.rr-statsempty{font-size:.86rem;color:#9fb6c9;margin:4px 0;line-height:1.5}
.rr-statsgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px 26px;width:100%;max-width:300px}
.rr-statsstreak{font-family:'Share Tech Mono',monospace;font-size:.84rem;color:#ff9a52}

@media(max-width:420px){
  .rr-pagetitle{font-size:1.25rem}
  .rr-lead{font-size:.95rem}
  .rr-stats{gap:18px}
  .rr-stat b{font-size:1.4rem}
}
`;
