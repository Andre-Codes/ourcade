import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GAMES } from "../data/games.js";
import { todayKey, prettyDate, rotateDaily } from "../lib/daily.js";
import { getTodaysPoll, realTally } from "../data/polls.js";
import { getTodaysQuizzes } from "../data/quizzes.js";
import { getTodaysTip, getTodaysNews } from "../data/flavor.js";
import { getTodaysFact } from "../data/facts.js";
import { getTodaysCuriosity } from "../data/curiosities.js";
import { getCurrentWeirdThing } from "../data/weird.js";
import { MOVIES } from "../data/manual/movies.js";
import { FEATURED } from "../data/manual/featured.js";
import { NEXT_GAME_VOTE, nextGameRealTally } from "../data/nextGame.js";
import {
  getPollVote,
  setPollVote,
  getQuizResult,
  recordVisit,
} from "../lib/store.js";
import { usePollCounts, castVote } from "../lib/votes.js";
import FlashTheater from "./FlashTheater.jsx";
import ShareButton from "./ShareButton.jsx";
import Top8HeartButton from "./Top8HeartButton.jsx";
import { factId } from "../data/content.js";
import byteBadger from "../assets/byte-badger.png";

// Optimized Featured Game art, resolved by slug (npm run assets:featured).
// Eager glob → a plain { path: url } map; basenames are looked up at render.
const FEATURED_IMAGES = import.meta.glob("../assets/featured/*.webp", {
  eager: true,
  import: "default",
});

// tiny local copy of Home's star row (kept decoupled so Home stays untouched)
function Stars({ rating = 0 }) {
  const r = Math.max(0, Math.min(5, rating));
  return (
    <span className="arcade-stars" aria-label={`${r} out of 5 stars`}>
      {"★".repeat(r)}
      <span className="arcade-stars-empty">{"★".repeat(5 - r)}</span>
    </span>
  );
}

// ── Game of the Day ───────────────────────────────────────────────────────
function GameOfTheDay({ dayKey: key }) {
  const games = useMemo(() => GAMES.filter((g) => g.category === "game"), []);
  const game = rotateDaily(games, key, 0);
  if (!game) return null;
  return (
    <Link
      to={`/play/${game.id}`}
      className="arcade-hero"
      style={{ "--accent": game.accent }}
    >
      <div className="arcade-hero-glow" />
      <span className="arcade-hero-kicker">★ OURCADE GAME OF THE DAY ★</span>
      <div className="arcade-hero-body">
        <div className="arcade-hero-screen">
          <span className="arcade-hero-emoji">{game.emoji}</span>
        </div>
        <div className="arcade-hero-info">
          <h3 className="arcade-hero-title">{game.title}</h3>
          <div className="arcade-hero-meta">
            <Stars rating={game.rating} />
            <span className="arcade-plays">
              played {Number(game.plays || 0).toLocaleString("en-US")}×
            </span>
          </div>
          <p className="arcade-hero-blurb">{game.blurb}</p>
          <span className="arcade-hero-play">PLAY TODAY ▶</span>
        </div>
      </div>
    </Link>
  );
}

// ── Daily poll ────────────────────────────────────────────────────────────
function DailyPoll({ dayKey: key }) {
  const poll = getTodaysPoll(key);
  const [vote, setVote] = useState(() => (poll ? getPollVote(poll.id) : null));
  const counts = usePollCounts(poll?.id);
  if (!poll) return null;

  const choose = (optId) => {
    if (vote) return; // one vote per device per day (local gate)
    setPollVote(poll.id, optId); // local: remember + sync to account
    castVote(poll.id, optId); // shared: +1 the real tally for everyone
    setVote(optId);
  };

  const results = vote ? realTally(poll, counts) : null;

  return (
    <div className="arcade-widget arcade-poll">
      <span className="arcade-widget-kicker">📊 TODAY&apos;S POLL</span>
      <p className="arcade-poll-q">{poll.question}</p>
      {!vote ? (
        <div className="arcade-poll-options">
          {poll.options.map((o) => (
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
              <div
                className="arcade-poll-bar-fill"
                style={{ width: `${r.pct}%` }}
              />
              <span className="arcade-poll-bar-label">{r.label}</span>
              <span className="arcade-poll-bar-pct">{r.pct}%</span>
            </div>
          ))}
          <p className="arcade-poll-foot">thanks! a new poll drops tomorrow ✦</p>
          <ShareButton
            className="arcade-poll-share"
            label="Share this poll"
            title="Ourcade — Today's Poll"
            text={`Today's Ourcade poll: ${poll.question}`}
          />
        </div>
      )}
    </div>
  );
}

