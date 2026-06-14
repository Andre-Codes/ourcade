/* CONTENT — the one place a heterogeneous Top 8 entry ({ type, id }) is resolved
   back into something renderable. The profile's Top 8 stores only a tiny pair per
   slot; this maps it to { type, id, icon, title, to?|href?, sub? } using the same
   data arrays the rest of the site already loads. Unknown ids resolve to null and
   are dropped at render (a relic of a removed/renamed item).

   Why a resolver and not denormalized copies: titles stay fresh, the profile doc
   stays tiny, and it mirrors how favorites resolve game ids via getGame(). The one
   exception is FLASH — the full animation pool is a lazy ~chunked import we don't
   want pulled into a profile view, so flash entries also carry their `title` and
   resolve synchronously from that (falling back to the eager FEATURED set). */

import { getGame } from "./games.js";
import { CURIOSITIES } from "./curiosities.js";
import { WEIRD, WEIRD_NIGHT } from "./weird.js";
import { FACTS } from "./facts.js";
import { FEATURED } from "./animations.js";

const ICON = { flash: "📼", curiosity: "🌌", fact: "💡", weird: "🔍", game: "🕹️" };

// Game facts are plain strings with no id (facts.js). Index-based ids drift when
// MANUAL_FACTS is reordered/inserted, so we key facts by a stable content hash —
// the same text always yields the same id, and a saved fact survives reordering.
function hash8(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}
export const factId = (text) => `fact:${hash8(String(text || ""))}`;

let factById = null;
function factText(id) {
  if (!factById) factById = new Map(FACTS.map((f) => [factId(f), f]));
  return factById.get(id) || null;
}

function resolveFlash(id, title) {
  const f = FEATURED.find((a) => a.id === id);
  const t = title || f?.title;
  if (!t) return null; // not in the eager set and no stored title → can't show it
  return { type: "flash", id, icon: ICON.flash, title: t, href: `https://archive.org/details/${id}` };
}

// Resolve one Top 8 entry → display info, or null if it can't be shown.
export function resolveTop8(entry) {
  if (!entry || !entry.type || !entry.id) return null;
  const { type, id } = entry;
  switch (type) {
    case "game": {
      const g = getGame(id);
      return g ? { type, id, icon: g.emoji || ICON.game, title: g.title, to: `/play/${g.id}` } : null;
    }
    case "curiosity": {
      const c = CURIOSITIES.find((x) => x.id === id);
      return c ? { type, id, icon: ICON.curiosity, title: c.title, href: c.url || null } : null;
    }
    case "weird": {
      const w = WEIRD.find((x) => x.id === id) || WEIRD_NIGHT.find((x) => x.id === id);
      return w ? { type, id, icon: ICON.weird, title: w.title, href: w.url || null } : null;
    }
    case "fact": {
      const t = factText(id);
      return t ? { type, id, icon: ICON.fact, title: t, sub: "game fact" } : null;
    }
    case "flash":
      return resolveFlash(id, entry.title);
    default:
      return null;
  }
}
