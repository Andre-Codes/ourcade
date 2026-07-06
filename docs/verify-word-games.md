# Hand-off: Mobile/touch verification of four new daily word games

## Context
Four new daily word cabinets were added to the Ourcade app (`c:\GitHub\Ourcade\ourcade`),
all registered in `src/data/games.js`. They need a live, interactive verification on a
**phone-sized touch viewport** using the **Playwright MCP** (browser automation). Code +
generators are already green (build passes, logic node-tested); the ONLY thing left is the
runtime touch/drag check.

| Game | Route (hash router) | Key interaction to test |
|---|---|---|
| **Rank It** | `#/play/rank-it` | **Drag-to-reorder rows** (highest risk) + ▲/▼ chevrons + Lock In |
| **Laddergram** | `#/play/laddergram` | Text `<input>` (add rungs), undo, hint, win |
| **Missing Vowels** | `#/play/missing-vowels` | Per-row text `<input>`, hint |
| **Chain** | `#/play/chain` | Text `<input>` (last-first words), undo |

**Explicit requirement:** on a phone-sized touch viewport, **dragging must reorder a Rank It
row without scrolling/zooming the page** — the same discipline as the existing 2048 game
(`src/games/Game2048.jsx`). Text games must pop the mobile keyboard and accept input.

## Prerequisites (must be true before starting)
1. Playwright MCP connected — run `/mcp` in the CLI, confirm `playwright` shows **connected**.
   If not, the session was started without it; restart the session (MCP servers load only at
   session startup — adding one mid-session does not inject its tools).
2. MCP tools expected: `browser_navigate`, `browser_resize`, `browser_take_screenshot`,
   `browser_click`, `browser_drag` (or `browser_mouse_*` / `browser_press`), `browser_snapshot`,
   `browser_type`, `browser_evaluate`.

## Setup
```bash
# from c:\GitHub\Ourcade\ourcade
npm run dev          # Vite serves on http://localhost:5173 (background it)
```
Wait for "ready" / the localhost line. Base URL: `http://localhost:5173/`.

## Test procedure

### 0. Mobile viewport
- `browser_resize` to **360 × 640** (phone). Playwright MCP doesn't expose `hasTouch` directly;
  the cabinets use Pointer Events, so a mouse-drag through the MCP still exercises the same
  handlers. Prefer a device-emulation launch if the MCP supports it.

### 1. Rank It — the critical drag-doesn't-scroll check
1. `browser_navigate` → `http://localhost:5173/#/play/rank-it`
2. `browser_take_screenshot` → confirm: title "📊 RANK IT", a #number + date, **5 word rows**
   numbered 1–5, a "LOCK IN" button, no horizontal scroll, everything fits 360px wide.
3. **The key test:** read `window.scrollY` (via `browser_evaluate`), then **drag the bottom row
   (row 5) upward past several rows** (press on the row body, move up ~200px, release). Read
   `window.scrollY` again.
   - **PASS:** the row order changes AND `window.scrollY` is unchanged (page did not scroll).
   - **FAIL:** the page scrolls/rubber-bands, or the row doesn't move.
4. Probe the **chevron fallback:** click a row's ▲ button → that row moves up one slot (no drag).
5. Click **LOCK IN** → rows recolor (green = correct slot, red = off), a score `/100` and
   "X/5 in place" appear, a Share button shows. Screenshot.
6. Reload the page → the locked result **persists** (localStorage `ourcade:rankit:state`).
7. Determinism probe: navigate to `#/play/rank-it?day=2026-07-10` → a **different** five words
   (same day = same puzzle for everyone).

### 2. Laddergram
1. `browser_navigate` → `#/play/laddergram`. Screenshot: START → END, "par N", a rung list
   starting with the start word, an input + ADD.
2. Click the **💡 hint** button (fills the input with a legal next rung) → submit → it appends
   as a new rung.
3. Rejection probe: type a non-word or a 2-letter-change word → a toast appears
   ("not in the word list" / "change exactly one letter"), rung NOT added.
4. Complete the ladder (repeatedly hint→add) → win screen: "solved" + steps vs par + Share.
5. Confirm the input has mobile keyboard attrs: `autocapitalize`, `autocorrect=off`,
   `spellcheck=false`.

### 3. Missing Vowels
1. `browser_navigate` → `#/play/missing-vowels`. Screenshot: theme banner, ~6 rows each showing
   a consonant skeleton (e.g. `KNF`) + an input.
2. `browser_type` the correct word (e.g. `KNIFE`) into a row → row flips to "solved", count
   increments.
3. Probe: type a wrong-skeleton word → toast "doesn't fit the letters", not accepted.
4. Click a row's 💡 → a "has an X" vowel hint toast.

### 4. Chain
1. `browser_navigate` → `#/play/chain`. Screenshot: "from SEED", "0/par links", the seed word,
   an input prefixed with the required next letter.
2. `browser_type` a common word starting with the seed's **last letter** → appends, links count
   goes up, the required next letter updates.
3. Probe: type a word with the **wrong first letter** → toast "must start with the last letter",
   not added.
4. Undo → removes the last link.

### 5. Cross-cutting
- On each game at 360px: **no horizontal page scroll**, tap targets ≥44px, controls reachable.
- Confirm each shows the accented **"↻ daily"** tag on the home GAMES shelf
  (`http://localhost:5173/#/` → scroll to GAMES).

## What to report
- **PASS/FAIL per game**, with the Rank It drag-scroll result called out explicitly
  (include the before/after `window.scrollY` numbers as evidence).
- A screenshot of each of the four cabinets.
- Any friction: keyboard covering the input, a drag that needed multiple tries, layout overflow,
  a rejected-input toast that didn't fire.

## Known/expected quirks (not bugs)
- Some Rank It words are less "fun" (rare proper nouns can slip through the frequency-list
  filter) — data-quality note, not a failure.
- Laddergram/Chain `sample`/hint chains may contain odd words; the **player's** input is
  validated against the curated common-words dict, which is what matters.
- "Yesterday" reveal is a Spelldown feature, not one of these games.

## Files (for reference if something's off)
- Cabinets: `src/games/RankIt.jsx`, `Laddergram.jsx`, `MissingVowels.jsx`, `Chain.jsx`
- Touch pattern reference: `src/games/Game2048.jsx` (~lines 204–211 touchmove guard,
  ~340–349 root lock: `touch-action:none` + `overscrollBehavior:contain` + `userSelect:none`)
- Logic: `src/games/{rankit,laddergram,missing-vowels,chain}/logic.js`
- Generators: `scripts/gen-{rankit,laddergram,vowels,chain}.js`,
  `scripts/gen-common-words.js`; shared BFS: `src/lib/wordladder.js`

## Already verified (non-browser — no need to redo)
- All 6 generators run green: common-words 6564, rankit 240, laddergram 140, vowels 19,
  chain 160, solve 77.
- `npm run build` passes; all four cabinets compile to their own chunks.
- Logic node-tested: Rank It scoring (100/0/90), Laddergram hop rules + hint, Missing Vowels
  skeleton judge, Chain last-first rule; daily rotation is deterministic and distinct per day.
