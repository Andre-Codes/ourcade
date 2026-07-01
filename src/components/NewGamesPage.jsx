import { Link } from "react-router-dom";
import { GAMES } from "../data/games.js";
import { getSticker } from "../data/manual/stickers.js";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";

/* /new — the "what's NEW" shelf. A dedicated page for every cabinet currently
   wearing the NEW! sticker, so the flashing NEW! tab in the nav lands somewhere
   real instead of just scrolling to the games grid. Source of truth is the same
   sticker resolver the cards use (getSticker → key), so this page automatically
   tracks whatever src/data/manual/stickers.js marks as NEW — no second list to
   keep in sync.

   We render a slim self-contained card here (rather than reusing Home's
   GameCard, which is private to Home and pulls in board chips / fav / Top-8
   closures) — it shares the .arcade-card classes so it looks at home. */

const NEW_GAMES = GAMES.filter((g) => getSticker(g)?.key === "NEW");

function NewCard({ game }) {
  const sticker = getSticker(game);
  return (
    <Link to={`/play/${game.id}`} className="arcade-card" style={{ "--accent": game.accent }}>
      <div className="arcade-card-glow" />
      {sticker && (
        <span className={`arcade-burst is-${sticker.key.toLowerCase()}`}>{sticker.label}</span>
      )}

      <div className="arcade-screen">
        <span className="arcade-card-emoji">{game.emoji}</span>
      </div>

      <h2 className="arcade-card-title">{game.title}</h2>
      <p className="arcade-card-blurb">{game.blurb}</p>

      <div className="arcade-card-tags">
        {(game.tags || []).map((t) => (
          <span
            key={t}
            className={`arcade-tag${t === "daily" ? " is-daily" : ""}`}
            title={t === "daily" ? "Refreshes every day — a new challenge at midnight" : undefined}
          >
            {t === "daily" ? "↻ daily" : t}
          </span>
        ))}
      </div>

      <span className="arcade-card-play">PLAY ▶</span>
    </Link>
  );
}

export default function NewGamesPage() {
  return (
    <div className="arcade-stage">
      <BackBar />

      <div className="arcade-newpage">
        <span className="arcade-widget-kicker">✨ FRESH ON THE FLOOR</span>
        <h1 className="arcade-newpage-title">What&apos;s NEW</h1>
        <p className="arcade-newpage-sub">
          The newest cabinets to roll onto the arcade floor. Check back — the
          lineup changes as fresh stuff lands.
        </p>

        {NEW_GAMES.length ? (
          <div className="arcade-grid">
            {NEW_GAMES.map((game) => (
              <NewCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <NedryGag message="No new cabinets right now — check back soon." />
        )}
      </div>
    </div>
  );
}
