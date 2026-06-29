/* ─────────────────────────────────────────────────────────────────────────
   MANUAL CREATIVES CONFIG  ·  edit this file by hand
   (part of the hand-edit hub in src/data/manual/ — see README.md there)

   The /creatives page ("things creative people can do today"). Unlike a feed,
   every item gives the visitor a NEXT MOVE — print this, draw this, make this.
   This file is the sole source for now (no AI generator yet), and is NEVER
   overwritten by `npm run generate`, so your entries persist forever.

   Item shape:
     id:         unique kebab-case string (prefix "cr-")
     lane:       "print" | "draw"   (extensible later: build/remix/study)
     title:      short headline
     blurb:      one line on why it's worth doing ("why it's cool")
     time:       free text, e.g. "10 min", "1-3 hours", "a weekend".
                 Bucketed for the time filter — see timeBucketOf() in
                 ../creatives.js. Keep wording loose; the bucket is derived.
     difficulty: "beginner" | "intermediate" | "advanced"
     cost:       "free" | "paid"   (most finds are free; flag the rare paid one)
     action:     the explicit next move, imperative ("Download, slice, print")

   Where the card sends the visitor — pick ONE:
     • EXTERNAL (default): set
         url:    where the visitor goes (the STL file, the source page)
         source: short label for that link (shown on the portal button)
     • PLATE-ONLY GUIDE (simplest — the image IS the guide): set
         guide:  true
         plate:  a plain slug. The reference image lives at
                 assets-src/creatives/<lane>/plates/<plate>.png and is shown
                 big at /creatives/<id> with the title — no step text. Great for
                 a self-explanatory how-to-draw sheet. Optional `plateCredit`
                 string for a source line under the image.
     • ON-SITE STEP GUIDE: set
         guide:  true
         steps:  [{ image, caption }, …] in order — a step-by-step walkthrough
                 rendered at /creatives/<id>. `caption` is plain text; `image`
                 is a plain slug (no path/extension) — art lives under the LANE
                 folder at assets-src/creatives/<lane>/steps/<id>/<image>.png
                 (draw→drawings, print→prints, … per LANE_DIR in
                 ../../components/creativeArt.js).
       (A guide needs no url/source. Run `npm run assets:creatives` after
        dropping plate/step art to optimize it into src/assets.)

   Card / header art (optional — precedence: image → imageUrl → fallback tile):
     image:    bundled slug → optimized from assets-src/creatives/<lane>/<slug>.png
               (run `npm run assets:creatives` after dropping art there).
     imageUrl: a remote thumbnail URL (used only when `image` is absent).
     (With neither, the card shows a styled lane-emoji tile, never a broken img.)

   Guide extras (optional, on guide items):
     materials: string[]  ("what you'll need")
     tips:      string[]  (pointers shown after the steps)

   - Keep every `id` unique. Run `node scripts/daily-check.js` after editing.
   - Leave the array empty ([]) to add nothing; the FALLBACK keeps the page
     from ever rendering blank.

   AGENTS: when the user hands you images + a title for a drawing guide, follow
   docs/adding-creative-guides.md — it's the full procedure for placing/optimizing
   step art and authoring the entry (the user only supplies raw material).
   ───────────────────────────────────────────────────────────────────────── */

