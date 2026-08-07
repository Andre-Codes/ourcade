/* Renders a built Homepage Builder '97 page to a shareable PNG Blob with the
   native Canvas 2D API (no dependency). Mirrors src/lib/nameCard.js and
   src/lib/eightBallCard.js. Used by the Homepage Builder's card button.

   This REDRAWS the page rather than screenshotting the DOM (that would need
   html2canvas, which we're not adding) — so the tool's visual vocabulary is
   deliberately kept to things canvas can reproduce: tiled wallpaper, text,
   hazard stripes, counter digits. The wallpaper comes from the SAME SVG data
   URI the CSS preview uses, drawn through createPattern; data URIs are
   same-origin, so nothing taints the canvas. Animated GIFs render as their
   first frame, which is exactly what a screenshot of 1997 looked like. */

const S = 1080;

// Load an image URL, resolving to null instead of rejecting — a missing widget
// should cost us that widget, not the whole card.
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Greedy word-wrap to a pixel width; returns the lines. (Same helper shape as
// nameCard.js — kept local so each card renderer stays self-contained.)
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

function rr(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
}

// Truncate to fit a width, with an ellipsis — used for the one-line bits
// (marquee, blink) that scroll or flash in the live preview.
function fit(ctx, text, maxWidth) {
  let s = String(text);
  if (ctx.measureText(s).width <= maxWidth) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

/* { page, bg, hits, widgets: [src], guests } → PNG Blob (1080×1080). */
export async function renderHomepageCard({ page, bg, hits, widgets = [], guests = [] }) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall back to system fonts */
    }
  }

  const [tile, ...gifs] = await Promise.all([
    loadImage(bg.tile),
    ...widgets.map(loadImage),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // ── wallpaper ───────────────────────────────────────────────────────────
  ctx.fillStyle = "#0b0d16";
  ctx.fillRect(0, 0, S, S);
  if (tile) {
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.save();
      ctx.scale(2, 2); // tiles are authored at ~32-64px; double for a 1080 card
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, S / 2, S / 2);
      ctx.restore();
    }
  }

  const ink = bg.ink || "#eef0ff";
  const M = 84; // side margin
  const W = S - M * 2;
  let y = 108;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // ── WordArt title ───────────────────────────────────────────────────────
  const title = (page.name || "UNTITLED PAGE").toUpperCase();
  const titleSize = title.length > 22 ? 46 : title.length > 14 ? 58 : 70;
  ctx.font = `700 ${titleSize}px 'Press Start 2P', 'Courier New', monospace`;
  const titleLines = wrapLines(ctx, title, W);
  for (const line of titleLines) {
    const grad = ctx.createLinearGradient(0, y - titleSize, 0, y + 8);
    grad.addColorStop(0, "#fff32e");
    grad.addColorStop(0.45, "#ff8a1f");
    grad.addColorStop(1, "#d81c1c");
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillText(line, S / 2 + 5, y + 5); // drop shadow
    ctx.fillStyle = grad;
    ctx.fillText(line, S / 2, y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#3a1000";
    ctx.strokeText(line, S / 2, y);
    y += titleSize + 20;
  }
  y += 14;

  // ── marquee band ────────────────────────────────────────────────────────
  if (page.marquee) {
    ctx.font = "30px 'Share Tech Mono', 'Courier New', monospace";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(M, y - 34);
    ctx.lineTo(S - M, y - 34);
    ctx.moveTo(M, y + 16);
    ctx.lineTo(S - M, y + 16);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillText(fit(ctx, page.marquee, W - 24), S / 2, y);
    y += 66;
  }

  // ── UNDER CONSTRUCTION hazard banner ────────────────────────────────────
  if (page.construction) {
    const bw = 560;
    const bh = 74;
    const bx = (S - bw) / 2;
    ctx.save();
    rr(ctx, bx, y - 10, bw, bh, 6);
    ctx.clip();
    // diagonal hazard stripes
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(bx, y - 10, bw, bh);
    ctx.fillStyle = "#241a00";
    for (let i = -bh; i < bw + bh; i += 48) {
      ctx.beginPath();
      ctx.moveTo(bx + i, y - 10 + bh);
      ctx.lineTo(bx + i + 24, y - 10 + bh);
      ctx.lineTo(bx + i + 24 + bh, y - 10);
      ctx.lineTo(bx + i + bh, y - 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    rr(ctx, bx, y - 10, bw, bh, 6);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#241a00";
    ctx.stroke();
    // label on its own plate so it stays legible over the stripes
    ctx.font = "700 24px 'Press Start 2P', 'Courier New', monospace";
    const label = "UNDER CONSTRUCTION";
    const lw = ctx.measureText(label).width + 32;
    ctx.fillStyle = "#ffd23f";
    rr(ctx, S / 2 - lw / 2, y + 4, lw, 40, 4);
    ctx.fill();
    ctx.fillStyle = "#241a00";
    ctx.fillText(label, S / 2, y + 32);
    y += bh + 34;
  }

  // ── blinking line (drawn lit) ───────────────────────────────────────────
  if (page.blink) {
    ctx.font = "700 24px 'Press Start 2P', 'Courier New', monospace";
    ctx.fillStyle = "#ff2d2d";
    ctx.fillText(fit(ctx, page.blink.toUpperCase(), W), S / 2, y);
    y += 50;
  }

  // ── about panel ─────────────────────────────────────────────────────────
  if (page.about) {
    ctx.font = "30px 'Times New Roman', Times, serif";
    const lines = wrapLines(ctx, page.about, W - 72).slice(0, 5);
    const ph = lines.length * 42 + 40;
    ctx.fillStyle = bg.scrim || "rgba(0,0,0,.55)";
    rr(ctx, M, y - 12, W, ph, 10);
    ctx.fill();
    ctx.fillStyle = ink;
    let ly = y + 32;
    for (const line of lines) {
      ctx.fillText(line, S / 2, ly);
      ly += 42;
    }
    y += ph + 26;
  }

  // ── animated-gif row (first frame) ──────────────────────────────────────
  const frames = gifs.filter(Boolean);
  if (frames.length) {
    const H = 116;
    const gap = 28;
    const sizes = frames.map((img) => ({
      img,
      w: img.height ? (img.width / img.height) * H : H,
    }));
    const totalW = sizes.reduce((n, s) => n + s.w, 0) + gap * (sizes.length - 1);
    let gx = S / 2 - totalW / 2;
    for (const s of sizes) {
      ctx.drawImage(s.img, gx, y, s.w, H);
      gx += s.w + gap;
    }
    y += H + 34;
  }

  // ── hit counter ─────────────────────────────────────────────────────────
  if (page.counter && hits) {
    ctx.font = "26px 'Share Tech Mono', 'Courier New', monospace";
    ctx.fillStyle = ink;
    ctx.fillText("you are visitor number", S / 2, y);
    y += 34;
    const digits = String(hits).split("");
    const dw = 40;
    const dh = 54;
    const dgap = 5;
    let dx = S / 2 - (digits.length * (dw + dgap) - dgap) / 2;
    ctx.font = "700 26px 'Press Start 2P', 'Courier New', monospace";
    for (const d of digits) {
      ctx.fillStyle = "#04120a";
      ctx.fillRect(dx, y, dw, dh);
      ctx.strokeStyle = "#0b3f1e";
      ctx.lineWidth = 2;
      ctx.strokeRect(dx, y, dw, dh);
      ctx.fillStyle = "#4bff77";
      ctx.fillText(d, dx + dw / 2, y + 37);
      dx += dw + dgap;
    }
    y += dh + 36;
  }

  // ── guestbook (only the signatures actually collected) ──────────────────
  if (page.guestbook && guests.length) {
    ctx.font = "24px 'Share Tech Mono', 'Courier New', monospace";
    const lines = guests.slice(-3).map((g) => `${g.who} — ${g.note}`);
    const ph = lines.length * 34 + 56;
    ctx.fillStyle = bg.scrim || "rgba(0,0,0,.55)";
    rr(ctx, M, y - 12, W, ph, 10);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = "700 20px 'Press Start 2P', 'Courier New', monospace";
    ctx.fillText("GUESTBOOK", S / 2, y + 24);
    ctx.font = "24px 'Share Tech Mono', 'Courier New', monospace";
    let gy = y + 62;
    for (const line of lines) {
      ctx.fillText(fit(ctx, line, W - 72), S / 2, gy);
      gy += 34;
    }
    y += ph + 26;
  }

  // ── webring ─────────────────────────────────────────────────────────────
  if (page.webring) {
    ctx.font = "24px 'Share Tech Mono', 'Courier New', monospace";
    ctx.fillStyle = ink;
    ctx.fillText("◄ prev · OURCADE WEBRING · next ►", S / 2, y);
  }

  // ── footer wordmark, always pinned to the bottom ────────────────────────
  const fh = 78;
  ctx.fillStyle = "rgba(6,7,15,.88)";
  ctx.fillRect(0, S - fh, S, fh);
  ctx.fillStyle = "#e8ff47";
  ctx.font = "700 22px 'Press Start 2P', 'Courier New', monospace";
  ctx.fillText("OURCADE · HOMEPAGE BUILDER '97", S / 2, S - fh / 2 + 8);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}
