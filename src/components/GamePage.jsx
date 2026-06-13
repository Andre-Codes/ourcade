import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getGame } from "../data/games.js";
import { ArcadeChromeContext } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import NedryGag from "./NedryGag.jsx";

export default function GamePage() {
  const { id } = useParams();
  const game = getGame(id);
  // React games toggle this via useArcadeBackButton; iframe games leave it true.
  const [backVisible, setBackVisible] = useState(true);

  // Iframe score bridge (the Arcade Score Standard for standalone HTML games):
  // a game posts { type:"ourcade:score", gameId, score } to its parent and we
  // submit it to the shared board — the SAME contract React games use. The
  // listener only acts on messages for THIS cabinet, so cross-game leaks can't
  // happen. submit() itself no-ops for anon / non-scored games.
  const { submit } = useArcadeScore(id);
  useEffect(() => {
    if (!game || game.type !== "iframe" || !game.score) return;
    const onMsg = (e) => {
      const d = e?.data;
      if (!d || d.type !== "ourcade:score" || d.gameId !== id) return;
      const score = Number(d.score);
      if (!Number.isNaN(score)) submit(score);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [id, game, submit]);

  if (!game) {
    return (
      <div className="arcade-notfound">
        <NedryGag message="That game doesn’t exist." />
        <Link to="/" className="arcade-back-link">← Back to Ourcade</Link>
      </div>
    );
  }

  return (
    <div className="arcade-stage">
      {backVisible && (
        <div className="arcade-cabinet-chrome">
          <Link to="/" className="arcade-back" title="Back to Ourcade" aria-label="Back to Ourcade">
            ‹ BACK TO OURCADE
          </Link>
          <span className="arcade-cabinet-badge" aria-hidden="true">OURCADE</span>
        </div>
      )}

      {game.type === "iframe" ? (
        <iframe
          className="arcade-iframe"
          src={import.meta.env.BASE_URL + game.src}
          title={game.title}
          // allow audio/fullscreen for games that use them
          allow="autoplay; fullscreen; gamepad"
        />
      ) : (
        <ArcadeChromeContext.Provider value={setBackVisible}>
          <div className="arcade-react-game">
            <game.component />
          </div>
        </ArcadeChromeContext.Provider>
      )}
    </div>
  );
}
