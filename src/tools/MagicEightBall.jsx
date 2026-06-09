import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDiscoveredLegendaries,
  recordLegendary,
  getEightBallMuted,
  setEightBallMuted,
} from "../lib/store.js";
import { playRare, playEpic, playLegendary, playMythic } from "../lib/blips.js";
import { renderEightBallCard } from "../lib/eightBallCard.js";
import { shareImage } from "../lib/share.js";
import goldenFloppy from "../assets/golden-floppy.png";
import mythicDisc from "../assets/mythic-disc.png";
import legendLocked from "../assets/legend-locked.png";
import legendRays from "../assets/legend-rays.png";

// ── Magic 8-Ball ─────────────────────────────────────────────────────────────
// Self-contained novelty tool. Injects its own theme. Single screen → the
// shell's "‹ BACK TO OURCADE" stays visible (no useArcadeBackButton needed).
//
// Answers carry a rarity. A weighted picker rolls a tier first (so the
// legendary rate stays ~1/333 no matter how many commons we add), then picks
// uniformly within that tier. RARE+ pulls flash a badge + play an escalating
// chime; LEGENDARY pulls trigger a full-screen celebration and get saved into
// the persistent "Hall of Legends" collection.

const RARITY = {
  common: { label: "COMMON", color: "#9fb4ff", weight: 0.8065 },
  rare: { label: "RARE", color: "#3fa9ff", weight: 0.15 },
  epic: { label: "EPIC", color: "#b44dff", weight: 0.04 },
  legendary: { label: "LEGENDARY", color: "#ffd23f", weight: 0.003 }, // ~1 in 333
  mythic: { label: "MYTHIC", color: "#ff6ad5", weight: 0.0005 }, // ~1 in 2000 — iridescent relic
};

