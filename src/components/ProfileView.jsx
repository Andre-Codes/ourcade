import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GAMES, getGame } from "../data/games.js";
import { themeColor } from "../data/profilePresets.js";
import { RELICS, RELIC_COUNT, relicIcon } from "../data/relics.js";
import { getDiscoveredLegendaries } from "../lib/store.js";

/* ProfileView — the SHARED presentation of an arcade profile. Rendered both on
   the public /u/:username page and on the owner's own /me (PROFILE tab), so the
   two always look the same. `owner` toggles the few owner-only flourishes:
   - awards: the public viewer sees only a COUNT + locked silhouettes; the owner
     sees their actual discovered floppy/disc relics (names, art, dates) read
     from local private state.
   Props: { profile, uid, username, owner } */

// Lazy, guarded cloud import (browser-only seam, same as scores.js/store.js).
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null;
  if (!cloudPromise) cloudPromise = import("../lib/cloud.js").catch(() => null);
  return cloudPromise;
}

const SCORED_GAMES = GAMES.filter((g) => g.score);

function joinLabel(profile) {
  const ts = profile?.createdAt;
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Owner-only: their discovered relics, rarest first, with discovery dates.
function ownerRelics() {
  const found = new Map(getDiscoveredLegendaries().map((f) => [f.id, f.at]));
  return RELICS.filter((r) => found.has(r.id)).map((r) => ({ ...r, at: found.get(r.id) }));
}

export default function ProfileView({ profile: p, uid, username, owner = false }) {
  const [bests, setBests] = useState([]); // [{ game, score }]

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setBests([]);
    (async () => {
      const c = await cloud();
      if (!c) return;
      const rows = await Promise.all(
        SCORED_GAMES.map(async (g) => {
          const entry = await c.readScore(g.id, uid).catch(() => null);
          return entry && typeof entry.score === "number" ? { game: g, score: entry.score } : null;
        })
      );
      if (alive) setBests(rows.filter(Boolean));
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  const name = p?.username || username;
  const accent = themeColor(p?.theme);
  const favGames = (Array.isArray(p?.favorites) ? p.favorites : []).map(getGame).filter(Boolean);
  const join = joinLabel(p);

  // relic count: owner reads live local truth; public reads the mirrored count.
  const myRelics = owner ? ownerRelics() : [];
  const relicCount = owner ? myRelics.length : Number(p?.relicCount || 0);

  // Derived public badges (computed from public data only).
  const badges = ["✔ Claimed"];
  if (favGames.length) badges.push(`⭐ ${favGames.length} favorite${favGames.length > 1 ? "s" : ""}`);
  if (bests.length) badges.push(`🏆 ${bests.length} board${bests.length > 1 ? "s" : ""}`);
  if (relicCount) badges.push(`💾 ${relicCount} relic${relicCount > 1 ? "s" : ""}`);

  return (
    <>
      <div className="arcade-profile-head" style={{ borderColor: accent }}>
        <div className="arcade-profile-avatar" style={{ borderColor: accent }}>
          {p?.avatar || "🕹️"}
        </div>
        <div className="arcade-profile-id">
          <h1 className="arcade-profile-name" style={{ color: accent, textShadow: `0 0 18px ${accent}55` }}>
            {name}
          </h1>
          {p?.bio ? <p className="arcade-profile-bio">{p.bio}</p> : null}
          {p?.number ? (
            <p className="arcade-profile-number">📱 {p.number} — text me on Ourcade</p>
          ) : null}
          {join ? <p className="arcade-profile-join">arcade member since {join}</p> : null}
        </div>
      </div>

      <div className="arcade-profile-badges">
        {badges.map((b) => (
          <span key={b} className="arcade-profile-badge">{b}</span>
        ))}
      </div>

      <section className="arcade-profile-section">
        <h2 className="arcade-profile-section-title">⭐ {name}&apos;s arcade</h2>
        {favGames.length ? (
          <div className="arcade-profile-faves">
            {favGames.map((g) => (
              <Link key={g.id} to={`/play/${g.id}`} className="arcade-profile-fave">
                <span className="arcade-profile-fave-emoji">{g.emoji}</span>
                <span>{g.title}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="arcade-profile-empty">no favorites yet.</p>
        )}
      </section>

      <section className="arcade-profile-section">
        <h2 className="arcade-profile-section-title">🏆 high scores</h2>
        {bests.length ? (
          <div className="arcade-profile-faves">
            {bests
              .slice()
              .sort((a, b) => b.score - a.score)
              .map(({ game, score }) => (
                <Link key={game.id} to={`/scores/${game.id}`} className="arcade-profile-fave">
                  <span className="arcade-profile-fave-emoji">{game.emoji}</span>
                  <span>
                    {game.title}
                    <br />
                    <b style={{ color: accent }}>
                      {game.score?.format ? game.score.format(score) : score}
                    </b>
                  </span>
                </Link>
              ))}
          </div>
        ) : (
          <p className="arcade-profile-empty">no ranked scores yet.</p>
        )}
      </section>

      {/* ── 8-ball relics: owner sees the real haul; everyone else a teaser ── */}
      <section className="arcade-profile-section">
        <h2 className="arcade-profile-section-title">💾 8-ball relics</h2>
        {owner ? (
          myRelics.length ? (
            <div className="arcade-relic-grid">
              {myRelics.map((r) => (
                <div key={r.id} className={`arcade-relic${r.rarity === "mythic" ? " is-mythic" : ""}`}>
                  <img className="arcade-relic-icon" src={relicIcon(r, true)} alt={r.text} />
                  <span className="arcade-relic-text">{r.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="arcade-profile-empty">
              none yet — ask the <Link to="/play/magic-8-ball" className="arcade-back-link">Magic 8-Ball</Link> enough and the rare ones surface.
            </p>
          )
        ) : (
          // public teaser: a count + locked silhouettes, no names/graphics.
          <div className="arcade-relic-teaser">
            <p className="arcade-profile-empty">
              {relicCount > 0
                ? `${relicCount} of ${RELIC_COUNT} relics discovered · the rest stay a mystery 🔒`
                : `no relics discovered yet — they're hidden in the Magic 8-Ball 🔒`}
            </p>
            <div className="arcade-relic-grid">
              {Array.from({ length: RELIC_COUNT }).map((_, i) => (
                <div key={i} className="arcade-relic is-locked">
                  <img className="arcade-relic-icon" src={relicIcon(null, false)} alt="undiscovered relic" />
                  <span className="arcade-relic-text">{i < relicCount ? "✦ found" : "? ? ?"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
