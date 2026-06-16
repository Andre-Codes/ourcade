/* ─────────────────────────────────────────────────────────────────────────
   ON THIS DAY  ·  edit this file by hand
   (the 💧 Water Cooler "On This Day" almanac — see src/data/onthisday.js)

   Unlike every other pool, this one is keyed by CALENDAR DATE, not rotated.
   Each entry is anchored to a real past date (roughly 1995–2009 — the site's
   nostalgic register) and says what was #1 / on top of the box office / the
   talk of TV on that month-day. The loader (src/data/onthisday.js) looks up
   today's MM-DD and surfaces the match.

   This is the ONE content type that intentionally USES hard calendar dates:
   the date IS the content (it's an almanac), so the site's usual "no hard
   dates / keep it understandable weeks later" voice rule does NOT apply here.

   These are HAND-VERIFIED facts (same accuracy contract as MANUAL_FACTS): a
   #1 song or top box-office film on a specific date is checkable, so keep them
   TRUE. AI generation of this type is gated OFF by default (GENERATE_ONTHISDAY
   in scripts/generate-content.js) until entries can be accuracy-reviewed.

   Each entry — every field optional except id / md / year:
     id         — unique slug, e.g. "otd-0815-1999"
     md         — "MM-DD" this is "on this day" for (zero-padded)
     year       — the throwback year (number)
     no1Song    — { title, by }       what was #1 on the charts
     inTheaters — { title }           what topped / opened at the box office
     onTV       — { title }           what everyone was watching / talking about
     blurb      — dry one-line recap (optional)

   Coverage won't hit all 366 days at launch; the loader falls back to the
   nearest earlier date so the card is NEVER blank. Add more over time.
   ───────────────────────────────────────────────────────────────────────── */

export const ON_THIS_DAY = [
  {
    id: "otd-0101-2000",
    md: "01-01",
    year: 2000,
    no1Song: { title: "Smooth", by: "Santana feat. Rob Thomas" },
    inTheaters: { title: "Stuart Little" },
    onTV: { title: "Who Wants to Be a Millionaire" },
    blurb: "The world did not end. The Y2K bug went out with a whimper, and 'Smooth' was somehow still everywhere.",
  },
  {
    id: "otd-0211-2004",
    md: "02-11",
    year: 2004,
    no1Song: { title: "Hey Ya!", by: "OutKast" },
    inTheaters: { title: "50 First Dates" },
    onTV: { title: "American Idol (season 3)" },
    blurb: "You were being told to shake it like a Polaroid picture by approximately everyone.",
  },
  {
    id: "otd-0314-2003",
    md: "03-14",
    year: 2003,
    no1Song: { title: "In da Club", by: "50 Cent" },
    inTheaters: { title: "Bringing Down the House" },
    onTV: { title: "Joe Millionaire" },
    blurb: "Go shorty, it's the ides of March, we're gonna party like it's your birthday.",
  },
  {
    id: "otd-0521-1999",
    md: "05-21",
    year: 1999,
    no1Song: { title: "Livin' la Vida Loca", by: "Ricky Martin" },
    inTheaters: { title: "Star Wars: Episode I – The Phantom Menace" },
    onTV: { title: "Friends" },
    blurb: "A nation queued for days to find out what 'midi-chlorians' were. Worth it? The debate never ended.",
  },
  {
    id: "otd-0615-2001",
    md: "06-15",
    year: 2001,
    no1Song: { title: "Lady Marmalade", by: "Christina, Lil' Kim, Mýa & Pink" },
    inTheaters: { title: "Atlantis: The Lost Empire" },
    onTV: { title: "Survivor" },
    blurb: "Four pop stars, one Moulin Rouge soundtrack, and a 'voulez-vous' lodged in your head for a year.",
  },
  {
    id: "otd-0704-2002",
    md: "07-04",
    year: 2002,
    no1Song: { title: "Hot in Herre", by: "Nelly" },
    inTheaters: { title: "Men in Black II" },
    onTV: { title: "American Idol (season 1)" },
    blurb: "It was, per Nelly, getting hot in here. We were all encouraged to act accordingly.",
  },
  {
    id: "otd-0815-1999",
    md: "08-15",
    year: 1999,
    no1Song: { title: "Genie in a Bottle", by: "Christina Aguilera" },
    inTheaters: { title: "The Sixth Sense" },
    onTV: { title: "Who Wants to Be a Millionaire" },
    blurb: "Nobody had spoiled the twist yet. Imagine that. A whole world that didn't know.",
  },
  {
    id: "otd-0911-2004",
    md: "09-11",
    year: 2004,
    no1Song: { title: "Lean Back", by: "Terror Squad" },
    inTheaters: { title: "Resident Evil: Apocalypse" },
    onTV: { title: "The O.C." },
    blurb: "The instruction of the season: lean back. People did not, in fact, rock-rock-away.",
  },
  {
    id: "otd-1031-2005",
    md: "10-31",
    year: 2005,
    no1Song: { title: "Gold Digger", by: "Kanye West feat. Jamie Foxx" },
    inTheaters: { title: "Saw II" },
    onTV: { title: "Lost" },
    blurb: "A Halloween where every third costume was a polo and popped collar. We were young and confused.",
  },
  {
    id: "otd-1124-2006",
    md: "11-24",
    year: 2006,
    no1Song: { title: "Irreplaceable", by: "Beyoncé" },
    inTheaters: { title: "Happy Feet" },
    onTV: { title: "Heroes" },
    blurb: "To the left, to the left. An entire generation learned to dismiss someone with choreography.",
  },
  {
    id: "otd-1225-2003",
    md: "12-25",
    year: 2003,
    no1Song: { title: "Hey Ya!", by: "OutKast" },
    inTheaters: { title: "The Lord of the Rings: The Return of the King" },
    onTV: { title: "Trading Spaces" },
    blurb: "You unwrapped an iPod the size of a deck of cards and thought the future had fully arrived.",
  },
];
