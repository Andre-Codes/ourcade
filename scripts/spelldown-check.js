/* ============================================================
   SPELLDOWN-CHECK — headless verifier for the daily Spelldown.
   Same idea as scripts/relic-run-check.js: drive the real selection + scoring
   logic (no React) to confirm the generated board pool is sound and that every
   upcoming day yields a deterministic, well-formed board — without ever falling
   through to the fallback.
   Run:  node scripts/spelldown-check.js   (npm run check:spelldown)
   ============================================================ */

import { dayKey } from "../src/lib/daily.js";
import BOARDS from "../src/data/generated/spelldown.js";
import {
  boardFor, judge, isPangram, rankFor, spelldownNumber, MIN_LEN,
} from "../src/games/spelldown/logic.js";

const DAYS = 60; // upcoming days to audit for determinism / fallback

// N consecutive local-date keys starting today (mirrors daily-check.js).
function keysFromToday(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) =>
    dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  );
}

const keys = keysFromToday(DAYS);

console.log(`\nOURCADE spelldown-check — ${BOARDS.length} boards, next ${DAYS} days\n`);
console.log("date       |  #  | letters  | ctr | words | pangrams");
console.log("-".repeat(70));
for (const key of keys.slice(0, 14)) {
  const b = boardFor(key);
  const fb = b.id === "spd-fallback" ? " (FALLBACK!)" : "";
  console.log(
    `${key} | ${String(spelldownNumber(key)).padStart(3)} | ${b.letters.padEnd(8)} | ` +
      ` ${b.center}  | ${String(b.maxWords).padStart(4)}  | ${b.pangrams.join(", ")}${fb}`
  );
}

// ---- assertions ----
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

console.log("");

// 1) Pool is non-trivial.
check("board pool non-empty", BOARDS.length >= 14, `${BOARDS.length} boards`);

// 2) Every board is well-formed: 7 distinct letters incl. center, ≥1 pangram,
//    maxWords matches, and EVERY listed word is valid for the board (4+ letters,
//    only the board's letters, includes the center, pangrams use all 7). This is
//    the core "the generator can't ship a broken board" guarantee.
{
  let bad = 0;
  const firstErrors = [];
  for (const b of BOARDS) {
    const errs = [];
    const set = new Set(b.letters.split(""));
    if (b.letters.length !== 7 || set.size !== 7) errs.push("letters!=7distinct");
    if (!set.has(b.center)) errs.push("center not in letters");
    if (!Array.isArray(b.words) || b.words.length === 0) errs.push("no words");
    if (b.maxWords !== (b.words?.length ?? -1)) errs.push("maxWords mismatch");
    if (!Array.isArray(b.pangrams) || b.pangrams.length === 0) errs.push("no pangram");
    for (const w of b.words || []) {
      if (w.length < MIN_LEN) { errs.push(`short:${w}`); break; }
      if (![...w].every((c) => set.has(c))) { errs.push(`outofset:${w}`); break; }
      if (!w.includes(b.center)) { errs.push(`nocenter:${w}`); break; }
    }
    for (const p of b.pangrams || []) {
      if (new Set(p.split("")).size !== 7 || !b.words.includes(p)) { errs.push(`badpangram:${p}`); break; }
    }
    if (errs.length) {
      bad++;
      if (firstErrors.length < 5) firstErrors.push(`${b.id}: ${errs.join(",")}`);
    }
  }
  check("every board well-formed", bad === 0, bad ? firstErrors.join(" · ") : `${BOARDS.length} boards ok`);
}

// 3) Board ids unique (so localStorage / share never collide).
{
  const ids = BOARDS.map((b) => b.id);
  check("board ids unique", new Set(ids).size === ids.length, `${ids.length} ids`);
}

// 4) Determinism — the same day always resolves to the same board.
{
  let stable = true;
  for (const key of keys) {
    if (boardFor(key).id !== boardFor(key).id) { stable = false; break; }
  }
  check("daily pick deterministic", stable);
}

// 5) Never falls through to the fallback across the audit window.
{
  const fell = keys.filter((k) => boardFor(k).id === "spd-fallback");
  check("no fallback over window", fell.length === 0, fell.length ? `${fell.length} day(s)` : `${DAYS} days clean`);
}

// 6) No repeats until the pool is exhausted (rotateDaily's contract). Over the
//    first BOARDS.length days, every board should be distinct.
{
  const span = BOARDS.length;
  const seen = keys.slice(0, span).map((k) => boardFor(k).id);
  check(`no repeats over ${span}-day cycle`, new Set(seen).size === seen.length,
    `${new Set(seen).size}/${span} unique`);
}

// 7) judge() behaves: a known good word is "ok", and the rule violations are
//    each rejected with the right reason (drives the in-game toasts).
{
  const b = boardFor(keys[0]);
  const good = b.words.find((w) => !isPangram(w, b)) || b.words[0];
  const okOk = judge(good, b, []) === "ok";
  const dupRejected = judge(good, b, [good]) === "already";
  // a 3-letter slice (too short) and a word with a letter not in the set
  const shortRejected = judge(good.slice(0, 3), b, []) === "short";
  const offLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((c) => !b.letters.includes(c));
  const badLetterRejected = judge(b.center + offLetter + offLetter + offLetter, b, []) === "badletter";
  check("judge accepts a real word", okOk, good);
  check("judge rejects a duplicate", dupRejected);
  check("judge rejects too-short", shortRejected);
  check("judge rejects an off-set letter", badLetterRejected);
}

// 8) Ranks are monotonic and reach the top tier at the board's max.
{
  const b = boardFor(keys[0]);
  const r0 = rankFor(0, b);
  const rMax = rankFor(b.maxWords, b);
  check("rank at 0 is the first tier", r0.index === 0, r0.label);
  check("rank at max is the top tier", rMax.next === null, rMax.label);
}

console.log(`\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
