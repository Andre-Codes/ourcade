import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { drawArtifact, findArtifact } from "../data/stumble.js";
import { renderStumbleCard } from "../lib/stumbleCard.js";
import { shareImage } from "../lib/share.js";
import ShareButton from "./ShareButton.jsx";
import BackBar from "./BackBar.jsx";
import ArtifactCard from "./ArtifactCard.jsx";

/* /stumble — the discovery portal. One artifact at a time, a giant STUMBLE
   AGAIN button, and no way to filter. The card itself lives in ArtifactCard.jsx
   (shared with the Vault). */

// Stable share deep-link regardless of how the page was reached (HashRouter).
function shareUrlFor(artifact) {
  if (typeof window === "undefined" || !artifact) return undefined;
  return `${window.location.href.split("#")[0]}#/stumble?a=${encodeURIComponent(artifact.id)}`;
}

// Renders the artifact as a 1080×1080 PNG and hands it to the OS share sheet
// (or downloads it on desktop) — the 8-Ball card pattern.
function CardButton({ artifact }) {
  const [status, setStatus] = useState(null); // "busy" | "saved" | "shared" | "failed" | null
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    setStatus("busy");
    let result = "failed";
    try {
      const blob = await renderStumbleCard(artifact);
      result = await shareImage({
        blob,
        filename: `stumble-${artifact.id.replace(/[^a-z0-9-]+/gi, "-")}.png`,
        title: "Ourcade — Stumble",
        text: `I stumbled upon "${artifact.title}" on Ourcade`,
      });
    } catch {
      result = "failed";
    }
    setStatus(result === "cancelled" ? null : result);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 1800);
  };

  const label =
    status === "busy" ? "🖼 rendering…"
    : status === "saved" ? "✓ Card saved!"
    : status === "shared" ? "✓ Shared!"
    : status === "failed" ? "Card failed"
    : "🖼 Card";

  return (
    <button type="button" className="arcade-share" onClick={onClick} disabled={status === "busy"}>
      {label}
    </button>
  );
}

export default function StumblePage() {
  const { search } = useLocation();
  const [artifact, setArtifact] = useState(null);
  const [busy, setBusy] = useState(true);

  // First draw — or resolve a shared "?a=<id>" deep link to its artifact.
  useEffect(() => {
    let alive = true;
    const wanted = new URLSearchParams(search).get("a");
    const first = wanted
      ? findArtifact(wanted).then((a) => a || drawArtifact())
      : drawArtifact();
    first.then((a) => {
      if (alive) {
        setArtifact(a);
        setBusy(false);
      }
    });
    return () => {
      alive = false;
    };
    // mount-only on purpose: STUMBLE AGAIN drives subsequent picks, not the URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const again = async () => {
    setBusy(true);
    const next = await drawArtifact(artifact?.id);
    if (next) setArtifact(next);
    setBusy(false);
  };

  return (
    <div className="arcade-stage">
      <BackBar />

      <div className="arcade-stumble-page">
        <span className="arcade-widget-kicker">🎲 YOU STUMBLED UPON…</span>

        {artifact ? (
          <ArtifactCard artifact={artifact} />
        ) : (
          <div className="arcade-stumble-card arcade-stumble-loading">
            rolling the dice…
          </div>
        )}

        <div className="arcade-stumble-actions">
          <button
            type="button"
            className="arcade-stumble arcade-stumble-again"
            onClick={again}
            disabled={busy}
          >
            {busy ? "🎲 rolling…" : "🎲 STUMBLE AGAIN"}
          </button>
          {artifact && (
            <>
              <ShareButton
                label="Share this find"
                title="Ourcade — Stumble"
                text={`I stumbled upon "${artifact.title}" on Ourcade`}
                url={shareUrlFor(artifact)}
              />
              <CardButton artifact={artifact} />
            </>
          )}
        </div>

        <p className="arcade-stumble-foot">
          no algorithm. no feed. no categories. just dice. ✦
        </p>
      </div>
    </div>
  );
}
