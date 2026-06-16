/* ============================================================
   GENERATE-CONTENT — build-time AI content generator for the
   daily-fresh homepage. Calls Claude to mass-produce polls,
   quizzes, mascot tips, and site news, validates every item
   against the on-disk schemas, then writes pure-data modules
   under src/data/generated/. NEVER runs in the browser — this
   is a dev/CI tool and @anthropic-ai/sdk stays a devDependency.

   Run:  npm run generate              (needs ANTHROPIC_API_KEY)
         npm run generate:weird        (--only=weird — the 2x/day cron's
                                        cheap mode: refresh ONLY the
                                        "Today's Weird Thing" pool)
         node scripts/generate-content.js --only=curiosities
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, runResearch, buildProofMarkdown } from "./lib/research.js";
import { checkUrls, urlKey } from "./lib/validate-urls.js";
import { archiveAll } from "./lib/firebase-admin.js";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");

// Append a freshly-written pool to the permanent Firestore archive
// (archive/{type}/items/{id}). Soft-fails inside archiveAll, so it never blocks
// the commit. String pools (tips/news/facts) get a deterministic content-hash
// id and are wrapped as { text }; object pools archive by their own `id`.
function archivePool(type, items) {
  const list = (items || []).map((it) =>
    typeof it === "string"
      ? { id: `${type}-${crypto.createHash("sha1").update(it).digest("hex").slice(0, 12)}`, text: it }
      : it
  );
  return archiveAll(type, list).catch(() => {});
}

// --only=weird / --only=curiosities runs just that pool (and skips the rest).
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;

// How big a batch to ask for. One run = a month-plus of date-seeded daily rotation.
const COUNT = { polls: 40, quizzes: 14, tips: 90, news: 50, facts: 60, weird: 14, curiosities: 30, countdowns: 16, buzz: 60, hotornot: 50, onthisday: 40 };

// Facts are hand-curated (see MANUAL_FACTS in src/data/manual/content.js); the home runs
// on those only. Set true to also (re)generate the supplemental generated/facts.js.
const GENERATE_FACTS = false;

// On-This-Day (the 💧 Water Cooler almanac) is hand-curated (ON_THIS_DAY in
// src/data/manual/onthisday.js): "#1 song / box office on a date" is a checkable
// fact, so — like facts — a known-true set beats a drifty one. Flip this to true
// only AFTER accuracy-reviewing the result, to regenerate generated/onthisday.js.
const GENERATE_ONTHISDAY = false;

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

const factsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    facts: { type: "array", items: { type: "string" } },
  },
  required: ["facts"],
};

const weirdSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    weird: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          blurb: { type: "string" },
          url: { type: "string" },
          foundNote: { type: "string" }, // optional flavor; "" if none
        },
        required: ["id", "title", "blurb", "url", "foundNote"],
      },
    },
  },
  required: ["weird"],
};

const curiositiesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    curiosities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          blurb: { type: "string" },
          url: { type: "string" }, // the "go deeper →" source — REQUIRED so every card self-verifies
        },
        required: ["id", "title", "blurb", "url"],
      },
    },
  },
  required: ["curiosities"],
};

// ---- The Water Cooler (/watercooler) schemas ----
const countdownsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    countdowns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" }, // TRL-style header, e.g. "TOP 5 SONGS STUCK IN EVERYONE'S HEAD"
          unit: { type: "string", enum: ["song", "movie", "show"] },
          blurb: { type: "string" }, // optional dek; "" if none
          entries: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                rank: { type: "integer" }, // 1..5
                title: { type: "string" },
                by: { type: "string" }, // artist/studio; "" if n/a
                note: { type: "string" }, // dry one-liner; "" if none
                trend: { type: "string", enum: ["up", "down", "same", "new"] },
              },
              required: ["rank", "title", "by", "note", "trend"],
            },
          },
        },
        required: ["id", "title", "unit", "blurb", "entries"],
      },
    },
  },
  required: ["countdowns"],
};

const buzzSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    buzz: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          text: { type: "string" }, // one tabloid-style line, <= ~160 chars
          tag: { type: "string", enum: ["GOSSIP", "RUMOR", "SIGHTING", "HOT TAKE"] },
        },
        required: ["id", "text", "tag"],
      },
    },
  },
  required: ["buzz"],
};

const hotornotSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    // The model emits ONLY { id, subject, emoji }; the loader hard-codes the
    // [HOT, NOT] options so vote ids stay exactly "hot"/"not".
    subjects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" }, // kebab-case, must start with "hon-"
          subject: { type: "string" }, // the thing being rated, <= ~6 words
          emoji: { type: "string" }, // a single representative emoji
        },
        required: ["id", "subject", "emoji"],
      },
    },
  },
  required: ["subjects"],
};

const onthisdaySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          md: { type: "string" }, // "MM-DD"
          year: { type: "integer" }, // ~1995-2009
          no1Song: {
            type: "object",
            additionalProperties: false,
            properties: { title: { type: "string" }, by: { type: "string" } },
            required: ["title", "by"],
          },
          inTheaters: {
            type: "object",
            additionalProperties: false,
            properties: { title: { type: "string" } },
            required: ["title"],
          },
          onTV: {
            type: "object",
            additionalProperties: false,
            properties: { title: { type: "string" } },
            required: ["title"],
          },
          blurb: { type: "string" }, // dry recap; "" if none
        },
        required: ["id", "md", "year", "no1Song", "inTheaters", "onTV", "blurb"],
      },
    },
  },
  required: ["days"],
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

function validateFacts(facts) {
  req(facts.length >= 8, `facts: expected several, got ${facts.length}`);
  const seen = new Set();
  facts.forEach((f, i) => {
    const norm = f.toLowerCase().replace(/\s+/g, " ").trim();
    req(!!f, `fact[${i}]: empty`);
    req(!seen.has(norm), `fact[${i}]: duplicate or near-duplicate`);
    seen.add(norm);
    req(f.length <= 200, `fact[${i}]: too long (${f.length} chars)`);
  });
}

// ---- weird things + curiosities (URL-bearing pools, liveness-gated) ----

// Manual pools, for dedupe (don't regenerate what's already hand-curated).
// Weird things also dedupe against the stumble pools — the same site showing
// up on the daily card AND in the dice undercuts both.
let MANUAL_WEIRD = [];
let MANUAL_WEIRD_NIGHT = [];
let MANUAL_CURIOSITIES = [];
let MANUAL_COUNTDOWNS = [];
let MANUAL_BUZZ = [];
let MANUAL_HOTORNOT = [];
let FEATURED_URLS = [];
try {
  const manual = await import("../src/data/manual/content.js");
  MANUAL_WEIRD = manual.MANUAL_WEIRD || [];
  MANUAL_WEIRD_NIGHT = manual.MANUAL_WEIRD_NIGHT || [];
  MANUAL_CURIOSITIES = manual.MANUAL_CURIOSITIES || [];
  MANUAL_COUNTDOWNS = manual.MANUAL_COUNTDOWNS || [];
  MANUAL_BUZZ = manual.MANUAL_BUZZ || [];
  MANUAL_HOTORNOT = manual.MANUAL_HOTORNOT || [];
  const generatedStumble = (await import("../src/data/generated/stumble.js")).default || [];
  FEATURED_URLS = [
    ...MANUAL_WEIRD,
    ...MANUAL_WEIRD_NIGHT, // night pool too — a daytime find shouldn't clash with a night one
    ...(manual.MANUAL_ARTIFACTS || []),
    ...(manual.MANUAL_DEEP_CUTS || []),
    ...generatedStumble,
  ]
    .map((a) => a.url)
    .filter(Boolean);
} catch (e) {
  console.warn(`warning: couldn't import manual.js (${e.message}); dedupe skipped.`);
}

// Liveness-check every item's url; returns the survivors and logs the dead.
// This is the gate that lets the cron run unattended: a bad batch shrinks or
// (below the floor) aborts the write, and the previous pool keeps serving.
async function dropDeadUrls(label, items) {
  const results = await checkUrls(items.map((it) => it.url));
  const alive = [];
  for (const it of items) {
    const r = results.get(it.url);
    if (r?.alive) alive.push(it);
    else console.warn(`  ${label}: DROP ${it.id} — ${r?.reason || "no result"} (${it.url})`);
  }
  console.log(`  ${label}: ${alive.length}/${items.length} urls alive`);
  return alive;
}

const WEIRD_RESEARCH_PROMPT = `You MUST use the web_search tool — your training data is stale, so do NOT answer from memory. Run several searches for genuinely weird, delightful corners of the CURRENT internet: strange new websites, quirky single-purpose sites, odd ongoing projects, unusual creator/hobbyist projects, bizarre-but-wholesome things people are sharing right now (tech forums, "weird website" roundups, show-and-tell threads). Long-running living projects count too. NOT news, NOT products, NOT politics.

Then return ONLY a plain bulleted list of ~15 finds. Each bullet MUST include the real name, a one-line gloss, and the URL, like:
- <Name> — <what it is and why it's delightful> — <https://...>

No preamble, no closing remarks — just the bullets.`;

async function generateWeird() {
  console.log("Refreshing the Today's Weird Thing pool…");
  let hooks = "";
  try {
    const r = await runResearch(client, WEIRD_RESEARCH_PROMPT);
    fs.writeFileSync(path.join(OUT_DIR, "_weird.md"), buildProofMarkdown(r));
    if (r.toolError || r.requestCount < 1) {
      console.warn("  research: no live search — generating from stable knowledge only.");
    } else {
      console.log(`  research: ${r.requestCount} live search(es), ${r.results.length} sources → src/data/generated/_weird.md`);
      hooks = r.hooks;
    }
  } catch (e) {
    console.warn(`  research: unavailable (${e.message}); stable knowledge only.`);
  }

  const hookBlock = hooks
    ? `\n\nFRESH FINDS from a live web search just now — prefer these (verbatim URLs) for most of the batch:\n${hooks}`
    : "";
  const data = await generate(
    "weird",
    weirdSchema,
    `Generate ${COUNT.weird} entries for the homepage's "🔍 TODAY'S WEIRD THING" card — proof the site is alive and aware of the current internet. Each entry: a kebab-case id starting with "gw-", a title (a hooky one-liner like "A live map of broken McDonald's ice cream machines"), a 1-2 sentence blurb in the site's dry/warm voice, the REAL working url, and foundNote (a tiny aside like "online since 1995" — or "" if none).

THESE ARE PRESENTED AS REAL — do NOT invent sites. Use only the FRESH FINDS below and things you are certain exist at the exact URL given. Mostly current/living internet; wholesome-weird, never mean. No duplicates, and do NOT reuse these already-featured urls: ${FEATURED_URLS.join(", ")}${hookBlock}`
  );

  let items = (data.weird || []).map((w) => ({
    id: String(w.id || "").trim(),
    title: String(w.title || "").trim(),
    blurb: String(w.blurb || "").trim(),
    url: String(w.url || "").trim(),
    ...(String(w.foundNote || "").trim() ? { foundNote: String(w.foundNote).trim() } : {}),
  }));

  // structural validation
  const seenIds = new Set([...MANUAL_WEIRD, ...MANUAL_WEIRD_NIGHT].map((w) => w.id));
  const seenUrls = new Set(FEATURED_URLS.map(urlKey));
  items = items.filter((w, i) => {
    if (!w.id || !w.title || !w.blurb || !w.url) return req(false, `weird[${i}]: missing fields`), false;
    if (seenIds.has(w.id) || seenUrls.has(urlKey(w.url))) return false; // silent dedupe
    seenIds.add(w.id);
    seenUrls.add(urlKey(w.url));
    return true;
  });

  items = await dropDeadUrls("weird", items);
  req(items.length >= 8, `weird: only ${items.length} alive items (need >=8) — keeping the previous pool`);

  if (errors.length) {
    console.error(`\n✗ validation failed (${errors.length}) — writing nothing:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  writeModule("weird.js", items, 'Today\'s Weird Thing pool. Shape: { id, title, blurb, url, foundNote? } — urls liveness-checked at generation time.');
  await archivePool("weird", items);
  console.log("\n✓ done");
}

async function generateCuriosities() {
  console.log("Generating the Timeless Curiosity pool…");
  const data = await generate(
    "curiosities",
    curiositiesSchema,
    `Generate ${COUNT.curiosities} entries for the homepage's "🌌 TIMELESS CURIOSITY" card — things fascinating regardless of decade: math oddities, history, nature, engineering, physics, language. Each entry: a kebab-case id starting with "gc-", a short title, a 1-2 sentence blurb that lands the wonder (dry, warm, no exclamation-mark hype), and url — the "go deeper" source, which MUST be the canonical English Wikipedia article (or an equally durable page) for that exact topic.

ACCURACY IS THE WHOLE POINT — these are presented as true. Use ONLY widely documented topics you are certain of; when in doubt, leave it out. No duplicates, and do NOT reuse these already-featured topics/urls: ${MANUAL_CURIOSITIES.map((c) => c.url).filter(Boolean).join(", ")}`
  );

  let items = (data.curiosities || []).map((c) => ({
    id: String(c.id || "").trim(),
    title: String(c.title || "").trim(),
    blurb: String(c.blurb || "").trim(),
    url: String(c.url || "").trim(),
  }));

  const seenIds = new Set(MANUAL_CURIOSITIES.map((c) => c.id));
  const seenUrls = new Set(MANUAL_CURIOSITIES.map((c) => urlKey(c.url)));
  items = items.filter((c, i) => {
    if (!c.id || !c.title || !c.blurb || !c.url) return req(false, `curiosity[${i}]: missing fields`), false;
    if (seenIds.has(c.id) || seenUrls.has(urlKey(c.url))) return false;
    seenIds.add(c.id);
    seenUrls.add(urlKey(c.url));
    return true;
  });

  items = await dropDeadUrls("curiosities", items);
  req(items.length >= 20, `curiosities: only ${items.length} alive items (need >=20) — keeping the previous pool`);

  if (errors.length) {
    console.error(`\n✗ validation failed (${errors.length}) — writing nothing:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  writeModule("curiosities.js", items, "Timeless Curiosity pool. Shape: { id, title, blurb, url } — urls liveness-checked at generation time.");
  await archivePool("curiosities", items);
  console.log("\n✓ done");
}

// ---- The Water Cooler (/watercooler) — pop-culture pools ----
// Countdowns + Buzz + Hot-or-Not in one pass (they share the same topical
// research). These are the site's most time-sensitive pools, so the cron runs
// `--only=watercooler` to refresh just them cheaply. They carry NO urls, so
// there's no liveness gate — just structural validation, then write + archive.
async function generateWatercooler() {
  console.log("Generating the Water Cooler pools (countdowns + buzz + hot-or-not)…");
  // --only=watercooler skips main()'s research, so pull hooks here too.
  if (!TOPICAL) TOPICAL = await researchTopics();
  const topical = !!TOPICAL;

  // — The Countdown —
  const countdownsData = await generate(
    "countdowns",
    countdownsSchema,
    `Generate ${COUNT.countdowns} TRL/Billboard-style top-5 countdowns for the 📻 THE COUNTDOWN card on OURCADE's "Water Cooler" pop-culture page. Each is a complete, ordered chart — the ranking is the content. Fields: a kebab-case id starting with "ctd-", a punchy ALL-CAPS title (e.g. "TOP 5 SONGS STUCK IN EVERYONE'S HEAD"), unit ("song" | "movie" | "show"), an optional one-line blurb ("" if none), and EXACTLY 5 entries. Each entry: rank 1-5 (each rank used once), title (the real thing by name), by (artist/studio — "" if n/a), note (a dry one-line quip in the site's 2000s-e-zine voice — "" if none), and trend ("up" | "down" | "same" | "new").
${topical
      ? `Make most countdowns TOPICAL: rank REAL current songs/movies/shows from the TOPICAL HOOKS by name, then add the dry early-2000s twist in the notes. Keep them understandable a few weeks from now; non-defamatory and good-natured. Mix in a couple of evergreen 2000s-nostalgia charts too.`
      : `No current hooks this run — lean on evergreen 2000s-nostalgia and arcade-culture countdowns (name real era-defining songs/movies/shows). Keep it good-natured and non-defamatory.`}
Unique ids. No duplicate chart concepts.`
  );

  // — The Buzz —
  const buzzData = await generate(
    "buzz",
    buzzSchema,
    `Generate ${COUNT.buzz} short water-cooler/tabloid blurbs for the 💬 THE BUZZ card on OURCADE's "Water Cooler" page. Each: a kebab-case id starting with "bz-", text (one punchy line, <= 160 chars, dry 2000s-e-zine humor — gossipy but warm, never mean or defamatory), and tag ("GOSSIP" | "RUMOR" | "SIGHTING" | "HOT TAKE").
${topical
      ? `Make about half TOPICAL: riff on REAL current entertainment from the TOPICAL HOOKS (name the actual show/song/movie/trend), then add the early-2000s framing. The rest can be evergreen celebrity/pop-culture archetypes (reboots, feuds-that-aren't, vinyl/flip-phone revivals). Keep every line understandable weeks later and non-defamatory — no real allegations about real people.`
      : `No current hooks this run — write evergreen pop-culture archetype blurbs (reboots, "not feuding" statements, nostalgia revivals, streaming-becomes-cable). Good-natured, non-defamatory.`}
Unique ids. No duplicates.`
  );

  // — Hot or Not —
  const hotornotData = await generate(
    "hotornot",
    hotornotSchema,
    `Generate ${COUNT.hotornot} "Hot or Not" subjects for the 🔥 card on OURCADE's "Water Cooler" page — the interactive 2000s-web staple where visitors vote HOT or NOT. Each: a kebab-case id starting with "hon-", subject (the thing being rated, <= ~6 words), and emoji (one representative emoji). Do NOT include options — the page hard-codes HOT/NOT.
${topical
      ? `Make about half TOPICAL: rate REAL current trends/things from the TOPICAL HOOKS by name. The rest should be evergreen 2000s-revival debates (low-rise jeans, frosted tips, flip phones, trucker hats, physical media). Keep them light, debatable, and non-defamatory — rate THINGS and TRENDS, not real people's character.`
      : `No current hooks this run — write evergreen 2000s-revival "hot or not" debates (fashion, gadgets, internet habits, snacks). Light and debatable; rate things/trends, not real people.`}
Unique ids. No duplicate subjects.`
  );

  // — normalize + structural validation (no urls → no liveness gate) —
  const countdowns = (countdownsData.countdowns || []).map((c) => ({
    id: String(c.id || "").trim(),
    title: String(c.title || "").trim(),
    unit: String(c.unit || "").trim(),
    ...(String(c.blurb || "").trim() ? { blurb: String(c.blurb).trim() } : {}),
    entries: (c.entries || [])
      .map((e) => ({
        rank: Number(e.rank),
        title: String(e.title || "").trim(),
        ...(String(e.by || "").trim() ? { by: String(e.by).trim() } : {}),
        ...(String(e.note || "").trim() ? { note: String(e.note).trim() } : {}),
        trend: String(e.trend || "").trim(),
      }))
      .sort((a, b) => a.rank - b.rank),
  }));
  const buzz = (buzzData.buzz || []).map((b) => ({
    id: String(b.id || "").trim(),
    text: String(b.text || "").trim(),
    tag: String(b.tag || "").trim(),
  }));
  const hotornot = (hotornotData.subjects || []).map((s) => ({
    id: String(s.id || "").trim(),
    subject: String(s.subject || "").trim(),
    emoji: String(s.emoji || "").trim(),
  }));

  // Countdowns: malformed → recorded error; duplicate id (incl. vs manual) →
  // silently dropped (the model reusing a hand-curated id is expected overlap,
  // not a failure). Must be exactly 5 entries, ranks 1..5, valid trends.
  const TRENDS = new Set(["up", "down", "same", "new"]);
  const cSeen = new Set(MANUAL_COUNTDOWNS.map((c) => c.id));
  const cValid = countdowns.filter((c, i) => {
    const ranks = c.entries.map((e) => e.rank).sort((a, b) => a - b);
    const wellFormed = c.id && c.title && c.entries.length === 5 &&
      ranks.every((r, j) => r === j + 1) &&
      c.entries.every((e) => e.title && TRENDS.has(e.trend));
    if (!wellFormed) { req(false, `countdown[${i}] (${c.id || "?"}): needs id, title, 5 entries (ranks 1..5), valid trends`); return false; }
    if (cSeen.has(c.id)) return false; // silent dedupe
    cSeen.add(c.id);
    return true;
  });
  req(cValid.length >= 8, `countdowns: only ${cValid.length} valid (need >=8) — keeping the previous pool`);

  // Buzz: malformed → error; duplicate id → silently dropped.
  const TAGS = new Set(["GOSSIP", "RUMOR", "SIGHTING", "HOT TAKE"]);
  const bSeen = new Set(MANUAL_BUZZ.map((b) => b.id));
  const bValid = buzz.filter((b, i) => {
    const wellFormed = b.id && b.text && TAGS.has(b.tag) && b.text.length <= 180;
    if (!wellFormed) { req(false, `buzz[${i}] (${b.id || "?"}): needs id, text (<=180), valid tag`); return false; }
    if (bSeen.has(b.id)) return false; // silent dedupe
    bSeen.add(b.id);
    return true;
  });
  req(bValid.length >= 20, `buzz: only ${bValid.length} valid (need >=20) — keeping the previous pool`);

  // Hot-or-Not: malformed → error; duplicate id → silently dropped. Must use the
  // hon- namespace so ids never collide with daily-poll ids in Firestore.
  const hSeen = new Set(MANUAL_HOTORNOT.map((s) => s.id));
  const hValid = hotornot.filter((s, i) => {
    const wellFormed = s.id && s.id.startsWith("hon-") && s.subject && s.emoji;
    if (!wellFormed) { req(false, `hotornot[${i}] (${s.id || "?"}): needs hon-* id, subject, emoji`); return false; }
    if (hSeen.has(s.id)) return false; // silent dedupe
    hSeen.add(s.id);
    return true;
  });
  req(hValid.length >= 20, `hotornot: only ${hValid.length} valid (need >=20) — keeping the previous pool`);

  if (errors.length) {
    console.error(`\n✗ validation failed (${errors.length}) — writing nothing:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  writeModule("countdowns.js", cValid, "The Countdown pool. Shape: { id, title, unit, blurb?, entries:[{rank,title,by?,note?,trend}] }");
  writeModule("buzz.js", bValid, "The Buzz pool. Shape: { id, text, tag }");
  writeModule("hotornot.js", hValid, "Hot-or-Not subjects. Shape: { id, subject, emoji } — loader hard-codes [HOT, NOT].");
  await archivePool("countdowns", cValid);
  await archivePool("buzz", bValid);
  await archivePool("hotornot", hValid);
  console.log("\n✓ done");
}

// On-This-Day generation — GATED OFF (GENERATE_ONTHISDAY) by default because
// "#1 song / box office on a date" is a checkable fact and the hand-verified
// ON_THIS_DAY pool is the source of truth. Run only after accuracy review.
async function generateOnThisDay() {
  console.log("Generating the On-This-Day almanac…");
  let MANUAL_OTD = [];
  try {
    MANUAL_OTD = (await import("../src/data/manual/onthisday.js")).ON_THIS_DAY || [];
  } catch { /* none yet */ }

  // This type DELIBERATELY uses hard calendar dates (the date IS the content),
  // so it overrides the system's "no hard dates" voice rule and ignores the
  // live TOPICAL hooks — these are historical almanac facts, not current events.
  const data = await generate(
    "onthisday",
    onthisdaySchema,
    `Generate ${COUNT.onthisday} "On This Day" almanac entries for OURCADE's "Water Cooler" page. UNLIKE the rest of the site, these are HISTORICAL entries anchored to REAL past dates (roughly 1995-2009) — hard calendar dates are REQUIRED and ARE the content. Do NOT reference anything current. Each entry: a kebab-case id like "otd-MMDD-YYYY", md ("MM-DD"), year (the throwback year), no1Song ({ title, by } — what was #1 on the charts that date), inTheaters ({ title } — what topped/opened at the box office), onTV ({ title } — the show everyone was talking about), and a dry one-line blurb in 2000s-nostalgia voice ("" if none).

ACCURACY IS THE WHOLE POINT — these are presented as true historical facts. Use ONLY well-documented #1 songs, top box-office films, and era-defining TV you are confident are correct for that exact date/year; when unsure, pick a different well-known date. Spread entries across many different calendar months and days. Unique ids and dates.`
  );

  const days = (data.days || []).map((d) => ({
    id: String(d.id || "").trim(),
    md: String(d.md || "").trim(),
    year: Number(d.year),
    no1Song: { title: String(d.no1Song?.title || "").trim(), by: String(d.no1Song?.by || "").trim() },
    inTheaters: { title: String(d.inTheaters?.title || "").trim() },
    onTV: { title: String(d.onTV?.title || "").trim() },
    ...(String(d.blurb || "").trim() ? { blurb: String(d.blurb).trim() } : {}),
  }));

  const MD = /^\d{2}-\d{2}$/;
  const seen = new Set(MANUAL_OTD.map((e) => e.id));
  const valid = days.filter((d, i) => {
    const wellFormed = d.id && MD.test(d.md) && Number.isFinite(d.year) &&
      d.no1Song.title && d.inTheaters.title && d.onTV.title;
    if (!wellFormed) { req(false, `onthisday[${i}] (${d.id || "?"}): needs id, MM-DD, year, and all three slots`); return false; }
    if (seen.has(d.id)) return false; // silent dedupe
    seen.add(d.id);
    return true;
  });
  req(valid.length >= 20, `onthisday: only ${valid.length} valid (need >=20) — keeping the previous pool`);

  if (errors.length) {
    console.error(`\n✗ validation failed (${errors.length}) — writing nothing:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }
  writeModule("onthisday.js", valid, "On-This-Day almanac. Shape: { id, md, year, no1Song:{title,by}, inTheaters:{title}, onTV:{title}, blurb? }");
  await archivePool("onthisday", valid);
  console.log("\n✓ done");
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
  // Cheap targeted modes (the refresh-weird cron uses --only=weird so it never
  // touches — or pays for — the big monthly polls/quizzes/flavor batch).
  if (ONLY === "weird") return generateWeird();
  if (ONLY === "curiosities") return generateCuriosities();
  if (ONLY === "watercooler") return generateWatercooler();
  if (ONLY === "onthisday") return generateOnThisDay();
  if (ONLY) {
    console.error(`Unknown --only=${ONLY} (expected "weird", "curiosities", "watercooler", or "onthisday").`);
    process.exitCode = 1;
    return;
  }

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

  // Facts are hand-curated for now (MANUAL_FACTS in src/data/manual/content.js) and the
  // home uses ONLY those, so we skip the API call by default — real-world facts
  // can't be web-grounded during structured output, and a known-true set beats a
  // drifty one. Flip GENERATE_FACTS to regenerate the supplemental generated/facts.js.
  let facts = [];
  if (GENERATE_FACTS) {
    const factsData = await generate(
      "facts",
      factsSchema,
      `Generate ${COUNT.facts} fun, TRUE one-line trivia facts about real video games — famous titles, franchises, studios, consoles, and arcade history (e.g. "the map of Assassin's Creed Odyssey is bigger than the city of Paris").

ACCURACY IS THE WHOLE POINT — these are presented as real facts, so do NOT invent anything:
- Use ONLY widely-documented, well-known facts you are confident are accurate. When in doubt, leave it out.
- Prefer qualitative or famous, oft-cited details (kill screens, record sales, origin stories, cut characters, naming history) over precise statistics you're unsure of. Avoid shaky exact numbers and made-up dates.
- Each fact stands alone, reads cleanly, <= ~140 chars, no numbering or surrounding quotes.
Keep the OURCADE arcade-nostalgia flavor light — the fact itself must stay accurate, not a joke. Range across eras and genres; no duplicates or near-duplicates.`
    );
    facts = (factsData.facts || []).map((s) => String(s).trim()).filter(Boolean);
    validateFacts(facts);
  }

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
  if (GENERATE_FACTS) writeModule("facts.js", facts, "Daily game facts. Shape: [ string ]");

  // Archive everything just written (permanent "everything ever" store).
  await archivePool("polls", polls);
  await archivePool("quizzes", quizzes);
  await archivePool("tips", tips);
  await archivePool("news", news);
  if (GENERATE_FACTS) await archivePool("facts", facts);

  // The Water Cooler pop-culture pools are part of the monthly run too (they
  // reuse the TOPICAL hooks already fetched above). They run their own
  // validation gate + write, so a Water Cooler failure won't unwind the pools
  // already written above. On-This-Day stays gated (manual is source of truth).
  await generateWatercooler();
  if (GENERATE_ONTHISDAY) await generateOnThisDay();

  console.log("\n✓ done");
}

main().catch((e) => {
  console.error(`\n✗ generation failed: ${e.message}`);
  process.exitCode = 1;
});
