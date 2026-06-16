/* On This Day — the 💧 Water Cooler's almanac. UNLIKE every other pool this is keyed
   by CALENDAR DATE, not rotated: we look up today's MM-DD and surface the matching
   throwback (what was #1 / in theaters / on TV on that date in ~1995–2009). Hand-
   verified entries (src/data/manual/onthisday.js) are the source of truth; the
   generated supplement is gated off by default. Pure JS — importable by the UI and
   by scripts/daily-check.js.

   Determinism: a given calendar date always resolves to the same entry. When several
   throwback years share one MM-DD we rotateDaily among them (still deterministic per
   day, but it varies year to year). When no exact MM-DD exists we fall back to the
   nearest EARLIER calendar date so the card is never blank. */

import { rotateDaily } from "../lib/daily.js";
import generated from "./generated/onthisday.js";
import { ON_THIS_DAY } from "./manual/onthisday.js";

const SALT = 1010; // only used to disambiguate multiple years on the same MM-DD

// Minimal safety net if the manual list is ever emptied (keeps the card alive).
const FALLBACK = [
  {
    id: "otd-fallback",
    md: "01-01",
    year: 2000,
    no1Song: { title: "Smooth", by: "Santana feat. Rob Thomas" },
    inTheaters: { title: "Stuart Little" },
    onTV: { title: "Who Wants to Be a Millionaire" },
    blurb: "The world did not end. The Y2K bug went out with a whimper.",
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
