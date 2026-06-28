# Dev README — Ourcade, the short version

A reminder of **what this is** and **what you can change yourself** without
diving into the codebase or asking the agent. For the deep technical tour, see
[`AGENTS.md`](AGENTS.md).

---

## What Ourcade is

A handmade, 2000s-style **arcade for the old internet** — original minigames,
classic Flash, weird-web finds, and a fresh set of daily picks. On purpose it's
**anti-algorithm**: a finite, human-curated page where *every device sees the
same "today."* Content is chosen by the calendar date, not by a feed. The one
random thing is the **Stumble** button.

Built with React + Vite, backed by Firebase (accounts, scores, the in-app
phone), and deployed to GitHub Pages. **Push to `main` → it goes live.**

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Preview a specific day/time without waiting: add `?day=2026-12-25` and/or
`?hour=21` to the URL. Same date always shows the same picks.

---

## Things you can edit yourself

These are plain data files meant for hand-editing. **Nothing here needs the
agent**, and the files in `src/data/manual/` are **never overwritten** by the
content generator. Each file has a header comment explaining its format.

| I want to…                                   | Edit this file |
| -------------------------------------------- | -------------- |
| Add / remove / reorder a game or tool        | [`src/data/games.js`](src/data/games.js) |
| Set a game's corner sticker (NEW!, HOT!, ★)  | [`src/data/manual/stickers.js`](src/data/manual/stickers.js) |
| Add a poll, quiz, fact, news, tip, weird thing | [`src/data/manual/content.js`](src/data/manual/content.js) |
| Pin content to a specific date / window      | [`src/data/manual/schedule.js`](src/data/manual/schedule.js) |
| Change the "Stay for the credits?" movies    | [`src/data/manual/movies.js`](src/data/manual/movies.js) |
| Change the spotlighted real-world game        | [`src/data/manual/featured.js`](src/data/manual/featured.js) |
| Change the "what genre next?" vote options    | [`src/data/nextGame.js`](src/data/nextGame.js) |
| Change the time-of-day greetings              | [`src/data/dayparts.js`](src/data/dayparts.js) |
| Teach Byte Badger (the phone NPC) new things  | [`src/data/generated/badger.js`](src/data/generated/badger.js) ⚠️ |

> There's also a hub guide at
> [`src/data/manual/README.md`](src/data/manual/README.md).

> ⚠️ **`badger.js` is a generated file** (the one exception in this table). You
> *can* hand-edit it, but `npm run generate:badger` will overwrite your edits. For
> a permanent change, see the Byte Badger note below.

### Common quick edits

- **Give a game a sticker.** Open `src/data/manual/stickers.js` and add a line
  like `"tap-surge": "HOT",`. Valid stickers: `NEW`, `HOT`, `STAR`, `TOP`,
  `FREE`. This overrides whatever was set in `games.js`. (To invent a new
  sticker color, the file's comment tells you the one CSS line to add.)
- **Spotlight a different game.** Move an entry to the **top** of the array in
  `src/data/manual/featured.js` (newest-first is the convention). For new art,
  drop it in `assets-src/featured/<slug>.(png|jpg)` and run
  `npm run assets:featured`.
- **Add a game.** Add an entry to `src/data/games.js` (it's the only file you
  touch for the catalog). React game → `.jsx` in `src/games/`,
  `type: "react"`. Standalone HTML → file in `public/games/`, `type: "iframe"`.
  Full recipe is in the main [`README.md`](README.md).

### Byte Badger — the phone's chatty NPC

Texting **Byte Badger** (the `555-0001` contact in the in-app phone) gets
in-character replies about games, secrets, and a *lot* of early-2000s / old-web
nostalgia. He **feels** like a chatbot but there's **no live AI** — Ourcade is a
static site. He's a big pre-written "brain" (`topics` of keyword → replies) that
the phone matches against as you text. Saying the secret word **"wassup"** opens
the den and awards a relic (you'll see a little celebration when you close the
phone).

To **make him smarter / give him new topics**, the proper way is to add a theme
to `TOPIC_CLUSTERS` in [`scripts/generate-badger.js`](scripts/generate-badger.js)
and re-run `npm run generate:badger` (needs an API key — it re-authors his whole
brain). For a quick, no-API tweak you can hand-add a card to the `topics` array
in `src/data/generated/badger.js` (copy the shape of an existing one:
`{ id, keywords, replies }`) — just remember a future `generate:badger` run will
overwrite it. The deep how-it-works is in [`AGENTS.md`](AGENTS.md) §6a.

---

## How the daily content works (in two sentences)

Each "card" picks from a pool of items, and the calendar date deterministically
decides which one shows today — so it's the same for everyone and rotates on its
own. Content comes from three layers: **✋ your manual files** (above),
**🤖 generated** AI content that refreshes monthly, and **🗓️ scheduled** pins for
specific dates.

After editing content, sanity-check the rotation:

```bash
npm run check:daily
```

---

## Shipping & regenerating

- **Deploy:** just push to `main`. GitHub Actions builds and publishes
  automatically.
- **AI content refresh:** runs on a schedule — a monthly batch, a monthly
  🎲 Stumble-pool refresh, and a more frequent "weird thing" refresh. You can
  also run `npm run generate` (or `npm run fetch:stumble`) locally if you have an
  API key, but you rarely need to — the generated layer maintains itself.
- **Archiving:** every refresh also appends what it generated to a permanent
  Firestore store (`archive/{type}/items/*`) so we keep an "everything ever
  generated" corpus. It's soft-fail (never blocks a deploy) and needs no manual
  step. Full details in
  [`docs/schedules-and-content.md`](docs/schedules-and-content.md).

---

## When to ask the agent

Anything code-level, e.g.:

- new features or pages, or changing how a card behaves
- styling beyond what a config value covers (`src/arcade.css`)
- building a new game/tool component
- Firebase rules, auth, the phone subsystem, or the share/contact cards
- changing **how** Byte Badger matches/replies (his engine in `src/lib/badger.js`),
  vs. just adding topics, which you can do yourself (above)
- anything in `src/lib/`, `src/components/`, or `scripts/`
