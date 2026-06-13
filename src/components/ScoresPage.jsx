import { useParams, Link } from "react-router-dom";
import { getGame } from "../data/games.js";
import HighScoreBoard from "./HighScoreBoard.jsx";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";

/* #/scores/:gameId — the standalone home for one game's high-score board.
   Works the same for React and iframe cabinets; the board itself is the ONE
   shared HighScoreBoard. A game with no `score` config falls through to the
   not-found gag. */
export default function ScoresPage() {
  const { gameId } = useParams();
  const game = getGame(gameId);

  return (
    <div className="arcade-stage">
      <BackBar />

      {!game || !game.score ? (
        <div className="arcade-notfound">
          <NedryGag message="No high-score board for that game." />
          <Link to="/" className="arcade-back-link">← Back to Ourcade</Link>
        </div>
      ) : (
        <div className="arcade-scores-page">
          <HighScoreBoard gameId={game.id} n={25} />
          <p style={{ textAlign: "center", marginTop: 16 }}>
            <Link to={`/play/${game.id}`} className="arcade-back-link">▶ play {game.title}</Link>
          </p>
        </div>
      )}
    </div>
  );
}
