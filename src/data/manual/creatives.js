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
     • ON-SITE GUIDE: set
         guide:  true
         steps:  [{ image, caption }, …] in order — a step-by-step walkthrough
                 rendered at /creatives/<id>. `caption` is plain text; `image`
                 is a plain slug (no path/extension) resolved to
                 src/assets/creatives/steps/<id>/<image>.webp.
       (A guide needs no url/source. Use this instead of linking to a bare
        Google/YouTube search — host the steps here.)

   Card / header art (optional — precedence: image → imageUrl → fallback tile):
     image:    bundled slug → src/assets/creatives/<slug>.webp (run
               `npm run assets:creatives` after dropping art in assets-src/).
     imageUrl: a remote thumbnail URL (used only when `image` is absent).
     (With neither, the card shows a styled lane-emoji tile, never a broken img.)

   Guide extras (optional, on guide items):
     materials: string[]  ("what you'll need")
     tips:      string[]  (pointers shown after the steps)

   - Keep every `id` unique. Run `node scripts/daily-check.js` after editing.
   - Leave the array empty ([]) to add nothing; the FALLBACK keeps the page
     from ever rendering blank.
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

  // ── DRAW — low-stakes sketch prompts and how-to-draw sheets ──────────────
  {
    id: "cr-draw-cartoon-hand",
    lane: "draw",
    guide: true,
    title: "Draw a cartoon hand (without crying)",
    blurb:
      "Hands are everyone's nemesis. This breaks them into a mitten plus sausages — suddenly they're easy little guys.",
    image: "cartoon-hand",
    time: "15 min",
    difficulty: "beginner",
    cost: "free",
    action: "Sketch one, then a few from your own hand",
    materials: [
      "A pencil",
      "Paper",
      "Your own non-drawing hand, to copy from",
    ],
    steps: [
      {
        image: "step-1",
        caption:
          "Draw a rounded square for the palm. Don't overthink it — a hand is mostly just this block plus fingers.",
      },
      {
        image: "step-2",
        caption:
          "Add a 'mitten' shape: the thumb as a bump on one side, and a soft curve across the top where the fingers will sprout.",
      },
      {
        image: "step-3",
        caption:
          "Draw four sausages for the fingers off that top curve. The middle one is longest; the others step down on either side.",
      },
      {
        image: "step-4",
        caption:
          "Add a short sausage for the thumb. Mark a couple of knuckle creases on each finger so they look like they can bend.",
      },
      {
        image: "step-5",
        caption:
          "Clean up the outline into one smooth shape, erase the guides, and you've got a cartoon hand. Now try it in a fist or a wave.",
      },
    ],
    tips: [
      "Glance at your own hand constantly — it's the best reference you own.",
      "Sausage fingers first, details later. The knuckle creases are what sell the bend.",
      "Cartoon hands often have just three fingers + a thumb. Try it; it reads cleaner.",
    ],
  },
  {
    id: "cr-draw-dragon",
    lane: "draw",
    title: "How to draw a dragon in 6 steps",
    blurb:
      "Big shapes first, scales last. A friendly step-by-step that gets you a respectable dragon before you overthink it.",
    image: "dragon",
    url: "https://www.artforkidshub.com/how-to-draw-a-dragon/",
    source: "Art for Kids Hub",
    time: "15 min",
    difficulty: "beginner",
    cost: "free",
    action: "Follow the steps, then give it a personality",
  },
  {
    id: "cr-draw-wizard-cat",
    lane: "draw",
    guide: true,
    title: "Draw a wizard cat",
    blurb:
      "A cat. A little hat. A tiny staff. Pure low-stakes fun — the whole point is to make one weird guy and stop.",
    image: "wizard-cat",
    time: "10 min",
    difficulty: "beginner",
    cost: "free",
    action: "Sketch it, then remix it (cyberpunk wizard cat?)",
    materials: [
      "Any pencil (a softer one, like a 2B, erases cleaner)",
      "Paper — printer paper is totally fine",
      "A fineliner or pen for the final lines (optional)",
    ],
    steps: [
      {
        image: "step-1",
        caption:
          "Lightly draw a circle for the head and a rounded egg below it for the body. Keep it loose — these are just guides you'll erase later.",
      },
      {
        image: "step-2",
        caption:
          "Add two triangle ears on top, then a tall, slightly floppy cone hat sitting between them. The hat is what makes him read 'wizard,' so make it big.",
      },
      {
        image: "step-3",
        caption:
          "Give him two big round eyes, a tiny triangle nose, and a few whisker dots. A small curved mouth makes him look pleased with himself.",
      },
      {
        image: "step-4",
        caption:
          "Sketch a little cloak sweeping off one shoulder and a thin staff in one paw. Top the staff with a star or a small orb.",
      },
      {
        image: "step-5",
        caption:
          "Ink the lines you like with a pen, erase the rough pencil guides, and scatter a few stars around him. Done — one weird little guy.",
      },
    ],
    tips: [
      "Keep the early shapes light; you're going to erase most of them.",
      "If the face feels off, it's almost always the eyes — try moving them closer together.",
      "Once you've got him, remix it: a cyberpunk wizard cat, a tiny apprentice, a grumpy one.",
    ],
  },
  {
    id: "cr-draw-90s-anime-eye",
    lane: "draw",
    title: "Draw a 90s anime eye",
    blurb:
      "Those tall, glossy eyes with the big highlight. Nail the proportions and any character instantly reads retro-anime.",
    image: "anime-eye",
    url: "https://www.gvaat.com/blog/how-to-draw-anime-eyes-step-by-step-tutorial/",
    source: "Gvaat's Workshop",
    time: "15 min",
    difficulty: "beginner",
    cost: "free",
    action: "Draw a pair, then build a face around them",
  },
  {
    id: "cr-draw-loomis-heads",
    lane: "draw",
    title: "Andrew Loomis: 'Fun with a Pencil'",
    blurb:
      "The classic public-domain drawing book. The 'blook head' method makes turning a face in 3D feel almost mechanical.",
    image: "loomis-heads",
    url: "https://archive.org/details/funwithpencil00loom",
    source: "archive.org",
    time: "a weekend",
    difficulty: "intermediate",
    cost: "free",
    action: "Work through the head chapter with a pencil",
  },
  {
    id: "cr-draw-gesture-quickposes",
    lane: "draw",
    title: "30-second gesture drawing",
    blurb:
      "A free timed-pose generator. Fast, loose figures train your eye more in ten minutes than an hour of careful lines.",
    image: "gesture-quickposes",
    url: "https://quickposes.com/en/gestures/timed",
    source: "QuickPoses",
    time: "10 min",
    difficulty: "intermediate",
    cost: "free",
    action: "Run a 30-second set, no erasing allowed",
  },
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
    id: "fallback-draw-dragon",
    lane: "draw",
    title: "How to draw a dragon in 6 steps",
    blurb:
      "Big shapes first, scales last — a friendly step-by-step that gets you a respectable dragon before you overthink it.",
    url: "https://www.artforkidshub.com/how-to-draw-a-dragon/",
    source: "Art for Kids Hub",
    time: "15 min",
    difficulty: "beginner",
    cost: "free",
    action: "Follow the steps, then give it a personality",
  },
];
