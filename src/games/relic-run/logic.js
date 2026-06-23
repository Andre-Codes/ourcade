/* DAILY RUN — pure puzzle logic.

   No React, no DOM: the same module decides the day's start/target and grades a
   run for BOTH the playable cabinet (RelicRun.jsx) and the headless verifier
   (scripts/relic-run-check.js), exactly like quarter/logic.js is shared with the
   Quarter texter. That guarantees the daily check measures the SAME puzzle every
   player gets.

   The challenge rotates off the date seed (daySeed + mulberry32 from daily.js),
   so every device walks the identical RNG sequence and lands on the same
   start/target for a given local day — a shared Wordle-style ritual. */

import { daySeed, mulberry32, dayNumberFromKey } from "../../lib/daily.js";
import { RELIC_NODES, RELIC_NODE_IDS } from "../../data/relicNodes.js";

// A salt unique to this feature so its rotation is independent of every other
// daily pick (Quarter, polls, quizzes…). Folded into the per-day seed string.
const RELIC_SALT = "ourcade-relic-run";

// Desired daily route length (clicks = path edges). The current 100-node graph
// is dense (max shortest-path = 5), so in practice this yields mostly par-4 runs
// with the occasional par-5 — a good "few hops, no slog" feel. MAX is generous
// headroom for when the graph grows; the picker just needs SOME in-range pair.
export const MIN_CLICKS = 4;
export const MAX_CLICKS = 6;

// 1-based "Run #" for display/sharing, anchored at the site's launch day so the
// number reads small and human (#1, #2, …) rather than a huge epoch int. Matches
// quarterNumber's approach in quarter/logic.js.
const EPOCH_KEY = "2026-06-01";
export function runNumber(dayKey) {
  return dayNumberFromKey(dayKey) - dayNumberFromKey(EPOCH_KEY) + 1;
}

// Node lookup. The data export is already an id→node map (frozen), so this is a
// direct index — no array scan.
export function node(id) {
  return RELIC_NODES[id];
}

// Humanize the raw era slug for display. The data uses one slug for every node
// ("late-1990s-to-mid-2000s"); rendered in the pixel/mono font its trailing "s"
// reads like a "5" ("…2000s" looks like "…20005"). Convert decade slugs to
// apostrophe form and join with an en-dash so it reads naturally and loses the
// 5/s ambiguity, e.g. "late '90s – mid 2000s". Falls back to the raw value for
// any future era we don't have a rule for.
export function prettyEra(era) {
  if (!era) return "";
  const part = (s) =>
    s
      .replace(/-/g, " ")
      .replace(/\b19(\d0)s\b/g, "’$1s") // 1990s → ’90s
      .trim();
  return era.split("-to-").map(part).join(" – ");
}

// BFS shortest path over node.links. Returns an array of ids start→target
// (inclusive of both ends), or null if unreachable. Edges are directed (we only
// follow `links`), though the supplied graph happens to be near-symmetric.
export function shortestPath(startId, targetId) {
  if (startId === targetId) return [startId];
  if (!RELIC_NODES[startId] || !RELIC_NODES[targetId]) return null;
  const queue = [[startId]];
  const visited = new Set([startId]);
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    for (const next of RELIC_NODES[current].links) {
      if (next === targetId) return [...path, next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

/* The deterministic daily challenge for a local day key ("YYYY-MM-DD").

   Walk a date-seeded RNG, drawing start/target pairs until one resolves to a
   shortest path whose click count lands in [MIN_CLICKS, MAX_CLICKS]. Because the
   RNG sequence is identical on every device for a given day, everyone gets the
   same puzzle. Returns { dateKey, start, target, optimalPath, par }.

   Mirrors the design doc's pickDailyChallenge but reuses daySeed/mulberry32 from
   daily.js instead of inlining its own copies. */
export function dailyChallenge(dayKey) {
  const rng = mulberry32(daySeed(`${RELIC_SALT}-${dayKey}`));
  const ids = RELIC_NODE_IDS;

  for (let attempt = 0; attempt < 1000; attempt++) {
    const start = ids[Math.floor(rng() * ids.length)];
    const target = ids[Math.floor(rng() * ids.length)];
    if (start === target) continue;
    const path = shortestPath(start, target);
    if (!path) continue;
    const par = path.length - 1;
    if (par >= MIN_CLICKS && par <= MAX_CLICKS) {
      return { dateKey: dayKey, start, target, optimalPath: path, par };
    }
  }

  // No-throw policy: never crash the cabinet in front of a player. Fall back to
  // the first in-range pair in stable id order (still fully deterministic). The
  // check script asserts the RNG path never actually falls through to here, so a
  // sparse graph surfaces as a CI failure rather than a silent fallback.
  return fallbackChallenge(dayKey);
}

function fallbackChallenge(dayKey) {
  const ids = RELIC_NODE_IDS;
  for (const start of ids) {
    for (const target of ids) {
      if (start === target) continue;
      const path = shortestPath(start, target);
      if (!path) continue;
      const par = path.length - 1;
      if (par >= MIN_CLICKS && par <= MAX_CLICKS) {
        return { dateKey: dayKey, start, target, optimalPath: path, par, fallback: true };
      }
    }
  }
  // Absolute last resort: any two distinct connected nodes.
  for (const start of ids) {
    for (const target of ids) {
      if (start === target) continue;
      const path = shortestPath(start, target);
      if (path) {
        return { dateKey: dayKey, start, target, optimalPath: path, par: path.length - 1, fallback: true };
      }
    }
  }
  return null;
}

// A rating tier for the win screen, based on how close the run was to par.
export function rating(clicks, par) {
  if (clicks <= par) return "Perfect Route";
  if (clicks <= par + 2) return "Solid Surf";
  if (clicks <= par + 5) return "Scenic Route";
  return "Lost in the Webring";
}

// Streak milestones. Returns a celebratory line when `streak` (consecutive days
// completed) hits a milestone, else null — so the win screen only shouts on the
// days that earned it. Pure: no React, no storage.
const STREAK_MILESTONES = {
  3: "🔥 3-day streak! You're a regular now.",
  7: "🔥 7 days straight — a full week of runs!",
  30: "🔥 30-day streak. The old web salutes you.",
  100: "🔥 100 days. You ARE the webring.",
};
export function streakMilestone(streak) {
  return STREAK_MILESTONES[streak] || null;
}

// Win-screen share block. Par stays HIDDEN until here (no par/hints during play),
// so the share text is the first place a player learns the optimal length.
export function shareText(dayKey, clicks, par) {
  const n = runNumber(dayKey);
  const mice = "🖱️".repeat(Math.min(Math.max(clicks, 1), 12));
  return [
    `Ourcade Web Run #${n}`,
    `Found the page in ${clicks} click${clicks === 1 ? "" : "s"}.`,
    `Par: ${par}`,
    mice,
    `No popups survived.`,
  ].join("\n");
}
