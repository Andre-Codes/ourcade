/* ─────────────────────────────────────────────────────────────────────────
   MOVIES — currently in theaters  ·  edit this file by hand

   A hand-verified list of movies in theaters right now, with the one thing
   the multiplex never tells you: is it worth sitting through the credits?

   Add an entry when a movie opens; delete it when it leaves theaters. The
   homepage "STAY FOR THE CREDITS?" card lists every entry here (newest first
   is up to you — order in the array is the order shown).

   Each entry:
     id      — unique slug (kebab-case), e.g. "some-movie-2026"
     title   — display title
     stinger — "yes" | "no"  → drives the verdict chip (✅ stay / 🚫 nothing)
     credits — free-text detail (optional). Write it however you like, e.g.
               "Yes — a mid-credits scene about 2 min in, then another ~3 min
                later." Shown under the title when present.
   ───────────────────────────────────────────────────────────────────────── */

export const MOVIES = [
  // {
  //   id: "some-movie-2026",
  //   title: "Some Movie",
  //   stinger: "yes",
  //   credits: "Yes — mid-credits scene ~2 min in, then another ~3 min later.",
  // },
  {
    id: "the-furious-2026",
    title: "The Furious",
    stinger: "no",
    credits: "No — however, if you watch a showing in China you will see an extra scene.",
  },
  {
    id: "disclosure-day-2026",
    title: "Disclosure Day",
    stinger: "no",
  },
  {
    id: "scary-movie-2026",
    title: "Scary Movie",
    stinger: "yes",
    credits: "Yes — a mid-credits scene about 2 min in, then another ~3 min later.",
  },

];
