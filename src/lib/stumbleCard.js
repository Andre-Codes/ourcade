/* Renders a shareable "I stumbled upon…" card to a PNG Blob with the native
   Canvas 2D API (no dependency) — same pattern as eightBallCard.js. Draws the
   dice header, the artifact's kind chip, title, blurb, and source domain over
   the arcade's dark-neon look. Used by the Stumble page's card button. */

// Kind → chip label/color (stable copies; kept free of component imports).
const KIND = {
  wiki: { label: "WIKI WORMHOLE", color: "#3fffd0" },
  site: { label: "LIVING WEBSITE", color: "#3fa9ff" },
  patent: { label: "A REAL PATENT", color: "#ffd23f" },
  game: { label: "A GAME", color: "#e8ff47" },
  video: { label: "VIDEO", color: "#ff6ad5" },
  image: { label: "IMAGE", color: "#ff6ad5" },
  flash: { label: "FLASH ARCHIVE", color: "#b44dff" },
  mystery: { label: "UNSOLVED MYSTERY", color: "#ff6a8a" },
};

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function renderStumbleCard(artifact) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall back to system fonts */
    }
  }

  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // ── background ──────────────────────────────────────────────────────────
  ctx.fillStyle = "#0b0d16";
  ctx.fillRect(0, 0, S, S);
  const glow = ctx.createRadialGradient(S / 2, S * 0.45, 80, S / 2, S * 0.45, S * 0.8);
  glow.addColorStop(0, "rgba(255,210,63,0.14)");
  glow.addColorStop(0.55, "rgba(180,77,255,0.10)");
  glow.addColorStop(1, "rgba(8,9,18,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // ── header ──────────────────────────────────────────────────────────────
  ctx.font = "120px serif";
  ctx.fillText("🎲", S / 2, 150);
  ctx.fillStyle = "#eef0ff";
  ctx.font = "700 42px 'Black Ops One', Impact, sans-serif";
  ctx.shadowColor = "rgba(255,210,63,0.5)";
  ctx.shadowBlur = 24;
  ctx.fillText("I STUMBLED UPON…", S / 2, 268);
  ctx.shadowBlur = 0;

  // ── kind chip ───────────────────────────────────────────────────────────
  let y = 360;
  const kind = KIND[artifact?.kind];
  if (kind) {
    ctx.font = "700 22px 'Press Start 2P', monospace";
    const padX = 18;
    const w = ctx.measureText(kind.label).width + padX * 2;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = kind.color;
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(S / 2 - w / 2, y - 22, w, 44, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = kind.color;
    ctx.shadowColor = kind.color;
    ctx.shadowBlur = 14;
    ctx.fillText(kind.label, S / 2, y);
    ctx.shadowBlur = 0;
    y += 86;
  }

  // ── title (shrinks for long titles) ─────────────────────────────────────
  const title = (artifact?.title || "something weird").trim();
  const tSize = title.length > 70 ? 40 : title.length > 40 ? 48 : 56;
  ctx.fillStyle = "#eef0ff";
  ctx.font = `700 ${tSize}px 'Black Ops One', Impact, sans-serif`;
  const tLines = wrapLines(ctx, title, S - 160).slice(0, 3);
  const tLh = tSize + 14;
  tLines.forEach((ln, i) => ctx.fillText(ln, S / 2, y + i * tLh));
  y += tLines.length * tLh + 26;

  if (artifact?.year) {
    ctx.fillStyle = "#6b708f";
    ctx.font = "30px 'Share Tech Mono', monospace";
    ctx.fillText(`(${artifact.year})`, S / 2, y);
    y += 52;
  }

  // ── blurb ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#c9d4ff";
  ctx.font = "32px 'Share Tech Mono', monospace";
  const bLines = wrapLines(ctx, artifact?.blurb || "", S - 200).slice(0, 5);
  bLines.forEach((ln, i) => ctx.fillText(ln, S / 2, y + i * 44));
  y += bLines.length * 44 + 40;

  // ── source domain ───────────────────────────────────────────────────────
  const host = hostnameOf(artifact?.url);
  if (host && y < S - 170) {
    ctx.fillStyle = "#e8ff47";
    ctx.font = "700 30px 'Share Tech Mono', monospace";
    ctx.fillText(`↗ ${host}`, S / 2, y);
  }

  // ── footer wordmark ─────────────────────────────────────────────────────
  ctx.fillStyle = "#6b708f";
  ctx.font = "700 26px 'Press Start 2P', monospace";
  ctx.fillText("theourcade.com", S / 2, S - 70);
  ctx.font = "20px 'Share Tech Mono', monospace";
  ctx.fillText("no algorithm. just dice.", S / 2, S - 34);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render image"));
    }, "image/png");
  });
}
