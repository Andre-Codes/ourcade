/* ─────────────────────────────────────────────────────────────────────────
   MANUAL CONTENT CONFIG  ·  edit this file by hand

   Anything you add here joins the normal daily rotation alongside the
   AI-generated content in src/data/generated/*. Unlike that folder, this file
   is NEVER overwritten by `npm run generate`, so your entries persist forever.

   - Manual entries are added to the front of each pool, then the generated
     (or fallback) content follows. The daily rotation shuffles the whole
     combined pool, so a manual entry simply has the same odds of being the
     day's pick as any generated one.
   - Keep every `id` unique (within its list). Run `node scripts/daily-check.js`
     after editing to sanity-check the rotation.
   - Leave a list empty ([]) to add nothing of that type.
   ───────────────────────────────────────────────────────────────────────── */

// Polls — shape: { id, question, options: [{ id, label }] }
export const MANUAL_POLLS = [
  // {
  //   id: "manual-best-cabinet",
  //   question: "Best cabinet in the arcade?",
  //   options: [
  //     { id: "descent", label: "🕯️ The Descent" },
  //     { id: "crawler", label: "🗝️ Crypt Crawler" },
  //     { id: "tap", label: "⚡ Tap Surge" },
  //   ],
  // },
];

// Quizzes — shape: { id, title, intro,
//   results:   [{ id, title, emoji, blurb, gameId }],
//   questions: [{ q, answers: [{ label, weights: { <resultId>: points } }] }] }
// (gameId should match a game in src/data/games.js so "PLAY THIS" works.)
export const MANUAL_QUIZZES = [
  // {
  //   id: "manual-snack-quiz",
  //   title: "Which Arcade Snack Are You?",
  //   intro: "Six bites of truth.",
  //   results: [
  //     { id: "chips", title: "Hot Chips", emoji: "🔥", blurb: "Loud and a little reckless.", gameId: "tap-surge" },
  //     { id: "soda",  title: "Flat Soda",  emoji: "🥤", blurb: "Chill, sweet, in no hurry.", gameId: "descent" },
  //   ],
  //   questions: [
  //     { q: "Pick a vibe:", answers: [
  //       { label: "Spicy", weights: { chips: 2 } },
  //       { label: "Mellow", weights: { soda: 2 } },
  //     ] },
  //   ],
  // },
];

// Site news — plain strings (each is one line in the SITE NEWS ticker).
export const MANUAL_NEWS = [
  // "NEW: hand-written news lines live here and never get regenerated.",
];

// Mascot tips — plain strings.
export const MANUAL_TIPS = [
  // "Pro tip: this hint was written by a human and is here to stay.",
];
