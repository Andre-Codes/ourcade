/* Mascot tips + rotating "site news". Reads the Claude-generated pool over a
   built-in fallback. Pure JS — flavor only, so a hash pick (may repeat) is fine. */

import { pickDaily, pickDailyN } from "../lib/daily.js";
import generated from "./generated/flavor.js";
import { MANUAL_NEWS, MANUAL_TIPS } from "./manual.js";

const FALLBACK = {
  tips: [
    "Pro tip: the secret to a high score is having no other plans.",
    "Reminder: stretch your thumbs. They're load-bearing.",
  ],
  news: [
    "MAINTENANCE: we dusted the cabinets. They are now 4% more nostalgic.",
    "PSA: the visitor counter is definitely real and definitely accurate.",
  ],
};

// Hand-kept, never regenerated. Quiet hints that the Magic 8-Ball is hiding
// more than its classic answers — vague on purpose, so only someone who keeps
// shaking (and pays attention) pieces together that something rarer is in there.
const EIGHTBALL_TIPS = [
  "Most folks shake the Magic 8-Ball a few times and wander off. Most folks miss things.",
  "The Magic 8-Ball repeats itself less than you'd expect. Keep count, if you're the type.",
  "Some 8-Ball answers feel rarer than the others. That's not your imagination.",
  "Ask the Magic 8-Ball one more time than feels reasonable. Then a few hundred more.",
  "Every so often the 8-Ball's window glows a little wrong. Did you catch it, or did you blink?",
  "The Magic 8-Ball saves its best wisdom for the stubborn.",
];

// Manual entries (from manual.js) and the hand-kept EIGHTBALL_TIPS persist across
// regeneration; the generated batch (or fallback) fills out the rest of the pool.
const tips = [
  ...MANUAL_TIPS,
  ...(generated && Array.isArray(generated.tips) && generated.tips.length
    ? generated.tips
    : FALLBACK.tips),
  ...EIGHTBALL_TIPS,
];
const news = [
  ...MANUAL_NEWS,
  ...(generated && Array.isArray(generated.news) && generated.news.length
    ? generated.news
    : FALLBACK.news),
];

export function getTodaysTip(key) {
  return pickDaily(tips, key, 303);
}

export function getTodaysNews(key, n = 3) {
  return pickDailyN(news, key, n, 404);
}
