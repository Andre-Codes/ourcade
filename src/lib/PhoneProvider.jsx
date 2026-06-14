import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthProvider.jsx";
import PhoneChrome from "../components/PhoneChrome.jsx";

/* PhoneProvider — the always-on heart of the Nopia phone.

   It mounts ONCE at the app root (above <Routes>), so the live Firebase
   listeners run app-wide for any claimed account, on every page — not just
   while the phone is on screen. That's what makes a text feel real: it arrives
   (and rings / toasts / bumps the nav badge) wherever you are on Ourcade.

   The phone EMULATOR (the iframe) only exists on /phone; this provider holds no
   iframe. It owns: the 5 listeners, the live inbox/sent/requests/contacts
   state, the "new arrival" ring/notify decision, the unread count, and the
   cloud ACTIONS (send/accept/addcontact/ping/decline/markRead) — which are just
   Firestore calls + number resolution and never need the iframe. PhonePage is a
   thin adapter that renders the iframe and wires it to this context. Cloud is
   the source of truth; the phone (and this state) is a render cache. */

// Lazy, guarded cloud import (browser-only, same seam as scores.js/cloud users).
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null;
  if (!cloudPromise) cloudPromise = import("./cloud.js").catch(() => null);
  return cloudPromise;
}

const PhoneContext = createContext(null);
export const usePhone = () => useContext(PhoneContext);

