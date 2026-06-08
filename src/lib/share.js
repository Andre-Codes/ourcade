/* Native share. Uses the Web Share API (the phone's iMessage/Facebook/etc. sheet)
   when available, and falls back to copying the link on desktop browsers that
   don't have it. Returns a status string so callers can show feedback. */

export async function share({ title, text, url } = {}) {
  const link = url || (typeof window !== "undefined" ? window.location.href : "");
  const data = { title, text, url: link };

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      // AbortError = user dismissed the sheet; anything else, fall through to copy.
      if (err && err.name === "AbortError") return "cancelled";
    }
  }

  const clip = [text, link].filter(Boolean).join(" ");
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(clip);
      return "copied";
    }
  } catch {
    /* fall through */
  }
  return "failed";
}
