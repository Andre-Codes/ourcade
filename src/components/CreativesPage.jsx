import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CREATIVES_POOL,
  searchCreatives,
  timeBucketOf,
  TIME_BUCKETS,
  TIME_BUCKET_LABEL,
  isGuide,
  isSolve,
} from "../data/creatives.js";
import { hostnameOf } from "./ArtifactCard.jsx";
import { creativeArt } from "./creativeArt.js";
import { isSolvedRecently } from "../lib/solveState.js";
import { seededShuffle } from "../lib/daily.js";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";

/* /creatives — CREATIVES. The actionable sibling to the arcade's "finds": where
   Stumble/Vault are about looking at weird things, every item here gives you a
   NEXT MOVE — draw this, solve this, make this. Same anti-feed shape as the
   Vault: a finite, hand-curated library you wander with search + filter chips,
   not an infinite scroll. Starts with the Draw + Solve lanes on scaffolding
   that scales to more. Content is hand-edited in src/data/manual/creatives.js. */

const PAGE = 24; // reveal window; free headroom for when the pool grows

// Lane chip label — the at-a-glance category on each card and the filter chips.
// Add a lane here + in the data and a chip appears automatically (present-only).
const LANE_LABEL = {
  draw: "✏️ draw",
  solve: "🧩 solve",
  build: "🛠 build",
  remix: "🎛 remix",
  study: "📚 study",
};
const LANE_ORDER = Object.keys(LANE_LABEL);

const DIFFICULTY_LABEL = {
  beginner: "🟢 beginner",
  intermediate: "🟡 intermediate",
  advanced: "🔴 advanced",
};

// The lane emoji alone (first token of the chip label) — used on the fallback
// art tile when an item has no image yet.
const laneEmoji = (lane) => (LANE_LABEL[lane] || "🎨").split(" ")[0];

// A single "make this" card — its own shape (image / lane / time / difficulty /
// next action), so unlike the Vault it does NOT reuse ArtifactCard.
function CreativeCard({ item }) {
  const host = hostnameOf(item.url);
  const art = creativeArt(item); // bundled slug → remote url → null
  const guide = isGuide(item);
  const laneLabel = LANE_LABEL[item.lane] || item.lane;
  // A solve puzzle you've cracked in the last week shows a ✓ badge (self-expires).
  const solved = isSolve(item) && isSolvedRecently(item.id);

  return (
    <div className="arcade-stumble-card arcade-creative-card">
      {/* Featured image up top so the grid is instantly scannable. Falls back to
          a styled lane tile, never a broken <img>. */}
      {art ? (
        <img
          className="arcade-stumble-image arcade-creative-image"
          src={art}
          alt={item.title}
          loading="lazy"
        />
      ) : (
        <div className="arcade-creative-image arcade-creative-image-fallback" aria-hidden="true">
          <span className="arcade-creative-fallback-emoji">{laneEmoji(item.lane)}</span>
        </div>
      )}

      <span className="arcade-stumble-kind">{laneLabel}</span>
      <h2 className="arcade-stumble-title">{item.title}</h2>
      {item.blurb && <p className="arcade-stumble-blurb">{item.blurb}</p>}

      <div className="arcade-creative-badges">
        {solved && <span className="arcade-creative-badge is-solved">✓ solved</span>}
        {item.time && <span className="arcade-creative-badge">⏱ {item.time}</span>}
        {item.difficulty && (
          <span className="arcade-creative-badge">
            {DIFFICULTY_LABEL[item.difficulty] || item.difficulty}
          </span>
        )}
      </div>

      {item.action && (
        <p className="arcade-creative-action">
          <span className="arcade-creative-action-arrow">→</span> {item.action}
        </p>
      )}

      {/* Guides open an on-site walkthrough; everything else links out. */}
      {guide ? (
        <Link
          className="arcade-stumble-open arcade-creative-open"
          to={`/action-lab/${item.id}`}
        >
          {isSolve(item) ? "solve it →" : "open the guide →"}
        </Link>
      ) : (
        item.url && (
          <a
            className="arcade-stumble-open arcade-creative-open"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.source || host} ↗
          </a>
        )
      )}
    </div>
  );
}

