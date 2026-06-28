import { Link } from "react-router-dom";

/* ArtifactCard — the shared render for a single "find", used by both the Stumble
   page (one at a time) and the Vault (a grid of them). Embeds only archive.org
   iframes and plain images inline (trusted origins); every other artifact renders
   as a "portal card" that opens in a new tab — most sites refuse to be framed
   (X-Frame-Options) and we don't want arbitrary third-party frames anyway. */

// Flavor chip per artifact kind — revealed AFTER the draw on Stumble, never a
// chooser; on the Vault it doubles as the at-a-glance category.
export const KIND_LABEL = {
  wiki: "📖 wiki wormhole",
  site: "🌐 living website",
  patent: "📜 a real patent",
  game: "🕹️ a game",
  video: "📺 video",
  image: "🖼️ image",
  flash: "📼 from the flash archive",
  mystery: "❓ unsolved mystery",
};

export function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function ArtifactCard({ artifact }) {
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
      {artifact.fromVault && <span className="arcade-stumble-vault">🗄️ from the vault</span>}
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
            {host} ↗
          </a>
        )
      )}
    </div>
  );
}
