import { useEffect, useMemo } from "react";
import { relicIcon } from "../data/relics.js";
import legendRays from "../assets/legend-rays.png";

/* DenCelebration — the reveal that fires when you LEAVE the phone after Byte
   Badger let you into the den (the "wassup" easter egg awards a MYTHIC relic).
   Modeled on RelicCelebration, but den/phone-themed: a warm badger welcome, the
   mythic-disc art, confetti — NOT the crystal-branded crystal reveal (that tier
   is unique to crystal finds). Scoped under `.dc-*` so its styles never collide
   with RelicCelebration's `.rc-*`.

   It's deliberately deferred to phone-close (see PhoneProvider): the chat stays
   immersive, and stepping out of the phone is the rewarding beat.

   Props:
     relic  — the relic object ({ id, text, rarity, ... }) just found, or null
     isNew  — false if it was already in the player's collection (re-find)
     onClose — dismiss handler (click anywhere / Escape) */

const CONFETTI_COLORS = ["#ffd23f", "#3fffd0", "#ff9b3f", "#b44dff", "#3fd0ff", "#ff6ad5"];

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
          className="dc-confetti"
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

export default function DenCelebration({ relic, isNew = true, onClose }) {
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
      <div className="dc-cele" onClick={onClose} role="dialog" aria-label="Byte Badger's den">
        <img className="dc-rays" src={legendRays} alt="" aria-hidden="true" />
        <Confetti />
        <img className="dc-disc" src={relicIcon(relic, true)} alt={relic.text || "den relic"} />
        <div className="dc-title">🦡 WELCOME TO THE DEN</div>
        {relic.text && <div className="dc-text">{relic.text}</div>}
        {isNew ? (
          <span className="dc-new">NEW! ADDED TO YOUR RELICS</span>
        ) : (
          <div className="dc-seen">already in your collection</div>
        )}
        <div className="dc-dismiss">— click anywhere to dismiss —</div>
      </div>
    </>
  );
}

const CSS = `
.dc-cele {
  position: fixed; inset: 0; z-index: 60; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 24px; overflow: hidden;
  background: radial-gradient(ellipse at 50% 45%, rgba(44,32,6,.92), rgba(8,6,2,.97) 70%);
  animation: dc-fade .35s ease;
  font-family: 'Share Tech Mono', monospace;
}
@keyframes dc-fade { from { opacity: 0; } to { opacity: 1; } }

.dc-rays {
  position: absolute; top: 50%; left: 50%; z-index: 0; pointer-events: none;
  width: min(130vh, 160vw); height: auto; transform: translate(-50%,-50%);
  filter: sepia(.6) saturate(1.4) hue-rotate(-8deg);
  animation: dc-rays-fade .8s ease both, dc-spin 24s linear infinite;
}
@keyframes dc-rays-fade { from { opacity: 0; } to { opacity: .5; } }
@keyframes dc-spin { from { transform: translate(-50%,-50%) rotate(0); } to { transform: translate(-50%,-50%) rotate(360deg); } }

.dc-disc, .dc-title, .dc-text, .dc-new, .dc-seen, .dc-dismiss { position: relative; z-index: 2; }
.dc-confetti { z-index: 1; }

.dc-disc {
  width: clamp(140px, 38vw, 256px); height: auto;
  filter: drop-shadow(0 0 28px rgba(255,210,63,.85));
  animation: dc-disc-in .8s cubic-bezier(.2,1.4,.4,1),
    dc-float 3s ease-in-out infinite .8s;
}
@keyframes dc-disc-in { from { opacity: 0; transform: translateY(46px) scale(.4) rotate(-22deg); } to { opacity: 1; transform: none; } }
@keyframes dc-float { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-14px) rotate(3deg); } }

.dc-title {
  margin-top: 20px; font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: clamp(1.4rem, 6vw, 2.6rem); letter-spacing: 0.06em; color: #fff;
  text-shadow: 0 0 22px rgba(255,210,63,.8), 2px 2px 0 #b4791f, -2px -2px 0 #3fffd0;
  animation: dc-glow 3.5s ease-in-out infinite;
}
@keyframes dc-glow {
  0%,100% { text-shadow: 0 0 18px rgba(255,210,63,.6), 2px 2px 0 #b4791f, -2px -2px 0 #3fffd0; }
  50% { text-shadow: 0 0 30px rgba(255,210,63,.95), 2px 2px 0 #b4791f, -2px -2px 0 #3fffd0; }
}

.dc-text {
  margin-top: 14px; max-width: 32ch; font-size: clamp(0.9rem, 3.6vw, 1.2rem);
  color: #fff7e6; text-shadow: 0 0 10px rgba(255,210,63,.4);
}
.dc-new {
  margin-top: 16px; display: inline-block; transform: rotate(-6deg);
  font-family: 'Press Start 2P', monospace; font-size: 0.66rem; letter-spacing: 0.1em;
  color: #2a1e02; background: #ffd23f; padding: 7px 12px; border-radius: 6px;
  box-shadow: 0 0 18px #ffd23f; animation: dc-stamp .5s cubic-bezier(.2,1.8,.4,1) .4s both;
}
@keyframes dc-stamp { from { opacity: 0; transform: rotate(-6deg) scale(2.4); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
.dc-seen { margin-top: 16px; font-size: 0.66rem; letter-spacing: 0.2em; text-transform: uppercase; color: #c2a35f; }
.dc-dismiss { margin-top: 22px; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #8a7a5f; }

.dc-confetti { position: absolute; top: -16px; opacity: .95; animation: dc-fall linear forwards; }
@keyframes dc-fall { to { transform: translateY(112vh) rotate(720deg); opacity: .2; } }

@media (prefers-reduced-motion: reduce) {
  .dc-rays { animation: dc-rays-fade .8s ease both; }
  .dc-disc { animation: dc-disc-in .5s ease both; }
  .dc-title { animation: none; }
  .dc-confetti { display: none; }
}
`;
