/* ============================================================
   FETCH-DRAW-GUIDES — builds PLATE-ONLY "how to draw" guides from
   PUBLIC-DOMAIN plates and writes them to src/data/generated/.

   Source: E.G. Lutz, "What to Draw and How to Draw It" (1913),
   Project Gutenberg #74518 — pre-1929 US public domain, and the
   book is literally designed as numbered step-by-step plates
   (one image: diagram 1 → 2 → … → finished drawing).

   New, simpler model (no Claude, no vision, no captions):
   THE PLATE IMAGE IS THE GUIDE. The page just shows the big plate
   + a title + a public-domain credit. The numbered steps are drawn
   right on the plate, so there's nothing to caption.

   This script:
     1. fetches the book's HTML and pairs each plate image
        (images/i_0NN.jpg) with its figure caption / alt text,
     2. keeps the ones that read as a single drawable subject
        (skips geometry/oval/compass instructional figures),
     3. downloads + optimizes each plate to
        src/assets/creatives/drawings/plates/<slug>.webp (sharp),
     4. writes a plate-only guide object per plate. Titles come
        from the book caption; the user can correct them by hand
        later in a manual entry — these generated titles are a
        best-effort starting point.

   Soft-fail like fetch-stumble.js: if the HTML won't parse or a
   plate won't download, that item is dropped with a warning; if 0
   survive, NOTHING is written and the committed file keeps serving.
   Provenance → src/data/generated/_draw-guides.md.

   Run:  npm run fetch:draw-guides    (no API key needed)
   Tweak: edit CURATED below to force titles / add or drop subjects.
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "draw-guides.js";
const PROOF_FILE = "_draw-guides.md";
// Draw-lane plates live under the "drawings" lane subfolder (see creativeArt.js
// LANE_DIR: draw → drawings). Output: src/assets/creatives/drawings/plates/<slug>.webp.
const PLATES_DIR = path.join(ROOT, "src", "assets", "creatives", "drawings", "plates");

// Gutenberg #74518 lives here. The HTML lists every plate <img> with a caption;
// plate images are images/i_0NN.jpg under the same epub cache folder.
const GUTENBERG_EPUB = "https://www.gutenberg.org/cache/epub/74518";
const GUTENBERG_IMAGES = `${GUTENBERG_EPUB}/images`;
// Candidate HTML paths (Gutenberg has used a few naming schemes); tried in order.
const HTML_CANDIDATES = [
  `${GUTENBERG_EPUB}/pg74518-images.html`,
  `${GUTENBERG_EPUB}/74518-images.html`,
  `${GUTENBERG_EPUB}/74518-h.htm`,
  "https://www.gutenberg.org/files/74518/74518-h/74518-h.htm",
];
const PLATE_CREDIT =
  "E.G. Lutz, “What to Draw and How to Draw It” (1913) — public domain";
const PLATE_WIDTH = 1000; // viewed large on the guide page

// How many plate-only guides to keep (the lane is meant to be deep now).
const TARGET = 40;

// Curated forced titles + an explicit skip-list, by plate basename. The HTML
// captions in this book are terse and sometimes shared across a spread, so we
// pin the clearest single-subject plates here. Anything in SKIP is an
// instructional/geometry figure (circles, ovals, compasses) — not a drawing to
// copy. Plates not listed here still come through if HTML parsing finds a usable
// caption; this is a quality nudge, not the whole source of truth.
const CURATED = {
  i_016: "How to draw a cat",
  i_017: "How to draw a mouse",
  i_019: "How to draw a fish",
  i_023: "How to draw a rabbit",
  i_026: "How to draw a swan",
  i_027: "How to draw a duck",
  i_030: "How to draw a bulldog",
  i_038: "How to draw an owl",
};
// Plate basenames to never include (front matter, geometry primers, decorative).
const SKIP = new Set(["i_001", "i_002", "i_003", "i_004", "i_005"]);

// Turn a raw plate caption into a friendly "How to draw …" title, or return ""
// to DROP the plate when the caption is too noisy to title cleanly. Best-effort:
// the user refines kept titles by hand. The book's alt text is terse and messy —
// ALL-CAPS, bracket cruft, leaked construction notes ("FIRST DRAW A TRIANGLE…"),
// and multi-figure spreads ("CURIOUS FISHES 1 … 2 …") — so we normalize what we
// can and reject the rest rather than ship garbage.
function titleFromCaption(raw) {
  let s = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/[\[\]{}()]/g, " ") // drop bracket cruft like [Rooster]
    .replace(/^(fig(?:ure)?\.?\s*\d+\.?\s*)/i, "")
    .replace(/[.\s]+$/g, "")
    .trim();
  if (!s) return "";

  // Reject: leaked construction instructions, or a numbered multi-figure spread.
  if (/\bfirst draw|with sides|rhomboid|triangle|oval|circle|compass\b/i.test(s)) return "";
  if (/\b\d\b/.test(s)) return ""; // "Fish 1 … 2 …" style multi-subject plates
  // ALL-CAPS captions → normalize to lowercase so "FISHES" → "fishes".
  if (s === s.toUpperCase()) s = s.toLowerCase();
  // Keep it a short single subject (1–4 words); longer = a multi-thing caption.
  const words = s.split(" ").filter(Boolean);
  if (words.length > 4) return "";

  s = s.toLowerCase().replace(/^how to draw\s+/i, "").trim();
  if (!s) return "";
  return `How to draw ${s}`;
}

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// The file/image slug for a subject: drop the "how to draw" lead-in and any
// leading article so "How to draw a mouse" → "mouse", "An owl" → "owl".
const slugFromTitle = (title) =>
  slugify(
    String(title || "")
      .replace(/^how to draw\s+/i, "")
      .replace(/^(a|an|the)\s+/i, "")
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch() with retries + backoff. Gutenberg throttles bursts (connection resets
// and transient "fetch failed"), so a couple of patient retries turn a flaky run
// into a complete one. Returns the Response, or null after exhausting tries.
async function fetchRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      // 4xx other than 429 won't fix itself — stop early.
      if (res.status !== 429 && res.status < 500) return res;
    } catch {
      /* network blip — fall through to backoff */
    }
    if (i < tries - 1) await sleep(600 * (i + 1)); // 0.6s, 1.2s, 1.8s
  }
  return null;
}

