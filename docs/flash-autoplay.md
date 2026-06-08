# Flash Theater — autoplay research (parked for future implementation)

**Status:** not implemented. The Flash Theater (daily widget + `/flash` channel) currently
embeds archive.org's own iframe (`https://archive.org/embed/{id}`), which shows a
**"Click to Begin"** power-button splash before each short plays. This documents how to get
true autoplay if/when we decide it's worth the tradeoffs. Findings verified June 2026.

## Why the archive.org iframe can't autoplay
- The "Click to Begin" splash is archive.org's own emulator wrapper (emularity/Ruffle).
- The iframe is **cross-origin**, so we can't reach in to auto-click the start button or set
  Ruffle's `autoplay` config.
- There is **no `?autostart=`/`?autoplay=` URL param** on the `/embed/` software player.

## The only real path: host our own Ruffle, load the SWF directly
Stop using archive's iframe; run our own Ruffle player and point it at the raw `.swf`
(still hosted on archive.org). Then we own the player and can set `autoplay: "on"` — no splash.

### Verified facts (the make-or-break details)
- **Resolve the SWF filename per item** — it varies and is NOT derivable from the id
  (e.g. `endoftheworld_flash`'s file is `end.swf`, not `endoftheworld.swf`).
  - `GET https://archive.org/metadata/{id}` → `ACAO: *` ✅ (CORS-safe to call from the browser).
  - In the JSON, `metadata.emulator === "ruffle-swf"`, `metadata.emulator_ext === "swf"`, and
    `files[]` lists the actual file(s). Pick the main `.swf` (match `emulator_ext`, else largest).
- **Direct download is NOT CORS-enabled** — `https://archive.org/download/{id}/{file}` returns
  `ACAO: null` ❌, so Ruffle's `fetch` of the SWF would be blocked.
- **Use archive.org's CORS endpoint instead** — `https://cors.archive.org/cors/{id}/{file}`
  returns `Access-Control-Allow-Origin: <our origin>` and `200` ✅. Ruffle CAN load this.

### Implementation sketch
1. Lazy-load Ruffle (`@ruffle-rs/ruffle` selfhosted package or the CDN build) — only when the
   flash experience mounts. It's ~2 MB WASM, so keep it off the initial homepage bundle.
2. Per short to play:
   - `fetch(https://archive.org/metadata/{id})` → find the main `.swf` name.
   - `const url = https://cors.archive.org/cors/{id}/{swfName}`.
   - Create a Ruffle player, `player.config = { autoplay: "on", unmuteOverlay: "hidden" }`,
     `player.load(url)` (or `player.load({ url, autoplay: "on" })`).
3. Audio autoplay still needs a user gesture (browser policy). The channel already has gestures
   (navigation, Play/Next), so subsequent shorts autoplay with sound; otherwise Ruffle shows an
   unmute overlay (`unmuteOverlay: "visible"`).

### Bonus this unlocks
Ruffle exposes player **events/API**, so we could detect when a short actually ends and
auto-advance the channel on real end-of-animation instead of the current ~90s timer
(see `ADVANCE_MS` in [`src/components/FlashChannel.jsx`](../src/components/FlashChannel.jsx)).

## Tradeoffs / risks (why it's parked, not done)
- Ships ~2 MB of Ruffle WASM (lazy, but still).
- We load the raw SWF ourselves, so **AS3 / multi-file / complex SWFs may error** where
  archive's player coped — the channel auto-skips, the widget falls back to stumble.
- Extra latency per short: a metadata fetch + the SWF download (some are multiple MB).
- We render our own loading/error states and lose archive's poster image.
- Depends on `cors.archive.org` staying available and permissive.

## Scope decision (parked)
If implemented, likely apply to the **channel** first (lean-back continuous play benefits most);
optionally the homepage **daily widget** too, at the cost of loading Ruffle on the homepage.
Relevant files: [`src/components/FlashChannel.jsx`](../src/components/FlashChannel.jsx),
[`src/components/FlashTheater.jsx`](../src/components/FlashTheater.jsx),
[`src/data/animations.js`](../src/data/animations.js).