export default function CreativesPage() {
  const [query, setQuery] = useState("");
  const [lane, setLane] = useState("all");
  const [bucket, setBucket] = useState("all");
  const [shown, setShown] = useState(PAGE);
  // A fresh random seed per visit — so the "All" view is shuffled differently
  // each time you land on the page, but stays put while you search / filter /
  // load more within this visit (re-mounts reshuffle; re-renders don't).
  const [shuffleSeed] = useState(() => (Math.random() * 0xffffffff) >>> 0);

  // Only show lane chips for lanes actually in the pool, in LANE_ORDER — so a
  // new lane needs zero chip wiring (mirrors the Vault's kind chips).
  const lanes = useMemo(() => {
    const present = new Set(CREATIVES_POOL.map((c) => c.lane));
    return LANE_ORDER.filter((l) => present.has(l));
  }, []);

  // Likewise: only offer time chips for buckets the pool actually contains.
  const buckets = useMemo(() => {
    const present = new Set(CREATIVES_POOL.map((c) => timeBucketOf(c)));
    return TIME_BUCKETS.filter((b) => present.has(b));
  }, []);

  const filtered = useMemo(() => {
    const matches = searchCreatives(CREATIVES_POOL, query, lane, bucket);
    // In the "All" view (no lane selected), randomize the order so the page
    // feels like a fresh grab-bag each visit. Picking a single lane keeps the
    // pool's natural order so that lane reads coherently.
    return lane === "all" ? seededShuffle(matches, shuffleSeed) : matches;
  }, [query, lane, bucket, shuffleSeed]);

  // Reset the reveal window whenever the result set changes.
  useEffect(() => {
    setShown(PAGE);
  }, [query, lane, bucket]);

  const visible = filtered.slice(0, shown);
  const more = filtered.length - visible.length;

  return (
    <div className="arcade-stage">
      <BackBar />
      <section className="arcade-vault arcade-creatives">
        <header className="arcade-vault-head">
          <div className="arcade-vault-masthead">
            <div className="arcade-masthead-text">
              <h1 className="arcade-vault-title">🧪 ACTION LAB</h1>
              <span className="arcade-vault-standing">things to make & solve today</span>
            </div>
          </div>
          <div className="arcade-vault-stat">
            <span className="arcade-vault-stat-num">{CREATIVES_POOL.length.toLocaleString()}</span>
            <span className="arcade-vault-stat-label">tiny missions</span>
          </div>
          <p className="arcade-vault-lede">
            Not inspiration to scroll past — a small creative mission you can
            actually finish. Find something, then make something: draw this,
            solve this. Every item gives you a next move.
          </p>
        </header>

        <div className="arcade-vault-controls">
          <input
            className="arcade-search-input arcade-vault-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search the lab…"
            aria-label="search Action Lab"
          />
          <div className="arcade-chips arcade-vault-chips">
            <button
              type="button"
              className={`arcade-chip${lane === "all" ? " is-active" : ""}`}
              onClick={() => setLane("all")}
            >
              all
            </button>
            {lanes.map((l) => (
              <button
                key={l}
                type="button"
                className={`arcade-chip${lane === l ? " is-active" : ""}`}
                onClick={() => setLane(l)}
              >
                {LANE_LABEL[l]}
              </button>
            ))}
          </div>
          {buckets.length > 1 && (
            <div className="arcade-chips arcade-creatives-time-chips">
              <button
                type="button"
                className={`arcade-chip${bucket === "all" ? " is-active" : ""}`}
                onClick={() => setBucket("all")}
              >
                any time
              </button>
              {buckets.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`arcade-chip${bucket === b ? " is-active" : ""}`}
                  onClick={() => setBucket(b)}
                >
                  {TIME_BUCKET_LABEL[b]}
                </button>
              ))}
            </div>
          )}
        </div>

        {visible.length ? (
          <>
            <div className="arcade-grid arcade-vault-grid arcade-creatives-grid">
              {visible.map((c) => (
                <CreativeCard key={c.id} item={c} />
              ))}
            </div>
            {more > 0 && (
              <div className="arcade-vault-more">
                <button
                  type="button"
                  className="arcade-stumble"
                  onClick={() => setShown((n) => n + PAGE)}
                >
                  load {Math.min(more, PAGE)} more ▾
                </button>
                <span className="arcade-vault-count">
                  showing {visible.length} of {filtered.length}
                </span>
              </div>
            )}
          </>
        ) : (
          <NedryGag message="Nothing here matches that. Try a different word or clear the filters." />
        )}

        <p className="arcade-vault-foot">
          no feed. just small things worth making. ✦
        </p>
      </section>
    </div>
  );
}
