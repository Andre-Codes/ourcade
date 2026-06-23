/* ─────────────────────────────────────────────────────────────────────────
   NEXT-GAME ROADMAP VOTE  ·  a standing, always-visible vote (NOT daily rotation)

   "What genre should join Ourcade next?" — a pinned fixture in the daily band.
   Hand-edit the options below; ids must stay stable so saved votes keep their
   meaning. Unlike daily polls this question never rotates away.

   FIREBASE: the vote is REAL & shared. It rides the same store.js
   getPollVote/setPollVote local gate the daily polls use (one-per-device,
   namespaced "poll:next-game-genre") AND cloud.votePoll/listenPoll against the
   shared counter doc polls/next-game-genre. nextGameRealTally merges the live
   shared counts with a modest seed so the roadmap reads as established.
   ───────────────────────────────────────────────────────────────────────── */

import { daySeed } from "../lib/daily.js";

export const NEXT_GAME_VOTE = {
  // Bump this id to reset the vote: it invalidates the one-per-device local gate
  // (everyone gets to vote again) and points at a fresh, empty shared counter doc
  // (polls/<id>). v2 reset — added "classic" and "puzzle".
  id: "next-game-genre-v2",
  question: "What genre should join Ourcade next?",
  options: [
    { id: "platformer", label: "🏃 Platformer" },
    { id: "racing", label: "🏎️ Racing" },
    { id: "tower-defense", label: "🏰 Tower Defense" },
    { id: "shooter", label: "🔫 Shooter" },
    { id: "rhythm", label: "🎵 Rhythm" },
    { id: "deckbuilder", label: "🃏 Deckbuilder" },
    { id: "classic", label: "🕹️ Classic" },
    { id: "puzzle", label: "🧩 Puzzle" },
  ],
};

// A modest fixed per-option seed (20..59) so the standing roadmap vote reads as
// already-running, not a fresh poll. Real shared votes accumulate on top.
function nextGameSeed(optionId) {
  return 20 + (daySeed(`next-game:${optionId}`) % 40); // 20..59, fixed per option
}

// REAL tally: live shared counts (polls/next-game-genre.counts) + the seed.
export function nextGameRealTally(counts = {}) {
  const rows = NEXT_GAME_VOTE.options.map((o) => ({
    id: o.id,
    label: o.label,
    count: nextGameSeed(o.id) + (Number(counts?.[o.id]) || 0),
  }));
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return rows.map((r) => ({ ...r, pct: Math.round((r.count / total) * 100) }));
}
