/* ============================================================
   DAILY-CHECK — headless verifier for the date-seeded daily layer.
   Same idea as scripts/descent-sim.js: drive the real selection
   logic (no React) to confirm "today" is deterministic and that
   picks rotate through their pools without early repeats.
   Run:  node scripts/daily-check.js
   ============================================================ */

import { dayKey, rotateDaily } from "../src/lib/daily.js";
import { POLLS, getTodaysPoll } from "../src/data/polls.js";
import { QUIZZES, getTodaysQuiz } from "../src/data/quizzes.js";
import { getTodaysTip } from "../src/data/flavor.js";
import { FACTS, getTodaysFact } from "../src/data/facts.js";

const DAYS = 14;

// games.js imports React (lazy components). Importing it in Node is harmless
// (React.lazy never calls the factory), but guard anyway so the check still
// runs if that ever stops being true.
let GAME_LIST = null;
try {
  const mod = await import("../src/data/games.js");
  GAME_LIST = mod.GAMES.filter((g) => g.category === "game");
} catch (e) {
  console.warn(`note: skipping Game of the Day (couldn't import games.js: ${e.message})`);
}

// N consecutive local-date keys starting today.
function keysFromToday(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) =>
    dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  );
}

const keys = keysFromToday(DAYS);

console.log(`\nOURCADE daily-check — next ${DAYS} days\n`);
console.log("date       | game of the day        | poll                          | quiz");
console.log("-".repeat(96));
for (const key of keys) {
  const gotd = GAME_LIST ? rotateDaily(GAME_LIST, key, 0) : null;
  const poll = getTodaysPoll(key);
  const quiz = getTodaysQuiz(key);
  console.log(
    `${key} | ${(gotd?.title || "—").slice(0, 22).padEnd(22)} | ` +
      `${(poll?.question || "—").slice(0, 29).padEnd(29)} | ${quiz?.title || "—"}`
  );
}
console.log(`\nsample mascot tip (day 1): ${getTodaysTip(keys[0])}`);
console.log(`sample game fact (day 1): ${getTodaysFact(keys[0])}\n`);

// ---- assertions ----
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

// Determinism: the same date must always resolve to the same pick.
const k0 = keys[0];
check("poll deterministic", getTodaysPoll(k0).id === getTodaysPoll(k0).id);
check("quiz deterministic", getTodaysQuiz(k0).id === getTodaysQuiz(k0).id);
check("fact deterministic", getTodaysFact(k0) === getTodaysFact(k0));

// No repeats across one full rotation cycle (length == pool size).
function noRepeats(label, idFor, poolLen) {
  const ids = keysFromToday(poolLen).map(idFor);
  const unique = new Set(ids).size;
  check(`${label} no repeats over ${poolLen}-day cycle`, unique === poolLen, `${unique}/${poolLen} unique`);
}
noRepeats("poll", (k) => getTodaysPoll(k).id, POLLS.length);
noRepeats("quiz", (k) => getTodaysQuiz(k).id, QUIZZES.length);
if (GAME_LIST) noRepeats("game-of-the-day", (k) => rotateDaily(GAME_LIST, k, 0).id, GAME_LIST.length);

// Facts rotate every 3 days (a pick lingers), so sample one day per 3-day period
// and confirm the whole pool cycles with no repeats over a full run.
const FACT_PERIOD = 3;
const factBase = new Date();
const factSample = Array.from({ length: FACTS.length }, (_, i) =>
  dayKey(new Date(factBase.getFullYear(), factBase.getMonth(), factBase.getDate() + i * FACT_PERIOD))
).map(getTodaysFact);
check(
  `fact no repeats over ${FACTS.length}-period (${FACTS.length * FACT_PERIOD}-day) cycle`,
  new Set(factSample).size === FACTS.length,
  `${new Set(factSample).size}/${FACTS.length} unique`
);

console.log(`\n${failures === 0 ? "✓ all checks passed" : "✗ " + failures + " check(s) failed"}\n`);
process.exit(failures === 0 ? 0 : 1);
