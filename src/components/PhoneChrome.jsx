import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePhone } from "../lib/PhoneProvider.jsx";

/* PhoneChrome — the site-wide presence of the phone. Rendered once by
   PhoneProvider, so it's present on every route. Two pieces:

   • PhoneFab — a floating 📱 button with an unread badge, so you can pop the
     phone up (and see you have unread texts) from anywhere. It opens the
     overlay IN PLACE (no navigation), so whatever you were doing — including an
     in-progress game — stays mounted behind it. Hidden on Home (its nav already
     has the icon) and while the overlay is already open.
   • PhoneToast — a brief "new text from X" banner when a message/ping arrives
     while the phone isn't on screen. Clicking it opens the phone overlay.

   Old-web on purpose: a toast + a badge, no OS notification permission prompt. */

// Friendly label for a sender: their saved contact name, else the number/name
// the message carries, else "SOMEONE".
function senderLabel(contacts, msg) {
  if (!msg) return "SOMEONE";
  const num = msg.fromNumber || msg.from || "";
  const c = contacts.find((x) => x.number === num);
  return (c && c.name) || msg.fromName || num || "SOMEONE";
}

function PhoneFab({ unreadCount, onOpen }) {
  return (
    <button
      type="button"
      className="arcade-phone-fab"
      aria-label="open your phone"
      onClick={onOpen}
    >
      <span aria-hidden="true">📱</span>
      {unreadCount > 0 && (
        <span className="arcade-phone-fab-badge">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

function PhoneToast({ text, onOpen }) {
  if (!text) return null;
  return (
    <button type="button" className="arcade-phone-toast" onClick={onOpen} role="status">
      {text}
    </button>
  );
}

export default function PhoneChrome() {
  const phone = usePhone() || {};
  const {
    claimed,
    unreadCount = 0,
    contacts = [],
    lastIncoming,
    lastPing,
    open,
    openPhone,
  } = phone;
  const { pathname } = useLocation();

  const [toast, setToast] = useState(null);

  // Fire a toast on a genuinely-new arrival (seq bump), but only when the phone
  // isn't already on screen (the overlay is open, or we're on the /phone page —
  // there the emulator rings/toasts itself).
  const onPhonePage = pathname === "/phone";
  // While a game is being played (/play/:id), keep the FAB off so it never
  // covers the play surface. The toast is still allowed through.
  const onGamePage = pathname.startsWith("/play/");
  const phoneVisible = open || onPhonePage;
  const incomingSeq = lastIncoming?.seq || 0;
  const pingSeq = lastPing?.seq || 0;

  useEffect(() => {
    if (!incomingSeq || phoneVisible) return;
    setToast(`📱 new text from ${senderLabel(contacts, lastIncoming.message)}`);
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSeq]);

  useEffect(() => {
    if (!pingSeq || phoneVisible) return;
    setToast(`📱 ping from ${lastPing.fromNumber || "?"}`);
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pingSeq]);

  // Clear any lingering toast the moment the phone comes on screen.
  useEffect(() => {
    if (phoneVisible) setToast(null);
  }, [phoneVisible]);

  if (!claimed) return null;

  return (
    <>
      {!phoneVisible && pathname !== "/" && !onGamePage && (
        <PhoneFab unreadCount={unreadCount} onOpen={openPhone} />
      )}
      {!phoneVisible && <PhoneToast text={toast} onOpen={openPhone} />}
    </>
  );
}
