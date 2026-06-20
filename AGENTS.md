# AGENTS.md — Ourcade, end to end

A technical orientation for an AI agent (or a new engineer) working in this
repo. Read this before making structural changes. For the *developer's*
day-to-day "what can I safely edit" guide, see [`DEV_README.md`](DEV_README.md).

---

## 1. Purpose & philosophy

**Ourcade is a handmade 2000s-style arcade for the old internet** — classic
Flash animations, random weird-web finds, daily picks, and original minigames.
The product thesis is deliberately *anti-algorithm*:

- **A finite, handmade page.** No infinite feed, no per-visitor ranking. The
  page is curated by a human (and an AI working under that human's direction),
  not optimized by engagement metrics.
- **A daily ritual, Wordle-style.** A given local calendar day maps to the
  **same** picks on every device. Content is *date-seeded*, not random per
  visitor, so "today's arcade" is a shared experience you can talk about.
- **An invisible era mix.** Curation leans on an unstated ~40/40/20 blend of
  eras so the place feels like the old web without announcing it.
- **One deliberate exception: Stumble.** Everything is predictable and
  ritual-like *except* the `/stumble` button, which is the one genuinely random
  surface — a knowing nod to StumbleUpon.

When you change behavior, preserve these properties: **determinism by date**,
**human curation over automation**, and **a bounded, legible page**.

---

## 2. Architecture at a glance

| Concern        | Choice |
| -------------- | ------ |
| UI             | **React 18** (function components + hooks) |
| Build/dev      | **Vite 5** (`@vitejs/plugin-react`), `base: "./"` for Pages |
| Routing        | **react-router-dom 6**, **HashRouter** (`/#/...` — required for GitHub Pages static hosting) |
| Backend        | **Firebase** Auth (anonymous + claimed) + **Firestore** (scores, profiles, favorites, phone) |
| Hosting        | **GitHub Pages** via GitHub Actions |
| Build-time AI  | **`@anthropic-ai/sdk`** — used only by `scripts/*` to author content; **never shipped to the browser** |
| Images         | **sharp** in `scripts/` for the asset pipeline |

There is no server we run. The browser talks to Firebase directly (security is
enforced by `firestore.rules`, with App Check deferred to public launch). All
the "smarts" are either client-side, in Firestore rules, or in build-time
scripts.

---

## 3. App shell & provider stack

Entry is `src/main.jsx`. **Provider order matters:**

```
AuthProvider          (owns Firebase auth + the user profile)
  └ HashRouter        (so PhoneProvider's chrome can use <Link>/useLocation)
      └ PhoneProvider (app-wide phone listeners; renders above <Routes>)
          └ App       (the route table)
```

`PhoneProvider` sits **inside** the router and auth but **above** `<Routes>` so
its live Firestore listeners run app-wide and never re-mount per navigation.

Routes live in `src/App.jsx`: `/` (Home), `/play/:id`, `/quiz/:id`,
`/flash`, `/stumble`, `/me`, `/phone`, `/scores/:id`, `/u/:username`, plus a few
others. All styling is in a single `src/arcade.css`, every class `arcade-`
prefixed.

---

## 4. The content system (three layers + a rotation engine)

Daily content is assembled from **three layers**, then chosen deterministically
by date.

```
src/data/
  manual/      ✋ hand-edited, NEVER auto-overwritten     (source of truth for curation)
  generated/   🤖 AI-authored, OVERWRITTEN by npm run generate
  *.js         the merge points (polls.js, facts.js, …) = manual ⊕ generated ⊕ fallback
  manual/schedule.js  🗓️ pins/pools a specific item to a date window
```

- **Merge points** like `src/data/polls.js` export `manual ⊕ generated ⊕
  fallback`. Edit the *manual* pool in `src/data/manual/content.js`; never edit
  `src/data/generated/*` by hand (it's clobbered on regen).
- **Rotation engine:** `src/lib/daily.js` is the heart. `todayKey()` gives the
  stable per-day key; `rotateDaily(pool, key, salt)` deterministically shuffles
  a pool and steps one item per day with no repeats until it cycles. The `salt`
  arg keeps different cards from moving in lockstep (Game of the Day uses `0`;
  pick a distinct salt per new rotating card).
- **Day-parts:** the page greets/looks different by time of day; greetings come
  from `src/data/dayparts.js`.
- **QA overrides:** append `?day=YYYY-MM-DD` and/or `?hour=H` to preview any
  day/hour deterministically. `getHourOverride()` / day overrides in `daily.js`
  honor these everywhere.

`docs/schedules-and-content.md` has the card-by-card breakdown and the refresh
workflows; read it before touching rotation or scheduling.

---

## 5. Game registry & rendering

`src/data/games.js` is the **single catalog**. A game entry:

```js
{
  id, title, blurb, emoji, accent,    // identity + cabinet look
  tags: [...], rating, plays,
  category: "game" | "tool",          // which shelf on Home
  type: "react" | "iframe",
  component: lazy(() => import(...)),  // react only
  src: "games/foo.html",              // iframe only
  badge: "NEW" | "HOT" | null,        // legacy; see stickers below
  score: { label, dir, format },      // optional scoreboard config
}
```

`getGame(id)` resolves an entry. `src/components/GamePage.jsx` (route
`/play/:id`) renders either `<game.component />` (React) or an `<iframe>`
(standalone HTML in `public/games/`). Iframe games report scores by posting
`{ type: "ourcade:score", gameId, score }`; GamePage bridges that to
`useArcadeScore(id).submit()`.

**Stickers (corner flair):** the dev-editable `src/data/manual/stickers.js` maps
a game id → a sticker key (`NEW`/`HOT`/`STAR`/`TOP`/`FREE`, extensible). Its
`getSticker(game)` is consumed by `GameCard` in `src/components/Home.jsx` and
**wins over** the legacy `badge` field. Sticker colors live next to
`.arcade-burst` in `arcade.css` (`.is-new`, `.is-hot`, `.is-star`, …).

---

## 6. The phone subsystem (Nopia)

A claimed account gets a free in-app phone with a real Ourcade number and SMS to
other members. The design splits **logic** (React/Firebase) from the **emulator
UI** (a sandboxed iframe).

- **`src/lib/PhoneProvider.jsx`** — the always-on heart. Mounts once app-wide;
  owns the 4 Firestore listeners (inbox/sent/contacts/pings), the live state,
  the unread count, the "new arrival" ring/notify decision, and the cloud
  **actions** (`relaySend`/`relayAddContact`/`relayPing`/`clearMessages`/
  `markRead`). Texting is open (no request/accept gate). Cloud is the source of
  truth; this state is a render cache. Number allocation is idempotent in
  `src/lib/cloud.js` (`allocateNumber()`), backfilled on first login.
- **`src/components/PhonePanel.jsx`** — the Nopia itself: the emulator iframe
  (`public/games/snake.html?personal=1`) plus the **thin adapter** that bridges
  context ↔ iframe over `postMessage`. The iframe can't import Firebase, so the
  provider holds the listeners and this panel just relays context → iframe
  (identity + snapshots + ring signals) and iframe → context (the `nopia:*`
  messages). It holds **no** listeners itself.
- **`src/components/PhoneOverlay.jsx`** — the site-wide **pop-up**. Rendered once
  by `PhoneProvider`, it floats above every route (including games) and is
  toggled by **pure state** (`open` / `openPhone` / `closePhone` on the phone
  context). Because there's no navigation, whatever's behind it — an
  in-progress game and all — stays mounted; closing returns you exactly where
  you were. The panel stays **mounted** while claimed (the backdrop's `is-open`
  class toggles `display`), so the iframe + bridge survive between opens and
  reopening is instant.
- **`src/components/PhoneChrome.jsx`** — the floating 📱 FAB (with unread badge)
  and the "new text" toast. Both call `openPhone()` (no navigation). Hidden on
  Home and while the phone is already visible.
- **`src/components/PhonePage.jsx`** — a thin `/phone` route wrapper around
  `PhonePanel`, kept as a deep-linkable full-page fallback. All bridge logic
  lives in `PhonePanel`, so there's a single source of truth.

**postMessage protocol** (origin-checked both ways): out →
`nopia:identity`, `nopia:contacts`, `nopia:inbox`, `nopia:sent`,
`nopia:incoming`, `nopia:incoming-ping`, plus result echoes; in → `nopia:hello`,
`nopia:send`, `nopia:read`, `nopia:addcontact`, `nopia:ping`,
`nopia:clearmessages`, and `ourcade:score`.

### 6a. Byte Badger — the offline "pseudo-AI" contact

The phone ships a built-in NPC contact, **Byte Badger** (number `555-0001`, the
same number `scripts/quarter-text.js` uses for the Daily Quarter, so the live
chat and daily texts thread together). Texting him gets in-character replies that
feel conversational — but there is **no live LLM at runtime**. Ourcade is a
static site, so Badger is a **large pre-baked knowledge base + a small runtime
retrieval engine**. Two pieces:

- **`src/lib/badger.js`** — the pure (no React/Firebase, node-testable) engine.
  `badgerReply(userText, history)` → `{ text, awardRelic?, alreadyText? }`. It:
  1. checks the **secret passphrase** ("wassup", matched by `SECRET_PATTERNS`)
     and signals a relic award — this regex lives in the engine, **not** the
     generated tree, so it can never drift when the tree is regenerated;
  2. otherwise **retrieves** the best-scoring card across `intents` (on-site
     topics: games/relics/help/jenny/…) **and** `topics` (the conversational
     brain). Scoring (`scoreCard`) combines word-boundary phrase matching with
     stopword-filtered **token overlap**, each match weighted by **token rarity
     (IDF-lite, `TOKEN_CARD_COUNT`)** so a specific term ("n64") outscores a
     generic one ("game");
  3. below `SCORE_THRESHOLD`, stays in character and **warmly redirects** (a
     fallback line + a rotating "ask me about X" topic teaser) — never a flat
     "I don't know";
  4. uses **light conversational memory** from `history`: avoid repeating the
     last line, and prefer a card's `followups` when the user lingers on the same
     topic.
- **`src/data/generated/badger.js`** — the baked tree the engine reads:
  `greeting`, `intents`, `fallback`, `secretReward`/`secretAlready`, and the big
  **`topics`** array (each card = `{ id, keywords, replies, followups?, era?,
  tags? }`). Like all of `generated/`, it's **clobbered on regen** — but the
  *passphrase is never in here*. It's safe to hand-tune keywords/replies as a
  seed; just know a regen overwrites them.
- **`scripts/generate-badger.js`** — the build-time author. Same SDK conventions
  as the other generators (`claude-opus-4-8`, json_schema, adaptive thinking,
  cached system prompt). It writes the core tree in one call, then generates the
  `topics` brain **one themed batch per `TOPIC_CLUSTERS` entry** and merges
  (de-duped by id). `validate()` enforces a topic floor (`MIN_TOPICS`) and
  **writes nothing on failure**, so a thin run can't gut the committed brain. Run
  `npm run generate:badger` (needs `ANTHROPIC_API_KEY`); it's a manual,
  eyeball-the-output tool — the persona is evergreen, so CI never re-rolls it.
  **To widen what Badger knows, add a cluster to `TOPIC_CLUSTERS` and re-run**
  (or hand-add `topics` cards to the seed for a no-API tweak).

**Relic on "wassup":** the award is performed by the caller, not the engine.
`PhoneProvider.relaySend` intercepts Badger texts locally (never hits Firestore;
the thread is stored under `ourcade:phone:badger`), and when `awardRelic` comes
back it calls `recordRelic` immediately, then **queues** a celebration. The
visual is **deferred to phone-close**: `closePhone` flushes the queued relic into
`src/components/DenCelebration.jsx` (a den/badger-themed full-screen reveal,
distinct from the crystal-tier `RelicCelebration` — this relic is *mythic*). So
the chat stays immersive and *leaving* the phone is the rewarding beat.

---

## 7. Shareable cards & sharing

Several features render a styled PNG with the **native Canvas 2D API** (no
dependency), then hand it to the OS share sheet:

- `src/lib/nameCard.js`, `src/lib/eightBallCard.js` — existing card renderers.
- `src/lib/contactCard.js` — `renderContactCard({ number, username, avatar,
  bio })` → a 1080×1080 PNG with avatar, Ourcade number, handle, optional bio,
  and a `/#/u/:username` footer. Used by the owner-only "share my number" button
  in `src/components/ProfileView.jsx`.
- `src/lib/share.js` — `share({title,text,url})` and `shareImage({blob,filename,
  title,text,url})`. Both use the Web Share API when present and fall back to
  copy-link / PNG-download on desktop, returning a status string for UI
  feedback.

Public profiles resolve `/u/:username` → uid → profile via
`cloud.resolveUsername` / `cloud.readProfile`, so a shared contact card links
somewhere the recipient can text back.

---

## 8. Build, CI/CD & content regeneration

**Local:** `npm install` → `npm run dev` (`http://localhost:5173`) ·
`npm run build` → `dist/` · `npm run preview`.

**Content scripts** (build-time only; need `ANTHROPIC_API_KEY`):
`npm run generate` (full batch), `npm run generate:weird`,
`npm run generate:curiosities`, `npm run generate:badger` (re-author Byte
Badger's brain — see §6a), `npm run research` (proves live web search),
`npm run check:daily` (headless: verify every rotation still resolves).
Game-balance sims also live here (e.g. `scripts/pits-and-portals-sim.js`).

**Workflows** in `.github/workflows/`:
- `deploy.yml` — any push to `main` → build → publish `dist/` to Pages.
- `generate-content.yml` — 1st of month 09:00 UTC → regen polls/quizzes/tips/
  news/curiosities, `check:daily`, commit-if-changed → triggers deploy.
- `refresh-weird.yml` — every other day 06:00 UTC → just the Weird Thing pool
  (URL-liveness gated), commit-if-changed → triggers deploy.

After editing content/rotation, run `npm run check:daily`. After any change, a
clean `npm run build` is the smoke test.

---

## 9. Where things live

```
src/
  main.jsx               provider stack + bootstrap
  App.jsx                route table
  arcade.css             ALL styles (arcade- prefixed)
  components/            UI (Home, GamePage, DailyBand, ProfileView, Phone*, …)
  games/                 React game components
  tools/                 React tool/toy components
  data/
    games.js             ← the game catalog
    manual/              ✋ hand-edit hub (content, schedule, movies, featured, stickers)
    generated/           🤖 AI-authored (do not hand-edit)
    *.js                 merge points + dayparts, nextGame, relics, profilePresets, …
  lib/
    AuthProvider.jsx     auth + profile
    PhoneProvider.jsx    app-wide phone listeners + actions + Badger relic reveal
    badger.js            Byte Badger's offline retrieval engine (§6a)
    daily.js             date-seeded rotation engine
    cloud.js / firebase.js / store.js / scores.js / votes.js
    share.js / *Card.js  share + canvas card renderers
public/
  games/                 standalone HTML games (snake.html = the Nopia + Snake)
  sounds/, og image, sitemap, CNAME, …
scripts/                 Node build/gen/sim tools + lib/
.github/workflows/       deploy + content refresh
docs/                    schedules-and-content.md, flash-autoplay.md
firestore.rules          Firestore security
```
