/* The Stumble engine — 🎲 "you probably wouldn't have searched for this."

   A random internet artifact on every click, drawn from one combined pool:
   hand-picked seeds (MANUAL_ARTIFACTS), the Phase-2 generated batch, and the
   ~3000-item archive.org flash pool adapted on the fly (lazily, preserving the
   code-split chunk — see animations.js).

   This is the ONE deliberately non-deterministic feature on the site. The
   "algorithm" is two dice rolls and a memory of what you've already seen:

   1. Draw an era bucket by fixed weight — the invisible 40/40/20 content mix.
      Weights live here, NOT in the UI; users never see eras or categories.
      The flash pool gets its own bucket so its 3000 entries can't swamp the
      hand-curated artifacts (a flat pick would be ~98% Flash).
   2. Uniform random within the bucket, skipping anything seen this session
      (sessionStorage via store.js). A bucket that runs dry quietly resets its
      own seen-list and keeps going. */

import { loadPool } from "./animations.js";
import generated from "./generated/stumble.js";
import { MANUAL_ARTIFACTS, MANUAL_DEEP_CUTS } from "./manual/content.js";
import {
  getStumbleSeen,
  recordStumbleSeen,
  clearStumbleSeen,
  getDeepCutsUnlocked,
} from "../lib/store.js";

const STATIC = [
  ...MANUAL_ARTIFACTS,
  ...(Array.isArray(generated) && generated.length ? generated : []),
];

// Konami-locked extras — stranger picks that only join the draw once the code
// has been entered (see Home.jsx). Flagged so the page can show the 🩻 chip.
const DEEP_CUTS = MANUAL_DEEP_CUTS.map((a) => ({ ...a, deepCut: true }));

// flash pool entry → artifact (same shape as MANUAL_ARTIFACTS entries)
function flashToArtifact(a) {
  return {
    id: `flash:${a.id}`,
    kind: "flash",
    era: "nostalgic",
    title: a.title,
    blurb: a.creator
      ? `A Flash-era classic by ${a.creator}, straight from the archive.`
      : "A Flash-era classic, straight from the archive.",
    year: a.year,
    url: `https://archive.org/details/${a.id}`,
    embed: { type: "archive", id: a.id, aspect: a.aspect },
    credit: a.creator,
  };
}

// Adapted-once cache so a stumble spree doesn't re-map 3000 entries per click.
let flashArtifactsPromise = null;
function loadFlashArtifacts() {
  if (!flashArtifactsPromise) {
    flashArtifactsPromise = loadPool().then((pool) => pool.map(flashToArtifact));
  }
  return flashArtifactsPromise;
}

// The invisible 40/40/20: nostalgic splits between flash and everything else.
// Deep cuts (when unlocked) get their own small bucket on top — the overall
// mix barely shifts, but the dice now occasionally roll strange.
function buildBuckets(flashArtifacts) {
  return [
    { weight: 0.2, items: flashArtifacts },
    { weight: 0.2, items: STATIC.filter((a) => a.era === "nostalgic") },
    { weight: 0.4, items: STATIC.filter((a) => a.era === "current") },
    { weight: 0.2, items: STATIC.filter((a) => a.era === "timeless") },
    ...(getDeepCutsUnlocked() ? [{ weight: 0.12, items: DEEP_CUTS }] : []),
  ].filter((b) => b.items.length > 0);
}

function weightedBucket(buckets) {
  const total = buckets.reduce((s, b) => s + b.weight, 0);
  let roll = Math.random() * total;
  for (const b of buckets) {
    roll -= b.weight;
    if (roll <= 0) return b;
  }
  return buckets[buckets.length - 1];
}

// One stumble: returns a fresh artifact and records it as seen.
// `excludeId` keeps a double-click from landing on the artifact on screen.
export async function drawArtifact(excludeId) {
  const buckets = buildBuckets(await loadFlashArtifacts());
  if (!buckets.length) return null;
  const bucket = weightedBucket(buckets);

  const seen = new Set(getStumbleSeen());
  let candidates = bucket.items.filter(
    (a) => !seen.has(a.id) && a.id !== excludeId
  );
  if (!candidates.length) {
    // This bucket is exhausted for the session — forget ONLY its ids.
    const bucketIds = new Set(bucket.items.map((a) => a.id));
    clearStumbleSeen((id) => bucketIds.has(id));
    candidates = bucket.items.filter((a) => a.id !== excludeId);
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (pick) recordStumbleSeen(pick.id);
  return pick || null;
}

// Resolve a shared deep link (#/stumble?a=<id>) back to its artifact. Deep
// cuts resolve regardless of unlock — a shared 1am find should open for the
// friend it was sent to.
export async function findArtifact(id) {
  if (!id) return null;
  const hit = STATIC.find((a) => a.id === id) || DEEP_CUTS.find((a) => a.id === id);
  if (hit) return hit;
  if (id.startsWith("flash:")) {
    const raw = id.slice("flash:".length);
    const pool = await loadPool();
    const anim = pool.find((a) => a.id === raw);
    if (anim) return flashToArtifact(anim);
  }
  return null;
}

// For scripts/daily-check.js: audit the static pools (deep cuts included)
// without touching the lazy flash chunk (fetch-flash.js validates that one).
export function staticArtifacts() {
  return [...STATIC, ...DEEP_CUTS];
}
