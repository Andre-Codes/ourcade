/* ============================================================
   BUZZ-QUALITY — the editorial contract for 💬 THE BUZZ.
   The Water Cooler is the arcade's daily briefing, so a dispatch
   has to be ABOUT something: a real, named thing, with a real
   link. "A celebrity was photographed holding an iced coffee" is
   a horoscope, not news.

   Imported by BOTH sides so one definition governs:
     - scripts/generate-content.js  drops non-conforming items at
       write time (so a written pool is conforming by construction)
     - scripts/daily-check.js       asserts the pool hasn't drifted

   Lives here, not in src/data/, because it's POLICY, not runtime
   data — src/data/** must stay node-pure and shippable.

   ── Why the gate is structural, not prose analysis ──
   Detecting vagueness by reading the sentence does not work on
   this corpus. The house voice puts a capitalized 2000s prop in
   nearly every punchline (Tamagotchi, Winamp, Claire's, Beanie
   Baby, CD-ROM), so "contains a proper noun" is uncorrelated with
   "names its subject" — measured at ~50% precision over the real
   pool. And "Physical game manuals were peak literature" is
   grammatically identical to a specific statement, so no regex
   reaches it: a tuned hedge net tops out near 100% precision but
   only ~40% recall.

   So the model has to SHOW ITS WORK instead. It declares the
   `subject` it wrote about, and we verify that subject is a real
   name AND that it actually appears in the line. That turns a
   judgement call into a decidable check. The regex below stays on
   as a cheap second belt — precision is free — but it is never
   the gate.

   No dependencies.
   ============================================================ */

// Bare categories that can never be a subject: a category is not a story.
// "Flip phones are back" is a vibe; "Nokia relaunched the 3210" is a dispatch.
const GENERIC_SUBJECT = new Set([
  "celebrity", "celebrities", "celeb", "pop star", "pop stars", "star", "stars",
  "actor", "actors", "actress", "director", "directors", "singer", "rapper",
  "artist", "band", "boy band", "girl group", "streamer", "platform", "studio",
  "network", "label", "franchise", "sitcom", "reality show", "award show", "awards",
  "movie", "movies", "film", "films", "show", "shows", "song", "songs",
  "album", "albums", "game", "games", "reboot", "sequel", "tour", "costar",
  "heartthrob", "influencer", "creator", "mascot", "brand", "app",
  "flip phones", "low-rise jeans", "cargo pants", "frosted tips", "trucker hats",
  "vinyl", "streaming", "nostalgia", "physical media", "the internet", "memes",
]);

/* Is `subject` a real name rather than a category? Proper names and numbered
   titles carry a capital or a digit ("Grand Theft Auto VI", "BTS", "Silo"),
   categories don't. Short, because a subject is a name, not a sentence. */
export function isNamedSubject(subject) {
  const s = String(subject || "").trim();
  if (!s || s.length > 60) return false;
  if (/^(a|an|the|some|another|two|one|every)\s/i.test(s)) return false; // "the pop star of the moment"
  if (GENERIC_SUBJECT.has(s.toLowerCase())) return false;
  if (s.split(/\s+/).length > 6) return false;
  return /[\p{Lu}]/u.test(s) || /\d/.test(s);
}

// Loose compare so punctuation/curly-quote drift between the two fields can't
// fail an otherwise-good item.
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* The contract: the declared subject must be a real name AND actually appear in
   the line. Without the second half, `subject` is just a label the model can
   attach to anything. Falls back to any substantial word of the subject so a
   natural rephrase ("Rodrigo" for "Olivia Rodrigo") still passes. */
export function hasNamedSubject(item) {
  if (!isNamedSubject(item?.subject)) return false;
  const t = norm(item.text);
  const s = norm(item.subject);
  if (!s) return false;
  if (t.includes(s)) return true;
  const words = s.split(" ").filter((w) => w.length >= 4);
  return words.length > 0 && words.some((w) => t.includes(w));
}

/* SPECIFIC ABOUT WHAT, VAGUE ABOUT WHEN. Content is generated monthly and then
   date-rotated, so a dispatch can surface up to a month after it was written.
   Naming the thing ages fine; timestamping it does not. */
export const DATED_RE = new RegExp(
  String.raw`\b(this|last|next)\s+(week|weekend|month|night|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b` +
    String.raw`|\b(tonight|yesterday|tomorrow|today|right now|just dropped|just announced|out now|opening weekend)\b` +
    String.raw`|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d`,
  "i"
);

/* The hedge net — high precision, ~40% recall, measured against the live pool.
   A belt, not the gate (see the header).

   Two tuning notes, both learned the hard way:
   - The role phrase is clause-anchored, so "a director" as a hedge subject is
     caught but an incidental mid-sentence mention isn't.
   - `someone` is narrowed to verb forms. A bare \bsomeone\b false-rejected two
     of the BEST items in the pool ("…someone hand her a Discman"). */
const ROLE =
  String.raw`celebrit(?:y|ies)|celeb|pop\s+stars?|actors?|actress(?:es)?|directors?|singers?|rappers?` +
  String.raw`|boy\s+bands?|girl\s+groups?|streamers?|platforms?|studios?|networks?|labels?` +
  String.raw`|heartthrobs?|costars?|influencers?|franchises?|sitcoms?|reality\s+shows?|award\s+shows?` +
  String.raw`|beloved\s+[a-z]+`;
const HEDGE = new RegExp(
  String.raw`(?:^|[.!?;:—–,]\s*|\b(?:says|claims|word is|whispers of|talk of|buzz says)\s+)` +
    String.raw`(?:a|an|another|some|one|two|every)\s+(?:[a-z][a-z'’-]*\s+){0,2}(?:${ROLE})\b`,
  "i"
);
const HEDGE_EXTRA =
  /\ba huge act\b|\bsomeone (?:brought|claims|found|is|was|just)\b|\byour streaming service\b|\bthe (?:pop star of the moment|one everyone|show everyone)\b/i;

export function isVagueBuzz(text) {
  const t = String(text || "");
  return HEDGE.test(t) || HEDGE_EXTRA.test(t);
}

/* The single predicate. A dispatch names a real thing, links somewhere real,
   doesn't hedge, and doesn't rot. */
export function isDispatch(item) {
  return (
    !!item?.source &&
    hasNamedSubject(item) &&
    !isVagueBuzz(item.text) &&
    !DATED_RE.test(item.text)
  );
}

/* Placeholder chart entries — the 📻 Countdown's version of the same disease
   ("the one from the show everyone's watching" / by: "you know the one").
   The ranking IS the content, so an unnamed entry is a blank row.

   Deliberately does NOT include "everyone's watching": that fires on
   "TOP 5 MOVIES EVERYONE'S WATCHING", a perfectly good TRL-style header whose
   entries are real named films. The offending entry above is already caught by
   the leading "the one" shape, so the alternative bought nothing but a false
   positive on a real chart. */
export const VAGUE_CHART_RE =
  /^(the|that|a|an)\s+(one|thing|show|song|movie|album|artist|band|track)\b|\byou know the one\b|\bof the moment\b|\bnobody asked for\b/i;
