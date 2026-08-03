/* The Vault — the read seam over the archived "finds" corpus.

   The browser never reads Firestore's archive/* (admin-only); instead a
   build-time snapshot (scripts/snapshot-archive.js) mirrors the three discovery
   types — stumble, weird, curiosities — into generated/vault.js, every item
   normalized to the Stumble artifact shape so ONE card renders them all.

   Two tiers, split for bundle size (mirrors animations.js):
   - VAULT_INDEX is imported EAGERLY (tiny) so the page header can render the
     live count instantly.
   - The full pool is imported LAZILY on first interaction, so /vault and the
     Deep Stumble bucket don't ship the whole corpus to every visitor. */

import { rotateDaily } from "../lib/daily.js";
import index from "./generated/vault-index.js";
import { applyLive } from "./live.js";

// Tiny safety net so the header still renders if the generated module is empty.
const FALLBACK_INDEX = { total: 0, byType: {}, newest: null, builtAt: null };
export const VAULT_INDEX =
  index && typeof index.total === "number" ? index : FALLBACK_INDEX;

const SALT = 1313; // independent rotation order (see src/lib/daily.js salt table)

// The full corpus is a separate chunk, fetched once on demand and cached.
// RAW — no admin overlay. Used by callers that cache derived work of their own
// (stumble.js dedupes against the curated pool) and by the #/admin console,
// which needs to show what's actually baked in before any overrides.
let poolPromise = null;
export function loadVaultRaw() {
  if (!poolPromise) {
    poolPromise = import("./generated/vault.js")
      .then((m) => (Array.isArray(m.default) ? m.default : []))
      .catch(() => []); // worst case, the Vault is simply empty rather than broken
  }
  return poolPromise;
}

/* The corpus as the site should show it. The fetch is cached but the overlay is
   applied FRESH on every call, so hiding a rotted find or fixing its link from
   #/admin lands everywhere the Vault is read — /vault, the gem of the day, and
   the Deep Stumble bucket — without a reload. */
export function loadVault() {
  return loadVaultRaw().then((items) => applyLive(items, "vault"));
}

// Case-insensitive title+blurb contains, optionally scoped to one `kind`. Same
// idiom as the homepage's cabinet search (see Home.jsx matches()).
export function searchVault(items, query, kind) {
  const q = (query || "").trim().toLowerCase();
  return (items || []).filter((a) => {
    const kindOk = !kind || kind === "all" || a.kind === kind;
    if (!kindOk) return false;
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      a.blurb.toLowerCase().includes(q)
    );
  });
}

// A date-seeded "featured from the deep" — same for everyone, stable for the day
// (the ritual feel). Resolves once the lazy pool is loaded.
export async function getVaultGemOfTheDay(key) {
  const pool = await loadVault();
  if (!pool.length) return null;
  return rotateDaily(pool, key, SALT);
}
