import { useEffect, useState } from "react";
import { embedUrl, randomAnimation } from "../data/animations.js";
import ShareButton from "./ShareButton.jsx";
import Top8HeartButton from "./Top8HeartButton.jsx";

// Lean-back "channel": roams the WHOLE pool, auto-advancing on a timer. We can't
// know when a SWF actually ends (archive.org is a cross-origin iframe, no end
// event), so advance is time-based — Pause to dwell on a longer piece, Next to
// skip. key={anim.id} on the iframe forces a clean reload each change.
const ADVANCE_MS = 90000; // ~90s per short

export default function FlashChannel() {
  const [anim, setAnim] = useState(null);
  const [playing, setPlaying] = useState(true);

  // first pick once the lazy pool chunk has loaded
  useEffect(() => {
    let alive = true;
    randomAnimation().then((a) => alive && setAnim(a));
    return () => {
      alive = false;
    };
  }, []);

  const next = async () => {
    const a = await randomAnimation(anim?.id);
    if (a) setAnim(a);
  };

  // auto-advance — re-armed whenever the current short (or play state) changes
  useEffect(() => {
    if (!playing || !anim) return;
    const t = setTimeout(next, ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, anim]);

  if (!anim) return <p className="arcade-channel-loading">tuning in…</p>;

  return (
    <div className="arcade-flash arcade-channel">
      <div className="arcade-flash-head">
        <span className="arcade-widget-kicker">📺 FLASH CHANNEL</span>
        <span className="arcade-channel-live">{playing ? "● LIVE" : "❚❚ PAUSED"}</span>
      </div>

      <div
        className="arcade-flash-screen"
        style={anim.aspect ? { "--flash-aspect": anim.aspect } : undefined}
      >
        <iframe
          key={anim.id}
          className="arcade-flash-frame"
          src={embedUrl(anim)}
          title={anim.title}
          allowFullScreen
        />
      </div>

      <p className="arcade-flash-meta">
        <span className="arcade-flash-title">{anim.title}</span>
        {anim.creator && <span className="arcade-flash-by"> · by {anim.creator}</span>}
        {anim.year && <span className="arcade-flash-year"> ({anim.year})</span>}
      </p>

      <div className="arcade-channel-controls">
        <button
          type="button"
          className="arcade-stumble"
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? "❚❚ PAUSE" : "▶ PLAY"}
        </button>
        <button type="button" className="arcade-stumble" onClick={next}>
          ⏭ NEXT
        </button>
        <ShareButton
          label="Share"
          title="Ourcade — Flash Channel"
          text={`Watching "${anim.title}"${anim.creator ? ` by ${anim.creator}` : ""} on the Ourcade Flash Channel`}
        />
        <Top8HeartButton
          type="flash"
          id={anim.id}
          extra={{ title: anim.title }}
          title={anim.title}
        />
      </div>

      <p className="arcade-channel-note">
        {playing
          ? "rolling through the archive — a new short every 90s. pause to stay a while."
          : "paused — hit play to resume the channel, or skip ahead."}
      </p>
    </div>
  );
}
