/* Creative art resolver — turns the slug fields on a creative item into real,
   bundled image URLs. Lives in the component layer (not src/data/creatives.js)
   because import.meta.glob is a Vite feature: the data module is imported by
   scripts/daily-check.js under plain Node, where glob doesn't exist. Same
   eager-glob + slug-lookup trick the Featured Game card uses (DailyBand.jsx).

   Run `npm run assets:creatives` to (re)generate the .webp files these map to.
   An unmatched slug returns null, and the caller renders a fallback tile — so a
   missing image is never a broken <img>. */

// Flat card/header thumbs: src/assets/creatives/<slug>.webp
const CARD_IMAGES = import.meta.glob("../assets/creatives/*.webp", {
  eager: true,
  import: "default",
});

// Per-guide step sets: src/assets/creatives/steps/<guide-id>/<step-slug>.webp
// The ** is required to reach the nested per-guide folders. Yields {} until the
// folder exists, which is fine — every lookup just falls back.
const STEP_IMAGES = import.meta.glob("../assets/creatives/steps/**/*.webp", {
  eager: true,
  import: "default",
});

// Whole-plate guide images: src/assets/creatives/plates/<slug>.webp (one big
// reference per guide, e.g. a Lutz public-domain plate). Separate glob because
// the flat CARD_IMAGES pattern above doesn't descend into plates/.
const PLATE_IMAGES = import.meta.glob("../assets/creatives/plates/*.webp", {
  eager: true,
  import: "default",
});

// The whole-plate reference image for a plate-style guide, or null.
export function plateArt(slug) {
  if (!slug) return null;
  return PLATE_IMAGES[`../assets/creatives/plates/${slug}.webp`] || null;
}

// Card / header art for an item, in precedence order:
//   bundled `image` slug → its `plate` art (plate guides) → remote `imageUrl`
//   → null (caller draws the tile).
export function creativeArt(item) {
  if (item?.image) {
    const hit = CARD_IMAGES[`../assets/creatives/${item.image}.webp`];
    if (hit) return hit;
  }
  const plate = plateArt(item?.plate);
  if (plate) return plate;
  return item?.imageUrl || null;
}

// One guide step's image: src/assets/creatives/steps/<id>/<slug>.webp, or null.
export function stepArt(id, slug) {
  if (!id || !slug) return null;
  return STEP_IMAGES[`../assets/creatives/steps/${id}/${slug}.webp`] || null;
}
