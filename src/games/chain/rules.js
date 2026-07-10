/* CHAIN RULES — the modifier pool, PURE and shared.

   Chain always requires the last-first link + no-repeat. On top of that, each
   daily carries exactly ONE extra rule from this pool (and sometimes a category).
   This module is the single source of truth for those rules: it's imported by
   BOTH the browser runtime (chain/logic.js) and the Node generator
   (scripts/gen-chain.js), so the target chain the generator builds and the
   words the player is allowed to add obey the identical predicate.

   A rule is { id, label, hint, test(word, ctx) → bool }. `ctx` carries:
     { prevWord, chain }  — chain is the words already laid (NOT including `word`).
   Some rules are parameterized (a required letter, a target length); those are
   emitted as instances with the param baked into `id`/`label` and a closure
   `test`, via makeRule(). The generator picks which instance a day gets.

   Design: rules must be checkable from (word, prevWord, chain) alone — no
   dictionary needed here (the dict/last-first/no-repeat checks live in
   logic.js). Keep every rule cheap and deterministic. */

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

// Does `word` contain a doubled letter (two identical letters in a row)?
function hasDouble(word) {
  for (let i = 1; i < word.length; i++) if (word[i] === word[i - 1]) return true;
  return false;
}

/* The rule catalogue. Each entry is a factory returning one or more concrete
   rule instances (so parameterized rules expand into their variants). `weight`
   biases the daily pick: LIGHT rules (high weight) keep most days approachable;
   the harder, pool-shrinking rules appear less often. */
export const RULE_DEFS = [
  // ── light (common) ──────────────────────────────────────────────────────────
  {
    weight: 5,
    build: () => ({
      id: "plain",
      label: "just chain — last letter to first",
      hint: "link the last letter of each word to the first of the next",
      test: () => true,
    }),
  },
  {
    weight: 4,
    // must contain a common, easy letter
    build: () =>
      ["R", "T", "N", "L", "S", "E", "A"].map((ch) => ({
        id: `contains_${ch}`,
        label: `every word must contain "${ch}"`,
        hint: `each word has to include the letter ${ch}`,
        test: (word) => word.includes(ch),
      })),
  },
  {
    weight: 4,
    build: () => ({
      id: "minlen5",
      label: "every word at least 5 letters",
      hint: "no short words — 5 letters or longer",
      test: (word) => word.length >= 5,
    }),
  },
  {
    weight: 3,
    build: () => ({
      id: "no_double",
      label: "no doubled letters (no LETTER, no BOOK)",
      hint: "reject any word with two identical letters in a row",
      test: (word) => !hasDouble(word),
    }),
  },
  // ── medium ────────────────────────────────────────────────────────────────
  {
    weight: 3,
    build: () => ({
      id: "minlen6",
      label: "every word at least 6 letters",
      hint: "longer words only — 6 letters or more",
      test: (word) => word.length >= 6,
    }),
  },
  {
    weight: 2,
    build: () => ({
      id: "ascending_len",
      label: "each word as long as the last, or longer",
      hint: "never get shorter — each word ≥ the previous word's length",
      test: (word, ctx) => !ctx.prevWord || word.length >= ctx.prevWord.length,
    }),
  },
  {
    weight: 2,
    build: () => ({
      id: "consonant_start",
      label: "words can't start with a vowel",
      hint: "every word must begin with a consonant",
      test: (word) => !VOWELS.has(word[0]),
    }),
  },
  // ── hard (rare) ─────────────────────────────────────────────────────────────
  {
    weight: 2,
    build: () => ({
      id: "unique_end",
      label: "no two words may end in the same letter",
      hint: "every word has to end in a letter no earlier word ended in",
      test: (word, ctx) => {
        const tail = word[word.length - 1];
        return !ctx.chain.some((w) => w[w.length - 1] === tail);
      },
    }),
  },
  {
    weight: 1,
    // exactly N letters
    build: () =>
      [4, 5, 6].map((n) => ({
        id: `exactly_${n}`,
        label: `every word exactly ${n} letters`,
        hint: `only ${n}-letter words count`,
        test: (word) => word.length === n,
      })),
  },
];

// Flatten the catalogue into concrete instances, each tagged with its weight.
export function allRules() {
  const out = [];
  for (const def of RULE_DEFS) {
    const built = def.build();
    for (const r of Array.isArray(built) ? built : [built]) out.push({ ...r, weight: def.weight });
  }
  return out;
}

// Look a rule instance up by id (rehydrate the closure `test` from the shipped
// {id,label,hint} — the runtime stores only the serializable fields, so this
// rebuilds the predicate). Returns the "plain" rule if the id is unknown.
export function ruleById(id) {
  const found = allRules().find((r) => r.id === id);
  if (found) return found;
  return allRules().find((r) => r.id === "plain");
}

// The serializable shape shipped in the generated puzzle ({id,label,hint}).
export function ruleMeta(rule) {
  return { id: rule.id, label: rule.label, hint: rule.hint };
}
