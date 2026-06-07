/* Mascot tips + rotating "site news". Reads the Claude-generated pool over a
   built-in fallback. Pure JS — flavor only, so a hash pick (may repeat) is fine. */

import { pickDaily, pickDailyN } from "../lib/daily.js";
import generated from "./generated/flavor.js";

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

const tips =
  generated && Array.isArray(generated.tips) && generated.tips.length
    ? generated.tips
    : FALLBACK.tips;
const news =
  generated && Array.isArray(generated.news) && generated.news.length
    ? generated.news
    : FALLBACK.news;

export function getTodaysTip(key) {
  return pickDaily(tips, key, 303);
}

export function getTodaysNews(key, n = 3) {
  return pickDailyN(news, key, n, 404);
}
