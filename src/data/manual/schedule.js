/* ─────────────────────────────────────────────────────────────────────────
   DEV SCHEDULE  ·  edit this file by hand

   Pin or pool a specific Site News blurb, Curiosity, or Weird Thing to a date
   window. NEVER touched by the AI generators (they only overwrite
   src/data/generated/*), so anything here persists.

   Each entry:
     type:  "news" | "curiosity" | "weird"
     mode:  "pin"  → forced into that slot for the WHOLE window (announcements);
                     if several are pinned at once they rotate day to day.
            "pool" → just added to that slot's normal rotation during the window
                     (it gets a chance to appear, not a guarantee).
     from:  "YYYY-MM-DD"   (required; your local calendar date, inclusive)
     end the window with ONE of:
       until: "YYYY-MM-DD"  (inclusive)   ·   days: N (duration from `from`)
       …or omit both for an open-ended entry (active from `from` onward).
     content fields by type:
       news      → { text }                          (one SITE NEWS line)
       curiosity → { title, blurb, url? }            (the 🌌 card)
       weird     → { title, blurb, url, foundNote? } (the 🔍 card; DAYTIME only —
                    the 🌙 late-night pool is intentionally left untouched)
     id:    optional; auto-derived if omitted.

   Examples (uncomment / copy):
   ───────────────────────────────────────────────────────────────────────── */

import { isWithinWindow } from "../../lib/daily.js";
import { applyLive } from "../live.js";

export const SCHEDULE = [
  // { type: "news", mode: "pin", from: "2026-06-20", days: 7,
  //   text: "🎉 OURCADE turns 1 this week — free quarters, obviously." },

  { type: "news", mode: "pin", from: "2026-06-12", days: 7,
    text: "🎉 OURCADE turns 1 month old this week — free quarters, obviously." },

  { type: "news", mode: "pin", from: "2026-06-12",
    text: "📞 Create an account and you'll get a free Nopia 3310. T9 your friends! (no joke)" },


  { type: "news", mode: "pin", from: "2026-06-12", days: 7,
    text: "👽 Beware, 'Disclosure Day' movie is out, real alien invasion imminent. All hands have been washed clean." },


  // { type: "curiosity", mode: "pin", from: "2026-12-21", until: "2026-12-21",
  //   title: "The winter solstice", blurb: "Today is the shortest day of the year up north — from here, the light only grows.", url: "https://en.wikipedia.org/wiki/Winter_solstice" },

  // { type: "weird", mode: "pool", from: "2026-10-01", until: "2026-10-31",
  //   title: "A website that's just spooky ambience", blurb: "Pure October energy, all month.", url: "https://example.com", foundNote: "haunting since forever" },
];

/* Every entry carries an explicit id before anything else touches it, so the
   #/admin console can hide or override a hand-written entry by id (ids used to
   be derived from array position, which shifts the moment one is hidden).
   The derived value matches the old `sched-<type>-<index>` shape exactly, so
   nothing that already relied on those ids moves. */
export const SCHEDULE_BASE = SCHEDULE.map((e, i) => ({
  ...e,
  id: e.id || `sched-${e.type}-${i}`,
}));

// Normalize a schedule entry to the item shape its slot's pool expects.
function toItem(e, i) {
  const id = e.id || `sched-${e.type}-${i}`;
  if (e.type === "news") return e.text; // news pool items are plain strings
  if (e.type === "curiosity") return { id, title: e.title, blurb: e.blurb, url: e.url };
  if (e.type === "weird")
    return { id, title: e.title, blurb: e.blurb, url: e.url, foundNote: e.foundNote };
  return null;
}

// Active entries of a type for `key`, split by mode and ready to merge.
// Returns { pinned, pool } — empty arrays when nothing is scheduled (the
// default), so consumers behave exactly as before until an entry goes live.
export function activeSchedule(type, key) {
  const pinned = [];
  const pool = [];
  // Hand-written entries, plus anything scheduled from the #/admin console —
  // and minus anything hidden there. Going through applyLive (rather than just
  // appending the adds) is what lets the console hide or override an entry
  // written here. Both kinds then take the same window test and the same
  // toItem() normalization, so a phone-scheduled pin behaves exactly like one
  // committed here — and this single seam covers news, curiosities AND weird.
  const entries = applyLive(SCHEDULE_BASE, "schedule");
  entries.forEach((e, i) => {
    if (e.type !== type || !isWithinWindow(key, e)) return;
    const item = toItem(e, i);
    if (item == null) return;
    (e.mode === "pin" ? pinned : pool).push(item);
  });
  return { pinned, pool };
}
