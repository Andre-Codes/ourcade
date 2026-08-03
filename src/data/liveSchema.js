/* ─────────────────────────────────────────────────────────────────────────
   LIVE SCHEMA — one field table per content family.

   Drives BOTH the admin console's form renderer and its validation, so the
   seven editors at #/admin are one generic component instead of seven
   hand-written forms. The rules here mirror what scripts/daily-check.js
   enforces at build time (unique ids, non-empty title/blurb, parseable url,
   valid kind/era), so anything the console accepts also survives check:daily
   once scripts/snapshot-live.js bakes it into the repo.

   Node-pure — no React, no Firebase. See src/data/live.js for the overlay.
   ───────────────────────────────────────────────────────────────────────── */

// Kept in sync with the KINDS/ERAS sets in scripts/daily-check.js. "flash" is
// deliberately absent: those artifacts are generated from the archive.org pool
// by the adapter in stumble.js and must never be hand-authored.
export const LIVE_KINDS = ["site", "wiki", "patent", "game", "video", "image", "mystery"];
export const LIVE_ERAS = ["nostalgic", "current", "timeless"];

const URL_FIELD = { key: "url", label: "url", type: "url", required: true, placeholder: "https://…" };
const TITLE_FIELD = { key: "title", label: "title", required: true, max: 90 };
const BLURB_FIELD = {
  key: "blurb",
  label: "blurb",
  type: "textarea",
  required: true,
  max: 320,
  hint: "1–2 sentences: why is this worth a click?",
};

export const LIVE_FORMS = {
  stumble: {
    emoji: "🎲",
    tab: "STUMBLE",
    noun: "artifact", plural: "artifacts",
    blurb: "The 🎲 pool. `era` drives the invisible 40/40/20 draw and is never shown to visitors.",
    fields: [
      TITLE_FIELD,
      BLURB_FIELD,
      URL_FIELD,
      { key: "kind", label: "kind", type: "select", options: LIVE_KINDS, required: true, default: "site" },
      { key: "era", label: "era", type: "select", options: LIVE_ERAS, required: true, default: "current" },
      { key: "year", label: "year", placeholder: "1996 — optional" },
      { key: "credit", label: "credit", placeholder: "optional" },
    ],
    // Matches the "site:spacejam-1996" convention in MANUAL_ARTIFACTS.
    makeId: (v) => `${v.kind || "site"}:${slugify(v.title)}`,
  },

  weird: {
    emoji: "🔍",
    tab: "WEIRD",
    noun: "weird thing", plural: "weird things",
    blurb: "The 🔍 card, daytime. Rotates every ~3h through the day.",
    fields: [
      TITLE_FIELD,
      BLURB_FIELD,
      URL_FIELD,
      { key: "foundNote", label: "found note", placeholder: "updates every few minutes — optional" },
    ],
    makeId: (v) => `weird-${slugify(v.title)}`,
  },

  weirdNight: {
    emoji: "🌙",
    tab: "NIGHT",
    noun: "late-night weird thing", plural: "night finds",
    blurb: "The 🌙 pool — only shown after dark, and never touched by the scheduler. Keep these good.",
    fields: [
      TITLE_FIELD,
      BLURB_FIELD,
      URL_FIELD,
      { key: "foundNote", label: "found note", placeholder: "optional" },
    ],
    makeId: (v) => `weirdnt-${slugify(v.title)}`,
  },

  curiosities: {
    emoji: "🌌",
    tab: "CURIOS",
    noun: "curiosity", plural: "curiosities",
    blurb: "The 🌌 card — fascinating regardless of decade. One per day.",
    fields: [TITLE_FIELD, BLURB_FIELD, { ...URL_FIELD, required: false }],
    makeId: (v) => `cur-${slugify(v.title)}`,
  },

  featured: {
    emoji: "★",
    tab: "FEATURED",
    noun: "featured game", plural: "featured games",
    blurb: "The ★ FEATURED GAME hero — a real, external game. Cycles one per week.",
    fields: [
      TITLE_FIELD,
      BLURB_FIELD,
      URL_FIELD,
      { key: "tagline", label: "tagline", placeholder: "roguelike · science-fantasy — optional" },
      { key: "year", label: "year", placeholder: "2024 or TBA — optional" },
      {
        key: "imageUrl",
        label: "image url",
        type: "url",
        placeholder: "https://… — optional",
        hint: "Full URL to cover art. Repo entries use the optimized `image` basename instead; a live entry can't run assets:featured, so it links art directly. Blank falls back to the 🎮 placeholder.",
      },
      { key: "accent", label: "accent", type: "color", placeholder: "#6B4BB8 — optional" },
    ],
    makeId: (v) => slugify(v.title),
  },

  news: {
    emoji: "📰",
    tab: "NEWS",
    noun: "news line", plural: "news lines",
    blurb: "SITE NEWS on the homepage. For a dated announcement use 🗓️ SCHEDULE instead — it pins.",
    fields: [
      {
        key: "text",
        label: "line",
        type: "textarea",
        required: true,
        max: 200,
        hint: "Existing lines open with a caps tag: NEW: / RUMOR: / PSA: / NOW OPEN:",
      },
    ],
    makeId: (v) => `news-${slugify(v.text).slice(0, 40)}`,
  },

  schedule: {
    emoji: "🗓️",
    tab: "SCHEDULE",
    noun: "scheduled entry", plural: "scheduled entries",
    blurb:
      "Pin or pool an item to a date window. `pin` forces the slot for the whole window; `pool` just joins that day's rotation. Leave both end fields blank for open-ended.",
    fields: [
      {
        key: "type",
        label: "slot",
        type: "select",
        options: ["news", "curiosity", "weird"],
        required: true,
        default: "news",
      },
      { key: "mode", label: "mode", type: "select", options: ["pin", "pool"], required: true, default: "pin" },
      { key: "from", label: "from", type: "date", required: true, placeholder: "YYYY-MM-DD" },
      { key: "until", label: "until", type: "date", placeholder: "YYYY-MM-DD — optional" },
      { key: "days", label: "or days", type: "number", placeholder: "7 — optional" },

      // Content fields switch on the chosen slot (mirrors toItem() in manual/schedule.js).
      { key: "text", label: "news line", type: "textarea", required: true, max: 200, when: (v) => v.type === "news" },
      { key: "title", label: "title", required: true, max: 90, when: (v) => v.type !== "news" },
      { key: "blurb", label: "blurb", type: "textarea", required: true, max: 320, when: (v) => v.type !== "news" },
      { key: "url", label: "url", type: "url", required: true, when: (v) => v.type === "weird" },
      { key: "url", label: "url", type: "url", when: (v) => v.type === "curiosity" },
      { key: "foundNote", label: "found note", when: (v) => v.type === "weird" },
    ],
    makeId: (v) => `sched-${v.type || "news"}-${slugify(v.title || v.text || "entry").slice(0, 32)}`,
  },
};

