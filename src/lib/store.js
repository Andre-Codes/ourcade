/* ─────────────────────────────────────────────────────────────────────────
   STORE — the one place the daily layer touches persistence.

   localStorage stays the SYNCHRONOUS source of truth for render (every get* is
   sync, called inside useState initializers across the app, wrapped in
   try/catch so private-mode / quota errors never crash). On top of that we now
   WRITE-THROUGH to Firestore and HYDRATE from it (cross-device per-account
   sync) — but only in a browser, via a guarded dynamic import of cloud.js, so
   the Node scripts (daily-check imports this through stumble.js) never load
   Firebase and stay pure. Anonymous sign-in means sync starts immediately;
   claiming an account (linkWithCredential) keeps the same uid + data.
   ───────────────────────────────────────────────────────────────────────── */

import { dayNumberFromKey } from "./daily.js";

const NS = "ourcade:";

// ---- cloud sync (browser-only; node returns null and skips all of it) ----
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null; // daily-check / SSR: no Firebase
  if (!cloudPromise) cloudPromise = import("./cloud.js").catch(() => null);
  return cloudPromise;
}
// Which localStorage keys participate in per-account sync (NOT session-only
// stumble:seen, NOT the vanity visit odometer).
function isSyncKey(key) {
  return (
    key.startsWith("poll:") ||
    key.startsWith("quiz:") ||
    key === "eightball:legends" ||
    key === "eightball:muted" ||
    key === "stumble:deepcuts" ||
    key === "streak"
  );
}
// Fire-and-forget write-through. Never throws into the caller.
function pushUp(key, raw) {
  const p = cloud();
  if (p) p.then((c) => c && c.writeState(key, raw)).catch(() => {});
}
// Notify (future) reactive listeners that cloud hydration changed local data.
function emitChange() {
  try {
    window.dispatchEvent(new Event("ourcade:storechange"));
  } catch {
    /* non-browser */
  }
}

