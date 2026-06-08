/* ─────────────────────────────────────────────────────────────────────────
   YOUTUBE IFRAME API — one-time loader for Badger's walkman.
   Injects https://www.youtube.com/iframe_api once and resolves when window.YT
   is ready. Cached-promise singleton, same shape as loadPool() in
   data/animations.js, so concurrent callers share one script tag and one load.
   No API key needed — the IFrame Player API is keyless.
   ───────────────────────────────────────────────────────────────────────── */

let apiPromise = null;

export function loadYouTubeAPI() {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("no document"));
      return;
    }
    // Already present (e.g. a prior mount) — use it straight away.
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    // The API calls this global hook once it finishes loading. Chain any
    // pre-existing handler so we don't clobber another integration.
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };

    // Inject the script once; reuse the tag if it's somehow already there.
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => reject(new Error("failed to load YouTube IFrame API"));
      document.head.appendChild(tag);
    }
  }).catch((err) => {
    // Let a later attempt retry rather than caching the rejection forever.
    apiPromise = null;
    throw err;
  });

  return apiPromise;
}
