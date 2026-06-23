import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GAMES } from "../data/games.js";
import { getSticker } from "../data/manual/stickers.js";
import { recordDeepCutsUnlocked, getFavorites, toggleFavorite } from "../lib/store.js";
import { todayKey, dayPart, getHourOverride, daySeed, dayNumberFromKey, mulberry32 } from "../lib/daily.js";
import { getDayPartGreeting } from "../data/dayparts.js";
import { useAuth } from "../lib/AuthProvider.jsx";
import { usePhone } from "../lib/PhoneProvider.jsx";
import DailyBand from "./DailyBand.jsx";
import Top8HeartButton from "./Top8HeartButton.jsx";
import Walkman from "./Walkman.jsx";
import NedryGag from "./NedryGag.jsx";
import byteBadger from "../assets/byte-badger.webp";
import arcadeBadger from "../assets/arcade-badger.webp";
import badgerMorning from "../assets/badger-morning.webp";
import badgerAfternoon from "../assets/badger-afternoon.webp";
import badgerAfterHours from "../assets/badger-after-hours.webp";
import emailGif from "../assets/email.gif";
import lavalampGif from "../assets/lavalamp.gif";

// The greeting badger changes with the local day-part. There are 4 parts but 3
// art variants — late-night ("night") reuses the after-hours badger. Anything
// unmapped falls back to the default mascot.
const GREETING_BADGER = {
  morning: badgerMorning,
  afternoon: badgerAfternoon,
  evening: badgerAfterHours,
  night: badgerAfterHours,
};

