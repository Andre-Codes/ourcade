import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthProvider.jsx";
import { isBadger, badgerReply, BADGER_NUMBER, BADGER_NAME } from "./badger.js";
import { lsGetJSON, lsSetJSON, recordRelic } from "./store.js";
import { relicById } from "../data/relics.js";
import PhoneChrome from "../components/PhoneChrome.jsx";
import PhoneOverlay from "../components/PhoneOverlay.jsx";
import DenCelebration from "../components/DenCelebration.jsx";

/* PhoneProvider — the always-on heart of the Nopia phone.

   It mounts ONCE at the app root (above <Routes>), so the live Firebase
   listeners run app-wide for any claimed account, on every page — not just
   while the phone is on screen. That's what makes a text feel real: it arrives
   (and rings / toasts / bumps the nav badge) wherever you are on Ourcade.

   The phone EMULATOR (the iframe) only exists on /phone; this provider holds no
   iframe. It owns: the 4 listeners (inbox/sent/contacts/pings), the live
   inbox/sent/contacts state, the "new arrival" ring/notify decision, the unread
   count, and the cloud ACTIONS (send/addcontact/ping/clearMessages/markRead) —
   which are just Firestore calls + number resolution and never need the iframe.
   Texting is open (no request/accept gate): a send goes straight to the
   recipient's inbox and both sides auto-add each other to NAMES. PhonePage is a
   thin adapter that renders the iframe and wires it to this context. Cloud is
   the source of truth; the phone (and this state) is a render cache. */

// Lazy, guarded cloud import (browser-only, same seam as scores.js/cloud users).
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null;
  if (!cloudPromise) cloudPromise = import("./cloud.js").catch(() => null);
  return cloudPromise;
}

// Byte Badger waits a beat before replying, so it feels like he's typing rather
// than answering instantly (no typing indicator — just the pause, then the ring).
const BADGER_REPLY_DELAY_MS = 5000;

const PhoneContext = createContext(null);
export const usePhone = () => useContext(PhoneContext);

