/* ─────────────────────────────────────────────────────────────────────────
   NAME-O-TRON 3000  ·  hand-edit content pool  ·  edit this file by hand
   (part of the hand-edit hub in src/data/manual/ — see README.md there)

   Powers the /play/name-o-tron toy. The engine in src/tools/NameORon.jsx reads
   the actual letters of whatever you type, scores six stat bars from real
   features of the input, then picks a VERDICT from the buckets below. It's all
   DETERMINISTIC — the same name always gives the same reading (so a shared card
   reproduces for the friend who opens it) — but the mapping is deliberately
   opaque, so it feels like a real machine read you.

   HOW TO ADD LINES
   - Paste plain one-liners, ≤ ~60 chars, PG-13, in the OURCADE voice:
     early-2000s internet / Newgrounds / school-computer-lab nostalgia — dry,
     warm, a little chaotic, never mean. (Same voice as SYSTEM_BASE in
     scripts/generate-content.js — point ChatGPT at that tone.)
   - A VERDICTS entry can be a bare string (treated as a common, always-eligible
     line) OR an object { text, tags?, tier? } for the conditional/rare magic:
       tags:  any of "skill" | "mystery" | "charisma" | "patience" | "destiny"
              | "coolness"  → the line only surfaces when that stat is the
              dominant (highest) bar, so a high-skill reading SAYS skill things.
              Also feature tags: "palindrome" | "allcaps" | "hasdigit" | "long".
       tier:  "rare" | "secret"  → unlocked only by a seeded roll (rare ~1/12,
              secret ~1/60) or by a feature trigger; flashes an ⚠ ANOMALY chip.
   - Dupes are harmless. Leave any bucket as-is; the engine falls back to the
     common pool when a tagged bucket is empty, and to a built-in line if you
     somehow empty VERDICTS entirely.
   - After editing, `npm run build` is enough to verify it loads.
   ───────────────────────────────────────────────────────────────────────── */

