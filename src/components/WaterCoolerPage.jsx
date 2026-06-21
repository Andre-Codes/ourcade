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

/* /watercooler — THE WATER COOLER. The arcade's daily briefing: a dated "edition"
   that tells you what the internet moved on today. Same e-zine wink as before, but
   denser and genuinely informational — a page you read to actually know what's
   buzzing, not just a stack of gags. Four date-seeded sections (same "today" for
   everyone): The Countdown (the headline chart), The Buzz (the day's dispatches),
   On This Day (the almanac panel), and an interactive Hot or Not that reuses the
   live poll/vote infra verbatim. No algorithm, no feed — a finite page that's a
   different place each day. */

const BUZZ_N = 6; // dispatches per edition (rotateDailyN de-dupes from the pool)

const TREND = {
  up: { glyph: "▲", cls: "is-up", label: "up" },
  down: { glyph: "▼", cls: "is-down", label: "down" },
  same: { glyph: "—", cls: "is-same", label: "no change" },
  new: { glyph: "★", cls: "is-new", label: "new" },
};

// A section header: the neon kicker plus a one-line standfirst that orients the
// reader (what this is, why it's here). The informational layer over the wink.
function SectionHead({ kicker, standfirst, children }) {
  return (
    <div className="arcade-widget-head arcade-sec-head">
      <div className="arcade-sec-head-text">
        <span className="arcade-widget-kicker">{kicker}</span>
        {standfirst && <span className="arcade-sec-standfirst">{standfirst}</span>}
      </div>
      {children}
    </div>
  );
}

// ── The Countdown — the day's headline chart (TRL/Billboard top-5) ─────────
function Countdown({ dayKey: key }) {
  const chart = getTodaysCountdown(key);
  if (!chart || !chart.entries?.length) return null;
  return (
    <div className="arcade-widget arcade-countdown">
      <SectionHead
        kicker="📻 THE COUNTDOWN"
        standfirst="the five things the whole internet moved on — ranked, with the week's drift"
      >
        <ShareButton
          className="arcade-countdown-share"
          label="Share the chart"
          title="Ourcade — The Countdown"
          text={`Today's countdown at the Water Cooler: ${chart.title}`}
        />
      </SectionHead>
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

// ── The Buzz — the day's dispatches (a denser, tagged briefs column) ───────
function TheBuzz({ dayKey: key }) {
  const items = getTodaysBuzz(key, BUZZ_N);
  if (!items.length) return null;
  return (
    <div className="arcade-widget arcade-buzz">
      <SectionHead
        kicker="💬 THE BUZZ"
        standfirst="today's dispatches — rumor, gossip, and hot takes, sourced from nobody reputable"
      />
      <ul className="arcade-buzz-list">
        {items.map((b) => (
          <li key={b.id} className="arcade-buzz-row">
            <span className="arcade-buzz-tag">{b.tag || "DISPATCH"}</span>
            <span className="arcade-buzz-text">{b.text}</span>
            {b.source && (
              <a
                className="arcade-deeper arcade-buzz-source"
                href={b.source}
                target="_blank"
                rel="noopener noreferrer"
              >
                {b.sourceLabel ? `${b.sourceLabel} ↗` : "read more ↗"}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── On This Day — real, dated historical events for the date (Wikipedia-sourced) ─
function OnThisDay({ dayKey: key }) {
  const otd = getOnThisDay(key);
  if (!otd?.events?.length) return null;
  return (
    <div className="arcade-widget arcade-otd">
      <SectionHead
        kicker="📅 ON THIS DAY"
        standfirst="real events from this date in history — straight from Wikipedia, with a link to read more"
      />
      <ul className="arcade-otd-events">
        {otd.events.map((e, i) => (
          <li key={`${e.year}-${i}`} className="arcade-otd-event">
            <span className="arcade-otd-year">{e.year}</span>
            <span className="arcade-otd-event-body">
              <span className="arcade-otd-event-text">{e.text}</span>
              {e.source && (
                <a
                  className="arcade-deeper arcade-otd-source"
                  href={e.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {e.sourceTitle ? `${e.sourceTitle} ↗` : "read more ↗"}
                </a>
              )}
            </span>
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
      <SectionHead
        kicker="🔥 HOT OR NOT"
        standfirst="the reader's section — cast a verdict and you're on the record; the bars are real and move as everyone votes"
      />
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
  const headline = getTodaysCountdown(key);
  return (
    <div className="arcade-stage">
      <BackBar />
      <section className="arcade-watercooler">
        <header className="arcade-watercooler-head">
          <div className="arcade-watercooler-masthead">
            <h1 className="arcade-watercooler-title">💧 THE WATER COOLER</h1>
            <span className="arcade-watercooler-standing">the arcade's daily briefing</span>
          </div>
          <div className="arcade-watercooler-edition">
            <span className="arcade-watercooler-edition-label">EDITION</span>
            <span className="arcade-watercooler-edition-date">{prettyDate(key)}</span>
          </div>
          <p className="arcade-watercooler-lede">
            In this edition: the countdown
            {headline?.title ? ` led by “${headline.title}”` : ""}, {BUZZ_N} dispatches
            from the rumor mill, today's almanac, and the verdicts you put on the record.
          </p>
        </header>

        <Countdown dayKey={key} />

        <div className="arcade-watercooler-body">
          <TheBuzz dayKey={key} />
          <OnThisDay dayKey={key} />
        </div>

        <HotOrNot dayKey={key} />

        <p className="arcade-watercooler-foot">
          no algorithm. no feed. just the whole internet, today — and a new page tomorrow.
        </p>
      </section>
    </div>
  );
}
