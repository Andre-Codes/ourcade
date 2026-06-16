import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FEATURED,
  embedUrl,
  getTodaysAnimation,
  randomAnimation,
} from "../data/animations.js";
import ShareButton from "./ShareButton.jsx";
import Top8HeartButton from "./Top8HeartButton.jsx";

// Shared by the daily band (compact) and the /flash page (full). Renders today's
// featured animation as an archive.org embed; STUMBLE swaps in a random one from
// the whole pool IN PLACE (no navigation). key={anim.id} forces a clean iframe
// remount so the new SWF actually reloads on swap. The full pool loads lazily on
// the first stumble (randomAnimation is async), so there's a brief busy state.
export default function FlashTheater({ dayKey, compact = false, browseTo, initialAnim }) {
  const [anim, setAnim] = useState(
    () => initialAnim || getTodaysAnimation(dayKey) || FEATURED[0]
  );
  const [busy, setBusy] = useState(false);
  // archive.org embeds occasionally fail to load (rate limits, dead ids); show a
  // graceful note instead of a blank screen. Reset whenever the short changes.
  const [failed, setFailed] = useState(false);
  if (!anim) return null;

  const stumble = async () => {
    setBusy(true);
    setFailed(false);
    const next = await randomAnimation(anim.id);
    if (next) setAnim(next);
    setBusy(false);
  };

  return (
    <div className={`arcade-flash${compact ? " is-compact" : ""}`}>
      <div className="arcade-flash-head">
        <span className="arcade-widget-kicker">📼 FLASH THEATER</span>
        {browseTo && (
          <Link to={browseTo} className="arcade-flash-browse">
            📺 the channel →
          </Link>
        )}
      </div>

      <div
        className="arcade-flash-screen"
        style={anim.aspect ? { "--flash-aspect": anim.aspect } : undefined}
      >
        {failed ? (
          <div className="arcade-flash-frame arcade-flash-fallback">
            <p>📼 this reel won’t play right now — try another.</p>
          </div>
        ) : (
          <iframe
            key={anim.id}
            className="arcade-flash-frame"
            src={embedUrl(anim)}
            title={anim.title}
            allowFullScreen
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
      </div>

      <p className="arcade-flash-meta">
        <span className="arcade-flash-title">{anim.title}</span>
        {anim.creator && <span className="arcade-flash-by"> · by {anim.creator}</span>}
        {anim.year && <span className="arcade-flash-year"> ({anim.year})</span>}
      </p>

      <p className="arcade-flash-note">📱 best viewed in landscape</p>

      <div className="arcade-flash-actions">
        <button
          type="button"
          className="arcade-stumble arcade-flash-stumble"
          onClick={stumble}
          disabled={busy}
        >
          {busy ? "🎲 loading…" : "🎲 STUMBLE — another animation"}
        </button>
        <ShareButton
          label="Share"
          title="Ourcade — Flash Theater"
          text={`"${anim.title}"${anim.creator ? ` by ${anim.creator}` : ""} on Ourcade Flash Theater`}
        />
        <Top8HeartButton
          type="flash"
          id={anim.id}
          extra={{ title: anim.title }}
          title={anim.title}
        />
      </div>
    </div>
  );
}
