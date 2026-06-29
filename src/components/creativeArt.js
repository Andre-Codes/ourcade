/* Creative art resolver — turns the slug fields on a creative item into real,
   bundled image URLs, ORGANIZED BY LANE. Lives in the component layer (not
   src/data/creatives.js) because import.meta.glob is a Vite feature: the data
   module is imported by scripts/daily-check.js under plain Node, where glob
   doesn't exist. Same eager-glob + slug-lookup trick the Featured Game card uses
   (DailyBand.jsx).

   Layout (see scripts/process-creatives.js):
     src/assets/creatives/<lane>/<slug>.webp                  ← card/header thumb
     src/assets/creatives/<lane>/steps/<guide-id>/<step>.webp ← per-step image
     src/assets/creatives/<lane>/plates/<plate>.webp          ← whole-plate image
   The data item's `lane` selects the subfolder; the resolvers below take the
   lane and map it via LANE_DIR. An unmatched slug returns null, and the caller
   renders a fallback tile — so a missing image is never a broken <img>.

   Run `npm run assets:creatives` to (re)generate these .webp files. */

// Lane → asset subfolder. Add a lane here when you add one to the data.
const LANE_DIR = {
  draw: "drawings",
  solve: "solve",
  build: "builds",
  remix: "remixes",
  study: "study",
};

function laneDir(lane) {
  return LANE_DIR[lane] || lane || "misc";
}

// One eager glob over the whole creatives asset tree; we key into it by the
// lane-scoped path the helpers below build. (A single recursive glob keeps this
// future-proof as lanes are added — no per-lane glob to maintain.)
const IMAGES = import.meta.glob("../assets/creatives/**/*.webp", {
  eager: true,
  import: "default",
});

const at = (path) => IMAGES[`../assets/creatives/${path}.webp`] || null;

// Card / header art for an item, in precedence order:
//   bundled `image` slug → its `plate` art (plate guides) → per-kind solve art
//   → remote `imageUrl` → null (caller draws the tile). Lane-scoped.
export function creativeArt(item) {
  const dir = laneDir(item?.lane);
  if (item?.image) {
    const hit = at(`${dir}/${item.image}`);
    if (hit) return hit;
  }
  const plate = plateArt(item?.lane, item?.plate);
  if (plate) return plate;
  // "Solve this" puzzles carry no per-card art; they share ONE image per puzzle
  // kind (src/assets/creatives/solve/<kind>.webp). This keeps the cards visual
  // without touching the auto-generated solve data (survives `npm run gen:solve`).
  const kind = item?.puzzle?.kind;
  if (item?.lane === "solve" && kind) {
    const byKind = at(`solve/${kind}`);
    if (byKind) return byKind;
  }
  return item?.imageUrl || null;
}

// One guide step's image: src/assets/creatives/<lane>/steps/<id>/<slug>.webp.
export function stepArt(lane, id, slug) {
  if (!id || !slug) return null;
  return at(`${laneDir(lane)}/steps/${id}/${slug}`);
}

// The whole-plate reference image for a plate-style guide.
export function plateArt(lane, slug) {
  if (!slug) return null;
  return at(`${laneDir(lane)}/plates/${slug}`);
}
