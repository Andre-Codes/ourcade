/* ─────────────────────────────────────────────────────────────────────────
   STORE — the one place the daily layer touches persistence.
   Today this is synchronous localStorage (per-device), wrapped in try/catch
   exactly like Home's visitor odometer so private-mode / quota errors never
   crash a render. When accounts land (Supabase, Phase 2), this is the only file
   that changes: same function names, async bodies, real cross-device data.
   ───────────────────────────────────────────────────────────────────────── */

import { dayNumberFromKey } from "./daily.js";

const NS = "ourcade:";

function read(key) {
  try {
    return localStorage.getItem(NS + key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(NS + key, value);
  } catch {
    /* private mode / quota — ignore, the UI degrades gracefully */
  }
}
function readJSON(key, fallback) {
  const raw = read(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ---- daily poll: which option this device picked, per poll id ----
export function getPollVote(pollId) {
  return read(`poll:${pollId}`);
}
export function setPollVote(pollId, optionId) {
  write(`poll:${pollId}`, optionId);
}

// ---- quizzes: which result this device got, per quiz id ----
export function getQuizResult(quizId) {
  return read(`quiz:${quizId}`);
}
export function setQuizResult(quizId, resultId) {
  write(`quiz:${quizId}`, resultId);
}

// ---- visit streak: consecutive calendar days seen ----
// Idempotent within a day (safe under React StrictMode's double-mount): the
// first call for a new day advances the streak, repeat calls return it as-is.
export function recordVisit(today) {
  const prev = readJSON("streak", null);
  let streak = 1;
  let isNewDay = true;
  if (prev && prev.last) {
    if (prev.last === today) {
      streak = prev.streak || 1;
      isNewDay = false;
    } else {
      const gap = dayNumberFromKey(today) - dayNumberFromKey(prev.last);
      streak = gap === 1 ? (prev.streak || 0) + 1 : 1; // consecutive vs reset
    }
  }
  write(`streak`, JSON.stringify({ last: today, streak }));
  return { streak, isNewDay };
}
