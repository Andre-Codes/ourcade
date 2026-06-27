import { useEffect, useRef, useState } from "react";
import { getSoundboardMuted, setSoundboardMuted } from "../lib/store.js";

// ── Ourcade Soundboard ───────────────────────────────────────────────────────
// Self-contained novelty tool — a tappable grid of recognizable old-internet /
// arcade sounds. Injects its own theme (arcade shell CSS is all `arcade-`
// prefixed). Single screen → the shell's "‹ BACK TO OURCADE" stays visible.
//
// Audio is SELF-HOSTED (not hot-linked) for reliable, CORS-free playback —
// consistent with the project's self-host stance elsewhere. Drop the clips in
// public/sounds/ using the `file` names in SOUNDS below. Any pad whose file is
// missing is hidden automatically (we probe each on mount), so the board only
// ever shows pads that actually play — no broken buttons before files land.
//
// Playback is gesture-gated (a click), which keeps the browser autoplay policy
// happy — same constraint the synthesized blips.js documents.

// Each pad: { id, label, emoji, file }. `file` is relative to public/ (served
// at the site root). Add/rename freely — this table is the single source of
// truth and the grid renders whatever resolves to a real file.
const SOUNDS = [
  // ── present in public/sounds/ ──────────────────────────────────────────────
  { id: "dialup", label: "DIAL-UP", emoji: "📞", file: "sounds/dial-up-modem-sound.mp3" },
  { id: "win98-startup", label: "WIN 98 STARTUP", emoji: "🪟", file: "sounds/windows-98-startup.mp3" },
  { id: "win98-shutdown", label: "WIN 98 SHUTDOWN", emoji: "💤", file: "sounds/windows-98-shutdown.mp3" },
  { id: "winxp-startup", label: "WIN XP STARTUP", emoji: "🟢", file: "sounds/windows-xp-startup.mp3" },
  { id: "winxp-shutdown", label: "WIN XP SHUTDOWN", emoji: "🔴", file: "sounds/windows-xp-shutdown.mp3" },
  { id: "aol-mail", label: "YOU'VE GOT MAIL", emoji: "📬", file: "sounds/aol-you-ve-got-mail.mp3" },
  { id: "skype", label: "SKYPE CALL", emoji: "📲", file: "sounds/skype-call.mp3" },
  { id: "killing-spree", label: "KILLING SPREE", emoji: "💀", file: "sounds/halo-killing-spree.mp3" },
  // ── forward-declared: drop the file in public/sounds/ and the pad appears ───
  { id: "aol-welcome", label: "WELCOME", emoji: "👋", file: "sounds/aol-welcome.mp3" },
  { id: "aol-goodbye", label: "GOODBYE", emoji: "🚪", file: "sounds/aol-goodbye.mp3" },
  { id: "aol-im", label: "IM DOOR", emoji: "💬", file: "sounds/aol-im.mp3" },
  { id: "coin", label: "INSERT COIN", emoji: "🪙", file: "sounds/coin.mp3" },
  { id: "oneup", label: "1-UP", emoji: "⬆️", file: "sounds/1up.mp3" },
  { id: "error", label: "ERROR", emoji: "❌", file: "sounds/error.mp3" },
  { id: "pager", label: "PAGER", emoji: "📟", file: "sounds/pager.mp3" },
  { id: "busy", label: "BUSY SIGNAL", emoji: "📵", file: "sounds/busy.mp3" },
  { id: "type", label: "KEYBOARD", emoji: "⌨️", file: "sounds/type.mp3" },
  { id: "tada", label: "TA-DA", emoji: "🎉", file: "sounds/tada.mp3" },
  { id: "ding", label: "DING", emoji: "🔔", file: "sounds/ding.mp3" },
];

const PAD_COLORS = [
  "#3fffd0", "#ffd23f", "#b44dff", "#ff6a8a",
  "#3fa9ff", "#e8ff47", "#ff8a3d", "#4db5ff",
];

