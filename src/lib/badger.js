/* ─────────────────────────────────────────────────────────────────────────
   BYTE BADGER — the brain behind the phone's built-in virtual contact.

   A pure module (no React, no Firebase) so it's trivially node-testable. It
   turns a user's text + the running conversation into Byte Badger's reply by
   matching against the pre-baked script tree in data/generated/badger.js. There
   is NO live LLM call here — Ourcade is a static site, so the "intelligence" is
   a richly-authored tree picked over at runtime with keyword scoring + variety.

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

// Normalize free text → lowercase, alphanumerics separated by single spaces.
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

// Score an intent by how many of its keywords appear as substrings, weighting
// multi-word keywords higher so "good morning" beats a bare "good".
function scoreIntent(intent, text) {
  let s = 0;
  for (const kw of intent.keywords || []) {
    const k = norm(kw);
    if (k && text.includes(k)) s += Math.max(1, k.split(" ").length);
  }
  return s;
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

  // 3) Best-scoring intent, else fallback.
  let best = null;
  let bestScore = 0;
  for (const intent of TREE.intents || []) {
    const s = scoreIntent(intent, text);
    if (s > bestScore) {
      bestScore = s;
      best = intent;
    }
  }
  const bucket = bestScore > 0 && best ? best.replies : TREE.fallback;
  return { text: pick(bucket, history) };
}
