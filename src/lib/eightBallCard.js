/* Renders a shareable Magic 8-Ball card to a PNG Blob with the native Canvas
   2D API (no dependency). Draws the ball, the answer in its tone/rarity color,
   the question, and the Ourcade wordmark. Used by the 8-Ball's share button. */

// Small, stable copies of the 8-Ball's color maps (duplicated rather than
// imported to keep this util free of the React component / its asset imports).
const TONE = { yes: "#3fffd0", maybe: "#ffd23f", no: "#ff6a8a" };
const RARITY = {
  common: { label: "COMMON", color: "#9fb4ff" },
  rare: { label: "RARE", color: "#3fa9ff" },
  epic: { label: "EPIC", color: "#b44dff" },
  legendary: { label: "LEGENDARY", color: "#ffd23f" },
  mythic: { label: "MYTHIC", color: "#ff6ad5" },
};

function answerColor(a) {
  if (!a) return "#9fb4ff";
  if (a.rarity && a.rarity !== "common") return RARITY[a.rarity].color;
  return a.tone ? TONE[a.tone] : "#9fb4ff";
}

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

export async function renderEightBallCard({ question, answer }) {
  // Make sure the page's web fonts are ready so canvas text uses them.
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
  const glow = ctx.createRadialGradient(S / 2, S * 0.5, 80, S / 2, S * 0.5, S * 0.75);
  glow.addColorStop(0, "rgba(63,169,255,0.18)");
  glow.addColorStop(0.55, "rgba(180,77,255,0.10)");
  glow.addColorStop(1, "rgba(8,9,18,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // ── title ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#eef0ff";
  ctx.font = "700 46px 'Black Ops One', Impact, sans-serif";
  ctx.shadowColor = "rgba(63,255,208,0.5)";
  ctx.shadowBlur = 24;
  ctx.fillText("✦ MAGIC 8-BALL ✦", S / 2, 96);
  ctx.shadowBlur = 0;

  // ── question (above the ball) ───────────────────────────────────────────
  const q = (question || "").trim();
  ctx.fillStyle = "#c9b6ff";
  ctx.font = "italic 30px 'Share Tech Mono', monospace";
  const qText = q ? `“${q}”` : "asked the Magic 8-Ball…";
  const qLines = wrapLines(ctx, qText, S - 200).slice(0, 2);
  qLines.forEach((ln, i) => ctx.fillText(ln, S / 2, 180 + i * 40));

  // ── the ball ────────────────────────────────────────────────────────────
  const cx = S / 2;
  const cy = 600;
  const R = 300;
  const ballGrad = ctx.createRadialGradient(cx - 90, cy - 110, 40, cx, cy, R);
  ballGrad.addColorStop(0, "#2a2d3a");
  ballGrad.addColorStop(0.5, "#111219");
  ballGrad.addColorStop(1, "#000000");
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // glossy highlight
  const shine = ctx.createRadialGradient(cx - 110, cy - 130, 10, cx - 110, cy - 130, 200);
  shine.addColorStop(0, "rgba(255,255,255,0.28)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  // inner answer window (dark blue disc)
  const Rw = 190;
  const win = ctx.createRadialGradient(cx, cy + 10, 20, cx, cy, Rw);
  win.addColorStop(0, "#1b2a6b");
  win.addColorStop(1, "#0a1230");
  ctx.beginPath();
  ctx.arc(cx, cy, Rw, 0, Math.PI * 2);
  ctx.fillStyle = win;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(120,150,255,0.25)";
  ctx.stroke();

  // ── rarity badge (rare+) ────────────────────────────────────────────────
  let textTop = cy;
  if (answer?.rarity && answer.rarity !== "common") {
    const rc = RARITY[answer.rarity].color;
    ctx.font = "700 22px 'Press Start 2P', monospace";
    const label = RARITY[answer.rarity].label;
    const padX = 16;
    const w = ctx.measureText(label).width + padX * 2;
    const bx = cx - w / 2;
    const by = cy - Rw + 44;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = rc;
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(bx, by - 18, w, 36, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = rc;
    ctx.shadowColor = rc;
    ctx.shadowBlur = 14;
    ctx.fillText(label, cx, by);
    ctx.shadowBlur = 0;
    textTop = cy + 26;
  }

  // ── answer text inside the window ───────────────────────────────────────
  const ans = answer?.text || "Ask again later.";
  const color = answerColor(answer);
  // shrink font for longer answers so it stays inside the disc
  const len = ans.length;
  const fontSize = len > 60 ? 28 : len > 36 ? 34 : len > 20 ? 40 : 46;
  ctx.font = `700 ${fontSize}px 'Share Tech Mono', monospace`;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  const lines = wrapLines(ctx, ans, Rw * 1.7);
  const lh = fontSize + 8;
  const startY = textTop - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lh));
  ctx.shadowBlur = 0;

  // ── footer wordmark ─────────────────────────────────────────────────────
  ctx.fillStyle = "#6b708f";
  ctx.font = "700 26px 'Press Start 2P', monospace";
  ctx.fillText("theourcade.com", S / 2, S - 70);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render image"));
    }, "image/png");
  });
}
