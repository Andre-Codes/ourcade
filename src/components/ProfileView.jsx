import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GAMES, getGame } from "../data/games.js";
import { themeColor } from "../data/profilePresets.js";
import { ALL_RELICS, relicIcon } from "../data/relics.js";
import { getDiscoveredRelics, getTop8, removeTop8, lsGetJSON } from "../lib/store.js";
import { resolveTop8 } from "../data/content.js";
import { renderContactCard } from "../lib/contactCard.js";
import { shareImage } from "../lib/share.js";

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

// Owner-only "share my number": renders the profile to a PNG contact card and
// hands it to the OS share sheet (or downloads it + copies the profile link on
// desktop). The shared link points at the public /u/:username page so whoever
// receives it lands somewhere they can text back.
function ShareNumberButton({ profile }) {
  const [status, setStatus] = useState(null); // "busy" | "saved" | "failed" | null
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "busy") return;
    setStatus("busy");
    try {
      const blob = await renderContactCard({
        number: profile.number,
        username: profile.username,
        avatar: profile.avatar,
        bio: profile.bio,
      });
      const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
      const url = `${base}#/u/${profile.username}`;
      const result = await shareImage({
        blob,
        filename: `ourcade-${profile.username}.png`,
        title: "My Ourcade number",
        text: `📱 my Ourcade number: ${profile.number} — text me on Ourcade`,
        url,
      });
      setStatus(result === "saved" ? "saved" : result === "failed" ? "failed" : null);
    } catch {
      setStatus("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 1800);
  };

  const label =
    status === "busy" ? "…" : status === "saved" ? "✓ Saved!" : status === "failed" ? "Failed" : "📇 Share my number";

  return (
    <button type="button" className="arcade-share is-contact" onClick={onClick}>
      {label}
    </button>
  );
}

function joinLabel(profile) {
  const ts = profile?.createdAt;
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Owner-only: their discovered relics (any source), rarest first, with dates.
function ownerRelics() {
  const found = new Map(getDiscoveredRelics().map((f) => [f.id, f.at]));
  return ALL_RELICS.filter((r) => found.has(r.id)).map((r) => ({ ...r, at: found.get(r.id) }));
}

// A read popup for Top 8 items that have no destination of their own (a game
// fact, say) — tapping the tile opens the full text here. Closes on the ✕,
// backdrop click, or Escape.
function Top8Popup({ item: it, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kicker = { fact: "💡 game fact", curiosity: "🌌 curiosity", weird: "🔍 weird thing" }[it.type] || it.icon;
  return (
    <div className="arcade-top8-modal-bg" onClick={onClose}>
      <div
        className="arcade-top8-modal"
        role="dialog"
        aria-modal="true"
        aria-label={it.sub || it.type}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="arcade-top8-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
        <span className="arcade-top8-modal-kicker">{kicker}</span>
        <p className="arcade-top8-modal-body">{it.title}</p>
      </div>
    </div>
  );
}

// One Top 8 slot. Games link to /play (internal), curiosity/weird/flash open
// their source in a new tab. Items with no destination of their own (facts) are
// tappable too — they open a read popup with the full text. The owner gets a ✕
// to clear the slot (stopPropagation so it never triggers the tile's action).
function Top8Tile({ item: it, owner, onRemove }) {
  const [open, setOpen] = useState(false);
  const inner = (
    <>
      <span className="arcade-profile-fave-emoji">{it.icon}</span>
      <span>{it.title}</span>
    </>
  );
  const remove = owner ? (
    <button
      type="button"
      className="arcade-top8-remove"
      title="Remove from your Top 8"
      aria-label="Remove from your Top 8"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove(it.type, it.id);
      }}
    >
      ✕
    </button>
  ) : null;

  if (it.to) {
    return (
      <Link to={it.to} className="arcade-profile-fave arcade-top8-tile">
        {inner}
        {remove}
      </Link>
    );
  }
  if (it.href) {
    return (
      <a
        href={it.href}
        target="_blank"
        rel="noopener noreferrer"
        className="arcade-profile-fave arcade-top8-tile"
      >
        {inner}
        {remove}
      </a>
    );
  }
  // No link of its own → a button that pops up the full text to read. The owner's
  // ✕ is a sibling (a <button> can't nest a <button>), positioned by the wrapper.
  return (
    <div className="arcade-top8-tilewrap">
      <button
        type="button"
        className="arcade-profile-fave arcade-top8-tile is-static"
        title="Tap to read"
        onClick={() => setOpen(true)}
      >
        {inner}
      </button>
      {remove}
      {open && <Top8Popup item={it} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function ProfileView({ profile: p, uid, username, owner = false }) {
  const [bests, setBests] = useState([]); // [{ game, score }]

  // Top 8: the owner reads live local truth (so a just-hearted item shows at
  // once + can be removed here), staying in sync via the shared store event; a
  // public viewer reads the mirrored profile array. Same split as relics.
  const [ownerTop8, setOwnerTop8] = useState(() => (owner ? getTop8() : []));
  useEffect(() => {
    if (!owner) return;
    const sync = () => setOwnerTop8(getTop8());
    sync();
    window.addEventListener("ourcade:storechange", sync);
    return () => window.removeEventListener("ourcade:storechange", sync);
  }, [owner]);

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

  // best Daily Relic Run streak: owner reads local truth; public reads mirror.
  const relicRunStreak = owner
    ? Number(lsGetJSON("relic:streak", null)?.best || 0)
    : Number(p?.relicRunStreak || 0);

  // Top 8: owner = live local; public = mirrored array. Resolve each { type, id }
  // to display info, dropping any that no longer resolve (removed/renamed item).
  const rawTop8 = owner ? ownerTop8 : Array.isArray(p?.top8) ? p.top8 : [];
  const top8 = rawTop8.map(resolveTop8).filter(Boolean);

  // Derived public badges (computed from public data only).
  const badges = ["✔ Claimed"];
  if (favGames.length) badges.push(`⭐ ${favGames.length} favorite${favGames.length > 1 ? "s" : ""}`);
  if (top8.length) badges.push(`❤️ Top ${top8.length}`);
  if (bests.length) badges.push(`🏆 ${bests.length} board${bests.length > 1 ? "s" : ""}`);
  if (relicCount) badges.push(`💾 ${relicCount} relic${relicCount > 1 ? "s" : ""}`);
  if (relicRunStreak > 1) badges.push(`🏺 ${relicRunStreak}-day relic streak`);

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
          {owner && p?.number && (p?.username || username) ? (
            <ShareNumberButton
              profile={{
                number: p.number,
                username: p.username || username,
                avatar: p.avatar,
                bio: p.bio,
              }}
            />
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

      {/* ── Top 8 — a MySpace-style showcase of anything in the arcade (flash,
           curiosity, fact, weird thing, game). Visible to every viewer; the owner
           also gets a ✕ to clear a slot. Hidden for visitors when empty. ── */}
      {(owner || top8.length > 0) && (
        <section className="arcade-profile-section">
          <h2 className="arcade-profile-section-title">❤️ {name}&apos;s Top 8</h2>
          {top8.length ? (
            <div className="arcade-profile-faves">
              {top8.map((it) => (
                <Top8Tile key={`${it.type}:${it.id}`} item={it} owner={owner} onRemove={removeTop8} />
              ))}
            </div>
          ) : (
            <p className="arcade-profile-empty">no Top 8 yet — tap the ❤️ on anything around the arcade.</p>
          )}
        </section>
      )}

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
                  <div key={r.id} className={`arcade-relic${r.rarity === "crystal" ? " is-crystal" : r.rarity === "mythic" ? " is-mythic" : ""}`}>
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
