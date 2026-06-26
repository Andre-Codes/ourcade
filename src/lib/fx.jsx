/* Tiny, dependency-free particle/juice helper shared across game cabinets.
   Mirrors the local pattern in ADHDArcade.jsx (a React state-list of short-lived
   nodes that self-remove via setTimeout) and extracts it so any game can reuse it.

   Deliberately ships NO CSS of its own: each game owns the look by supplying the
   @keyframes + colors in its own injected CSS string, keyed by class name. That
   keeps the repo's "one scoped CSS string per game" convention intact while the
   coordinate/lifetime bookkeeping lives here.

   Usage in a game whose root is position:relative —
     const { parts, spawn } = useFx();
     // …in a handler, with coords RELATIVE TO THAT ROOT:
     spawn({ kind: "burst", x, y, text: "Flush", pts: "+75" });
     spawn({ kind: "chip", x, y, src: chipImg("blue"), dx, dy, arc: -40, delay: 55, ttl: 1100 });
     spawn({ kind: "flash", fxPct: 50, ttl: 400 });
     // …and render the overlay as the last child of the relative root:
     <FxLayer parts={parts} className="hcb-fx" />

   A "part" is { kind, ttl?, ...kindProps }. The renderer (FxNode) maps the common
   kinds to class names a game styles; unknown kinds render an empty positioned div
   the game can style by a custom className passed through. Coordinates are the
   game's responsibility (read getBoundingClientRect once at spawn time). */

import { useState, useCallback } from "react";

let _seq = 0;
const fxId = () => `fx${++_seq}`;

export function useFx() {
  const [parts, setParts] = useState([]);
  const remove = useCallback((id) => setParts((p) => p.filter((x) => x.id !== id)), []);
  const spawn = useCallback(
    (part) => {
      const id = fxId();
      setParts((p) => [...p, { id, ...part }]);
      setTimeout(() => remove(id), part.ttl ?? 1200);
      return id;
    },
    [remove]
  );
  // Drop everything at once (e.g. on game reset) so nothing lingers mid-flight.
  const clear = useCallback(() => setParts([]), []);
  return { parts, spawn, clear };
}

export function FxLayer({ parts, className = "fx-layer" }) {
  return (
    <div className={className} aria-hidden="true">
      {parts.map((p) => (
        <FxNode key={p.id} {...p} />
      ))}
    </div>
  );
}

/* Render one particle. The class names (`fx-burst` / `fx-chip` / `fx-flash`, plus
   any `extra` className) are styled by the host game's CSS; this only positions
   the node and threads animation inputs through as inline CSS custom properties
   so a single keyframe set can drive every instance. */
function FxNode({ kind, x, y, extra, text, pts, bad, src, dx, dy, arc, fall, spin, delay, fxPct }) {
  if (kind === "burst") {
    return (
      <div
        className={`fx-burst${bad ? " bad" : ""}${extra ? ` ${extra}` : ""}`}
        style={{ left: x, top: y }}
      >
        {text}
        {pts != null && <span className="pts">{pts}</span>}
      </div>
    );
  }

  if (kind === "chip") {
    const falling = fall != null;
    const style = {
      left: x,
      top: y,
      animationDelay: delay ? `${delay}ms` : undefined,
    };
    if (falling) {
      style["--fall"] = `${fall}px`;
      style["--spin"] = `${spin ?? 0}deg`;
    } else {
      style["--dx"] = `${dx ?? 0}px`;
      style["--dy"] = `${dy ?? 0}px`;
      style["--arc"] = `${arc ?? -40}px`;
    }
    return (
      <div className={`fx-chip${falling ? " fall" : " fly"}${extra ? ` ${extra}` : ""}`} style={style}>
        <img src={src} alt="" draggable="false" />
      </div>
    );
  }

  if (kind === "flash") {
    return <div className={`fx-flash${extra ? ` ${extra}` : ""}`} style={{ "--fx": `${fxPct ?? 50}%` }} />;
  }

  // Fallback: a positioned, game-styled node.
  return <div className={extra || "fx-node"} style={{ left: x, top: y }} />;
}