// Fetch the first HTML candidate that returns OK. Returns the HTML string or null.
async function fetchBookHtml() {
  for (const url of HTML_CANDIDATES) {
    const res = await fetchRetry(url);
    if (res?.ok) {
      console.log(`  book HTML: ${url}`);
      return await res.text();
    }
    console.warn(`  (skip ${url} — ${res ? `HTTP ${res.status}` : "unreachable"})`);
  }
  return null;
}

// Parse the book HTML into { plate, caption } pairs for every images/i_0NN.jpg.
// Caption preference: an enclosing <figcaption>, else the img's alt text. Regex
// (not a DOM) on purpose — this runs under plain Node and the markup is simple.
function parsePlates(html) {
  const out = [];
  const seen = new Set();
  // Match each <img ... src="images/i_0NN.jpg" ... alt="..."> plus any text that
  // follows up to a closing </figure> or the next <img (for a figcaption sweep).
  const imgRe =
    /<img\b[^>]*\bsrc=["'][^"']*\/?(i_\d+)\.jpe?g["'][^>]*>([\s\S]*?)(?=<img\b|<\/figure>|<\/div>|$)/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const plate = m[1];
    if (seen.has(plate)) continue;
    seen.add(plate);
    const imgTag = m[0].slice(0, m[0].indexOf(">") + 1);
    const trailing = m[2] || "";
    const altMatch = imgTag.match(/\balt=["']([^"']*)["']/i);
    const capMatch = trailing.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
    const caption = stripTags(capMatch ? capMatch[1] : altMatch ? altMatch[1] : "");
    out.push({ plate, caption });
  }
  return out;
}

const stripTags = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Build the final ordered list of { plate, title } to fetch. Starts from parsed
// HTML pairs, applies SKIP + CURATED overrides, fills titles, drops the
// caption-less / instructional ones, and caps at TARGET. Falls back to CURATED
// alone if HTML parsing produced too little (Gutenberg markup drift).
function buildSubjects(parsed) {
  const subjects = [];
  const used = new Set();
  for (const { plate, caption } of parsed) {
    if (SKIP.has(plate)) continue;
    const forced = CURATED[plate];
    const title = forced || titleFromCaption(caption);
    if (!title) continue; // no caption + not curated → can't title it, skip
    const slug = slugFromTitle(title) || plate;
    if (used.has(slug)) continue;
    used.add(slug);
    subjects.push({ plate, slug, title });
    if (subjects.length >= TARGET) break;
  }
  if (subjects.length >= 2) return subjects;

  // Fallback: just the curated plates (always reachable image basenames).
  console.warn("  HTML yielded too few plates — falling back to the curated list.");
  return Object.entries(CURATED).map(([plate, title]) => ({
    plate,
    slug: slugFromTitle(title) || plate,
    title,
  }));
}

