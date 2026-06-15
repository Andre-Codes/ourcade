/* ─────────────────────────────────────────────────────────────────────────
   FEATURED — real-world games worth a look  ·  edit this file by hand

   The homepage "FEATURED GAME" card spotlights a real game — past, current,
   or future — especially the lesser-known, fascinating ones (Caves of Qud,
   Outer Wilds, an upcoming release you're excited about). This is distinct
   from the Ourcade Game of the Day, which surfaces a *playable* Ourcade game.

   The card shows the FIRST entry in this array. To change what's featured,
   move an entry to the top (newest-first is the convention).

   ── Switching to daily rotation later ──────────────────────────────────────
   When this pool is big enough to be a self-sustaining staple (like Game of
   the Day), make the card pick one game per day instead of always FEATURED[0].
   In src/components/DailyBand.jsx, inside the FeaturedGame() component, replace:

        const game = FEATURED[0];
   with:
        const game = rotateDaily(FEATURED, todayKey(), 2);

   rotateDaily + todayKey are ALREADY imported at the top of that file (they
   drive Game of the Day), so no new imports are needed. rotateDaily
   deterministically shuffles the pool and steps one per day with no repeats
   until it cycles. The third arg is a "salt" — use a value not already taken:
   Game of the Day uses 0, so pass 1, 2, … here so the two cards don't move in
   lockstep.

   No data changes are needed — every entry already has the fields rotateDaily
   needs. Until then, FEATURED[0] is shown and array order is the control.

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

];
