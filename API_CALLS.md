# Anthropic API calls — what runs, and when

A map of every place Ourcade spends Anthropic (Claude) tokens, so the cost is easy
to estimate. **All calls use `claude-opus-4-8`.** Nothing in the running site (the
browser app) ever calls the API — these are all **build-time dev/CI scripts** that
write static data into `src/data/generated/`, which then ships as plain JSON.

If a script isn't listed here, it makes **no** API calls (e.g. the On This Day
fetcher — see the bottom).

---

## TL;DR cadence

| When | Trigger | What runs | Claude calls |
|---|---|---|---|
| **1st of month, 09:00 UTC** | `.github/workflows/generate-content.yml` (cron `0 9 1 * *`) | `npm run generate` **+** `npm run generate:curiosities` | **8** (incl. 1 web-search) |
| **1st of month, 10:00 UTC** | `.github/workflows/fetch-stumble.yml` (cron `0 10 1 * *`) | `npm run fetch:stumble` | **2** (incl. 1 web-search) |
| **Every other day, 06:00 UTC** | `.github/workflows/refresh-weird.yml` (cron `0 6 */2 * *`) | `npm run generate:weird` | **2** (incl. 1 web-search) |
| On demand only | you, manually | the `--only=*` modes, badger, flash fetcher | varies (below) |

So the **only scheduled spend** is: ~8 + ~2 calls/month (content + stumble, both
on the 1st) + ~2 calls every other day (~15 weird-refresh runs/month). Everything
else is manual.

---

## The scheduled jobs

### Monthly — `npm run generate` (the full batch)
[scripts/generate-content.js](scripts/generate-content.js). One run = a month+ of
date-seeded daily content. Sequence of Claude calls:

1. **`researchTopics()`** — 1 call **with live web search** (`web_search_20250305`,
   up to 8 searches) to pull current pop-culture hooks. ([scripts/lib/research.js](scripts/lib/research.js))
2. **`polls`** — 40 daily polls
3. **`quizzes`** — 14 personality quizzes *(the token-heavy one — `max_tokens` 48k,
   6–7 questions each)*
4. **`flavor`** — 90 mascot tips + 50 site-news blurbs
5. **`countdowns`** — 16 Water Cooler Top-5 charts *(now names real current titles)*
6. **`buzz`** — 60 Water Cooler dispatches *(now with optional sourced "read more")*
7. **`hotornot`** — 50 Water Cooler vote subjects

Steps 5–7 are the Water Cooler pools, run inside the same job via
`generateWatercooler()` — they reuse the **same** hooks from step 1 (no extra search).

→ **7 calls** (1 web-search + 6 structured). The structured calls share a cached
system prompt (brand voice + game list), so input tokens after the first are cheap.

**Gated OFF by default (no call):** `facts` (`GENERATE_FACTS = false`, hand-curated)
and `onthisday` (`GENERATE_ONTHISDAY = false` — now sourced from Wikipedia instead;
see bottom).

The monthly workflow then **also** runs `generate:curiosities` (+1 call, below),
for **8 total/month**.

### Monthly add-on — `npm run generate:curiosities`
`--only=curiosities`: **1 structured call**, no web search (durable
Wikipedia-backed facts). 30 "Timeless Curiosity" items; URLs liveness-checked.

### Every other day — `npm run generate:weird`
`--only=weird`: **2 calls** — 1 web-search (its own "weird corners of the internet"
research) + 1 structured (14 items). URLs liveness-checked; cheap by design.

### Monthly — `npm run fetch:stumble` (the 🎲 Stumble pool)
[scripts/fetch-stumble.js](scripts/fetch-stumble.js) — a *separate* script from
`generate-content.js`. Runs an hour after the content job (cron `0 10 1 * *`).
**2 calls** — 1 structured (stable knowledge: wiki / patents / mysteries / games)
+ 1 web-search pass turned into "current"-era artifacts. URLs liveness-checked;
writes nothing if too few survive. The "current" half goes stale without a
refresh, so monthly keeps it ~a month fresh.

---

## Manual-only modes (not scheduled — you run them)

| Command | Claude calls | Web search | Notes |
|---|---|---|---|
| `npm run generate:watercooler` | **4** | 1 | research + countdowns + buzz + hotornot. Use to refresh the Water Cooler *now* without waiting for the 1st. |
| `npm run generate:curiosities` | 1 | no | (also part of the monthly job) |
| `npm run generate:weird` | 2 | 1 | (also the every-other-day job) |
| `npm run fetch:stumble` | 2 | 1 | (also the monthly job — run it to refresh the 🎲 Stumble pool *now*) |
| `npm run generate:badger` | 1 | no | [scripts/generate-badger.js](scripts/generate-badger.js) — the phone NPC's reply tree. One-off / rare. |
| `npm run fetch:flash` | ~1 | no | [scripts/fetch-flash.js](scripts/fetch-flash.js) — Flash catalog enrichment. Rare. |
| `npm run research` | 1 | 1 | [scripts/research-topics.js](scripts/research-topics.js) — standalone "prove the search is live" tool. Diagnostic. |

---

## Zero-API: On This Day

`npm run fetch:onthisday` ([scripts/fetch-onthisday.js](scripts/fetch-onthisday.js))
makes **no Anthropic calls**. It fetches the free, public **Wikimedia "On This Day"
feed** (366 days, ~1,450 real events with Wikipedia source links), liveness-checks
the URLs, and writes a static `src/data/generated/onthisday.js`.

Because a given date's history doesn't change, this is effectively **one-time** —
re-run only to refresh/expand curation. It is **not** wired into any cron or into
`generate-content.js`, so it never costs anything on a schedule.

---

## Notes for estimating cost
- Model is **Opus** everywhere — price by Opus input/output rates.
- The monthly **quizzes** call dominates output tokens (large `max_tokens`); the
  rest are small.
- **Web-search calls** (research, weird, stumble) bill the search tool separately
  from tokens — count: 1/run for monthly `generate`, 1/run for monthly
  `fetch:stumble`, 1/run for each `generate:weird`.
- Caching: within a single `generate*` run the structured calls reuse a cached
  system block, so only the first pays full input cost.
