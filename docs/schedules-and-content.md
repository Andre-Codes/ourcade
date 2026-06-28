# 📅 Ourcade Content & Schedules

A friendly map of **what changes on the homepage, when it changes, how, and where each pool comes from.**

The whole "fresh every day" feel rests on one idea: a given **local calendar day** always maps to the same picks, on every device — a shared ritual, Wordle-style. Nothing is random per visitor (with one deliberate exception, the Stumble button). "Today" rolls over at *your* local midnight.

---

## The three layers of content

Every card on the homepage is assembled from up to three stacked sources. Think of them as a sandwich — they all flow into one pool, and the daily rotation picks from the combined result.

| Layer | File(s) | Who edits it | Touched by `npm run generate`? |
|---|---|---|---|
| ✋ **Manual** (hand-curated) | [src/data/manual/](../src/data/manual/) — `content.js` + the standalone `movies.js` / `featured.js` / `onthisday.js` | **You, by hand** | ❌ Never |
| 🤖 **Generated** (AI-authored) | [src/data/generated/*.js](../src/data/generated/) | Claude, via scripts/CI | ✅ Overwritten each run |
| 🗓️ **Scheduled** (date-windowed) | [src/data/manual/schedule.js](../src/data/manual/schedule.js) | **You, by hand** | ❌ Never |
| 🛟 *Fallback* | inline in each consumer | (safety net only) | ❌ Never |

> **Golden rule:** the AI generators **only ever rewrite `src/data/generated/*`**. Your hand-edited files under `src/data/manual/` (including `schedule.js`) are sacred — they survive every regeneration. The fallback is a tiny built-in list so a card never renders empty if a generated batch is missing.

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
- **Salts** — each content type gets its own salt so pools don't move in lockstep: games `0` · polls `101` · facts/quizzes `202` · tips `303` · news `404` · flash `505` · curiosities `606` · weird `707` · weird-night `717` · 💧 countdown `909` · on-this-day `1010` · buzz `1111` · hot-or-not `1212`.
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

## 💧 The Water Cooler ([/watercooler](../src/components/WaterCoolerPage.jsx))

A **separate page** (linked from the top nav), not part of the homepage band — a pop-culture destination for people who come for current events & buzz, not (only) games: *"what the whole internet is talking about today."* Same three-layer + date-seeded model as everything else (same "today" for everyone, finite page, no feed). Four cards:

### 📻 The Countdown
- **File:** [src/data/countdowns.js](../src/data/countdowns.js) · **Cadence:** daily (`rotateDaily`, salt 909)
- **Pools:** `MANUAL_COUNTDOWNS` (✋) → `generated/countdowns.js` (🤖) → fallback (🛟)
- A whole **TRL/Billboard-style top-5 chart is the unit of rotation** (the ranking *is* the content), so finished chart *sets* rotate day-to-day rather than being assembled from loose entries. Each entry's `trend` field (`up`/`down`/`same`/`new`) drives the ▲▼—★ arrow — it's **flavor set by the content, not computed** from real chart movement.

### 📅 On This Day
- **File:** [src/data/onthisday.js](../src/data/onthisday.js) · **Cadence:** **date-keyed** (an MM-DD lookup, *not* rotation; salt 1010 only disambiguates multiple years on the same date)
- **Pool:** [src/data/manual/onthisday.js](../src/data/manual/onthisday.js) `ON_THIS_DAY` (✋) → `generated/onthisday.js` (🤖, **gated off**) → fallback (🛟)
- The almanac throwback (#1 song / in theaters / on TV on this calendar date, ~1995–2009). It looks up today's MM-DD; with several matching years it `rotateDaily`s among them; with **no exact match it falls back to the nearest earlier date** so the card is never blank.
- ⚠️ This is the **one content type that deliberately uses hard calendar dates** (the date *is* the content) and **AI generation is intentionally DISABLED** (`GENERATE_ONTHISDAY` off): "#1 song / box office on an exact date" is a checkable fact LLMs get plausibly-but-subtly wrong, so — like Game Facts — the hand-verified set is the source of truth.

### 💬 The Buzz
- **File:** [src/data/buzz.js](../src/data/buzz.js) · **Cadence:** **3 per day** (`rotateDailyN`, salt 1111)
- **Pools:** `MANUAL_BUZZ` (✋) → `generated/buzz.js` (🤖) → fallback (🛟)
- Short tabloid/water-cooler blurbs in dry 2000s-e-zine voice; each has a `tag` chip (`GOSSIP` / `RUMOR` / `SIGHTING` / `HOT TAKE`).

### 🔥 Hot or Not
- **File:** [src/data/hotornot.js](../src/data/hotornot.js) · **Cadence:** **5 per day** (`rotateDailyN`, salt 1212)
- **Pools:** `MANUAL_HOTORNOT` (✋) → `generated/hotornot.js` (🤖) → fallback (🛟)
- The interactive 2000s-web staple. Each subject is **normalized to the poll shape**, so it reuses the live Firestore vote/tally infra (the same `usePollCounts`/`castVote`/`realTally` seam as the Daily Poll, lifted into [src/lib/votes.js](../src/lib/votes.js)) with **no new backend**. The loader hard-codes the two options so vote ids are always exactly `hot` / `not`, and ids are namespaced `hon-*` so they never collide with daily-poll ids.

> The Water Cooler doesn't currently honor `schedule.js` (no pinning), unlike News/Curiosity/Weird.

---

## 🗓️ Scheduled content ([src/data/manual/schedule.js](../src/data/manual/schedule.js))

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
| [generate-content.yml](../.github/workflows/generate-content.yml) | **Monthly** — `0 9 1 * *` (1st @ 09:00 UTC) | polls, quizzes, tips, news, 💧 Water Cooler (countdowns + buzz + hot-or-not) (+ curiosities, soft-fail) | `npm run generate` |
| [refresh-weird.yml](../.github/workflows/refresh-weird.yml) | **Every other day** — `0 6 */2 * *` (06:00 UTC) | the 🔍 Weird Thing pool only (URL-liveness gated) | `npm run generate:weird` |
| [fetch-stumble.yml](../.github/workflows/fetch-stumble.yml) | **Monthly** — `0 10 1 * *` (1st @ 10:00 UTC, 1h after the content job to avoid a branch race) | the 🎲 Stumble artifact pool only (URL-liveness gated) | `npm run fetch:stumble` |

All three also run on-demand via **`workflow_dispatch`**.

> **Why Stumble has its own workflow** (not folded into `generate-content`): the Stumble pool is produced by a *separate* script ([fetch-stumble.js](../scripts/fetch-stumble.js)), not `generate-content.js`, with its own two-pass shape (stable knowledge — wiki / patents / mysteries / games — plus a live web search for *current* finds). ~40% of a Stumble draw is the "current" bucket, so the topical half goes stale without a refresh; monthly keeps it at most ~a month old, matching the other topical pools. It dedupes against the Weird pools (and vice-versa), so the two never surface the same URL — see [The Stumble button](#-the-stumble-button-srcdatastumblejs).

**Cadence rationale:** topical references (movies/memes/news) stay relevant for months, so a monthly refresh keeps them at most ~a month old. The Weird Thing pool is cheap (one small research + one structured call, cents/run) and runs more often to stay genuinely current — but every other day is plenty: one run yields ~14 fresh items and the card cycles the whole pool (no repeats) before it turns over, so a faster refresh would replace the pool before a visitor could even see it. Bump the cron up if you want fresher topical finds.

**Safety built in:**
1. Every run executes `npm run check:daily` to verify the date-seeded rotation still holds.
2. Commits happen **only if something changed.**
3. If validation/generation fails, **nothing is written** — the previous pool keeps serving. (For weird, a dead URL is dropped by the liveness gate rather than poisoning the pool.)
4. After committing, the workflow explicitly triggers `deploy.yml` (the default `GITHUB_TOKEN` won't auto-trigger other workflows).

> 🐢 **"I deployed but don't see the change":** GitHub Pages serves `index.html` with a ~10-min cache and Safari caches HTML even harder. Hard-refresh (Cmd/Ctrl+Shift+R) or wait. Also, the Weird Thing is `(day, block)`-seeded — a fresh pool changes what surfaces *over the day*, not necessarily your current slot the instant you redeploy.

### Other local generate commands
- `npm run generate` — full monthly batch (includes the 💧 Water Cooler pools)
- `npm run generate:weird` — just the Weird Thing pool
- `npm run generate:curiosities` — just the 🌌 curiosities
- `npm run generate:watercooler` — just the 💧 Water Cooler pools (countdowns + buzz + hot-or-not); On-This-Day stays manual
- `npm run research` — proves real-time web search is firing (writes `generated/_research.md`)
- `npm run check:daily` — headless validation of every rotation/window

The `generated/_*.md` files (`_research.md`, `_weird.md`, `_stumble.md`, `_flash.md`) are human-readable audit logs — queries, source URLs, and `page_age` dates proving the content is genuinely fresh.

---

## 🗄️ The permanent archive (Firestore)

Every generator also appends what it just wrote to a permanent Firestore store, so we keep an **"everything ever generated"** corpus separate from the committed `src/data/generated/*` the live site reads. (The committed files are the *current* serving pool; each regeneration overwrites them. The archive is the cumulative history.)

- **Where:** `archive/{type}/items/{id}` — e.g. `archive/weird/items/gw-…`, `archive/stumble/items/g:wiki-…`. The parent doc (`archive/weird`) is never written to directly, so the Firestore console shows it in *italics* with "this document does not exist" — that's expected; the data lives one level down in `items`.
- **How:** [scripts/lib/firebase-admin.js](../scripts/lib/firebase-admin.js) `archiveAll()` → `archiveItem()`, called at the end of each generator (e.g. [generate-content.js](../scripts/generate-content.js) `archivePool(...)`, [fetch-stumble.js](../scripts/fetch-stumble.js) `archiveAll("stumble", …)`). Writes use `set({…}, { merge: true })` + a server-stamped `runAt`, so re-runs update rather than wipe.
- **When:** as a side-effect of each scheduled run — so a type's archive fills on **that type's cadence**: monthly types monthly, `weird` every other day, `stumble` monthly (since [fetch-stumble.yml](../.github/workflows/fetch-stumble.yml) was added — before that the Stumble pool was archived only on a manual local run).
- **Soft-fail by design:** uses the Firebase Admin SDK (bypasses security rules; needs no `allow` rule) via the `FIREBASE_SERVICE_ACCOUNT` secret (set in each workflow's `env`). If that secret is missing or any write throws, it logs a warning and returns — archiving must **never** block a content commit. So if the secret isn't set, archiving silently no-ops while the site still ships.

> Note: the `*.js` generated files are committed to git, so git history is *also* a de-facto archive. The Firestore copy's payoff is being the **complete corpus** — which is exactly what 🗄️ The Vault reads (see below).

### The Vault snapshot (browser's view of the archive)

The browser still never reads Firestore directly (`archive/*` stays admin-only). Instead a build-time script mirrors the archive into committed static JSON:

- **Script:** [scripts/snapshot-archive.js](../scripts/snapshot-archive.js) (`npm run snapshot:archive`). Reuses the same soft-fail `getDb()`; **no Anthropic calls.**
- **Finds-only:** it snapshots just the three *discovery* types — `stumble`, `weird`, `curiosities` — the timeless, stumble-worthy finds. The "in-the-moment" types (polls/quizzes/buzz/countdowns/hotornot/news/tips/almanac) stay in Firestore but are **not** snapshotted; they belong to "today," not a back catalogue.
- **Output:** `src/data/generated/vault.js` (full corpus, lazy-imported) + `vault-index.js` (tiny summary, eager). Each find is normalized to the Stumble artifact shape and **de-duped by URL** across types.
- **Soft-fail, no-clobber:** if the secret is missing or the read returns nothing, it writes nothing — the previously committed snapshot keeps serving.
- **When:** runs as a step in all three content workflows *after* their archive writes (so the snapshot reflects the run that just happened), and the vault files are committed alongside the rest.

---

## 🎲 The Stumble button ([src/data/stumble.js](../src/data/stumble.js))

The one **deliberately non-deterministic** feature (everything else is date-seeded). A click draws a random artifact from a weighted mix — it does **not** pull from the Weird / Curiosity pools; it has its own pool:

- `MANUAL_ARTIFACTS` (✋ hand-picked seeds) + `generated/stumble.js` (🤖 the AI batch from [fetch-stumble.js](../scripts/fetch-stumble.js)) + the ~3000-entry **archive.org Flash** pool (adapted on the fly) + `MANUAL_DEEP_CUTS` (✋ Konami-locked extras) + 🗄️ **Deep Stumble** (the whole Vault corpus — see below).
- **Weighting** — the invisible mix: 20% flash · 20% nostalgic · 40% current · 20% timeless · **15% Deep Stumble (the vault)** (+ a small deep-cuts bucket once unlocked), then uniform-random within the chosen bucket, skipping what you've seen this session.

**🗄️ Deep Stumble** — the dice also reach into the *entire archived finds corpus* (the Vault snapshot), as a low-weight always-on bucket. The curated current pool still dominates, but every roll *can* surface something from deep history. Vault-only finds get a "🗄️ from the vault" chip, and items already in the curated pool are deduped out so the vault only adds the deep tail. **Not** to be confused with **Deep Cuts** — that's the separate, *secret*, Konami-unlocked 🩻 bucket, unchanged.

### 🗄️ The Vault ([/vault](../src/components/VaultPage.jsx))

A destination page (top nav, next to the Water Cooler) to **wander the whole back catalogue** of timeless internet finds — everything ever archived under `stumble` / `weird` / `curiosities`. The daily site only shows "today"; the Vault is the depth. Finite and anti-algorithm: a search box, a `kind` filter (wiki/site/patent/game/mystery…), newest/oldest sort, and load-more — no feed. Reads the build-time **Vault snapshot** (above), lazy-loaded as its own chunk, and renders every find through the same `ArtifactCard` the Stumble page uses.

**Stumble vs. Weird** — related but aimed at different targets, and kept distinct by mutual URL-dedupe:
- **Weird** = a narrow slice — mostly *current, living websites* — for a card that turns over several times a day.
- **Stumble** = a wide net across `kind` (wiki / site / patent / game / video / image / mystery) **and** era (nostalgic / current / timeless), for an endless dice button.
- The only overlap zone is the "current living site" category, and that's exactly where the dedupe is pointed: Weird skips Stumble URLs ([generate-content.js](../scripts/generate-content.js)) and Stumble skips Weird URLs ([fetch-stumble.js](../scripts/fetch-stumble.js)).

---

## TL;DR cheat sheet

- **Want to add an evergreen item to the rotation?** → edit `src/data/manual/content.js` (survives regeneration, joins the daily mix).
- **Want to announce something for a date range?** → add a `pin` entry to `src/data/manual/schedule.js`.
- **Want to nudge a specific item into rotation for a while?** → add a `pool` entry to `src/data/manual/schedule.js`.
- **Want fresher AI content now?** → run the relevant workflow via `workflow_dispatch`, or `npm run generate*` locally.
- **Never hand-edit `src/data/generated/*`** — the next AI run will overwrite it.
- **The 🌙 Late-Night Weird pool is hand-curated and off-limits to the generators and the scheduler** — keep it special.
