import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GAMES } from "../data/games.js";

const VISIT_KEY = "ourcade:visits";

// fake-but-real visitor odometer: bumps a localStorage tally each load, sits on
// top of a vanity baseline so it reads like a 2003 hit counter.
function useVisitorCount() {
  const [count, setCount] = useState(13370);
  useEffect(() => {
    try {
      const n = (parseInt(localStorage.getItem(VISIT_KEY) || "0", 10) || 0) + 1;
      localStorage.setItem(VISIT_KEY, String(n));
      setCount(13370 + n);
    } catch (e) {
      setCount(13371);
    }
  }, []);
  return count;
}

function Stars({ rating = 0 }) {
  const r = Math.max(0, Math.min(5, rating));
  return (
    <span className="arcade-stars" aria-label={`${r} out of 5 stars`}>
      {"★".repeat(r)}
      <span className="arcade-stars-empty">{"★".repeat(5 - r)}</span>
    </span>
  );
}

export default function Home() {
  const visitors = useVisitorCount();
  const odometer = String(visitors).padStart(8, "0").split("");

  return (
    <div className="arcade-home" id="top">
      {/* ---- retro top nav ---- */}
      <nav className="arcade-nav">
        <a href="#top" className="arcade-tab is-active">HOME</a>
        <a href="#arcade-grid" className="arcade-tab">GAMES</a>
        <a href="#arcade-grid" className="arcade-tab arcade-tab-hot">NEW!</a>
        <a href="#arcade-foot" className="arcade-tab">F.A.Q.</a>
        <span className="arcade-nav-spark">✦</span>
      </nav>

      <header className="arcade-header">
        <h1 className="arcade-logo" data-text="OURCADE">OURCADE</h1>

        {/* slogan marquee */}
        <div className="arcade-marquee" aria-label="Our games, Our world, Ourcade">
          <div className="arcade-marquee-track">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="arcade-marquee-item">
                ★ OUR GAMES&nbsp;·&nbsp;OUR WORLD&nbsp;·&nbsp;<b>OURCADE</b>&nbsp;
              </span>
            ))}
          </div>
        </div>
        <p className="arcade-tagline">~ insert coin · press start · enter the cabinet ~</p>
      </header>

      <main className="arcade-grid" id="arcade-grid">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            to={`/play/${game.id}`}
            className="arcade-card"
            style={{ "--accent": game.accent }}
          >
            <div className="arcade-card-glow" />
            {game.badge && (
              <span className={`arcade-burst ${game.badge === "HOT" ? "is-hot" : "is-new"}`}>
                {game.badge}!
              </span>
            )}

            {/* cabinet "screen" */}
            <div className="arcade-screen">
              <span className="arcade-card-emoji">{game.emoji}</span>
            </div>

            <h2 className="arcade-card-title">{game.title}</h2>

            <div className="arcade-card-meta">
              <Stars rating={game.rating} />
              <span className="arcade-plays">
                played {Number(game.plays || 0).toLocaleString("en-US")}×
              </span>
            </div>

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

      <footer className="arcade-footer" id="arcade-foot">
        <div className="arcade-counter">
          <span className="arcade-counter-label">You are visitor No.</span>
          <span className="arcade-odometer">
            {odometer.map((d, i) => (
              <span key={i} className="arcade-digit">{d}</span>
            ))}
          </span>
        </div>

        <p className="arcade-bestview">★ Best viewed in 1024×768 @ 256 colors ★</p>

        <div className="arcade-badges">
          <span className="arcade-badge">Made with Notepad</span>
          <span className="arcade-badge">Valid HTML 4.01</span>
          <span className="arcade-badge">Get Flash ▶</span>
          <span className="arcade-badge">Ourcade Webring ‹ ›</span>
        </div>

        <p className="arcade-copy">© 2003 OURCADE — all worlds reserved.</p>
        <p className="arcade-smallprint">Built with React + Vite · Deployed on GitHub Pages</p>
      </footer>
    </div>
  );
}
