# Soundboard clips

Drop audio files here for the Ourcade Soundboard (`src/tools/Soundboard.jsx`).

source: https://www.101soundboards.com/search/halo%203

- The board reads its `SOUNDS` table and **probes each file on load** — a pad
  only appears if its file actually exists, so you can add clips incrementally
  and never ship a broken button.
- Prefer short `.mp3` (broadest browser support) or `.ogg`. Keep them small.
- **Self-host** the clips here (don't hot-link archive.org / 101soundboards) so
  playback is reliable and CORS-free.
- Check each clip's licensing before committing.

## Expected filenames (matching the SOUNDS table)

Present (pads show now):

| file                         | pad label        |
| ---------------------------- | ---------------- |
| `dial-up-modem-sound.mp3`    | DIAL-UP          |
| `windows-98-startup.mp3`     | WIN 98 STARTUP   |
| `windows-98-shutdown.mp3`    | WIN 98 SHUTDOWN  |
| `windows-xp-startup.mp3`     | WIN XP STARTUP   |
| `windows-xp-shutdown.mp3`    | WIN XP SHUTDOWN  |

Forward-declared (drop the file and the pad appears — no code change needed):

| file              | pad label        |
| ----------------- | ---------------- |
| `aol-mail.mp3`    | YOU'VE GOT MAIL  |
| `aol-welcome.mp3` | WELCOME          |
| `aol-goodbye.mp3` | GOODBYE          |
| `aol-im.mp3`      | IM DOOR          |
| `coin.mp3`        | INSERT COIN      |
| `1up.mp3`         | 1-UP             |
| `error.mp3`       | ERROR            |
| `pager.mp3`       | PAGER            |
| `busy.mp3`        | BUSY SIGNAL      |
| `type.mp3`        | KEYBOARD         |
| `tada.mp3`        | TA-DA            |
| `ding.mp3`        | DING             |

To add a new pad, add a row to the `SOUNDS` array in
`src/tools/Soundboard.jsx` with `{ id, label, emoji, file: "sounds/yourfile.mp3" }`
and drop the file here.
