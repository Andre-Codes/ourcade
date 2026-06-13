/* ============================================================
   FETCH-STUMBLE — grows the 🎲 Stumble artifact pool. Two passes
   (same split as generate-content.js, and for the same reason —
   web-search citations conflict with structured output):

   1. STABLE: one structured call for knowledge-stable artifacts
      (famous-but-obscure Wikipedia pages, real patents, internet
      mysteries, long-lived weird sites) — nostalgic + timeless.
   2. CURRENT: a forced live web search for what's delightful on
      the internet RIGHT NOW, then a structured call that turns
      those finds into era:"current" artifacts.

   Every URL is liveness-checked (scripts/lib/validate-urls.js);
   dead ones are dropped, and if too few survive NOTHING is
   written — the previous pool keeps serving. Provenance goes to
   src/data/generated/_stumble.md.

   Run:  npm run fetch:stumble    (needs ANTHROPIC_API_KEY)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, runResearch, buildProofMarkdown } from "./lib/research.js";
import { checkUrls, urlKey } from "./lib/validate-urls.js";
import { archiveAll } from "./lib/firebase-admin.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");
const OUT_FILE = "stumble.js";

const COUNT = { stable: 26, current: 14 };
const KINDS = ["wiki", "site", "patent", "game", "video", "image", "mystery"]; // no "flash" — the adapter owns that
const ERAS = ["nostalgic", "current", "timeless"];

loadEnv(ROOT);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY — set it in a local .env or as a CI secret.");
  process.exit(1);
}

const client = new Anthropic();

// Everything already featured anywhere, for dedupe — the manual pools (deep
// cuts included) AND the generated weird-thing batch: the same site showing up
// on the daily card and in the dice undercuts both.
let KNOWN_IDS = new Set();
let KNOWN_URLS = new Set(); // urlKey()-normalized
try {
  const manual = await import("../src/data/manual.js");
  const generatedWeird = (await import("../src/data/generated/weird.js")).default || [];
  for (const a of [
    ...(manual.MANUAL_ARTIFACTS || []),
    ...(manual.MANUAL_DEEP_CUTS || []),
    ...(manual.MANUAL_WEIRD || []),
    ...generatedWeird,
  ]) {
    if (a.id) KNOWN_IDS.add(a.id);
    if (a.url) KNOWN_URLS.add(urlKey(a.url));
  }
} catch (e) {
  console.warn(`warning: couldn't import manual.js (${e.message}); dedupe limited.`);
}

const SYSTEM = `You curate artifacts for OURCADE's "🎲 Stumble Upon Something" — a modern StumbleUpon for things people would never think to search for: forgotten corners of the web, weird patents, internet mysteries, obscure-but-true wiki rabbit holes. Voice: dry, warm, nostalgic-millennial, never mean, PG-13. Every artifact is presented as REAL — never invent a site, page, patent, or URL. When unsure something exists at an exact URL, leave it out. You MUST return data exactly matching the JSON schema given. No commentary.`;

const artifactsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    artifacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: KINDS },
          era: { type: "string", enum: ERAS },
          title: { type: "string" },
          blurb: { type: "string" },
          year: { type: "string" }, // "" when not meaningful
          url: { type: "string" },
        },
        required: ["id", "kind", "era", "title", "blurb", "year", "url"],
      },
    },
  },
  required: ["artifacts"],
};

async function generate(label, userPrompt) {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: artifactsSchema } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  console.log(`  ${label}: ${msg.usage?.output_tokens ?? "?"} out tok`);
  try {
    return JSON.parse(text).artifacts || [];
  } catch (e) {
    throw new Error(`${label}: model did not return valid JSON (${e.message})`);
  }
}

const STUMBLE_RESEARCH_PROMPT = `You MUST use the web_search tool — your training data is stale, so do NOT answer from memory. Run several searches for delightful internet artifacts being made or discovered RIGHT NOW: strange new websites, remarkable indie web projects, newly-noticed old sites that are somehow still online, odd archives, weird single-purpose pages, fascinating creator projects. NOT news, NOT products, NOT politics.

Then return ONLY a plain bulleted list of ~15 finds. Each bullet MUST include the real name, a one-line gloss, and the URL, like:
- <Name> — <what it is and why it's worth stumbling into> — <https://...>

No preamble, no closing remarks — just the bullets.`;

const dontReuse = `Do NOT reuse any of these already-featured urls: ${[...KNOWN_URLS].slice(0, 120).join(", ")}`;

async function main() {
  console.log("Harvesting Stumble artifacts with Claude…");

  // ── pass 1: knowledge-stable (no search needed; accuracy by famous-ness) ──
  const stable = await generate(
    "stable artifacts",
    `Generate ${COUNT.stable} stumble artifacts from STABLE knowledge — each one famous enough (in its niche) that you are certain it's real and documented at the URL you give:
- "wiki": genuinely strange but well-documented Wikipedia rabbit holes (unusual articles, odd history, weird science). url = the canonical English Wikipedia article.
- "patent": real, oft-cited absurd patents. url = the patents.google.com page (e.g. https://patents.google.com/patent/US.../en).
- "mystery": documented unsolved internet/broadcast/historical mysteries with a Wikipedia article. url = that article.
- "site": legendary long-lived websites that are still online at the same address.
- "game": landmark weird/cult games with a Wikipedia article.

Mix eras: roughly half "timeless", half "nostalgic" (a few may be "current" if truly evergreen-ongoing). kebab-case ids prefixed "g:" (e.g. "g:wiki-boring-nevada"). year = the relevant year as a string, or "". Blurbs: 1-2 sentences that make someone NEED to click. ${dontReuse}`
  );

  // ── pass 2: current finds via forced live search ──
  let current = [];
  try {
    const r = await runResearch(client, STUMBLE_RESEARCH_PROMPT);
    fs.writeFileSync(path.join(OUT_DIR, "_stumble.md"), buildProofMarkdown(r));
    if (r.toolError || r.requestCount < 1) {
      console.warn("  research: no live search — skipping the current-era pass.");
    } else {
      console.log(`  research: ${r.requestCount} live search(es), ${r.results.length} sources → src/data/generated/_stumble.md`);
      current = await generate(
        "current artifacts",
        `Turn the FRESH FINDS below (from a live web search just now) into up to ${COUNT.current} stumble artifacts with era "current" and kind "site" (or "game"/"video"/"image" where truly apt). Use the find's verbatim URL. kebab-case ids prefixed "g:". year = "" unless known. Skip anything that looks like news, a product pitch, or that you can't pin to a concrete URL. ${dontReuse}

FRESH FINDS:
${r.hooks}`
      );
    }
  } catch (e) {
    console.warn(`  research: unavailable (${e.message}); skipping the current-era pass.`);
  }

  // ── merge + validate + liveness-gate ──
  const errors = [];
  const seenIds = new Set(KNOWN_IDS);
  const seenUrls = new Set(KNOWN_URLS);
  let items = [...stable, ...current]
    .map((a) => ({
      id: String(a.id || "").trim(),
      kind: String(a.kind || "").trim(),
      era: String(a.era || "").trim(),
      title: String(a.title || "").trim(),
      blurb: String(a.blurb || "").trim(),
      ...(String(a.year || "").trim() ? { year: String(a.year).trim() } : {}),
      url: String(a.url || "").trim(),
    }))
    .filter((a, i) => {
      if (!a.id || !a.title || !a.blurb || !a.url || !KINDS.includes(a.kind) || !ERAS.includes(a.era)) {
        errors.push(`artifact[${i}] (${a.id || "?"}): missing/invalid fields`);
        return false;
      }
      if (seenIds.has(a.id) || seenUrls.has(urlKey(a.url))) return false; // silent dedupe
      seenIds.add(a.id);
      seenUrls.add(urlKey(a.url));
      return true;
    });

  const results = await checkUrls(items.map((a) => a.url));
  const alive = items.filter((a) => {
    const r = results.get(a.url);
    if (r?.alive) return true;
    console.warn(`  DROP ${a.id} — ${r?.reason || "no result"} (${a.url})`);
    return false;
  });
  console.log(`  ${alive.length}/${items.length} urls alive`);

  const eraCounts = {};
  for (const a of alive) eraCounts[a.era] = (eraCounts[a.era] || 0) + 1;
  if (alive.length < 15) errors.push(`only ${alive.length} alive artifacts (need >=15)`);
  if (errors.length) {
    console.error(`\n✗ validation failed (${errors.length}) — writing nothing:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  const banner =
    `// AUTO-GENERATED by scripts/fetch-stumble.js — do not edit by hand.\n` +
    `// Stumble artifacts. Shape: { id, kind, era, title, blurb, year?, url } — no embeds\n` +
    `// (only the flash adapter embeds); urls liveness-checked at generation time.\n`;
  fs.writeFileSync(
    path.join(OUT_DIR, OUT_FILE),
    `${banner}export default ${JSON.stringify(alive, null, 2)};\n`
  );
  console.log(
    `  wrote src/data/generated/${OUT_FILE} (${alive.length} artifacts — ` +
      Object.entries(eraCounts).map(([e, n]) => `${e}:${n}`).join(" ") +
      `)`
  );
  // Archive each surviving artifact to the permanent store (soft-fails).
  await archiveAll("stumble", alive).catch(() => {});

  console.log("\n✓ done — run `node scripts/daily-check.js` to audit the combined pool");
}

main().catch((e) => {
  console.error(`\n✗ harvest failed: ${e.message}`);
  process.exitCode = 1;
});
