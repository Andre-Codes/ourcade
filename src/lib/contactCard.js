/* Renders a shareable Ourcade contact card to a PNG Blob with the native Canvas
   2D API (no dependency). Draws the member's avatar, Ourcade number, handle, an
   optional bio, and a link to their public profile. Mirrors src/lib/nameCard.js
   and src/lib/eightBallCard.js. Used by the "share my number" button. */

import { isIconAvatar, avatarIconUrl } from "./kenney.js";

// Load an image URL → HTMLImageElement (resolves null on failure so the card
// still renders without the avatar). Kenney WebP are same-origin (served from
// our own /public), so no CORS taint on the canvas.
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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

// { number, username, avatar, bio } → PNG Blob (1080×1080).
export async function renderContactCard({ number, username, avatar, bio } = {}) {
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
  const glow = ctx.createRadialGradient(S / 2, S * 0.4, 80, S / 2, S * 0.45, S * 0.8);
  glow.addColorStop(0, "rgba(63,255,208,0.16)");
  glow.addColorStop(0.55, "rgba(180,77,255,0.08)");
  glow.addColorStop(1, "rgba(8,9,18,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // ── title ───────────────────────────────────────────────────────────────
  ctx.fillStyle = "#eef0ff";
  ctx.font = "700 40px 'Black Ops One', Impact, sans-serif";
  ctx.shadowColor = "rgba(63,255,208,0.5)";
  ctx.shadowBlur = 22;
  ctx.fillText("📱 OURCADE CONTACT", S / 2, 96);
  ctx.shadowBlur = 0;

  // ── avatar ring ───────────────────────────────────────────────────────────
  const ar = 120;
  const ay = 296;
  ctx.beginPath();
  ctx.arc(S / 2, ay, ar, 0, Math.PI * 2);
  ctx.fillStyle = "#11152a";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#3fffd0";
  ctx.shadowColor = "rgba(63,255,208,0.5)";
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Icon avatar → draw the WebP centered in the ring; otherwise emoji as text.
  if (isIconAvatar(avatar)) {
    const img = await loadImage(avatarIconUrl(avatar));
    if (img && img.width) {
      const box = ar * 1.4; // fit inside the ring with padding
      const scale = Math.min(box / img.width, box / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, S / 2 - w / 2, ay - h / 2, w, h);
    } else {
      ctx.font = "120px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
      ctx.fillText("🕹️", S / 2, ay + 6);
    }
  } else {
    ctx.font = "120px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.fillText(avatar || "🕹️", S / 2, ay + 6);
  }

  // ── handle ────────────────────────────────────────────────────────────────
  const handle = `@${(username || "player").trim()}`;
  ctx.fillStyle = "#b44dff";
  let handleSize = 56;
  ctx.font = `700 ${handleSize}px 'Black Ops One', Impact, sans-serif`;
  while (ctx.measureText(handle).width > S - 180 && handleSize > 28) {
    handleSize -= 4;
    ctx.font = `700 ${handleSize}px 'Black Ops One', Impact, sans-serif`;
  }
  ctx.shadowColor = "rgba(180,77,255,0.5)";
  ctx.shadowBlur = 16;
  ctx.fillText(handle, S / 2, 480);
  ctx.shadowBlur = 0;

  // ── number plate ────────────────────────────────────────────────────────
  const num = (number || "—").trim();
  ctx.font = "700 76px 'Press Start 2P', monospace";
  const numW = Math.min(S - 120, ctx.measureText(num).width + 100);
  const plateX = (S - numW) / 2;
  const plateY = 552;
  const plateH = 130;
  ctx.fillStyle = "#0e2a26";
  rr(ctx, plateX, plateY, numW, plateH, 22);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#3fffd0";
  ctx.shadowColor = "rgba(63,255,208,0.45)";
  ctx.shadowBlur = 20;
  rr(ctx, plateX, plateY, numW, plateH, 22);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#3fffd0";
  ctx.fillText(num, S / 2, plateY + plateH / 2 + 4);

  // ── bio ───────────────────────────────────────────────────────────────────
  const bioText = (bio || "").trim();
  let y = plateY + plateH + 64;
  if (bioText) {
    ctx.fillStyle = "#c9d4ff";
    ctx.font = "italic 700 34px 'Share Tech Mono', monospace";
    const bLines = wrapLines(ctx, `“${bioText}”`, S - 200).slice(0, 2);
    bLines.forEach((ln, i) => ctx.fillText(ln, S / 2, y + i * 46));
    y += bLines.length * 46 + 20;
  }

  // ── call to action ────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffd23f";
  ctx.font = "700 30px 'Press Start 2P', monospace";
  ctx.fillText("TEXT ME ON OURCADE", S / 2, S - 156);

  // ── footer wordmark + profile link ────────────────────────────────────────
  ctx.fillStyle = "#6b708f";
  ctx.font = "700 26px 'Press Start 2P', monospace";
  ctx.fillText("theourcade.com", S / 2, S - 96);
  ctx.font = "20px 'Share Tech Mono', monospace";
  ctx.fillText(`/#/u/${(username || "").trim()}`, S / 2, S - 56);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render image"));
    }, "image/png");
  });
}
