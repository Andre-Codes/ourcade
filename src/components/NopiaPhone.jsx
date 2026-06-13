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

    // Only ring for messages that arrive AFTER mount, never the opening backlog.
    const mountedAt = Date.now();
    const seen = new Set();
    let firstInbox = true;

    let unsubInbox = () => {};
    let unsubSent = () => {};

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
      }
    };

    async function relaySend(to, body) {
      const c = await cloud();
      if (!c || !body || !String(body).trim()) return;
      const raw = String(to || "").trim();
      let toUid = null;
      if (raw.startsWith("@")) toUid = await c.resolveUsername(raw.slice(1)).catch(() => null);
      else {
        toUid = await c.resolveNumber(raw).catch(() => null);
        if (!toUid) toUid = await c.resolveUsername(raw).catch(() => null); // bare handle
      }
      if (!toUid) { post({ type: "nopia:sendresult", ok: false, error: "NO SUCH NUMBER" }); return; }
      if (toUid === uid) { post({ type: "nopia:sendresult", ok: false, error: "THAT IS YOU" }); return; }
      await c.sendMessage(toUid, body, {
        fromNumber: number || "",
        fromName: username || "",
        toNumber: c.normalizeNumber(raw) || "",
        toName: raw.startsWith("@") ? raw.slice(1) : "",
      }).catch(() => {});
      post({ type: "nopia:sendresult", ok: true });
    }

    window.addEventListener("message", onMessage);

    // Push identity proactively too (in case the iframe loaded before we mounted
    // the listener and its hello was missed).
    const idTimer = setTimeout(sendIdentity, 300);

    cloud().then((c) => {
      if (!c) return;
      unsubInbox = c.listenInbox((rows) => {
        post({ type: "nopia:inbox", messages: rows });
        if (firstInbox) { rows.forEach((r) => seen.add(r.id)); firstInbox = false; return; }
        // Ring on genuinely-new arrivals only.
        for (const r of rows) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          const ms = r.ts?.toMillis ? r.ts.toMillis() : (r.ts?.seconds ? r.ts.seconds * 1000 : Date.now());
          if (ms >= mountedAt) post({ type: "nopia:incoming", message: r });
        }
      });
      unsubSent = c.listenSent((rows) => post({ type: "nopia:sent", messages: rows }));
    });

    return () => {
      clearTimeout(idTimer);
      window.removeEventListener("message", onMessage);
      unsubInbox();
      unsubSent();
    };
  }, [claimed, uid, number, username, submit]);

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
