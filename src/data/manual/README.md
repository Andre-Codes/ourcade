# `src/data/manual/` — the hand-edit hub

Everything in this folder is **edited by hand** and is **never overwritten** by
`npm run generate` (that only touches `src/data/generated/*`). This is the one
place to add or tweak content without it getting clobbered.

| File          | What it holds                                                                 |
| ------------- | ----------------------------------------------------------------------------- |
| `content.js`  | Polls, quizzes, facts, news, tips, curiosities, weird things, stumble artifacts. Manual entries join the daily rotation alongside the generated pools. |
| `schedule.js` | Pin/pool a specific News / Curiosity / Weird item to a date window.           |
| `movies.js`   | Movies currently in theaters + their post-credits verdict (the homepage "STAY FOR THE CREDITS?" card). |

Each file has a header comment documenting its entry shape. After editing,
run `node scripts/daily-check.js` to sanity-check the rotation.

> Note: the **games registry** lives next door in `src/data/games.js` (not in
> here) because it's imported all over the app — it's also hand-edited, just
> kept in place to avoid a wide refactor.
