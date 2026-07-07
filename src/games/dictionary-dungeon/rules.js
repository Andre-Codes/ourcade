/* DICTIONARY DUNGEON — the word-rule engine (node-pure).

   A rule is the actual word constraint a room enforces ("no E", "5+ letters",
   "must contain R"). Rules are the most important content pool: they ARE the
   puzzle. Each is built from a compact SPEC STRING (e.g. "len>=5", "no:E",
   "contains:R", "vowels==2") so pools.js and the daily assembler can reference
   rules by a short id, and scripts/dungeon-check.js can enumerate how many real
   words satisfy each one (solvability).

   A built rule is:
     { id, spec, displayText, difficulty, tags[], test(word, ctx) → bool }

   `ctx` carries run state that some rules need:
     { prevWord, enemyName, tier }   (tier = rarityTier(word), passed in by logic)

   No React, no DOM: shared by the cabinet and the validator so "does this word
   pass?" means the same thing everywhere. Rules do NOT check dictionary validity
   — logic.js gates on isWord() first; a rule only judges shape/category. */

const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const isVowel = (ch) => VOWELS.has(ch);

function countVowels(w) {
  let n = 0;
  for (const ch of w) if (isVowel(ch)) n++;
  return n;
}
function distinctLetters(w) {
  return new Set(w.split("")).size;
}
function hasDouble(w) {
  for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return true;
  return false;
}
function vowelTypes(w) {
  const s = new Set();
  for (const ch of w) if (isVowel(ch)) s.add(ch);
  return s;
}

// ── rule factory ──────────────────────────────────────────────────────────────
// Each entry maps a spec PREFIX to a builder that returns {displayText, difficulty,
// tags, test}. The spec's argument (after ":", "==", ">=", etc.) is parsed here.
// difficulty is a rough tier so the assembler can place easy rules early:
//   "easy" | "medium" | "hard"

