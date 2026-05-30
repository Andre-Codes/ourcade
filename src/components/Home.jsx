import { Link } from "react-router-dom";
import { GAMES } from "../data/games.js";

export default function Home() {
  return (
    <div className="arcade-home">
      <header className="arcade-header">
        <h1 className="arcade-logo">OURCADE</h1>
        <p className="arcade-tagline">a little arcade of homemade minigames</p>
      </header>

      <main className="arcade-grid">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            to={`/play/${game.id}`}
            className="arcade-card"
            style={{ "--accent": game.accent }}
          >
            <div className="arcade-card-glow" />
            <span className="arcade-card-emoji">{game.emoji}</span>
            <h2 className="arcade-card-title">{game.title}</h2>
            <p className="arcade-card-blurb">{game.blurb}</p>
            <div className="arcade-card-tags">
              {game.tags.map((t) => (
                <span key={t} className="arcade-tag">{t}</span>
              ))}
            </div>
            <span className="arcade-card-play">PLAY ▶</span>
          </Link>
        ))}
      </main>

      <footer className="arcade-footer">
        Built with React + Vite · Deployed on GitHub Pages
      </footer>
    </div>
  );
}
