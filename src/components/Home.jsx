import { useEffect, useMemo, useState } from "react";
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

function GameCard({ game, cta = "PLAY ▶" }) {
  return (
    <Link
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

      <span className="arcade-card-play">{cta}</span>
    </Link>
  );
}

export default function Home() {
  const visitors = useVisitorCount();
  const odometer = String(visitors).padStart(8, "0").split("");

  // ---- search + tag filtering (scales as the library grows) ----
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState([]);

  // the union of every tag in the registry, for the filter chips
  const allTags = useMemo(() => {
    const s = new Set();
    GAMES.forEach((g) => (g.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, []);

  const toggleTag = (t) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const clearFilters = () => { setQuery(""); setActiveTags([]); };

  const matches = (g) => {
    const q = query.trim().toLowerCase();
    const textOk = !q || g.title.toLowerCase().includes(q) || (g.blurb || "").toLowerCase().includes(q);
    const tagsOk = activeTags.every((t) => (g.tags || []).includes(t));
    return textOk && tagsOk;
  };

  const visible = GAMES.filter(matches);
  const games = visible.filter((g) => g.category === "game");
  const tools = visible.filter((g) => g.category === "tool");
  const filtering = query.trim() !== "" || activeTags.length > 0;

  return (
    <div className="arcade-home" id="top">
      {/* ---- retro top nav ---- */}
      <nav className="arcade-nav">
        <a href="#top" className="arcade-tab is-active">HOME</a>
        <a href="#arcade-games" className="arcade-tab">GAMES</a>
        <a href="#arcade-tools" className="arcade-tab">TOOLS</a>
        <a href="#arcade-games" className="arcade-tab arcade-tab-hot">NEW!</a>
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

      <div className="arcade-search" id="arcade-search">
        <input
          className="arcade-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search the cabinets…"
          aria-label="Search games and tools"
        />
        <div className="arcade-chips">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`arcade-chip${activeTags.includes(t) ? " is-active" : ""}`}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))}
          {filtering && (
            <button type="button" className="arcade-chip arcade-chip-clear" onClick={clearFilters}>
              clear ✕
            </button>
          )}
        </div>
      </div>

      <main>
        <section id="arcade-games">
          <h2 className="arcade-section-title">🕹️ GAMES</h2>
          {games.length ? (
            <div className="arcade-grid">
              {games.map((game) => (
                <GameCard key={game.id} game={game} cta="PLAY ▶" />
              ))}
            </div>
          ) : (
            <p className="arcade-empty">No cabinets match — try another tag.</p>
          )}
        </section>

        <section id="arcade-tools">
          <h2 className="arcade-section-title">🧰 TOOLS &amp; TOYS</h2>
          {tools.length ? (
            <div className="arcade-grid">
              {tools.map((game) => (
                <GameCard key={game.id} game={game} cta="OPEN ▶" />
              ))}
            </div>
          ) : (
            <p className="arcade-empty">No tools match — try another tag.</p>
          )}
        </section>
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
        <p className="arcade-smallprint">Hand-coded with caffeine · Optimized for 56k · No cookies, just quarters</p>
      </footer>
    </div>
  );
}
