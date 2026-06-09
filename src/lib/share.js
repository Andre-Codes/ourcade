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

/* Share an image Blob. On phones (and browsers that support file sharing) this
   opens the OS share sheet with the image attached; everywhere else it saves the
   PNG to the user's downloads and best-effort copies the link. Returns a status
   string so callers can show feedback. */
export async function shareImage({ blob, filename = "ourcade.png", title, text, url } = {}) {
  if (!blob) return "failed";
  const link = url || (typeof window !== "undefined" ? window.location.href : "");

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return "shared";
      }
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // otherwise fall through to download
    }
  }

  // Desktop fallback: save the file + copy the link.
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    try {
      if (navigator.clipboard && link) await navigator.clipboard.writeText(link);
    } catch {
      /* link copy is best-effort */
    }
    return "saved";
  } catch {
    return "failed";
  }
}
