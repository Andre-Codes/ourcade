import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { GAMES, getGame } from "../data/games.js";
import { themeColor } from "../data/profilePresets.js";
import NedryGag from "./NedryGag.jsx";

/* /u/:username — a user's PUBLIC arcade. Resolves username → uid → the public
   profiles/{uid} doc, then renders only public material: avatar, bio, themed
   accent, their ⭐ favorites ("their arcade"), 🏆 per-game bests, join date,
   and derived badges. Private state (8-ball legends, streak — on users/{uid})
   never appears here; that stays on the owner's own /me. */

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
  // Firestore Timestamp → Date (has toDate); tolerate plain/missing values.
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function ProfilePage() {
  const { username } = useParams();
  const [state, setState] = useState({ status: "loading", profile: null, uid: null });
  const [bests, setBests] = useState([]); // [{ game, score }]

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", profile: null, uid: null });
    setBests([]);
    (async () => {
      const c = await cloud();
      if (!c) {
        if (alive) setState({ status: "error", profile: null, uid: null });
        return;
      }
      const uid = await c.resolveUsername(username).catch(() => null);
      if (!uid) {
        if (alive) setState({ status: "notfound", profile: null, uid: null });
        return;
      }
      const profile = await c.readProfile(uid).catch(() => null);
      if (!alive) return;
      setState({ status: profile ? "ok" : "notfound", profile, uid });
      if (!profile) return;
      // Per-game bests: read this user's entry on each scored board.
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
  }, [username]);

  const Shell = (inner) => (
    <div className="arcade-stage">
      <div className="arcade-cabinet-chrome">
        <Link to="/" className="arcade-back" title="Back to Ourcade" aria-label="Back to Ourcade">
          ‹ BACK TO OURCADE
        </Link>
        <span className="arcade-cabinet-badge" aria-hidden="true">OURCADE</span>
      </div>
      <div className="arcade-profile">{inner}</div>
    </div>
  );

  if (state.status === "loading") return Shell(<p className="arcade-profile-empty">loading profile…</p>);
  if (state.status !== "ok" || !state.profile) {
    return Shell(
      <div className="arcade-notfound">
        <NedryGag message={`No arcade for "${username}".`} />
        <Link to="/" className="arcade-back-link">← Back to Ourcade</Link>
      </div>
    );
  }

  const p = state.profile;
  const accent = themeColor(p.theme);
  const favGames = (Array.isArray(p.favorites) ? p.favorites : [])
    .map(getGame)
    .filter(Boolean);
  const join = joinLabel(p);

  // Derived public badges (computed from public data only).
  const badges = [];
  badges.push("✔ Claimed");
  if (favGames.length) badges.push(`⭐ ${favGames.length} favorite${favGames.length > 1 ? "s" : ""}`);
  if (bests.length) badges.push(`🏆 ${bests.length} board${bests.length > 1 ? "s" : ""}`);

  return Shell(
    <>
      <div className="arcade-profile-head" style={{ borderColor: accent }}>
        <div className="arcade-profile-avatar" style={{ borderColor: accent }}>
          {p.avatar || "🕹️"}
        </div>
        <div className="arcade-profile-id">
          <h1 className="arcade-profile-name" style={{ color: accent, textShadow: `0 0 18px ${accent}55` }}>
            {p.username || username}
          </h1>
          {p.bio ? <p className="arcade-profile-bio">{p.bio}</p> : null}
          {join ? <p className="arcade-profile-join">arcade member since {join}</p> : null}
        </div>
      </div>

      <div className="arcade-profile-badges">
        {badges.map((b) => (
          <span key={b} className="arcade-profile-badge">{b}</span>
        ))}
      </div>

      <section className="arcade-profile-section">
        <h2 className="arcade-profile-section-title">⭐ {p.username || username}&apos;s arcade</h2>
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
    </>
  );
}
