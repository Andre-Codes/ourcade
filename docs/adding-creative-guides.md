# Adding a Creative (esp. a drawing guide with step images)

**Audience: the agent.** The user will hand you images + a title (and maybe captions). This is the procedure for turning that into a live entry on `/creatives`. Do the whole thing for them — they only provide raw material.

> The user's standing deal: *"I'll provide the image(s), the title, and some captions if needed. You do the rest."* So you author the data, place + optimize the art, run the checks, and report back. Don't make them touch code or run commands.

---

## What the user provides

- **Image(s).** Either:
  - **Per-step images** — one image per step (`step 1.png`, `step 2.png`, …). This is the main case. The user may give them as files in the chat, a folder path, or attachments.
  - **One whole-plate image** — a single image that already shows all the numbered steps. (Less common for user-supplied; this is how the generated Lutz guides work.)
- **A title** — e.g. "Draw a wizard cat". You derive the `id`, lane, and slugs from it.
- **(Optional) captions** — one line per step. If the user doesn't give captions, **you write them** by looking at each image (you have vision — open the image and describe what to add at that step, in the house voice). If you write them, say so and let the user correct.
- **(Optional) a card thumbnail** — if not given, reuse step 1 (or the plate) as the card image, or let it fall back to the lane tile.

If the user gives you images but the **title or captions are ambiguous**, ask one quick clarifying question — don't guess a title that ends up in a URL.

---

## What you (the agent) do

### 0. Decide the identifiers

- `id`: `cr-draw-<slug>` (kebab-case from the title, e.g. "Draw a wizard cat" → `cr-draw-wizard-cat`). Must be unique in the pool — grep `src/data/manual/creatives.js` and `src/data/generated/draw-guides.js` for collisions.
- `lane`: usually `"draw"`. (Other lanes: `print`, `build`, `remix`, `study`.)
- step slugs: `step-1`, `step-2`, … (or any plain slug; just keep them consistent between the data and the filenames).

### 1. Place the source images (under the LANE subfolder)

Art is organized **by lane** so drawings, prints, builds, etc. don't pile into one
directory. Everything for a lane lives under `assets-src/creatives/<lane>/`, where
`<lane>` is the asset-folder name for the item's `lane` field:

| item `lane` | asset folder |
|---|---|
| `draw` | `drawings` |
| `print` | `prints` |
| `build` | `builds` |
| `remix` | `remixes` |
| `study` | `study` |

(The mapping is `LANE_DIR` in `src/components/creativeArt.js` — add a row there if you add a lane.)

Copy/move the user's images in with **exact names** (the names are load-bearing — they become the slugs). Accepted formats: `.png .jpg .jpeg .webp`.

**Per-step drawing guide** — under the `drawings` folder: steps go in `steps/<id>/`
(folder name **must equal the item `id`**), file basenames **must equal each step's `image`**:
```
assets-src/creatives/drawings/<slug>.png             ← card thumbnail (basename = item's `image`)
assets-src/creatives/drawings/steps/<id>/step-1.png  ← per-step images
assets-src/creatives/drawings/steps/<id>/step-2.png
assets-src/creatives/drawings/steps/<id>/step-3.png
```
Example for `id: "cr-draw-wizard-cat"`, `image: "wizard-cat"`:
```
assets-src/creatives/drawings/wizard-cat.png
assets-src/creatives/drawings/steps/cr-draw-wizard-cat/step-1.png
assets-src/creatives/drawings/steps/cr-draw-wizard-cat/step-2.png
…
```

**Whole-plate guide** — one image under the lane's `plates/`, basename = the `plate` slug:
```
assets-src/creatives/drawings/plates/<plate>.png
```

**Other lanes** (e.g. a 3D-print card thumbnail) — just the card art under that lane:
```
assets-src/creatives/prints/<slug>.png
```

> If the user's filenames are messy ("IMG_4821.jpg", "step one.png"), **rename on copy** to the clean slug form above. The slug in the data must match the file basename exactly (no spaces, no extension, no path). The `lane` field on the data item is what tells the app which subfolder to look in — the slugs themselves stay bare.

### 2. Optimize the images

```bash
npm run assets:creatives
```
This walks each lane folder and converts `assets-src/creatives/<lane>/**` → `src/assets/creatives/<lane>/**.webp` (card art 640px; step & plate images 1000px). Confirm it logs the files you expect. The `src/assets/creatives/...webp` outputs are committed; the app loads those via `import.meta.glob` (see `src/components/creativeArt.js`).

