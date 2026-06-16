/* Renders a shareable Name-O-Tron readout to a PNG Blob with the native Canvas
   2D API (no dependency). Draws the analyzed name, the stat bars, the verdict,
   and the Ourcade wordmark. Mirrors src/lib/eightBallCard.js. Used by the
   Name-O-Tron's share button. */

// Bar fill colors cycle through the arcade accent palette, same order the tool
// renders them on screen.
const BAR_COLORS = ["#3fffd0", "#ffd23f", "#b44dff", "#ff6a8a", "#3fa9ff", "#e8ff47"];

// Greedy word-wrap to a pixel width; returns the lines.
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

// Rounded-rect helper that degrades gracefully if roundRect is unavailable.
function rr(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
}

// { name, stats: [{ label, value }], verdict } → PNG Blob (1080×1080).
export async function renderNameCard({
  name,
  stats = [],
  verdict,
  rank,
  signature,
  confidence,
  anomaly,
}) {
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
  const glow = ctx.createRadialGradient(S / 2, S * 0.35, 80, S / 2, S * 0.45, S * 0.8);
  glow.addColorStop(0, "rgba(180,77,255,0.18)");
  glow.addColorStop(0.55, "rgba(63,255,208,0.08)");
  glow.addColorStop(1, "rgba(8,9,18,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // ── title ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#eef0ff";
  ctx.font = "700 44px 'Black Ops One', Impact, sans-serif";
  ctx.shadowColor = "rgba(180,77,255,0.5)";
  ctx.shadowBlur = 24;
  ctx.fillText("✦ NAME-O-TRON 3000 ✦", S / 2, 92);
  ctx.shadowBlur = 0;

  // ── analyzed name ─────────────────────────────────────────────────────────
  const subject = (name || "").trim() || "ANONYMOUS";
  ctx.fillStyle = "#3fffd0";
  // shrink the name font to fit very long inputs on one line
  let nameSize = 64;
  ctx.font = `700 ${nameSize}px 'Black Ops One', Impact, sans-serif`;
  while (ctx.measureText(subject).width > S - 160 && nameSize > 30) {
    nameSize -= 4;
    ctx.font = `700 ${nameSize}px 'Black Ops One', Impact, sans-serif`;
  }
  ctx.shadowColor = "rgba(63,255,208,0.5)";
  ctx.shadowBlur = 18;
  ctx.fillText(subject, S / 2, 178);
  ctx.shadowBlur = 0;

  // ── rank + anomaly ────────────────────────────────────────────────────────
  if (rank) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 26px 'Press Start 2P', monospace";
    ctx.fillText(`RANK: ${rank}`, S / 2, 232);
  }
  if (anomaly) {
    ctx.fillStyle = "#3fa9ff";
    ctx.font = "700 22px 'Press Start 2P', monospace";
    ctx.shadowColor = "rgba(63,169,255,0.6)";
    ctx.shadowBlur = 14;
    ctx.fillText(anomaly, S / 2, 272);
    ctx.shadowBlur = 0;
  }

  // ── stat bars ─────────────────────────────────────────────────────────────
  const rows = stats.slice(0, 6);
  const barX = 130;
  const barW = S - barX * 2;
  const barH = 34;
  const rowGap = 76;
  let y = anomaly ? 332 : 312;
  ctx.textBaseline = "alphabetic";
  rows.forEach((s, i) => {
    const color = BAR_COLORS[i % BAR_COLORS.length];
    const v = Math.max(0, Math.min(100, Math.round(s.value)));

    // label + percentage
    ctx.textAlign = "left";
    ctx.font = "700 26px 'Share Tech Mono', monospace";
    ctx.fillStyle = "#c9d4ff";
    ctx.fillText(s.label, barX, y - 14);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.fillText(`${v}%`, barX + barW, y - 14);

    // track
    ctx.fillStyle = "#161a2b";
    rr(ctx, barX, y, barW, barH, barH / 2);
    ctx.fill();

    // fill
    if (v > 0) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      rr(ctx, barX, y, Math.max(barH, (barW * v) / 100), barH, barH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    y += rowGap;
  });

  // ── verdict ─────────────────────────────────────────────────────────────
  const vText = (verdict || "").trim();
  if (vText) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd23f";
    ctx.font = "italic 700 36px 'Share Tech Mono', monospace";
    ctx.shadowColor = "rgba(255,210,63,0.4)";
    ctx.shadowBlur = 16;
    const vLines = wrapLines(ctx, `“${vText}”`, S - 180).slice(0, 3);
    const vy = Math.max(y + 30, S - 230);
    vLines.forEach((ln, i) => ctx.fillText(ln, S / 2, vy + i * 48));
    ctx.shadowBlur = 0;
  }

  // ── provenance strip (signature + confidence — pure mystique) ─────────────
  const prov = [
    signature ? `SIG: ${signature}` : null,
    confidence ? `CONFIDENCE: ${confidence}%` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (prov) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5b6386";
    ctx.font = "20px 'Share Tech Mono', monospace";
    ctx.fillText(prov, S / 2, S - 108);
  }

  // ── footer wordmark ─────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#6b708f";
  ctx.font = "700 26px 'Press Start 2P', monospace";
  ctx.fillText("theourcade.com", S / 2, S - 70);
  ctx.font = "20px 'Share Tech Mono', monospace";
  ctx.fillText("a 100% scientific analysis", S / 2, S - 34);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render image"));
    }, "image/png");
  });
}
