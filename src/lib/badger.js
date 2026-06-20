/* ─────────────────────────────────────────────────────────────────────────
   BYTE BADGER — the brain behind the phone's built-in virtual contact.

   A pure module (no React, no Firebase) so it's trivially node-testable. It
   turns a user's text + the running conversation into Byte Badger's reply by
   retrieving over the pre-baked knowledge base in data/generated/badger.js.
   There is NO live LLM call here — Ourcade is a static site, so the
   "intelligence" is a large, richly-authored set of topic cards picked over at
   runtime with a tiny token-overlap ranker + variety.

   The KB has two retrievable surfaces, scored the same way:
     • intents — on-site topics (games, relics, help, jenny, who…).
     • topics  — the conversational brain: nostalgia / early-2000s internet &
                 gaming culture (dial-up, Napster, N64, Tamagotchi, Y2K…).
   Whichever card scores highest above a small threshold answers; below it,
   Badger stays in character and warmly REDIRECTS (never a flat "I don't know"),
   often dangling a teaser toward a real topic so a miss still feels alive.

   The SECRET PASSPHRASE that awards a relic lives here (not in the generated
   tree) so it can never drift when the tree is regenerated. Saying it to Badger
   returns `awardRelic`; the caller (PhoneProvider) performs the idempotent
   recordRelic and decides whether to show the first-time or repeat line.
   ───────────────────────────────────────────────────────────────────────── */

import TREE from "../data/generated/badger.js";

// Byte Badger's identity is the in-world NPC number 555-0001 — the SAME number
// scripts/quarter-text.js uses to send the Daily Quarter. Sharing the number
// means the live chat and the daily texts thread together in the phone, and the
// 555-0001 contact that gets auto-added on the first Quarter text routes here.
export const BADGER_NUMBER = "555-0001";
export const BADGER_NAME = "Byte Badger";
export const BADGER_RELIC_ID = "byte-badger-secret";

// The easter-egg passphrase: the late-'90s Budweiser / Scary Movie "Wassup".
// We accept the common spellings but stay specific enough not to fire on plain
// "what's up" smalltalk (that's handled by the `smalltalk` intent instead).
const SECRET_PATTERNS = [/\bwa+s+u+p\b/, /\bwha+s+u+p\b/, /\bwa+z+u+p\b/, /\bwha+z+u+p\b/, /\bwassup\b/];

// A reply needs at least this much (rarity-weighted) keyword evidence to beat the
// warm redirect. Kept low so any genuine keyword hit engages — even a single
// common word — while pure noise (no keyword overlap at all) still redirects.
const SCORE_THRESHOLD = 0.05;

// Common words carry no topic signal — dropped from single-token matching so
// "do you remember the n64" keys on "remember"/"n64", not "do"/"you"/"the".
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "is", "it", "its", "im", "i", "you", "u", "ur", "your", "me", "my", "we",
  "do", "did", "does", "was", "were", "be", "been", "am", "are", "this", "that",
  "what", "whats", "who", "how", "when", "where", "why", "can", "could", "would",
  "will", "so", "if", "as", "with", "about", "got", "get", "have", "has", "had",
  "yeah", "yea", "ok", "okay", "lol", "like", "just", "really", "very", "any",
]);