### 3. Add the entry to `src/data/manual/creatives.js`

Append to the `MANUAL_CREATIVES` array. **Per-step drawing guide** template:

```js
{
  id: "cr-draw-wizard-cat",
  lane: "draw",
  guide: true,                       // → on-site page at /creatives/<id>
  title: "Draw a wizard cat",
  blurb: "<one inviting line — why it's a fun little draw>",
  image: "wizard-cat",               // card thumbnail slug (the .webp you made)
  time: "10 min",                    // free text; bucketed for the time filter
  difficulty: "beginner",            // beginner | intermediate | advanced
  cost: "free",                      // free | paid
  action: "Sketch it, then remix it",
  materials: ["A pencil", "Paper"],  // optional
  steps: [
    { image: "step-1", caption: "<what to add at step 1>" },
    { image: "step-2", caption: "<what to add at step 2>" },
    { image: "step-3", caption: "<…>" },
  ],
  tips: ["<optional pointer>", "<optional pointer>"],  // optional
}
```

**Whole-plate guide** (one image, text-only steps — no `step.image`):
```js
{
  id: "cr-draw-snail", lane: "draw", guide: true,
  plate: "snail",
  plateCredit: "<author / source — license note>",
  title: "How to draw a snail",
  blurb: "<…>", image: "snail",
  time: "10 min", difficulty: "beginner", cost: "free",
  action: "Follow the steps, then give it a personality",
  materials: ["A pencil", "Paper"],
  steps: [
    { caption: "Draw a spiral for the shell." },     // ← NO image field
    { caption: "Add the body curving out underneath." },
  ],
  tips: ["<…>"],
}
```

**External link item** (NOT a guide — e.g. a 3D-print STL): omit `guide`/`steps`, set `url` + `source` instead. Thumbnail via `image` (bundled) or `imageUrl` (remote).

### 4. Field rules (or `check:daily` fails)

- `id` unique; it's also the steps folder name.
- A guide needs `guide: true` **and** non-empty `steps`, and **every step needs a `caption`**.
- An item is **either** a guide (has `steps`) **or** external (has `url` + `source`). Guides need no `url`.
- `image`, `plate`, and `step.image` are **plain slugs** — no `/`, no `.`, no extension.
- `imageUrl` (if used) must be `http(s)`.
- Plain strings only — no markdown/HTML in captions, blurb, tips.

### 5. Verify

```bash
npm run check:daily   # validates the new item (steps+captions, slugs, uniqueness)
npm run build         # confirms the step/card .webp images bundle and chunks compile
```
Optionally `npm run dev` and open `/creatives/<id>` to eyeball the rendered guide; the card appears on `/creatives`.

### 6. Handle missing pieces gracefully

- **Captions missing** → write them from the images (vision), in the warm/dry house voice; tell the user you wrote them.
- **A step image missing** → the page shows a lane-emoji fallback tile for that step (not a broken image), so you can ship the data and add the image later. But prefer to chase down all images first.
- **No card thumbnail** → reuse `step-1` (point `image` at it) or the plate; or omit `image` and accept the fallback tile.

---

## Quick reference

| Concept | Where |
|---|---|
| Hand-edited content | `src/data/manual/creatives.js` → `MANUAL_CREATIVES` (never auto-overwritten) |
| Generated Lutz guides | `src/data/generated/draw-guides.js` (do NOT hand-edit; `npm run fetch:draw-guides` rewrites it) |
| Source art (you place) | `assets-src/creatives/<lane>/<slug>.png`, `…/<lane>/steps/<id>/<step>.png`, `…/<lane>/plates/<plate>.png` (lane = `drawings`/`prints`/`builds`/…) |
| Optimized art (committed) | `src/assets/creatives/<lane>/**.webp` ← `npm run assets:creatives` |
| Lane → folder map | `LANE_DIR` in `src/components/creativeArt.js` |
| Image resolver | `src/components/creativeArt.js` (`creativeArt`, `stepArt`, `plateArt`) |
| Guide page renderer | `src/components/CreativeGuidePage.jsx` (branches on `item.plate`) |
| Card / grid | `src/components/CreativesPage.jsx` |
| Validation | `npm run check:daily` (asserts live in `scripts/daily-check.js`) |

See also the field-by-field header comment at the top of `src/data/manual/creatives.js`.