const ANSWERS = [
  // ── COMMON ────────────────────────────────────────────────────────────────
  // classic affirmative
  { text: "It is certain.", tone: "yes", rarity: "common" },
  { text: "It is decidedly so.", tone: "yes", rarity: "common" },
  { text: "Without a doubt.", tone: "yes", rarity: "common" },
  { text: "Yes — definitely.", tone: "yes", rarity: "common" },
  { text: "You may rely on it.", tone: "yes", rarity: "common" },
  { text: "As I see it, yes.", tone: "yes", rarity: "common" },
  { text: "Most likely.", tone: "yes", rarity: "common" },
  { text: "Outlook good.", tone: "yes", rarity: "common" },
  { text: "Yes.", tone: "yes", rarity: "common" },
  { text: "Signs point to yes.", tone: "yes", rarity: "common" },
  // classic non-committal
  { text: "Reply hazy, try again.", tone: "maybe", rarity: "common" },
  { text: "Ask again later.", tone: "maybe", rarity: "common" },
  { text: "Better not tell you now.", tone: "maybe", rarity: "common" },
  { text: "Cannot predict now.", tone: "maybe", rarity: "common" },
  { text: "Concentrate and ask again.", tone: "maybe", rarity: "common" },
  // classic negative
  { text: "Don't count on it.", tone: "no", rarity: "common" },
  { text: "My reply is no.", tone: "no", rarity: "common" },
  { text: "My sources say no.", tone: "no", rarity: "common" },
  { text: "Outlook not so good.", tone: "no", rarity: "common" },
  { text: "Very doubtful.", tone: "no", rarity: "common" },
  // arcade-flavored classics
  { text: 'Signs point to "one more level."', tone: "yes", rarity: "common" },
  { text: "Yes. Your homework can wait.", tone: "yes", rarity: "common" },
  { text: "The pixels have spoken.", rarity: "common" },
  { text: "Outlook: extremely clicky.", rarity: "common" },
  { text: "The badger approves.", tone: "yes", rarity: "common" },
  { text: "Ask again after snack time.", tone: "maybe", rarity: "common" },
  { text: "Better save first.", tone: "maybe", rarity: "common" },
  { text: "Loading answer…", tone: "maybe", rarity: "common" },
  { text: "Definitely maybe.", tone: "maybe", rarity: "common" },
  { text: "The leaderboard believes in you.", tone: "yes", rarity: "common" },
  { text: "The internet says yes.", tone: "yes", rarity: "common" },
  { text: "Error 404: doubt not found.", tone: "yes", rarity: "common" },
  { text: "All signs point to GG.", tone: "yes", rarity: "common" },
  { text: "Proceed, adventurer.", tone: "yes", rarity: "common" },
  // fake-technical
  { text: "Connection established.", tone: "yes", rarity: "common" },
  { text: "Ping successful.", tone: "yes", rarity: "common" },
  { text: "Packet loss detected.", tone: "no", rarity: "common" },
  { text: "Reboot your expectations.", tone: "maybe", rarity: "common" },
  { text: "Server says yes.", tone: "yes", rarity: "common" },
  { text: "Server says no.", tone: "no", rarity: "common" },
  { text: "Stack overflow of uncertainty.", tone: "maybe", rarity: "common" },
  { text: "Compiling answer…", tone: "maybe", rarity: "common" },
  { text: "Downloading wisdom…", tone: "maybe", rarity: "common" },
  { text: "Upload complete.", tone: "yes", rarity: "common" },
  { text: "Error: too many questions.", tone: "maybe", rarity: "common" },
  // deliberately useless (tamer)
  { text: "Have you tried asking louder?", tone: "maybe", rarity: "common" },
  { text: "Turn it off and back on.", tone: "maybe", rarity: "common" },
  { text: "Ask your cat.", tone: "maybe", rarity: "common" },
  { text: "Reply hazy, making a sandwich.", tone: "maybe", rarity: "common" },
  { text: "I was AFK.", tone: "maybe", rarity: "common" },
  { text: "Brb.", tone: "maybe", rarity: "common" },
  { text: "Idk lol.", tone: "maybe", rarity: "common" },
  { text: "¯\\_(ツ)_/¯", tone: "maybe", rarity: "common" },
  { text: "Please insert Answer Disk 2.", tone: "maybe", rarity: "common" },

  // ── RARE ──────────────────────────────────────────────────────────────────
  // early internet
  { text: 'Your modem screams "yes."', tone: "yes", rarity: "rare" },
  { text: "The dial-up spirits approve.", tone: "yes", rarity: "rare" },
  { text: "GeoCities foretold this moment.", rarity: "rare" },
  { text: "An ancient forum thread says yes.", tone: "yes", rarity: "rare" },
  { text: "The webmaster nods solemnly.", rarity: "rare" },
  { text: "A dancing baby GIF confirms it.", tone: "yes", rarity: "rare" },
  { text: "The guestbook has spoken.", rarity: "rare" },
  { text: "Sources: trust me bro.", rarity: "rare" },
  { text: "The webring aligns in your favor.", tone: "yes", rarity: "rare" },
  { text: "The pixels are favorable today.", tone: "yes", rarity: "rare" },
  { text: "Consult the sacred bookmarks.", rarity: "rare" },
  { text: "A popup appeared. It said yes.", tone: "yes", rarity: "rare" },
  { text: "The old internet remembers.", rarity: "rare" },
  { text: "The cache contains good news.", tone: "yes", rarity: "rare" },
  // funny gaming
  { text: "Touch grass first.", tone: "no", rarity: "rare" },
  { text: "Skill issue.", tone: "no", rarity: "rare" },
  { text: "Have you tried jumping?", rarity: "rare" },
  { text: "Roll for initiative.", rarity: "rare" },
  { text: "The final boss says no.", tone: "no", rarity: "rare" },
  { text: "Critical success.", tone: "yes", rarity: "rare" },
  { text: "Critical failure.", tone: "no", rarity: "rare" },
  { text: "Respawn and try again.", tone: "maybe", rarity: "rare" },
  { text: "New quest accepted.", tone: "yes", rarity: "rare" },
  { text: "Side quest detected.", rarity: "rare" },
  { text: "Speedrunners disagree.", tone: "no", rarity: "rare" },
  { text: "RNG is feeling generous.", tone: "yes", rarity: "rare" },
  { text: "RNG is feeling violent.", tone: "no", rarity: "rare" },
  { text: "Achievement unlocked: Question Asked.", rarity: "rare" },
  // computer lab mode
  { text: "The teacher is approaching.", tone: "no", rarity: "rare" },
  { text: "Alt-tab immediately.", tone: "no", rarity: "rare" },
  { text: "Better keep the volume down.", tone: "maybe", rarity: "rare" },
  { text: "The school firewall approves.", tone: "yes", rarity: "rare" },
  { text: "You've got 12 minutes before class.", rarity: "rare" },
  { text: "This was definitely educational.", rarity: "rare" },
  { text: "The computer lab gods smile upon you.", tone: "yes", rarity: "rare" },
  { text: "Proceed before the bell rings.", tone: "yes", rarity: "rare" },
  { text: "The substitute teacher won't notice.", tone: "yes", rarity: "rare" },
  { text: "Your browser history remains secure.", rarity: "rare" },
  // byte badger
  { text: "Byte Badger found a hidden shortcut.", rarity: "rare" },
  { text: "Byte Badger says absolutely.", tone: "yes", rarity: "rare" },
  { text: "Byte Badger is busy gaming.", rarity: "rare" },
  { text: "Byte Badger wouldn't risk it.", tone: "no", rarity: "rare" },
  { text: "Byte Badger found something suspicious.", rarity: "rare" },
  { text: "Byte Badger dug up a yes.", tone: "yes", rarity: "rare" },
  { text: "Byte Badger needs another Mountain Dew.", rarity: "rare" },
  { text: "Byte Badger checked the strategy guide.", rarity: "rare" },
  // chaotic-technical
  { text: "Kernel panic.", tone: "no", rarity: "rare" },
  { text: "Unexpected success.", tone: "yes", rarity: "rare" },
  { text: "Unexpected success. Again.", tone: "yes", rarity: "rare" },
  // useless-rare
  { text: "The answer is in another castle.", rarity: "rare" },
  { text: "My lawyer advises uncertainty.", tone: "maybe", rarity: "rare" },
  { text: "Ask Jeeves.", rarity: "rare" },
  { text: "Consult the nearest squirrel.", rarity: "rare" },

  // ── EPIC ──────────────────────────────────────────────────────────────────
  // slightly chaotic
  { text: "Legally, I cannot answer that.", rarity: "epic" },
  { text: "The answer is yes. The consequences are unknown.", rarity: "epic" },
  { text: "I rolled the dice. Good luck.", rarity: "epic" },
  { text: "Weirdly enough, yes.", tone: "yes", rarity: "epic" },
  { text: "This feels like a terrible idea.", tone: "no", rarity: "epic" },
  { text: "This feels like an excellent terrible idea.", rarity: "epic" },
  { text: "The vibes are immaculate.", tone: "yes", rarity: "epic" },
  { text: "The vibes are cursed.", tone: "no", rarity: "epic" },
  { text: "Ask your future self.", rarity: "epic" },
  { text: "Future you is laughing already.", rarity: "epic" },
  { text: "Future you is filing a complaint.", rarity: "epic" },
  { text: "Nobody knows what this button does.", rarity: "epic" },
  { text: "Click it and find out.", rarity: "epic" },
  // hidden game
  { text: "You found a secret room.", rarity: "epic" },
  { text: "There's definitely treasure behind that wall.", rarity: "epic" },
  { text: "Hit every suspicious brick.", rarity: "epic" },
  { text: "Check behind the waterfall.", rarity: "epic" },
  { text: "The answer was here all along.", rarity: "epic" },
  { text: "You missed a hidden collectible.", rarity: "epic" },
  { text: "Try talking to the NPC again.", rarity: "epic" },
  { text: "The chicken knows.", rarity: "epic" },
  { text: "The suspicious barrel contains answers.", rarity: "epic" },
  { text: "There is absolutely a secret ending.", tone: "yes", rarity: "epic" },
  // byte badger (punchiest)
  { text: "Byte Badger rolled a natural 20.", tone: "yes", rarity: "epic" },
  { text: 'Byte Badger says "send it."', tone: "yes", rarity: "epic" },

  // ── LEGENDARY ─────────────────────────────────────────────────────────────
  // stable ids → the Hall of Legends collection survives text edits
  { id: "golden-floppy", text: "You have discovered the golden floppy disk.", tone: "yes", rarity: "legendary" },
  { id: "prophecy", text: "The prophecy is fulfilled.", tone: "yes", rarity: "legendary" },
  { id: "legendary-drop", text: "A legendary drop has appeared.", tone: "yes", rarity: "legendary" },
  { id: "internet-owes-you", text: "The internet owes you one.", tone: "yes", rarity: "legendary" },
  { id: "main-character", text: "Congratulations, you're the main character today.", tone: "yes", rarity: "legendary" },
  { id: "final-pixel", text: "The final pixel has been found.", tone: "yes", rarity: "legendary" },
  { id: "developer-mode", text: "You unlocked developer mode.", tone: "yes", rarity: "legendary" },
  { id: "cheat-code", text: "The cheat code worked.", tone: "yes", rarity: "legendary" },
  { id: "peak-nostalgia", text: "You have achieved peak nostalgia.", tone: "yes", rarity: "legendary" },
  { id: "badger-salutes", text: "The badger salutes you.", tone: "yes", rarity: "legendary" },

  // ── MYTHIC ────────────────────────────────────────────────────────────────
  // ~1 in 2000. Not answers — unearthed cultural relics. Each is a thing you'd
  // literally read off a screen, which is exactly what the 8-ball window is.
  { id: "safe-to-turn-off", text: "It is now safe to turn off your computer.", tone: "yes", rarity: "mythic" },
  { id: "died-of-dysentery", text: "You have died of dysentery.", tone: "no", rarity: "mythic" },
  { id: "youve-got-mail", text: "You've got mail!", tone: "yes", rarity: "mythic" },
];

