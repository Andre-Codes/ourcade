/* On This Day — the 💧 Water Cooler's almanac. UNLIKE every other pool this is keyed
   by CALENDAR DATE, not rotated: we look up today's MM-DD and surface the matching
   entry — a few REAL, dated historical events for that date, each with a Wikipedia
   "read more" source. The events come from the official Wikimedia "On This Day"
   feed, prebuilt across all 366 days by scripts/fetch-onthisday.js into
   generated/onthisday.js. Hand-curated overrides (src/data/manual/onthisday.js)
   lead the pool when present. Pure JS — importable by the UI and by daily-check.js.

   Determinism: a given calendar date always resolves to the same entry. When several
   entries share one MM-DD we rotateDaily among them (still deterministic per day).
   When no exact MM-DD exists we fall back to the nearest EARLIER calendar date so the
   card is never blank.

   Entry shape: { id, md, events: [{ year, text, source, sourceTitle }] }. */

import { rotateDaily } from "../lib/daily.js";
import generated from "./generated/onthisday.js";
import { ON_THIS_DAY } from "./manual/onthisday.js";

const SALT = 1010; // only used to disambiguate multiple entries on the same MM-DD

// Minimal safety net if both pools are ever emptied (keeps the card alive).
const FALLBACK = [
  {
    id: "otd-fallback",
    md: "01-01",
    events: [
      {
        year: 2000,
        text: "The Y2K scare passed without major incident as the world's computers rolled over to the year 2000.",
        source: "https://en.wikipedia.org/wiki/Year_2000_problem",
        sourceTitle: "Year 2000 problem",
      },
    ],
  },
];

export const ON_THIS_DAY_ALL = [
  ...ON_THIS_DAY,
  ...(Array.isArray(generated) && generated.length ? generated : []),
];

// "MM-DD" as an ordinal (1..1231) so we can find the nearest earlier date by value.
function mdOrdinal(md) {
  const [m, d] = md.split("-").map(Number);
  return m * 100 + d;
}

// Today's almanac entry. Exact MM-DD match first (rotateDaily if several years
// share it), else the nearest earlier calendar date, else a small fallback.
export function getOnThisDay(key) {
  const pool = ON_THIS_DAY_ALL.length ? ON_THIS_DAY_ALL : FALLBACK;
  const md = key.slice(5); // "YYYY-MM-DD" → "MM-DD"

  const exact = pool.filter((e) => e.md === md);
  if (exact.length) return rotateDaily(exact, key, SALT);

  // No exact match → nearest entry on or before today's date (wrap to latest if
  // today precedes every entry). Deterministic: purely a function of the date.
  const target = mdOrdinal(md);
  const sorted = [...pool].sort((a, b) => mdOrdinal(a.md) - mdOrdinal(b.md));
  let pick = sorted[sorted.length - 1]; // wrap-around default (latest in year)
  for (const e of sorted) {
    if (mdOrdinal(e.md) <= target) pick = e;
  }
  return pick;
}