// Title → id slug, matching the kebab-case ids already in manual/content.js.
export function slugify(s) {
  // NFKD splits accented letters into base + combining mark, and the
  // non-alphanumeric sweep below eats the mark — so "café" lands on "cafe"
  // rather than losing the letter entirely.
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
}

// The fields actually shown for these values (schedule's content fields switch
// on `type`). Used by both the renderer and the validator so they can't drift.
export function visibleFields(type, values) {
  return (LIVE_FORMS[type]?.fields || []).filter((f) => !f.when || f.when(values));
}

function isUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* Validate one item. Returns { <fieldKey>: "message" } — empty means good.
   `takenIds` is every id already in the pool (baked + live); pass the item's
   own id as `selfId` when editing so it doesn't collide with itself. */
export function validateItem(type, values, takenIds = [], selfId = null) {
  const errors = {};

  for (const f of visibleFields(type, values)) {
    const raw = values[f.key];
    const v = typeof raw === "string" ? raw.trim() : raw ?? "";

    if (f.required && !v) {
      errors[f.key] = "required";
      continue;
    }
    if (!v) continue;

    if (f.type === "url" && !isUrl(v)) errors[f.key] = "needs a full http(s) URL";
    else if (f.type === "select" && !f.options.includes(v)) errors[f.key] = "pick one of the options";
    else if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[f.key] = "use YYYY-MM-DD";
    else if (f.type === "number" && !(Number(v) > 0)) errors[f.key] = "must be a positive number";
    else if (f.max && String(v).length > f.max) errors[f.key] = `${String(v).length}/${f.max} — too long`;
  }

  // A schedule entry may end with `until` OR `days`, never both (isWithinWindow
  // in lib/daily.js reads them in that order, so both set is a silent trap).
  if (type === "schedule" && values.until && values.days) {
    errors.days = "set `until` or `days`, not both";
  }

  const id = (values.id || "").trim() || LIVE_FORMS[type]?.makeId?.(values) || "";
  if (!id) errors.title = errors.title || "can't derive an id from this";
  else if (id !== selfId && takenIds.includes(id)) {
    errors.title = "an item with this id already exists — tweak the title";
  }

  return errors;
}

// Form values → the object stored in the overlay: trimmed, blanks dropped
// (so an optional field left empty never ships as ""), id derived if absent.
export function buildItem(type, values, selfId = null) {
  const out = {};
  for (const f of visibleFields(type, values)) {
    const raw = values[f.key];
    const v = typeof raw === "string" ? raw.trim() : raw;
    if (v === "" || v == null) continue;
    out[f.key] = f.type === "number" ? Number(v) : v;
  }
  out.id = selfId || (values.id || "").trim() || LIVE_FORMS[type].makeId(values);
  return out;
}
