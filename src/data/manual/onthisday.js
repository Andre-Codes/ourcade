/* ─────────────────────────────────────────────────────────────────────────
   ON THIS DAY  ·  edit this file by hand
   (the 💧 Water Cooler "On This Day" almanac — see src/data/onthisday.js)

   Unlike every other pool, this one is keyed by CALENDAR DATE, not rotated.
   Each entry is a few REAL, dated historical events for a month-day, each with
   a Wikipedia "read more" source. The loader (src/data/onthisday.js) looks up
   today's MM-DD and surfaces the match.

   The almanac is now sourced authoritatively from the official Wikimedia
   "On This Day" feed, prebuilt across all 366 days by scripts/fetch-onthisday.js
   into src/data/generated/onthisday.js. So this hand-edit file is just an
   OVERRIDE SEAM: anything you add here leads the pool for its MM-DD (and is
   never overwritten by the fetch), but you no longer need to hand-curate
   coverage — the generated feed already covers every day with real, sourced
   events.

   Each entry:
     id     — unique slug, e.g. "otd-0815"
     md     — "MM-DD" this is "on this day" for (zero-padded)
     events — [{ year, text, source, sourceTitle }]
                year        — the year it happened (number)
                text        — one-line description of the event
                source      — a working "read more" URL (Wikipedia or equally durable)
                sourceTitle — short label for the link (e.g. the article title)

   Leave the array empty ([]) to add no overrides (the generated feed stands).
   Run `node scripts/daily-check.js` after editing to sanity-check the lookup.
   ───────────────────────────────────────────────────────────────────────── */

export const ON_THIS_DAY = [
  // {
  //   id: "otd-0521",
  //   md: "05-21",
  //   events: [
  //     {
  //       year: 1999,
  //       text: "Star Wars: Episode I – The Phantom Menace opened in theaters.",
  //       source: "https://en.wikipedia.org/wiki/Star_Wars:_Episode_I_%E2%80%93_The_Phantom_Menace",
  //       sourceTitle: "The Phantom Menace",
  //     },
  //   ],
  // },
];
