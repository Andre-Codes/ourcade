/* ─────────────────────────────────────────────────────────────────────────
   FEATURED — real-world games worth a look  ·  edit this file by hand

   The homepage "FEATURED GAME" card spotlights a real game — past, current,
   or future — especially the lesser-known, fascinating ones (Caves of Qud,
   Outer Wilds, an upcoming release you're excited about). This is distinct
   from the Ourcade Game of the Day, which surfaces a *playable* Ourcade game.

   The card cycles ONE entry per week, no repeats until the whole pool is
   exhausted (rotateEvery(FEATURED, key, 7, 2) in DailyBand.jsx's FeaturedGame).
   On-screen order is deterministic but shuffled, so array order here is NOT the
   on-screen order — add new entries anywhere. With a single entry the card just
   shows that one game until you add more. Weeks roll on a local-calendar
   boundary shared across all devices (Wordle-style), same as Game of the Day.

   Each entry:
     id       — unique slug (kebab-case), e.g. "caves-of-qud". Also the React key.
     title    — display title.
     blurb    — 1–2 sentence pitch (why it's worth a look).
     tagline  — short meta line, e.g. "roguelike · science-fantasy" (optional).
     year     — release year or "TBA" (optional; shown in the meta line).
     url      — outbound link (Steam / official site / itch.io). Opens in a new tab.
     image    — BASENAME only (no path/extension). The optimized graphic lives at
                src/assets/featured/<image>.webp. Drop source art in
                assets-src/featured/<image>.(png|jpg|jpeg|webp) and run
                `npm run assets:featured`. If the .webp is missing the card still
                renders (with a placeholder).
     accent   — optional theme color (hex). Falls back to a default if omitted.
   ───────────────────────────────────────────────────────────────────────── */

export const FEATURED = [
  // {
  //   id: "caves-of-qud",
  //   title: "Caves of Qud",
  //   blurb:
  //     "A deeply strange science-fantasy roguelike where every blade of grass, " +
  //     "faction, and ruined city is simulated — and you can talk your way through " +
  //     "most of it.",
  //   tagline: "roguelike · science-fantasy",
  //   year: "2024",
  //   url: "https://store.steampowered.com/app/333640/Caves_of_Qud/",
  //   image: "caves-of-qud",
  //   accent: "#7fd17f",
  // },

  {
    id: "caves-of-qud",
    title: "Caves of Qud",
    blurb:
      "A deeply strange science-fantasy roguelike where every blade of grass, " +
      "faction, and ruined city is simulated — and you can talk your way through " +
      "most of it.",
    tagline: "roguelike · science-fantasy",
    year: "2024",
    url: "https://www.cavesofqud.com/",
    image: "caves-of-qud",
    accent: "#116749",
  },

  {
  id: "librarian-tidy-up-the-arcane-library",
  title: "Librarian: Tidy Up the Arcane Library!",
  blurb:
    "A cozy-but-obsessive organization sim where a chaotic magical library " +
    "has dumped thousands of books everywhere — and your only escape is " +
    "shelving all 3,072 of them correctly.",
  tagline: "organization sim · cozy magic",
  year: "2026",
  url: "https://store.steampowered.com/app/4197610/Librarian_Tidy_Up_the_Arcane_Library/",
  image: "librarian-tidy-arcane-library",
  accent: "#6B4BB8",
},

];
