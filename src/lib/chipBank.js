/* ─────────────────────────────────────────────────────────────────────────
   CASINO CHIP BANK — one ongoing balance shared by the cash-game cabinets
   (Video Poker + Blackjack), simulating a real bankroll that carries across
   sessions instead of resetting to a fresh stack every visit.

   Stored locally only (a single ourcade:casino:bank JSON blob via store.js — NOT
   in the cloud-sync set). `chips` is the live balance; `best` is the all-time
   high-water mark, which is what the leaderboards score on.

   Empty-bank rule: if you walk up broke (chips <= 0) we auto top you up to the
   starting stake so play never hard-stops — but `best` is untouched, so busting
   out can't pad your high score. ───────────────────────────────────────────── */

import { lsGetJSON, lsSetJSON } from "./store.js";

export const STARTING_STAKE = 100;
const KEY = "casino:bank";

function sanitize(raw) {
  const chips = Number.isFinite(raw?.chips) ? Math.floor(raw.chips) : STARTING_STAKE;
  const best = Number.isFinite(raw?.best) ? Math.floor(raw.best) : chips;
  return { chips, best: Math.max(best, chips) };
}

/* Read the bank. Auto tops a broke balance back up to the starting stake (and
   persists that), so a returning player always has chips to sit down with.
   `best` never drops. */
export function getBank() {
  const bank = sanitize(lsGetJSON(KEY, { chips: STARTING_STAKE, best: STARTING_STAKE }));
  if (bank.chips <= 0) {
    const topped = { chips: STARTING_STAKE, best: Math.max(bank.best, STARTING_STAKE) };
    lsSetJSON(KEY, topped);
    return topped;
  }
  return bank;
}

/* Write the live balance, advancing the all-time high-water mark. Returns the
   stored bank. Call after a hand settles / on exit. */
export function setBank(chips) {
  const cur = sanitize(lsGetJSON(KEY, { chips: STARTING_STAKE, best: STARTING_STAKE }));
  const next = {
    chips: Number.isFinite(chips) ? Math.max(0, Math.floor(chips)) : cur.chips,
    best: cur.best,
  };
  next.best = Math.max(next.best, next.chips);
  lsSetJSON(KEY, next);
  return next;
}

/* The leaderboard figure for the cash games: the highest balance ever held. */
export function bankBest() {
  return getBank().best;
}

/* Wipe the bank back to a fresh stake (dev / "start over" affordance). */
export function resetBank() {
  const fresh = { chips: STARTING_STAKE, best: STARTING_STAKE };
  lsSetJSON(KEY, fresh);
  return fresh;
}