export default function PhoneProvider({ children }) {
  const { username, profile, uid, isAnonymous, updateProfile } = useAuth() || {};
  const claimed = !!username && !isAnonymous;

  const [number, setNumber] = useState(profile?.number || null);
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [requests, setRequests] = useState([]);
  const [contacts, setContacts] = useState([]);
  // Monotonic-seq signals the page forwards to the iframe (in-phone ring) and
  // the chrome turns into a site-wide toast. seq lets a consumer fire only on a
  // genuinely-new bump (and skip the value that's already on screen at mount).
  const [lastIncoming, setLastIncoming] = useState({ seq: 0, message: null });
  const [lastPing, setLastPing] = useState({ seq: 0, fromNumber: "" });

  // Refs so actions + the accept reconciler read the LATEST identity/contacts
  // without forcing the listener effect to re-subscribe (it keys on [claimed,
  // uid] only). Kept fresh by the syncing effect just below.
  const numberRef = useRef(number);
  const usernameRef = useRef(username);
  const contactsRef = useRef(contacts);
  const seqRef = useRef(0);
  useEffect(() => { numberRef.current = number; }, [number]);
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  // Keep local number in sync if the profile resolves it after mount.
  useEffect(() => {
    if (profile?.number) setNumber(profile.number);
  }, [profile?.number]);

  // Ensure this account actually has a number (covers the just-claimed race and
  // any pre-M2 account that hasn't been backfilled yet).
  useEffect(() => {
    if (!claimed || number) return;
    let alive = true;
    (async () => {
      const c = await cloud();
      const n = c ? await c.allocateNumber().catch(() => null) : null;
      if (alive && n) {
        setNumber(n);
        updateProfile?.({ number: n }).catch?.(() => {});
      }
    })();
    return () => { alive = false; };
  }, [claimed, number, updateProfile]);

  // ── ACTIONS (pure cloud calls; no iframe). Each returns { ok, error }. ──────
  const inContacts = (num) =>
    !!num && contactsRef.current.some((c) => c.number === num);

  // Resolve a typed recipient ("555-0142" or "@handle") → { uid, number } or
  // { error }.
  async function resolveRecipient(c, to) {
    const raw = String(to || "").trim();
    if (!raw) return { error: "NO NUMBER" };
    let toUid = null;
    let num = "";
    if (raw.startsWith("@")) {
      toUid = await c.resolveUsername(raw.slice(1)).catch(() => null);
    } else {
      num = c.normalizeNumber(raw) || "";
      toUid = await c.resolveNumber(raw).catch(() => null);
      if (!toUid) toUid = await c.resolveUsername(raw).catch(() => null); // bare handle
    }
    if (!toUid) return { error: "NO SUCH NUMBER" };
    if (toUid === uid) return { error: "THAT IS YOU" };
    return { uid: toUid, number: num };
  }

  const actions = useMemo(() => {
    async function relaySend(to, body) {
      const c = await cloud();
      if (!c || !body || !String(body).trim()) return { ok: false, error: "EMPTY" };
      const r = await resolveRecipient(c, to);
      if (r.error) return { ok: false, error: r.error };
      const meta = {
        fromNumber: numberRef.current || "",
        fromName: usernameRef.current || "",
        toNumber: r.number || "",
        toName: String(to).startsWith("@") ? String(to).slice(1) : "",
      };
      // Pre-generate the id so we can echo an optimistic SENT row under the SAME
      // id the cloud will use — when the real listenSent snapshot arrives it
      // supersedes the optimistic row cleanly (no duplicate, no flicker), and it
      // paints within a frame instead of after the round-trip.
      const msgId =
        (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
        Date.now() + "-" + Math.floor(Math.random() * 1e6);
      const optimistic = {
        id: msgId,
        from: uid,
        to: r.uid,
        body: String(body),
        fromNumber: meta.fromNumber,
        fromName: meta.fromName,
        toNumber: meta.toNumber,
        toName: meta.toName,
        ts: Date.now(), // plain number → sorts newest until serverTimestamp resolves
        read: true,
      };
      setSent((prev) =>
        prev.some((m) => m.id === msgId) ? prev : [optimistic, ...prev]
      );
      // Already a contact → straight to their inbox. Not yet → a REQUEST they
      // must accept (which swaps contacts both ways).
      const known = inContacts(r.number);
      const res = known
        ? await c.sendMessage(r.uid, body, meta, msgId).catch(() => ({ delivered: false }))
        : await c.sendRequest(r.uid, body, meta, msgId).catch(() => ({ delivered: false }));
      if (!res.delivered) return { ok: true, error: "NOT DELIVERED" };
      return { ok: true, error: known ? "MESSAGE SENT" : "REQUEST SENT" };
    }

    async function relayAddContact(name, num) {
      const c = await cloud();
      if (!c) return { ok: false, error: "OFFLINE" };
      const key = c.normalizeNumber(num) || "";
      // Only let a real member's number into NAMES.
      const owner = key ? await c.resolveNumber(key).catch(() => null) : null;
      if (!owner) return { ok: false, error: "NO SUCH NUMBER" };
      await c.addContact(name, key).catch(() => {});
      return { ok: true };
    }

    async function relayAccept(d) {
      const c = await cloud();
      if (!c) return { ok: false, error: "OFFLINE" };
      // The accept swaps contacts both ways: A is told to add us back via an
      // accept-signal carrying OUR number. If our number hasn't resolved yet
      // (just-claimed race), allocate it now so the signal isn't empty.
      let myNumber = numberRef.current;
      if (!myNumber) {
        myNumber = await c.allocateNumber().catch(() => null);
        if (myNumber) {
          setNumber(myNumber);
          updateProfile?.({ number: myNumber }).catch?.(() => {});
        }
      }
      await c
        .acceptRequest(
          { id: d.reqId, from: d.from, fromNumber: d.fromNumber, fromName: d.fromName, body: d.body },
          { name: usernameRef.current || "", number: myNumber || "" }
        )
        .catch(() => {});
      return { ok: true };
    }

    async function relayPing(to) {
      const c = await cloud();
      if (!c) return { ok: false, error: "OFFLINE" };
      const r = await resolveRecipient(c, to);
      if (r.error) return { ok: false, error: r.error };
      await c.sendPing(r.uid, { fromNumber: numberRef.current || "" }).catch(() => {});
      return { ok: true };
    }

    async function decline(reqId) {
      const c = await cloud();
      await c?.declineRequest?.(reqId).catch(() => {});
      return { ok: true };
    }

    async function markRead(msgId) {
      const c = await cloud();
      await c?.markRead?.(msgId).catch(() => {});
      return { ok: true };
    }

    return { relaySend, relayAddContact, relayAccept, relayPing, decline, markRead };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, updateProfile]);

  // ── LISTENERS — the ONLY place the 5 message subscriptions ever run. ────────
  useEffect(() => {
    if (!claimed || !uid) {
      // Logged out / anonymous → clear any prior account's cached state.
      setInbox([]); setSent([]); setRequests([]); setContacts([]);
      return;
    }

    let unsubInbox = () => {};
    let unsubSent = () => {};
    let unsubContacts = () => {};
    let unsubRequests = () => {};
    let unsubPings = () => {};

    // Ring/notify only for messages that arrive AFTER mount, never the opening
    // backlog (the first snapshot seeds `seen`; anything new after is a real
    // arrival). Because this provider is always mounted, the backlog is seeded
    // ONCE at login — so a message that lands while you're on any other page is
    // a post-firstInbox arrival and DOES notify.
    const seen = new Set();
    const accepted = new Set(); // accept-signal ids already reconciled into NAMES
    let firstInbox = true;
    let firstPing = true;
    const pingSeen = new Set();

    cloud().then((c) => {
      if (!c) return;
      unsubInbox = c.listenInbox((rows) => {
        // Accept-signals are reconciled here (not shown as normal texts): when
        // A accepted us / we accepted A, the counterparty added us back via an
        // inbox doc — add them to our NAMES and mark it read. Dedup by `seen`.
        for (const r of rows) {
          if (r.kind === "accept" && !accepted.has(r.id)) {
            const swapNum = r.swapNumber || r.fromNumber;
            // Only reconcile (and mark handled) once it carries a real number —
            // an empty one would no-op addContact and silently drop the swap. A
            // corrected/late signal still gets a chance on a later snapshot.
            if (swapNum) {
              accepted.add(r.id);
              c.addContact(r.swapName || r.fromName, swapNum).catch(() => {});
              c.markRead(r.id).catch(() => {});
            }
          }
        }
        setInbox(rows);
        // The first snapshot is the opening backlog — seed `seen` so it never
        // rings. After that, any id not in `seen` is a genuinely-new arrival.
        if (firstInbox) { rows.forEach((r) => seen.add(r.id)); firstInbox = false; return; }
        // Ring on genuinely-new arrivals only (dedup purely by `seen`).
        // Accept-signals notify too — they read as "NOW A CONTACT".
        for (const r of rows) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          setLastIncoming({ seq: ++seqRef.current, message: r });
        }
      });

      unsubSent = c.listenSent((rows) => setSent(rows));

      unsubContacts = c.listenContacts((list) =>
        setContacts(Array.isArray(list) ? list : [])
      );

      unsubRequests = c.listenRequests((rows) => setRequests(rows));

      // Pings: signal each genuinely-new one, then delete it (notify-only).
      unsubPings = c.listenPings((rows) => {
        if (firstPing) {
          // Clear any backlog silently so opening the app doesn't ring-storm.
          rows.forEach((r) => { pingSeen.add(r.id); c.deletePing(r.id).catch(() => {}); });
          firstPing = false;
          return;
        }
        for (const r of rows) {
          if (pingSeen.has(r.id)) continue;
          pingSeen.add(r.id);
          setLastPing({ seq: ++seqRef.current, fromNumber: r.fromNumber || "" });
          c.deletePing(r.id).catch(() => {});
        }
      });
    });

    return () => {
      unsubInbox();
      unsubSent();
      unsubContacts();
      unsubRequests();
      unsubPings();
    };
  }, [claimed, uid]);

  // Unread count — single source of truth for every badge (nav + fab). Exclude
  // accept-signal rows (auto-read reconciler signals, not messages); count
  // requests (they still need an ACCEPT).
  const unreadCount = useMemo(
    () =>
      inbox.filter((m) => !m.read && m.kind !== "accept").length + requests.length,
    [inbox, requests]
  );

  const value = useMemo(
    () => ({
      claimed,
      number,
      inbox,
      sent,
      requests,
      contacts,
      unreadCount,
      lastIncoming,
      lastPing,
      ...actions,
    }),
    [claimed, number, inbox, sent, requests, contacts, unreadCount, lastIncoming, lastPing, actions]
  );

  return (
    <PhoneContext.Provider value={value}>
      {children}
      <PhoneChrome />
    </PhoneContext.Provider>
  );
}
