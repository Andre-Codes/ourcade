import { useEffect, useRef } from "react";
import { useAuth } from "../lib/AuthProvider.jsx";
import { usePhone } from "../lib/PhoneProvider.jsx";
import { useArcadeScore } from "../lib/scores.js";
import BackBar from "./BackBar.jsx";

/* PhonePage — the dedicated, full-page Nopia. It embeds the same emulator the
   public Snake cabinet uses (public/games/snake.html) with ?personal=1, and is
   a THIN ADAPTER between the always-on PhoneProvider context and that sandboxed
   iframe: the iframe can't import Firebase, so PhoneProvider holds the live
   listeners and this page just relays context → iframe (identity + snapshots +
   ring signals) and iframe → context (send/accept/addcontact/ping/read/decline).

   It holds NO Firestore listeners — that's the provider's job, app-wide. So a
   text that arrives while you're elsewhere has already rung/toasted via the
   provider; landing here just renders the live state. */

export default function PhonePage() {
  const { uid, username } = useAuth() || {};
  const phone = usePhone() || {};
  const {
    claimed,
    number,
    inbox,
    sent,
    requests,
    contacts,
    lastIncoming,
    lastPing,
    relaySend,
    relayAddContact,
    relayAccept,
    relayPing,
    decline,
    markRead,
  } = phone;

  const iframeRef = useRef(null);
  const { submit } = useArcadeScore("snake");

  // Latest context values in refs so the (stable) message handler + identity
  // sender always read fresh data without re-binding listeners.
  const stateRef = useRef({});
  stateRef.current = { uid, username, number, inbox, sent, requests, contacts };
  const actionsRef = useRef({});
  actionsRef.current = { relaySend, relayAddContact, relayAccept, relayPing, decline, markRead, submit };

  const post = (msg) => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage(msg, window.location.origin);
  };
  const postIdentity = () => {
    const s = stateRef.current;
    post({ type: "nopia:identity", uid: s.uid, number: s.number, username: s.username });
  };

  // ── Bridge: identity handshake + inbound iframe messages → context actions ──
  useEffect(() => {
    if (!claimed) return;

    const onMessage = async (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      const a = actionsRef.current;

      if (d.type === "nopia:hello") {
        postIdentity();
        // Push the current snapshots right away so a freshly-loaded phone fills in.
        const s = stateRef.current;
        post({ type: "nopia:contacts", contacts: s.contacts });
        post({ type: "nopia:inbox", messages: s.inbox });
        post({ type: "nopia:sent", messages: s.sent });
        post({ type: "nopia:requests", messages: s.requests });
      } else if (d.type === "ourcade:score" && d.gameId === "snake") {
        const n = Number(d.score);
        if (!Number.isNaN(n)) a.submit(n);
      } else if (d.type === "nopia:read") {
        a.markRead(d.msgId);
      } else if (d.type === "nopia:send") {
        const r = await a.relaySend(d.to, d.body);
        post({ type: "nopia:sendresult", ok: r.ok, error: r.error });
      } else if (d.type === "nopia:addcontact") {
        const r = await a.relayAddContact(d.name, d.number);
        post({ type: "nopia:reqresult", ok: r.ok, error: r.error });
      } else if (d.type === "nopia:accept") {
        const r = await a.relayAccept(d);
        post({ type: "nopia:reqresult", ok: r.ok, error: r.error });
      } else if (d.type === "nopia:decline") {
        a.decline(d.reqId);
      } else if (d.type === "nopia:ping") {
        const r = await a.relayPing(d.to);
        post({ type: "nopia:reqresult", ok: r.ok, error: r.error });
      }
    };

    window.addEventListener("message", onMessage);
    // Push identity proactively too (in case the iframe loaded before this
    // effect mounted and its hello was missed).
    const idTimer = setTimeout(postIdentity, 300);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(idTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimed]);

  // Re-push identity whenever the number resolves/changes (late backfill).
  useEffect(() => { if (claimed) postIdentity(); /* eslint-disable-next-line */ }, [number, username, uid, claimed]);

  // Relay context snapshots to the iframe whenever they change.
  useEffect(() => { post({ type: "nopia:contacts", contacts: contacts || [] }); }, [contacts]);
  useEffect(() => { post({ type: "nopia:inbox", messages: inbox || [] }); }, [inbox]);
  useEffect(() => { post({ type: "nopia:sent", messages: sent || [] }); }, [sent]);
  useEffect(() => { post({ type: "nopia:requests", messages: requests || [] }); }, [requests]);

  // Forward genuinely-new arrivals as in-phone ring/toast — but skip the value
  // already present at mount (the provider already toasted it elsewhere; we
  // don't want a replay ring just for navigating here).
  const firstIncoming = useRef(true);
  const firstPing = useRef(true);
  useEffect(() => {
    if (!lastIncoming?.seq) return;
    if (firstIncoming.current) { firstIncoming.current = false; return; }
    post({ type: "nopia:incoming", message: lastIncoming.message });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastIncoming?.seq]);
  useEffect(() => {
    if (!lastPing?.seq) return;
    if (firstPing.current) { firstPing.current = false; return; }
    post({ type: "nopia:incoming-ping", fromNumber: lastPing.fromNumber });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPing?.seq]);

  if (!claimed) {
    return (
      <div className="arcade-stage">
        <BackBar />
        <div className="arcade-phone-gate">
          <p className="arcade-account-blurb">
            📱 claim an account to get your own Ourcade number and a phone you can text other members with.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="arcade-stage">
      <BackBar />
      <div className="arcade-phone arcade-phone--page">
        <p className="arcade-phone-number">
          📱 your number: <b>{number || "…"}</b>
        </p>
        <div className="arcade-phone-stage arcade-phone-stage--full">
          <iframe
            ref={iframeRef}
            className="arcade-iframe"
            src={import.meta.env.BASE_URL + "games/snake.html?personal=1"}
            title="Your Nopia phone"
            allow="autoplay; fullscreen; gamepad"
          />
        </div>
      </div>
    </div>
  );
}
