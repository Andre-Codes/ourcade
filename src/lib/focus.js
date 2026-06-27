/* Home-widget deep-link scheme. A shared link to a home widget (today's poll,
   a quiz teaser) is a real HashRouter route `#/?focus=<type>:<id>` — NOT a bare
   `#anchor`, which would collide with the router. Home reads the param and
   scrolls to the element whose id is `focus-<type>-<id>`. Keeping the token,
   the element id, and the share URL in one module guarantees they never drift.
   Pure JS (the URL builder is SSR-guarded). */

// "<type>:<id>" — the value carried in ?focus.
export function focusToken(type, id) {
  return `${type}:${id}`;
}

// Parse a ?focus value back into { type, id }, or null if malformed. Splits on
// the FIRST ":" so ids may themselves contain colons.
export function parseFocus(token) {
  if (!token || typeof token !== "string") return null;
  const i = token.indexOf(":");
  if (i <= 0) return null; // need a non-empty type before the colon
  const type = token.slice(0, i);
  const id = token.slice(i + 1);
  if (!type || !id) return null;
  return { type, id };
}

// The DOM id a focusable widget should carry so the scroll lookup can find it.
export function focusElementId(type, id) {
  return `focus-${type}-${id}`;
}

// A stable, shareable deep-link to a home widget, independent of how the current
// page was reached (mirrors StumblePage's shareUrlFor). Undefined outside a browser.
export function focusUrl(type, id) {
  if (typeof window === "undefined" || !window.location) return undefined;
  return `${window.location.href.split("#")[0]}#/?focus=${encodeURIComponent(focusToken(type, id))}`;
}
