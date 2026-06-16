import { useEffect } from "react";
import { usePhone } from "../lib/PhoneProvider.jsx";
import PhonePanel from "./PhonePanel.jsx";

/* PhoneOverlay — the site-wide pop-up phone. Rendered once by PhoneProvider, so
   it floats above every route (incl. games) without ever navigating. Opening it
   is pure state (openPhone/closePhone), so whatever's behind it — an in-progress
   game and all — stays mounted; closing returns you to exactly where you were.

   We keep the panel MOUNTED whenever the user is claimed and merely toggle the
   backdrop's visibility with `is-open` (display:none/flex). That keeps the Nopia
   iframe and its postMessage bridge alive between opens, so reopening is instant
   and the phone is right where it was left. */

export default function PhoneOverlay() {
  const phone = usePhone() || {};
  const { claimed, open, closePhone } = phone;

  // Escape closes — only bound while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closePhone?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePhone]);

  if (!claimed) return null;

  return (
    <div
      className={`arcade-phone-overlay-bg${open ? " is-open" : ""}`}
      onClick={() => closePhone?.()}
    >
      <div
        className="arcade-phone-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Your phone"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="arcade-phone-overlay-close"
          aria-label="close phone"
          onClick={() => closePhone?.()}
        >
          ✕
        </button>
        <PhonePanel />
      </div>
    </div>
  );
}
