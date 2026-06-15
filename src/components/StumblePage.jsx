import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { drawArtifact, findArtifact } from "../data/stumble.js";
import { renderStumbleCard } from "../lib/stumbleCard.js";
import { shareImage } from "../lib/share.js";
import ShareButton from "./ShareButton.jsx";
import BackBar from "./BackBar.jsx";

/* /stumble — the discovery portal. One artifact at a time, a giant STUMBLE
   AGAIN button, and no way to filter. Embeds only archive.org iframes and
   plain images inline (trusted origins); every other artifact renders as a
   "portal card" that opens in a new tab — most sites refuse to be framed
   (X-Frame-Options) and we don't want arbitrary third-party frames anyway. */

// Flavor chip per artifact kind — revealed AFTER the draw, never a chooser.
const KIND_LABEL = {
  wiki: "📖 wiki wormhole",
  site: "🌐 living website",
  patent: "📜 a real patent",
  game: "🕹️ a game",
  video: "📺 video",
  image: "🖼️ image",
  flash: "📼 from the flash archive",
  mystery: "❓ unsolved mystery",
};

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

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

function ArtifactCard({ artifact }) {
  const kindChip = KIND_LABEL[artifact.kind];
  const host = hostnameOf(artifact.url);
  const embed = artifact.embed;
  // Flash plays inline here; keep people on Ourcade — link to our own Flash
  // Theater (/flash?play=<id>), never out to archive.org.
  const isFlash = artifact.kind === "flash" && embed?.type === "archive";

  return (
    <div className="arcade-stumble-card">
      {kindChip && <span className="arcade-stumble-kind">{kindChip}</span>}
      {artifact.deepCut && <span className="arcade-stumble-deepcut">🩻 DEEP CUT</span>}
      <h2 className="arcade-stumble-title">
        {artifact.title}
        {artifact.year && <span className="arcade-stumble-year"> ({artifact.year})</span>}
      </h2>

      {embed && embed.type === "archive" && (
        <div
          className="arcade-flash-screen arcade-stumble-screen"
          style={embed.aspect ? { "--flash-aspect": embed.aspect } : undefined}
        >
          <iframe
            key={artifact.id}
            className="arcade-flash-frame"
            src={`https://archive.org/embed/${embed.id}`}
            title={artifact.title}
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}
      {embed && embed.type === "image" && (
        <img className="arcade-stumble-image" src={embed.src} alt={artifact.title} />
      )}

      <p className="arcade-stumble-blurb">{artifact.blurb}</p>
      {artifact.credit && (
        <p className="arcade-stumble-credit">by {artifact.credit}</p>
      )}

      {isFlash ? (
        <Link
          className="arcade-stumble-open"
          to={`/flash?play=${encodeURIComponent(embed.id)}`}
        >
          📺 watch on the Flash Channel →
        </Link>
      ) : (
        artifact.url && (
          <a
            className="arcade-stumble-open"
            href={artifact.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {embed ? `view on ${host} ↗` : `OPEN ${host} ↗`}
          </a>
        )
      )}
    </div>
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
