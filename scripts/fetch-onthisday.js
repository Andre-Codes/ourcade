/* ============================================================
   FETCH-ONTHISDAY — build-time fetcher for the 💧 Water Cooler's
   "On This Day" almanac. Pulls REAL, dated historical events for
   all 366 calendar days from the official Wikimedia "On This Day"
   REST feed and writes a static src/data/generated/onthisday.js so
   the page stays static + date-seeded at runtime (no browser fetch).

   Unlike the LLM pools, this is authoritative: every event is a real
   Wikipedia-sourced fact and ships with a working "read more" URL.

   Run:  npm run fetch:onthisday      (no API key needed — public feed)

   Feed:  https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/MM/DD
   Shape: { selected: [ { text, year, pages: [ { titles:{normalized},
           content_urls:{desktop:{page}}, type } ] } ] }
   ============================================================ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkUrls } from "./lib/validate-urls.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "src", "data", "generated");

const PER_DAY = 4; // events kept per calendar day (the feed's set is pre-curated)

// The Water Cooler is warm, PG-13, good-natured — so we skip the heavy/tragic
// events the encyclopedia feed surfaces (wars, bombings, crashes, disasters) and
// lead with the recognizable, lighter side of history: science, culture, sport,
// space, inventions, firsts. A day with only heavy events keeps one as a last
// resort (stated plainly), so the card is never blank.
// Stems matched at a word boundary (a leading \b but NO trailing one) so suffixed
// forms are caught too — "kidnap" → kidnapped, "bomb" → bombing/bomber, etc.
const HEAVY = new RegExp(
  "\\b(" +
    [
      // death & violence
      "kill", "death", "died", "dead", "deadly", "fatal", "fatalit",
      "murder", "slaughter", "lynch", "stab", "shot", "shoot", "gunfire",
      "gunman", "gunmen", "gunfight", "wound", "behead", "tortur", "rape",
      "suicid", "manslaughter", "homicide",
      // war, terror, conflict
      "war", "warfare", "battle", "combat", "troop", "attack", "terror",
      "bomb", "massacre", "genocide", "holocaust", "atrocit", "airstrike",
      "warhead", "nuclear", "militia", "militant", "insurgen", "rebellion",
      "rebel", "uprising", "revolt", "siege", "warlord", "militar", "warship",
      // political violence / instability
      "assassinat", "coup", "overthrow", "overthrew", "junta", "dictator",
      "execution", "executed", "hostage", "kidnap", "abduct", "hijack",
      "riot", "unrest", "protest", "crackdown", "deport", "invasion",
      "invad", "occupation", "occupied", "crisis", "raid",
      // disasters
      "crash", "earthquake", "hurricane", "tsunami", "flood", "famine",
      "wildfire", "explos", "explode", "detonat", "disaster", "tragedy",
      "tragic", "victim", "casualt", "sank", "sinking", "shipwreck",
      "derail", "plague", "epidemic", "pandemic", "outbreak", "wreck",
      "collapse", "catastroph",
    ].join("|") +
    ")",
  "i"
);
const FEED = (mm, dd) =>
  `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${mm}/${dd}`;
// Wikimedia asks API clients to identify themselves with a descriptive UA.
const UA =
  "OurcadeOnThisDay/1.0 (https://theourcade.com; arcade content build) node-fetch";

// Days per month for a leap year (so Feb 29 is included → all 366 days).
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad = (n) => String(n).padStart(2, "0");

// Every "MM-DD" of a leap year, in calendar order.
function allDates() {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= DAYS_IN_MONTH[m - 1]; d++) out.push([pad(m), pad(d)]);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch one date's feed with a couple of retries (the API occasionally 429s).
async function fetchDay(mm, dd, { retries = 3 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(FEED(mm, dd), {
        headers: { "user-agent": UA, accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`http ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(500 * attempt);
    }
  }
  return null;
}

// Pick the best source page for an event: the first standard (non-disambiguation)
// page, preferring one whose normalized title actually appears in the event text.
function pickPage(event) {
  const pages = (event.pages || []).filter((p) => p?.type !== "disambiguation");
  if (!pages.length) return null;
  const inText = pages.find((p) => {
    const t = p?.titles?.normalized;
    return t && event.text && event.text.includes(t);
  });
  const p = inText || pages[0];
  const url = p?.content_urls?.desktop?.page;
  const title = p?.titles?.normalized;
  if (!url || !title) return null;
  return { url, title };
}

// One feed payload → up to PER_DAY normalized events, newest year first (more
// recognizable), each carrying a real Wikipedia source. Heavy/tragic events are
// held back and only used to fill out a day that would otherwise be too thin —
// the Water Cooler's register is warm and light, not an atrocity ledger.
function toEvents(data) {
  const selected = Array.isArray(data?.selected) ? data.selected : [];
  const all = selected
    .map((ev) => {
      const year = Number(ev.year);
      const text = String(ev.text || "").trim();
      const page = pickPage(ev);
      if (!Number.isFinite(year) || !text || !page) return null;
      return { year, text, source: page.url, sourceTitle: page.title };
    })
    .filter(Boolean)
    .sort((a, b) => b.year - a.year);

  const light = all.filter((e) => !HEAVY.test(e.text));
  const heavy = all.filter((e) => HEAVY.test(e.text));
  // Lead with the light events; if a day has fewer than two, top up from the
  // heavy pile so the card still has substance (rare — most days have plenty).
  const picked = light.slice(0, PER_DAY);
  if (picked.length < 2) picked.push(...heavy.slice(0, 2 - picked.length));
  return picked.slice(0, PER_DAY);
}

function writeModule(entries) {
  const banner =
    `// AUTO-GENERATED by scripts/fetch-onthisday.js — do not edit by hand.\n` +
    `// On-This-Day almanac, sourced from the Wikimedia "On This Day" feed.\n` +
    `// Shape: { id, md, events:[{ year, text, source, sourceTitle }] } — source urls liveness-checked.\n`;
  fs.writeFileSync(
    path.join(OUT_DIR, "onthisday.js"),
    `${banner}export default ${JSON.stringify(entries, null, 2)};\n`
  );
  const events = entries.reduce((n, e) => n + e.events.length, 0);
  console.log(`  wrote src/data/generated/onthisday.js (${entries.length} days, ${events} events)`);
}

async function main() {
  console.log("Fetching the On-This-Day almanac from Wikimedia (366 days)…");
  const dates = allDates();
  const byDate = [];

  // Sequential with a small delay — polite to the public API and plenty fast
  // for a once-a-month build (366 light JSON requests).
  for (const [mm, dd] of dates) {
    let data = null;
    try {
      data = await fetchDay(mm, dd);
    } catch (e) {
      console.warn(`  ${mm}-${dd}: fetch failed (${e.message}) — skipping`);
    }
    const events = data ? toEvents(data) : [];
    if (events.length) byDate.push({ md: `${mm}-${dd}`, events });
    else console.warn(`  ${mm}-${dd}: no usable events`);
    await sleep(120);
  }

  // Liveness-check every source url at once; strip dead ones, drop now-empty days.
  const allUrls = byDate.flatMap((d) => d.events.map((e) => e.source));
  console.log(`  checking ${allUrls.length} source urls…`);
  const results = await checkUrls(allUrls, { concurrency: 8 });
  let dead = 0;
  const entries = byDate
    .map((d) => {
      const events = d.events.filter((e) => {
        const r = results.get(e.source);
        if (r?.alive) return true;
        dead++;
        return false;
      });
      return { id: `otd-${d.md.replace("-", "")}`, md: d.md, events };
    })
    .filter((d) => d.events.length);

  console.log(`  ${dead} dead url(s) stripped; ${entries.length}/366 days populated`);

  // Sanity floor: a near-complete almanac is expected. If we got almost nothing,
  // something went wrong upstream — keep the previous pool rather than clobber it.
  if (entries.length < 300) {
    console.error(
      `\n✗ only ${entries.length} days populated (<300) — writing nothing, keeping the previous pool`
    );
    process.exitCode = 1;
    return;
  }

  writeModule(entries);
  console.log("\n✓ done");
}

main().catch((e) => {
  console.error(`\n✗ fetch-onthisday failed: ${e.message}`);
  process.exitCode = 1;
});
