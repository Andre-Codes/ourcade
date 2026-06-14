import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/AuthProvider.jsx";
import { useArcadeScore } from "../lib/scores.js";

/* NopiaPhone — your PERSONAL Nokia, wired to your real Ourcade identity. It
   embeds the same emulator the public Snake cabinet uses (public/games/snake.html)
   but with ?personal=1, and acts as the bridge between that sandboxed iframe and
   Firebase: the iframe can't import the SDK (it's a static file), so THIS
   component holds the live inbox/sent listeners and relays everything over
   postMessage. Cloud is the source of truth; the phone is a render cache.

   Only claimed accounts get a phone (a number + an inbox), matching the
   boards-are-claimed-only stance — anonymous guests see a claim nudge instead. */

// Lazy, guarded cloud import (browser-only, same seam as scores.js/ProfileView).
let cloudPromise = null;
function cloud() {
  if (typeof window === "undefined") return null;
  if (!cloudPromise) cloudPromise = import("../lib/cloud.js").catch(() => null);
  return cloudPromise;
}

export default function NopiaPhone() {
  const { username, profile, uid, isAnonymous, updateProfile } = useAuth() || {};
  const iframeRef = useRef(null);
  const [number, setNumber] = useState(profile?.number || null);
  const claimed = !!username && !isAnonymous;

  // Snake high scores still count from the personal phone (same bridge GamePage
  // uses for the public cabinet).
  const { submit } = useArcadeScore("snake");

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

  // The bridge: identity handshake + live inbox/sent listeners + send/read relay.
  useEffect(() => {
    if (!claimed || !uid) return;

    const post = (msg) => {
      const win = iframeRef.current?.contentWindow;
      if (win) win.postMessage(msg, window.location.origin);
    };
    const sendIdentity = () => post({ type: "nopia:identity", uid, number, username });

    // Only ring for messages that arrive AFTER mount, never the opening backlog
    // (the first snapshot seeds `seen`; anything new after is a real arrival).
    const seen = new Set();
    const accepted = new Set();   // accept-signal ids already reconciled into NAMES
    let firstInbox = true;

    let unsubInbox = () => {};
    let unsubSent = () => {};
    let unsubContacts = () => {};
    let unsubRequests = () => {};
    let unsubPings = () => {};

    // Cached synced contact list (numbers), so send routing (inbox vs request)
    // is a local check, not an extra read per send.
    let myContacts = [];
    const inContacts = (num) => !!num && myContacts.some((c) => c.number === num);
    const me = () => ({ name: username || "", number: number || "" });

    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;

      if (d.type === "nopia:hello") {
        sendIdentity();
      } else if (d.type === "ourcade:score" && d.gameId === "snake") {
        const s = Number(d.score);
        if (!Number.isNaN(s)) submit(s);
      } else if (d.type === "nopia:read") {
        cloud().then((c) => c?.markRead?.(d.msgId)).catch(() => {});
      } else if (d.type === "nopia:send") {
        relaySend(d.to, d.body);
      } else if (d.type === "nopia:addcontact") {
        relayAddContact(d.name, d.number);
      } else if (d.type === "nopia:accept") {
        relayAccept(d);
      } else if (d.type === "nopia:decline") {
        cloud().then((c) => c?.declineRequest?.(d.reqId)).catch(() => {});
      } else if (d.type === "nopia:ping") {
        relayPing(d.to);
      }
    };

    // Resolve a typed recipient ("555-0142" or "@handle") → uid. Returns
    // { uid, number } or an error string.
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

    async function relaySend(to, body) {
      const c = await cloud();
      if (!c || !body || !String(body).trim()) return;
      const r = await resolveRecipient(c, to);
      if (r.error) { post({ type: "nopia:sendresult", ok: false, error: r.error }); return; }
      const meta = {
        fromNumber: number || "",
        fromName: username || "",
        toNumber: r.number || "",
        toName: String(to).startsWith("@") ? String(to).slice(1) : "",
      };
      // Already a contact → straight to their inbox. Not yet → a REQUEST that
      // they must accept (which swaps contacts both ways).
      if (inContacts(r.number)) {
        await c.sendMessage(r.uid, body, meta).catch(() => {});
        post({ type: "nopia:sendresult", ok: true, error: "MESSAGE SENT" });
      } else {
        await c.sendRequest(r.uid, body, meta).catch(() => {});
        post({ type: "nopia:sendresult", ok: true, error: "REQUEST SENT" });
      }
    }

    async function relayAddContact(name, num) {
      const c = await cloud();
      if (!c) return;
      const key = c.normalizeNumber(num) || "";
      // Only let a real member's number into NAMES.
      const owner = key ? await c.resolveNumber(key).catch(() => null) : null;
      if (!owner) { post({ type: "nopia:reqresult", ok: false, error: "NO SUCH NUMBER" }); return; }
      await c.addContact(name, key).catch(() => {});
    }

    async function relayAccept(d) {
      const c = await cloud();
      if (!c) return;
      // The accept swaps contacts both ways: A is told to add us back via an
      // accept-signal that carries OUR number. If our number hasn't resolved yet
      // (just-claimed race), allocate it now so the signal isn't empty — an empty
      // swapNumber would make A's addContact no-op and break reciprocity.
      let myNumber = number;
      if (!myNumber) {
        myNumber = await c.allocateNumber().catch(() => null);
        if (myNumber) { setNumber(myNumber); updateProfile?.({ number: myNumber }).catch?.(() => {}); }
      }
      await c.acceptRequest(
        { id: d.reqId, from: d.from, fromNumber: d.fromNumber, fromName: d.fromName, body: d.body },
        { name: username || "", number: myNumber || "" }
      ).catch(() => {});
      post({ type: "nopia:reqresult", ok: true });
    }

    async function relayPing(to) {
      const c = await cloud();
      if (!c) return;
      const r = await resolveRecipient(c, to);
      if (r.error) { post({ type: "nopia:reqresult", ok: false, error: r.error }); return; }
      await c.sendPing(r.uid, { fromNumber: number || "" }).catch(() => {});
    }

    window.addEventListener("message", onMessage);

    // Push identity proactively too (in case the iframe loaded before we mounted
    // the listener and its hello was missed).
    const idTimer = setTimeout(sendIdentity, 300);

    cloud().then((c) => {
      if (!c) return;
      unsubInbox = c.listenInbox((rows) => {
        // Accept-signals are reconciled here (not shown as normal texts): when A
        // accepted us / we accepted A, the counterparty added us back via an
        // inbox doc — add them to our NAMES and mark it read. Dedup by `seen`.
        for (const r of rows) {
          if (r.kind === "accept" && !accepted.has(r.id)) {
            const swapNum = r.swapNumber || r.fromNumber;
            // Only reconcile (and mark this signal handled) once it carries a real
            // number — an empty one would no-op addContact and silently drop the
            // swap. A corrected/late signal still gets a chance on a later snapshot.
            if (swapNum) {
              accepted.add(r.id);
              c.addContact(r.swapName || r.fromName, swapNum).catch(() => {});
              c.markRead(r.id).catch(() => {});
            }
          }
        }
        post({ type: "nopia:inbox", messages: rows });
        // The first snapshot is the opening backlog — seed `seen` so it never
        // rings. After that, any id not in `seen` is a genuinely-new arrival.
        if (firstInbox) { rows.forEach((r) => seen.add(r.id)); firstInbox = false; return; }
        // Ring on genuinely-new arrivals only. We dedup purely by `seen` (not a
        // wall-clock vs mountedAt compare, which dropped rings when a message's
        // serverTimestamp resolved a hair before the client clock / under skew).
        // Accept-signals ring too — snake.html shows them as "NOW A CONTACT".
        for (const r of rows) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          post({ type: "nopia:incoming", message: r });
        }
      });
      unsubSent = c.listenSent((rows) => post({ type: "nopia:sent", messages: rows }));

      // Synced contacts → relay to the iframe AND cache for send routing.
      unsubContacts = c.listenContacts((list) => {
        myContacts = Array.isArray(list) ? list : [];
        post({ type: "nopia:contacts", contacts: myContacts });
      });

      // Pending requests → REQUESTS folder in the iframe.
      unsubRequests = c.listenRequests((rows) => post({ type: "nopia:requests", messages: rows }));

      // Pings: ring each genuinely-new one, then delete it (notify-only, no thread).
      let firstPing = true;
      const pingSeen = new Set();
      unsubPings = c.listenPings((rows) => {
        if (firstPing) {
          // Clear any backlog silently so opening the phone doesn't ring-storm.
          rows.forEach((r) => { pingSeen.add(r.id); c.deletePing(r.id).catch(() => {}); });
          firstPing = false;
          return;
        }
        for (const r of rows) {
          if (pingSeen.has(r.id)) continue;
          pingSeen.add(r.id);
          post({ type: "nopia:incoming-ping", fromNumber: r.fromNumber || "" });
          c.deletePing(r.id).catch(() => {});
        }
      });
    });

    return () => {
      clearTimeout(idTimer);
      window.removeEventListener("message", onMessage);
      unsubInbox();
      unsubSent();
      unsubContacts();
      unsubRequests();
      unsubPings();
    };
  }, [claimed, uid, number, username, submit, updateProfile]);

  if (!claimed) {
    return (
      <div className="arcade-phone-gate">
        <p className="arcade-account-blurb">
          📱 claim an account to get your own Ourcade number and a phone you can text other members with.
        </p>
      </div>
    );
  }

  return (
    <div className="arcade-phone">
      <p className="arcade-phone-number">
        📱 your number: <b>{number || "…"}</b>
      </p>
      <div className="arcade-phone-stage">
        <iframe
          ref={iframeRef}
          className="arcade-iframe"
          src={import.meta.env.BASE_URL + "games/snake.html?personal=1"}
          title="Your Nopia phone"
          allow="autoplay; fullscreen; gamepad"
        />
      </div>
    </div>
  );
}
