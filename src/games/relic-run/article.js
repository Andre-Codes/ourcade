/* DAILY RUN — fake-wiki article parser.

   Pure, no React, no DOM — so it's shared by the playable cabinet (RelicRun.jsx)
   and the headless verifier (scripts/relic-run-check.js), exactly like logic.js.

   Each node carries an `article` ({ lead, history, legacy, seeAlso }) whose prose
   is written in a tiny wiki-link grammar. This module is the single source of
   truth for that grammar — both the renderer and the validator parse with it, so
   "what the player can click" and "what the checker counts as an edge" can never
   drift apart.

   GRAMMAR (the whole language — deliberately tiny, no markdown):
     [[node-id]]               link to node-id; display = that node's title
     [[node-id|display text]]  link to node-id; display = "display text"
     {{relic}}                 arms the NEXT link token as the easter-egg anchor
     [[#|display text]]        relic-only sentinel: clickable, pockets the relic,
                               navigates nowhere (link === "#")

   node-id is [a-z0-9-]+. The display part is any run of chars except "]". Plain
   text is everything outside the tokens. */

// One regex, matched globally: either a [[…]] link (group 1 = id, group 2 =
// optional display) or a bare {{relic}} arming token. "#" is allowed as the id
// so the relic-only sentinel parses through the same path.
const TOKEN = /\[\[(#|[a-z0-9-]+)(?:\|([^\]]+))?\]\]|\{\{relic\}\}/g;

/* Split wiki-token prose into an ordered list of render segments:
     { text }                 a plain run of text
     { link, label, relic }   a clickable link; relic=true if the preceding
                              {{relic}} armed it; link === "#" means relic-only.
   `titleOf(id)` resolves a node id to its display title for bare [[id]] tokens
   (injected so this module needs no data import — keeps it trivially testable). */
export function parseArticleText(src, titleOf) {
  const segs = [];
  if (!src) return segs;
  let last = 0;
  let relicArmed = false;
  let m;
  TOKEN.lastIndex = 0; // regex is module-level + global: reset before each parse
  while ((m = TOKEN.exec(src)) !== null) {
    if (m.index > last) segs.push({ text: src.slice(last, m.index) });
    if (m[0] === "{{relic}}") {
      relicArmed = true; // arm: the NEXT link becomes the egg anchor
    } else {
      const id = m[1];
      const label = m[2] || (id === "#" ? "" : titleOf(id));
      segs.push({ link: id, label, relic: relicArmed });
      relicArmed = false;
    }
    last = TOKEN.lastIndex;
  }
  if (last < src.length) segs.push({ text: src.slice(last) });
  return segs;
}

/* Structural inspection used by validateRelicNodes(). Walks every prose field of
   an article (lead/history/legacy) plus seeAlso and reports, without needing the
   node map:
     linkIds   — every navigable target referenced (real ids only; excludes "#"
                 and de-dupes), i.e. the article's clickable EDGE set. This is what
                 must equal node.links.
     relicCount        — how many {{relic}} tokens appear.
     relicArmsLink     — did each {{relic}} immediately precede a link token?
     selfLinks         — link ids equal to the node's own id (illegal).
     malformed         — true if an unbalanced "[[" exists with no closing "]]".
   `id` is the owning node's id (for the self-link check). */
export function inspectArticle(article, id) {
  const linkIds = new Set();
  const seeAlso = Array.isArray(article?.seeAlso) ? article.seeAlso : [];
  for (const s of seeAlso) linkIds.add(s);

  let relicCount = 0;
  let relicArmsLink = true; // false if any {{relic}} is NOT followed by a link
  const selfLinks = new Set();
  let malformed = false;

  for (const field of ["lead", "history", "legacy"]) {
    const src = article?.[field];
    if (!src) continue;
    // Unbalanced "[[" with no matching "]]" → malformed (a typo'd token).
    if (/\[\[(?:(?!\]\]).)*$/.test(src)) malformed = true;
    const segs = parseArticleText(src, () => "");
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.link == null) continue;
      if (seg.link !== "#") {
        linkIds.add(seg.link);
        if (seg.link === id) selfLinks.add(seg.link);
      }
      if (seg.relic) relicCount++;
    }
    // A {{relic}} that armed nothing (no link segment produced after it) leaves
    // relicArmed dangling; detect it directly from the source as a trailing arm.
    if (/\{\{relic\}\}(?!\s*\[\[)/.test(src)) relicArmsLink = false;
  }

  return { linkIds, relicCount, relicArmsLink, selfLinks, malformed };
}
