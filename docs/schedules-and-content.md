# 📅 Ourcade Content & Schedules

A friendly map of **what changes on the homepage, when it changes, how, and where each pool comes from.**

The whole "fresh every day" feel rests on one idea: a given **local calendar day** always maps to the same picks, on every device — a shared ritual, Wordle-style. Nothing is random per visitor (with one deliberate exception, the Stumble button). "Today" rolls over at *your* local midnight.

---

## The three layers of content

Every card on the homepage is assembled from up to three stacked sources. Think of them as a sandwich — they all flow into one pool, and the daily rotation picks from the combined result.

| Layer | File(s) | Who edits it | Touched by `npm run generate`? |
|---|---|---|---|
| ✋ **Manual** (hand-curated) | [src/data/manual.js](../src/data/manual.js) | **You, by hand** | ❌ Never |
| 🤖 **Generated** (AI-authored) | [src/data/generated/*.js](../src/data/generated/) | Claude, via scripts/CI | ✅ Overwritten each run |
| 🗓️ **Scheduled** (date-windowed) | [src/data/schedule.js](../src/data/schedule.js) | **You, by hand** | ❌ Never |
| 🛟 *Fallback* | inline in each consumer | (safety net only) | ❌ Never |

> **Golden rule:** the AI generators **only ever rewrite `src/data/generated/*`**. Your hand-edited `manual.js` and `schedule.js` are sacred — they survive every regeneration. The fallback is a tiny built-in list so a card never renders empty if a generated batch is missing.

**How they merge** (typical pattern, e.g. [polls.js](../src/data/polls.js)):

```js
export const POLLS = [
  ...MANUAL_POLLS,                       // ✋ your hand picks lead the pool
  ...(generated?.length ? generated      // 🤖 AI batch fills out the rest
                        : FALLBACK),      // 🛟 …or the safety net
];
```

Manual items **join the normal daily rotation** (they're not pinned) — they just sit at the front of the pool. Scheduled items are different: see [Scheduled content](#-scheduled-content-srcdataschedulejs) below.

---

## The rotation engine

All timing lives in one pure-JS file: [src/lib/daily.js](../src/lib/daily.js). It's importable by both the React UI and the headless checker (`scripts/daily-check.js`), so what you see is exactly what gets validated.

| Function | Cadence | Repeats? | Used by |
|---|---|---|---|
| `rotateDaily` | once per day | No repeats until pool exhausted | Poll, Curiosity |
| `rotateEvery(…, periodDays)` | every N days | No repeats | Game Fact |
| `rotateIntraday(…, blocks)` | several times a day | No repeats | Weird Thing |
| `rotateDailyN` | N distinct picks/day | No repeats | (multi-item slots) |
| `pickDaily` / `pickDailyN` | once per day | *May* repeat | Mascot Tip, Site News |

A few moving parts worth knowing:

- **Day-parts** — `dayPart()` splits the local day into four uneven moods: 🌅 **Morning** (5–11), ☀️ **Afternoon** (11–17), 🌆 **After Hours** (17–22), 🌙 **Late Night** (22–5, wraps midnight). The homepage retints itself and swaps greetings per part.
- **Salts** — each content type gets its own salt so pools don't move in lockstep: games `0` · polls `101` · facts/quizzes `202` · tips `303` · news `404` · flash `505` · curiosities `606` · weird `707` · weird-night `717`.
- **Dev/QA overrides** — append `?day=YYYY-MM-DD` and/or `?hour=0-23` to the URL to preview any future day or hour without touching your clock.

---

## Card-by-card breakdown

### 🗳️ Daily Poll
- **File:** [src/data/polls.js](../src/data/polls.js) · **Cadence:** daily (`rotateDaily`, salt 101)
- **Pools:** `MANUAL_POLLS` (✋) → `generated/polls.js` (🤖) → fallback (🛟)
- Vote bars use a tiny deterministic "vanity seed" (3–12) so a brand-new poll never shows all-zeros; **real Firestore tallies quickly dominate.**

### 🌌 Timeless Curiosity
- **File:** [src/data/curiosities.js](../src/data/curiosities.js) · **Cadence:** daily (`rotateDaily`, salt 606)
- **Pools:** `MANUAL_CURIOSITIES` (✋) → `generated/curiosities.js` (🤖) → fallback (🛟)
- Durable, Wikipedia-backed wonders — fascinating regardless of decade. Honors scheduled pins/pools.

### 🔍 Today's Weird Thing
- **File:** [src/data/weird.js](../src/data/weird.js) · **Cadence:** ~every 3 hours (`rotateIntraday`, **8 blocks/day**, salt 707)
- **Daytime pool:** `MANUAL_WEIRD` (✋) → `generated/weird.js` (🤖) → fallback (🛟)
- **🌙 Late-Night pool:** `MANUAL_WEIRD_NIGHT` (✋ only) — a separate, dreamier, hand-curated set that **day-folk never see.** This is the site's strongest "it's alive" signal — come back after lunch, see something new.
- ⚠️ The night pool is **sacred**: scheduled "weird" entries only affect the daytime parts.

### 💡 Game Fact
- **File:** [src/data/facts.js](../src/data/facts.js) · **Cadence:** daily (`rotateEvery`, period 1, salt 202)
- **Pool:** `MANUAL_FACTS` (✋ only) → fallback (🛟)
- **AI generation is intentionally DISABLED** (`GENERATE_FACTS` off): real-world facts can't be web-grounded during structured output, so we run a known-true, hand-verified set (100+ facts ≈ 3+ months without a repeat). To re-enable: flip `GENERATE_FACTS`, run `npm run generate`, restore the generated import in facts.js.

### 🤖 Mascot Tip & 📰 Site News
- **File:** [src/data/flavor.js](../src/data/flavor.js) · **Cadence:** daily (`pickDaily`/`pickDailyN`; may repeat — fine for low-stakes flavor)
- **Tips pool:** `MANUAL_TIPS` (✋) → `generated/flavor.js.tips` (🤖) → fallback (🛟) → plus hand-kept `EIGHTBALL_TIPS` (the secret Magic 8-Ball hints, never regenerated).
- **News pool:** `MANUAL_NEWS` (✋) → `generated/flavor.js.news` (🤖) → fallback (🛟). News honors scheduled pins (announcements).

---

## 🗓️ Scheduled content ([src/data/schedule.js](../src/data/schedule.js))

This is the **hand-edited dev scheduling layer** — pin or pool a specific **News**, **Curiosity**, or **Weird Thing** to a date window. The AI generators never touch this file, so anything here persists across regeneration.

Each entry in the `SCHEDULE` array:

```js
{
  type: "news" | "curiosity" | "weird",
  mode: "pin" | "pool",
  from: "2026-06-20",        // required, inclusive, your local date
  until: "2026-06-27",       // OR  days: 7   OR  omit both = open-ended
  // …content fields by type (see below)
}
```

**The two modes:**

| Mode | Behavior |
|---|---|
| 📌 **`pin`** | **Forced** into the slot for the whole window — for announcements. News pins show *in full alongside* the generated items (scheduling 2 news lines = 2 + 3 = 5). Curiosity/Weird pins **override** the rotation. If several are pinned at once, they rotate day to day. |
| 🎲 **`pool`** | Just **joins the normal rotation** during the window — it gets a *chance* to appear, not a guarantee. |

**The window** (`isWithinWindow` in daily.js, all inclusive):
- `from` is required.
- End it with **`until`** (a date) *or* **`days: N`** (duration from `from`) — or omit both for **open-ended** (active from `from` onward).

**Content fields by type:**

| Type | Slot | Fields |
|---|---|---|
| `news` | 📰 Site News | `{ text }` (one line) |
| `curiosity` | 🌌 the card | `{ title, blurb, url? }` |
| `weird` | 🔍 the card | `{ title, blurb, url, foundNote? }` — **daytime only;** the 🌙 night pool is left untouched |

`id` is optional (auto-derived as `sched-<type>-<index>`).

> **Currently live** (as of this writing): two pinned `news` announcements — the "1 month old" anniversary and the "Disclosure Day" gag — both `from: 2026-06-12, days: 7`.

---

## 🤖 How generated content gets refreshed

AI content is **build-time only.** `@anthropic-ai/sdk` is a devDependency and is **never** imported by the app — no API key ever reaches the browser. Generators call Claude (`claude-opus-4-8`, structured JSON output) and write into `src/data/generated/*`. Topical items use a forced, verified real-time web search to name genuinely current things.

### Two scheduled workflows

| Workflow | Schedule | What it regenerates | Local command |
|---|---|---|---|
| [generate-content.yml](../.github/workflows/generate-content.yml) | **Monthly** — `0 9 1 * *` (1st @ 09:00 UTC) | polls, quizzes, tips, news (+ curiosities, soft-fail) | `npm run generate` |
| [refresh-weird.yml](../.github/workflows/refresh-weird.yml) | **Twice daily** — `0 6,18 * * *` (06:00 & 18:00 UTC) | the 🔍 Weird Thing pool only (URL-liveness gated) | `npm run generate:weird` |

Both also run on-demand via **`workflow_dispatch`**.

**Cadence rationale:** topical references (movies/memes/news) stay relevant for months, so a monthly refresh keeps them at most ~a month old. The Weird Thing pool is cheap (one small research + one structured call, cents/run) and runs more often to stay genuinely current.

**Safety built in:**
1. Every run executes `npm run check:daily` to verify the date-seeded rotation still holds.
2. Commits happen **only if something changed.**
3. If validation/generation fails, **nothing is written** — the previous pool keeps serving. (For weird, a dead URL is dropped by the liveness gate rather than poisoning the pool.)
4. After committing, the workflow explicitly triggers `deploy.yml` (the default `GITHUB_TOKEN` won't auto-trigger other workflows).

> 🐢 **"I deployed but don't see the change":** GitHub Pages serves `index.html` with a ~10-min cache and Safari caches HTML even harder. Hard-refresh (Cmd/Ctrl+Shift+R) or wait. Also, the Weird Thing is `(day, block)`-seeded — a fresh pool changes what surfaces *over the day*, not necessarily your current slot the instant you redeploy.

### Other local generate commands
- `npm run generate` — full monthly batch
- `npm run generate:weird` — just the Weird Thing pool
- `npm run generate:curiosities` — just the 🌌 curiosities
- `npm run research` — proves real-time web search is firing (writes `generated/_research.md`)
- `npm run check:daily` — headless validation of every rotation/window

The `generated/_*.md` files (`_research.md`, `_weird.md`, `_stumble.md`, `_flash.md`) are human-readable audit logs — queries, source URLs, and `page_age` dates proving the content is genuinely fresh.

---

## TL;DR cheat sheet

- **Want to add an evergreen item to the rotation?** → edit `manual.js` (survives regeneration, joins the daily mix).
- **Want to announce something for a date range?** → add a `pin` entry to `schedule.js`.
- **Want to nudge a specific item into rotation for a while?** → add a `pool` entry to `schedule.js`.
- **Want fresher AI content now?** → run the relevant workflow via `workflow_dispatch`, or `npm run generate*` locally.
- **Never hand-edit `src/data/generated/*`** — the next AI run will overwrite it.
- **The 🌙 Late-Night Weird pool is hand-curated and off-limits to the generators and the scheduler** — keep it special.