function build(spec) {
  const s = String(spec).trim();

  // length: "len>=5", "len<=6", "len==5"
  let m = s.match(/^len(>=|<=|==)(\d+)$/);
  if (m) {
    const [, op, nStr] = m;
    const n = Number(nStr);
    const test =
      op === ">=" ? (w) => w.length >= n : op === "<=" ? (w) => w.length <= n : (w) => w.length === n;
    const label =
      op === ">=" ? `Play a word ${n}+ letters long.` : op === "<=" ? `Play a word ${n} letters or shorter.` : `Play a word exactly ${n} letters long.`;
    const diff = op === ">=" && n >= 7 ? "hard" : op === ">=" && n >= 6 ? "medium" : "easy";
    return { displayText: label, difficulty: diff, tags: ["length"], test };
  }

  // startsWith: "starts:S"
  m = s.match(/^starts:([A-Za-z])$/);
  if (m) {
    const c = m[1].toUpperCase();
    return {
      displayText: `Play a word starting with ${c}.`,
      difficulty: "easy",
      tags: ["basic", "start"],
      test: (w) => w[0] === c,
    };
  }

  // endsWith: "ends:T"
  m = s.match(/^ends:([A-Za-z])$/);
  if (m) {
    const c = m[1].toUpperCase();
    return {
      displayText: `Play a word ending with ${c}.`,
      difficulty: "easy",
      tags: ["basic", "end"],
      test: (w) => w[w.length - 1] === c,
    };
  }

  // contains: "contains:R"
  m = s.match(/^contains:([A-Za-z])$/);
  if (m) {
    const c = m[1].toUpperCase();
    const rare = "JQXZ".includes(c);
    return {
      displayText: `Play a word containing ${c}.`,
      difficulty: rare ? "hard" : "easy",
      tags: ["basic", "contains", ...(rare ? ["rare-letter"] : [])],
      test: (w) => w.includes(c),
    };
  }

  // banned letter: "no:E"
  m = s.match(/^no:([A-Za-z])$/);
  if (m) {
    const c = m[1].toUpperCase();
    const common = "ETAOIN".includes(c);
    return {
      displayText: `Play a word with no ${c}.`,
      difficulty: common ? "medium" : "easy",
      tags: ["banned", "vowel"].filter((t) => (t === "vowel" ? isVowel(c) : true)),
      test: (w) => !w.includes(c),
    };
  }

  // exact vowel count: "vowels==2"
  m = s.match(/^vowels(==|>=|<=)(\d+)$/);
  if (m) {
    const [, op, nStr] = m;
    const n = Number(nStr);
    const test =
      op === "==" ? (w) => countVowels(w) === n : op === ">=" ? (w) => countVowels(w) >= n : (w) => countVowels(w) <= n;
    const label =
      op === "==" ? `Play a word with exactly ${n} vowel${n === 1 ? "" : "s"}.` : op === ">=" ? `Play a word with at least ${n} vowels.` : `Play a word with at most ${n} vowel${n === 1 ? "" : "s"}.`;
    return { displayText: label, difficulty: n <= 1 || op === "==" ? "medium" : "easy", tags: ["vowel"], test };
  }

  // one vowel TYPE only: "onevowel"
  if (s === "onevowel") {
    return {
      displayText: "Play a word using only one kind of vowel.",
      difficulty: "medium",
      tags: ["vowel"],
      test: (w) => vowelTypes(w).size <= 1 && countVowels(w) >= 1,
    };
  }

  // consonant frame: "cframe" (starts AND ends with a consonant)
  if (s === "cframe") {
    return {
      displayText: "Play a word that starts and ends with a consonant.",
      difficulty: "easy",
      tags: ["vowel", "structural"],
      test: (w) => !isVowel(w[0]) && !isVowel(w[w.length - 1]),
    };
  }

  // starts with vowel: "vstart"
  if (s === "vstart") {
    return {
      displayText: "Play a word that starts with a vowel.",
      difficulty: "easy",
      tags: ["vowel", "structural"],
      test: (w) => isVowel(w[0]),
    };
  }

  // no repeated letters: "norepeat"
  if (s === "norepeat") {
    return {
      displayText: "Play a word with no repeated letters.",
      difficulty: "medium",
      tags: ["structural"],
      test: (w) => distinctLetters(w) === w.length,
    };
  }

  // must contain a double letter: "double"
  if (s === "double") {
    return {
      displayText: "Play a word with a double letter.",
      difficulty: "medium",
      tags: ["structural"],
      test: (w) => hasDouble(w),
    };
  }

  // must contain a rare letter: "rareletter"
  if (s === "rareletter") {
    return {
      displayText: "Play a word containing a rare letter (J, Q, X, or Z).",
      difficulty: "hard",
      tags: ["rare-letter"],
      test: (w) => /[JQXZ]/.test(w),
    };
  }

  // rarity rules (need ctx.tier from logic): "tier:common", "tier:obscure",
  // "tier:notcommon" (block common), "tier:familiar+" (familiar or rarer)
  m = s.match(/^tier:(common|familiar|obscure|goblin|notcommon)$/);
  if (m) {
    const want = m[1];
    let label, diff, test;
    if (want === "common") {
      label = "Play a common word.";
      diff = "easy";
      test = (_w, ctx) => ctx?.tier === "common";
    } else if (want === "familiar") {
      label = "Play a familiar (top-10k) word.";
      diff = "easy";
      test = (_w, ctx) => ctx?.tier === "common" || ctx?.tier === "familiar";
    } else if (want === "obscure") {
      label = "Play an obscure word (outside the top 10,000).";
      diff = "hard";
      test = (_w, ctx) => ctx?.tier === "obscure" || ctx?.tier === "goblin";
    } else if (want === "goblin") {
      label = "Play a truly strange word.";
      diff = "hard";
      test = (_w, ctx) => ctx?.tier === "goblin";
    } else {
      // notcommon: block top-2k
      label = "Common words are blocked — play something less familiar.";
      diff = "medium";
      test = (_w, ctx) => ctx?.tier !== "common";
    }
    return { displayText: label, difficulty: diff, tags: ["rarity"], test };
  }

  // longer than previous word: "longer" (needs ctx.prevWord)
  if (s === "longer") {
    return {
      displayText: "Play a word longer than your last one.",
      difficulty: "medium",
      tags: ["memory", "structural"],
      test: (w, ctx) => !ctx?.prevWord || w.length > ctx.prevWord.length,
    };
  }

  // no letters from previous word: "freshletters" (needs ctx.prevWord)
  if (s === "freshletters") {
    return {
      displayText: "Play a word sharing NO letters with your last one.",
      difficulty: "hard",
      tags: ["memory", "structural"],
      test: (w, ctx) => {
        if (!ctx?.prevWord) return true;
        const prev = new Set(ctx.prevWord.split(""));
        for (const ch of w) if (prev.has(ch)) return false;
        return true;
      },
    };
  }

  // share a letter with the enemy's name: "enemyletter" (needs ctx.enemyName)
  if (s === "enemyletter") {
    return {
      displayText: "Play a word sharing a letter with the enemy's name.",
      difficulty: "easy",
      tags: ["theme"],
      test: (w, ctx) => {
        if (!ctx?.enemyName) return true;
        const en = new Set(ctx.enemyName.toUpperCase().replace(/[^A-Z]/g, "").split(""));
        for (const ch of w) if (en.has(ch)) return true;
        return false;
      },
    };
  }

  // "any" — no constraint (fallback / very first room)
  if (s === "any") {
    return {
      displayText: "Play any valid word.",
      difficulty: "easy",
      tags: ["basic"],
      test: () => true,
    };
  }

  throw new Error(`Unknown rule spec: "${spec}"`);
}

// Cache built rules by spec so repeated lookups are cheap and stable.
const _cache = new Map();

/* Build (or fetch) a rule object from a spec string. Deterministic. */
export function getRule(spec) {
  const key = String(spec).trim();
  if (_cache.has(key)) return _cache.get(key);
  const built = build(key);
  const rule = { id: key, spec: key, ...built };
  _cache.set(key, rule);
  return rule;
}

/* Does `word` satisfy `spec` given ctx? Convenience wrapper. Does NOT validate
   the word is real (logic.js does that). */
export function passesRule(spec, word, ctx) {
  return getRule(spec).test((word || "").toUpperCase(), ctx || {});
}

/* Whether a spec's outcome depends on run state (prevWord / tier / enemyName).
   The check script uses this to know a rule can't be counted in isolation. */
export function ruleNeedsContext(spec) {
  const s = String(spec).trim();
  return /^tier:/.test(s) || s === "longer" || s === "freshletters" || s === "enemyletter";
}
