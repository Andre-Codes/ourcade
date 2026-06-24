/* ─────────────────────────────────────────────────────────────────────────
   SFX — tiny file-based sound-effect player for the card/dice cabinets.

   Plays the CC0 Kenney sound effects converted to MP3 by scripts/process-sfx.js
   into public/games/kenney/sfx/. Mirrors the Soundboard.jsx pattern: a cached
   HTMLAudioElement per name, retriggered with currentTime=0 so rapid taps fire
   each time. URLs resolve off BASE_URL so they work under the Pages base ("./").

   Silent-safe by design: a missing file or a blocked-autoplay rejection just
   no-ops (the .catch swallows it), so callers never need to guard. Like blips.js,
   the first successful play needs a user gesture to satisfy autoplay policy —
   every caller here fires from inside a tap handler, so that's satisfied.
   ───────────────────────────────────────────────────────────────────────── */

const BASE = (import.meta.env.BASE_URL || "/") + "games/kenney/sfx/";
const cache = new Map();
let muted = false;

export function setSfxMuted(v) {
  muted = !!v;
}

// Play a named SFX (e.g. "card-place-1"). No-ops on SSR, when muted, or on any
// load/decode/autoplay failure.
export function playSfx(name, { volume = 0.6 } = {}) {
  if (typeof window === "undefined" || muted || !name) return;
  try {
    let el = cache.get(name);
    if (!el) {
      el = new Audio(BASE + name + ".mp3");
      el.preload = "auto";
      cache.set(name, el);
    }
    el.volume = volume;
    el.currentTime = 0; // retrigger on rapid taps
    el.play().catch(() => {});
  } catch {
    /* play() can throw before load — ignored, SFX are non-essential */
  }
}

// Pick a random variant where a SFX ships numbered alternates (e.g.
// card-place-1 / card-place-3) for a little variety. Pass the base + the
// available suffixes: pickSfx("card-place", [1, 3]).
export function playSfxVariant(base, variants, opts) {
  const v = variants[Math.floor(Math.random() * variants.length)];
  playSfx(`${base}-${v}`, opts);
}