// Download a plate JPEG to a Buffer. Returns null (with a warning) on any failure
// so one bad plate never aborts the batch.
async function downloadPlate(plate) {
  const url = `${GUTENBERG_IMAGES}/${plate}.jpg`;
  const res = await fetchRetry(url);
  if (!res?.ok) {
    console.warn(`  DROP ${plate} — ${res ? `HTTP ${res.status}` : "unreachable"} (${url})`);
    return null;
  }
  try {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) {
      console.warn(`  DROP ${plate} — suspiciously small (${buf.length}B)`);
      return null;
    }
    return buf;
  } catch (e) {
    console.warn(`  DROP ${plate} — read failed: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log("Building plate-only public-domain draw guides (no vision)…\n");
  fs.mkdirSync(PLATES_DIR, { recursive: true });

  const html = await fetchBookHtml();
  const parsed = html ? parsePlates(html) : [];
  console.log(`  parsed ${parsed.length} plate <img> tags from the book HTML`);
  const subjects = buildSubjects(parsed);
  console.log(`  building ${subjects.length} plate-only guides…\n`);

  const guides = [];
  const proof = [];

  for (const { plate, slug, title } of subjects) {
    await sleep(150); // be polite — Gutenberg throttles rapid bursts
    const jpeg = await downloadPlate(plate);
    if (!jpeg) {
      proof.push(`- ${slug} (${plate}): DROPPED — download failed`);
      continue;
    }

    // Write the optimized plate image (committed; the page needs it at build time).
    const outImg = path.join(PLATES_DIR, `${slug}.webp`);
    try {
      await sharp(jpeg).resize({ width: PLATE_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toFile(outImg);
    } catch (e) {
      console.warn(`  DROP ${slug} — image convert failed: ${e.message}`);
      proof.push(`- ${slug} (${plate}): DROPPED — sharp failed`);
      continue;
    }

    guides.push({
      id: `cr-draw-${slug}`,
      lane: "draw",
      guide: true,
      plate: slug,
      plateCredit: PLATE_CREDIT,
      title, // best-effort from the book caption; hand-correct later
      // no blurb — the plate speaks for itself (the card/guide skip it when absent)
      image: slug, // card thumb reuses the plate art (creativeArt falls back to it)
      time: "10 min",
      difficulty: "beginner",
      cost: "free",
      action: "Grab a pencil and copy it line for line",
      // plate-only: no steps, no materials, no tips
    });
    console.log(`  ✓ ${slug} — "${title}" → src/assets/creatives/drawings/plates/${slug}.webp`);
    proof.push(`- ${slug} (${plate}): "${title}"`);
  }

  // Soft-fail: only overwrite the committed file if we actually built something.
  if (!guides.length) {
    console.error("\n✗ no guides survived — writing nothing (previous file kept serving).");
    fs.writeFileSync(path.join(OUT_DIR, PROOF_FILE), proofMarkdown(proof));
    process.exitCode = 1;
    return;
  }

  const banner =
    `// AUTO-GENERATED by scripts/fetch-draw-guides.js — do not edit by hand.\n` +
    `// Plate-only "how to draw" guides from public-domain plates (E.G. Lutz, 1913;\n` +
    `// Project Gutenberg #74518). Each guide is one reference plate at\n` +
    `// src/assets/creatives/drawings/plates/<plate>.webp + a title — no step text.\n` +
    `// Titles are a best-effort starting point; refine them in a manual entry.\n`;
  fs.writeFileSync(
    path.join(OUT_DIR, OUT_FILE),
    `${banner}export default ${JSON.stringify(guides, null, 2)};\n`
  );
  fs.writeFileSync(path.join(OUT_DIR, PROOF_FILE), proofMarkdown(proof));

  console.log(`\n  wrote src/data/generated/${OUT_FILE} (${guides.length} guides)`);
  console.log("\n✓ done — run `npm run check:daily` to audit the combined pool");
}

function proofMarkdown(lines) {
  return (
    `# Draw guides — generation log\n\n` +
    `Source: E.G. Lutz, "What to Draw and How to Draw It" (1913), Project Gutenberg #74518 (public domain).\n\n` +
    `Plate-only model: the plate image is the guide (no captions/vision). Titles are best-effort from the book.\n\n` +
    `Built ${new Date().toISOString()} by scripts/fetch-draw-guides.js.\n\n` +
    lines.join("\n") +
    "\n"
  );
}

main().catch((e) => {
  console.error(`\n✗ build failed: ${e.message}`);
  process.exitCode = 1;
});
