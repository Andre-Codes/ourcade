/* ─────────────────────────────────────────────────────────────────────────
   LIVE — the admin overlay layer.

   The site is a static build: every pool under src/data/ is bundled at build
   time, so a content edit normally means commit → push → deploy. This module
   adds a fifth content layer on top of the four in docs/schedules-and-content.md,
   the only one that can change WITHOUT a rebuild — it's what makes the phone
   console at #/admin possible.

   Per content family, three operations:
     adds     — new items authored in the console
     patches  — { "<existing id>": { url: "…" } }, shallow-merged over a baked
                item (this is how you fix a dead link in MANUAL_ARTIFACTS
                without touching the repo)
     hides    — ids dropped from the pool. Also the tombstone for a DELETED add,
                so a deleted item can't come back from the baked seed below.

   Two sources, one shape:
     1. generated/live.js — baked nightly by scripts/snapshot-live.js. Renders
        instantly on first paint, and puts every edit in git history.
     2. Firestore live/content — the authority. hydrateLive() fetches it once on
        boot and replaces the seed (adds dedupe by id, so nothing doubles up).

   NODE-PURE ON PURPOSE: no React, no Firebase at module scope. scripts/daily-check.js
   pulls in weird.js / stumble.js / curiosities.js transitively, and under Node
   hydrateLive() is a no-op — the overlay stays whatever the seed holds, so the
   checker sees exactly the committed content. The React binding lives in
   src/lib/useLive.js; the Firestore reads/writes live in src/lib/cloud.js.
   ───────────────────────────────────────────────────────────────────────── */

import seed from "./generated/live.js";

// Every family the console can edit. Order drives the admin tab strip.
export const LIVE_TYPES = [
  "stumble",
  "vault",
  "weird",
  "weirdNight",
  "curiosities",
  "featured",
  "movies",
  "news",
  "schedule",
];

const EMPTY_LAYER = { adds: [], patches: {}, hides: [] };

function normalizeLayer(raw) {
  return {
    adds: Array.isArray(raw?.adds) ? raw.adds.filter((a) => a && typeof a === "object") : [],
    patches: raw?.patches && typeof raw.patches === "object" ? raw.patches : {},
    hides: Array.isArray(raw?.hides) ? raw.hides.filter((h) => typeof h === "string") : [],
  };
}

// Tolerate anything Firestore hands back — a half-written or hand-edited doc
// must never be able to throw during render.
function normalize(raw) {
  const out = {};
  for (const t of LIVE_TYPES) out[t] = normalizeLayer(raw?.[t]);
  return out;
}

let LIVE = normalize(seed);
const subs = new Set();

export function liveLayer(type) {
  return LIVE[type] || EMPTY_LAYER;
}

// The whole overlay — the admin console's starting state.
export function liveSnapshot() {
  return LIVE;
}

// Swap in a new overlay and wake every subscriber (see src/lib/useLive.js).
export function setLive(raw) {
  LIVE = normalize(raw);
  for (const fn of subs) {
    try {
      fn();
    } catch {
      /* a bad subscriber must never break the others */
    }
  }
}

export function subscribeLive(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/* Merge the overlay into a pool of { id, … } items.
   Returns the pool untouched when the overlay is empty, so the no-admin-edits
   case (and all of Node) costs nothing. A live add SHADOWS a baked item with
   the same id — that's how "edit" works on something the console itself made. */
export function applyLive(pool, type) {
  const { adds, patches, hides } = liveLayer(type);
  const patchIds = Object.keys(patches);
  if (!adds.length && !hides.length && !patchIds.length) return pool;

  const hidden = new Set(hides);
  const addIds = new Set(adds.map((a) => a.id).filter(Boolean));

  const kept = pool.filter((it) => it && !hidden.has(it.id) && !addIds.has(it.id));
  const live = adds.filter((a) => a.id && !hidden.has(a.id));

  return [...kept, ...live].map((it) =>
    patches[it.id] ? { ...it, ...patches[it.id] } : it
  );
}

/* Site News is the odd one out: its pool holds plain strings, not objects.
   Adds carry { id, text } so the console has something stable to edit and
   delete; hides match the literal news line (that's the only id a baked
   string has). Patches don't apply. */
export function applyLiveNews(pool) {
  const { adds, hides } = liveLayer("news");
  if (!adds.length && !hides.length) return pool;

  const hidden = new Set(hides);
  return [
    ...pool.filter((t) => !hidden.has(t)),
    ...adds.filter((a) => a.id && a.text && !hidden.has(a.id)).map((a) => a.text),
  ];
}

/* Fetch the authoritative overlay from Firestore, once per page load.
   Browser-only and promise-cached, so React StrictMode's double-invoke (and
   any number of useLive() callers) still produce exactly one read. Every
   failure path resolves to the current overlay — an offline visitor just sees
   the baked seed, which is the whole point of snapshotting it. */
let hydratePromise = null;
export function hydrateLive() {
  if (typeof window === "undefined") return Promise.resolve(LIVE);
  if (!hydratePromise) {
    hydratePromise = import("../lib/cloud.js")
      .then((m) => m.readLiveContent())
      .then((data) => {
        if (data) setLive(data);
        return LIVE;
      })
      .catch(() => LIVE);
  }
  return hydratePromise;
}