// "2:14am" — honors the ?hour= QA override so the clock matches the previewed
// part (override has no minutes, so it reads as :00).
function clockLabel(now) {
  const oh = getHourOverride();
  const h24 = oh ?? now.getHours();
  const m = oh != null ? 0 : now.getMinutes();
  const ampm = h24 < 12 ? "am" : "pm";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

// Date-seeded visitor odometer — a tasteful FAKE (no backend). Starts near 1234
// and climbs a little every calendar day, with a seeded per-day wobble so some
// days read busier than others. Stable within a day, the same on every device
// (like the rest of the date-seeded "fresh page" ritual). Honors ?day=.
const VISIT_BASE = 1234;
const VISIT_EPOCH = dayNumberFromKey("2026-06-01"); // day 0 of the count
function visitorCountForDay(key) {
  const day = Math.max(0, dayNumberFromKey(key) - VISIT_EPOCH);
  const rand = mulberry32(daySeed(`visits:${key}`));
  // steady floor (~80–140/day on average) + a daily swing so it fluctuates
  const avgPerDay = 80 + Math.floor(rand() * 60); // 80..139 for THIS day
  const floor = VISIT_BASE + day * 110; // long-run trend
  const wobble = Math.floor((rand() - 0.5) * 600); // ±~300 day-to-day noise
  return Math.max(VISIT_BASE, floor + avgPerDay + wobble);
}
function useVisitorCount() {
  return useMemo(() => visitorCountForDay(todayKey()), []);
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

// The user's favorited gameIds, reactive to store changes (toggles here, cloud
// hydration in AuthProvider). Drives the ⭐ on each cabinet + the home shelf.
function useFavorites() {
  const [favs, setFavs] = useState(() => getFavorites());
  useEffect(() => {
    const sync = () => setFavs(getFavorites());
    window.addEventListener("ourcade:storechange", sync);
    return () => window.removeEventListener("ourcade:storechange", sync);
  }, []);
  return favs;
}

// stop a card-overlay control from triggering the card's PLAY navigation.
const stopCard = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

// 🏆 board link — TOP-LEFT, clear of the NEW!/HOT! starburst (which is top-right).
// Navigates programmatically (a nested <a> inside the card's <Link> is invalid).
function CardBoardChip({ game }) {
  const navigate = useNavigate();
  if (!game.score) return null;
  return (
    <button
      type="button"
      className="arcade-card-board"
      title={`${game.title} high scores`}
      aria-label={`${game.title} high scores`}
      onClick={(e) => {
        stopCard(e);
        navigate(`/scores/${game.id}`);
      }}
    >
      🏆
    </button>
  );
}

// ⭐ favorite toggle — BOTTOM-RIGHT, aligned with the CTA row so it never sits
// under the starburst or the board chip.
function CardFav({ game, isFav }) {
  return (
    <button
      type="button"
      className={`arcade-card-fav${isFav ? " is-fav" : ""}`}
      title={isFav ? "Remove from your arcade" : "Add to your arcade"}
      aria-label={isFav ? "Remove favorite" : "Add favorite"}
      aria-pressed={isFav}
      onClick={(e) => {
        stopCard(e);
        toggleFavorite(game.id);
      }}
    >
      {isFav ? "⭐" : "☆"}
    </button>
  );
}

function GameCard({ game, cta = "PLAY ▶", isFav = false }) {
  // Corner sticker comes from src/data/manual/stickers.js (dev-editable, the
  // sole source — only games listed there get one).
  const sticker = getSticker(game);
  return (
    <Link
      to={`/play/${game.id}`}
      className="arcade-card"
      style={{ "--accent": game.accent }}
    >
      <div className="arcade-card-glow" />
      <CardBoardChip game={game} />
      {sticker && (
        <span className={`arcade-burst is-${sticker.key.toLowerCase()}`}>
          {sticker.label}
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
      <CardFav game={game} isFav={isFav} />
      <Top8HeartButton type="game" id={game.id} title={game.title} className="is-card" />
    </Link>
  );
}

export default function Home() {
  const visitors = useVisitorCount();
  const odometer = String(visitors).padStart(8, "0").split("");

  // ---- easter egg: click Badger's discman to spin up the walkman ----
  const [walkmanOn, setWalkmanOn] = useState(false);

  // ---- day-parts: the arcade looks/greets differently by time of day ----
  const key = useMemo(() => todayKey(), []);
  const [part, setPart] = useState(() => dayPart());
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // tick once a minute: update the clock chip and, when a boundary passes,
    // flip the part (CSS transition does the visual fade). Only re-render the
    // part when its id actually changes, to avoid churn.
    const id = setInterval(() => {
      setNow(new Date());
      const next = dayPart();
      setPart((prev) => (prev.id === next.id ? prev : next));
    }, 60000);
    return () => clearInterval(id);
  }, []);
  const greeting = getDayPartGreeting(part, key);

  // ---- easter egg: the Konami code unlocks the DEEP CUTS stumble pool ----
  const [deepCutsToast, setDeepCutsToast] = useState(false);
  useEffect(() => {
    const SEQ = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
    let i = 0;
    let timer = null;
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return; // don't eat the search box
      const k = String(e.key).toLowerCase();
      i = k === SEQ[i] ? i + 1 : k === SEQ[0] ? 1 : 0;
      if (i === SEQ.length) {
        i = 0;
        recordDeepCutsUnlocked();
        setDeepCutsToast(true);
        clearTimeout(timer);
        timer = setTimeout(() => setDeepCutsToast(false), 5200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, []);

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
  // Nedry only wags when NOTHING matches anywhere — an empty shelf whose sibling
  // still has hits gets a quiet one-liner, not the full gag.
  const noMatches = games.length === 0 && tools.length === 0;
  const favs = useFavorites();

  // account chip (anonymous → "claim", named → "@username")
  const authState = useAuth();
  const accountLabel =
    authState && !authState.isAnonymous && authState.username
      ? `👤 ${authState.username}`
      : "👤 guest · claim";
  // claimed accounts get a 📱 nav entry with a live unread badge.
  const { claimed: hasPhone, unreadCount = 0 } = usePhone() || {};

  return (
    <div className="arcade-home" id="top" data-daypart={part.id}>
      {/* ---- retro top nav ---- */}
      <nav className="arcade-nav">
        <a href="#top" className="arcade-tab is-active">HOME</a>
        <a href="#arcade-today" className="arcade-tab arcade-tab-hot">TODAY!</a>
        <Link to="/watercooler" className="arcade-tab arcade-tab-cool">💧 WATER COOLER</Link>
        <a href="#arcade-games" className="arcade-tab">GAMES</a>
        <a href="#arcade-tools" className="arcade-tab">TOOLS</a>
        <Link to="/new" className="arcade-tab arcade-tab-hot">NEW!</Link>
        <Link to="/play/relic-run" className="arcade-tab arcade-tab-redhot">🔥 WEB RUN</Link>
        <Link to="/faq" className="arcade-tab">F.A.Q.</Link>
        {hasPhone && (
          <Link to="/phone" className="arcade-tab arcade-tab-account" aria-label="your phone">
            📱{unreadCount > 0 && (
              <span className="arcade-nav-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </Link>
        )}
        <Link to="/me" className="arcade-tab arcade-tab-account">{accountLabel}</Link>
        <span className="arcade-nav-spark">✦</span>
      </nav>

      <header className="arcade-header">
        <div className="arcade-mascot-wrap">
          <img
            className="arcade-logo-mascot"
            src={byteBadger}
            alt="Byte Badger, the Ourcade mascot"
            width="128"
            height="128"
          />
          {/* secret: the discman in Badger's hand spins up the walkman */}
          <button
            type="button"
            className="arcade-walkman-hotspot"
            onClick={() => setWalkmanOn(true)}
            aria-label="Play Badger's walkman"
            title="▶ play"
          />
        </div>
        <h1 className="arcade-logo" data-text="OURCADE">OURCADE</h1>

        {/* slogan marquee */}
        <div className="arcade-marquee" aria-label="Our vibes, Our world, Ourcade — press start, stay a while">
          <div className="arcade-marquee-track">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="arcade-marquee-item">
                ★ OUR VIBES&nbsp;·&nbsp;OUR WORLD&nbsp;·&nbsp;<b>OURCADE</b>&nbsp;
              </span>
            ))}
          </div>
        </div>
        <p className="arcade-tagline">~ press start, stay a while ~</p>
      </header>

      {/* day-part greeting: the mascot knows what time it is for you */}
      <div className="arcade-greeting">
        <img className="arcade-greeting-face" src={GREETING_BADGER[part.id] || byteBadger} alt="" aria-hidden="true" />
        <div className="arcade-greeting-body">
          <div className="arcade-greeting-head">
            <span className="arcade-greeting-clock">🕹 it&apos;s {clockLabel(now)} at the arcade</span>
            <span className="arcade-greeting-part">{part.emoji} {part.label}</span>
          </div>
          <p className="arcade-greeting-text">{greeting}</p>
          {part.id !== "night" && (
            <p className="arcade-greeting-tease">
              🌙 the late-night arcade opens at 10 — it&apos;s different after dark.
            </p>
          )}
        </div>
      </div>

      <DailyBand dayPart={part} />

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
          <h2 className="arcade-section-title">
            <img className="arcade-heading-badger" src={arcadeBadger} alt="" aria-hidden="true" />
            THE FLOOR
          </h2>
          {!filtering && (
            <p className="arcade-floor-note">
              {GAMES.length} cabinets. that&apos;s all of them. that&apos;s the point. ✦
            </p>
          )}
          {games.length ? (
            <div className="arcade-grid">
              {games.map((game) => (
                <GameCard key={game.id} game={game} cta="PLAY ▶" isFav={favs.includes(game.id)} />
              ))}
            </div>
          ) : noMatches ? (
            <NedryGag message="Nothing matches — try another tag." />
          ) : (
            <p className="arcade-floor-note">No cabinets match this filter — check Tools &amp; Toys.</p>
          )}
        </section>

        <section id="arcade-tools">
          <h2 className="arcade-section-title">🧰 TOOLS &amp; TOYS</h2>
          {tools.length ? (
            <div className="arcade-grid">
              {tools.map((game) => (
                <GameCard key={game.id} game={game} cta="OPEN ▶" isFav={favs.includes(game.id)} />
              ))}
            </div>
          ) : noMatches ? null : (
            <p className="arcade-floor-note">No tools match this filter — check The Floor.</p>
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
          <Link to="/stumble" className="arcade-badge arcade-badge-link" title="Stumble upon something">
            Ourcade Webring ‹ random ›
          </Link>
        </div>

        {/* classic "email me" gif → contact the webmaster, with a nostalgic
            lava lamp burbling alongside it */}
        <div className="arcade-footer-relics">
          <img className="arcade-lavalamp" src={lavalampGif} alt="" aria-hidden="true" />
          <Link to="/contact" className="arcade-emailme" title="Email the webmaster">
            <img src={emailGif} alt="Email me" />
          </Link>
        </div>

        <p className="arcade-copy">© 2003 OURCADE — all worlds reserved.</p>
        <p className="arcade-smallprint">Hand-coded with caffeine · Optimized for 56k · No cookies, just quarters</p>
      </footer>

      <Walkman on={walkmanOn} onStop={() => setWalkmanOn(false)} />

      {deepCutsToast && (
        <div className="arcade-deepcuts-toast" role="status">
          🩻 DEEP CUTS UNLOCKED — the dice now roll stranger.{" "}
          <Link to="/stumble">roll them →</Link>
        </div>
      )}
    </div>
  );
}