// Normalize free text → lowercase, alphanumerics separated by single spaces.
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Distinctive tokens from a message: normalized words minus stopwords, keeping
// anything length >= 2 (so "n64", "ps2", "cd" survive but bare letters don't).
function tokens(text) {
  return norm(text)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// Is this recipient Byte Badger? Match his number (555-0001 in any punctuation)
// or his name/@handle, so both "select the contact" and "type the number" route
// into the local intercept instead of the cloud.
const BADGER_DIGITS = BADGER_NUMBER.replace(/[^\d]/g, ""); // "5550001"
export function isBadger(to) {
  const digits = String(to || "").replace(/[^\d]/g, "");
  if (digits && digits === BADGER_DIGITS) return true;
  const t = norm(to);
  return t === "badger" || t === "byte badger";
}

function spokeBefore(history) {
  return history.some((h) => h.from === "badger");
}

// Pick a variant with light, reload-stable variety: skip the line Badger said
// last (so it doesn't immediately repeat) and index by conversation length so
// the same thread state always yields the same choice.
function pick(arr, history) {
  if (!arr || !arr.length) return "…";
  const lastBadger = [...history].reverse().find((h) => h.from === "badger")?.body;
  const pool = arr.length > 1 ? arr.filter((r) => r !== lastBadger) : arr;
  const choices = pool.length ? pool : arr;
  return choices[history.length % choices.length];
}

function matchesSecret(text) {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

// All scoreable cards: on-site intents + the conversational topic brain. Both
// share the { keywords, replies } shape, so they rank in one pass. Built once.
const CARDS = [...(TREE.intents || []), ...(TREE.topics || [])];
function cards() {
  return CARDS;
}

// Token rarity (IDF-lite), computed once from the whole KB: how many cards use a
// given keyword token. A token in many cards ("game", "play") carries little
// signal; a token in one card ("n64", "tamagotchi") nearly pins the topic. We
// weight a match by 1/cardCount so a specific term beats a generic one even when
// both technically "hit" — that's what makes "best n64 game" land on n64.
const TOKEN_CARD_COUNT = (() => {
  const m = new Map();
  for (const card of CARDS) {
    const here = new Set();
    for (const kw of card.keywords || []) {
      for (const p of norm(kw).split(" ")) {
        if (p.length >= 2 && !STOPWORDS.has(p)) here.add(p);
      }
    }
    for (const p of here) m.set(p, (m.get(p) || 0) + 1);
  }
  return m;
})();
function tokenWeight(p) {
  // Rarer tokens weigh more (range ~0.1–1). A token unseen in the KB still gets
  // full weight (it can only have come from the one keyword being matched).
  const n = TOKEN_CARD_COUNT.get(p) || 1;
  return 1 / n;
}

// Score a card (intent or topic) against the user's message. Two signals, each
// weighted by token rarity:
//   • full-phrase substring — a whole keyword appearing in the message; multi-word
//     phrases additionally get a flat bonus so "good morning" beats a bare "good".
//   • token overlap — distinctive message tokens equal to a keyword token. This is
//     what lets loose phrasings ("u a robot?", "blowing on cartridges") still land
//     on the right card instead of dropping to the redirect.
// A single-word keyword counts ONCE (substring and token are the same evidence).
function scoreCard(card, text, msgTokens) {
  let s = 0;
  const counted = new Set(); // keyword tokens already credited (once each)
  // Pad with spaces so phrase matching is WORD-boundary aware — "hi" must not
  // match inside "tamagotchi", "yo" must not match inside "beyond", etc.
  const padded = ` ${text} `;
  for (const kw of card.keywords || []) {
    const k = norm(kw);
    if (!k) continue;
    const parts = k.split(" ");
    if (padded.includes(` ${k} `)) {
      // Multi-word phrase: flat bonus for the precise match, plus each word's weight.
      if (parts.length > 1) {
        s += 1;
        for (const p of parts) {
          if (p.length < 2 || STOPWORDS.has(p)) continue;
          s += tokenWeight(p);
        }
      } else {
        s += tokenWeight(parts[0]);
        counted.add(parts[0]);
      }
    }
    // Per-token overlap — credit each distinctive keyword token once.
    for (const p of parts) {
      if (p.length < 2 || STOPWORDS.has(p) || counted.has(p)) continue;
      if (msgTokens.includes(p)) {
        s += tokenWeight(p);
        counted.add(p);
      }
    }
  }
  return s;
}

// The id of the card Badger answered with on its previous turn (if we can tell)
// — used to prefer a `followup` when the user stays on the same topic.
function lastTopicId(history) {
  const lastBadger = [...history].reverse().find((h) => h.from === "badger")?.body;
  if (!lastBadger) return null;
  for (const c of cards()) {
    if ((c.replies || []).includes(lastBadger) || (c.followups || []).includes(lastBadger)) {
      return c.id || null;
    }
  }
  return null;
}

// Warm redirect for a miss: a fallback line, with a gentle teaser toward a real
// topic so an unknown subject still feels alive (never a dead "I don't know").
function redirect(history) {
  const base = pick(TREE.fallback, history);
  const topics = TREE.topics || [];
  if (!topics.length) return base;
  const t = topics[history.length % topics.length];
  const hook = (t.keywords && t.keywords[0]) || t.id;
  return hook ? `${base} (Ask me about ${hook} sometime — that I can wax poetic on.)` : base;
}

/**
 * Compute Byte Badger's reply.
 * @param {string} userText - the message the user just sent.
 * @param {Array<{from:'me'|'badger', body:string, ts:number}>} history
 *        - prior turns (oldest→newest); the current message may or may not be
 *          included by the caller — matching only reads `userText`.
 * @returns {{ text:string, awardRelic?:string, alreadyText?:string }}
 */
export function badgerReply(userText, history = []) {
  const text = norm(userText);

  // 1) Secret passphrase → signal a relic award (caller performs it).
  if (matchesSecret(text)) {
    return {
      text: pick(TREE.secretReward, history),
      awardRelic: BADGER_RELIC_ID,
      alreadyText: pick(TREE.secretAlready, history),
    };
  }

  // 2) Opening with nothing meaningful and Badger hasn't spoken → greeting.
  if (!text && !spokeBefore(history)) {
    return { text: pick(TREE.greeting, history) };
  }

  // 3) Retrieve the best-scoring card across intents + topics. Rarity weighting
  // means a specific term ("n64") naturally outscores a generic one ("game").
  const msgTokens = tokens(text);
  let best = null;
  let bestScore = 0;
  for (const card of cards()) {
    const score = scoreCard(card, text, msgTokens);
    if (score > bestScore) { bestScore = score; best = card; }
  }

  // 4) Below the threshold → stay in character and warmly redirect.
  if (bestScore < SCORE_THRESHOLD || !best) {
    return { text: redirect(history) };
  }

  // 5) Light memory: if the user lingered on the same topic and the card offers
  // a follow-up, deepen the thread instead of restating the same beat.
  if (best.id && best.id === lastTopicId(history) && best.followups && best.followups.length) {
    return { text: pick(best.followups, history) };
  }

  return { text: pick(best.replies, history) };
}
