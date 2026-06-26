import { useEffect, useMemo } from "react";
import { relicIcon } from "../data/relics.js";
import legendRays from "../assets/legend-rays.png";

/* WalkmanCelebration — the reveal that fires the first time you click the hidden
   discman in Badger's hand and spin up his walkman (a MYTHIC relic). Modeled on
   DenCelebration, but walkman/mixtape-themed: spinning rays, the mythic-disc
   art, confetti, in the chip's violet/aqua palette — NOT the Den's warm sepia
   welcome (that's the phone's beat) nor the crystal-branded crystal reveal (that
   tier is unique to crystal finds). Scoped under `.wm-*` so its styles never
   collide with DenCelebration's `.dc-*` or RelicCelebration's `.rc-*`.

   Props:
     relic  — the relic object ({ id, text, rarity, ... }) just found, or null
     isNew  — false if it was already in the player's collection (re-find)
     onClose — dismiss handler (click anywhere / Escape) */

const CONFETTI_COLORS = ["#b44dff", "#3fffd0", "#7c4dff", "#3fd0ff", "#ff6ad5", "#c8ff3f"];

function Confetti() {
  // Seeded-ish once per mount; purely decorative.
  const bits = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.4 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() < 0.35,
      })),
    []
  );
  return (
    <>
      {bits.map((b, i) => (
        <span
          key={i}
          className="wm-confetti"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            background: b.color,
            borderRadius: b.round ? "50%" : 0,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}
    </>
  );
}

export default function WalkmanCelebration({ relic, isNew = true, onClose }) {
  useEffect(() => {
    if (!relic) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [relic, onClose]);

  if (!relic) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="wm-cele" onClick={onClose} role="dialog" aria-label="Badger's mixtape">
        <img className="wm-rays" src={legendRays} alt="" aria-hidden="true" />
        <Confetti />
        <img className="wm-disc" src={relicIcon(relic, true)} alt={relic.text || "mixtape relic"} />
        <div className="wm-title">🎧 BADGER'S MIXTAPE</div>
        {relic.text && <div className="wm-text">{relic.text}</div>}
        {isNew ? (
          <span className="wm-new">NEW! ADDED TO YOUR RELICS</span>
        ) : (
          <div className="wm-seen">already in your collection</div>
        )}
        <div className="wm-dismiss">— click anywhere to dismiss —</div>
      </div>
    </>
  );
}

const CSS = `
.wm-cele {
  position: fixed; inset: 0; z-index: 60; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 24px; overflow: hidden;
  background: radial-gradient(ellipse at 50% 45%, rgba(20,8,44,.92), rgba(4,5,11,.97) 70%);
  animation: wm-fade .35s ease;
  font-family: 'Share Tech Mono', monospace;
}
@keyframes wm-fade { from { opacity: 0; } to { opacity: 1; } }

.wm-rays {
  position: absolute; top: 50%; left: 50%; z-index: 0; pointer-events: none;
  width: min(130vh, 160vw); height: auto; transform: translate(-50%,-50%);
  filter: saturate(1.3) hue-rotate(180deg);
  animation: wm-rays-fade .8s ease both, wm-spin 24s linear infinite;
}
@keyframes wm-rays-fade { from { opacity: 0; } to { opacity: .5; } }
@keyframes wm-spin { from { transform: translate(-50%,-50%) rotate(0); } to { transform: translate(-50%,-50%) rotate(360deg); } }

.wm-disc, .wm-title, .wm-text, .wm-new, .wm-seen, .wm-dismiss { position: relative; z-index: 2; }
.wm-confetti { z-index: 1; }

.wm-disc {
  width: clamp(140px, 38vw, 256px); height: auto;
  filter: drop-shadow(0 0 28px rgba(124,77,255,.85));
  animation: wm-disc-in .8s cubic-bezier(.2,1.4,.4,1),
    wm-spin-disc 4s linear infinite .8s;
}
@keyframes wm-disc-in { from { opacity: 0; transform: translateY(46px) scale(.4) rotate(-22deg); } to { opacity: 1; transform: none; } }
@keyframes wm-spin-disc { from { transform: rotate(0); } to { transform: rotate(360deg); } }

.wm-title {
  margin-top: 20px; font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: clamp(1.4rem, 6vw, 2.6rem); letter-spacing: 0.06em; color: #fff;
  text-shadow: 0 0 22px rgba(124,77,255,.8), 2px 2px 0 #7c4dff, -2px -2px 0 #3fffd0;
  animation: wm-glow 3.5s ease-in-out infinite;
}
@keyframes wm-glow {
  0%,100% { text-shadow: 0 0 18px rgba(124,77,255,.6), 2px 2px 0 #7c4dff, -2px -2px 0 #3fffd0; }
  50% { text-shadow: 0 0 30px rgba(124,77,255,.95), 2px 2px 0 #7c4dff, -2px -2px 0 #3fffd0; }
}

.wm-text {
  margin-top: 14px; max-width: 32ch; font-size: clamp(0.9rem, 3.6vw, 1.2rem);
  color: #f0eaff; text-shadow: 0 0 10px rgba(124,77,255,.4);
}
.wm-new {
  margin-top: 16px; display: inline-block; transform: rotate(-6deg);
  font-family: 'Press Start 2P', monospace; font-size: 0.66rem; letter-spacing: 0.1em;
  color: #1a0a2e; background: #3fffd0; padding: 7px 12px; border-radius: 6px;
  box-shadow: 0 0 18px #3fffd0; animation: wm-stamp .5s cubic-bezier(.2,1.8,.4,1) .4s both;
}
@keyframes wm-stamp { from { opacity: 0; transform: rotate(-6deg) scale(2.4); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
.wm-seen { margin-top: 16px; font-size: 0.66rem; letter-spacing: 0.2em; text-transform: uppercase; color: #d7c8f0; text-shadow: 0 1px 4px rgba(0,0,0,.6); }
.wm-dismiss { margin-top: 22px; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #b9add6; text-shadow: 0 1px 4px rgba(0,0,0,.6); }

.wm-confetti { position: absolute; top: -16px; opacity: .95; animation: wm-fall linear forwards; }
@keyframes wm-fall { to { transform: translateY(112vh) rotate(720deg); opacity: .2; } }

@media (prefers-reduced-motion: reduce) {
  .wm-rays { animation: wm-rays-fade .8s ease both; }
  .wm-disc { animation: wm-disc-in .5s ease both; }
  .wm-title { animation: none; }
  .wm-confetti { display: none; }
}
`;
