/* ─────────────────────────────────────────────────────────────────────────
   MANUAL CONTENT CONFIG  ·  edit this file by hand

   Anything you add here joins the normal daily rotation alongside the
   AI-generated content in src/data/generated/*. Unlike that folder, this file
   is NEVER overwritten by `npm run generate`, so your entries persist forever.

   - Manual entries are added to the front of each pool, then the generated
     (or fallback) content follows. The daily rotation shuffles the whole
     combined pool, so a manual entry simply has the same odds of being the
     day's pick as any generated one.
   - Keep every `id` unique (within its list). Run `node scripts/daily-check.js`
     after editing to sanity-check the rotation.
   - Leave a list empty ([]) to add nothing of that type.
   ───────────────────────────────────────────────────────────────────────── */

// Polls — shape: { id, question, options: [{ id, label }] }
export const MANUAL_POLLS = [
  // {
  //   id: "manual-best-cabinet",
  //   question: "Best cabinet in the arcade?",
  //   options: [
  //     { id: "descent", label: "🕯️ The Descent" },
  //     { id: "crawler", label: "🗝️ Crypt Crawler" },
  //     { id: "tap", label: "⚡ Tap Surge" },
  //   ],
  // },
];

// Quizzes — shape: { id, title, intro,
//   results:   [{ id, title, emoji, blurb, gameId }],
//   questions: [{ q, answers: [{ label, weights: { <resultId>: points } }] }] }
// (gameId should match a game in src/data/games.js so "PLAY THIS" works.)
export const MANUAL_QUIZZES = [
  // {
  //   id: "manual-snack-quiz",
  //   title: "Which Arcade Snack Are You?",
  //   intro: "Six bites of truth.",
  //   results: [
  //     { id: "chips", title: "Hot Chips", emoji: "🔥", blurb: "Loud and a little reckless.", gameId: "tap-surge" },
  //     { id: "soda",  title: "Flat Soda",  emoji: "🥤", blurb: "Chill, sweet, in no hurry.", gameId: "descent" },
  //   ],
  //   questions: [
  //     { q: "Pick a vibe:", answers: [
  //       { label: "Spicy", weights: { chips: 2 } },
  //       { label: "Mellow", weights: { soda: 2 } },
  //     ] },
  //   ],
  // },
];

