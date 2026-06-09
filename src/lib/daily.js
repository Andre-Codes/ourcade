/* ─────────────────────────────────────────────────────────────────────────
   DAILY — deterministic, date-seeded content selection
   Pure JS (no React / no DOM required) so this can be imported by the home
   components AND by headless node scripts (scripts/daily-check.js), the same
   way descent/engine.js is shared with scripts/descent-sim.js.

   The whole site's "fresh every day" feel rests on one idea: a given local
   calendar day always maps to the same picks, on every device — a shared
   ritual (Wordle-style). "Today" rotates at local midnight.
   ───────────────────────────────────────────────────────────────────────── */

// Local calendar date as "YYYY-MM-DD" (NOT UTC — we want each player's own
// midnight, like Wordle).
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// A "?day=YYYY-MM-DD" override (query string OR hash-router query) lets us
// eyeball tomorrow's page without touching the system clock. Dev/QA only; it's
// a no-op outside a browser and ignores anything that isn't a valid date.
export function getDayOverride() {
  if (typeof window === "undefined" || !window.location) return null;
  try {
    const { search, hash } = window.location;
    const hashQ = hash && hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
    for (const qs of [search, hashQ]) {
      if (!qs) continue;
      const v = new URLSearchParams(qs).get("day");
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    }
  } catch {
    /* ignore malformed URLs */
  }
  return null;
}

// The key everything in the UI should use.
export function todayKey() {
  return getDayOverride() || dayKey(new Date());
}

// Whole-day counter derived from the key itself (so it stays consistent with
// dayKey regardless of the runner's timezone). Increments by 1 each calendar
// day — this is what drives the no-repeat rotation.
export function dayNumberFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// xmur3 string hash → unsigned 32-bit int. Stable across engines.
export function daySeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32 PRNG → function returning floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic Fisher–Yates. Returns a new array; never mutates the input.
export function seededShuffle(list, seed) {
  const arr = list.slice();
  const rand = mulberry32(seed >>> 0);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Fixed golden-ratio constant — keeps the rotation order stable across days
// (we shuffle ONCE with a constant seed, then step through it by day number, so
// every item appears exactly once before any repeats).
const ROTATE_SEED = 0x9e3779b9;

// Pick today's item from `list` such that it cycles through the whole list with
// NO repeats until the pool is exhausted. `salt` gives each content type its
// own independent order so games / polls / quizzes don't move in lockstep.
export function rotateDaily(list, key, salt = 0) {
  if (!list || list.length === 0) return undefined;
  const ordered = seededShuffle(list, (ROTATE_SEED ^ daySeed(String(salt))) >>> 0);
  const n = dayNumberFromKey(key);
  const idx = ((n % ordered.length) + ordered.length) % ordered.length;
  return ordered[idx];
}

// Like rotateDaily, but only advances to the next item every `periodDays` days,
// so a single pick lingers for a few days before changing. Still cycles the whole
// pool with no repeats (each item shows for one full period before the next).
// periodDays = 1 is identical to rotateDaily.
export function rotateEvery(list, key, periodDays = 1, salt = 0) {
  if (!list || list.length === 0) return undefined;
  const p = Math.max(1, Math.floor(periodDays));
  const ordered = seededShuffle(list, (ROTATE_SEED ^ daySeed(String(salt))) >>> 0);
  const step = Math.floor(dayNumberFromKey(key) / p);
  const idx = ((step % ordered.length) + ordered.length) % ordered.length;
  return ordered[idx];
}

// Like rotateDaily but returns N distinct items for the day. Steps through the
// SAME no-repeat order in non-overlapping windows of size n, so a visitor sees a
// fresh set each day and the whole pool cycles before anything repeats.
export function rotateDailyN(list, key, n, salt = 0) {
  if (!list || list.length === 0) return [];
  const count = Math.min(n, list.length);
  const ordered = seededShuffle(list, (ROTATE_SEED ^ daySeed(String(salt))) >>> 0);
  const day = dayNumberFromKey(key);
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = (((day * count + i) % ordered.length) + ordered.length) % ordered.length;
    out.push(ordered[idx]);
  }
  return out;
}

// Hash-based pick (MAY repeat day to day). Fine for low-stakes flavor like a
// mascot tip where repeats don't matter.
export function pickDaily(list, key, salt = 0) {
  if (!list || list.length === 0) return undefined;
  return list[daySeed(`${key}|${salt}`) % list.length];
}

// N distinct deterministic items for the day (e.g. a few news blurbs).
export function pickDailyN(list, key, n, salt = 0) {
  if (!list || list.length === 0) return [];
  return seededShuffle(list, daySeed(`${key}|${salt}`)).slice(0, n);
}

// Human-readable date for "fresh page baked <date>". Parsed as UTC so it echoes
// the key exactly rather than re-applying a local offset.
export function prettyDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
