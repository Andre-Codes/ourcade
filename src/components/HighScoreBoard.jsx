import { Link } from "react-router-dom";
import { getGame } from "../data/games.js";
import { useAuth } from "../lib/AuthProvider.jsx";
import { useArcadeScore, useLeaderboard } from "../lib/scores.js";
import { renderAvatar } from "../lib/kenney.js";

/* ─────────────────────────────────────────────────────────────────────────
   HIGHSCOREBOARD — the ONE board UI of the Arcade Score Standard. Any game
   with a `score` config in the registry renders here, identically, whether
   it's a React cabinet or an iframe. Top-N rows (your row highlighted), your
   own best, the game's label/format. Reused on #/scores/:gameId AND on a
   user's public profile.

   Props:
     gameId   — registry id (required)
     n        — how many rows (default 10)
     compact  — tighter variant for embedding (e.g. on a profile)
   ───────────────────────────────────────────────────────────────────────── */

const MEDALS = ["🥇", "🥈", "🥉"];

export default function HighScoreBoard({ gameId, n = 10, compact = false }) {
  const game = getGame(gameId);
  const cfg = game?.score;
  const { uid } = useAuth() || {};
  const { entries, loading } = useLeaderboard(gameId, n);
  const { best } = useArcadeScore(gameId);

  if (!game || !cfg) return null;

  const fmt = (v) => {
    try {
      return cfg.format ? cfg.format(v) : String(v);
    } catch {
      return String(v);
    }
  };
  const meRanked = uid && entries.some((e) => e.uid === uid);

  return (
    <div className={`arcade-board${compact ? " is-compact" : ""}`}>
      <div className="arcade-board-head">
        <span className="arcade-board-emoji" aria-hidden="true">{game.emoji}</span>
        <span className="arcade-board-title">{game.title}</span>
        <span className="arcade-board-col">{cfg.label || "SCORE"}</span>
      </div>

      {loading ? (
        <p className="arcade-board-empty">loading board…</p>
      ) : entries.length === 0 ? (
        <p className="arcade-board-empty">no scores yet — be the first ✦</p>
      ) : (
        <ol className="arcade-board-list">
          {entries.map((e, i) => {
            const mine = uid && e.uid === uid;
            return (
              <li
                key={e.uid || i}
                className={`arcade-board-row${mine ? " is-me" : ""}`}
              >
                <span className="arcade-board-rank">{MEDALS[i] || i + 1}</span>
                <span className="arcade-board-who">
                  <span className="arcade-board-av" aria-hidden="true">{renderAvatar(e.avatar, { size: 20, alt: "" })}</span>
                  {e.username ? (
                    <Link className="arcade-board-name" to={`/u/${e.username}`}>
                      {e.username}
                    </Link>
                  ) : (
                    <span className="arcade-board-name">player</span>
                  )}
                </span>
                <span className="arcade-board-score">{fmt(e.score)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {best != null && !meRanked && (
        <p className="arcade-board-yours">your best: <b>{fmt(best)}</b></p>
      )}
    </div>
  );
}