// ── VERDICTS ────────────────────────────────────────────────────────────────
// Mix of bare strings (common) and tagged/tiered objects. Paste freely.
export const VERDICTS = [
  // ── common (always eligible) ──────────────────────────────────────────────
  "Born to top the leaderboard.",
  "404: chill not found.",
  "Certified webring royalty.",
  "Would absolutely beat the final boss on the first try.",
  "Powered entirely by Mountain Dew and spite.",
  "Suspiciously good at hiding the browser tab.",
  "A rare drop. Handle with care.",
  "Peaked during the GeoCities era. Still peaking.",
  "Has definitely rage-quit at least once today.",
  "The kind of legend forums whisper about.",
  "Reads the patch notes. All of them.",
  "Loading personality… 99%… (it's fine).",
  "Touch grass? Couldn't be this one.",
  "Built different. Possibly out of LEGO.",
  "The chosen one of the computer lab.",
  "Mostly harmless. Occasionally glorious.",
  "Speedrun of life: any%, no resets.",
  "Guestbook says: an absolute icon.",
  "Runs at a stable 60fps under pressure.",
  "Probably hoarding rare floppy disks.",
  "Last saved their game in 2004. Still going.",
  "Comes with a free trial that never ends.",
  "Would survive a school-network firewall.",
  "Alt-tabs faster than the teacher walks.",
  "Has a folder named 'homework' full of games.",
  "Beat the level. Refused to read the instructions.",
  "The screensaver everyone stopped to watch.",
  "Vibes optimized for a 56k connection.",
  "Unskippable cutscene of a human being.",
  "Sponsored by Capri-Sun and pure audacity.",
  "Wears socks with sandals in the metaverse.",
  "The reason the 'are you sure?' popup exists.",
  "Saved over the wrong file once. Never recovered.",
  "Owns the high score AND the snack stash.",
  "Boots up faster than your patience.",
  "Lives life on hard mode, no cheat codes.",
  "Their aura is still rendering.",
  "Certified hall-pass speedrunner.",
  "Could make a Tamagotchi live forever.",
  "Quietly the final boss of group projects.",
  "Has never once read the terms and conditions.",
  "Blows on the cartridge before any big decision.",
  "Powered by nostalgia and one good playlist.",
  "Would absolutely trust a 'free iPod' banner.",
  "Carries the team and the AUX cord.",
  "The human equivalent of a lucky save point.",
  "Still has a MySpace Top 8. You're not on it.",
  "Refuses to update. The vibes are perfect as-is.",
  "Wins the staring contest with the loading screen.",
  "Doodled in the margins, aced it anyway.",

  // ── stat-themed (surface when that stat is the dominant bar) ──────────────
  // coolness
  { text: "Too cool to defragment.", tags: ["coolness"] },
  { text: "Sunglasses emoji, but as a person.", tags: ["coolness"] },
  { text: "Walks in slow-mo. There's no explosion. Yet.", tags: ["coolness"] },
  { text: "Effortless. Annoyingly so.", tags: ["coolness"] },
  { text: "The 'cool S' everyone drew in 7th grade.", tags: ["coolness"] },
  { text: "Never panics. Just buffers stylishly.", tags: ["coolness"] },
  { text: "Could pull off frosted tips. Don't.", tags: ["coolness"] },
  { text: "Has main-menu music wherever they go.", tags: ["coolness"] },
  // mystery
  { text: "Encrypted vibes. Nobody has the key.", tags: ["mystery"] },
  { text: "Even the cookies can't track this one.", tags: ["mystery"] },
  { text: "Reads as 'unknown device' on every network.", tags: ["mystery"] },
  { text: "Their search history is need-to-know.", tags: ["mystery"] },
  { text: "Shows up in the logs. No one remembers when.", tags: ["mystery"] },
  { text: "Profile pic: a single blurry pixel.", tags: ["mystery"] },
  { text: "Answers questions with a knowing '…'.", tags: ["mystery"] },
  { text: "The anomaly the scanner keeps re-checking.", tags: ["mystery"] },
  // skill
  { text: "Secretly the high score you can't beat.", tags: ["skill"] },
  { text: "Has a lucky controller and isn't afraid to use it.", tags: ["skill"] },
  { text: "No-scopes the dishwasher from across the room.", tags: ["skill"] },
  { text: "Frame-perfect at literally everything.", tags: ["skill"] },
  { text: "Beat the tutorial boss before it loaded.", tags: ["skill"] },
  { text: "Pro gamer move incoming. Always.", tags: ["skill"] },
  { text: "Speedruns the cereal-pouring meta.", tags: ["skill"] },
  { text: "Could 1cc the entire day on one quarter.", tags: ["skill"] },
  // charisma
  { text: "Walks into the room; the room buffers.", tags: ["charisma"] },
  { text: "Could sell ice to a Windows 98 screensaver.", tags: ["charisma"] },
  { text: "Friend request: already accepted.", tags: ["charisma"] },
  { text: "The reason the group chat survives.", tags: ["charisma"] },
  { text: "Gets the NPCs to break script and smile.", tags: ["charisma"] },
  { text: "Five stars. Would respawn near again.", tags: ["charisma"] },
  { text: "The AUX cord chooses THIS person.", tags: ["charisma"] },
  { text: "Talked their way past the firewall, somehow.", tags: ["charisma"] },
  // patience
  { text: "The dial-up gods smile upon this one.", tags: ["patience"] },
  { text: "Would survive a kernel panic with grace.", tags: ["patience"] },
  { text: "Watched the whole 4% install bar. Calmly.", tags: ["patience"] },
  { text: "Zen master of the spinning beach ball.", tags: ["patience"] },
  { text: "Waited for the page to load. On principle.", tags: ["patience"] },
  { text: "Grinds the same level until it gives up first.", tags: ["patience"] },
  { text: "Could outlast a 'please do not turn off' screen.", tags: ["patience"] },
  { text: "Lag? Never met her.", tags: ["patience"] },
  // destiny
  { text: "Was foretold in a chain email, 2004.", tags: ["destiny"] },
  { text: "The prophecy mentioned a username like this.", tags: ["destiny"] },
  { text: "Born under a lucky loading screen.", tags: ["destiny"] },
  { text: "The 'continue?' countdown waits for them.", tags: ["destiny"] },
  { text: "Three webrings aligned the day they joined.", tags: ["destiny"] },
  { text: "Destined to find the last save point.", tags: ["destiny"] },
  { text: "The horoscope just said 'gg'.", tags: ["destiny"] },
  { text: "Fate left the cheat code on a sticky note.", tags: ["destiny"] },

  // ── feature-triggered (the machine "noticed" something) ───────────────────
  // palindrome
  { text: "Reads the same forwards and backwards. The machine is unsettled.", tags: ["palindrome"], tier: "rare" },
  { text: "Perfectly symmetrical. Suspiciously so.", tags: ["palindrome"] },
  { text: "A mirror name. We checked twice.", tags: ["palindrome"] },
  // allcaps
  { text: "TYPED IN ALL CAPS. WE RESPECT THE COMMITMENT.", tags: ["allcaps"] },
  { text: "VOLUME SET TO MAXIMUM. UNDERSTOOD.", tags: ["allcaps"] },
  { text: "NO INDOOR VOICE DETECTED. LOVE THAT.", tags: ["allcaps"] },
  // hasdigit
  { text: "Contains a number. Probably a gamer tag from 2009.", tags: ["hasdigit"] },
  { text: "The good usernames were taken, huh.", tags: ["hasdigit"] },
  { text: "xX_certified_Xx energy detected.", tags: ["hasdigit"] },
  // long
  { text: "A name this long needs its own loading bar.", tags: ["long"] },
  { text: "Buffering the rest of those letters…", tags: ["long"] },
  { text: "Exceeded the high-score initials field by a lot.", tags: ["long"] },

  // ── rare / secret (seeded unlock — flashes ⚠ ANOMALY) ─────────────────────
  { text: "ANOMALY: this name pings a server that shut down in 2007.", tier: "rare" },
  { text: "The Name-O-Tron has seen this one before. It will not say where.", tier: "rare" },
  { text: "Signal traced to a Newgrounds tab left open since 2006.", tier: "rare" },
  { text: "Detected a faint dial-up handshake in your aura.", tier: "rare" },
  { text: "This reading was already in the cache. Strange.", tier: "rare" },
  { text: "Cross-referenced the guestbook. You signed it twice.", tier: "rare" },
  { text: "★ LEGENDARY SIGNAL ★ — the guestbook wrote ITSELF for you.", tier: "secret" },
  { text: "ERROR_TOO_BASED: analysis exceeded safe nostalgia levels.", tier: "secret" },
  { text: "✦ MYTHIC ✦ The machine stood up and slow-clapped.", tier: "secret" },
  { text: "ROOT ACCESS GRANTED. The arcade now answers to you.", tier: "secret" },
];