// Hall collection, rarest first: mythic relics, then legendaries.
const MYTHICS = ANSWERS.filter((a) => a.rarity === "mythic");
const LEGENDS = ANSWERS.filter((a) => a.rarity === "legendary");
const COLLECTIBLES = [...MYTHICS, ...LEGENDS];

const TONE = { yes: "#3fffd0", maybe: "#ffd23f", no: "#ff6a8a" };

// Weighted pick: roll a tier by cumulative weight, then pick within it.
function pickAnswer() {
  const r = Math.random();
  let acc = 0;
  let tier = "common";
  for (const key of ["mythic", "legendary", "epic", "rare", "common"]) {
    acc += RARITY[key].weight;
    if (r < acc) {
      tier = key;
      break;
    }
  }
  let pool = ANSWERS.filter((a) => a.rarity === tier);
  if (!pool.length) pool = ANSWERS.filter((a) => a.rarity === "common");
  return pool[Math.floor(Math.random() * pool.length)];
}

// Color the answer text by rarity for rare+, by tone for commons.
function answerColor(a) {
  if (a.rarity !== "common") return RARITY[a.rarity].color;
  return a.tone ? TONE[a.tone] : "#9fb4ff";
}

// Hidden gag: certain "magic word" phrases summon Dennis Nedry's finger-wag
// ("ah ah ah, you didn't say the magic word!") instead of an answer.
const MAGIC_WORDS = [
  "magic word",
  "say the magic word",
  "the magic word",
  "abracadabra",
  "open sesame",
  "please",
  "pretty please",
  "say please",
];
function isMagicWord(text) {
  const t = String(text || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  return MAGIC_WORDS.some((w) => t === w || t.includes(w));
}

const CONFETTI_COLORS = ["#ffd23f", "#3fffd0", "#b44dff", "#3fa9ff", "#ff6a8a", "#ffffff"];
// Mythic rains a fuller iridescent rainbow to read as a tier above gold.
const MYTHIC_CONFETTI = ["#ff5e7e", "#ff9e42", "#ffe14d", "#5dff9b", "#3fd0ff", "#7a6bff", "#ff6ad5"];

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #07080f;
    color: #eef0ff;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }

  .eb-app {
    min-height: 100vh; padding: 28px 16px 80px;
    display: flex; flex-direction: column; align-items: center;
    background:
      radial-gradient(ellipse 60% 45% at 50% 0%, rgba(63,255,208,.10), transparent 70%),
      radial-gradient(ellipse 50% 50% at 50% 100%, rgba(180,77,255,.08), transparent 65%),
      #07080f;
  }

  .eb-head { text-align: center; margin-bottom: 24px; }
  .eb-head h1 {
    font-family: 'Black Ops One', 'Impact', sans-serif;
    font-size: clamp(2rem, 7vw, 3.2rem); letter-spacing: 0.06em;
    background: linear-gradient(180deg, #fff, #3fffd0 60%, #b44dff 120%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 0 28px rgba(63,255,208,.3);
  }
  .eb-head .sub { font-size: 0.62rem; letter-spacing: 0.3em; text-transform: uppercase; color: #6b708f; margin-top: 6px; }

  .eb-ask {
    width: min(440px, 92vw); display: flex; gap: 8px; margin-bottom: 34px;
  }
  .eb-input {
    flex: 1; padding: 13px 14px; border-radius: 9px;
    background: #0e101a; color: #eef0ff; border: 2px solid #2a2f4a;
    font-family: 'Share Tech Mono', monospace; font-size: 0.95rem;
  }
  .eb-input:focus { outline: none; border-color: #3fffd0; }
  .eb-go {
    padding: 0 18px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P', monospace; font-size: 0.66rem; letter-spacing: 0.05em;
    color: #0a0a12; background: linear-gradient(180deg, #fff, #3fffd0); border: 2px solid #0a0a12;
  }
  .eb-go:disabled { opacity: .5; cursor: not-allowed; }

  .eb-ball {
    position: relative; width: min(300px, 80vw); height: min(300px, 80vw);
    border-radius: 50%; cursor: pointer; user-select: none;
    background: radial-gradient(circle at 34% 28%, #4a4f6b 0%, #1a1c28 38%, #050608 78%);
    box-shadow: inset -16px -20px 40px rgba(0,0,0,.85), inset 10px 12px 26px rgba(255,255,255,.08), 0 22px 50px rgba(0,0,0,.6);
    display: flex; align-items: center; justify-content: center;
  }
  .eb-ball::before {
    content: ""; position: absolute; top: 12%; left: 22%;
    width: 26%; height: 18%; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.5), transparent 70%);
    filter: blur(4px);
  }
  .eb-ball.shaking { animation: eb-shake .5s ease-in-out 2; }
  @keyframes eb-shake {
    0%,100% { transform: translate(0,0) rotate(0); }
    20% { transform: translate(-9px,5px) rotate(-5deg); }
    40% { transform: translate(8px,-6px) rotate(4deg); }
    60% { transform: translate(-7px,6px) rotate(-3deg); }
    80% { transform: translate(7px,-4px) rotate(3deg); }
  }

  /* the iconic blue triangle window */
  .eb-window {
    width: 58%; height: 58%; border-radius: 50%;
    background: radial-gradient(circle at 50% 42%, #16345e, #071226 75%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    box-shadow: inset 0 0 30px rgba(0,0,0,.9);
    overflow: hidden; padding: 8%; gap: 6px;
  }
  .eb-triangle {
    text-align: center; line-height: 1.25;
    font-family: 'Share Tech Mono', monospace; font-weight: 700;
    font-size: clamp(0.78rem, 3.4vw, 1.05rem);
    text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--tone, #9fb4ff);
    text-shadow: 0 0 12px var(--tone, #6a8cff);
    animation: eb-rise .5s ease;
  }
  @keyframes eb-rise { from { opacity: 0; transform: translateY(10px) scale(.85); } to { opacity: 1; transform: none; } }
  .eb-8 { font-family: 'Black Ops One', sans-serif; font-size: 3rem; color: #07080f;
    background: #f4f4f6; width: 64%; height: 64%; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: inset 0 -6px 10px rgba(0,0,0,.25); }
  .eb-hint { margin-top: 22px; font-size: 0.66rem; letter-spacing: 0.2em; text-transform: uppercase; color: #6b708f; }

  /* ── rarity badge (rare and above only) ─────────────────────────────────── */
  .eb-badge {
    font-family: 'Press Start 2P', monospace; font-size: 0.5rem; letter-spacing: 0.12em;
    padding: 4px 8px; border-radius: 4px; text-transform: uppercase;
    color: var(--rarity, #fff); border: 1px solid var(--rarity, #fff);
    background: rgba(0,0,0,.45); box-shadow: 0 0 10px var(--rarity, #fff);
    animation: eb-badge-pop .45s cubic-bezier(.2,1.5,.4,1);
  }
  .eb-badge.legendary { animation: eb-badge-pop .45s cubic-bezier(.2,1.5,.4,1), eb-shimmer 1.4s linear infinite .45s; }
  .eb-badge.mythic {
    color: #fff; border-color: #fff;
    animation: eb-badge-pop .45s cubic-bezier(.2,1.5,.4,1), eb-rainbow 2.2s linear infinite .45s;
  }
  @keyframes eb-badge-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
  @keyframes eb-shimmer {
    0%,100% { box-shadow: 0 0 8px var(--rarity); }
    50% { box-shadow: 0 0 22px var(--rarity), 0 0 4px #fff; }
  }
  /* mythic = hue-cycling iridescent glow, used by the badge, title, and frames */
  @keyframes eb-rainbow {
    0% { box-shadow: 0 0 14px #ff5e7e; border-color: #ff5e7e; }
    33% { box-shadow: 0 0 14px #5dff9b; border-color: #5dff9b; }
    66% { box-shadow: 0 0 14px #3fd0ff; border-color: #3fd0ff; }
    100% { box-shadow: 0 0 14px #ff5e7e; border-color: #ff5e7e; }
  }
  @keyframes eb-hue { from { filter: hue-rotate(0); } to { filter: hue-rotate(360deg); } }

  /* ── controls row (hall button + mute) ──────────────────────────────────── */
  .eb-controls { margin-top: 18px; display: flex; gap: 10px; align-items: center; }
  .eb-pill {
    font-family: 'Press Start 2P', monospace; font-size: 0.56rem; letter-spacing: 0.06em;
    padding: 9px 12px; border-radius: 8px; cursor: pointer;
    color: #ffd23f; background: #0e101a; border: 2px solid #3a2f12;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .eb-pill:hover { border-color: #ffd23f; }
  .eb-pill:disabled { opacity: .6; cursor: default; }
  .eb-share {
    margin-top: 16px; color: #3fffd0; border-color: #16463c;
  }
  .eb-share:hover { border-color: #3fffd0; }

  /* ── secret "magic word" gag overlay ────────────────────────────────────── */
  .eb-nedry {
    position: fixed; inset: 0; z-index: 60; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 18px; text-align: center; padding: 24px;
    background: radial-gradient(ellipse at 50% 45%, rgba(8,20,40,.9), rgba(3,3,8,.97) 70%);
    animation: eb-fade .3s ease;
  }
  .eb-nedry-gif {
    width: clamp(200px, 56vw, 340px); height: auto; border-radius: 10px;
    box-shadow: 0 0 36px rgba(63,169,255,.45);
    animation: eb-floppy-in .6s cubic-bezier(.2,1.4,.4,1);
  }
  .eb-nedry-quote {
    max-width: 26ch; font-family: 'Press Start 2P', monospace;
    font-size: clamp(0.7rem, 3.2vw, 1rem); line-height: 1.8; letter-spacing: 0.06em;
    color: #ffd23f; text-shadow: 0 0 16px rgba(255,210,63,.6);
  }
  .eb-mute {
    font-family: 'Share Tech Mono', monospace; font-size: 1rem;
    padding: 8px 10px; border-radius: 8px; cursor: pointer; line-height: 1;
    color: #eef0ff; background: #0e101a; border: 2px solid #2a2f4a;
  }
  .eb-mute:hover { border-color: #3fffd0; }

  /* ── legendary celebration overlay ──────────────────────────────────────── */
  .eb-cele {
    position: fixed; inset: 0; z-index: 60; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 24px; overflow: hidden;
    background: radial-gradient(ellipse at 50% 45%, rgba(40,30,5,.85), rgba(3,3,8,.96) 70%);
    animation: eb-fade .35s ease;
  }
  @keyframes eb-fade { from { opacity: 0; } to { opacity: 1; } }
  /* rays backdrop sits behind everything; all the text/floppy float above it */
  .eb-cele-rays {
    position: absolute; top: 50%; left: 50%; z-index: 0; pointer-events: none;
    width: min(120vh, 150vw); height: auto; transform: translate(-50%,-50%);
    animation: eb-rays-fade .8s ease both, eb-spin 26s linear infinite;
  }
  @keyframes eb-rays-fade { from { opacity: 0; } to { opacity: .5; } }
  @keyframes eb-spin { from { transform: translate(-50%,-50%) rotate(0); } to { transform: translate(-50%,-50%) rotate(360deg); } }
  .eb-cele-floppy, .eb-cele-title, .eb-cele-text, .eb-cele-new, .eb-cele-seen, .eb-cele-dismiss {
    position: relative; z-index: 2;
  }
  .eb-confetti { z-index: 1; }
  .eb-cele-floppy {
    width: clamp(120px, 34vw, 240px); height: auto;
    filter: drop-shadow(0 0 26px rgba(255,210,63,.85));
    animation: eb-floppy-in .8s cubic-bezier(.2,1.4,.4,1), eb-float 2.6s ease-in-out infinite .8s;
  }
  @keyframes eb-floppy-in { from { opacity: 0; transform: translateY(40px) scale(.4) rotate(-25deg); } to { opacity: 1; transform: none; } }
  @keyframes eb-float { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-12px) rotate(3deg); } }
  .eb-cele-title {
    margin-top: 18px; font-family: 'Black Ops One', 'Impact', sans-serif;
    font-size: clamp(1.4rem, 6vw, 2.6rem); letter-spacing: 0.08em; color: #ffd23f;
    text-shadow: 0 0 18px rgba(255,210,63,.8), 2px 2px 0 #b44dff, -2px -2px 0 #3fffd0;
    animation: eb-glitch .12s steps(2) infinite;
  }
  @keyframes eb-glitch {
    0% { transform: translate(0,0); } 25% { transform: translate(-1px,1px); }
    50% { transform: translate(1px,-1px); } 75% { transform: translate(-1px,-1px); }
  }
  /* ── mythic relic overrides: iridescent instead of gold ─────────────────── */
  .eb-cele.mythic { background: radial-gradient(ellipse at 50% 45%, rgba(40,8,48,.88), rgba(3,3,8,.97) 70%); }
  .eb-cele.mythic .eb-cele-rays {
    animation: eb-rays-fade .8s ease both, eb-spin 26s linear infinite, eb-hue 6s linear infinite;
  }
  .eb-cele.mythic .eb-cele-floppy {
    animation: eb-floppy-in .8s cubic-bezier(.2,1.4,.4,1), eb-float 2.6s ease-in-out infinite .8s,
      eb-disc-glow 6s linear infinite;
  }
  @keyframes eb-disc-glow {
    from { filter: drop-shadow(0 0 30px rgba(255,255,255,.9)) hue-rotate(0); }
    to { filter: drop-shadow(0 0 30px rgba(255,255,255,.9)) hue-rotate(360deg); }
  }
  .eb-cele.mythic .eb-cele-title {
    color: #fff; text-shadow: 0 0 22px rgba(255,255,255,.7), 2px 2px 0 #ff6ad5, -2px -2px 0 #3fd0ff;
    animation: eb-glitch .12s steps(2) infinite, eb-text-rainbow 4s linear infinite;
  }
  @keyframes eb-text-rainbow {
    0% { color: #ff5e7e; } 25% { color: #ffe14d; } 50% { color: #5dff9b; }
    75% { color: #3fd0ff; } 100% { color: #ff5e7e; }
  }
  .eb-cele-text {
    margin-top: 14px; max-width: 32ch; font-family: 'Share Tech Mono', monospace;
    font-size: clamp(0.9rem, 3.6vw, 1.2rem); color: #fff; text-shadow: 0 0 10px rgba(255,255,255,.4);
  }
  .eb-cele-new {
    margin-top: 16px; display: inline-block; transform: rotate(-6deg);
    font-family: 'Press Start 2P', monospace; font-size: 0.7rem; letter-spacing: 0.1em;
    color: #07080f; background: #3fffd0; padding: 7px 12px; border-radius: 6px;
    box-shadow: 0 0 18px #3fffd0; animation: eb-stamp .5s cubic-bezier(.2,1.8,.4,1) .4s both;
  }
  @keyframes eb-stamp { from { opacity: 0; transform: rotate(-6deg) scale(2.4); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
  .eb-cele-seen { margin-top: 16px; font-size: 0.66rem; letter-spacing: 0.2em; text-transform: uppercase; color: #b9a25a; }
  .eb-cele-dismiss { margin-top: 22px; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #6b708f; }
  .eb-confetti { position: absolute; top: -16px; width: 9px; height: 9px; opacity: .95; animation: eb-fall linear forwards; }
  @keyframes eb-fall {
    to { transform: translateY(110vh) rotate(720deg); opacity: .2; }
  }

  /* ── Hall of Legends panel ──────────────────────────────────────────────── */
  .eb-hall-back {
    position: fixed; inset: 0; z-index: 55; background: rgba(3,3,8,.86);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 16px; overflow-y: auto; animation: eb-fade .25s ease;
  }
  .eb-hall {
    width: min(720px, 96vw); background: #0b0d16; border: 2px solid #3a2f12;
    border-radius: 14px; padding: 22px; box-shadow: 0 0 50px rgba(255,210,63,.15);
  }
  .eb-hall-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 12px; }
  .eb-hall-head h2 {
    font-family: 'Black Ops One', sans-serif; font-size: 1.3rem; letter-spacing: 0.05em; color: #ffd23f;
    text-shadow: 0 0 16px rgba(255,210,63,.5);
  }
  .eb-hall-close { cursor: pointer; background: none; border: none; color: #6b708f; font-size: 1.6rem; line-height: 1; }
  .eb-hall-close:hover { color: #fff; }
  .eb-hall-sub { font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase; color: #6b708f; margin-bottom: 18px; }
  .eb-hall-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .eb-card {
    border-radius: 10px; padding: 14px 12px; text-align: center; min-height: 132px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  }
  .eb-card.found {
    background: radial-gradient(circle at 50% 30%, rgba(255,210,63,.14), #0e101a 75%);
    border: 1px solid #6b551c;
  }
  .eb-card.locked { background: #0e101a; border: 1px dashed #2a2f4a; }
  .eb-card-icon { width: 56px; height: 56px; object-fit: contain; }
  .eb-card.found .eb-card-icon { filter: drop-shadow(0 0 8px rgba(255,210,63,.7)); }
  .eb-card.locked .eb-card-icon { opacity: .85; }
  .eb-card-text { font-size: 0.74rem; line-height: 1.25; color: #e7e9ff; }
  .eb-card.locked .eb-card-text { color: #4a4f6b; letter-spacing: 0.2em; }
  .eb-card-date { font-size: 0.54rem; letter-spacing: 0.12em; text-transform: uppercase; color: #b9a25a; }
  /* mythic relic cards stand apart from the gold legendaries */
  .eb-card.mythic.found {
    position: relative;
    background: radial-gradient(circle at 50% 30%, rgba(255,106,213,.16), #0e101a 78%);
    border: 1px solid #ff6ad5; animation: eb-rainbow 3.4s linear infinite;
  }
  .eb-card.mythic.found .eb-card-icon { filter: drop-shadow(0 0 9px rgba(255,255,255,.85)); }
  .eb-card-tier {
    position: absolute; top: 7px; left: 50%; transform: translateX(-50%);
    font-family: 'Press Start 2P', monospace; font-size: 0.4rem; letter-spacing: 0.12em;
    color: #fff; padding: 3px 6px; border-radius: 3px; background: rgba(0,0,0,.4);
    animation: eb-rainbow 3.4s linear infinite;
  }
`;

// Confetti pieces — generated once per celebration. Mythic drops more pieces
// in a fuller rainbow.
function Confetti({ mythic = false }) {
  const pieces = useMemo(() => {
    const palette = mythic ? MYTHIC_CONFETTI : CONFETTI_COLORS;
    const count = mythic ? 110 : 70;
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 2.2 + Math.random() * 1.8,
      size: 6 + Math.random() * 8,
      color: palette[i % palette.length],
      round: Math.random() < 0.3,
    }));
  }, [mythic]);
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.key}
          className="eb-confetti"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: p.round ? "50%" : "1px",
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function MagicEightBall() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [shaking, setShaking] = useState(false);
  const [celebrate, setCelebrate] = useState(null); // { answer, isNew } | null
  const [hallOpen, setHallOpen] = useState(false);
  const [discovered, setDiscovered] = useState(() => getDiscoveredLegendaries());
  const [muted, setMuted] = useState(() => getEightBallMuted());
  const [nedry, setNedry] = useState(false);
  const [shareStatus, setShareStatus] = useState(null); // "shared" | "saved" | "failed" | "working" | null
  const timer = useRef(null);
  const celeTimer = useRef(null);
  const nedryTimer = useRef(null);
  const shareTimer = useRef(null);

  const ask = () => {
    if (shaking) return;
    // Secret "magic word" gag: skip the answer entirely and wag a finger.
    if (isMagicWord(question)) {
      setNedry(true);
      clearTimeout(nedryTimer.current);
      nedryTimer.current = setTimeout(() => setNedry(false), 4600);
      return;
    }
    setShaking(true);
    setAnswer(null);
    const a = pickAnswer();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAnswer(a);
      setShaking(false);
      if (!muted) {
        if (a.rarity === "rare") playRare();
        else if (a.rarity === "epic") playEpic();
        else if (a.rarity === "legendary") playLegendary();
        else if (a.rarity === "mythic") playMythic();
      }
      // Both top tiers get the celebration + Hall slot; the relic tier just
      // renders grander (see the `mythic` branch in the overlay below).
      if (a.rarity === "legendary" || a.rarity === "mythic") {
        const { found, isNew } = recordLegendary(a.id);
        setDiscovered(found);
        setCelebrate({ answer: a, isNew });
      }
    }, 1050);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setEightBallMuted(next);
  };

  // Auto-dismiss the celebration after a few seconds.
  useEffect(() => {
    if (!celebrate) return;
    clearTimeout(celeTimer.current);
    celeTimer.current = setTimeout(() => setCelebrate(null), 4600);
    return () => clearTimeout(celeTimer.current);
  }, [celebrate]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    clearTimeout(celeTimer.current);
    clearTimeout(nedryTimer.current);
    clearTimeout(shareTimer.current);
  }, []);

  const shareAnswer = async () => {
    if (!answer || shareStatus === "working") return;
    setShareStatus("working");
    try {
      const blob = await renderEightBallCard({ question, answer });
      const result = await shareImage({
        blob,
        filename: "ourcade-8ball.png",
        title: "Ourcade — Magic 8-Ball",
        text: question ? `I asked the Magic 8-Ball: “${question}”` : "The Magic 8-Ball says…",
      });
      setShareStatus(result === "cancelled" ? null : result);
    } catch {
      setShareStatus("failed");
    }
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareStatus(null), 2200);
  };

  const foundIds = new Set(discovered.map((d) => d.id));
  const foundCount = COLLECTIBLES.filter((l) => foundIds.has(l.id)).length;
  const dateById = Object.fromEntries(discovered.map((d) => [d.id, d.at]));

  return (
    <>
      <style>{style}</style>
      <div className="eb-app">
        <div className="eb-head">
          <h1>MAGIC 8-BALL</h1>
          <div className="sub">ask a yes/no question · shake · receive wisdom</div>
        </div>

        <form
          className="eb-ask"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            className="eb-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will it be a good day?"
            maxLength={120}
          />
          <button className="eb-go" type="submit" disabled={shaking}>
            ASK
          </button>
        </form>

        <div
          className={`eb-ball ${shaking ? "shaking" : ""}`}
          onClick={ask}
          role="button"
          aria-label="Shake the magic 8-ball"
        >
          {!answer && !shaking && <div className="eb-8">8</div>}
          {(answer || shaking) && (
            <div className="eb-window">
              {shaking ? (
                <div className="eb-triangle" style={{ "--tone": "#6a8cff" }}>
                  …
                </div>
              ) : (
                <>
                  {answer.rarity !== "common" && (
                    <span
                      className={`eb-badge ${answer.rarity}`}
                      style={{ "--rarity": RARITY[answer.rarity].color }}
                    >
                      {RARITY[answer.rarity].label}
                    </span>
                  )}
                  <div className="eb-triangle" style={{ "--tone": answerColor(answer) }}>
                    {answer.text}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="eb-hint">— tap the ball to ask again —</div>

        {answer && !shaking && (
          <button className="eb-pill eb-share" onClick={shareAnswer} disabled={shareStatus === "working"}>
            {shareStatus === "shared"
              ? "✓ Shared!"
              : shareStatus === "saved"
                ? "✓ Saved!"
                : shareStatus === "failed"
                  ? "Couldn’t share"
                  : shareStatus === "working"
                    ? "…rendering"
                    : "📸 Share this answer"}
          </button>
        )}

        <div className="eb-controls">
          {/* The Hall stays hidden until the first legendary/mythic find — its
              existence is part of the surprise. */}
          {discovered.length > 0 && (
            <button className="eb-pill" onClick={() => setHallOpen(true)}>
              🏆 HALL OF LEGENDS ▸ {foundCount}/{COLLECTIBLES.length}
            </button>
          )}
          <button
            className="eb-mute"
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            title={muted ? "Sound off" : "Sound on"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {/* ── secret "magic word" gag (Dennis Nedry) ──────────────────────── */}
      {nedry && (
        <div className="eb-nedry" onClick={() => setNedry(false)}>
          <img className="eb-nedry-gif" src="/nedry-wag.gif" alt="A finger wags: ah ah ah!" />
          <div className="eb-nedry-quote">Ah ah ah — you didn’t say the magic word!</div>
          <div className="eb-cele-dismiss">— click anywhere to dismiss —</div>
        </div>
      )}

      {/* ── legendary / mythic celebration ──────────────────────────────── */}
      {celebrate && (() => {
        const isMythic = celebrate.answer.rarity === "mythic";
        return (
          <div className={`eb-cele ${isMythic ? "mythic" : ""}`} onClick={() => setCelebrate(null)}>
            <img className="eb-cele-rays" src={legendRays} alt="" aria-hidden="true" />
            <Confetti mythic={isMythic} />
            <img
              className="eb-cele-floppy"
              src={isMythic ? mythicDisc : goldenFloppy}
              alt={isMythic ? "iridescent relic disc" : "golden floppy disk"}
            />
            <div className="eb-cele-title">
              {isMythic ? "✦ MYTHIC RELIC ✦" : "★ LEGENDARY DISCOVERED ★"}
            </div>
            <div className="eb-cele-text">{celebrate.answer.text}</div>
            {celebrate.isNew ? (
              <span className="eb-cele-new">NEW! ADDED TO YOUR HALL</span>
            ) : (
              <div className="eb-cele-seen">already in your collection</div>
            )}
            <div className="eb-cele-dismiss">— click anywhere to dismiss —</div>
          </div>
        );
      })()}

      {/* ── Hall of Legends ─────────────────────────────────────────────── */}
      {hallOpen && (
        <div className="eb-hall-back" onClick={() => setHallOpen(false)}>
          <div className="eb-hall" onClick={(e) => e.stopPropagation()}>
            <div className="eb-hall-head">
              <h2>🏆 Hall of Legends</h2>
              <button className="eb-hall-close" onClick={() => setHallOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="eb-hall-sub">
              {foundCount} of {COLLECTIBLES.length} relics & legends discovered
            </div>
            <div className="eb-hall-grid">
              {COLLECTIBLES.map((l) => {
                const found = foundIds.has(l.id);
                const isMythic = l.rarity === "mythic";
                return (
                  <div
                    key={l.id}
                    className={`eb-card ${found ? "found" : "locked"} ${isMythic ? "mythic" : ""}`}
                  >
                    {found && isMythic && <span className="eb-card-tier">MYTHIC</span>}
                    <img
                      className="eb-card-icon"
                      src={found ? (isMythic ? mythicDisc : goldenFloppy) : legendLocked}
                      alt={found ? (isMythic ? "mythic relic found" : "legendary found") : "undiscovered"}
                    />
                    <div className="eb-card-text">{found ? l.text : "? ? ?"}</div>
                    {found && dateById[l.id] && (
                      <div className="eb-card-date">{formatDate(dateById[l.id])}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
