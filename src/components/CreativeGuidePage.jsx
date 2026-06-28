import { useParams, Link } from "react-router-dom";
import { getCreative, isGuide } from "../data/creatives.js";
import { creativeArt, stepArt } from "./creativeArt.js";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";

/* /creatives/:id — an on-site step-by-step guide (the alternative to linking
   out to a bare Google/YouTube search). A guide is just an ordered list of
   { image, caption } steps the author hosts here, with optional materials +
   tips. Presented as a single vertical scroll — drawing tutorials are read
   top-to-bottom, each step leans on the ones above it, and that's the natural
   mobile reading mode (no step-index state machine). Non-guide ids (or unknown
   ones) fall through to a not-found gag — never a blank page. */

const LANE_LABEL = {
  print: "🖨 3D print",
  draw: "✏️ draw",
  build: "🧩 build",
  remix: "🎛 remix",
  study: "📚 study",
};

const DIFFICULTY_LABEL = {
  beginner: "🟢 beginner",
  intermediate: "🟡 intermediate",
  advanced: "🔴 advanced",
};

export default function CreativeGuidePage() {
  const { id } = useParams();
  const item = getCreative(id);

  // Missing id, or an id that exists but isn't a guide (e.g. someone typed an
  // external STL item's id) → the house "denied" gag, back to the library.
  if (!isGuide(item)) {
    return (
      <div className="arcade-notfound">
        <NedryGag message="That guide wandered off the drawing table." />
        <Link to="/creatives" className="arcade-back-link">
          ← Back to Creatives
        </Link>
      </div>
    );
  }

  const art = creativeArt(item);
  const paid = item.cost === "paid";
  const laneLabel = LANE_LABEL[item.lane] || item.lane;
  const laneEmoji = laneLabel.split(" ")[0];

  return (
    <div className="arcade-stage">
      <BackBar to="/creatives" label="BACK TO CREATIVES" />

      <article className="arcade-guide">
        <header className="arcade-guide-head">
          <span className="arcade-stumble-kind">{laneLabel}</span>
          <h1 className="arcade-guide-title">{item.title}</h1>
          {item.blurb && <p className="arcade-guide-blurb">{item.blurb}</p>}

          <div className="arcade-creative-badges arcade-guide-meta">
            {item.time && <span className="arcade-creative-badge">⏱ {item.time}</span>}
            {item.difficulty && (
              <span className="arcade-creative-badge">
                {DIFFICULTY_LABEL[item.difficulty] || item.difficulty}
              </span>
            )}
            <span className={`arcade-creative-badge${paid ? " is-paid" : ""}`}>
              {paid ? "💲 paid" : "🆓 free"}
            </span>
          </div>

          {art && (
            <img
              className="arcade-stumble-image arcade-guide-hero"
              src={art}
              alt={item.title}
              loading="lazy"
            />
          )}
        </header>

        {Array.isArray(item.materials) && item.materials.length > 0 && (
          <section className="arcade-guide-section">
            <h2 className="arcade-guide-subhead">🧰 what you'll need</h2>
            <ul className="arcade-guide-list">
              {item.materials.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        <ol className="arcade-guide-steps">
          {item.steps.map((s, i) => {
            const img = stepArt(item.id, s.image);
            return (
              <li key={i} className="arcade-guide-step">
                <div className="arcade-guide-step-num">step {i + 1}</div>
                {img ? (
                  <img
                    className="arcade-stumble-image arcade-guide-step-img"
                    src={img}
                    alt={`Step ${i + 1}`}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="arcade-guide-step-img arcade-creative-image-fallback"
                    aria-hidden="true"
                  >
                    <span className="arcade-creative-fallback-emoji">{laneEmoji}</span>
                  </div>
                )}
                {s.caption && <p className="arcade-guide-step-caption">{s.caption}</p>}
              </li>
            );
          })}
        </ol>

        {Array.isArray(item.tips) && item.tips.length > 0 && (
          <section className="arcade-guide-section">
            <h2 className="arcade-guide-subhead">💡 tips</h2>
            <ul className="arcade-guide-list">
              {item.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="arcade-guide-cta">
          {item.action && (
            <p className="arcade-creative-action">
              <span className="arcade-creative-action-arrow">→</span> {item.action}
            </p>
          )}
          <Link to="/creatives" className="arcade-back-link">
            ← find another creative mission
          </Link>
        </div>
      </article>
    </div>
  );
}
