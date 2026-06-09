/* ============================================================
   RESEARCH — shared web-search helper used by both the content
   generator and the standalone proof tool. Forces a live web
   search for current pop culture and surfaces the evidence
   (queries, source URLs + dates, and the billed search count)
   so we can PROVE the topical hooks are real-time, not recalled
   from the model's stale training data.
   ============================================================ */

import fs from "node:fs";
import path from "node:path";

// Minimal .env loader (no dependency); only fills vars not already set.
export function loadEnv(root) {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = /^(".*"|'.*')$/.test(m[2]) ? m[2].slice(1, -1) : m[2];
    }
  }
}

const RESEARCH_PROMPT = `You MUST use the web_search tool — your training data is stale, so do NOT answer from memory. Run several searches for what is genuinely popular and being talked about RIGHT NOW: new/upcoming movies & TV, music (albums, songs, artists), video games, viral internet memes and moments, and notable pop-culture news. Prefer things from the last few weeks or months.

Then return ONLY a plain bulleted list of ~15 hooks we can riff on for a nostalgic arcade site. Each bullet MUST name the actual thing and add a short gloss, like:
- <Real Title / Name> — <one line on why it's buzzing>

No preamble, no closing remarks — just the bullets.`;

// Runs the live search. Basic web_search_20250305 (no code-execution dependency,
// maximally compatible). Best-effort: returns whatever it gathered plus the
// proof fields; callers decide how to react to requestCount === 0 / toolError.
export async function runResearch(client) {
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
    messages: [{ role: "user", content: RESEARCH_PROMPT }],
  });

  const queries = [];
  const results = [];
  let toolError = null;

  for (const b of res.content) {
    if (b.type === "server_tool_use" && b.name === "web_search" && b.input?.query) {
      queries.push(b.input.query);
    }
    if (b.type === "web_search_tool_result") {
      const c = b.content;
      if (c && c.type === "web_search_tool_result_error") {
        toolError = c.error_code;
      } else if (Array.isArray(c)) {
        for (const r of c) {
          if (r.type === "web_search_result") {
            results.push({ url: r.url, title: r.title, page_age: r.page_age || null });
          }
        }
      }
    }
  }

  const hooks = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const requestCount = res.usage?.server_tool_use?.web_search_requests ?? 0;

  return { hooks, queries, results, requestCount, toolError };
}

// Human-readable provenance, written to src/data/generated/_research.md.
export function buildProofMarkdown({ hooks, queries, results, requestCount, toolError }) {
  const sources = results.length
    ? results.map((r) => `- [${r.page_age || "date ?"}] ${r.title}\n  ${r.url}`).join("\n")
    : "(none returned)";
  return (
    `# OURCADE — live topical research (real-time web search)\n` +
    `# Generated ${new Date().toISOString()}\n` +
    `# web_search_requests = ${requestCount}${toolError ? `  (TOOL ERROR: ${toolError})` : ""}\n\n` +
    `## Search queries Claude actually ran\n` +
    `${queries.length ? queries.map((q) => `- ${q}`).join("\n") : "(none — the model did NOT search)"}\n\n` +
    `## Sources returned ([page_age] title / url)\n${sources}\n\n` +
    `## Hooks derived from the above\n${hooks || "(none)"}\n`
  );
}
