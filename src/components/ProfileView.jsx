import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GAMES, getGame } from "../data/games.js";
import { themeColor } from "../data/profilePresets.js";
import { RELICS, relicIcon } from "../data/relics.js";
import { getDiscoveredLegendaries } from "../lib/store.js";

/* ProfileView — the SHARED presentation of an arcade profile. Rendered both on
   the public /u/:username page and on the owner's own /me (PROFILE tab), so the
   two always look the same. `owner` toggles the few owner-only flourishes:
   - relics: how they're found (the Magic 8-Ball) is a secret, so the profile
     gives nothing away. The public viewer sees ONLY a "relics found" count (no
     total, no silhouettes, no source). The owner sees their actual discovered
     floppy/disc relics (names, art) read from local private state — but only
     once they have at least one; before that the section is hidden entirely.
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

      {/* ── Relics. Where they come from (the Magic 8-Ball) is a secret, so we
           give NOTHING away here. The OWNER sees their own haul only once they
           have at least one — before that the section is hidden entirely (no
           how-to). Everyone ELSE sees only a "relics found" count: no total, no
           silhouettes, no source. ── */}
      {owner
        ? myRelics.length > 0 && (
            <section className="arcade-profile-section">
              <h2 className="arcade-profile-section-title">💾 relics found</h2>
              <div className="arcade-relic-grid">
                {myRelics.map((r) => (
                  <div key={r.id} className={`arcade-relic${r.rarity === "mythic" ? " is-mythic" : ""}`}>
                    <img className="arcade-relic-icon" src={relicIcon(r, true)} alt={r.text} />
                    <span className="arcade-relic-text">{r.text}</span>
                  </div>
                ))}
              </div>
            </section>
          )
        : relicCount > 0 && (
            <section className="arcade-profile-section">
              <h2 className="arcade-profile-section-title">💾 relics found</h2>
              <p className="arcade-profile-empty">
                {relicCount} relic{relicCount > 1 ? "s" : ""} found
              </p>
            </section>
          )}
    </>
  );
}
