/* ============================================================
   DAILY-CHECK — headless verifier for the date-seeded daily layer.
   Same idea as scripts/pits-and-portals-sim.js: drive the real selection
   logic (no React) to confirm "today" is deterministic and that
   picks rotate through their pools without early repeats.
   Run:  node scripts/daily-check.js
   ============================================================ */

import { dayKey, rotateDaily, dayPart, isWithinWindow } from "../src/lib/daily.js";
import { activeSchedule } from "../src/data/manual/schedule.js";
import { POLLS, getTodaysPoll } from "../src/data/polls.js";
import { QUIZZES, getTodaysQuiz } from "../src/data/quizzes.js";
import { getTodaysTip } from "../src/data/flavor.js";
import { FACTS, getTodaysFact, PERIOD_DAYS as FACT_PERIOD } from "../src/data/facts.js";
import { CURIOSITIES, getTodaysCuriosity } from "../src/data/curiosities.js";
import { WEIRD, WEIRD_NIGHT, getCurrentWeirdThing, WEIRD_BLOCKS_PER_DAY } from "../src/data/weird.js";
import { getDayPartGreeting } from "../src/data/dayparts.js";
import { staticArtifacts } from "../src/data/stumble.js";
import { COUNTDOWNS, getTodaysCountdown } from "../src/data/countdowns.js";
import { BUZZ, getTodaysBuzz } from "../src/data/buzz.js";
import { HOT_OR_NOT, getTodaysHotOrNot } from "../src/data/hotornot.js";
import { ON_THIS_DAY_ALL, getOnThisDay } from "../src/data/onthisday.js";
import { urlKey } from "./lib/validate-urls.js";

// A day-part object for a given local hour (date is arbitrary — only the hour
// determines the part). Lets us drive the time-of-day logic headlessly.
const partAt = (h) => dayPart(new Date(2026, 0, 1, h));
const PARTS = { morning: partAt(8), afternoon: partAt(14), evening: partAt(19), night: partAt(23) };

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
console.log(`sample game fact (day 1): ${getTodaysFact(keys[0])}`);
console.log(`sample curiosity (day 1): ${getTodaysCuriosity(keys[0])?.title}`);
console.log(
  "weird by block (day 1): " +
    Array.from({ length: WEIRD_BLOCKS_PER_DAY }, (_, b) =>
      `${b}:${getCurrentWeirdThing(keys[0], PARTS.afternoon, b)?.title?.slice(0, 16)}`
    ).join(" · ") +
    ` · 🌙 ${getCurrentWeirdThing(keys[0], PARTS.night)?.title?.slice(0, 16)}`
);
console.log("");

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

// Facts advance once per period (currently daily) — sample one day per period
// and confirm the whole pool cycles with no repeats over a full run.
const factBase = new Date();
const factSample = Array.from({ length: FACTS.length }, (_, i) =>
  dayKey(new Date(factBase.getFullYear(), factBase.getMonth(), factBase.getDate() + i * FACT_PERIOD))
).map(getTodaysFact);
check(
  `fact no repeats over ${FACTS.length}-period (${FACTS.length * FACT_PERIOD}-day) cycle`,
  new Set(factSample).size === FACTS.length,
  `${new Set(factSample).size}/${FACTS.length} unique`
);

// ---- Today's Arcade additions ----

// Curiosity: deterministic + full-pool no-repeat cycle (daily rotation).
check("curiosity deterministic", getTodaysCuriosity(k0).id === getTodaysCuriosity(k0).id);
noRepeats("curiosity", (k) => getTodaysCuriosity(k).id, CURIOSITIES.length);

// Day-parts: the local hour must map to the right named part (incl. the 0–5
// pre-dawn wrap back to night).
{
  const expect = (h) =>
    h < 5 ? "night" : h < 11 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night";
  let bad = null;
  for (let h = 0; h < 24 && !bad; h++) {
    const got = partAt(h).id;
    if (got !== expect(h)) bad = `hour ${h} → ${got} (want ${expect(h)})`;
  }
  check("dayPart boundaries map 0–23", !bad, bad || "all 24 hours correct");
}

// Greeting: deterministic per (day, part) and never empty.
check(
  "greeting deterministic per part",
  ["morning", "night"].every(
    (id) => getDayPartGreeting(PARTS[id], k0) === getDayPartGreeting(PARTS[id], k0)
  ) && ["morning", "afternoon", "evening", "night"].every((id) => !!getDayPartGreeting(PARTS[id], k0))
);

