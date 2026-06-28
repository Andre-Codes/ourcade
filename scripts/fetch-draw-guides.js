/* ============================================================
   FETCH-DRAW-GUIDES — builds on-site "how to draw" guides from
   PUBLIC-DOMAIN plates and writes them to src/data/generated/.

   Source: E.G. Lutz, "What to Draw and How to Draw It" (1913),
   Project Gutenberg #74518 — pre-1929 US public domain, and the
   book is literally designed as numbered step-by-step plates
   (one image: diagram 1 → 2 → … → finished drawing).

   Per subject this script:
     1. downloads the plate JPEG from Gutenberg over plain HTTPS,
     2. optimizes it to src/assets/creatives/plates/<slug>.webp (sharp),
     3. shows the plate to Claude (VISION) and asks it to read the
        numbered diagrams and write the blurb + materials + per-step
        captions + tips in the house voice — Claude does NOT invent
        the art, only describes the real public-domain steps,
     4. assembles a "whole-plate" guide object (the page shows the
        plate once + a numbered caption list).

   Soft-fail like fetch-stumble.js: if a plate won't download or a
   guide is malformed, it's dropped with a warning; if 0 survive,
   NOTHING is written and the committed file keeps serving.
   Provenance → src/data/generated/_draw-guides.md.

   Run:  npm run fetch:draw-guides    (needs ANTHROPIC_API_KEY)
   Reusable: edit SUBJECTS below and re-run for more subjects.
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "./lib/research.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "draw-guides.js";
const PROOF_FILE = "_draw-guides.md";
const PLATES_DIR = path.join(ROOT, "src", "assets", "creatives", "plates");

// Gutenberg #74518 plate images live here (verified reachable). `plate` is the
// image basename in the book, e.g. i_016 → .../images/i_016.jpg.
const GUTENBERG_BASE = "https://www.gutenberg.org/cache/epub/74518/images";
const PLATE_CREDIT =
  "E.G. Lutz, “What to Draw and How to Draw It” (1913) — public domain";
const PLATE_WIDTH = 1000; // viewed large on the guide page

// Curated quick beginner subjects, each a confirmed numbered-step plate.
// slug = our id/file slug; plate = the Gutenberg image basename.
const SUBJECTS = [
  { slug: "cat", plate: "i_016", subject: "a cat" },
  { slug: "mouse", plate: "i_017", subject: "a mouse" },
  { slug: "fish", plate: "i_019", subject: "a fish" },
  { slug: "rabbit", plate: "i_023", subject: "a rabbit" },
  { slug: "swan", plate: "i_026", subject: "a swan" },
  { slug: "duck", plate: "i_027", subject: "a duck" },
  { slug: "bulldog", plate: "i_030", subject: "a bulldog" },
  { slug: "owl", plate: "i_038", subject: "an owl" },
];

loadEnv(ROOT);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY — set it in a local .env or as a CI secret.");
  process.exit(1);
}

const client = new Anthropic();

const SYSTEM = `You write tiny, low-stakes "how to draw" guides for OURCADE — a cozy retro arcade site. Voice: warm, dry, encouraging, never precious; the whole point is "grab a pencil and make a little guy." You are shown a single PUBLIC-DOMAIN drawing plate that already contains the numbered steps (diagram 1, 2, 3 … ending in the finished drawing). Your job is ONLY to read what those numbered diagrams actually show and put it into words. NEVER invent a step the plate doesn't show, and never claim a different number of steps than the plate has. Count the numbered diagrams; write exactly one caption per numbered step, in order, each a single friendly sentence describing what to add or do at that step. You MUST return data matching the given JSON schema. No commentary.`;

const guideSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    blurb: { type: "string" }, // one inviting line on why this is a fun quick draw
    materials: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { caption: { type: "string" } },
        required: ["caption"],
      },
    },
    tips: { type: "array", items: { type: "string" } },
  },
  required: ["blurb", "materials", "steps", "tips"],
};

// Download a plate JPEG to a Buffer. Returns null (with a warning) on any failure
// so one bad plate never aborts the batch.
async function downloadPlate(plate) {
  const url = `${GUTENBERG_BASE}/${plate}.jpg`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  DROP ${plate} — HTTP ${res.status} (${url})`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) {
      console.warn(`  DROP ${plate} — suspiciously small (${buf.length}B)`);
      return null;
    }
    return buf;
  } catch (e) {
    console.warn(`  DROP ${plate} — download failed: ${e.message}`);
    return null;
  }
}

// Ask Claude (vision) to read the plate's numbered steps and write the copy.
async function describePlate(jpeg, subject) {
  const base64 = jpeg.toString("base64"); // no newlines — toString never wraps
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: guideSchema } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          {
            type: "text",
            text: `This public-domain plate shows how to draw ${subject} in numbered steps. Read the numbered diagrams (1, 2, 3 …) and return: a one-sentence inviting blurb; a short materials list (usually just a pencil and paper); one caption per numbered step, in order, describing what to add at that step; and 1–3 short tips. Describe ONLY the steps actually drawn on the plate.`,
          },
        ],
      },
    ],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  console.log(`  ${subject}: ${msg.usage?.output_tokens ?? "?"} out tok`);
  return JSON.parse(text);
}

function cleanStrings(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean);
}

async function main() {
  console.log("Building public-domain draw guides with Claude (vision)…\n");
  fs.mkdirSync(PLATES_DIR, { recursive: true });

  const guides = [];
  const proof = [];

  for (const { slug, plate, subject } of SUBJECTS) {
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

    // Ask Claude to read the plate and write the copy.
    let data;
    try {
      data = await describePlate(jpeg, subject);
    } catch (e) {
      console.warn(`  DROP ${slug} — model/JSON failed: ${e.message}`);
      proof.push(`- ${slug} (${plate}): DROPPED — ${e.message}`);
      continue;
    }

    const steps = (Array.isArray(data.steps) ? data.steps : [])
      .map((s) => ({ caption: String(s?.caption || "").trim() }))
      .filter((s) => s.caption);
    const blurb = String(data.blurb || "").trim();
    const materials = cleanStrings(data.materials);
    const tips = cleanStrings(data.tips);

    if (!blurb || steps.length < 2) {
      console.warn(`  DROP ${slug} — too little content (blurb? ${!!blurb}, steps ${steps.length})`);
      proof.push(`- ${slug} (${plate}): DROPPED — thin content`);
      continue;
    }

    guides.push({
      id: `cr-draw-${slug}`,
      lane: "draw",
      guide: true,
      plate: slug,
      plateCredit: PLATE_CREDIT,
      title: `How to draw ${subject}`, // subject already includes the article ("a cat", "an owl")
      blurb,
      image: slug, // card thumb reuses the plate art (creativeArt falls back to it)
      time: "10 min",
      difficulty: "beginner",
      cost: "free",
      action: "Follow the steps, then give it a personality",
      materials: materials.length ? materials : ["A pencil", "Paper"],
      steps,
      tips,
    });
    console.log(`  ✓ ${slug} — ${steps.length} steps → src/assets/creatives/plates/${slug}.webp`);
    proof.push(`- ${slug} (${plate}): ${steps.length} steps, ${tips.length} tips`);
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
    `// On-site "how to draw" guides from public-domain plates (E.G. Lutz, 1913;\n` +
    `// Project Gutenberg #74518). "Whole-plate" shape: one reference image at\n` +
    `// src/assets/creatives/plates/<plate>.webp + a numbered text-step list.\n`;
  fs.writeFileSync(
    path.join(OUT_DIR, OUT_FILE),
    `${banner}export default ${JSON.stringify(guides, null, 2)};\n`
  );
  fs.writeFileSync(path.join(OUT_DIR, PROOF_FILE), proofMarkdown(proof));

  console.log(`\n  wrote src/data/generated/${OUT_FILE} (${guides.length} guides)`);
  console.log("\n✓ done — run `node scripts/daily-check.js` to audit the combined pool");
}

function proofMarkdown(lines) {
  return (
    `# Draw guides — generation log\n\n` +
    `Source: E.G. Lutz, "What to Draw and How to Draw It" (1913), Project Gutenberg #74518 (public domain).\n\n` +
    `Built ${new Date().toISOString()} by scripts/fetch-draw-guides.js.\n\n` +
    lines.join("\n") +
    "\n"
  );
}

main().catch((e) => {
  console.error(`\n✗ build failed: ${e.message}`);
  process.exitCode = 1;
});
