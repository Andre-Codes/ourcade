import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GAMES } from "../data/games.js";
import { todayKey, prettyDate, rotateDaily } from "../lib/daily.js";
import { getTodaysPoll, simulatedTally } from "../data/polls.js";
import { getTodaysQuiz } from "../data/quizzes.js";
import { getTodaysTip, getTodaysNews } from "../data/flavor.js";
import {
  getPollVote,
  setPollVote,
  getQuizResult,
  recordVisit,
} from "../lib/store.js";

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
      <span className="arcade-hero-kicker">★ GAME OF THE DAY ★</span>
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
  if (!poll) return null;

  const choose = (optId) => {
    if (vote) return; // one vote per device per day
    setPollVote(poll.id, optId);
    setVote(optId);
  };

  const results = vote ? simulatedTally(poll, vote, key) : null;

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
        </div>
      )}
    </div>
  );
}

// ── Today's quiz teaser ───────────────────────────────────────────────────
function QuizTeaser({ dayKey: key }) {
  const quiz = getTodaysQuiz(key);
  if (!quiz) return null;
  const priorId = getQuizResult(quiz.id);
  const prior = priorId ? quiz.results.find((r) => r.id === priorId) : null;
  return (
    <Link to={`/quiz/${quiz.id}`} className="arcade-widget arcade-quizteaser">
      <span className="arcade-widget-kicker">🔮 TODAY&apos;S QUIZ</span>
      <p className="arcade-quizteaser-title">{quiz.title}</p>
      {prior ? (
        <p className="arcade-quizteaser-prior">
          you were: <b>{prior.emoji} {prior.title}</b> · retake →
        </p>
      ) : (
        <p className="arcade-quizteaser-cta">
          {quiz.intro} <b>take it →</b>
        </p>
      )}
    </Link>
  );
}

// ── Stumble (random game) ─────────────────────────────────────────────────
function StumbleButton() {
  const navigate = useNavigate();
  const stumble = () => {
    const pick = GAMES[Math.floor(Math.random() * GAMES.length)];
    if (pick) navigate(`/play/${pick.id}`);
  };
  return (
    <button type="button" className="arcade-stumble" onClick={stumble}>
      🎲 STUMBLE — random game, no refunds
    </button>
  );
}

// ── Mascot tip + visit streak ─────────────────────────────────────────────
function MascotTip({ dayKey: key, streak }) {
  const tip = getTodaysTip(key);
  return (
    <div className="arcade-mascot">
      <span className="arcade-mascot-face" aria-hidden="true">👾</span>
      <div className="arcade-mascot-bubble">
        {streak > 1 && (
          <span className="arcade-streak">🔥 {streak}-day streak!</span>
        )}
        <p className="arcade-mascot-tip">{tip}</p>
      </div>
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

export default function DailyBand() {
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
        </div>
      </div>

      <div className="arcade-daily-row">
        <StumbleButton />
        <MascotTip dayKey={key} streak={streak} />
      </div>

      <SiteNews dayKey={key} />
    </section>
  );
}