// Weird thing — daytime: now stepped through WEIRD_BLOCKS_PER_DAY ~3h blocks
// (block-driven, not day-part-driven), so it freshens several times through the
// day. Deterministic per block, and the blocks give many DISTINCT picks per day.
check(
  "weird thing deterministic per block",
  getCurrentWeirdThing(k0, PARTS.afternoon, 3).id ===
    getCurrentWeirdThing(k0, PARTS.afternoon, 3).id
);
{
  // Drive every block of the day with an explicit block arg (PARTS.afternoon just
  // keeps us out of the separate night-pool branch).
  const blockPicks = Array.from({ length: WEIRD_BLOCKS_PER_DAY }, (_, b) =>
    getCurrentWeirdThing(k0, PARTS.afternoon, b).id
  );
  check(
    `weird thing: ${WEIRD_BLOCKS_PER_DAY} daily blocks give >3 distinct picks`,
    new Set(blockPicks).size > 3,
    `${new Set(blockPicks).size}/${WEIRD_BLOCKS_PER_DAY} unique`
  );
}

// Weird thing — night: comes from the night-only pool, and cycles that pool
// with no repeats over its length (one fresh dreamy find per night).
{
  const nightIds = new Set(WEIRD_NIGHT.map((w) => w.id));
  check("weird thing: night draws from the night pool", nightIds.has(getCurrentWeirdThing(k0, PARTS.night).id));
  const base = new Date();
  const seq = Array.from({ length: WEIRD_NIGHT.length }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, 23);
    return getCurrentWeirdThing(dayKey(d), PARTS.night).id;
  });
  check(
    `weird night-pool no repeats over ${WEIRD_NIGHT.length}-night cycle`,
    new Set(seq).size === WEIRD_NIGHT.length,
    `${new Set(seq).size}/${WEIRD_NIGHT.length} unique`
  );
}

// Stumble static pool audit (the lazy flash bucket is fetch-flash's problem).
{
  const pool = staticArtifacts();
  const KINDS = new Set(["wiki", "site", "patent", "game", "video", "image", "flash", "mystery"]);
  const ERAS = new Set(["nostalgic", "current", "timeless"]);
  const bad = pool.filter(
    (a) => !a.id || !a.title || !a.blurb || !a.url || !KINDS.has(a.kind) || !ERAS.has(a.era)
  );
  check("stumble artifacts well-formed", bad.length === 0, bad.length ? `bad: ${bad.map((a) => a.id || "?").join(", ")}` : `${pool.length} artifacts`);
  check("stumble artifact ids unique", new Set(pool.map((a) => a.id)).size === pool.length);
  const counts = {};
  for (const a of pool) counts[a.era] = (counts[a.era] || 0) + 1;
  check(
    "stumble pool covers all three eras",
    ["nostalgic", "current", "timeless"].every((e) => counts[e] > 0),
    Object.entries(counts).map(([e, n]) => `${e}:${n}`).join(" ")
  );

  // No cross-pool overlap: a site on the daily Weird card shouldn't also be in
  // the dice (urlKey = host-level identity except on multi-page hosts).
  const stumbleKeys = new Map(pool.map((a) => [urlKey(a.url), a.id]));
  const overlaps = [...WEIRD, ...WEIRD_NIGHT]
    .filter((w) => stumbleKeys.has(urlKey(w.url)))
    .map((w) => `${w.id}↔${stumbleKeys.get(urlKey(w.url))}`);
  check("weird/stumble pools don't overlap", overlaps.length === 0, overlaps.join(", ") || "disjoint");
}

// ---- The Water Cooler (/watercooler) ----

// Countdown: deterministic, cycles its pool of chart sets with no early repeats,
// and every set is a well-formed top-5 (ranks 1..5, valid trend).
check("countdown deterministic", getTodaysCountdown(k0).id === getTodaysCountdown(k0).id);
noRepeats("countdown", (k) => getTodaysCountdown(k).id, COUNTDOWNS.length);
{
  const TRENDS = new Set(["up", "down", "same", "new"]);
  const bad = COUNTDOWNS.filter((c) => {
    if (!c.id || !c.title || !Array.isArray(c.entries) || c.entries.length !== 5) return true;
    const ranks = c.entries.map((e) => e.rank).sort((a, b) => a - b);
    const ranksOk = ranks.every((r, i) => r === i + 1);
    const entriesOk = c.entries.every((e) => e.title && TRENDS.has(e.trend));
    return !ranksOk || !entriesOk;
  });
  check("countdown sets well-formed (5 entries, ranks 1..5, valid trend)", bad.length === 0,
    bad.length ? `bad: ${bad.map((c) => c.id || "?").join(", ")}` : `${COUNTDOWNS.length} sets`);
}