export default function PhoneProvider({ children }) {
  const { username, profile, uid, isAnonymous, updateProfile } = useAuth() || {};
  const claimed = !!username && !isAnonymous;

  const [number, setNumber] = useState(profile?.number || null);
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [contacts, setContacts] = useState([]);
  // Monotonic-seq signals the page forwards to the iframe (in-phone ring) and
  // the chrome turns into a site-wide toast. seq lets a consumer fire only on a
  // genuinely-new bump (and skip the value that's already on screen at mount).
  const [lastIncoming, setLastIncoming] = useState({ seq: 0, message: null });
  const [lastPing, setLastPing] = useState({ seq: 0, fromNumber: "" });

  // Byte Badger — the built-in virtual contact. Its thread is LOCAL ONLY (not in
  // Firebase): texting it is intercepted in relaySend, the reply comes from the
  // pre-baked tree, and both turns are stored here. `badgerTick` bumps to
  // recompute the memoized inbox/sent merges (badgerRef is a ref so writes don't
  // re-render on their own). Persisted under ourcade:phone:badger.
  const badgerRef = useRef(lsGetJSON("phone:badger", []) || []);
  const [badgerTick, setBadgerTick] = useState(0);
  const bumpBadger = () => setBadgerTick((t) => t + 1);
  // Pending reply timers (Badger waits a beat before answering — see relaySend).
  const badgerTimers = useRef(new Set());
  useEffect(() => () => { badgerTimers.current.forEach(clearTimeout); badgerTimers.current.clear(); }, []);

  // Pop-up overlay open/close — pure state, no navigation, so whatever's behind
  // the phone (an in-progress game and all) stays mounted. The FAB/toast open it
  // and PhoneOverlay renders it above every route.
  const [open, setOpen] = useState(false);

  // Den relic celebration. Texting Badger "wassup" awards the relic immediately,
  // but the VISUAL is deferred to phone-close (the chat stays immersive; leaving
  // is the rewarding beat). `pendingRelicCele` is queued on award; closePhone
  // flushes it into `relicCele`, which renders the DenCelebration overlay.
  const [pendingRelicCele, setPendingRelicCele] = useState(null); // { relic, isNew } | null
  const [relicCele, setRelicCele] = useState(null);               // { relic, isNew } | null

  // Refs so actions + the inbox auto-add read the LATEST identity/contacts
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
      // Byte Badger (the NPC at 555-0001) is intercepted LOCALLY — never hits the
      // cloud. The outgoing text shows immediately; the reply lands after a short
      // pause (so he feels like he's typing). Rows carry the 555-0001 number and
      // "Byte Badger" name so this live chat threads with the daily Quarter texts.
      if (isBadger(to)) {
        if (!body || !String(body).trim()) return { ok: false, error: "EMPTY" };
        const now = Date.now();
        const mkId = () =>
          (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
          now + "-" + Math.floor(Math.random() * 1e6);
        // Phase 1 — echo the user's text right away.
        const sentRow = {
          id: mkId(), to: BADGER_NUMBER, toNumber: BADGER_NUMBER, toName: BADGER_NAME,
          body: String(body), ts: now, read: true,
        };
        // History captured NOW (including this line) so the reply is deterministic
        // w.r.t. send order even if several sends are pending at once.
        const history = badgerRef.current.map((t) => ({
          from: t.fromNumber === BADGER_NUMBER ? "badger" : "me", body: t.body, ts: t.ts,
        }));
        history.push({ from: "me", body: String(body), ts: now });
        badgerRef.current = [...badgerRef.current, sentRow];
        lsSetJSON("phone:badger", badgerRef.current);
        bumpBadger();
        // Phase 2 — after a beat, compute + deliver Badger's reply.
        const timer = setTimeout(() => {
          badgerTimers.current.delete(timer);
          let { text, awardRelic, alreadyText } = badgerReply(body, history);
          if (awardRelic) {
            const { isNew } = recordRelic(awardRelic);
            if (!isNew && alreadyText) text = alreadyText;
            // Queue the den reveal — it fires when the user closes the phone.
            const relic = relicById(awardRelic);
            if (relic) setPendingRelicCele({ relic, isNew });
          }
          const inRow = {
            id: mkId(), from: BADGER_NUMBER, fromNumber: BADGER_NUMBER, fromName: BADGER_NAME,
            body: text, ts: Date.now(), read: false,
          };
          badgerRef.current = [...badgerRef.current, inRow];
          lsSetJSON("phone:badger", badgerRef.current);
          bumpBadger();
          setLastIncoming({ seq: ++seqRef.current, message: inRow });
        }, BADGER_REPLY_DELAY_MS);
        badgerTimers.current.add(timer);
        return { ok: true, error: "MESSAGE SENT" };
      }
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
      // No gate: every text goes straight to the recipient's inbox.
      const res = await c
        .sendMessage(r.uid, body, meta, msgId)
        .catch(() => ({ delivered: false }));
      // Auto-add the recipient to our NAMES (both-ways: the recipient adds us on
      // receipt). Only for a genuinely-new correspondent — guarded so a repeat
      // text costs no extra read/write. The @handle path leaves r.number empty,
      // so resolve the canonical number + username from their public profile.
      if (res.delivered) {
        try {
          const known = r.number && contactsRef.current.some((x) => x.number === r.number);
          if (!known) {
            const pc = await c.readPublicContact(r.uid).catch(() => null);
            if (pc && pc.number && !contactsRef.current.some((x) => x.number === pc.number)) {
              await c.addContact(pc.name, pc.number).catch(() => {});
            }
          }
        } catch { /* auto-add is best-effort */ }
      }
      return { ok: true, error: res.delivered ? "MESSAGE SENT" : "NOT DELIVERED" };
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

    async function relayPing(to) {
      const c = await cloud();
      if (!c) return { ok: false, error: "OFFLINE" };
      const r = await resolveRecipient(c, to);
      if (r.error) return { ok: false, error: r.error };
      await c.sendPing(r.uid, { fromNumber: numberRef.current || "" }).catch(() => {});
      return { ok: true };
    }

    async function clearMessages() {
      const c = await cloud();
      if (!c) return { ok: false };
      const r = await c.clearMyMessages().catch(() => null);
      return { ok: !!r };
    }

    async function markRead(msgId) {
      // Badger messages aren't in Firebase, so cloud markRead can't clear them —
      // flip the local row directly or the unread badge would stick app-wide.
      const i = badgerRef.current.findIndex((m) => m.id === msgId);
      if (i >= 0) {
        if (!badgerRef.current[i].read) {
          badgerRef.current = badgerRef.current.map((m, j) => (j === i ? { ...m, read: true } : m));
          lsSetJSON("phone:badger", badgerRef.current);
          bumpBadger();
        }
        return { ok: true };
      }
      const c = await cloud();
      await c?.markRead?.(msgId).catch(() => {});
      return { ok: true };
    }

    return { relaySend, relayAddContact, relayPing, clearMessages, markRead };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, updateProfile]);

  // ── LISTENERS — the ONLY place the 4 message subscriptions ever run. ────────
  useEffect(() => {
    if (!claimed || !uid) {
      // Logged out / anonymous → clear any prior account's cached state.
      setInbox([]); setSent([]); setContacts([]);
      return;
    }

    let unsubInbox = () => {};
    let unsubSent = () => {};
    let unsubContacts = () => {};
    let unsubPings = () => {};

    // Ring/notify only for messages that arrive AFTER mount, never the opening
    // backlog (the first snapshot seeds `seen`; anything new after is a real
    // arrival). Because this provider is always mounted, the backlog is seeded
    // ONCE at login — so a message that lands while you're on any other page is
    // a post-firstInbox arrival and DOES notify.
    const seen = new Set();
    let firstInbox = true;
    let firstPing = true;
    const pingSeen = new Set();

    cloud().then((c) => {
      if (!c) return;
      // Auto-add the sender of an inbound text to our NAMES (both-ways: the
      // sender added us when they sent it). Idempotent + guarded so it only
      // writes for a number we don't already have. The inbox snapshot can land
      // before the contacts snapshot, so contactsRef may be momentarily empty —
      // worst case is one redundant write resolving to the same list (addContact
      // dedups by number), which is fine.
      const ensureContact = (r) => {
        const num = r.fromNumber || "";
        if (!num) return;
        if (contactsRef.current.some((x) => x.number === num)) return;
        c.addContact(r.fromName || num, num).catch(() => {});
      };

      unsubInbox = c.listenInbox((rows) => {
        setInbox(rows);
        // The first snapshot is the opening backlog — seed `seen` so it never
        // rings, but still populate NAMES from existing threads.
        if (firstInbox) {
          rows.forEach((r) => { seen.add(r.id); ensureContact(r); });
          firstInbox = false;
          return;
        }
        // Genuinely-new arrivals (dedup by `seen`): add the sender + ring.
        for (const r of rows) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          ensureContact(r);
          setLastIncoming({ seq: ++seqRef.current, message: r });
        }
      });

      unsubSent = c.listenSent((rows) => setSent(rows));

      unsubContacts = c.listenContacts((list) =>
        setContacts(Array.isArray(list) ? list : [])
      );

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
      unsubPings();
    };
  }, [claimed, uid]);

  // Fold the local Byte Badger live-chat thread into the cloud inbox/sent so it
  // shows in the phone alongside the (cloud) daily Quarter texts on the same
  // 555-0001 number. Plain concat — the iframe re-sorts each partition by
  // timestamp on every push (replacePartition in snake.html), so order here
  // doesn't matter. badgerRef only holds live-chat turns (never the Quarter
  // texts, which live in the cloud inbox), so no duplication. badgerTick drives
  // recompute (badgerRef is a ref).
  const mergedInbox = useMemo(
    () => [...inbox, ...badgerRef.current.filter((t) => t.fromNumber === BADGER_NUMBER)],
    [inbox, badgerTick]
  );
  const mergedSent = useMemo(
    () => [...sent, ...badgerRef.current.filter((t) => t.toNumber === BADGER_NUMBER)],
    [sent, badgerTick]
  );

  // Unread count — single source of truth for every badge (nav + fab). Includes
  // unread Badger replies so a reply bumps the badge like a real text.
  const unreadCount = useMemo(
    () => mergedInbox.filter((m) => !m.read).length,
    [mergedInbox]
  );

  // Stable open/close handlers for the pop-up overlay (FAB, toast, Escape, ✕).
  const overlay = useMemo(
    () => ({
      openPhone: () => setOpen(true),
      // Closing the phone flushes any queued den reveal into view.
      closePhone: () => {
        setOpen(false);
        setPendingRelicCele((p) => { if (p) setRelicCele(p); return null; });
      },
      togglePhone: () => setOpen((v) => !v),
    }),
    []
  );

  const value = useMemo(
    () => ({
      claimed,
      number,
      inbox: mergedInbox,
      sent: mergedSent,
      contacts,
      unreadCount,
      lastIncoming,
      lastPing,
      open,
      ...overlay,
      ...actions,
    }),
    [claimed, number, mergedInbox, mergedSent, contacts, unreadCount, lastIncoming, lastPing, open, overlay, actions]
  );

  return (
    <PhoneContext.Provider value={value}>
      {children}
      <PhoneChrome />
      <PhoneOverlay />
      {relicCele && (
        <DenCelebration
          relic={relicCele.relic}
          isNew={relicCele.isNew}
          onClose={() => setRelicCele(null)}
        />
      )}
    </PhoneContext.Provider>
  );
}
