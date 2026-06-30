import { useEffect, useRef } from "react";

/* ConfirmDialog — a small, self-contained yes/no modal for destructive actions
   (mainly "quit mid-game, lose your progress?"). Modeled on PhoneOverlay's
   backdrop + dialog structure: click-outside and Escape cancel, the Cancel
   button is focused by default so a stray Enter is safe.

   Props:
     open         — render + show when true
     title        — heading
     message      — body line(s)
     confirmLabel — primary (destructive) button text   (default "Quit")
     cancelLabel  — dismiss button text                 (default "Keep playing")
     onConfirm    — primary action
     onCancel     — dismiss (also click-outside / Escape)
     altLabel/onAlt — optional middle action (e.g. "Quit & save")
     tone         — "warn" (default) tints the confirm button red

   Scoped styles are injected once under .ocd-* so callers don't need any CSS. */

const OCD_CSS = `
  .ocd-bg {
    position: fixed; inset: 0; z-index: 9000; display: flex;
    align-items: center; justify-content: center; padding: 20px;
    background: rgba(4, 2, 12, .62); backdrop-filter: blur(4px);
    animation: ocd-fade 140ms ease-out;
  }
  @keyframes ocd-fade { from { opacity: 0; } to { opacity: 1; } }
  .ocd-box {
    width: min(92vw, 380px); box-sizing: border-box;
    background: linear-gradient(180deg, #161226, #100c1e);
    border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
    box-shadow: 0 18px 60px rgba(0,0,0,.6); padding: 22px 22px 18px;
    text-align: center; animation: ocd-pop 160ms cubic-bezier(.2,.8,.3,1.2);
  }
  @keyframes ocd-pop { from { transform: scale(.9); opacity: .4; } to { transform: scale(1); opacity: 1; } }
  .ocd-box h2 { margin: 0 0 8px; font-family: 'Black Ops One', sans-serif; font-size: 1.3rem; letter-spacing: .03em; color: #ffd23f; }
  .ocd-box p { margin: 0 0 18px; font-family: 'Press Start 2P', monospace; font-size: .56rem; line-height: 1.7; letter-spacing: .04em; color: #cdd2ee; }
  .ocd-actions { display: flex; flex-direction: column; gap: 8px; }
  .ocd-btn {
    cursor: pointer; border-radius: 9px; padding: 11px 14px;
    font-family: 'Press Start 2P', monospace; font-size: .58rem; letter-spacing: .04em;
    border: 2px solid rgba(255,255,255,.16); color: #eef0ff; background: rgba(255,255,255,.06);
  }
  .ocd-btn.confirm { color: #0a0a12; border-color: #0a0a12; background: linear-gradient(180deg, #ff8f8f, #ff5b5b); }
  .ocd-btn.confirm.safe { background: linear-gradient(180deg, #fff, #3fffd0); }
  .ocd-btn.alt { background: rgba(63,255,208,.14); border-color: rgba(63,255,208,.4); color: #b8fff0; }
  .ocd-btn.cancel { background: rgba(255,255,255,.1); }
  @media (prefers-reduced-motion: reduce) {
    .ocd-bg, .ocd-box { animation: none; }
  }
`;

let injected = false;
function useOcdStyles() {
  useEffect(() => {
    if (injected) return undefined;
    const s = document.createElement("style");
    s.setAttribute("data-ocd", "");
    s.textContent = OCD_CSS;
    document.head.appendChild(s);
    injected = true;
    return undefined; // shared once; leave it mounted for other dialogs
  }, []);
}

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Quit",
  cancelLabel = "Keep playing",
  onConfirm,
  onCancel,
  altLabel,
  onAlt,
  tone = "warn",
}) {
  useOcdStyles();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="ocd-bg" onPointerDown={() => onCancel?.()}>
      <div
        className="ocd-box"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        <div className="ocd-actions">
          <button
            type="button"
            className={`ocd-btn confirm${tone === "safe" ? " safe" : ""}`}
            onPointerDown={() => onConfirm?.()}
          >
            {confirmLabel}
          </button>
          {altLabel && (
            <button type="button" className="ocd-btn alt" onPointerDown={() => onAlt?.()}>
              {altLabel}
            </button>
          )}
          <button type="button" ref={cancelRef} className="ocd-btn cancel" onPointerDown={() => onCancel?.()}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
