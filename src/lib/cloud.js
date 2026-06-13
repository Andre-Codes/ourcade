/* ─────────────────────────────────────────────────────────────────────────
   CLOUD — the Firestore side of the per-user state sync, kept in its own
   module so store.js can pull it in via a guarded dynamic import (browser
   only). Node / daily-check never load this, so the data layer stays pure.

   Per-user synced state lives as a `state` map on the user's profile doc:
     users/{uid} = { username?, email?, createdAt?, state: { <key>: <rawString> } }
   where <key> is the bare store.js key (e.g. "poll:abc", "streak") and
   <rawString> is exactly what localStorage holds (we mirror it verbatim so
   there's no (de)serialization drift). One doc = one read to hydrate, cheap
   field-path writes per change.
   ───────────────────────────────────────────────────────────────────────── */

import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
} from "firebase/firestore";

function uid() {
  return auth.currentUser?.uid || null;
}

// Write a single state key (deep-merges, leaving other keys untouched).
export async function writeState(key, raw) {
  const id = uid();
  if (!id) return;
  await setDoc(doc(db, "users", id), { state: { [key]: raw } }, { merge: true });
}

// Write several at once (used to push local-only keys up after hydrate).
export async function writeMany(map) {
  const id = uid();
  if (!id || !map || !Object.keys(map).length) return;
  await setDoc(doc(db, "users", id), { state: map }, { merge: true });
}

// Read the user's whole state map ({} if none yet).
export async function readState(forUid) {
  const id = forUid || uid();
  if (!id) return {};
  const snap = await getDoc(doc(db, "users", id));
  return (snap.exists() && snap.data().state) || {};
}

/* ─── M1: the Arcade Score Standard ──────────────────────────────────────────
   Per-game boards live at scores/{gameId}/entries/{uid}. Each user owns one
   entry per game; the rules enforce monotonic, owner-only, username-required
   writes, so the caller only writes when the new score actually beats the old
   (asc/desc per the game's config) to avoid bouncing off the "can't decrease"
   rule. */

// Write (or raise) this user's entry on a board. `entry` carries
// { uid, username, avatar, score } — `at` is stamped server-side.
export async function writeScore(gameId, entry) {
  const id = uid();
  if (!id) return;
  await setDoc(
    doc(db, "scores", gameId, "entries", id),
    { ...entry, uid: id, at: serverTimestamp() },
    { merge: true }
  );
}

// Read this user's own entry for a board (null if none yet) — used to decide
// whether a fresh score is actually an improvement before writing.
export async function readScore(gameId, forUid) {
  const id = forUid || uid();
  if (!id) return null;
  const snap = await getDoc(doc(db, "scores", gameId, "entries", id));
  return snap.exists() ? snap.data() : null;
}

// Live top-N for a board. `dir` is "asc" (lower better) or "desc" (default).
// Returns the onSnapshot unsubscribe fn; cb gets an array of entry objects.
export function listenLeaderboard(gameId, dir, n, cb) {
  const q = query(
    collection(db, "scores", gameId, "entries"),
    orderBy("score", dir === "asc" ? "asc" : "desc"),
    limit(n || 10)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data())),
    () => cb([]) // permission/offline → empty board, never throw
  );
}

/* ─── M1: public profiles ───────────────────────────────────────────────────
   profiles/{uid} is the PUBLIC face of an account (avatar/theme/bio/favorites).
   Distinct from the private users/{uid} doc (email + synced state). */

// Read any user's public profile (null if none).
export async function readProfile(forUid) {
  const id = forUid || uid();
  if (!id) return null;
  const snap = await getDoc(doc(db, "profiles", id));
  return snap.exists() ? snap.data() : null;
}

// Merge a patch into the current user's public profile (stamps updatedAt).
export async function writeProfile(patch) {
  const id = uid();
  if (!id || !patch) return;
  await setDoc(
    doc(db, "profiles", id),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Resolve a username (any case) → its uid, via the public usernames map.
export async function resolveUsername(name) {
  const key = (name || "").trim().toLowerCase();
  if (!key) return null;
  const snap = await getDoc(doc(db, "usernames", key));
  return snap.exists() ? snap.data().uid || null : null;
}

/* ─── M1.5: real shared polls ────────────────────────────────────────────────
   polls/{pollId} = { counts: { <optionId>: number } }. A vote does a single +1
   increment on one option; results are read live so every visitor sees the same
   real tally. Anyone signed in (incl. anonymous) may vote (rules-guarded shape;
   one-per-device enforced client-side). */

// Cast a vote: +1 to this option's count. Creates the doc on the first ever vote.
export async function votePoll(pollId, optionId) {
  if (!pollId || !optionId) return;
  await setDoc(
    doc(db, "polls", pollId),
    { counts: { [optionId]: increment(1) } },
    { merge: true }
  );
}

// Live counts map for a poll ({} until the first vote). Returns the unsubscribe.
export function listenPoll(pollId, cb) {
  return onSnapshot(
    doc(db, "polls", pollId),
    (snap) => cb((snap.exists() && snap.data().counts) || {}),
    () => cb({}) // permission/offline → empty, never throw
  );
}
