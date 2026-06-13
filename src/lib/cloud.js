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
  runTransaction,
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

/* ─── M2: the Nopia phone — personal numbers + real cross-user texting ────────
   Every claimed account gets a permanent Ourcade number rendered EXCH-XXXX. A
   number is just a monotonic integer n: exchange = 555 + floor(n/10000), slot =
   n % 10000 (zero-padded). The first 10k users get pretty 555-XXXX; past that
   the exchange extends (556-, 557-…) and it still reads as a normal number — so
   4 digits is never a real ceiling. Allocation runs in a transaction against a
   global counter (meta/phoneCounter) + a create-once reverse map (numbers/{num}),
   so numbers never collide. Texts are addressed by uid in the cloud; the UI
   speaks numbers/@handles and resolves them first. */

// A few slots we never want to hand out (look like real emergency/empty IDs).
const BLOCKED_SLOTS = new Set([0, 911, 411, 611]);

// n → "555-0142". exchange grows once a 10k block fills.
function formatNumber(n) {
  const exch = 555 + Math.floor(n / 10000);
  const slot = String(n % 10000).padStart(4, "0");
  return `${exch}-${slot}`;
}

// Normalize a user-typed number to the canonical "EXCH-XXXX" key (strip spaces,
// dots, parens; keep the hyphen). Returns "" if it doesn't look like a number.
export function normalizeNumber(raw) {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  if (digits.length < 7) return "";
  // last 4 = slot, the rest = exchange
  return `${digits.slice(0, digits.length - 4)}-${digits.slice(-4)}`;
}

// Resolve a number ("555-0142", any punctuation) → its uid, via numbers/{key}.
export async function resolveNumber(raw) {
  const key = normalizeNumber(raw);
  if (!key) return null;
  const snap = await getDoc(doc(db, "numbers", key));
  return snap.exists() ? snap.data().uid || null : null;
}

// Mint (or return the existing) permanent number for the current user. Idempotent:
// if the profile already carries a number we return it without touching the
// counter. Otherwise one transaction claims the next free slot, reserves
// numbers/{display}, bumps the counter, and stamps profiles/{uid}.number.
export async function allocateNumber() {
  const id = uid();
  if (!id) return null;
  // Fast path: already allocated.
  const prof = await getDoc(doc(db, "profiles", id));
  const existing = prof.exists() ? prof.data().number : null;
  if (existing) return existing;

  return runTransaction(db, async (tx) => {
    // Re-check inside the tx (another tab may have just allocated).
    const pRef = doc(db, "profiles", id);
    const pSnap = await tx.get(pRef);
    if (pSnap.exists() && pSnap.data().number) return pSnap.data().number;

    const cRef = doc(db, "meta", "phoneCounter");
    const cSnap = await tx.get(cRef);
    let n = (cSnap.exists() && cSnap.data().next) || 0;

    // Skip blocked slots and (paranoia) any already-taken display.
    let display = formatNumber(n);
    while (
      BLOCKED_SLOTS.has(n % 10000) ||
      (await tx.get(doc(db, "numbers", display))).exists()
    ) {
      n += 1;
      display = formatNumber(n);
    }

    tx.set(doc(db, "numbers", display), { uid: id, number: display });
    tx.set(cRef, { next: n + 1 }, { merge: true });
    tx.set(pRef, { number: display }, { merge: true });
    return display;
  });
}

// Send a text to `toUid`. Writes the canonical copy into the recipient's inbox
// and a mirror into the sender's own sent folder under one shared id, so SENT
// works without a fan-out query. `meta` carries { fromNumber, fromName } — the
// label the recipient renders. A failed sent-mirror is cosmetic (the delivery
// already landed). Returns the message id.
export async function sendMessage(toUid, body, meta = {}) {
  const id = uid();
  if (!id || !toUid || !body) return null;
  const msgId =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    Date.now() + "-" + Math.floor(Math.random() * 1e6);
  const base = {
    from: id,
    to: toUid,
    fromNumber: meta.fromNumber || "",
    fromName: meta.fromName || "",
    body: String(body),
    ts: serverTimestamp(),
    read: false,
  };
  await setDoc(doc(db, "messages", toUid, "inbox", msgId), base);
  // Mirror to the sender's sent folder (toNumber/toName label the recipient).
  setDoc(doc(db, "messages", id, "sent", msgId), {
    ...base,
    read: true,
    toNumber: meta.toNumber || "",
    toName: meta.toName || "",
  }).catch(() => {});
  return msgId;
}

// Live inbox for the current user, newest first. cb gets an array of message
// docs (each carrying its id). Returns the onSnapshot unsubscribe.
export function listenInbox(cb) {
  const id = uid();
  if (!id) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, "messages", id, "inbox"),
    orderBy("ts", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]) // permission/offline → empty, never throw
  );
}

// Live sent folder for the current user, newest first.
export function listenSent(cb) {
  const id = uid();
  if (!id) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, "messages", id, "sent"),
    orderBy("ts", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

// Flip one of the current user's inbox messages to read=true.
export async function markRead(msgId) {
  const id = uid();
  if (!id || !msgId) return;
  await setDoc(
    doc(db, "messages", id, "inbox", msgId),
    { read: true },
    { merge: true }
  );
}
