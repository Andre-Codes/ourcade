# 🕹️ Ourcade

A little arcade of homemade minigames, built with **React + Vite** and deployed to **GitHub Pages**.

## Games

| Game | Type | Description |
|------|------|-------------|
| 🏰 Crypt of the Hollow King | React | Deterministic magic-tower puzzle-crawler |
| ⚡ Reflex Arcade | React | Four reaction minigames in one |
| 🧠 Mind Flood | HTML | Six cognitive trainers |
| ♠️ Poker Night Tracker | React | Buy-in tracking + settlement math |

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # serve the production build locally
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
site and publishes `dist/` to GitHub Pages.

**One-time setup:** in your repo, go to **Settings → Pages → Build and
deployment → Source** and select **GitHub Actions**.

## Adding a game

Everything routes through [`src/data/games.js`](src/data/games.js) — that's the
only file you edit to add, remove, or reorder games.

- **React game:** drop a `.jsx` into `src/games/` (it must `export default` a
  component), then add an entry with `type: "react"` and
  `component: lazy(() => import("../games/YourGame.jsx"))`.
- **Standalone HTML game:** drop the file into `public/games/`, then add an
  entry with `type: "iframe"` and `src: "games/your-file.html"`.

## Project layout

```
index.html              · Vite entry
vite.config.js          · base "./" for Pages, React plugin
public/games/           · standalone HTML games (served as-is)
src/
  main.jsx              · React + HashRouter bootstrap
  App.jsx               · routes (home + /play/:id)
  arcade.css            · shell styles (all `arcade-` prefixed)
  data/games.js         · ← the game registry
  components/
    Home.jsx            · the cabinet grid
    GamePage.jsx        · renders a React game or an iframe
  games/                · React game components
```
