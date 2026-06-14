import { useEffect, useState } from "react";
import { isInTop8, toggleTop8 } from "../lib/store.js";

/* Top8HeartButton — the ❤️ on any addable piece of content (game / fact /
   curiosity / weird thing / flash). Clicking toggles it in the viewer's own Top 8
   (the MySpace-style profile showcase). When the showcase is already full (8), an
   add is rejected and a brief "remove one first" hint flashes — the user clears a
   slot manually, like the spec asks.

   Self-contained: reads its own membership and stays in sync via the shared
   `ourcade:storechange` event (same seam favorites use). preventDefault +
   stopPropagation so a heart placed inside a card <Link> never navigates.

   Anonymous users: the toggle still writes locally and emits; writeProfile no-ops
   without a profile doc — identical to favorites, so no gating is needed. */
export default function Top8HeartButton({ type, id, extra, title, className = "" }) {
  const [on, setOn] = useState(() => isInTop8(type, id));
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isInTop8(type, id));
    sync(); // re-sync if type/id changed (e.g. the daily widget rotated)
    window.addEventListener("ourcade:storechange", sync);
    return () => window.removeEventListener("ourcade:storechange", sync);
  }, [type, id]);

  if (!id) return null;

  const click = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const res = toggleTop8(type, id, extra);
    if (res.full) {
      setFull(true);
      setTimeout(() => setFull(false), 2400);
    }
  };

  return (
    <button
      type="button"
      className={`arcade-top8-heart${on ? " is-on" : ""} ${className}`.trim()}
      aria-pressed={on}
      aria-label={on ? "Remove from your Top 8" : "Add to your Top 8"}
      title={on ? "In your Top 8" : `Add ${title || "this"} to your Top 8`}
      onClick={click}
    >
      {on ? "❤️" : "🤍"}
      {full && (
        <span className="arcade-top8-toast" role="status">
          Top 8 is full — remove one first
        </span>
      )}
    </button>
  );
}