// ── RANK_TITLES ───────────────────────────────────────────────────────────
// Optional flavor pools per tier. Engine picks one deterministically (offset
// from the verdict seed, so they don't move in lockstep). Empty tier → the
// engine uses its built-in static label for that tier.
export const RANK_TITLES = {
  S: ["S — LEGENDARY", "S — MYTHIC DROP", "S — TOUCHED BY THE WEBRING", "S — FINAL BOSS ENERGY", "S — 1CC NO CONTINUES"],
  A: ["A — ELITE", "A — CERTIFIED COOL", "A — TOP OF THE GUESTBOOK", "A — MAIN CHARACTER", "A — PERFECT COMBO"],
  B: ["B — SOLID", "B — RELIABLY RAD", "B — STABLE BUILD", "B — GOOD VIBES, NO LAG", "B — RESPECTABLE HIGH SCORE"],
  C: ["C — PROMISING", "C — STILL LOADING", "C — BUFFERING NICELY", "C — DECENT START, KID", "C — INSERT COIN TO CONTINUE"],
  D: ["D — A WORK IN PROGRESS", "D — NEEDS A DEFRAG", "D — TRY TURNING IT OFF + ON", "D — TUTORIAL NOT YET COMPLETE", "D — RESPAWNING…"],
};

// ── METRICS ─────────────────────────────────────────────────────────────────
// The six stat-bar names. Keep it EXACTLY six (the share card draws up to six).
// Rename/reorder freely; the engine maps each by index, so order = which
// feature-mix drives it (see NameORon.jsx METRIC_FORMULAS).
export const METRICS = [
  "COOLNESS",
  "MYSTERY",
  "ARCADE SKILL",
  "GIGABYTES OF CHARISMA",
  "DIAL-UP PATIENCE",
  "LEADERBOARD DESTINY",
];

// ── LOG_LINES ─────────────────────────────────────────────────────────────
// Fake "computation" steps shown while analyzing. The engine picks a few,
// deterministically per name, and may substitute {n} (a seeded count) and {sig}
// (the hex signature). Pure theater — add as many flavorful steps as you like.
export const LOG_LINES = [
  "TOKENIZING INPUT… ok",
  "CROSS-REFERENCING GUESTBOOK ARCHIVE… {n} matches",
  "COMPUTING CHARISMA COEFFICIENT… {sig}",
  "DEFRAGMENTING PERSONALITY…",
  "CONSULTING THE OLD INTERNET…",
  "PINGING ANCESTRAL MODEM… {sig}",
  "SCANNING FOR HIDDEN TALENTS… {n} found",
  "NORMALIZING VIBES…",
  "DECODING AURA (BASE64)…",
  "FLAGGING ANOMALIES… {n}",
  "REHYDRATING NOSTALGIA CACHE…",
  "ALIGNING WEBRINGS…",
  "WARMING UP THE CRT…",
  "BLOWING DUST OFF THE CARTRIDGE…",
  "CHECKING THE STRATEGY GUIDE…",
  "BUFFERING AT 4%… still 4%…",
  "QUERYING THE TAMAGOTCHI ORACLE… {n} replies",
  "VERIFYING HALL PASS…",
  "RUNNING DISK CLEANUP ON SOUL…",
  "COMPILING VERDICT…",
];
