import { useEffect, useRef, useState } from "react";
import { shuffled } from "../data/walkman.js";
import { loadYouTubeAPI } from "../lib/youtube.js";

/* Badger's walkman — the audio half of the discman easter egg.
   Controlled by Home: `on` flips true when the user clicks the discman hotspot
   (a real gesture, so autoplay-WITH-sound is allowed). We spin up a hidden
   YouTube IFrame player offscreen and show only a small "now playing" chip with
   skip / stop. No video is shown — this is background audio.

   The player is built imperatively into a child of our stable wrapper div (not
   directly on a React-owned node): the YT API replaces/removes the element it's
   handed, so letting it chew on a throwaway child keeps React from later
   tripping over a node that vanished from under it. */
export default function Walkman({ on, onStop }) {
  const wrapRef = useRef(null);
  const playerRef = useRef(null);
  const orderRef = useRef([]); // this session's shuffled order, so we can map index → our track metadata
  const [now, setNow] = useState("");
  const [started, setStarted] = useState(false); // has playback ever begun? gates Play→Next button

  useEffect(() => {
    if (!on) return;
    let cancelled = false;

    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || !wrapRef.current) return;
        const mount = document.createElement("div");
        wrapRef.current.appendChild(mount);

        playerRef.current = new YT.Player(mount, {
          width: "1",
          height: "1",
          playerVars: { autoplay: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
          events: {
            // Argument form (array of video IDs) — the object form only takes a
            // real playlist/search list, not an ad-hoc list of ids. loadPlaylist
            // cues from index 0; we then explicitly playVideo() to attempt a real
            // autostart (the discman click is a user gesture, so this usually
            // works). If the browser's autoplay policy blocks it anyway, the
            // transport button falls back to a ▶ Play control until the first
            // PLAYING event (see `started` below).
            onReady: (e) => {
              orderRef.current = shuffled();
              e.target.loadPlaylist(orderRef.current.map((t) => t.id));
              e.target.playVideo?.();
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                setStarted(true); // playback has begun → button becomes ⏭ Next
                // Use OUR clean metadata (Song — Artist) over YouTube's raw,
                // often-messy video title. Map the current playlist position
                // back to our shuffled order; fall back to the video id.
                const idx = e.target.getPlaylistIndex?.();
                const vid = e.target.getVideoData?.()?.video_id;
                const t = orderRef.current[idx] || orderRef.current.find((x) => x.id === vid);
                if (t) setNow(`${t.title} — ${t.artist}`);
              }
            },
            // Dead / region-locked / embed-disabled track — skip past it so a
            // stale id can't stall the mix.
            onError: (e) => {
              try {
                e.target.nextVideo();
              } catch {
                /* player gone — ignore */
              }
            },
          },
        });
      })
      .catch(() => {
        /* API failed to load (offline / blocked) — the easter egg just no-ops */
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* already torn down — ignore */
      }
      playerRef.current = null;
      if (wrapRef.current) wrapRef.current.innerHTML = "";
      setNow("");
      setStarted(false);
    };
  }, [on]);

  // Fallback for when autoplay was blocked: kick playback off the user's tap.
  const play = () => {
    try {
      playerRef.current?.playVideo?.();
    } catch {
      /* ignore */
    }
  };

  const next = () => {
    try {
      playerRef.current?.nextVideo?.();
    } catch {
      /* ignore */
    }
  };

  const stop = () => {
    try {
      playerRef.current?.stopVideo?.();
    } catch {
      /* ignore */
    }
    onStop?.();
  };

  return (
    <>
      <div ref={wrapRef} className="arcade-walkman-host" aria-hidden="true" />
      {on && (
        <div className="arcade-walkman-chip" role="status" aria-live="polite">
          <span className="arcade-walkman-eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="arcade-walkman-now">
            📻 <span className="arcade-walkman-marquee">{now || "spinning up…"}</span>
          </span>
          {started ? (
            <button
              type="button"
              className="arcade-walkman-btn"
              onClick={next}
              aria-label="Next track"
              title="next track"
            >
              ⏭
            </button>
          ) : (
            <button
              type="button"
              className="arcade-walkman-btn"
              onClick={play}
              aria-label="Play"
              title="play"
            >
              ▶
            </button>
          )}
          <button
            type="button"
            className="arcade-walkman-btn"
            onClick={stop}
            aria-label="Stop music"
            title="stop"
          >
            ⏹
          </button>
        </div>
      )}
    </>
  );
}
