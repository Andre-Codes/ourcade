/* ============================================================
   FETCH-FLASH — build-time puller for the Flash Theater. Two tiers:

   1. BULK POOL (stumble) — pages archive.org's scrape API for the
      whole `softwarelibrary_flash` animation collection (thousands)
      and auto-filters by metadata. No per-item validation here.
   2. FEATURED (daily pick) — names a few dozen recognizable classics
      (via Claude if ANTHROPIC_API_KEY is set, else a built-in list),
      resolves each to an archive.org identifier, and confirms it is
      Ruffle-playable. Those get featured:true so the daily highlight
      is always a known hit.

   Writes src/data/generated/animations.js + _flash.md. NEVER runs in
   the browser — dev/CI tool; @anthropic-ai/sdk stays a devDependency.

   Run:  npm run fetch:flash    (ANTHROPIC_API_KEY optional)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/research.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");

// Only animations in the Flash software library, skipping restricted items.
const POOL_QUERY =
  "collection:(softwarelibrary_flash) AND mediatype:(software) AND subject:(animation) AND NOT access-restricted-item:true";

// Floors for the validation gate — write nothing if we fall short.
const MIN_POOL = 50;
const MIN_FEATURED = 8;
const MAX_CANDIDATES = 4; // identifiers to try per classic before giving up

loadEnv(ROOT);

// ---- archive.org helpers (native fetch; Node 18+) --------------------------
const UA = { "User-Agent": "ourcade-flash-fetch/1.0 (+https://theourcade.com)" };

async function fetchJson(url, label) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} for ${url}`);
  return res.json();
}

// archive.org fields can come back as a string OR an array — flatten to text.
const oneLine = (v) => (Array.isArray(v) ? v.join(", ") : v ? String(v) : "");

// Page the scrape API (cursor-based, no deep-paging cap) for the whole pool.
async function scrapePool(q) {
  const out = [];
  let cursor = null;
  do {
    const u = new URL("https://archive.org/services/search/v1/scrape");
    u.searchParams.set("q", q);
    u.searchParams.set("fields", "identifier,title,creator,year");
    u.searchParams.set("count", "10000");
    if (cursor) u.searchParams.set("cursor", cursor);
    const data = await fetchJson(u.toString(), "scrape");
    if (Array.isArray(data.items)) out.push(...data.items);
    cursor = data.cursor || null;
    process.stdout.write(`\r  bulk pull: ${out.length} items…`);
  } while (cursor);
  process.stdout.write("\n");
  return out;
}

// Normalize + dedupe scrape rows into our shape.
function toPool(items) {
  const byId = new Map();
  for (const it of items) {
    const id = it.identifier;
    const title = oneLine(it.title).trim();
    if (!id || !title) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      title,
      creator: oneLine(it.creator).trim(),
      year: it.year ? String(it.year) : "",
    });
  }
  return [...byId.values()];
}

// Is this identifier a Ruffle-playable Flash item? (cheap single metadata call)
async function isPlayable(id) {
  try {
    const data = await fetchJson(`https://archive.org/metadata/${id}`, "metadata");
    const m = data.metadata || {};
    return m.mediatype === "software" && m.emulator === "ruffle-swf";
  } catch {
    return false;
  }
}

// Resolve a classic by name → the first Ruffle-playable identifier we find.
async function resolveClassic({ title, creator }) {
  const terms = [`title:(${JSON.stringify(title)})`];
  if (creator) terms.push(`creator:(${JSON.stringify(creator)})`);
  const q = `collection:(softwarelibrary_flash) AND (${terms.join(" OR ")})`;
  const u = new URL("https://archive.org/advancedsearch.php");
  u.searchParams.set("q", q);
  for (const f of ["identifier", "title", "creator", "year"]) u.searchParams.append("fl[]", f);
  u.searchParams.set("rows", String(MAX_CANDIDATES));
  u.searchParams.set("output", "json");
  let docs = [];
  try {
    const data = await fetchJson(u.toString(), "search");
    docs = data?.response?.docs || [];
  } catch {
    return null;
  }
  for (const d of docs) {
    if (d.identifier && (await isPlayable(d.identifier))) {
      return {
        id: d.identifier,
        title: oneLine(d.title).trim() || title,
        creator: oneLine(d.creator).trim() || creator,
        year: d.year ? String(d.year) : "",
      };
    }
  }
  return null;
}

// ---- the classics list: Claude when available, else a curated fallback -----
const FALLBACK_CLASSICS = [
  { title: "The End of the World", creator: "Jason Windsor" },
  { title: "Badger Badger Badger", creator: "Weebl" },
  { title: "Salad Fingers", creator: "David Firth" },
  { title: "Magical Trevor", creator: "Weebl" },
  { title: "Numa Numa", creator: "Gary Brolsma" },
  { title: "Charlie the Unicorn", creator: "Jason Steele" },
  { title: "The Llama Song", creator: "Albino Black Sheep" },
  { title: "All Your Base Are Belong To Us", creator: "Bad CRC" },
  { title: "Animator vs Animation", creator: "Alan Becker" },
  { title: "Llama Whatever", creator: "" },
  { title: "Banana Phone", creator: "" },
  { title: "Frog in a Blender", creator: "Joe Cartoon" },
  { title: "Peanut Butter Jelly Time", creator: "" },
  { title: "Homestar Runner", creator: "" },
  { title: "Weebl and Bob", creator: "Weebl" },
  { title: "Kenya", creator: "" },
  { title: "Hyakugojyuuichi", creator: "" },
  { title: "Daft Hands", creator: "" },
  { title: "Xiao Xiao", creator: "" },
  { title: "Tarboy", creator: "" },
];

const picksSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, creator: { type: "string" } },
        required: ["title", "creator"],
      },
    },
  },
  required: ["picks"],
};

// Famous classics are firmly in the model's knowledge (all pre-2010), so this
// uses structured output WITHOUT web search — avoiding the citation/structured-
// output conflict noted in generate-content.js. Falls back if anything goes wrong.
async function getClassics() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("  (no ANTHROPIC_API_KEY — using the built-in classics list)");
    return FALLBACK_CLASSICS;
  }
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: picksSchema } },
      system:
        "You are a Flash-era internet historian. Name the most FAMOUS, recognizable, SFW Flash animations of the late-1990s–2000s (Newgrounds / Albino Blacksheep / early YouTube era) — the cultural touchstones people still quote.",
      messages: [
        {
          role: "user",
          content:
            "List ~60 classic Flash ANIMATIONS (not games). For each give the title and the best-known creator/studio (empty string if unsure). No NSFW. No duplicates.",
        },
      ],
    });
    const msg = await stream.finalMessage();
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const picks = JSON.parse(text).picks || [];
    console.log(`  Claude named ${picks.length} classics.`);
    return picks.length ? picks : FALLBACK_CLASSICS;
  } catch (e) {
    console.warn(`  classics via Claude failed (${e.message}); using built-in list.`);
    return FALLBACK_CLASSICS;
  }
}

// ---- output -----------------------------------------------------------------
// Two modules so the homepage ships only the small featured subset (eager) and
// lazy-loads the multi-thousand-item pool on demand (see src/data/animations.js).
function writeModule(file, list, note) {
  const banner =
    `// AUTO-GENERATED by scripts/fetch-flash.js — do not edit by hand.\n` +
    `// ${note}\n`;
  const body = list.map((a) => "  " + JSON.stringify(a)).join(",\n");
  fs.writeFileSync(path.join(OUT_DIR, file), `${banner}export default [\n${body}\n];\n`);
}

function writeProof({ rawCount, poolCount, featured, unresolved }) {
  const md =
    `# OURCADE — Flash Theater pull (archive.org)\n` +
    `# Generated ${new Date().toISOString()}\n\n` +
    `Bulk query: \`${POOL_QUERY}\`\n\n` +
    `- raw scrape items: ${rawCount}\n` +
    `- pool after filter/dedupe: ${poolCount}\n` +
    `- featured classics resolved: ${featured.length}\n` +
    `- classics that did NOT resolve: ${unresolved.length}\n\n` +
    `## Featured (daily-pick) classics\n` +
    (featured.map((a) => `- ${a.title} — ${a.creator || "?"} (${a.year || "?"}) → ${a.id}`).join("\n") || "(none)") +
    `\n\n## Unresolved classics (no playable archive.org match)\n` +
    (unresolved.map((c) => `- ${c.title}${c.creator ? ` — ${c.creator}` : ""}`).join("\n") || "(none)") +
    `\n`;
  fs.writeFileSync(path.join(OUT_DIR, "_flash.md"), md);
}

async function main() {
  console.log("Fetching OURCADE Flash Theater pool from archive.org…");

  // 1) bulk pool
  const raw = await scrapePool(POOL_QUERY);
  const pool = toPool(raw);
  console.log(`  pool: ${pool.length} animations (from ${raw.length} raw)`);

  // 2) featured classics
  console.log("Resolving featured classics…");
  const classics = await getClassics();
  const byId = new Map(pool.map((a) => [a.id, a]));
  const featured = [];
  const unresolved = [];
  const seenFeatured = new Set();
  for (const c of classics) {
    const hit = await resolveClassic(c);
    if (!hit || seenFeatured.has(hit.id)) {
      if (!hit) unresolved.push(c);
      continue;
    }
    seenFeatured.add(hit.id);
    const existing = byId.get(hit.id);
    if (existing) {
      existing.featured = true; // tag in place; keep the scrape metadata
    } else {
      byId.set(hit.id, { ...hit, featured: true }); // classic outside subject:animation
    }
    featured.push({ ...(byId.get(hit.id)) });
    process.stdout.write(`\r  featured: ${featured.length} resolved…`);
  }
  process.stdout.write("\n");

  const finalPool = [...byId.values()];

  // 3) validation gate — write nothing if we fell short
  const errors = [];
  if (finalPool.length < MIN_POOL) errors.push(`pool too small: ${finalPool.length} < ${MIN_POOL}`);
  if (featured.length < MIN_FEATURED) errors.push(`too few featured: ${featured.length} < ${MIN_FEATURED}`);
  const ids = new Set();
  for (const a of finalPool) {
    if (ids.has(a.id)) errors.push(`duplicate id: ${a.id}`);
    ids.add(a.id);
  }
  if (errors.length) {
    console.error(`\n✗ validation failed (${errors.length}) — writing nothing:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  writeModule("animations.js", finalPool, "Full Flash pool (stumble). Shape: { id, title, creator, year, featured }");
  writeModule("flash-featured.js", finalPool.filter((a) => a.featured), "Featured classics (daily pick). Shape: { id, title, creator, year, featured }");
  writeProof({ rawCount: raw.length, poolCount: finalPool.length, featured, unresolved });
  console.log(
    `\n✓ wrote src/data/generated/animations.js (${finalPool.length}) + flash-featured.js (${featured.length}) + _flash.md`
  );
}

main().catch((e) => {
  console.error(`\n✗ fetch-flash failed: ${e.message}`);
  process.exitCode = 1;
});