function read(key) {
  try {
    return localStorage.getItem(NS + key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(NS + key, value);
  } catch {
    /* private mode / quota — ignore, the UI degrades gracefully */
  }
}
function readJSON(key, fallback) {
  const raw = read(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/* ── generic, ourcade:-prefixed localStorage for self-contained features ──
   Use these from any game/tool that needs its OWN local state (a high score,
   settings, progress) instead of touching window.localStorage directly. They
   share the `ourcade:` namespace and the try/catch contract above, so private
   mode / quota errors degrade gracefully and keys never collide across the app.

   These do NOT cloud-sync — that's reserved for the curated isSyncKey set; this
   is purely local. The string getters take a `key` WITHOUT the `ourcade:`
   prefix (it's added for you). A `legacyKey` lets a caller transparently migrate
   off an old un-prefixed key without losing the user's saved value. */
export function lsGet(key, fallback = null, legacyKey) {
  const v = read(key);
  if (v != null) return v;
  if (legacyKey) {
    try {
      const old = localStorage.getItem(legacyKey);
      if (old != null) {
        write(key, old); // migrate forward, once
        try { localStorage.removeItem(legacyKey); } catch { /* ignore */ }
        return old;
      }
    } catch { /* private mode — fall through */ }
  }
  return fallback;
}
export function lsSet(key, value) {
  write(key, value == null ? "" : String(value));
}
export function lsRemove(key) {
  try { localStorage.removeItem(NS + key); } catch { /* ignore */ }
}
export function lsGetJSON(key, fallback, legacyKey) {
  const raw = lsGet(key, null, legacyKey);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
export function lsSetJSON(key, value) {
  try { lsSet(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ---- daily poll: which option this device picked, per poll id ----
export function getPollVote(pollId) {
  return read(`poll:${pollId}`);
}
export function setPollVote(pollId, optionId) {
  write(`poll:${pollId}`, optionId);
  pushUp(`poll:${pollId}`, optionId);
}

// ---- quizzes: which result this device got, per quiz id ----
export function getQuizResult(quizId) {
  return read(`quiz:${quizId}`);
}
export function setQuizResult(quizId, resultId) {
  write(`quiz:${quizId}`, resultId);
  pushUp(`quiz:${quizId}`, resultId);
}

// ---- relics: the site-wide easter-egg collection ----
// One discovered-relic list shared by EVERY source (the Magic 8-Ball, the Daily
// Relic Run, future eggs). The storage key stays "eightball:legends" so existing
// saves + cloud sync keep working with zero migration — only the API names are
// generalized. recordLegendary/getDiscoveredLegendaries remain as aliases for
// the 8-ball + the profile/auth carry-up paths that still use those names.
export function getDiscoveredRelics() {
  return readJSON("eightball:legends", []);
}
// Idempotent: re-discovering a known relic returns isNew:false and leaves the
// original discovery date untouched. `id` must match a definition in relics.js
// (ALL_RELICS) for the profile to resolve its art/text.
export function recordRelic(id) {
  const found = getDiscoveredRelics();
  if (found.some((f) => f.id === id)) return { found, isNew: false };
  const next = [...found, { id, at: new Date().toISOString() }];
  const raw = JSON.stringify(next);
  write("eightball:legends", raw);
  pushUp("eightball:legends", raw);
  // Mirror a PUBLIC count to the profile (names/graphics stay private; only the
  // tally is shared so others see "N relics found"). Named users only.
  mirrorRelicCount(next.length);
  return { found: next, isNew: true };
}
// Back-compat aliases (the 8-ball + AuthProvider + ProfileView still call these).
export const getDiscoveredLegendaries = getDiscoveredRelics;
export const recordLegendary = recordRelic;

// Push the discovered-relic COUNT to the public profile doc (browser-only,
// fire-and-forget; no-ops for anon since they have no profile doc).
export function mirrorRelicCount(count) {
  const p = cloud();
  if (p) p.then((c) => c && c.writeProfile && c.writeProfile({ relicCount: count })).catch(() => {});
}

// Push the user's BEST Daily Relic Run streak to the public profile so others
// see it as a badge. Same contract as mirrorRelicCount (browser-only, fire-and-
// forget, named users only). Called from RelicRun's bumpStreak on a new best.
export function mirrorRelicRunStreak(best) {
  const p = cloud();
  if (p) p.then((c) => c && c.writeProfile && c.writeProfile({ relicRunStreak: best })).catch(() => {});
}

// ---- Web Run history: a rolling per-day log of clicks vs par ----
// Local-only (NOT a syncKey, same as relic:state/relic:streak): one entry per
// calendar day, capped to the most recent RELIC_HISTORY_MAX so it never grows
// unbounded. Feeds the in-cabinet "View Stats" aggregate. Each entry is the
// minimal truth needed to recompute averages: { day, clicks, par }.
const RELIC_HISTORY_MAX = 60;

export function getRelicRunHistory() {
  const list = readJSON("relic:history", []);
  return Array.isArray(list) ? list.filter((e) => e && e.day) : [];
}
// Idempotent per day: re-recording the same day replaces that day's entry (a
// reload of an already-finished run won't duplicate), like bumpStreak.
export function recordRelicRun(day, clicks, par) {
  if (!day) return getRelicRunHistory();
  const rest = getRelicRunHistory().filter((e) => e.day !== day);
  const next = [...rest, { day, clicks, par }]
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    .slice(-RELIC_HISTORY_MAX);
  write("relic:history", JSON.stringify(next));
  return next;
}
// Aggregate the history into display stats. Pure given the stored list.
// avgClicks/avgPar rounded to one decimal; best = fewest clicks ever.
export function getRelicRunStats() {
  const h = getRelicRunHistory();
  const runs = h.length;
  if (runs === 0) return { runs: 0, avgClicks: 0, avgPar: 0, best: 0 };
  const round1 = (n) => Math.round(n * 10) / 10;
  const sumClicks = h.reduce((s, e) => s + (e.clicks || 0), 0);
  const sumPar = h.reduce((s, e) => s + (e.par || 0), 0);
  const best = h.reduce((m, e) => Math.min(m, e.clicks ?? Infinity), Infinity);
  return {
    runs,
    avgClicks: round1(sumClicks / runs),
    avgPar: round1(sumPar / runs),
    best: Number.isFinite(best) ? best : 0,
  };
}

// ---- magic 8-ball: per-device sound mute (default: not muted) ----
export function getEightBallMuted() {
  return read("eightball:muted") === "1";
}
export function setEightBallMuted(on) {
  const raw = on ? "1" : "0";
  write("eightball:muted", raw);
  pushUp("eightball:muted", raw);
}

// ---- soundboard: per-device sound mute (default: not muted) ----
export function getSoundboardMuted() {
  return read("soundboard:muted") === "1";
}
export function setSoundboardMuted(on) {
  const raw = on ? "1" : "0";
  write("soundboard:muted", raw);
  pushUp("soundboard:muted", raw);
}

// ---- konami deep cuts: secret stumble pool unlock (persists, like legendaries) ----
export function getDeepCutsUnlocked() {
  return read("stumble:deepcuts") === "1";
}
// Idempotent; returns whether THIS call did the unlocking (for the toast).
export function recordDeepCutsUnlocked() {
  const isNew = !getDeepCutsUnlocked();
  write("stumble:deepcuts", "1");
  pushUp("stumble:deepcuts", "1");
  return { isNew };
}

// ---- stumble: ids already seen THIS SESSION (sessionStorage, not local) ----
// Session-scoped on purpose: within one sitting you never see a repeat, but a
// fresh visit starts with the whole pool again. Same try/catch contract as the
// localStorage helpers — private mode just means repeats become possible.
function readSession(key) {
  try {
    return sessionStorage.getItem(NS + key);
  } catch {
    return null;
  }
}
function writeSession(key, value) {
  try {
    sessionStorage.setItem(NS + key, value);
  } catch {
    /* ignore — stumble degrades to pure random */
  }
}

export function getStumbleSeen() {
  const raw = readSession("stumble:seen");
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
export function recordStumbleSeen(id) {
  const seen = getStumbleSeen();
  if (!seen.includes(id)) {
    seen.push(id);
    writeSession("stumble:seen", JSON.stringify(seen));
  }
  return seen;
}
// Forget seen ids (all of them, or just those matching a predicate) — used
// when a draw bucket runs dry so it can start over without resetting the rest.
export function clearStumbleSeen(predicate) {
  if (typeof predicate !== "function") {
    writeSession("stumble:seen", JSON.stringify([]));
    return [];
  }
  const kept = getStumbleSeen().filter((id) => !predicate(id));
  writeSession("stumble:seen", JSON.stringify(kept));
  return kept;
}

// ---- visit streak: consecutive calendar days seen ----
// Idempotent within a day (safe under React StrictMode's double-mount): the
// first call for a new day advances the streak, repeat calls return it as-is.
export function recordVisit(today) {
  const prev = readJSON("streak", null);
  let streak = 1;
  let isNewDay = true;
  if (prev && prev.last) {
    if (prev.last === today) {
      streak = prev.streak || 1;
      isNewDay = false;
    } else {
      const gap = dayNumberFromKey(today) - dayNumberFromKey(prev.last);
      streak = gap === 1 ? (prev.streak || 0) + 1 : 1; // consecutive vs reset
    }
  }
  const raw = JSON.stringify({ last: today, streak });
  write(`streak`, raw);
  pushUp("streak", raw);
  return { streak, isNewDay };
}

// ---- favorite games (the user's personal "arcade") ----
// Favorites live on the PUBLIC profile doc (profiles/{uid}.favorites), not the
// private `state` map — so they sync via a dedicated path (writeProfile), and
// AuthProvider merges the cloud copy in on profile fetch. localStorage stays
// the instant render cache; toggling pushes the new array up for named users.
export function getFavorites() {
  return readJSON("favorites", []);
}
function writeFavorites(list) {
  const raw = JSON.stringify(list);
  write("favorites", raw);
  // Push the whole array to the public profile (named users only — anon has no
  // profile doc). Browser-only + fire-and-forget, same contract as pushUp.
  const p = cloud();
  if (p) p.then((c) => c && c.writeProfile && c.writeProfile({ favorites: list })).catch(() => {});
}
export function toggleFavorite(gameId) {
  const cur = getFavorites();
  const next = cur.includes(gameId) ? cur.filter((g) => g !== gameId) : [...cur, gameId];
  writeFavorites(next);
  emitChange();
  return next;
}
// Replace local favorites with an explicit list (used by AuthProvider after it
// merges cloud ∪ local on login). Does NOT push back up — caller owns that.
export function setFavoritesLocal(list) {
  write("favorites", JSON.stringify(Array.isArray(list) ? list : []));
  emitChange();
}

// ---- Top 8 (a MySpace-style showcase of heterogeneous Ourcade content) ----
// Same model as favorites: lives on the PUBLIC profile (profiles/{uid}.top8) so
// any viewer sees any user's Top 8; localStorage is the instant render cache.
// Each entry is { type, id } (type ∈ flash|curiosity|fact|weird|game), resolved
// at render time via data/content.js — except flash, which also carries `title`
// (its full pool is a lazy chunk we don't want to pull into a profile view).
// Append-order, hard cap of 8.
export const TOP8_MAX = 8;

export function getTop8() {
  const list = readJSON("top8", []);
  return Array.isArray(list)
    ? list.filter((e) => e && e.type && e.id).slice(0, TOP8_MAX)
    : [];
}
function writeTop8(list) {
  const next = (Array.isArray(list) ? list : []).slice(0, TOP8_MAX);
  write("top8", JSON.stringify(next));
  // Push the whole array to the public profile (named users only). Fire-and-forget.
  const p = cloud();
  if (p) p.then((c) => c && c.writeProfile && c.writeProfile({ top8: next })).catch(() => {});
  return next;
}
export function isInTop8(type, id) {
  return getTop8().some((e) => e.type === type && e.id === id);
}
// Add (or remove if already present). Returns { list, full }: full=true means
// the add was REJECTED because the showcase already holds 8 — the caller surfaces
// "remove one first" and nothing is stored.
export function toggleTop8(type, id, extra) {
  const cur = getTop8();
  const i = cur.findIndex((e) => e.type === type && e.id === id);
  if (i >= 0) {
    const next = writeTop8(cur.filter((_, idx) => idx !== i));
    emitChange();
    return { list: next, full: false };
  }
  if (cur.length >= TOP8_MAX) return { list: cur, full: true };
  const next = writeTop8([...cur, { type, id, ...(extra || {}) }]);
  emitChange();
  return { list: next, full: false };
}
export function removeTop8(type, id) {
  const next = writeTop8(getTop8().filter((e) => !(e.type === type && e.id === id)));
  emitChange();
  return next;
}
// Replace local Top 8 with an explicit list (AuthProvider on login). No push-back.
export function setTop8Local(list) {
  write("top8", JSON.stringify(Array.isArray(list) ? list.slice(0, TOP8_MAX) : []));
  emitChange();
}

// ---- cloud hydration: merge the account's Firestore state into localStorage ----
// Called by AuthProvider once an auth uid is known. Cloud is authoritative for
// cross-device picks; collections union; streak keeps the strongest. Anything
// that exists only locally (e.g. created before sign-in) is pushed UP so the
// account keeps it. Best-effort — failures leave the local-only experience intact.
function localSyncedMap() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i);
      if (!full || !full.startsWith(NS)) continue;
      const key = full.slice(NS.length);
      if (isSyncKey(key)) out[key] = localStorage.getItem(full);
    }
  } catch {
    /* private mode — nothing to push up */
  }
  return out;
}

function mergeValue(key, localRaw, cloudRaw) {
  if (cloudRaw == null) return localRaw;
  if (localRaw == null) return cloudRaw;
  if (key === "streak") {
    try {
      const l = JSON.parse(localRaw);
      const c = JSON.parse(cloudRaw);
      const ln = l?.last ? dayNumberFromKey(l.last) : -Infinity;
      const cn = c?.last ? dayNumberFromKey(c.last) : -Infinity;
      if (cn > ln) return cloudRaw;
      if (ln > cn) return localRaw;
      return (c?.streak || 0) >= (l?.streak || 0) ? cloudRaw : localRaw; // same day → higher streak
    } catch {
      return cloudRaw;
    }
  }
  if (key === "eightball:legends") {
    try {
      const byId = new Map();
      for (const e of [...JSON.parse(cloudRaw), ...JSON.parse(localRaw)]) {
        const prev = byId.get(e.id);
        if (!prev || e.at < prev.at) byId.set(e.id, e); // keep earliest discovery
      }
      return JSON.stringify([...byId.values()]);
    } catch {
      return cloudRaw;
    }
  }
  return cloudRaw; // poll/quiz/muted/deepcuts: cloud (other devices) wins
}

export async function hydrateFromCloud(uid) {
  const p = cloud();
  if (!p) return;
  const c = await p;
  if (!c) return;
  let cloudState;
  try {
    cloudState = await c.readState(uid);
  } catch {
    return; // offline / blocked — stay on local
  }
  const local = localSyncedMap();
  const keys = new Set([...Object.keys(cloudState || {}), ...Object.keys(local)]);
  const pushBack = {};
  let changed = false;
  for (const key of keys) {
    const merged = mergeValue(key, local[key] ?? null, cloudState?.[key] ?? null);
    if (merged != null && merged !== local[key]) {
      write(key, merged);
      changed = true;
    }
    if (merged != null && merged !== cloudState?.[key]) pushBack[key] = merged;
  }
  if (Object.keys(pushBack).length) c.writeMany(pushBack).catch(() => {});
  if (changed) emitChange();
}
