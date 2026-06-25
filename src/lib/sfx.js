/* ─────────────────────────────────────────────────────────────────────────
   SFX — tiny Web Audio sound-effect player for the card/dice cabinets.

   Plays the CC0 Kenney sound effects (converted to MP3 by scripts/process-sfx.js
   into public/games/kenney/sfx/) through the Web Audio API instead of an
   <audio>/HTMLAudioElement. This matters on iOS: an HTMLAudioElement registers an
   OS *media session* (the "Now Playing" / Dynamic Island / lock-screen entry), so
   the phone thinks a song is playing on every blip. A decoded AudioBuffer played
   through a disposable BufferSource → gain → destination is the "sound effect"
   path — no media session, and a pre-decoded buffer starts effectively instantly
   (no per-tap fetch/decode latency).

   Mirrors blips.js: one lazily-created AudioContext, created+resumed from the
   first user gesture. Each file is fetched + decoded once into an AudioBuffer
   cache; every tap spins up a fresh BufferSource, so rapid/overlapping taps layer
   naturally (and the source is GC'd when it finishes). URLs resolve off BASE_URL
   so they work under the Pages base ("./").

   Silent-safe by design: missing file, decode failure, unsupported AudioContext,
   or a blocked-autoplay state all just no-op, so callers never need to guard.
   Like blips.js, the first sound needs a user gesture to satisfy autoplay policy —
   every caller here fires from inside a tap handler, so that's satisfied.
   ───────────────────────────────────────────────────────────────────────── */

const BASE = (import.meta.env.BASE_URL || "/") + "games/kenney/sfx/";
const buffers = new Map(); // name → decoded AudioBuffer
const pending = new Map(); // name → in-flight decode Promise (dedupes rapid taps)
let ctx = null;
let muted = false;

export function setSfxMuted(v) {
  muted = !!v;
}

// Lazy single AudioContext, resumed if the browser parked it. Returns null on SSR
// or when Web Audio is unsupported. (Same shape as blips.js's ac().)
function ac() {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Fetch + decode a named SFX into the buffer cache. Returns the AudioBuffer, or
// null on any failure. Concurrent calls for the same name share one decode.
function load(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (pending.has(name)) return pending.get(name);
  const c = ac();
  if (!c) return Promise.resolve(null);
  const p = fetch(BASE + name + ".mp3")
    .then((r) => r.arrayBuffer())
    .then((buf) => c.decodeAudioData(buf))
    .then((decoded) => {
      buffers.set(name, decoded);
      pending.delete(name);
      return decoded;
    })
    .catch(() => {
      pending.delete(name);
      return null;
    });
  pending.set(name, p);
  return p;
}

// Spin up a fresh disposable source → gain (volume) → destination. The source is
// GC'd once it ends, so overlapping taps just layer. When `fadeOut` (seconds) is
// given, the gain ramps to ~silence over the LAST fadeOut seconds of the clip so
// it tails off smoothly instead of cutting (clamped to the buffer length).
function playBuffer(c, buffer, volume, fadeOut = 0) {
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(c.destination);
  const t = c.currentTime;
  if (fadeOut > 0 && buffer.duration) {
    const fade = Math.min(fadeOut, buffer.duration);
    const startFade = t + buffer.duration - fade;
    gain.gain.setValueAtTime(volume, startFade);
    gain.gain.linearRampToValueAtTime(0.0001, t + buffer.duration);
  }
  src.start(0);
}

// Play a named SFX (e.g. "card-place-1"). No-ops on SSR, when muted, or on any
// load/decode/unsupported failure. Cached buffers play instantly; the first play
// of a sound decodes once, then plays.
export function playSfx(name, { volume = 0.6, fadeOut = 0 } = {}) {
  if (typeof window === "undefined" || muted || !name) return;
  const c = ac();
  if (!c) return;
  const cached = buffers.get(name);
  if (cached) {
    playBuffer(c, cached, volume, fadeOut);
    return;
  }
  load(name)
    .then((buf) => buf && playBuffer(c, buf, volume, fadeOut))
    .catch(() => {});
}

// Pick a random variant where a SFX ships numbered alternates (e.g.
// card-place-1 / card-place-3) for a little variety. Pass the base + the
// available suffixes: playSfxVariant("card-place", [1, 3]).
export function playSfxVariant(base, variants, opts) {
  const v = variants[Math.floor(Math.random() * variants.length)];
  playSfx(`${base}-${v}`, opts);
}

// Play a named SFX on LOOP and return a handle to stop it. Same cache + silent-
// safe contract as playSfx, but the source keeps looping (Web Audio
// `source.loop = true`) until you call handle.stop(). Use for sustained ambience
// like a boss's engine hum that should run only while the boss is alive. The
// buffer may still be decoding when called; we start the loop as soon as it's
// ready, and stop() works whether or not playback has begun yet (idempotent).
// Returns a no-op handle when muted / unsupported / file missing.
export function playSfxLoop(name, { volume = 0.5 } = {}) {
  let src = null;
  let stopped = false;
  const handle = {
    stop() {
      stopped = true;
      if (src) {
        try { src.stop(); } catch { /* already stopped */ }
        src = null;
      }
    },
  };
  if (typeof window === "undefined" || muted || !name) return handle;
  const c = ac();
  if (!c) return handle;
  const start = (buffer) => {
    if (stopped || !buffer || src) return; // stopped before ready, or already running
    try {
      src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = c.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(c.destination);
      src.start(0);
    } catch {
      src = null;
    }
  };
  const cached = buffers.get(name);
  if (cached) start(cached);
  else load(name).then(start).catch(() => {});
  return handle;
}