// Probe a URL by trying to load it as audio metadata. Resolves true if the
// browser can fetch + decode enough to play it, false on 404/decode error.
function probe(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      a.removeAttribute("src");
      resolve(ok);
    };
    a.preload = "metadata";
    a.oncanplaythrough = () => finish(true);
    a.onloadedmetadata = () => finish(true);
    a.onerror = () => finish(false);
    a.src = url;
    // Safety timeout — treat a slow/never-answering probe as missing.
    setTimeout(() => finish(false), 6000);
  });
}

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #07080f;
    color: #eef0ff;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }

  .sb-app {
    min-height: 100vh; padding: 28px 16px 80px;
    display: flex; flex-direction: column; align-items: center;
    background:
      radial-gradient(ellipse 60% 45% at 50% 0%, rgba(63,169,255,.12), transparent 70%),
      radial-gradient(ellipse 50% 50% at 50% 100%, rgba(180,77,255,.08), transparent 65%),
      #07080f;
  }

  .sb-head { text-align: center; margin-bottom: 8px; }
  .sb-head h1 {
    font-family: 'Black Ops One', 'Impact', sans-serif;
    font-size: clamp(2rem, 7vw, 3.2rem); letter-spacing: 0.05em;
    background: linear-gradient(180deg, #fff, #3fa9ff 60%, #b44dff 120%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 0 28px rgba(63,169,255,.35);
  }
  .sb-head .sub {
    font-size: 0.62rem; letter-spacing: 0.3em; text-transform: uppercase;
    color: #6b708f; margin-top: 6px;
  }

  .sb-controls { margin: 14px 0 22px; display: flex; gap: 10px; align-items: center; }
  .sb-pill {
    font-family: 'Press Start 2P', monospace; font-size: 0.56rem; letter-spacing: 0.06em;
    padding: 9px 12px; border-radius: 8px; cursor: pointer;
    color: #eef0ff; background: #0e101a; border: 2px solid #2a2f4a;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .sb-pill:hover { border-color: #3fa9ff; }

  .sb-grid {
    display: grid; gap: 14px; width: min(720px, 96vw);
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .sb-pad {
    aspect-ratio: 1 / 1; border-radius: 14px; cursor: pointer;
    background: #0e101a; border: 2px solid var(--c, #3fffd0);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; padding: 10px; text-align: center; color: #eef0ff;
    box-shadow: inset 0 0 22px rgba(0,0,0,.5);
    transition: transform .08s ease, box-shadow .15s ease, background .15s ease;
  }
  .sb-pad:hover { box-shadow: inset 0 0 22px rgba(0,0,0,.5), 0 0 16px var(--c, #3fffd0); }
  .sb-pad:active { transform: scale(.95); }
  .sb-pad.playing {
    background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--c) 22%, #0e101a), #0e101a 75%);
    box-shadow: 0 0 24px var(--c, #3fffd0), inset 0 0 22px rgba(0,0,0,.4);
    animation: sb-pulse .5s ease;
  }
  @keyframes sb-pulse {
    0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); }
  }
  .sb-pad-emoji { font-size: clamp(1.8rem, 7vw, 2.6rem); line-height: 1; }
  .sb-pad-label {
    font-family: 'Press Start 2P', monospace; font-size: 0.5rem; letter-spacing: 0.06em;
    color: var(--c, #3fffd0); line-height: 1.5;
  }

  .sb-empty {
    width: min(560px, 94vw); text-align: center; margin-top: 30px;
    padding: 26px; border: 2px dashed #2a2f4a; border-radius: 14px;
    color: #9fb4ff; font-size: 0.86rem; line-height: 1.7;
  }
  .sb-empty code {
    color: #ffd23f; font-family: 'Share Tech Mono', monospace;
    background: #161a2b; padding: 2px 6px; border-radius: 5px;
  }

  .sb-loading { margin-top: 36px; color: #6b708f; letter-spacing: 0.2em; text-transform: uppercase; font-size: 0.7rem; }

  .sb-hint {
    margin-top: 26px; font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: #6b708f; text-align: center;
  }
`;

export default function Soundboard() {
  const [available, setAvailable] = useState(null); // null = probing; [] = none found
  const [muted, setMuted] = useState(() => getSoundboardMuted());
  const [playingId, setPlayingId] = useState(null);
  const audioCache = useRef(new Map()); // id → HTMLAudioElement (lazy)
  const flashTimer = useRef(null);

  // Probe every clip once on mount; keep only the ones that actually resolve.
  useEffect(() => {
    let alive = true;
    Promise.all(SOUNDS.map((s) => probe(s.file).then((ok) => (ok ? s : null)))).then(
      (results) => {
        if (alive) setAvailable(results.filter(Boolean));
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const play = (sound) => {
    // visual pulse fires regardless of mute
    setPlayingId(sound.id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setPlayingId(null), 520);

    if (muted) return;
    let el = audioCache.current.get(sound.id);
    if (!el) {
      el = new Audio(sound.file);
      el.preload = "auto";
      audioCache.current.set(sound.id, el);
    }
    try {
      el.currentTime = 0; // retrigger on rapid taps
      el.play().catch(() => {});
    } catch {
      /* play() can throw if not yet loaded — the catch above handles the rest */
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundboardMuted(next);
    if (next) {
      // hush anything mid-playback
      audioCache.current.forEach((el) => {
        try {
          el.pause();
        } catch {
          /* ignore */
        }
      });
    }
  };

  return (
    <>
      <style>{style}</style>
      <div className="sb-app">
        <div className="sb-head">
          <h1>OURCADE SOUNDBOARD</h1>
          <div className="sub">tap a pad · relive the old internet</div>
        </div>

        <div className="sb-controls">
          <button
            className="sb-pill"
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? "🔇 MUTED" : "🔊 SOUND ON"}
          </button>
        </div>

        {available === null && <div className="sb-loading">warming up the tape deck…</div>}

        {available !== null && available.length === 0 && (
          <div className="sb-empty">
            No sound clips found yet. Drop your <code>.mp3</code> files into{" "}
            <code>public/sounds/</code> using the filenames in{" "}
            <code>SOUNDS</code> (e.g. <code>dialup.mp3</code>, <code>coin.mp3</code>),
            then reload — pads appear automatically for each file present.
          </div>
        )}

        {available && available.length > 0 && (
          <div className="sb-grid">
            {available.map((s, i) => {
              const c = PAD_COLORS[i % PAD_COLORS.length];
              return (
                <button
                  key={s.id}
                  className={`sb-pad${playingId === s.id ? " playing" : ""}`}
                  style={{ "--c": c }}
                  onClick={() => play(s)}
                  aria-label={`Play ${s.label}`}
                >
                  <span className="sb-pad-emoji" aria-hidden="true">{s.emoji}</span>
                  <span className="sb-pad-label">{s.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="sb-hint">— tap fast. nobody&apos;s stopping you. —</div>
      </div>
    </>
  );
}
