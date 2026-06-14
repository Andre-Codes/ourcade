import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePhone } from "../lib/PhoneProvider.jsx";

/* PhoneChrome — the site-wide presence of the phone. Rendered once by
   PhoneProvider, so it's present on every route. Two pieces:

   • PhoneFab — a floating 📱 button with an unread badge, so you can jump to the
     phone (and see you have unread texts) from anywhere. Hidden on Home (its nav
     already has the icon) and on /phone (you're already there).
   • PhoneToast — a brief "new text from X" banner when a message/ping arrives
     while you're NOT on /phone (on /phone the Nokia rings instead — single
     notify). Clicking it opens the phone.

   Old-web on purpose: a toast + a badge, no OS notification permission prompt. */

// Friendly label for a sender: their saved contact name, else the number/name
// the message carries, else "SOMEONE".
function senderLabel(contacts, msg) {
  if (!msg) return "SOMEONE";
  const num = msg.fromNumber || msg.from || "";
  const c = contacts.find((x) => x.number === num);
  return (c && c.name) || msg.fromName || num || "SOMEONE";
}

function PhoneFab({ unreadCount }) {
  return (
    <Link to="/phone" className="arcade-phone-fab" aria-label="open your phone">
      <span aria-hidden="true">📱</span>
      {unreadCount > 0 && (
        <span className="arcade-phone-fab-badge">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

function PhoneToast({ text }) {
  if (!text) return null;
  return (
    <Link to="/phone" className="arcade-phone-toast" role="status">
      {text}
    </Link>
  );
}

export default function PhoneChrome() {
  const phone = usePhone() || {};
  const { claimed, unreadCount = 0, contacts = [], lastIncoming, lastPing } = phone;
  const { pathname } = useLocation();
  const onPhonePage = pathname === "/phone";

  const [toast, setToast] = useState(null);

  // Fire a toast on a genuinely-new arrival (seq bump), but only when we're not
  // already on the phone page (there the emulator rings/toasts itself).
  const incomingSeq = lastIncoming?.seq || 0;
  const pingSeq = lastPing?.seq || 0;

  useEffect(() => {
    if (!incomingSeq || onPhonePage) return;
    const m = lastIncoming.message;
    const text =
      m && m.kind === "accept"
        ? `📱 ${senderLabel(contacts, m)} is now a contact`
        : `📱 new text from ${senderLabel(contacts, m)}`;
    setToast(text);
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSeq]);

  useEffect(() => {
    if (!pingSeq || onPhonePage) return;
    setToast(`📱 ping from ${lastPing.fromNumber || "?"}`);
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pingSeq]);

  // Clear any lingering toast the moment we land on the phone page.
  useEffect(() => {
    if (onPhonePage) setToast(null);
  }, [onPhonePage]);

  if (!claimed) return null;

  return (
    <>
      {!onPhonePage && pathname !== "/" && <PhoneFab unreadCount={unreadCount} />}
      {!onPhonePage && <PhoneToast text={toast} />}
    </>
  );
}
