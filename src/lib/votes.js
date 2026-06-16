/* votes — shared client-side poll/vote helpers (the browser-only Firebase seam).
   Lifted out of DailyBand.jsx so any voting UI (the daily poll, the next-game
   roadmap vote, the Water Cooler's Hot-or-Not) drives the SAME live shared
   tallies without duplicating the cloud wiring. Every poll-shaped thing — an id
   plus options: [{ id, label }] — writes to polls/{id} in Firestore. */

import { useEffect, useState } from "react";

// Lazy, guarded cloud import (browser-only seam, same as scores.js/store.js).
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null;
  if (!cloudPromise) cloudPromise = import("./cloud.js").catch(() => null);
  return cloudPromise;
}

// Live shared counts for a poll id ({} until the first vote anywhere). Drives
// the REAL tally bars; updates as other people vote.
export function usePollCounts(pollId) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (!pollId) return undefined;
    let unsub = null;
    let alive = true;
    const p = cloud();
    if (p)
      p.then((c) => {
        if (!alive || !c) return;
        unsub = c.listenPoll(pollId, (m) => alive && setCounts(m || {}));
      }).catch(() => {});
    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, [pollId]);
  return counts;
}

// Fire a shared +1 for an option (browser-only, fire-and-forget).
export function castVote(pollId, optionId) {
  const p = cloud();
  if (p) p.then((c) => c && c.votePoll(pollId, optionId)).catch(() => {});
}
