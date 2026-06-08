import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getQuiz, getTodaysQuiz, scoreQuiz } from "../data/quizzes.js";
import { getGame } from "../data/games.js";
import { setQuizResult } from "../lib/store.js";
import { todayKey } from "../lib/daily.js";
import ShareButton from "./ShareButton.jsx";

export default function QuizPage() {
  const { id } = useParams();
  // exact quiz by id, else fall back to today's so /quiz/anything still works
  const quiz = useMemo(() => getQuiz(id) || getTodaysQuiz(todayKey()), [id]);

  const [answers, setAnswers] = useState([]); // chosen answer index per question
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  if (!quiz) {
    return (
      <div className="arcade-notfound">
        <p>That quiz wandered off.</p>
        <Link to="/" className="arcade-back-link">← Back to Ourcade</Link>
      </div>
    );
  }

  const step = answers.length; // which question is on screen
  const total = quiz.questions.length;

  const answer = (ansIdx) => {
    const next = [...answers, ansIdx];
    if (next.length >= total) {
      const r = scoreQuiz(quiz, next);
      setQuizResult(quiz.id, r.id);
      setResult(r);
    }
    setAnswers(next);
  };

  const retake = () => {
    setAnswers([]);
    setResult(null);
  };

  const playable = result && getGame(result.gameId);

  return (
    <div className="arcade-stage arcade-quiz-stage">
      <div className="arcade-cabinet-chrome">
        <Link to="/" className="arcade-back" aria-label="Back to Ourcade">
          ‹ BACK TO OURCADE
        </Link>
        <span className="arcade-cabinet-badge" aria-hidden="true">OURCADE</span>
      </div>

      <div className="arcade-quiz">
        {!result ? (
          <>
            <span className="arcade-widget-kicker">🔮 QUIZ</span>
            <h1 className="arcade-quiz-title">{quiz.title}</h1>
            <p className="arcade-quiz-progress">
              question {step + 1} of {total}
            </p>
            <p className="arcade-quiz-q">{quiz.questions[step].q}</p>
            <div className="arcade-quiz-answers">
              {quiz.questions[step].answers.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  className="arcade-quiz-answer"
                  onClick={() => answer(i)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="arcade-quiz-result">
            <span className="arcade-widget-kicker">YOUR RESULT</span>
            <div className="arcade-quiz-result-emoji">{result.emoji}</div>
            <h1 className="arcade-quiz-result-title">{result.title}</h1>
            <p className="arcade-quiz-result-blurb">{result.blurb}</p>
            <div className="arcade-quiz-result-actions">
              {playable && (
                <button
                  type="button"
                  className="arcade-quiz-play"
                  onClick={() => navigate(`/play/${result.gameId}`)}
                >
                  PLAY THIS ▶
                </button>
              )}
              <button type="button" className="arcade-quiz-retake" onClick={retake}>
                ↻ retake
              </button>
              <ShareButton
                label="Share result"
                title={`Ourcade Quiz — ${quiz.title}`}
                text={`${result.emoji} I got "${result.title}" on the Ourcade quiz "${quiz.title}"! What do you get?`}
              />
              <Link to="/" className="arcade-quiz-home">
                ← back to arcade
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
