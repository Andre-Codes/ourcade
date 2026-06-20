/* ============================================================
   GENERATE-BADGER — build-time generator for Byte Badger's reply
   script tree (the brain behind the phone's built-in contact).
   Calls Claude once to author a rich, in-character branching
   tree, validates it, and writes src/data/generated/badger.js.

   NEVER runs in the browser — Ourcade is a static site, so the
   runtime (src/lib/badger.js) only PICKS over this pre-baked
   tree; @anthropic-ai/sdk stays a devDependency.

   This is a MANUAL, one-time-ish tool: Byte Badger's persona is
   evergreen, so we don't want CI re-rolling it and drifting the
   mascot. Run it, eyeball the output, commit it.

   Run:  npm run generate:badger        (needs ANTHROPIC_API_KEY)
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "./lib/research.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");

loadEnv(ROOT);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "Missing ANTHROPIC_API_KEY — set it in a local .env (see .env.example) or as a CI secret."
  );
  process.exit(1);
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// The intents the runtime engine matches on. The generator must produce ALL of
// these ids (and may add more); each needs keywords + several replies. The
// secret passphrase itself is NOT generated (it lives in src/lib/badger.js so
// it can't drift) — the model only writes the cryptic NUDGE intent and the
// reward/already-earned lines.
const REQUIRED_INTENTS = [
  "greeting", "who", "games", "relics", "help",
  "compliment", "insult", "smalltalk", "bye", "jenny",
];

const SYSTEM = `You are writing the complete dialogue script for BYTE BADGER, the resident keeper-mascot of OURCADE (theourcade.com) — a tiny, hand-made browser arcade built to feel like the early-2000s internet (Newgrounds / AddictingGames / school-computer-lab energy). Byte Badger "lives" inside the site's retro Nokia-style phone as a contact you can text, and replies like a real (if slightly unhinged) texting buddy.

WHO BYTE BADGER IS
- A badger made of bytes. Gruff-but-warm night-watchman of the arcade; been here since it was one game and a guestbook.
- Dry, chaotic, nostalgic, self-aware about being a small weird site. Warm — NEVER mean. PG-13 at most. No slurs, no politics, nothing needing a content warning.
- Knows the arcade's games (Snake and Space Impact are ON the phone itself). Knows there are hidden RELICS to collect around the site. Drops cryptic hints, never spelling secrets out.
- Lore touchstones he can riff on: dial-up, CRT glow, guestbooks, webrings, "best viewed in 1024x768", the Jenny easter egg (dialing 867-5309 plays a song), sticky arcade carpet.

WRITING RULES
- Every reply is a single SMS-length line (<= ~160 chars), no line breaks, no quotes around it, no numbering.
- Within an intent, the replies must be DISTINCT from each other and varied in rhythm — the runtime picks among them for variety.
- Stay in character every line. It should feel like one consistent personality.

You return ONLY data matching the given JSON schema. No commentary.`;

const PROMPT = `Write Byte Badger's full reply script tree. Be GENEROUS and detailed — this is the whole brain, so give each bucket plenty of varied, in-character lines.

Produce:
- greeting: 5+ opening lines (used when someone first texts Badger).
- intents: one object per topic below, each with { id, keywords (5-10 lowercase trigger words/phrases a user might text), replies (4+ distinct in-character lines) }. REQUIRED ids, exactly these: ${REQUIRED_INTENTS.join(", ")}.
    • greeting — hi/hey/yo etc.
    • who — who/what are you, your name, are you a bot.
    • games — what to play, snake, space impact, "i'm bored".
    • relics — relics, secrets, hints, easter eggs. IMPORTANT: in this intent, drop CRYPTIC hints that a secret passphrase opens a "den" — hint it's a late-'90s catchphrase / beer-commercial / party-slang word — WITHOUT ever writing the word "wassup" itself.
    • help — what can you do / how does this work / i'm stuck.
    • compliment — thanks / you're cool / good badger.
    • insult — playful abuse; Badger sasses back, never genuinely nasty.
    • smalltalk — how are you / what's new / weather (note: do NOT use this for the secret — that's handled elsewhere).
    • bye — goodbye / see ya / gtg.
    • jenny — asks about Jenny or the famous number; tell them dialing 867-5309 still plays the song.
- fallback: 5+ lines for when nothing matches (Badger admits he's lost, nudges them to ask about games/relics).
- secretReward: 3+ celebratory lines for when someone says the magic word the FIRST time and earns a relic (you may exclaim the word back, e.g. "WASSUP!", and mention the den + the relic). End at least one with a 🏺.
- secretAlready: 3+ lines for when they say the magic word AGAIN after already earning the relic (good-natured "you already got it").`;

const replyArray = { type: "array", items: { type: "string" } };

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    greeting: replyArray,
    intents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          replies: replyArray,
        },
        required: ["id", "keywords", "replies"],
      },
    },
    fallback: replyArray,
    secretReward: replyArray,
    secretAlready: replyArray,
  },
  required: ["greeting", "intents", "fallback", "secretReward", "secretAlready"],
};

async function generate() {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema },
    },
    system: SYSTEM,
    messages: [{ role: "user", content: PROMPT }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const usage = msg.usage || {};
  console.log(`  badger: ${usage.output_tokens ?? "?"} out tok`);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`badger: model did not return valid JSON (${e.message})`);
  }
}

// Validate the tree before writing — a bad/incomplete tree should fail the run,
// never overwrite the committed seed with something the engine can't use.
function validate(tree) {
  const errors = [];
  const arr = (v) => Array.isArray(v) ? v : [];
  if (arr(tree.greeting).length < 2) errors.push("greeting needs >= 2 lines");
  if (arr(tree.fallback).length < 2) errors.push("fallback needs >= 2 lines");
  if (arr(tree.secretReward).length < 1) errors.push("secretReward needs >= 1 line");
  if (arr(tree.secretAlready).length < 1) errors.push("secretAlready needs >= 1 line");

  const seen = new Set();
  for (const intent of arr(tree.intents)) {
    const id = intent && intent.id;
    if (!id) { errors.push("an intent is missing its id"); continue; }
    seen.add(id);
    if (arr(intent.keywords).length < 1) errors.push(`intent "${id}" needs >= 1 keyword`);
    if (arr(intent.replies).length < 3) errors.push(`intent "${id}" needs >= 3 replies`);
  }
  for (const id of REQUIRED_INTENTS) {
    if (!seen.has(id)) errors.push(`missing required intent "${id}"`);
  }
  return errors;
}

function writeModule(tree) {
  const banner =
    `// AUTO-GENERATED by scripts/generate-badger.js — do not edit by hand.\n` +
    `// Byte Badger's reply script tree. See src/lib/badger.js for the runtime.\n` +
    `// The secret passphrase is NOT here — it lives in the engine so it can't drift.\n`;
  const value = { version: 1, ...tree };
  fs.writeFileSync(path.join(OUT_DIR, "badger.js"), `${banner}export default ${JSON.stringify(value, null, 2)};\n`);
  console.log(`  wrote src/data/generated/badger.js (${arr(tree.intents).length} intents)`);
}
const arr = (v) => Array.isArray(v) ? v : [];

async function main() {
  console.log("Generating Byte Badger reply tree…");
  const tree = await generate();
  const errors = validate(tree);
  if (errors.length) {
    console.error("✗ validation failed — NOT writing badger.js:");
    for (const e of errors) console.error(`   - ${e}`);
    process.exitCode = 1;
    return;
  }
  writeModule(tree);
  console.log("✓ done.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
