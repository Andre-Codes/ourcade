import { useParams, Link } from "react-router-dom";
import { getCreative, isGuide, isSolve } from "../data/creatives.js";
import { creativeArt, stepArt, plateArt } from "./creativeArt.js";
import SolvePuzzle from "./SolvePuzzle.jsx";
import BackBar from "./BackBar.jsx";
import NedryGag from "./NedryGag.jsx";

/* /creatives/:id — an on-site step-by-step guide (the alternative to linking
   out to a bare Google/YouTube search). Two flavors, both a single vertical
   scroll (tutorials are read top-to-bottom; no step-index state machine):
   - PER-STEP: an ordered list of { image, caption } the author hosts here.
   - WHOLE-PLATE (`item.plate` + steps): one big public-domain reference plate up
     top (e.g. a Lutz drawing plate where steps 1→finished are all on one image),
     then a numbered text-only caption list. Simpler, and how the book reads.
   - PLATE-ONLY (`item.plate`, no steps): just the big plate + title + credit. The
     plate already shows the numbered steps, so there's nothing to caption.
   Non-guide ids (or unknown ones) fall through to a not-found gag. */

const LANE_LABEL = {
  draw: "✏️ draw",
  solve: "🧩 solve",
  build: "🛠 build",
  remix: "🎛 remix",
  study: "📚 study",
};

const DIFFICULTY_LABEL = {
  beginner: "🟢 beginner",
  intermediate: "🟡 intermediate",
  advanced: "🔴 advanced",
};

// Whole-plate steps: a numbered text list (the plate image carries the visuals).
function PlateSteps({ steps }) {
  return (
    <ol className="arcade-guide-steps arcade-guide-steps-text">
      {steps.map((s, i) => (
        <li key={i} className="arcade-guide-step-text">
          <span className="arcade-guide-step-n">{i + 1}</span>
          <span className="arcade-guide-step-caption">{s.caption}</span>
        </li>
      ))}
    </ol>
  );
}

// Per-step steps: an image (or fallback tile) plus a caption per step.
function ImageSteps({ lane, id, steps, laneEmoji }) {
  return (
    <ol className="arcade-guide-steps">
      {steps.map((s, i) => {
        const img = stepArt(lane, id, s.image);
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
  );
}

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

  const laneLabel = LANE_LABEL[item.lane] || item.lane;
  const laneEmoji = laneLabel.split(" ")[0];

  // A "solve this" puzzle: the shared header (chip/title/blurb/badges) is reused,
  // but the body is the interactive puzzle instead of plate/steps — and there's
  // no hero image to show.
  const solve = isSolve(item);

  // Whole-plate guide: the big plate IS the hero (with a credit line) and steps
  // are text-only. Otherwise: a normal card/header image and per-step images.
  const plate = item.plate ? plateArt(item.lane, item.plate) : null;
  const isPlateGuide = !!item.plate;
  const heroArt = solve ? null : isPlateGuide ? plate : creativeArt(item);

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
          </div>

          {heroArt && (
            <figure className="arcade-guide-figure">
              <img
                className={`arcade-stumble-image arcade-guide-hero${
                  isPlateGuide ? " arcade-guide-plate" : ""
                }`}
                src={heroArt}
                alt={item.title}
                loading="lazy"
              />
              {isPlateGuide && item.plateCredit && (
                <figcaption className="arcade-guide-plate-credit">{item.plateCredit}</figcaption>
              )}
            </figure>
          )}
        </header>

        {/* A puzzle renders its interactive body; every other guide renders the
            materials / steps / tips walkthrough. */}
        {solve ? (
          <section className="arcade-guide-section">
            <SolvePuzzle puzzle={item.puzzle} />
          </section>
        ) : (
          <>
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

            {/* Steps are optional. Plate-only guides (a public-domain plate with
                no step text) skip this entirely — the plate hero IS the guide. */}
            {item.steps?.length ? (
              isPlateGuide ? (
                <section className="arcade-guide-section">
                  <h2 className="arcade-guide-subhead">✏️ step by step</h2>
                  <PlateSteps steps={item.steps} />
                </section>
              ) : (
                <ImageSteps lane={item.lane} id={item.id} steps={item.steps} laneEmoji={laneEmoji} />
              )
            ) : null}

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
          </>
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