// Game facts — plain strings, one fun real-world gaming fact per line. These
// lead the fact pool and are hand-verified, so keep them TRUE and well-known
// (the AI-generated batch in generated/facts.js can drift; these can't).
export const MANUAL_FACTS = [
  "The original 'Pac-Man' has a kill screen on level 256 — a memory bug splits the maze into garbage.",
  "'Tetris' was made in 1984 by Alexey Pajitnov on an Elektronika 60 — it had no graphics, just bracket characters.",
  "Sonic the Hedgehog was almost a rabbit, and at one point had a human girlfriend named Madonna. Sega cut both.",
  "'The Legend of Zelda' (1986) was the first console game that let you save your progress to a battery-backed cartridge.",
  "'Space Invaders' sped up not by design — the hardware just ran faster as it had fewer aliens left to draw.",
  "Mario was originally called 'Jumpman' and was a carpenter, not a plumber, in the 1981 arcade 'Donkey Kong'.",
  "'Skyrim' has been ported to so many platforms it now runs on Amazon Alexa, where you play it entirely by voice.",
  "'Halo' started life as a real-time strategy game for Mac before Microsoft bought Bungie and made it a shooter.",
  "The dog in 'Duck Hunt' can't be shot — there's no code for it. The light gun simply has nothing to register.",
  "'Minecraft' is the best-selling video game of all time, having sold over 300 million copies.",
  "'Pokémon Red & Green' shipped with the infamous MissingNo. glitch — a side effect of how the games generated wild encounters.",
  "Akira Toriyama, creator of Dragon Ball, designed the characters and monsters for the 'Dragon Quest' series.",
  "The Magnavox Odyssey, released in 1972, was the first commercial home video game console.",
  "'Spacewar!' was created in 1962 on a DEC PDP-1 and is often cited as one of the earliest digital computer games.",
  "'Tennis for Two' was built in 1958 on an oscilloscope — decades before home consoles existed.",
  "'Computer Space' was released in 1971 and became the first commercial arcade video game.",
  "'Pong' was not the first video game, but it helped turn arcade video games into a real business.",
  "Atari got its name from a term in the board game Go, roughly meaning a stone is in danger of capture.",
  "'Adventure' on the Atari 2600 hid designer Warren Robinett's name in one of gaming's first famous Easter eggs.",
  "The Konami Code first appeared in the NES version of 'Gradius' before becoming a cheat-code legend.",
  "Nintendo started in 1889 as a company that made hanafuda playing cards.",
  "The original Game Boy used a greenish monochrome screen but became a monster hit thanks in part to bundled 'Tetris'.",
  "The PlayStation began after a failed Sony-Nintendo CD-ROM partnership — corporate breakup, console dynasty.",
  "The Xbox name came from 'DirectX Box', because Microsoft originally pitched it around DirectX gaming tech.",
  "The Sega Dreamcast launched with a built-in modem, making online console play feel futuristic in 1999.",
  "Sega Channel let players download Genesis games through cable TV in the 1990s — basically caveman Game Pass.",
  "Atari really did bury unsold game cartridges in a New Mexico landfill, including copies of 'E.T. the Extra-Terrestrial'.",
  "'E.T.' for Atari 2600 was developed in only a few weeks, which explains a lot and excuses almost nothing.",
  "'Super Mario Bros.' says in its manual that Bowser turned Mushroom People into bricks, stones, and plants.",
  "The famous 'Minus World' in 'Super Mario Bros.' is a glitch level caused by a bad warp-zone pointer.",
  "In 'Donkey Kong', Pauline was originally called 'Lady' in early materials.",
  "Mario's name was inspired by Mario Segale, a real estate developer connected to Nintendo of America's early warehouse.",
  "'The Legend of Zelda' has a hidden Second Quest that can be started immediately by naming your file 'ZELDA'.",
  "'Metroid' shocked early players by revealing at the end that Samus Aran was a woman.",
  "'Metroid' borrowed structural DNA from both 'Super Mario Bros.' platforming and 'The Legend of Zelda' exploration.",
  "The famous 'JUSTIN BAILEY' password in 'Metroid' is a real working password, not just playground mythology.",
  "Kirby began as a simple placeholder blob, but the team liked the design enough to keep him cute and round.",
  "Kirby was originally called Popopo during development before becoming Kirby.",
  "'Mega Man' is called 'Rockman' in Japan, making his sister Roll part of a Rock-and-Roll pun.",
  "Capcom changed 'Rockman' to 'Mega Man' for the U.S. because Capcom's American leadership disliked the original name.",
  "'Street Fighter II' combos grew out of an unintended canceling behavior that developers decided made the game better.",
  "'Mortal Kombat' used digitized actors instead of hand-drawn sprites, giving it that weird live-action arcade look.",
  "Johnny Cage from 'Mortal Kombat' was heavily inspired by Jean-Claude Van Damme-style action heroes.",
  "'Final Fantasy' was not simply named because Square was doomed; Hironobu Sakaguchi later said the team wanted a title that abbreviated nicely to 'FF'.",
  "'Dragon Quest' became so culturally huge in Japan that its monster designs by Akira Toriyama became almost as iconic as the heroes.",
  "'Pokémon' was inspired partly by Satoshi Tajiri's childhood love of collecting insects.",
  "'Pokémon Red & Green' launched in Japan before the U.S. received 'Pokémon Red & Blue'.",
  "Mew was secretly added to the original 'Pokémon' games near the end of development.",
  "The Pokémon trading idea was built around the Game Boy Link Cable, turning the hardware itself into part of the fantasy.",
  "'Pokémon Gold & Silver' fit the entire Kanto region as a post-game surprise after Johto.",
  "Satoru Iwata helped optimize 'Pokémon Gold & Silver', letting the games fit much more than originally expected.",
  "'Resident Evil' began as a spiritual successor to Capcom's Japan-only horror RPG 'Sweet Home'.",
  "'Resident Evil' is called 'Biohazard' in Japan, but the title was changed overseas because 'Biohazard' had trademark conflicts.",
  "'Silent Hill' used fog partly to hide draw-distance limits, accidentally creating one of horror gaming's best atmospheres.",
  "'Crash Bandicoot' was jokingly nicknamed 'Sonic's Ass Game' during development because the camera looked at the character from behind.",
  "Crash Bandicoot was chosen partly because Naughty Dog wanted Sony to have a mascot-like character for PlayStation.",
  "'Tomb Raider' heroine Lara Croft was originally conceived with the name Laura Cruz before becoming Lara Croft.",
  "'GoldenEye 007' for Nintendo 64 was made by a team where many developers were working on their first game.",
  "The multiplayer mode in 'GoldenEye 007' was added late in development by a small group of developers.",
  "'Doom' was distributed as shareware, letting players try the first episode before buying the full game.",
  "The original 'DOOM' source code was released in 1997 for non-commercial use, helping fuel endless ports and mods.",
  "'DOOM' still needs the original game data files to play legally, even though the engine source code was released.",
  "'Doom' was developed on NeXT computers before becoming a PC gaming landmark.",
  "'Quake' used a true 3D engine, making it a major leap beyond the sector-based world of 'Doom'.",
  "'Quake III Arena' popularized the legendary fast inverse square root trick among programmers.",
  "'Half-Life' was originally codenamed 'Quiver', a reference to Stephen King's 'The Mist'.",
  "'Counter-Strike' began as a fan-made 'Half-Life' mod before becoming one of the biggest shooters ever.",
  "'Team Fortress' began as a 'Quake' mod before Valve turned it into a full franchise.",
  "'Portal' grew out of a student project called 'Narbacular Drop'.",
  "'Dota' began as a custom map/mod lineage before becoming the foundation of the modern MOBA genre.",
  "'League of Legends' was built by developers influenced by the original 'Defense of the Ancients' mod scene.",
  "'Fortnite' originally launched around its co-op 'Save the World' mode before Battle Royale became the phenomenon.",
  "'PUBG' grew from Brendan Greene's battle royale mod work before becoming a standalone mega-hit.",
  "'Minecraft' first became publicly playable in 2009 before its official 1.0 release in 2011.",
  "'Minecraft' passed 300 million copies sold, making it the best-selling video game ever.",
  "'The Sims' came from Will Wright thinking about homes, people, and systems after losing his own house in the Oakland fire.",
  "'SimCity' grew out of Will Wright enjoying the city-building tool he made while developing 'Raid on Bungeling Bay'.",
  "'Myst' helped prove CD-ROM games could be mainstream, using huge pre-rendered visuals that floppy disks could never handle.",
  "'The Oregon Trail' was first created in 1971 by student teachers in Minnesota.",
  "'Rogue' used ASCII characters for dungeons and monsters, and the entire 'roguelike' genre takes its name from it.",
  "'NetHack' is still actively maintained decades after its first release, which is absurdly impressive nerd archaeology.",
  "'Star Fox' used the Super FX chip to render polygonal 3D graphics on the Super Nintendo.",
  "'F-Zero' used the SNES Mode 7 effect to fake high-speed 3D racing.",
  "'Yoshi's Island' used the Super FX 2 chip for scaling, rotation, and other visual tricks.",
  "'Animal Crossing' used a real-time clock, so the village changed based on the actual date and time.",
  "'World of Warcraft' had a virtual plague called the Corrupted Blood incident, later discussed by real epidemiology researchers.",
  "'No Man's Sky' generates an enormous universe algorithmically, with over 18 quintillion possible planets.",
  "'Katamari Damacy' literally means something like 'clump spirit', which is exactly as weirdly perfect as it sounds.",
  "'Guitar Hero' controllers were shaped like tiny plastic guitars, turning rhythm games into living-room rock cosplay.",
  "'Dance Dance Revolution' turned an arcade cabinet into a cardio machine with arrows and public humiliation.",
  "'Wii Sports' became one of the best-selling games ever largely because it was bundled with the Wii in many regions.",
  "'Nintendogs' used the Nintendo DS microphone so players could call their dogs by name.",
  "'Brain Age' helped make the Nintendo DS popular with people who did not usually consider themselves gamers.",
  "'Angry Birds' was Rovio's 52nd game — not exactly an overnight success, more like an overnight success after 51 nights.",
  "'Flappy Bird' was removed from app stores by its own creator after becoming wildly, stressfully popular.",
  "'Among Us' released in 2018 but exploded in popularity in 2020, proving games can have delayed fuse explosions.",
  "'Stardew Valley' was made primarily by one developer, Eric Barone, who created the art, music, writing, and code.",
  "'Undertale' was largely created by Toby Fox, who also composed its music.",
  "'Celeste' began as a small PICO-8 game before becoming a full indie platformer.",
  "'Braid' helped kick off the modern indie-game boom after its Xbox Live Arcade release.",
  "'Cave Story' was made by a solo developer, Daisuke Amaya, over several years.",
  "'Spelunky' began as a freeware PC game before being remade into a modern indie classic.",
  "'Hades' was developed with early access feedback, letting players help shape the game before full release.",
  "'Cuphead' was animated in a 1930s cartoon style, with hand-drawn animation and watercolor backgrounds.",
  "'Okami' used a sumi-e ink-painting-inspired art style years before painterly games became common.",
  "'Shadow of the Colossus' has only a small number of enemies, but each one is basically a boss, a puzzle, and a tragedy wearing fur.",
];

// Site news — plain strings (each is one line in the SITE NEWS ticker).
export const MANUAL_NEWS = [
  // "NEW: hand-written news lines live here and never get regenerated.",
];

// Mascot tips — plain strings.
export const MANUAL_TIPS = [
  // "Pro tip: this hint was written by a human and is here to stay.",
];
