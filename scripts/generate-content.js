/* ============================================================
   GENERATE-CONTENT — build-time AI content generator for the
   daily-fresh homepage. Calls Claude to mass-produce polls,
   quizzes, mascot tips, and site news, validates every item
   against the on-disk schemas, then writes pure-data modules
   under src/data/generated/. NEVER runs in the browser — this
   is a dev/CI tool and @anthropic-ai/sdk stays a devDependency.

   Run:  npm run generate     (needs ANTHROPIC_API_KEY)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, runResearch, buildProofMarkdown } from "./lib/research.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");

// How big a batch to ask for. One run = a month-plus of date-seeded daily rotation.
const COUNT = { polls: 40, quizzes: 14, tips: 90, news: 50 };

loadEnv(ROOT);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "Missing ANTHROPIC_API_KEY — set it in a local .env (see .env.example) or as a CI secret."
  );
  process.exit(1);
}

// Pull the real game registry so quiz results can reference valid gameIds and
// the model can stay on-theme. games.js imports React, but React.lazy never
// invokes its factory at import time, so this loads fine in Node.
let GAME_IDS = null;
let GAME_CONTEXT = "(game list unavailable — keep results generic)";
try {
  const { GAMES } = await import("../src/data/games.js");
  GAME_IDS = new Set(GAMES.map((g) => g.id));
  GAME_CONTEXT = GAMES.map(
    (g) => `- ${g.id} — "${g.title}" [${g.category}; ${(g.tags || []).join(", ")}]: ${g.blurb}`
  ).join("\n");
} catch (e) {
  console.warn(`warning: couldn't import games.js (${e.message}); gameId validation skipped.`);
}

// ---- shared, cacheable system prompt (brand voice + the real game list) ----
const SYSTEM_BASE = `You are the resident content goblin for OURCADE (theourcade.com), a tiny, hand-made browser arcade built to feel like the early-2000s internet — Newgrounds / AddictingGames / school-computer-lab energy. You write short, punchy, funny copy for a homepage that feels fresh every single day.

VOICE
- Nostalgic-millennial, dry and a little chaotic, warm — never mean.
- Faded LAN-party-flyer / "best viewed in 1024x768" energy. Self-aware about being a small weird site.
- PG-13 at most. No slurs, no politics, nothing needing a content warning; keep every reference good-natured and non-defamatory.
- Mix three kinds of content: on-site-game themed, evergreen arcade/gaming/nostalgia, and TOPICAL. For topical items, NAME the actual current thing from the TOPICAL HOOKS (the real movie / song / game / meme by name) so it's unmistakably recognizable, THEN give it the early-2000s / arcade twist (e.g. "if <real thing> dropped in 2003…", rate it on a Y2K / Tamagotchi scale, dial-up framing). Do NOT dissolve the reference into something generic. No hard calendar dates; keep it good-natured and non-defamatory.

THE ARCADE'S GAMES (use these EXACT ids wherever a gameId is required):
${GAME_CONTEXT}

You produce one content type per request and MUST return data that exactly matches the JSON schema you are given. No commentary, just the data.`;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// Filled in once per run by researchTopics(); injected into the cached system
// block so every structured call can riff on the same current hooks.
let TOPICAL = "";

// Pull current hooks via a forced, live web search (see scripts/lib/research.js).
// We VERIFY a search actually fired (web_search_requests) — otherwise the model
// may have answered from stale training data, so we fall back to evergreen only.
// Always writes provenance to src/data/generated/_research.md. Kept separate from
// the structured calls because web-search citations conflict with structured output.
async function researchTopics() {
  try {
    const r = await runResearch(client);
    fs.writeFileSync(path.join(OUT_DIR, "_research.md"), buildProofMarkdown(r));
    if (r.toolError) {
      console.warn(`  research: web search error "${r.toolError}" — evergreen only. (Enable Web Search in the Claude Console.)`);
      return "";
    }
    if (r.requestCount < 1) {
      console.warn("  research: model did NOT actually search (0 requests) — evergreen only.");
      return "";
    }
    console.log(`  research: ${r.requestCount} live search(es), ${r.results.length} sources → src/data/generated/_research.md`);
    return r.hooks;
  } catch (e) {
    console.warn(`  research: web search unavailable (${e.message}); evergreen content only.`);
    return "";
  }
}

// System = stable brand/base block + (optional) this-run topical hooks. The
// cache_control sits on the last block so the 3 structured calls share the cache.
function systemBlocks() {
  const blocks = [{ type: "text", text: SYSTEM_BASE }];
  if (TOPICAL) {
    blocks.push({
      type: "text",
      text:
        "TOPICAL HOOKS (current — riff on SOME content with an early-2000s / nostalgic twist; keep it understandable weeks later and never mean):\n" +
        TOPICAL,
    });
  }
  blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
  return blocks;
}

async function generate(label, schema, userPrompt) {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 48000, // richer quizzes (6-7 blended questions) need more room
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema },
    },
    system: systemBlocks(),
    messages: [{ role: "user", content: userPrompt }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const usage = msg.usage || {};
  console.log(
    `  ${label}: ${usage.output_tokens ?? "?"} out tok` +
      (usage.cache_read_input_tokens ? `, ${usage.cache_read_input_tokens} cached` : "")
  );
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label}: model did not return valid JSON (${e.message})`);
  }
}

// ---- JSON schemas (structured outputs require additionalProperties:false on
//      every object and no dynamic keys, so quiz weights come back as a list
//      and we fold them into a map after validation). ----
const pollsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    polls: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { id: { type: "string" }, label: { type: "string" } },
              required: ["id", "label"],
            },
          },
        },
        required: ["id", "question", "options"],
      },
    },
  },
  required: ["polls"],
};

const quizzesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    quizzes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          intro: { type: "string" },
          topical: { type: "boolean" }, // true = built around a current TOPICAL HOOK
          results: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                emoji: { type: "string" },
                blurb: { type: "string" },
                gameId: { type: "string" },
              },
              required: ["id", "title", "emoji", "blurb", "gameId"],
            },
          },
          questions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                q: { type: "string" },
                answers: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      weights: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            result: { type: "string" },
                            points: { type: "integer" },
                          },
                          required: ["result", "points"],
                        },
                      },
                    },
                    required: ["label", "weights"],
                  },
                },
              },
              required: ["q", "answers"],
            },
          },
        },
        required: ["id", "title", "intro", "topical", "results", "questions"],
      },
    },
  },
  required: ["quizzes"],
};

const flavorSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tips: { type: "array", items: { type: "string" } },
    news: { type: "array", items: { type: "string" } },
  },
  required: ["tips", "news"],
};

// ---- validation gate: collect every problem, write nothing if any exist ----
const errors = [];
const req = (cond, msg) => {
  if (!cond) errors.push(msg);
};

function validatePolls(polls) {
  req(polls.length >= 4, `polls: expected several, got ${polls.length}`);
  const seen = new Set();
  polls.forEach((p, i) => {
    req(p.id && !seen.has(p.id), `poll[${i}]: missing or duplicate id`);
    seen.add(p.id);
    req(!!p.question, `poll ${p.id}: missing question`);
    req(Array.isArray(p.options) && p.options.length >= 2, `poll ${p.id}: needs >=2 options`);
    const opt = new Set();
    (p.options || []).forEach((o, j) => {
      req(o.id && !opt.has(o.id), `poll ${p.id} option[${j}]: missing or duplicate id`);
      opt.add(o.id);
      req(!!o.label, `poll ${p.id} option[${j}]: missing label`);
    });
  });
}

function validateQuizzes(quizzes) {
  req(quizzes.length >= 2, `quizzes: expected several, got ${quizzes.length}`);
  const seen = new Set();
  quizzes.forEach((q, i) => {
    req(q.id && !seen.has(q.id), `quiz[${i}]: missing or duplicate id`);
    seen.add(q.id);
    req(!!q.title, `quiz ${q.id}: missing title`);
    req(typeof q.topical === "boolean", `quiz ${q.id}: "topical" must be a boolean`);
    req(Array.isArray(q.results) && q.results.length >= 2, `quiz ${q.id}: needs >=2 results`);
    const resultIds = new Set((q.results || []).map((r) => r.id));
    (q.results || []).forEach((r) => {
      req(r.id && r.title && r.emoji && r.blurb, `quiz ${q.id} result ${r.id}: missing fields`);
      if (GAME_IDS) {
        req(GAME_IDS.has(r.gameId), `quiz ${q.id} result ${r.id}: gameId "${r.gameId}" not in registry`);
      }
    });
    req(Array.isArray(q.questions) && q.questions.length >= 6, `quiz ${q.id}: needs >=6 questions, got ${(q.questions || []).length}`);
    let blendedAnswers = 0; // answers that feed 2+ results — guards against a flat 1:1 map
    (q.questions || []).forEach((qq, k) => {
      req(!!qq.q, `quiz ${q.id} q[${k}]: missing text`);
      req(Array.isArray(qq.answers) && qq.answers.length >= 3, `quiz ${q.id} q[${k}]: needs >=3 answers`);
      (qq.answers || []).forEach((a, ai) => {
        req(!!a.label, `quiz ${q.id} q[${k}] a[${ai}]: missing label`);
        const weights = Array.isArray(a.weights) ? a.weights : [];
        req(weights.length >= 1, `quiz ${q.id} q[${k}] a[${ai}]: needs >=1 weight`);
        weights.forEach((w) =>
          req(resultIds.has(w.result), `quiz ${q.id} q[${k}] a[${ai}]: weight "${w.result}" is not a result id`)
        );
        // fold [{result,points}] -> {result: points} (the shape scoreQuiz expects)
        a.weights = Object.fromEntries(weights.map((w) => [w.result, w.points]));
        if (Object.keys(a.weights).length >= 2) blendedAnswers += 1;
      });
    });
    req(blendedAnswers >= 3, `quiz ${q.id}: only ${blendedAnswers} blended answers (need >=3 that feed 2+ results so results aren't 1:1 with answers)`);
  });
  // When live research produced hooks, insist the batch actually carries enough
  // trend-linked quizzes so the homepage can always surface a fresh one.
  if (TOPICAL) {
    const topicalCount = quizzes.filter((q) => q.topical === true).length;
    req(topicalCount >= 4, `quizzes: only ${topicalCount} topical (need >=4 built around current hooks)`);
  }
}

function writeModule(file, value, note) {
  const banner =
    `// AUTO-GENERATED by scripts/generate-content.js — do not edit by hand.\n` +
    `// ${note}\n`;
  fs.writeFileSync(path.join(OUT_DIR, file), `${banner}export default ${JSON.stringify(value, null, 2)};\n`);
  const n = Array.isArray(value) ? `${value.length} items` : `${value.tips.length} tips, ${value.news.length} news`;
  console.log(`  wrote src/data/generated/${file} (${n})`);
}

async function main() {
  console.log("Generating OURCADE daily content with Claude…");
  TOPICAL = await researchTopics();

  const pollTopical = TOPICAL
    ? " About 40% of them MUST be topical: build the question around a NAMED hook from the TOPICAL HOOKS (the real movie/song/game/meme, by name) with the nostalgic twist. Keep the rest evergreen and on-site-game themed."
    : "";
  const quizTopical = TOPICAL
    ? ' Make 5-6 of the quizzes topical — each built around NAMED hooks from the TOPICAL HOOKS (e.g. "Which <real 2026 thing> are you, dial-up edition?"), naming real current things in the title and results — and keep the rest evergreen or game-archetype. Topical quizzes still set each result\'s gameId to the best-fitting on-site game. Set "topical": true on every quiz built around a current hook and "topical": false on the evergreen/game-archetype ones.'
    : ' Set "topical": false on every quiz (no current hooks are available this run).';
  const newsTopical = TOPICAL
    ? ' Several news blurbs should NAME real current things from the TOPICAL HOOKS, reported in 2003-webmaster voice (e.g. "NEW: <real thing> arrives — we gave it 4 quarters").'
    : "";

  const pollsData = await generate(
    "polls",
    pollsSchema,
    `Generate ${COUNT.polls} daily polls. Each poll: a short fun question (<= 8 words) and 3-4 punchy options (<= 4 words each, an emoji is welcome). Range across gaming habits, arcade nostalgia, snacks, controls, and hot takes. Unique kebab-case ids for polls and options. No duplicates or near-duplicates.${pollTopical}`
  );
  const quizzesData = await generate(
    "quizzes",
    quizzesSchema,
    `Generate ${COUNT.quizzes} "Which X are you?"-style personality quizzes. Each quiz: a unique kebab-case id, a catchy title, a one-line intro, 4-6 results, and 6-7 questions. Each result: kebab-case id, title, a single emoji, a ~2-sentence blurb, and gameId set to the on-theme game id that best fits that result.

Each question has 3-4 answers; each answer's weights is a list of {result, points} pointing only at THIS quiz's own result ids. The whole point is that the result should NOT be predictable from any single question. So:
- BLEND most answers across 2-3 results (a primary plus one or two secondaries) instead of a clean one-answer-equals-one-result map. A pure 1:1 mapping makes the outcome obvious — avoid it.
- VARY the points across 1-3 (a strong, defining answer is worth 3; a subtle lean is worth 1) rather than a flat value.
- Make at least 2 of the questions OBLIQUE — indirect prompts like "pick a snack / a color / a song / a childhood toy / a weekend plan / a ringtone" where the player can't tell which result an answer feeds. The other questions can be more on-the-nose.
Make every result reachable, and make sure two different answer paths could plausibly land on the same result. Vary themes (which game / arcade archetype / snack / internet era / etc.).${quizTopical}`
  );
  const flavorData = await generate(
    "flavor",
    flavorSchema,
    `Generate ${COUNT.tips} one-line mascot tips and ${COUNT.news} one-line "site news" blurbs. Tips: dumb-but-charming advice from the arcade mascot (a little pixel gremlin). News: breezy fake site updates in the spirit of a 2003 webmaster (e.g. "NEW CABINET: ...", "RUMOR: ...", "MAINTENANCE: ..."). Each line stands alone, <= ~120 chars, no numbering or quotes.${newsTopical}`
  );

  const polls = pollsData.polls || [];
  const quizzes = quizzesData.quizzes || [];
  const tips = (flavorData.tips || []).map((s) => String(s).trim()).filter(Boolean);
  const news = (flavorData.news || []).map((s) => String(s).trim()).filter(Boolean);

  validatePolls(polls);
  validateQuizzes(quizzes);
  req(tips.length >= 1, "flavor: no tips returned");
  req(news.length >= 1, "flavor: no news returned");

  if (errors.length) {
    console.error(`\n✗ validation failed (${errors.length}) — writing nothing:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed. Writing data modules:");
  writeModule("polls.js", polls, "Daily polls. Shape: { id, question, options:[{id,label}] }");
  writeModule(
    "quizzes.js",
    quizzes,
    "Quizzes. Shape: { id, title, intro, topical, questions:[{q,answers:[{label,weights}]}], results:[{id,title,emoji,blurb,gameId}] }"
  );
  writeModule("flavor.js", { tips, news }, "Mascot tips + site news. Shape: { tips:[], news:[] }");
  console.log("\n✓ done");
}

main().catch((e) => {
  console.error(`\n✗ generation failed: ${e.message}`);
  process.exitCode = 1;
});