export const MANUAL_CREATIVES = [
  // ── PRINT — free STL files, printables, and 3D-printing guides ───────────
  {
    id: "cr-articulated-slug",
    lane: "print",
    title: "Print-in-place articulated slug",
    blurb:
      "A wiggly slug that prints fully assembled — no supports, no glue. A perfect first test of your printer's tolerances.",
    image: "articulated-slug",
    url: "https://www.printables.com/model/120043-articulated-slug",
    source: "Printables",
    time: "1-3 hours",
    difficulty: "beginner",
    cost: "free",
    action: "Download, slice, print",
  },
  {
    id: "cr-benchy",
    lane: "print",
    title: "#3DBenchy — the torture-test boat",
    blurb:
      "The little tugboat the whole hobby uses to benchmark a printer. Overhangs, bridges, fine detail — all in one ~1 hour print.",
    image: "benchy",
    url: "https://www.thingiverse.com/thing:763622",
    source: "Thingiverse",
    time: "~1 hour",
    difficulty: "beginner",
    cost: "free",
    action: "Print it, then read the surface for flaws",
  },
  {
    id: "cr-gridfinity",
    lane: "print",
    title: "Gridfinity — modular desk organizers",
    blurb:
      "An open standard of snap-together bins and baseplates. Print exactly the drawer organizer your junk demands.",
    image: "gridfinity",
    url: "https://gridfinity.xyz/",
    source: "gridfinity.xyz",
    time: "a weekend",
    difficulty: "intermediate",
    cost: "free",
    action: "Plan your grid, then print bins to fit",
  },
  {
    id: "cr-spiral-vase",
    lane: "print",
    title: "Spiralized 'vase mode' planter",
    blurb:
      "One continuous wall, no infill, no seams — the fastest, prettiest way to learn vase mode in your slicer.",
    image: "spiral-vase",
    url: "https://www.printables.com/model/40361-twisted-6-sided-vase-basic",
    source: "Printables",
    time: "~1 hour",
    difficulty: "beginner",
    cost: "free",
    action: "Enable vase mode in your slicer, then print",
  },
  {
    id: "cr-print-supports-guide",
    lane: "print",
    title: "How to actually use supports",
    blurb:
      "When you need them, where they go, and how to peel them off clean. The guide that fixes most beginner print fails.",
    image: "print-supports",
    url: "https://all3dp.com/2/3d-printing-support-structures/",
    source: "All3DP",
    time: "15 min",
    difficulty: "beginner",
    cost: "free",
    action: "Read it before your next overhang",
  },
  {
    id: "cr-print-finishing",
    lane: "print",
    title: "Sand, prime & paint a 3D print",
    blurb:
      "Turn a ridged plastic blob into something that looks made. Filler primer, wet-sanding, and a rattle-can finish.",
    image: "print-finishing",
    url: "https://all3dp.com/2/3d-print-smoothing-pla-how-to-smooth-pla-prints/",
    source: "All3DP",
    time: "a weekend",
    difficulty: "intermediate",
    cost: "free",
    action: "Print something, then finish it properly",
  },

  // ── DRAW — the lane is plate-only by default now: ~40 public-domain drawing
  //    plates come from scripts/fetch-draw-guides.js (src/data/generated). Add
  //    your OWN draw items here when you want — a plate-only guide (just an image
  //    + title; see template above) or a full per-step guide. Nothing required
  //    here; leave it empty and the generated plates carry the lane.
];

// Minimal safety net (one per lane) if MANUAL_CREATIVES is ever emptied, so the
// page never renders blank. Same idea as FALLBACK in ../curiosities.js.
export const FALLBACK_CREATIVES = [
  {
    id: "fallback-print-benchy",
    lane: "print",
    title: "#3DBenchy — the torture-test boat",
    blurb:
      "The little tugboat the whole hobby uses to benchmark a printer — overhangs, bridges, and fine detail in one print.",
    url: "https://www.thingiverse.com/thing:763622",
    source: "Thingiverse",
    time: "~1 hour",
    difficulty: "beginner",
    cost: "free",
    action: "Print it, then read the surface for flaws",
  },
  {
    // Plate-only guide pointing at a public-domain plate the fetcher writes
    // (src/assets/creatives/drawings/plates/cat.webp). If that image isn't built
    // yet, the page still renders the title + credit (never blank).
    id: "fallback-draw-cat",
    lane: "draw",
    guide: true,
    plate: "cat",
    plateCredit: "E.G. Lutz, “What to Draw and How to Draw It” (1913) — public domain",
    title: "How to draw a cat",
    image: "cat",
    time: "10 min",
    difficulty: "beginner",
    cost: "free",
    action: "Grab a pencil and copy it line for line",
  },
];
