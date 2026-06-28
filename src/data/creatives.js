/* Creatives — the read seam over the "things to make" corpus, powering the
   /creatives page. Every item gives the visitor a next move (print this, draw
   this). Hand-curated for now (src/data/manual/creatives.js); a generated
   supplement can layer in later, the same way curiosities.js does it.

   Pure JS (no React / no DOM) so this can be imported by the page AND by
   headless node scripts (scripts/daily-check.js). */

import { rotateDaily } from "../lib/daily.js";
import { MANUAL_CREATIVES, FALLBACK_CREATIVES } from "./manual/creatives.js";
// Generated on-site "how to draw" guides built from public-domain plates
// (scripts/fetch-draw-guides.js). Plain data — safe to import under node.
// Empty array until the generator runs.
import drawGuides from "./generated/draw-guides.js";
// Future AI lane for the rest of the pool — same pattern when it lands:
// import generated from "./generated/creatives.js";

// Manual entries first, then the generated supplements when they exist.
export const CREATIVES = [
  ...MANUAL_CREATIVES,
  ...(Array.isArray(drawGuides) ? drawGuides : []),
  // ...(Array.isArray(generated) && generated.length ? generated : []),
];

// What the page actually renders — never empty, so the grid can't go blank.
export const CREATIVES_POOL = CREATIVES.length ? CREATIVES : FALLBACK_CREATIVES;

const SALT = 1414; // independent rotation order (see src/lib/daily.js salt table)

// Time-commitment buckets — the free-text `time` on each item is messy on
// purpose (authoring stays loose); we derive a stable bucket so the chip filter
// has fixed values. Order here is the chip display order.
export const TIME_BUCKETS = ["quick", "hour", "weekend"];

export const TIME_BUCKET_LABEL = {
  quick: "⏱ under 15 min",
  hour: "🕐 about an hour",
  weekend: "📅 a weekend",
};

// Map an item's free-text `time` to one of TIME_BUCKETS. Heuristic and forgiving:
// anything that reads like hours/days/"weekend" is a weekend project; an explicit
// small-minute count is "quick"; everything else is the middle "hour" bucket.
export function timeBucketOf(item) {
  const t = String(item?.time || "").toLowerCase();
  if (/week|weekend|day|days/.test(t)) return "weekend";
  const mins = t.match(/(\d+)\s*(?:min|minute)/);
  if (mins) return Number(mins[1]) <= 20 ? "quick" : "hour";
  // Plain hour mentions ("~1 hour", "1-3 hours"): 2+ hours leans weekend-ish.
  const hrs = t.match(/(\d+)\s*(?:-\s*\d+\s*)?h(?:our|r)?/);
  if (hrs) return Number(hrs[1]) >= 3 ? "weekend" : "hour";
  return "hour";
}

// Case-insensitive title+blurb contains, optionally scoped to one `lane` and one
// time `bucket`. Same idiom as searchVault() in vault.js. Pass "all"/empty to
// skip a filter.
export function searchCreatives(items, query, lane, bucket) {
  const q = (query || "").trim().toLowerCase();
  return (items || []).filter((c) => {
    if (lane && lane !== "all" && c.lane !== lane) return false;
    if (bucket && bucket !== "all" && timeBucketOf(c) !== bucket) return false;
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.blurb.toLowerCase().includes(q)
    );
  });
}

// Reserved for a future "creative mission of the day" hero — a date-seeded pick,
// same for everyone, stable for the day (the ritual feel). Not surfaced in the
// v1 UI; kept here so adding it later is a one-liner.
export function getCreativeOfTheDay(key) {
  const pool = CREATIVES_POOL;
  if (!pool.length) return null;
  return rotateDaily(pool, key, SALT);
}

// Look up one creative by id — mirrors getQuiz() in quizzes.js. Searches the
// live pool (manual or fallback) so /creatives/:id resolves the same item the
// grid shows. Returns null when nothing matches (the guide page shows not-found).
export function getCreative(id) {
  return CREATIVES_POOL.find((c) => c.id === id) || null;
}

// Is this an on-site step guide (renders at /creatives/:id) rather than an
// external link? A guide is flagged AND actually carries steps — so a half-built
// item (guide:true but no steps yet) is treated as a plain link, never a blank
// walkthrough. The card link branch and the guide page both gate on this.
export function isGuide(item) {
  return !!(item && item.guide && Array.isArray(item.steps) && item.steps.length);
}
