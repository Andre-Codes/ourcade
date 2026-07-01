/* ─────────────────────────────────────────────────────────────────────────
   MANUAL CREATIVES CONFIG  ·  edit this file by hand
   (part of the hand-edit hub in src/data/manual/ — see README.md there)

   The /creatives page ("things creative people can do today"). Unlike a feed,
   every item gives the visitor a NEXT MOVE — print this, draw this, make this.
   This file is the sole source for now (no AI generator yet), and is NEVER
   overwritten by `npm run generate`, so your entries persist forever.

   Item shape:
     id:         unique kebab-case string (prefix "cr-")
     lane:       "draw"   (extensible later: build/remix/study)
     title:      short headline
     blurb:      one line on why it's worth doing ("why it's cool")
     time:       free text, e.g. "10 min", "1-3 hours", "a weekend".
                 Bucketed for the time filter — see timeBucketOf() in
                 ../creatives.js. Keep wording loose; the bucket is derived.
     difficulty: "beginner" | "intermediate" | "advanced"
     action:     the explicit next move, imperative ("Grab a pencil and copy it")

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
  {
    id: "cr-draw-cute-alien",
    lane: "draw",
    guide: true,
    plate: "cute-alien",
    title: "How to draw a cute alien",
    blurb:
      "Eight easy steps turn two simple shapes into a wide-eyed little alien with antennae. A friendly first character to draw.",
    image: "cute-alien",
    time: "15 min",
    difficulty: "beginner",
    action: "Grab a pencil and follow the eight steps",
  },
  {
    id: "cr-draw-kangaroo-running",
    lane: "draw",
    guide: true,
    plate: "kangaroo-running",
    title: "How to draw a running kangaroo",
    blurb:
      "Six steps build a kangaroo mid-bound — capturing the leaping pose and motion lines is the fun challenge here.",
    image: "kangaroo-running",
    time: "15 min",
    difficulty: "intermediate",
    action: "Grab a pencil and follow the six steps",
  },
  {
    id: "cr-draw-fantasy-wizard-beginner",
    lane: "draw",
    guide: true,
    plate: "fantasy-wizard-beginner",
    title: "How to draw a cute wizard",
    blurb:
      "A friendly nine-step wizard built from simple shapes — pointy hat, big beard, and a staff. The easy way into the fantasy wizard.",
    image: "fantasy-wizard-beginner",
    time: "20 min",
    difficulty: "beginner",
    action: "Grab a pencil and follow the nine steps",
  },
  {
    id: "cr-draw-fantasy-wizard",
    lane: "draw",
    guide: true,
    plate: "fantasy-wizard",
    title: "How to draw a fantasy wizard",
    blurb:
      "Nine steps build a robed, staff-wielding wizard from guidelines up — with a finished color reference and proportion notes. A real character study.",
    image: "fantasy-wizard",
    time: "1-2 hours",
    difficulty: "advanced",
    action: "Grab a pencil and work through the nine steps",
  },
  {
    id: "cr-draw-cute-baby-bunny",
    lane: "draw",
    guide: true,
    plate: "cute-baby-bunny",
    title: "How to draw a cute baby bunny",
    blurb:
      "Ten gentle steps grow an oval into a fuzzy, big-eared bunny. A perfect first character to draw.",
    image: "cute-baby-bunny",
    time: "15 min",
    difficulty: "beginner",
    action: "Grab a pencil and follow the ten steps",
  },
  {
    id: "cr-draw-chibi-dragon",
    lane: "draw",
    guide: true,
    plate: "chibi-dragon",
    title: "How to draw a chibi dragon",
    blurb:
      "Eight friendly steps take a plain egg shape all the way to a winged little dragon. Copy it panel by panel.",
    image: "chibi-dragon",
    time: "15 min",
    difficulty: "intermediate",
    action: "Grab a pencil and follow the eight steps",
  },
  {
    id: "cr-draw-baby-dragon",
    lane: "draw",
    guide: true,
    plate: "baby-dragon",
    title: "How to draw a baby dragon",
    blurb:
      "Eight steps grow two simple circles into a chubby, sitting baby dragon — horns, little wings, and a spiky tail. A cozy beginner draw.",
    image: "baby-dragon",
    time: "15 min",
    difficulty: "beginner",
    action: "Grab a pencil and follow the eight steps",
  },
  {
    id: "cr-draw-business-woman",
    lane: "draw",
    guide: true,
    plate: "business-woman-advanced",
    title: "How to draw a business woman",
    blurb:
      "Ten steps build a full standing figure — from a simple stick-figure armature through the suit, hair, and details to a finished, colored character.",
    image: "business-woman-advanced",
    time: "30 min",
    difficulty: "advanced",
    action: "Grab a pencil and work through the ten steps",
  },
  {
    id: "cr-draw-jackolantern",
    lane: "draw",
    guide: true,
    plate: "jackolantern-intermediate",
    title: "How to draw a jack-o'-lantern",
    blurb:
      "Ten steps carve a plain circle into a glowing jack-o'-lantern — segments, a curly stem, a toothy face, then grooves and shading. Spooky-cozy.",
    image: "jackolantern-intermediate",
    time: "20 min",
    difficulty: "intermediate",
    action: "Grab a pencil and follow the ten steps",
  },
  {
    id: "cr-draw-police-dog-beginner",
    lane: "draw",
    guide: true,
    plate: "police-dog-beginner",
    title: "How to draw a police dog",
    blurb:
      "Six friendly steps turn simple shapes into a sitting puppy in a police uniform — hat, badge, and belt included. A fun beginner character.",
    image: "police-dog-beginner",
    time: "15 min",
    difficulty: "beginner",
    action: "Grab a pencil and follow the six steps",
  },
  {
    id: "cr-draw-police-dog",
    lane: "draw",
    guide: true,
    plate: "police-dog-intermediate",
    title: "How to draw a police officer dog",
    blurb:
      "Ten steps build a cartoon police-officer puppy from a stick-figure armature through the uniform and badge to a finished, colored character.",
    image: "police-dog-intermediate",
    time: "25 min",
    difficulty: "intermediate",
    action: "Grab a pencil and work through the ten steps",
  },
  {
    id: "cr-draw-santa",
    lane: "draw",
    guide: true,
    plate: "santa-beginner",
    title: "How to draw Santa Claus",
    blurb:
      "Six steps stack two simple shapes into a chubby cartoon Santa — hat, big beard, coat trim, and belt. A cozy beginner holiday draw.",
    image: "santa-beginner",
    time: "15 min",
    difficulty: "beginner",
    action: "Grab a pencil and follow the six steps",
  },

  // ── DRAW — the lane is plate-only by default now: ~40 public-domain drawing
  //    plates come from scripts/fetch-draw-guides.js (src/data/generated). Add
  //    your OWN draw items here when you want — a plate-only guide (just an image
  //    + title; see template above) or a full per-step guide. Nothing required
  //    here; leave it empty and the generated plates carry the lane.

  // ── SOLVE — hand-authored "complete the pattern" puzzles. The generated pool
  //    (scripts/gen-solve-puzzles.js) makes classic sequences; author INVENTED
  //    ones here. Shape: puzzle.kind "pattern" with sequence[] (terms shown),
  //    answer (next term), and an optional rule (revealed with the answer).
  {
    id: "cr-solve-pattern-invented-001",
    lane: "solve",
    guide: true,
    title: "Complete the Pattern — Invented #1",
    blurb: "A made-up sequence with its own quirky rule. Spot the trick, then type what comes next.",
    time: "2 min",
    difficulty: "intermediate",
    cost: "free",
    action: "Work out the rule, then type what comes next",
    puzzle: {
      kind: "pattern",
      prompt: "Complete the pattern — what comes next?",
      // Rule: double the previous term, then subtract its position (1-indexed).
      // 2 → 2·2-2=2? Authored explicitly so the invented rule is unambiguous:
      sequence: ["3", "5", "9", "17", "33"],
      answer: "65",
      hint: "Each step roughly doubles — but not exactly. Look at the gaps: 2, 4, 8, 16…",
      rule: "Double the gap each time: +2, +4, +8, +16, then +32 → 65.",
    },
  },
];

// Minimal safety net (one per lane) if MANUAL_CREATIVES is ever emptied, so the
// page never renders blank. Same idea as FALLBACK in ../curiosities.js.
export const FALLBACK_CREATIVES = [
  {
    // Plate-only guide pointing at a public-domain plate the fetcher writes
    // (src/assets/creatives/drawings/plates/cat.webp). If that image isn't built
    // yet, the page still renders the title + credit (never blank).
    id: "fallback-draw-cat",
    lane: "draw",
    guide: true,
    plate: "cat",
    plateCredit: "E.G. Lutz, “What to Draw and How to Draw It” (1913) ",
    title: "How to draw a cat",
    image: "cat",
    time: "10 min",
    difficulty: "beginner",
    action: "Grab a pencil and copy it line for line",
  },
];
