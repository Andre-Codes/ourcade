import { useParams, Link } from "react-router-dom";
import { getGame } from "../data/games.js";

export default function GamePage() {
  const { id } = useParams();
  const game = getGame(id);

  if (!game) {
    return (
      <div className="arcade-notfound">
        <p>That game doesn’t exist.</p>
        <Link to="/" className="arcade-back-link">← Back to Ourcade</Link>
      </div>
    );
  }

  return (
    <div className="arcade-stage">
      <div className="arcade-cabinet-chrome">
        <Link to="/" className="arcade-back" title="Back to arcade" aria-label="Back to arcade">
          ‹ BACK TO ARCADE
        </Link>
        <span className="arcade-cabinet-badge" aria-hidden="true">OURCADE</span>
      </div>

      {game.type === "iframe" ? (
        <iframe
          className="arcade-iframe"
          src={import.meta.env.BASE_URL + game.src}
          title={game.title}
          // allow audio/fullscreen for games that use them
          allow="autoplay; fullscreen; gamepad"
        />
      ) : (
        <div className="arcade-react-game">
          <game.component />
        </div>
      )}
    </div>
  );
}
