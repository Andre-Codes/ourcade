/* ============================================================
   VALIDATE-URLS — shared liveness gate for generated content.
   Every outbound URL the AI proposes gets checked before it can
   ship; callers drop the dead ones (or write nothing at all if
   too few survive — the previous pool keeps serving, same
   philosophy as the FALLBACK layering in src/data/*).

   Node 18+ (global fetch). No dependencies.
   ============================================================ */

// Dedupe identity for a URL. Most weird-web finds are whole sites, so two
// different paths on one host are "the same thing" — except on big multi-page
// hosts (Wikipedia, Google Patents, neal.fun…) where the path IS the artifact.
const MULTI_PAGE_HOSTS = new Set([
  "en.wikipedia.org",
  "patents.google.com",
  "neal.fun",
  "youtube.com",
  "archive.org",
  "ncase.me",
]);
export function urlKey(u) {
  try {
    const url = new URL(String(u));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!MULTI_PAGE_HOSTS.has(host)) return host;
    return host + url.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
}

// Statuses that mean "a server is there but doesn't like robots" — the page is
// almost certainly fine in a real browser, so DON'T call it dead (we'd rather
// keep a bot-walled gem than drop it).
const ASSUME_ALIVE = new Set([401, 403, 405, 406, 429, 999]);

const UA =
  "Mozilla/5.0 (compatible; OurcadeLinkCheck/1.0; +https://theourcade.com)";

async function fetchStatus(url, method, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "*/*" },
    });
    return { status: res.status };
  } finally {
    clearTimeout(t);
  }
}

// One URL → { url, alive, status?, reason }. HEAD first (cheap), retrying as a
// GET when HEAD is rejected or errors — plenty of servers mishandle HEAD.
export async function checkUrl(url, { timeoutMs = 10000 } = {}) {
  if (!/^https?:\/\//i.test(String(url))) {
    return { url, alive: false, reason: "not an http(s) url" };
  }
  let status = null;
  try {
    status = (await fetchStatus(url, "HEAD", timeoutMs)).status;
  } catch {
    status = null; // fall through to GET
  }
  if (status === null || (status >= 400 && !ASSUME_ALIVE.has(status))) {
    try {
      status = (await fetchStatus(url, "GET", timeoutMs)).status;
    } catch (e) {
      return { url, alive: false, reason: `unreachable (${e.name || e.message})` };
    }
  }
  const alive = status < 400 || ASSUME_ALIVE.has(status);
  return { url, alive, status, reason: alive ? "ok" : `http ${status}` };
}

// Many URLs with bounded concurrency → Map(url → result). Deduplicates input.
export async function checkUrls(urls, { concurrency = 6, timeoutMs = 10000 } = {}) {
  const unique = [...new Set(urls.filter(Boolean))];
  const out = new Map();
  let next = 0;
  async function worker() {
    while (next < unique.length) {
      const url = unique[next++];
      out.set(url, await checkUrl(url, { timeoutMs }));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, worker)
  );
  return out;
}
