# `src/data/manual/` — the hand-edit hub

Everything in this folder is **edited by hand** and is **never overwritten** by
`npm run generate` (that only touches `src/data/generated/*`). This is the one
place to add or tweak content without it getting clobbered.

| File          | What it holds                                                                 |
| ------------- | ----------------------------------------------------------------------------- |
| `content.js`  | Polls, quizzes, facts, news, tips, curiosities, weird things, stumble artifacts. Manual entries join the daily rotation alongside the generated pools. |
| `creatives.js`| The `/creatives` page — small "make this" missions (3D-print files, how-to-draw sheets) with a next action, time, difficulty, and cost. Hand-curated; this is the sole source for now. |
| `schedule.js` | Pin/pool a specific News / Curiosity / Weird item to a date window.           |
| `movies.js`   | Movies currently in theaters + their post-credits verdict (the homepage "STAY FOR THE CREDITS?" card). |
| `featured.js` | Real-world games to spotlight in the homepage "FEATURED GAME" card (shows the first entry, newest-first). Drop art in `assets-src/featured/<slug>.(png\|jpg)` and run `npm run assets:featured` to make the optimized `src/assets/featured/<slug>.webp`. |
| `stickers.js` | The corner flair on game cards — `NEW!`, `HOT!`, `★`, etc. Maps a game id to a sticker. This is the sole source — only listed games get one. |

Each file has a header comment documenting its entry shape. After editing,
run `node scripts/daily-check.js` to sanity-check the rotation.

> Note: the **games registry** lives next door in `src/data/games.js` (not in
> here) because it's imported all over the app — it's also hand-edited, just
> kept in place to avoid a wide refactor.