// Buzz: deterministic, returns N distinct blurbs, cycles the pool with no early repeats.
check("buzz deterministic", getTodaysBuzz(k0, 3).map((b) => b.id).join() === getTodaysBuzz(k0, 3).map((b) => b.id).join());
check("buzz returns 3 distinct ids", new Set(getTodaysBuzz(k0, 3).map((b) => b.id)).size === Math.min(3, BUZZ.length));
noRepeats("buzz", (k) => getTodaysBuzz(k, 1)[0].id, BUZZ.length);

// Hot or Not: deterministic, 5 distinct subjects per day, each normalized to the
// poll shape with EXACTLY the [hot, not] options, cycles the pool with no repeats.
check("hot-or-not deterministic", getTodaysHotOrNot(k0, 5).map((s) => s.id).join() === getTodaysHotOrNot(k0, 5).map((s) => s.id).join());
check("hot-or-not returns 5 distinct subjects", new Set(getTodaysHotOrNot(k0, 5).map((s) => s.id)).size === Math.min(5, HOT_OR_NOT.length));
{
  const badOpts = HOT_OR_NOT.filter((s) => {
    const ids = (s.options || []).map((o) => o.id).sort().join(",");
    return ids !== "hot,not";
  });
  check("hot-or-not subjects all have [hot,not] options", badOpts.length === 0,
    badOpts.length ? `bad: ${badOpts.map((s) => s.id).join(", ")}` : `${HOT_OR_NOT.length} subjects`);
}
noRepeats("hot-or-not", (k) => getTodaysHotOrNot(k, 1)[0].id, HOT_OR_NOT.length);

// On This Day: deterministic; date-KEYED (exact MM-DD match returns that md);
// no-match dates still return a non-null fallback; every entry is well-formed.
check("on-this-day deterministic", getOnThisDay(k0)?.id === getOnThisDay(k0)?.id);
{
  // A key whose MM-DD definitely exists in the seed list (use the first entry's md).
  const someMd = ON_THIS_DAY_ALL[0]?.md;
  const exactKey = someMd ? `2026-${someMd}` : null;
  check("on-this-day exact md match", !exactKey || getOnThisDay(exactKey)?.md === someMd,
    exactKey ? `${exactKey} → ${getOnThisDay(exactKey)?.md}` : "no seed");
  // A date no entry covers must still resolve (nearest-earlier fallback).
  check("on-this-day never blank on a no-match date", !!getOnThisDay("2026-02-29") || !!getOnThisDay("2026-12-31"));
  const MD = /^\d{2}-\d{2}$/;
  const bad = ON_THIS_DAY_ALL.filter(
    (e) => !e.id || !MD.test(e.md || "") || typeof e.year !== "number" ||
      !(e.no1Song || e.inTheaters || e.onTV)
  );
  check("on-this-day entries well-formed", bad.length === 0,
    bad.length ? `bad: ${bad.map((e) => e.id || "?").join(", ")}` : `${ON_THIS_DAY_ALL.length} dates`);
}

// ---- dev schedule window logic ----
check("window: before start is inactive", !isWithinWindow("2026-06-10", { from: "2026-06-12", days: 3 }));
check("window: start day is active", isWithinWindow("2026-06-12", { from: "2026-06-12", days: 3 }));
check("window: last day (days) is active", isWithinWindow("2026-06-14", { from: "2026-06-12", days: 3 }));
check("window: day after (days) is inactive", !isWithinWindow("2026-06-15", { from: "2026-06-12", days: 3 }));
check("window: until is inclusive", isWithinWindow("2026-06-20", { from: "2026-06-12", until: "2026-06-20" }));
check("window: past until is inactive", !isWithinWindow("2026-06-21", { from: "2026-06-12", until: "2026-06-20" }));
check("window: open-ended stays active", isWithinWindow("2030-01-01", { from: "2026-06-12" }));
check("window: missing from is inactive", !isWithinWindow(k0, {}));
{
  const sched = activeSchedule("news", k0);
  check(
    "activeSchedule returns {pinned,pool} arrays",
    Array.isArray(sched.pinned) && Array.isArray(sched.pool)
  );
}

console.log(`\n${failures === 0 ? "✓ all checks passed" : "✗ " + failures + " check(s) failed"}\n`);
process.exit(failures === 0 ? 0 : 1);
