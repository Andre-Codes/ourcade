/* ============================================================
   RESEARCH-TOPICS — proof/inspection tool. Runs ONLY the live
   web search the content generator uses, then prints and saves
   the evidence: the exact queries Claude ran, the source URLs +
   their page_age dates, and the billed search count. Use it to
   confirm the topical hooks are real-time, not recalled.
   Run:  npm run research   →   src/data/generated/_research.md
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, runResearch, buildProofMarkdown } from "./lib/research.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(ROOT);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY — set it in .env (see .env.example).");
  process.exit(1);
}

const r = await runResearch(new Anthropic());
const md = buildProofMarkdown(r);
fs.writeFileSync(path.join(ROOT, "src", "data", "generated", "_research.md"), md);
console.log(md);
console.log("Saved to src/data/generated/_research.md");

if (r.toolError) {
  console.error(
    `\n✗ Web search error: ${r.toolError}. Enable Web Search in the Claude Console for your org, then re-run.`
  );
  process.exitCode = 1;
} else if (r.requestCount < 1) {
  console.error(
    "\n✗ NOT real-time: 0 searches were executed — the model answered from memory."
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n✓ Real-time confirmed: ${r.requestCount} live web search(es), ${r.results.length} sources with dates above.`
  );
}
