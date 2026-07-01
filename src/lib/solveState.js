/* solveState — tiny persistence for "Solve This" puzzle completions, so a solved
   card can show a ✓ badge in the Action Lab grid. Runtime-only (touches
   localStorage), so it lives in src/lib/ rather than the node-pure src/data/ layer.

   A completion is stored as a timestamp under ourcade:solve:done:<id> and treated
   as "recently solved" for one week. No explicit reset job — the age check makes
   the badge self-expire, so a puzzle you solved a week ago invites a fresh attempt. */

import { lsGetJSON, lsSetJSON } from "./store.js";

const KEY = (id) => `solve:done:${id}`;
export const SOLVE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // one week

// Mark a puzzle solved now (idempotent — always refreshes the timestamp).
export function markSolved(id) {
  if (!id) return;
  lsSetJSON(KEY(id), Date.now());
}

// True if this puzzle was solved within the last week.
export function isSolvedRecently(id) {
  if (!id) return false;
  const ts = lsGetJSON(KEY(id), null);
  return typeof ts === "number" && Date.now() - ts < SOLVE_TTL_MS;
}
