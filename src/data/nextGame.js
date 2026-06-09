/* ─────────────────────────────────────────────────────────────────────────
   NEXT-GAME ROADMAP VOTE  ·  a standing, always-visible vote (NOT daily rotation)

   "What genre should join Ourcade next?" — a pinned fixture in the daily band.
   Hand-edit the options below; ids must stay stable so saved votes keep their
   meaning. Unlike daily polls this question never rotates away.

   FIREBASE SEAM: the vote itself rides the same store.js getPollVote/setPollVote
   the daily polls use (namespaced under "poll:next-game-genre"), so persistence
   swaps to Firebase in one place. nextGameTally is the only other swap point —
   today it's an honest-fake count; later it becomes real Firestore tallies.
   ───────────────────────────────────────────────────────────────────────── */

import { daySeed, dayNumberFromKey } from "../lib/daily.js";

export const NEXT_GAME_VOTE = {
  id: "next-game-genre",
  question: "What genre should join Ourcade next?",
  options: [
    { id: "platformer", label: "🏃 Platformer" },
    { id: "racing", label: "🏎️ Racing" },
    { id: "tower-defense", label: "🏰 Tower Defense" },
    { id: "shooter", label: "🔫 Shooter" },
    { id: "rhythm", label: "🎵 Rhythm" },
    { id: "deckbuilder", label: "🃏 Deckbuilder" },
  ],
};

// No backend yet: build a believable per-option count that's STABLE over time
// (unlike the daily poll's tally, the base seed omits the day key so the split
// doesn't jump around). A gentle, deterministic growth term keyed to the day
// number makes the totals tick up over time so it reads as "accumulating",
// then this device's real vote adds +1. Swapped for true counts with Firebase.
export function nextGameTally(myVote, key = "") {
  const day = key ? dayNumberFromKey(key) : 0;
  const counts = NEXT_GAME_VOTE.options.map((o) => {
    const base = 120 + (daySeed(`next-game:${o.id}`) % 880); // 120..999, fixed per option
    const growth = Math.floor((daySeed(`next-game-rate:${o.id}`) % 6) * day); // slow daily creep
    const count = base + growth + (myVote === o.id ? 1 : 0);
    return { id: o.id, label: o.label, count };
  });
  const total = counts.reduce((s, c) => s + c.count, 0) || 1;
  return counts.map((c) => ({ ...c, pct: Math.round((c.count / total) * 100) }));
}
