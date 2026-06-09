import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GAMES } from "../data/games.js";
import { todayKey, prettyDate, rotateDaily } from "../lib/daily.js";
import { getTodaysPoll, simulatedTally } from "../data/polls.js";
import { getTodaysQuizzes } from "../data/quizzes.js";
import { getTodaysTip, getTodaysNews } from "../data/flavor.js";
import { getTodaysFact } from "../data/facts.js";
import { NEXT_GAME_VOTE, nextGameTally } from "../data/nextGame.js";
import {
  getPollVote,
  setPollVote,
  getQuizResult,
  recordVisit,
} from "../lib/store.js";
import FlashTheater from "./FlashTheater.jsx";
import ShareButton from "./ShareButton.jsx";
import byteBadger from "../assets/byte-badger.png";

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

// ── Today's quizzes teaser (a few to choose from) ─────────────────────────
function QuizTeaser({ dayKey: key }) {
  const quizzes = getTodaysQuizzes(key, 3);
  if (!quizzes.length) return null;
  return (
    <div className="arcade-widget arcade-quizteaser">
      <span className="arcade-widget-kicker">🔮 TODAY&apos;S QUIZZES</span>
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
      <span className="arcade-widget-kicker">💡 GAME FACT</span>
      <p className="arcade-fact-text">{fact}</p>
    </div>
  );
}

// ── Next-game roadmap vote (standing fixture, not part of the daily rotation) ─
function NextGameVote() {
  const vote = NEXT_GAME_VOTE; // pinned — same question every day
  const key = useMemo(() => todayKey(), []);
  const [picked, setPicked] = useState(() => getPollVote(vote.id));

  const choose = (optId) => {
    if (picked) return; // one vote per device
    setPollVote(vote.id, optId);
    setPicked(optId);
  };

  const results = picked ? nextGameTally(picked, key) : null;

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
          <GameFact dayKey={key} />
        </div>
      </div>

      <div className="arcade-daily-row">
        <StumbleButton />
        <MascotTip dayKey={key} streak={streak} />
      </div>

      <NextGameVote />

      <FlashTheater dayKey={key} compact browseTo="/flash" />

      <SiteNews dayKey={key} />
    </section>
  );
}
