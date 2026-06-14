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
  deleteDoc,
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

/* ─── M2.5: synced NAMES (contacts) ──────────────────────────────────────────
   A user's phonebook lives as a JSON string on the private per-account `state`
   map (users/{uid}.state['nopia:contacts']) — reuses writeState/readState, so
   no new collection or rule. Shape: [{ name, number }] with `number` the
   canonical "555-XXXX". The JENNY/OURCADE built-ins stay iframe-local; only
   real, swapped/added contacts sync here. */

const CONTACTS_KEY = "nopia:contacts";

function parseContacts(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((c) => c && c.number) : [];
  } catch {
    return [];
  }
}

// Read the current (or given) user's synced contacts ([] if none).
export async function readContacts(forUid) {
  const state = await readState(forUid);
  return parseContacts(state[CONTACTS_KEY]);
}

// Overwrite the contact list (already-merged) for the current user.
export async function writeContacts(list) {
  await writeState(CONTACTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

// Live contact list for the current user. Returns the onSnapshot unsubscribe.
export function listenContacts(cb) {
  const id = uid();
  if (!id) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    doc(db, "users", id),
    (snap) => cb(parseContacts(snap.exists() && snap.data().state?.[CONTACTS_KEY])),
    () => cb([])
  );
}

// Add (or update the name of) a contact, keyed by canonical number. Idempotent —
// re-adding the same number just refreshes the name, so accept replays are safe.
export async function addContact(name, number) {
  const key = normalizeNumber(number);
  if (!key) return;
  const list = await readContacts();
  const i = list.findIndex((c) => c.number === key);
  if (i >= 0) list[i] = { name: name || list[i].name || key, number: key };
  else list.push({ name: name || key, number: key });
  await writeContacts(list);
}

/* ─── M2.5: request / accept (the mutual contact swap) ────────────────────────
   A first text to someone NOT already in your contacts is a REQUEST: it lands
   in messages/{toUid}/requests instead of their inbox and waits for ACCEPT.
   On accept the recipient (B) drops the text into their own inbox, adds the
   sender (A) to their contacts, and signals A — through A's inbox (the only
   channel B is allowed to write) — to add B back. */

// Write a request to `toUid` (+ a sent mirror so the sender sees it under SENT).
export async function sendRequest(toUid, body, meta = {}) {
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
  await setDoc(doc(db, "messages", toUid, "requests", msgId), base);
  setDoc(doc(db, "messages", id, "sent", msgId), {
    ...base,
    read: true,
    toNumber: meta.toNumber || "",
    toName: meta.toName || "",
  }).catch(() => {});
  return msgId;
}

// Live REQUESTS folder for the current user, newest first.
export function listenRequests(cb) {
  const id = uid();
  if (!id) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, "messages", id, "requests"),
    orderBy("ts", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

// Drop a request (DECLINE, or after accepting it).
export async function declineRequest(reqId) {
  const id = uid();
  if (!id || !reqId) return;
  await deleteDoc(doc(db, "messages", id, "requests", reqId)).catch(() => {});
}

// Tell `toUid` (A) to add us back as a contact — via a doc in A's inbox carrying
// kind:'accept' + our swap label. A's inbox listener reconciles it.
export async function sendAcceptSignal(toUid, meta = {}) {
  const id = uid();
  if (!id || !toUid) return;
  const msgId =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    Date.now() + "-a" + Math.floor(Math.random() * 1e6);
  await setDoc(doc(db, "messages", toUid, "inbox", msgId), {
    from: id,
    to: toUid,
    kind: "accept",
    fromNumber: meta.swapNumber || "",
    fromName: meta.swapName || "",
    swapName: meta.swapName || "",
    swapNumber: meta.swapNumber || "",
    body: `${meta.swapName || "Someone"} added you`,
    ts: serverTimestamp(),
    read: false,
  }).catch(() => {});
}

// Accept a request (B's side). `me` = { name, number } for the accepting user.
// Adds the sender (A) to B's contacts, lands the text in B's inbox attributed to
// A (from:A, to:B) so it threads + replies correctly, signals A to add B back,
// then deletes the request.
export async function acceptRequest(req, me = {}) {
  const id = uid();
  if (!id || !req) return;
  await addContact(req.fromName, req.fromNumber);
  const inboxId =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    Date.now() + "-i" + Math.floor(Math.random() * 1e6);
  await setDoc(doc(db, "messages", id, "inbox", inboxId), {
    from: req.from || id,
    to: id,
    fromNumber: req.fromNumber || "",
    fromName: req.fromName || "",
    body: String(req.body || ""),
    ts: serverTimestamp(),
    read: false,
  }).catch(() => {});
  await sendAcceptSignal(req.from, { swapName: me.name, swapNumber: me.number });
  await declineRequest(req.id);
}

/* ─── M2.5: ping (notify-only poke) ──────────────────────────────────────────
   Dialing a number + Call writes a tiny ping doc into the owner's pings folder.
   Their client rings, shows "PING FROM <number>", then deletes it — no thread,
   no unread, no accept. */

export async function sendPing(toUid, meta = {}) {
  const id = uid();
  if (!id || !toUid) return;
  const pingId =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    Date.now() + "-p" + Math.floor(Math.random() * 1e6);
  await setDoc(doc(db, "messages", toUid, "pings", pingId), {
    from: id,
    to: toUid,
    fromNumber: meta.fromNumber || "",
    kind: "ping",
    ts: serverTimestamp(),
  });
}

// Live pings for the current user. The caller rings each new one then deletes it.
export function listenPings(cb) {
  const id = uid();
  if (!id) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, "messages", id, "pings"),
    orderBy("ts", "desc"),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

export async function deletePing(pingId) {
  const id = uid();
  if (!id || !pingId) return;
  await deleteDoc(doc(db, "messages", id, "pings", pingId)).catch(() => {});
}