// ── Quiz of the Day (one — the page should be finishable, not refillable) ──
function QuizTeaser({ dayKey: key }) {
  const quizzes = getTodaysQuizzes(key, 1);
  if (!quizzes.length) return null;
  return (
    <div className="arcade-widget arcade-quizteaser">
      <span className="arcade-widget-kicker">🔮 QUIZ OF THE DAY</span>
      <ul className="arcade-quizteaser-list">
        {quizzes.map((quiz) => {
          const priorId = getQuizResult(quiz.id);
          const prior = priorId ? quiz.results.find((r) => r.id === priorId) : null;
          return (
            <li key={quiz.id}>
              <Link to={`/quiz/${quiz.id}`} className="arcade-quizteaser-item">
                <span className="arcade-quizteaser-title">{quiz.title}</span>
                {prior ? (
                  <span className="arcade-quizteaser-prior">
                    you were: <b>{prior.emoji} {prior.title}</b> · retake →
                  </span>
                ) : (
                  <span className="arcade-quizteaser-cta">
                    {quiz.intro} <b>take it →</b>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Random game fact ──────────────────────────────────────────────────────
function GameFact({ dayKey: key }) {
  const fact = getTodaysFact(key);
  if (!fact) return null;
  return (
    <div className="arcade-widget arcade-fact">
      <div className="arcade-widget-head">
        <span className="arcade-widget-kicker">💡 GAME FACT</span>
        <Top8HeartButton type="fact" id={factId(fact)} title="this game fact" />
      </div>
      <p className="arcade-fact-text">{fact}</p>
    </div>
  );
}

// ── Timeless curiosity — fascinating regardless of decade ─────────────────
function TimelessCuriosity({ dayKey: key }) {
  const cur = getTodaysCuriosity(key);
  if (!cur) return null;
  return (
    <div className="arcade-widget arcade-curiosity">
      <div className="arcade-widget-head">
        <span className="arcade-widget-kicker">🌌 TIMELESS CURIOSITY</span>
        <Top8HeartButton type="curiosity" id={cur.id} title={cur.title} />
      </div>
      <p className="arcade-curiosity-title">{cur.title}</p>
      <p className="arcade-curiosity-text">{cur.blurb}</p>
      {cur.url && (
        <a
          className="arcade-deeper"
          href={cur.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          go deeper ↗
        </a>
      )}
    </div>
  );
}

// ── Today's Weird Thing — rotates by day-part, the "we're alive" card ──
function WeirdThing({ dayKey: key, part }) {
  const weird = getCurrentWeirdThing(key, part);
  if (!weird) return null;
  const isNight = part?.id === "night";
  return (
    <div className="arcade-widget arcade-weird">
      <div className="arcade-widget-head">
        <span className="arcade-widget-kicker">🔍 TODAY&apos;S WEIRD THING</span>
        <Top8HeartButton type="weird" id={weird.id} title={weird.title} />
      </div>
      <p className="arcade-weird-title">{weird.title}</p>
      <p className="arcade-weird-text">{weird.blurb}</p>
      <div className="arcade-weird-foot">
        {weird.url && (
          <a
            className="arcade-deeper"
            href={weird.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            see for yourself ↗
          </a>
        )}
        <span className="arcade-weird-note">
          {weird.foundNote ? `${weird.foundNote} · ` : ""}
          {isNight ? "a late-night find — day-folk never see this one 🌙" : "a new one surfaces through the day"}
        </span>
      </div>
    </div>
  );
}

// ── Next-game roadmap vote (standing fixture, not part of the daily rotation) ─
function NextGameVote() {
  const vote = NEXT_GAME_VOTE; // pinned — same question every day
  const [picked, setPicked] = useState(() => getPollVote(vote.id));
  const counts = usePollCounts(vote.id);

  const choose = (optId) => {
    if (picked) return; // one vote per device (local gate)
    setPollVote(vote.id, optId);
    castVote(vote.id, optId); // shared: +1 the real roadmap tally
    setPicked(optId);
  };

  const results = picked ? nextGameRealTally(counts) : null;

  return (
    <div className="arcade-nextgame">
      <span className="arcade-widget-kicker">🕹️ HELP US PICK THE NEXT CABINET</span>
      <p className="arcade-poll-q">{vote.question}</p>
      {!picked ? (
        <div className="arcade-poll-options arcade-nextgame-options">
          {vote.options.map((o) => (
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
              className={`arcade-poll-bar${r.id === picked ? " is-mine" : ""}`}
            >
              <div
                className="arcade-poll-bar-fill"
                style={{ width: `${r.pct}%` }}
              />
              <span className="arcade-poll-bar-label">{r.label}</span>
              <span className="arcade-poll-bar-pct">{r.pct}%</span>
            </div>
          ))}
          <p className="arcade-poll-foot">your vote sticks — we build what wins ✦</p>
          <ShareButton
            className="arcade-poll-share"
            label="Share this vote"
            title="Ourcade — Vote for the next cabinet"
            text={`Help pick Ourcade's next game: ${vote.question}`}
          />
        </div>
      )}
    </div>
  );
}

// ── Stumble portal — the door to the rabbit hole (/stumble) ───────────────
function StumblePortal() {
  return (
    <Link to="/stumble" className="arcade-stumble-portal">
      <span className="arcade-stumble-portal-dice" aria-hidden="true">🎲</span>
      <span className="arcade-stumble-portal-body">
        <span className="arcade-stumble-portal-title">STUMBLE UPON SOMETHING</span>
        <span className="arcade-stumble-portal-sub">
          a forgotten flash game? a weird patent? a website that shouldn&apos;t
          still exist? no algorithm — just dice. →
        </span>
      </span>
    </Link>
  );
}

// ── Mascot tip + visit streak ─────────────────────────────────────────────
function MascotTip({ dayKey: key, streak }) {
  const tip = getTodaysTip(key);
  return (
    <div className="arcade-mascot">
      <img className="arcade-mascot-face" src={byteBadger} alt="Byte Badger" aria-hidden="true" />
      <div className="arcade-mascot-bubble">
        {streak > 1 && (
          <span className="arcade-streak">🔥 {streak}-day streak!</span>
        )}
        <p className="arcade-mascot-tip">{tip}</p>
      </div>
    </div>
  );
}

// ── Now in theaters — the one thing the multiplex won't tell you: is it ───
// worth sitting through the credits? Hand-curated in data/manual/movies.js;
// the card simply lists everything currently in that file (no rotation).
// ── Featured Game (a real, external game worth a look) ────────────────────
function FeaturedGame() {
  if (!FEATURED.length) return null;
  const game = FEATURED[0];
  const art = game.image
    ? FEATURED_IMAGES[`../assets/featured/${game.image}.webp`]
    : null;
  const meta = [game.tagline, game.year].filter(Boolean).join(" · ");
  return (
    <a
      href={game.url}
      target="_blank"
      rel="noopener noreferrer"
      className="arcade-hero arcade-featured"
      style={game.accent ? { "--accent": game.accent } : undefined}
    >
      <div className="arcade-hero-glow" />
      <span className="arcade-hero-kicker">★ FEATURED GAME ★</span>
      <div className="arcade-hero-body">
        <div className="arcade-hero-screen">
          {art ? (
            <img
              className="arcade-featured-art"
              src={art}
              alt={game.title}
              loading="lazy"
            />
          ) : (
            <span className="arcade-hero-emoji">🎮</span>
          )}
        </div>
        <div className="arcade-hero-info">
          <h3 className="arcade-hero-title">{game.title}</h3>
          {meta && <div className="arcade-featured-meta">{meta}</div>}
          <p className="arcade-hero-blurb">{game.blurb}</p>
          <span className="arcade-hero-play">LEARN MORE ↗</span>
        </div>
      </div>
    </a>
  );
}

// ── Now in theaters ───────────────────────────────────────────────────────
function NowInTheaters() {
  if (!MOVIES.length) return null;
  return (
    <div className="arcade-widget arcade-credits">
      <span className="arcade-widget-kicker">🎬 STAY FOR THE CREDITS?</span>
      <ul className="arcade-credits-list">
        {MOVIES.map((m) => {
          const stay = m.stinger === "yes";
          return (
            <li key={m.id} className="arcade-credits-row">
              <div className="arcade-credits-head">
                <span className="arcade-credits-title">{m.title}</span>
                <span
                  className={`arcade-credits-chip${stay ? " is-stay" : " is-none"}`}
                >
                  {stay ? "✅ STAY" : "🚫 nothing extra"}
                </span>
              </div>
              {m.credits && <p className="arcade-credits-note">{m.credits}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Site news box ─────────────────────────────────────────────────────────
function SiteNews({ dayKey: key }) {
  const items = getTodaysNews(key, 3);
  if (!items.length) return null;
  return (
    <div className="arcade-news">
      <span className="arcade-news-label">📰 SITE NEWS</span>
      <ul className="arcade-news-list">
        {items.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

export default function DailyBand({ dayPart }) {
  // one "today" for the whole band (respects the ?day= dev override)
  const key = useMemo(() => todayKey(), []);
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    const { streak: s } = recordVisit(key);
    setStreak(s);
  }, [key]);

  return (
    <section id="arcade-today" className="arcade-daily">
      <h2 className="arcade-daily-title">★ TODAY AT OURCADE ★</h2>
      <p className="arcade-daily-date">fresh page baked {prettyDate(key)}</p>

      <div className="arcade-daily-grid">
        <GameOfTheDay dayKey={key} />
        <div className="arcade-daily-side">
          <DailyPoll dayKey={key} />
          <QuizTeaser dayKey={key} />
          <GameFact dayKey={key} />
        </div>
      </div>

      <div className="arcade-daily-duo">
        <TimelessCuriosity dayKey={key} />
        <WeirdThing dayKey={key} part={dayPart} />
      </div>

      <StumblePortal />

      <div className="arcade-daily-row">
        <MascotTip dayKey={key} streak={streak} />
      </div>

      <NextGameVote />

      <FlashTheater dayKey={key} compact browseTo="/flash" />

      <FeaturedGame />

      <NowInTheaters />

      <SiteNews dayKey={key} />
    </section>
  );
}
