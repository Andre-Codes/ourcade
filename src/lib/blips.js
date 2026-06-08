/* ─────────────────────────────────────────────────────────────────────────
   BLIPS — tiny synthesized retro chimes for the Magic 8-Ball rarity pulls.
   No audio files, no network: a single lazily-created AudioContext plus short
   oscillator + gain-envelope notes. Must be kicked off from a user gesture
   (a click) so browser autoplay policy is happy — the 8-ball only ever calls
   these from inside its click handler.
   ───────────────────────────────────────────────────────────────────────── */

let ctx = null;

function ac() {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    // Resume if the browser parked it (happens after autoplay suspension).
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// One plucked note: frequency (Hz), start offset (s), duration (s), peak gain.
function note(freq, start, dur, peak = 0.18, type = "square") {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// RARE — a single bright blip.
export function playRare() {
  note(660, 0, 0.16, 0.16);
}

// EPIC — a quick two-note riff.
export function playEpic() {
  note(587, 0, 0.14, 0.16);
  note(880, 0.11, 0.2, 0.17);
}

// LEGENDARY — a triumphant rising arpeggio with a sparkle on top.
export function playLegendary() {
  const seq = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  seq.forEach((f, i) => note(f, i * 0.1, 0.28, 0.2, "triangle"));
  note(1567.98, 0.42, 0.5, 0.12, "sine"); // G6 sparkle tail
}

// MYTHIC — longer, grander: a full ascending run, a held high chord, and a
// shimmering cascade of sparkles raining down. The "you found the artifact" cue.
export function playMythic() {
  const run = [392, 523.25, 659.25, 783.99, 1046.5, 1318.51]; // G4→E6 climb
  run.forEach((f, i) => note(f, i * 0.09, 0.32, 0.2, "triangle"));
  // held major chord on top of the climb
  [1046.5, 1318.51, 1567.98].forEach((f) => note(f, 0.56, 0.7, 0.14, "sine"));
  // descending sparkle cascade
  [2093, 1760, 1568, 1318.51, 1046.5].forEach((f, i) =>
    note(f, 0.7 + i * 0.07, 0.4, 0.08, "sine"),
  );
}
