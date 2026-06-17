import { useEffect, useMemo } from "react";
import { relicIcon } from "../data/relics.js";
import legendRays from "../assets/legend-rays.png";

/* RelicCelebration — the GRAND, site-wide reveal for unearthing a top-tier
   "crystal" relic (the crystal cartridge). This is the crystal tier's signature
   moment: spinning legend-rays, the cartridge floating in, confetti, a glitchy
   prismatic title. ANY easter egg anywhere on the site that awards a crystal
   relic should pop this — call it with the relic you just granted.

   Self-contained: it ships its own scoped `.rc-*` styles and a fixed full-screen
   overlay, so it works from inside any cabinet/page without depending on that
   host's CSS (unlike the 8-Ball's tool-scoped eb-cele). Lesser tiers (floppy/CD)
   are intentionally NOT celebrated here — they use their own lighter reveal — so
   the crystal moment stays unique.

   Props:
     relic  — the relic object ({ id, text, rarity, ... }) just found, or null
     isNew  — false if it was already in the player's collection (re-find)
     onClose — dismiss handler (click anywhere / Escape) */

const CONFETTI_COLORS = ["#3fffd0", "#b44dff", "#ffd23f", "#3fd0ff", "#ff6ad5", "#5dff9b"];

function Confetti() {
  // Seeded-ish once per mount; purely decorative.
  const bits = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
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
          className="rc-confetti"
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

export default function RelicCelebration({ relic, isNew = true, onClose }) {
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
      <div className="rc-cele" onClick={onClose} role="dialog" aria-label="Crystal relic discovered">
        <img className="rc-rays" src={legendRays} alt="" aria-hidden="true" />
        <Confetti />
        <img className="rc-cartridge" src={relicIcon(relic, true)} alt={relic.text || "crystal relic"} />
        <div className="rc-title">✦ CRYSTAL RELIC ✦</div>
        {relic.text && <div className="rc-text">{relic.text}</div>}
        {isNew ? (
          <span className="rc-new">NEW! ADDED TO YOUR RELICS</span>
        ) : (
          <div className="rc-seen">already in your collection</div>
        )}
        <div className="rc-dismiss">— click anywhere to dismiss —</div>
      </div>
    </>
  );
}

const CSS = `
.rc-cele {
  position: fixed; inset: 0; z-index: 60; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 24px; overflow: hidden;
  background: radial-gradient(ellipse at 50% 45%, rgba(6,40,44,.9), rgba(2,4,10,.97) 70%);
  animation: rc-fade .35s ease;
  font-family: 'Share Tech Mono', monospace;
}
@keyframes rc-fade { from { opacity: 0; } to { opacity: 1; } }

.rc-rays {
  position: absolute; top: 50%; left: 50%; z-index: 0; pointer-events: none;
  width: min(130vh, 160vw); height: auto; transform: translate(-50%,-50%);
  animation: rc-rays-fade .8s ease both, rc-spin 22s linear infinite, rc-hue 7s linear infinite;
}
@keyframes rc-rays-fade { from { opacity: 0; } to { opacity: .55; } }
@keyframes rc-spin { from { transform: translate(-50%,-50%) rotate(0); } to { transform: translate(-50%,-50%) rotate(360deg); } }
@keyframes rc-hue { from { filter: hue-rotate(0); } to { filter: hue-rotate(360deg); } }

.rc-cartridge, .rc-title, .rc-text, .rc-new, .rc-seen, .rc-dismiss { position: relative; z-index: 2; }
.rc-confetti { z-index: 1; }

.rc-cartridge {
  width: clamp(140px, 38vw, 260px); height: auto;
  filter: drop-shadow(0 0 30px rgba(63,255,208,.9));
  animation: rc-cart-in .8s cubic-bezier(.2,1.4,.4,1),
    rc-float 2.8s ease-in-out infinite .8s, rc-cart-glow 6s linear infinite;
}
@keyframes rc-cart-in { from { opacity: 0; transform: translateY(46px) scale(.4) rotate(-22deg); } to { opacity: 1; transform: none; } }
@keyframes rc-float { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-14px) rotate(3deg); } }
@keyframes rc-cart-glow {
  from { filter: drop-shadow(0 0 34px rgba(63,255,208,.95)) hue-rotate(0); }
  to { filter: drop-shadow(0 0 34px rgba(63,255,208,.95)) hue-rotate(360deg); }
}

.rc-title {
  margin-top: 20px; font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: clamp(1.5rem, 6.5vw, 2.8rem); letter-spacing: 0.08em; color: #fff;
  text-shadow: 0 0 22px rgba(63,255,208,.8), 2px 2px 0 #b44dff, -2px -2px 0 #3fffd0;
  animation: rc-glitch .12s steps(2) infinite, rc-text-rainbow 4s linear infinite;
}
@keyframes rc-glitch {
  0% { transform: translate(0,0); } 25% { transform: translate(-1px,1px); }
  50% { transform: translate(1px,-1px); } 75% { transform: translate(-1px,-1px); }
}
@keyframes rc-text-rainbow {
  0% { color: #5dffe0; } 25% { color: #aef3ff; } 50% { color: #fff;
  } 75% { color: #b9acff; } 100% { color: #5dffe0; }
}

.rc-text {
  margin-top: 14px; max-width: 32ch; font-size: clamp(0.9rem, 3.6vw, 1.2rem);
  color: #eafffb; text-shadow: 0 0 10px rgba(63,255,208,.4);
}
.rc-new {
  margin-top: 16px; display: inline-block; transform: rotate(-6deg);
  font-family: 'Press Start 2P', monospace; font-size: 0.66rem; letter-spacing: 0.1em;
  color: #052018; background: #3fffd0; padding: 7px 12px; border-radius: 6px;
  box-shadow: 0 0 18px #3fffd0; animation: rc-stamp .5s cubic-bezier(.2,1.8,.4,1) .4s both;
}
@keyframes rc-stamp { from { opacity: 0; transform: rotate(-6deg) scale(2.4); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
.rc-seen { margin-top: 16px; font-size: 0.66rem; letter-spacing: 0.2em; text-transform: uppercase; color: #5fb6a6; }
.rc-dismiss { margin-top: 22px; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #5f7a90; }

.rc-confetti { position: absolute; top: -16px; opacity: .95; animation: rc-fall linear forwards; }
@keyframes rc-fall { to { transform: translateY(112vh) rotate(720deg); opacity: .2; } }

@media (prefers-reduced-motion: reduce) {
  .rc-rays { animation: rc-rays-fade .8s ease both; }
  .rc-cartridge { animation: rc-cart-in .5s ease both; }
  .rc-title { animation: none; }
  .rc-confetti { display: none; }
}
`;
