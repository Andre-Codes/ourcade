import { useMemo, useState } from "react";
import { todayKey, prettyDate } from "../lib/daily.js";
import { getTodaysCountdown } from "../data/countdowns.js";
import { getOnThisDay } from "../data/onthisday.js";
import { getTodaysBuzz } from "../data/buzz.js";
import { getTodaysHotOrNot } from "../data/hotornot.js";
import { realTally } from "../data/polls.js";
import { usePollCounts, castVote } from "../lib/votes.js";
import { getPollVote, setPollVote } from "../lib/store.js";
import BackBar from "./BackBar.jsx";
import ShareButton from "./ShareButton.jsx";

/* /watercooler — THE WATER COOLER. A pop-culture destination for people who come
   for current events & buzz, not (only) games — framed as a 2000s e-zine /
   what's-everyone-talking-about page. Four date-seeded sections (same "today" for
   everyone): The Countdown, On This Day, The Buzz, and an interactive Hot or Not
   that reuses the live poll/vote infra verbatim. No algorithm, no feed — a finite
   page that's a different place each day. */

const TREND = {
  up: { glyph: "▲", cls: "is-up", label: "up" },
  down: { glyph: "▼", cls: "is-down", label: "down" },
  same: { glyph: "—", cls: "is-same", label: "no change" },
  new: { glyph: "★", cls: "is-new", label: "new" },
};

// ── The Countdown — a whole TRL/Billboard top-5 for the day ────────────────
function Countdown({ dayKey: key }) {
  const chart = getTodaysCountdown(key);
  if (!chart || !chart.entries?.length) return null;
  return (
    <div className="arcade-widget arcade-countdown">
      <div className="arcade-widget-head">
        <span className="arcade-widget-kicker">📻 THE COUNTDOWN</span>
        <ShareButton
          className="arcade-countdown-share"
          label="Share the chart"
          title="Ourcade — The Countdown"
          text={`Today's countdown at the Water Cooler: ${chart.title}`}
        />
      </div>
      <p className="arcade-countdown-title">{chart.title}</p>
      {chart.blurb && <p className="arcade-countdown-blurb">{chart.blurb}</p>}
      <ol className="arcade-countdown-list">
        {chart.entries.map((e) => {
          const t = TREND[e.trend] || TREND.same;
          return (
            <li key={e.rank} className="arcade-countdown-row">
              <span className="arcade-countdown-rank">{e.rank}</span>
              <span className={`arcade-countdown-trend ${t.cls}`} title={t.label} aria-label={t.label}>
                {t.glyph}
              </span>
              <span className="arcade-countdown-body">
                <span className="arcade-countdown-name">
                  {e.title}
                  {e.by && <span className="arcade-countdown-by"> — {e.by}</span>}
                </span>
                {e.note && <span className="arcade-countdown-note">{e.note}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── On This Day — the calendar-keyed throwback (#1 / theaters / TV) ────────
function OnThisDay({ dayKey: key }) {
  const otd = getOnThisDay(key);
  if (!otd) return null;
  return (
    <div className="arcade-widget arcade-otd">
      <span className="arcade-widget-kicker">📅 ON THIS DAY · {otd.year}</span>
      <div className="arcade-otd-cards">
        {otd.no1Song && (
          <div className="arcade-otd-card">
            <span className="arcade-otd-cat">#1 SONG</span>
            <span className="arcade-otd-thing">{otd.no1Song.title}</span>
            {otd.no1Song.by && <span className="arcade-otd-sub">{otd.no1Song.by}</span>}
          </div>
        )}
        {otd.inTheaters && (
          <div className="arcade-otd-card">
            <span className="arcade-otd-cat">IN THEATERS</span>
            <span className="arcade-otd-thing">{otd.inTheaters.title}</span>
          </div>
        )}
        {otd.onTV && (
          <div className="arcade-otd-card">
            <span className="arcade-otd-cat">ON TV</span>
            <span className="arcade-otd-thing">{otd.onTV.title}</span>
          </div>
        )}
      </div>
      {otd.blurb && <p className="arcade-otd-blurb">{otd.blurb}</p>}
    </div>
  );
}

// ── The Buzz — tabloid water-cooler blurbs (a few per day) ─────────────────
function TheBuzz({ dayKey: key }) {
  const items = getTodaysBuzz(key, 3);
  if (!items.length) return null;
  return (
    <div className="arcade-widget arcade-buzz">
      <span className="arcade-widget-kicker">💬 THE BUZZ</span>
      <ul className="arcade-buzz-list">
        {items.map((b) => (
          <li key={b.id} className="arcade-buzz-row">
            {b.tag && <span className="arcade-buzz-tag">{b.tag}</span>}
            <span className="arcade-buzz-text">{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Hot or Not — one interactive verdict per subject (reuses the poll infra) ─
function HotSubject({ subject }) {
  const [vote, setVote] = useState(() => getPollVote(subject.id));
  const counts = usePollCounts(subject.id);

  const choose = (optId) => {
    if (vote) return; // one verdict per device per subject (local gate)
    setPollVote(subject.id, optId); // local: remember + sync to account
    castVote(subject.id, optId); // shared: +1 the real tally for everyone
    setVote(optId);
  };

  const results = vote ? realTally(subject, counts) : null;

  return (
    <div className="arcade-hon-subject">
      <div className="arcade-hon-head">
        <span className="arcade-hon-emoji" aria-hidden="true">{subject.emoji}</span>
        <span className="arcade-hon-name">{subject.subject}</span>
      </div>
      {!vote ? (
        <div className="arcade-poll-options arcade-hon-options">
          {subject.options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="arcade-poll-opt"
              onClick={() => choose(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="arcade-poll-results">
          {results.map((r) => (
            <div
              key={r.id}
              className={`arcade-poll-bar${r.id === vote ? " is-mine" : ""}`}
            >
              <div className="arcade-poll-bar-fill" style={{ width: `${r.pct}%` }} />
              <span className="arcade-poll-bar-label">{r.label}</span>
              <span className="arcade-poll-bar-pct">{r.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HotOrNot({ dayKey: key }) {
  const subjects = getTodaysHotOrNot(key, 5);
  if (!subjects.length) return null;
  return (
    <div className="arcade-widget arcade-hon">
      <span className="arcade-widget-kicker">🔥 HOT OR NOT</span>
      <p className="arcade-hon-intro">cast your verdict — the bars are real and move as everyone votes ✦</p>
      <div className="arcade-hon-grid">
        {subjects.map((s) => (
          <HotSubject key={s.id} subject={s} />
        ))}
      </div>
    </div>
  );
}

export default function WaterCoolerPage() {
  const key = useMemo(() => todayKey(), []);
  return (
    <div className="arcade-stage">
      <BackBar />
      <section className="arcade-watercooler">
        <header className="arcade-watercooler-head">
          <h1 className="arcade-watercooler-title">💧 THE WATER COOLER</h1>
          <p className="arcade-watercooler-sub">
            what the whole internet is talking about today
          </p>
          <p className="arcade-watercooler-date">fresh page baked {prettyDate(key)}</p>
        </header>

        <Countdown dayKey={key} />
        <OnThisDay dayKey={key} />
        <TheBuzz dayKey={key} />
        <HotOrNot dayKey={key} />

        <p className="arcade-watercooler-foot">
          no algorithm. no feed. just the whole internet, today — and a new page tomorrow.
        </p>
      </section>
    </div>
  );
}
