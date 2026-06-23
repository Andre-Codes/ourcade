/* ─────────────────────────────────────────────────────────────────────────
   MANUAL CONTENT CONFIG  ·  edit this file by hand
   (part of the hand-edit hub in src/data/manual/ — see README.md there)

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
  //     { id: "pits", label: "🕯️ Pits and Portals" },
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
  //     { id: "soda",  title: "Flat Soda",  emoji: "🥤", blurb: "Chill, sweet, in no hurry.", gameId: "pits-and-portals" },
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
  "RUMOR: Byte Badger's Walkman is home to some bomb tracks... ",
  "NOW OPEN: the Water Cooler — gather 'round for today's countdown, gossip, and Hot or Not on current pop culture.",
  "💧 The Water Cooler refills every morning: a fresh countdown chart, on-this-day, and the buzz.",
  "WATER COOLER REPORT: somebody voted 'hot' on something deeply not. We respect the chaos.",
  "Bored of games? The Water Cooler's got what everyone's talking about today — no algorithm required.",
  "TIP JAR: the Water Cooler's 'On This Day' dug up something you completely forgot existed.",
];

// Mascot tips — plain strings.
export const MANUAL_TIPS = [
  // "Pro tip: this hint was written by a human and is here to stay.",
  "BTW I've got a pretty sick mixtape... I finally got that song about the Chinese Chicken in there 🐔🍗🧠🛑",
  "Psst — hit the 💧 Water Cooler in the nav. It's where the whole arcade gathers to gossip.",
  "The Water Cooler swaps in a fresh top-5 Countdown every day. Yesterday's chart is gone forever.",
  "Stuck for something to do? The Water Cooler's Hot or Not lets you settle the day's big debates.",
  "The Water Cooler isn't a feed — it's a finite page. Read it all, then go touch grass. I won't tell.",
  "Heads up: the Water Cooler's 'On This Day' is my favorite rabbit hole. Bring a snack.",
];

// Timeless curiosities — shape: { id, title, blurb, url? }. The 🌌 card.
// Things that are fascinating regardless of decade: math, history, nature,
// engineering. `url` is the optional "go deeper →" link (prefer Wikipedia or
// other pages that will still exist in ten years). Hand-verified, like facts.
export const MANUAL_CURIOSITIES = [
  { id: "cur-mandelbrot", title: "The Mandelbrot set", blurb: "One tiny equation — z² + c, repeated — draws an infinitely deep coastline of seahorses and spirals. Zoom forever; it never runs out.", url: "https://en.wikipedia.org/wiki/Mandelbrot_set" },
  { id: "cur-ant-rubber-band", title: "The ant on a rubber band", blurb: "An ant walks 1 cm/s along a rubber band that stretches 1 km/s. Impossibly, the ant always reaches the end — it just takes longer than the universe has existed.", url: "https://en.wikipedia.org/wiki/Ant_on_a_rubber_rope" },
  { id: "cur-ulam-spiral", title: "The Ulam spiral", blurb: "Write the numbers in a spiral and circle the primes: they line up along diagonals for no fully explained reason. Discovered by a bored mathematician doodling in a meeting.", url: "https://en.wikipedia.org/wiki/Ulam_spiral" },
  { id: "cur-ybc7289", title: "A 3,800-year-old math homework", blurb: "Clay tablet YBC 7289 shows a Babylonian student computing √2 to six decimal places — about 1,300 years before Pythagoras was born.", url: "https://en.wikipedia.org/wiki/YBC_7289" },
  { id: "cur-antikythera", title: "The Antikythera mechanism", blurb: "A 2,000-year-old Greek shipwreck held a bronze gearbox that predicted eclipses and planetary positions. Nothing close to it appears again for over a millennium.", url: "https://en.wikipedia.org/wiki/Antikythera_mechanism" },
  { id: "cur-ultramarine", title: "When blue cost more than gold", blurb: "Ultramarine pigment was ground from lapis lazuli mined in one Afghan valley. Renaissance contracts specified exactly how much of it a painter could use.", url: "https://en.wikipedia.org/wiki/Ultramarine" },
  { id: "cur-feynman-plate", title: "Feynman's wobbling plate", blurb: "Burnt out, Feynman decided physics should be play and idly worked out the wobble of a cafeteria plate someone threw. That doodle led him back to the work that won the Nobel Prize.", url: "https://en.wikipedia.org/wiki/Surely_You%27re_Joking,_Mr._Feynman!" },
  { id: "cur-roman-concrete", title: "Self-healing Roman concrete", blurb: "Roman harbors have survived 2,000 years of seawater because their concrete reacts with it, growing new minerals in the cracks. We only figured out the recipe recently.", url: "https://en.wikipedia.org/wiki/Roman_concrete" },
  { id: "cur-olbers", title: "Why is the night sky dark?", blurb: "If the universe were infinite and eternal, every line of sight would end on a star and the night sky would blaze. The darkness overhead is evidence the universe had a beginning.", url: "https://en.wikipedia.org/wiki/Olbers%27s_paradox" },
  { id: "cur-benford", title: "Benford's law", blurb: "In real-world data — river lengths, street addresses, tax returns — the number 1 is the leading digit about 30% of the time. Forensic accountants use it to catch fraud.", url: "https://en.wikipedia.org/wiki/Benford%27s_law" },
  { id: "cur-galton", title: "The Galton board", blurb: "Drop balls through a grid of pegs, each bouncing randomly left or right, and they pile up into a perfect bell curve every time. Order from pure chaos, guaranteed.", url: "https://en.wikipedia.org/wiki/Galton_board" },
  { id: "cur-dunbar", title: "Dunbar's number", blurb: "Based on primate brain sizes, you can maintain roughly 150 stable relationships. Armies, villages, and old internet forums kept independently landing on the same size.", url: "https://en.wikipedia.org/wiki/Dunbar%27s_number" },
  { id: "cur-monty-hall", title: "The Monty Hall problem", blurb: "Switching doors doubles your odds, and when Marilyn vos Savant said so, thousands of people — including PhDs — wrote in to insist she was wrong. She wasn't.", url: "https://en.wikipedia.org/wiki/Monty_Hall_problem" },
  { id: "cur-birthday", title: "The birthday paradox", blurb: "In a room of just 23 people, there's a better-than-even chance two share a birthday. Your gut says hundreds; the math says two football teams.", url: "https://en.wikipedia.org/wiki/Birthday_problem" },
  { id: "cur-banach-tarski", title: "The Banach–Tarski paradox", blurb: "Mathematically, you can cut a ball into five pieces and reassemble them into two balls the same size as the original. The pieces are just too strange to exist physically.", url: "https://en.wikipedia.org/wiki/Banach%E2%80%93Tarski_paradox" },
  { id: "cur-graham", title: "Graham's number", blurb: "A number so large that if you tried to picture it, your head would collapse into a black hole — there isn't enough room in your skull to store the digits. It was used in a real proof.", url: "https://en.wikipedia.org/wiki/Graham%27s_number" },
  { id: "cur-zipf", title: "Zipf's law", blurb: "The most common word in any language appears about twice as often as the second, three times the third, and so on. City sizes do it too. Nobody fully knows why.", url: "https://en.wikipedia.org/wiki/Zipf%27s_law" },
  { id: "cur-prince-rupert", title: "Prince Rupert's drops", blurb: "Molten glass dripped into water makes a tadpole you can hit with a hammer — but snap its thin tail and the whole thing explodes into powder at 4,000 mph.", url: "https://en.wikipedia.org/wiki/Prince_Rupert%27s_drop" },
  { id: "cur-brazil-nut", title: "The Brazil nut effect", blurb: "Shake a jar of mixed nuts and the biggest ones rise to the top, which is backwards from what gravity should do. Physicists still publish papers about cereal boxes.", url: "https://en.wikipedia.org/wiki/Granular_convection" },
  { id: "cur-honey", title: "Honey doesn't spoil", blurb: "Archaeologists have found pots of honey in Egyptian tombs that are 3,000 years old and still perfectly edible. Low water, high acid, and a little hydrogen peroxide.", url: "https://en.wikipedia.org/wiki/Honey" },
  { id: "cur-immortal-jellyfish", title: "The immortal jellyfish", blurb: "Turritopsis dohrnii can age backwards — when stressed, an adult reverts to a polyp and starts life over. Biologically, it can do this forever.", url: "https://en.wikipedia.org/wiki/Turritopsis_dohrnii" },
  { id: "cur-tardigrades", title: "Tardigrades", blurb: "These millimeter-long animals survive boiling, freezing, the vacuum of space, and radiation that would kill anything else — by drying out and basically pausing themselves.", url: "https://en.wikipedia.org/wiki/Tardigrade" },
  { id: "cur-great-attractor", title: "The Great Attractor", blurb: "Our galaxy is being pulled toward something enormous we can't see properly — it's hidden behind the dust of the Milky Way's own disk. We're headed there at 600 km/s.", url: "https://en.wikipedia.org/wiki/Great_Attractor" },
  { id: "cur-voynich", title: "The Voynich manuscript", blurb: "A 600-year-old book written in an alphabet no one can read, full of plants that don't exist. Cryptographers who broke real wartime codes couldn't crack it.", url: "https://en.wikipedia.org/wiki/Voynich_manuscript" },
  { id: "cur-long-now", title: "The 10,000 Year Clock", blurb: "Inside a Texas mountain, engineers are building a clock designed to tick for ten millennia and chime a never-repeating melody. It asks one question: what's the rush?", url: "https://longnow.org/clock/" },
  { id: "cur-svalbard", title: "The doomsday seed vault", blurb: "Deep in an Arctic mountain on Svalbard sits a backup copy of the world's crops — over a million seed samples kept at -18°C, just in case.", url: "https://en.wikipedia.org/wiki/Svalbard_Global_Seed_Vault" },
  { id: "cur-oklo", title: "Earth's natural nuclear reactor", blurb: "Two billion years ago in Gabon, uranium deposits spontaneously went critical and ran as natural fission reactors for hundreds of thousands of years.", url: "https://en.wikipedia.org/wiki/Natural_nuclear_fission_reactor" },
  { id: "cur-theseus", title: "The Ship of Theseus", blurb: "Replace every plank of a ship one by one — is it still the same ship? Philosophers have argued about this for 2,000 years. Your favorite rebooted franchise is asking the same question.", url: "https://en.wikipedia.org/wiki/Ship_of_Theseus" },
  { id: "cur-pitch-drop", title: "The pitch drop experiment", blurb: "Running since 1927, this experiment proves pitch is a liquid — it drips about once a decade. Nobody had ever seen a drop fall until a webcam finally caught one in 2014.", url: "https://en.wikipedia.org/wiki/Pitch_drop_experiment" },
  { id: "cur-centennial-light", title: "The 124-year-old light bulb", blurb: "A bulb in a Livermore, California fire station has been burning since 1901. It has outlived two webcams pointed at it.", url: "https://en.wikipedia.org/wiki/Centennial_Light" },
  { id: "cur-year-no-summer", title: "The year without a summer", blurb: "In 1816, a volcanic eruption dimmed the sun worldwide. Crops failed, it snowed in June — and a rained-in house party in Geneva produced Frankenstein.", url: "https://en.wikipedia.org/wiki/Year_Without_a_Summer" },
  { id: "cur-tetris-effect", title: "The Tetris effect", blurb: "Play enough Tetris and you'll see falling blocks when you close your eyes. The effect is real, studied, and named — your brain keeps playing without you.", url: "https://en.wikipedia.org/wiki/Tetris_effect" },
  { id: "cur-baader-meinhof", title: "The frequency illusion", blurb: "Learn a new word and suddenly it's everywhere. It always was — your brain just started flagging it. Also called the Baader–Meinhof phenomenon, which you'll now see everywhere.", url: "https://en.wikipedia.org/wiki/Frequency_illusion" },
  { id: "cur-eratosthenes", title: "Measuring Earth with a stick", blurb: "Around 240 BC, Eratosthenes measured the circumference of the planet using two sticks, two shadows, and the distance between two cities. He got remarkably close.", url: "https://en.wikipedia.org/wiki/Eratosthenes" },
  { id: "cur-boltzmann-tumbleweed", title: "Tumbleweeds are invaders", blurb: "The icon of the American West is actually Russian thistle that arrived in contaminated flax seed in the 1870s and rolled across the continent in two decades.", url: "https://en.wikipedia.org/wiki/Kali_tragus" },
  { id: "cur-wood-wide-web", title: "Forests talk underground", blurb: "Trees trade sugar and chemical warnings through shared fungal networks in the soil — older 'hub' trees are connected to dozens of neighbors.", url: "https://en.wikipedia.org/wiki/Mycorrhizal_network" },
  { id: "cur-sailing-stones", title: "The sailing stones", blurb: "Rocks in Death Valley slide across the desert floor leaving long trails, and for decades nobody saw one move. The answer (thin ice + wind) took until 2014 to catch on camera.", url: "https://en.wikipedia.org/wiki/Sailing_stones" },
  { id: "cur-cosmic-latte", title: "The average color of the universe", blurb: "Astronomers averaged the light of 200,000 galaxies and got... beige. They named it Cosmic Latte. The universe is the color of a coffee shop wall.", url: "https://en.wikipedia.org/wiki/Cosmic_latte" },
  { id: "cur-hilbert-hotel", title: "Hilbert's infinite hotel", blurb: "A fully booked hotel with infinite rooms can still take infinitely many new guests — just ask everyone to move to double their room number. Infinity doesn't play fair.", url: "https://en.wikipedia.org/wiki/Hilbert%27s_paradox_of_the_Grand_Hotel" },
  { id: "cur-trinity-glass", title: "Trinitite", blurb: "The first atomic bomb test fused the desert sand beneath it into a green glass that exists nowhere else. Collectors traded it in the 1940s; making more is, thankfully, frowned upon.", url: "https://en.wikipedia.org/wiki/Trinitite" },
];

// Today's Weird Thing — shape: { id, title, blurb, url, foundNote? }. The 🔍
// card: proof the site is alive and aware of the current internet. Mostly
// living sites and ongoing projects. Rotates every few hours (rotateIntraday),
// so expect each entry to surface often — keep them genuinely delightful.
// `foundNote` is an optional one-liner shown small, like "still online since 1995".
export const MANUAL_WEIRD = [
  { id: "weird-mcbroken", title: "A live map of broken McDonald's ice cream machines", blurb: "An engineer reverse-engineered the McDonald's app to track which ice cream machines are down, in real time, across the planet.", url: "https://mcbroken.com", foundNote: "updates every few minutes" },
  { id: "weird-windowswap", title: "Look out a stranger's window", blurb: "People around the world film the view from their windows and you flip through them. Rain in Seoul, a cat in Lisbon. That's it. That's the site.", url: "https://window-swap.com" },
  { id: "weird-radio-garden", title: "Spin the globe, hear live radio", blurb: "A 3D Earth covered in green dots — every dot is a real radio station streaming live. Drag to a fishing town in Norway and just listen.", url: "https://radio.garden" },
  { id: "weird-payphone", title: "One man has been documenting payphones since 1995", blurb: "The Payphone Project has been photographing and cataloguing the world's disappearing payphones for three decades. It outlived most of the payphones.", url: "https://www.payphone-project.com", foundNote: "online since 1995" },
  { id: "weird-pointerpointer", title: "Pointer Pointer", blurb: "Move your mouse anywhere. The site finds a photo of a person pointing at exactly that spot. Where do these photos come from? Don't ask. Just move the mouse again.", url: "https://pointerpointer.com" },
  { id: "weird-zoomquilt", title: "The infinite zooming painting", blurb: "Dozens of artists painted seamless pictures inside pictures, and the result zooms forever. It launched in 2004 and is still hypnotic.", url: "https://zoomquilt.org", foundNote: "running since 2004" },
  { id: "weird-submarine-cables", title: "The internet is mostly underwater", blurb: "An interactive map of every submarine cable carrying the internet across the ocean floor. You are reading this through one of these wet noodles.", url: "https://www.submarinecablemap.com" },
  { id: "weird-lightyear", title: "How far has our music traveled?", blurb: "Radio broadcasts leave Earth at light speed. This site plays whatever song is just now arriving at each star — Elvis is washing over stars 70 light-years away.", url: "https://www.lightyear.fm" },
  { id: "weird-deep-sea", title: "Scroll to the bottom of the ocean", blurb: "A single page that takes you from the surface down 10,924 meters, showing what actually lives at each depth. It gets very dark and very weird down there.", url: "https://neal.fun/deep-sea/" },
  { id: "weird-internet-artifacts", title: "A museum of internet artifacts", blurb: "The first webpage, the dancing baby, the first banner ad, the original wiki — all preserved and playable in one beautifully curated exhibit.", url: "https://neal.fun/internet-artifacts/" },
  { id: "weird-orb-farm", title: "Build a glass ecosystem", blurb: "An aquarium simulator where you sculpt sand and stone, plant algae, add fish, and watch a tiny food chain find its balance. Quietly profound.", url: "https://orb.farm" },
  { id: "weird-tixy", title: "Creative coding in 32 characters", blurb: "A 16×16 grid of dots controlled by one tiny math expression you can edit. People make fireworks, waves, and entire animations in a single line of code.", url: "https://tixy.land" },
  { id: "weird-windows93", title: "Windows 93", blurb: "The operating system Microsoft never shipped, lovingly faked in your browser — complete with broken programs, a virtual pet, and a defrag you can watch.", url: "https://www.windows93.net" },
  { id: "weird-space-people", title: "How many people are in space right now?", blurb: "A website that answers exactly one question, with a number and their names. Bookmark-worthy in its stubborn simplicity.", url: "https://www.howmanypeopleareinspacerightnow.com" },
  { id: "weird-longbets", title: "People making 20-year bets in public", blurb: "Long Bets hosts accountable predictions: real money, real stakes, decided decades from now. One bet on whether humanity will detect aliens runs to 2050.", url: "https://longbets.org" },
  { id: "weird-wiby", title: "A search engine for the old web", blurb: "Wiby only indexes simple, hobbyist, hand-made pages — the kind of sites search engines forgot. Hit 'surprise me' and you're in 2002.", url: "https://wiby.me" },
  { id: "weird-useless-web", title: "The Useless Web", blurb: "One button: 'take me to a useless website, please.' It has been faithfully delivering pointless masterpieces for over a decade.", url: "https://theuselessweb.com" },
  { id: "weird-earth-wind", title: "Watch the planet breathe", blurb: "A live animated map of every wind current on Earth, updated every few hours from real forecast data. Hurricanes look terrifying and gorgeous.", url: "https://earth.nullschool.net" },
  { id: "weird-radiooooo", title: "A musical time machine", blurb: "Pick any country and any decade since 1900, and Radiooooo plays you music from that exact time and place. Mongolia, 1970s. Go.", url: "https://radiooooo.com" },
  { id: "weird-stars", title: "100,000 stars in your browser", blurb: "An interactive 3D map of our stellar neighborhood. Zoom from the Sun out to the galaxy and feel briefly, productively insignificant.", url: "https://stars.chromeexperiments.com" },
  { id: "weird-quickdraw", title: "Teach a neural net to recognize your terrible drawings", blurb: "Google's Quick, Draw! gives you 20 seconds to sketch a bicycle while an AI guesses. Fifty million drawings later, the dataset is public and hilarious.", url: "https://quickdraw.withgoogle.com" },
  { id: "weird-patatap", title: "Press any key", blurb: "Every key on your keyboard triggers a sound and an animation. Suddenly you're a one-person visual jazz band. Works frighteningly well with two hands.", url: "https://patatap.com" },
  { id: "weird-bongo-cat", title: "Bongo Cat plays everything", blurb: "The meme cat sits at your keyboard ready to play bongos, marimba, or electric guitar. There is no goal. There never was.", url: "https://bongo.cat" },
  { id: "weird-paper-toilet", title: "papertoilet.com", blurb: "A roll of toilet paper you scroll to unroll. By net-artist Rafaël Rozendaal, who sells his websites as art. Someone owns this one.", url: "https://papertoilet.com" },
  { id: "weird-eelslap", title: "Slap a man with an eel", blurb: "Drag your mouse to slap a very patient man with an eel, frame by frame. Online for years. He's still there. Still getting slapped.", url: "https://eelslap.com" },
  { id: "weird-hackertyper", title: "Become a movie hacker", blurb: "Mash your keyboard and flawless green code pours out like you're in a 1995 thriller. Tap Alt three times for ACCESS GRANTED.", url: "https://hackertyper.net" },
  { id: "weird-cat-bounce", title: "Cat Bounce", blurb: "Cats. Bouncing. There is a button labeled 'make it rain' and it does exactly what you hope.", url: "https://cat-bounce.com" },
  { id: "weird-shipmap", title: "Every cargo ship on Earth, visualized", blurb: "An animated map of a year of global shipping traffic — thousands of ships hauling everything you own across the sea. Mesmerizing supply-chain ASMR.", url: "https://www.shipmap.org" },
  { id: "weird-asoftmurmur", title: "Mix your own rainstorm", blurb: "Sliders for rain, thunder, waves, crickets, and a coffee shop. Build the exact storm you want to live inside while you work.", url: "https://asoftmurmur.com" },
  { id: "weird-berkshire", title: "A $700 billion company's website from 1997", blurb: "Berkshire Hathaway — Warren Buffett's empire — keeps a homepage that is pure unstyled HTML and refuses to change. It loads instantly. There is a lesson here.", url: "https://www.berkshirehathaway.com" },
];

// Today's Weird Thing — the LATE-NIGHT pool. Same shape as MANUAL_WEIRD, but
// only surfaces during the 🌙 night part (see src/data/weird.js): dreamier,
// eerier, after-dark stuff that day-folk never see. Rotates a fresh one each
// night. Keep these genuinely good — night owls earned them.
export const MANUAL_WEIRD_NIGHT = [
  { id: "weirdnt-sleep", title: "A 10-hour recording of a 1989 Casio keyboard demo, slowed 800%", blurb: "Someone stretched a cheesy keyboard demo into a vast, drifting ambient cathedral. It should not be beautiful. It is. Headphones, lights off.", url: "https://www.youtube.com/watch?v=YzeRWNkpY9w", foundNote: "best after midnight" },
  { id: "weirdnt-driftloop", title: "drift — an endless generative night drive", blurb: "A car, an empty highway, rain on the windshield, and a synth that never resolves. It just keeps going. So can you.", url: "https://driveandlisten.herokuapp.com" },
  { id: "weirdnt-hi", title: "hi.", blurb: "A single page that just... talks to you, gently, like a friend who's also up too late. People keep it open and cry a little. That's allowed.", url: "https://heyhi.lol" },
  { id: "weirdnt-stars", title: "Sit under a sky of 9,096 real stars", blurb: "An interactive planetarium of every star visible to the naked eye, from anywhere on Earth, at any date. Find the sky from the night you were born.", url: "https://stuffin.space" },
  { id: "weirdnt-rain", title: "Rainy Mood, online since 2010", blurb: "Just rain. Sometimes thunder. The internet's longest-running thunderstorm, still falling for anyone who needs it to be quiet.", url: "https://rainymood.com", foundNote: "raining since 2010" },
  { id: "weirdnt-ocean", title: "A live hydrophone in the deep Pacific", blurb: "Streaming audio from a microphone on the ocean floor off Vancouver Island. Whales, boats, the groan of the deep. Nobody's curating it. It just listens.", url: "https://orcasound.net/listen/" },
  { id: "weirdnt-pluto", title: "Stand on Pluto and watch the sun rise", blurb: "A quiet, accurate render of the sky from worlds across the solar system. The sun is just another bright star out there. Humbling at 2am.", url: "https://neal.fun/the-sun/" },
  { id: "weirdnt-deadmalls", title: "An archive of dead American shopping malls", blurb: "Photos and oral histories of the malls that raised a generation and then quietly died. Fluorescent-lit nostalgia with the lights going out.", url: "https://deadmalls.com", foundNote: "you've been here in a dream" },
  { id: "weirdnt-windows", title: "WindowSwap, but it's everyone's 3am", blurb: "Look out a stranger's window — except now you're choosing the late-night ones. A glowing city, a sleeping cat, rain on someone else's glass.", url: "https://window-swap.com" },
];

// Stumble artifacts — the 🎲 pool's hand-picked seeds. Shape:
//   { id, kind, era, title, blurb, year?, url, embed?, credit? }
// kind: "wiki" | "site" | "patent" | "game" | "video" | "image" | "flash" | "mystery"
// era:  "nostalgic" | "current" | "timeless" — used ONLY for the invisible
//       40/40/20 weighted draw in src/data/stumble.js. Never shown to users.
// embed: null (default — opens as a portal card) or { type: "archive", id } /
//       { type: "image", src }. Only archive.org and plain images embed inline.
// The ~3000-strong flash pool joins this list automatically via the adapter in
// stumble.js, so don't add flash entries here.
export const MANUAL_ARTIFACTS = [
  // — nostalgic: the old web, still breathing —
  { id: "site:spacejam-1996", kind: "site", era: "nostalgic", title: "The Space Jam website (1996)", blurb: "Warner Bros. never took down the original Space Jam site. Starfield background, planet navigation, all of it — officially preserved at its original address.", year: "1996", url: "https://www.spacejam.com/1996/" },
  { id: "site:cameronsworld", kind: "site", era: "nostalgic", title: "Cameron's World", blurb: "A love letter to GeoCities: a gigantic scrolling collage built from thousands of graphics salvaged from the old free-homepage web. Headphones on, MIDI up.", url: "https://www.cameronsworld.net" },
  { id: "site:zombo", kind: "site", era: "nostalgic", title: "Zombo.com", blurb: "Welcome to Zombocom. You can do anything at Zombocom. The infinite is possible at Zombocom. Online since 1999, now Flash-free, still promising everything.", year: "1999", url: "https://zombo.com" },
  { id: "site:milliondollar", kind: "site", era: "nostalgic", title: "The Million Dollar Homepage", blurb: "In 2005 a student sold one million pixels for $1 each to pay for university. The page is still up, a fossilized advertising reef from the mid-2000s web.", year: "2005", url: "http://www.milliondollarhomepage.com" },
  { id: "site:csszengarden", kind: "site", era: "nostalgic", title: "CSS Zen Garden", blurb: "One HTML file, hundreds of radically different designs. The 2003 site that proved CSS could be art and taught a generation of web designers their craft.", year: "2003", url: "https://csszengarden.com" },
  { id: "site:textfiles", kind: "site", era: "nostalgic", title: "TEXTFILES.COM", blurb: "Jason Scott's vast archive of BBS-era text files: phone phreaking guides, ASCII art, teenage manifestos. The pre-web internet, preserved in plain text.", url: "http://www.textfiles.com" },
  { id: "wiki:all-your-base", kind: "wiki", era: "nostalgic", title: "All Your Base Are Belong To Us", blurb: "How one badly translated line from a 1991 Sega game became the internet's first mega-meme, complete with a music video that conquered 2001.", year: "2001", url: "https://en.wikipedia.org/wiki/All_your_base_are_belong_to_us" },
  { id: "wiki:hampster-dance", kind: "wiki", era: "nostalgic", title: "The Hampster Dance", blurb: "A Canadian art student made a page of dancing hamster GIFs to win a traffic contest with her sister. It became one of the first viral sites in history.", year: "1998", url: "https://en.wikipedia.org/wiki/Hampster_Dance" },
  { id: "wiki:dancing-baby", kind: "wiki", era: "nostalgic", title: "The Dancing Baby", blurb: "A 3D demo file of a cha-cha-ing baby escaped from a software company in 1996 and spread by email until it hit network television. The first viral video, before video could even stream.", year: "1996", url: "https://en.wikipedia.org/wiki/Dancing_Baby" },
  { id: "wiki:mahir", kind: "wiki", era: "nostalgic", title: "I Kiss You!!! — the first accidental internet celebrity", blurb: "In 1999, Turkish journalist Mahir Çağrı's homemade personal page ('I like sex' next to ping-pong photos) made him world-famous overnight, entirely by accident.", year: "1999", url: "https://en.wikipedia.org/wiki/Mahir_%C3%87a%C4%9Fr%C4%B1" },
  { id: "wiki:pets-com", kind: "wiki", era: "nostalgic", title: "Pets.com", blurb: "The sock-puppet mascot had a Super Bowl ad and a Macy's parade balloon. Nine months later the company was gone — the defining flameout of the dot-com bubble.", year: "2000", url: "https://en.wikipedia.org/wiki/Pets.com" },
  { id: "wiki:geocities", kind: "wiki", era: "nostalgic", title: "GeoCities", blurb: "38 million hand-built homepages organized into 'neighborhoods', killed in 2009. Archivists raced to save what they could — a terabyte of under-construction GIFs and guestbooks.", year: "1994", url: "https://en.wikipedia.org/wiki/GeoCities" },
  { id: "wiki:webring", kind: "wiki", era: "nostalgic", title: "Webrings", blurb: "Before search engines worked, sites about the same topic linked themselves into rings — ← previous · random · next →. Discovery was a group project. (Sound familiar?)", url: "https://en.wikipedia.org/wiki/Webring" },
  { id: "mystery:max-headroom", kind: "mystery", era: "nostalgic", title: "The Max Headroom signal hijacking", blurb: "In 1987 someone in a Max Headroom mask hijacked two Chicago TV stations' broadcasts. Despite an FCC investigation, they were never identified. Still unsolved.", year: "1987", url: "https://en.wikipedia.org/wiki/Max_Headroom_signal_hijacking" },
  { id: "mystery:markovian", kind: "mystery", era: "nostalgic", title: "Markovian Parallax Denigrate", blurb: "In 1996, Usenet was flooded with word-salad posts under this title. Decades of sleuthing has produced theories — spam test? numbers station? — but no answer.", year: "1996", url: "https://en.wikipedia.org/wiki/Markovian_Parallax_Denigrate" },
  { id: "mystery:publius", kind: "mystery", era: "nostalgic", title: "The Publius Enigma", blurb: "After Pink Floyd released The Division Bell in 1994, an anonymous poster promised a hidden riddle in the album — confirmed by lights spelling ENIGMA at a live show. Never solved.", year: "1994", url: "https://en.wikipedia.org/wiki/Publius_Enigma" },
  { id: "mystery:cicada", kind: "mystery", era: "nostalgic", title: "Cicada 3301", blurb: "The internet's most elaborate puzzle: cryptography, obscure literature, and physical posters on three continents, posted by persons unknown for purposes unknown.", year: "2012", url: "https://en.wikipedia.org/wiki/Cicada_3301" },

  // — current: today's internet, old-web spirit —
  { id: "site:lowtech", kind: "site", era: "current", title: "The solar-powered website", blurb: "Low-tech Magazine runs on a solar panel in Barcelona. A battery meter shows the charge — and when it's cloudy too long, the site simply goes offline. By design.", url: "https://solar.lowtechmagazine.com" },
  { id: "site:1mb-club", kind: "site", era: "current", title: "1MB Club", blurb: "A directory of websites that weigh less than one megabyte — a quiet rebellion against the 10MB news article. Every member loads like lightning.", url: "https://1mb.club" },
  { id: "site:tilde-town", kind: "site", era: "current", title: "tilde.town", blurb: "A shared Unix computer where members build little homepages and chat in the terminal — an intentional community living like it's 1995, on purpose, right now.", url: "https://tilde.town" },
  { id: "site:neocities", kind: "site", era: "current", title: "Neocities", blurb: "GeoCities reborn: hundreds of thousands of hand-coded personal sites with glitter GIFs, shrines, and guestbooks. Browse by most recently updated and get lost.", url: "https://neocities.org/browse" },
  { id: "site:marginalia", kind: "site", era: "current", title: "Marginalia Search", blurb: "A search engine that deliberately ranks small, text-heavy, non-commercial pages first — built by one person to find the web that Google buries.", url: "https://search.marginalia.nu" },
  { id: "site:ooh-directory", kind: "site", era: "current", title: "ooh.directory", blurb: "A hand-curated directory of over a thousand living, breathing personal blogs, sorted by topic — like the Yahoo directory, but it's people instead of corporations.", url: "https://ooh.directory" },
  { id: "site:astronaut", kind: "site", era: "current", title: "Astronaut.io", blurb: "Plays YouTube videos that were uploaded days ago and have almost zero views — security cams, birthday parties, someone's lunch. The unwatched internet, drifting past.", url: "http://astronaut.io" },
  { id: "site:everynoise", kind: "site", era: "current", title: "Every Noise at Once", blurb: "A scatterplot of thousands of music genres, each one clickable and playable. Find out what 'norwegian space disco' sounds like. It's real and it's glorious.", url: "https://everynoise.com" },
  { id: "site:wikenigma", kind: "site", era: "current", title: "Wikenigma — an encyclopedia of the unknown", blurb: "Every entry is something humanity hasn't figured out yet: why we yawn, how anesthesia works, where eels breed. A wiki of open questions.", url: "https://wikenigma.org.uk" },
  { id: "site:pdreview", kind: "site", era: "current", title: "The Public Domain Review", blurb: "A journal that digs through out-of-copyright archives for treasures: 17th-century monster engravings, Victorian guides to mustache etiquette, forgotten dream atlases.", url: "https://publicdomainreview.org" },
  { id: "site:forgotify", kind: "site", era: "current", title: "Forgotify", blurb: "Millions of songs on Spotify have never been played. Not once. Forgotify finds them and gives each one its very first listener: you.", url: "https://forgotify.com" },
  { id: "game:dwarf-fortress", kind: "game", era: "current", title: "Dwarf Fortress", blurb: "Two brothers have spent 20+ years simulating entire worlds — geology, myth, cat alcoholism — in a game so deep its bugs become legends. Losing is fun.", year: "2006", url: "https://en.wikipedia.org/wiki/Dwarf_Fortress" },
  { id: "mystery:webdriver-torso", kind: "mystery", era: "current", title: "Webdriver Torso", blurb: "A YouTube channel uploading thousands of 11-second videos of red and blue rectangles with beeps. The internet spent months suspecting spies. The truth is almost stranger.", year: "2013", url: "https://en.wikipedia.org/wiki/Webdriver_Torso" },
  { id: "site:inblfat", kind: "site", era: "current", title: "In Bb", blurb: "Many people. Many instruments. ONE note; 'B flat'", url: "https://www.inbflat.net" },
  
  // — timeless: fascinating regardless of decade —
  { id: "site:libraryofbabel", kind: "site", era: "timeless", title: "The Library of Babel", blurb: "A website containing every possible page of text — everything ever written and everything that ever could be, findable at a permanent address. Borges' story, made real.", url: "https://libraryofbabel.info" },
  { id: "wiki:unusual-articles", kind: "wiki", era: "timeless", title: "Wikipedia's list of unusual articles", blurb: "Wikipedia editors maintain an official index of their own strangest pages: the war fought over a bucket, the holy prepuce, Tycho Brahe's moose. Hours vanish here.", url: "https://en.wikipedia.org/wiki/Wikipedia:Unusual_articles" },
  { id: "patent:swing", kind: "patent", era: "timeless", title: "US Patent 6,368,227: Method of Swinging on a Swing", blurb: "In 2002 a patent was granted for swinging sideways on a swing. The inventor was five years old (his dad was a patent attorney). It was later cancelled, but the document is forever.", year: "2002", url: "https://patents.google.com/patent/US6368227B1/en" },
  { id: "patent:cat-laser", kind: "patent", era: "timeless", title: "US Patent 5,443,036: Method of Exercising a Cat", blurb: "A real 1995 patent for pointing a laser at the floor so a cat chases it. The diagrams are everything you hope they are.", year: "1995", url: "https://patents.google.com/patent/US5443036A/en" },
  { id: "wiki:dancing-plague", kind: "wiki", era: "timeless", title: "The Dancing Plague of 1518", blurb: "In Strasbourg, hundreds of people danced uncontrollably for weeks — some until they collapsed. Authorities prescribed more dancing. It remains unexplained.", year: "1518", url: "https://en.wikipedia.org/wiki/Dancing_plague_of_1518" },
  { id: "wiki:emu-war", kind: "wiki", era: "timeless", title: "The Great Emu War", blurb: "In 1932, Australia deployed soldiers with machine guns against 20,000 emus eating their crops. The emus won. This is real military history.", year: "1932", url: "https://en.wikipedia.org/wiki/Emu_War" },
  { id: "mystery:wow-signal", kind: "mystery", era: "timeless", title: "The Wow! signal", blurb: "In 1977 a radio telescope caught a 72-second signal from deep space so strong the astronomer wrote 'Wow!' on the printout. It never repeated. We still don't know what it was.", year: "1977", url: "https://en.wikipedia.org/wiki/Wow!_signal" },
  { id: "mystery:bloop", kind: "mystery", era: "timeless", title: "The Bloop", blurb: "In 1997, underwater microphones 5,000 km apart picked up one of the loudest sounds ever recorded in the ocean. The leading theory took 15 years to settle on: a very big icequake. Probably.", year: "1997", url: "https://en.wikipedia.org/wiki/Bloop" },
  { id: "mystery:uvb76", kind: "mystery", era: "timeless", title: "UVB-76, the Buzzer", blurb: "A Russian shortwave station has broadcast a monotonous buzz nearly nonstop since the 1970s, occasionally interrupted by cryptic voice messages. Nobody officially knows why.", url: "https://en.wikipedia.org/wiki/UVB-76" },
  { id: "wiki:low-background-steel", kind: "wiki", era: "timeless", title: "Why scientists salvage steel from sunken battleships", blurb: "Every piece of steel made after 1945 carries traces of nuclear-test fallout. For ultra-sensitive instruments, we harvest 'low-background steel' from pre-war shipwrecks.", url: "https://en.wikipedia.org/wiki/Low-background_steel" },
];

// DEEP CUTS — the secret stumble pool, unlocked with the Konami code (↑↑↓↓←→←→BA).
// Same artifact shape as MANUAL_ARTIFACTS, but stranger: the stuff you tell one
// friend about at 1am. Once unlocked, these join the 🎲 draw with their own
// (small) bucket and get the 🩻 DEEP CUT chip on the stumble page.
export const MANUAL_DEEP_CUTS = [
  { id: "deep:polybius", kind: "mystery", era: "nostalgic", title: "Polybius — the arcade cabinet that never existed", blurb: "The legend: a 1981 arcade game so addictive it caused amnesia, watched over by men in black, then vanished. No machine has ever been found. The perfect video game ghost story.", year: "1981", url: "https://en.wikipedia.org/wiki/Polybius_(urban_legend)" },
  { id: "deep:john-titor", kind: "mystery", era: "nostalgic", title: "John Titor, time traveler from 2036", blurb: "In 2000, a forum poster claimed to be a soldier sent back for an IBM 5100. He posted schematics of his time machine, made predictions, and vanished in 2001. Forums never recovered.", year: "2000", url: "https://en.wikipedia.org/wiki/John_Titor" },
  { id: "deep:toynbee-tiles", kind: "mystery", era: "timeless", title: "The Toynbee tiles", blurb: "Hundreds of cryptic tiles about resurrecting the dead on Jupiter, embedded in city streets across the Americas since the 1980s by someone unknown, using a technique no one's fully cracked.", url: "https://en.wikipedia.org/wiki/Toynbee_tiles" },
  { id: "deep:ted-the-caver", kind: "site", era: "nostalgic", title: "Ted the Caver", blurb: "A plain Angelfire page from 2001 that diaries two friends digging into a cave passage that gets... wrong. Arguably the internet's first creepypasta, and the original page is still up.", year: "2001", url: "https://en.wikipedia.org/wiki/Ted_the_Caver" },
  { id: "deep:time-cube", kind: "wiki", era: "nostalgic", title: "Time Cube", blurb: "For 18 years, one man maintained an endless, ALL-CAPS, increasingly font-sized website proving Earth experiences four simultaneous days. A monument of outsider web design.", year: "1997", url: "https://en.wikipedia.org/wiki/Time_Cube" },
  { id: "deep:rongorongo", kind: "wiki", era: "timeless", title: "Rongorongo", blurb: "Easter Island had a written script. Nobody on Earth can read it. It may be one of the only times in history writing was invented from scratch — and we lost the key within a century.", url: "https://en.wikipedia.org/wiki/Rongorongo" },
  { id: "deep:the-hum", kind: "mystery", era: "timeless", title: "The Hum", blurb: "In Taos, Bristol, Windsor, and dozens of other places, a small percentage of people hear a constant low-frequency hum nobody can source. Investigations keep ending in shrugs.", url: "https://en.wikipedia.org/wiki/The_Hum" },
  { id: "deep:codex-seraphinianus", kind: "wiki", era: "timeless", title: "Codex Seraphinianus", blurb: "In 1981 an Italian designer published an encyclopedia of a world that doesn't exist, written in a script that can't be read, illustrating machines and creatures that shouldn't be. On purpose.", year: "1981", url: "https://en.wikipedia.org/wiki/Codex_Seraphinianus" },
  { id: "deep:agloe", kind: "wiki", era: "timeless", title: "Agloe, the fake town that became real", blurb: "Mapmakers invented Agloe, New York as a copyright trap. Then someone built a general store there, named it after the 'town' — and the fake place legally existed for decades.", url: "https://en.wikipedia.org/wiki/Agloe,_New_York" },
  { id: "deep:logic-named-joe", kind: "wiki", era: "timeless", title: "The 1946 story that predicted the internet", blurb: "'A Logic Named Joe' imagined a home terminal on every desk, connected to shared data, answering any question — and the moderation crisis that follows. Written before the transistor.", year: "1946", url: "https://en.wikipedia.org/wiki/A_Logic_Named_Joe" },
];

/* ─── THE WATER COOLER (/watercooler) ──────────────────────────────────────
   Pop-culture content for the dedicated 💧 page. Same manual+generated split as
   everything above; these hand-edited seeds lead the pool and persist across
   `npm run generate`. Keep the voice dry, warm, 2000s-e-zine — name the real
   thing, then give it the early-2000s twist. (On-This-Day lives in its own file,
   src/data/manual/onthisday.js, because it's keyed by calendar date, not rotated.)
   ────────────────────────────────────────────────────────────────────────── */

// THE COUNTDOWN — whole TRL/Billboard-style top-5 chart SETS. Rotated as a unit
// (the ranking IS the content), one set per day. Shape:
//   { id, title, unit:"song"|"movie"|"show", blurb?,
//     entries: [{ rank:1..5, title, by?, note?, trend:"up"|"down"|"same"|"new" }] }
// Always EXACTLY 5 entries, ranks 1..5. `trend` drives the ↑↓– arrow; `note` is
// the dry one-liner under each pick. These go stale — refresh the topical ones
// monthly (npm run generate) and keep a few evergreen sets here so the page is
// never empty between runs.
export const MANUAL_COUNTDOWNS = [
  {
    id: "ctd-songs-stuck",
    title: "TOP 5 SONGS STUCK IN EVERYONE'S HEAD",
    unit: "song",
    blurb: "as decided by the entire internet, no take-backs",
    entries: [
      { rank: 1, title: "the one from the show everyone's watching", by: "you know the one", note: "you're humming it right now. that's the request line working.", trend: "up" },
      { rank: 2, title: "the throwback that won't die", by: "an artist from 2003", note: "a TikTok unearthed it and now it's everywhere again. the cycle is complete.", trend: "new" },
      { rank: 3, title: "the summer single", by: "the pop star of the moment", note: "engineered in a lab to be unskippable. it worked.", trend: "down" },
      { rank: 4, title: "the sad one you secretly love", by: "the sensitive one", note: "for staring out the bus window like it's a music video.", trend: "same" },
      { rank: 5, title: "the novelty track", by: "an account, not a band", note: "it shouldn't chart. it's charting. respect the chaos.", trend: "up" },
    ],
  },
  {
    id: "ctd-rewatch-comfort",
    title: "TOP 5 SHOWS THE INTERNET WON'T SHUT UP ABOUT",
    unit: "show",
    blurb: "the group chat has opinions",
    entries: [
      { rank: 1, title: "the prestige drama with the twist", note: "do NOT read the replies until you've finished. they have no mercy.", trend: "same" },
      { rank: 2, title: "the comfort sitcom on its 9th rewatch", note: "you've seen every episode. you'll watch it again tonight. that's the deal.", trend: "up" },
      { rank: 3, title: "the reality show that's actually art", note: "trash, but the kind you'd defend in a college essay.", trend: "up" },
      { rank: 4, title: "the animated one for 'kids'", note: "the adults are crying harder than the kids. it's fine. everyone's fine.", trend: "new" },
      { rank: 5, title: "the show that got cancelled too soon", note: "RIP. the fandom is still lighting candles in the tag.", trend: "down" },
    ],
  },
  {
    id: "ctd-box-office",
    title: "TOP 5 AT THE BOX OFFICE-OF-THE-MIND",
    unit: "movie",
    blurb: "what the whole multiplex is arguing about",
    entries: [
      { rank: 1, title: "the blockbuster sequel nobody asked for but everyone saw", note: "it made a billion dollars. you saw it twice. let's not pretend.", trend: "same" },
      { rank: 2, title: "the original idea that snuck through", note: "an actual new story. in this economy. cherish it.", trend: "new" },
      { rank: 3, title: "the indie that became a meme", note: "you haven't seen it but you can quote it. that's modern cinema.", trend: "up" },
      { rank: 4, title: "the legacy reboot", note: "same title, new cast, your childhood used as a hostage. you went anyway.", trend: "down" },
      { rank: 5, title: "the one that's better than it had any right to be", note: "the trailer was a disaster. the movie is a 9. the internet is shocked.", trend: "up" },
    ],
  },
];

// THE BUZZ — short water-cooler/tabloid blurbs, dry 2000s e-zine humor. Shown a
// few per day (rotateDailyN). Shape: { id, text (<=160 chars), tag } where tag is
// one of GOSSIP | RUMOR | SIGHTING | HOT TAKE (drives the small chip). No URL —
// these are flavor, not links. Inherently topical; keep them understandable a few
// weeks later and refresh the time-sensitive ones via npm run generate.
export const MANUAL_BUZZ = [
  { id: "bz-reboot", text: "Another beloved 2000s franchise is getting rebooted. The original cast is 'in talks,' which is Hollywood for 'we asked, they're thinking about the check.'", tag: "RUMOR" },
  { id: "bz-feud", text: "Two pop stars are 'not feuding,' according to a statement that nobody asked them for, which is how you know they are absolutely feuding.", tag: "GOSSIP" },
  { id: "bz-vinyl", text: "Vinyl outsold CDs again. Somewhere, a teenager just discovered the album their parents played on a CD changer in a minivan. The wheel turns.", tag: "HOT TAKE" },
  { id: "bz-celebrity-coffee", text: "A celebrity was photographed holding an iced coffee. The internet has produced 4,000 words of analysis. This is the content economy working as designed.", tag: "SIGHTING" },
  { id: "bz-flip-phone", text: "Flip phones are back. Not for the battery life — for the dramatic snap when you hang up. You cannot slam an end call on a glass slab and they know it.", tag: "HOT TAKE" },
  { id: "bz-album-leak", text: "An album 'leaked' three days early. By 'leaked' the label means 'we leaked it.' By 'three days early' they mean 'right on the marketing schedule.'", tag: "RUMOR" },
  { id: "bz-cameo", text: "A washed-up 2000s heartthrob just had a scene-stealing cameo and the entire timeline collectively gasped. The comeback arc is the only renewable resource left.", tag: "GOSSIP" },
  { id: "bz-streaming-price", text: "Your streaming service raised its price again and added ads. It is, slowly and with great confidence, reinventing cable television. Welcome home.", tag: "HOT TAKE" },
  { id: "bz-low-rise", text: "Low-rise jeans are back in stores. Everyone who survived them the first time is staring into the middle distance, hearing a dial-up tone.", tag: "SIGHTING" },
  { id: "bz-secret-show", text: "RUMOR: a huge act is playing a 'secret' show at a tiny venue. It's secret in the way a billboard is secret. Tickets resold for a mortgage payment in nine minutes.", tag: "RUMOR" },
  { id: "bz-award-snub", text: "The award nominations dropped and your favorite got snubbed. The acceptable response is a measured, dignified post. You will not be doing that.", tag: "HOT TAKE" },
  { id: "bz-mall", text: "A mascot for a dead mall chain got a tribute account with 200k followers. Nostalgia is now a load-bearing industry. The food court lives on, in spirit.", tag: "SIGHTING" },
];

// HOT OR NOT — the interactive 2000s-web staple, normalized to the POLL shape so
// it reuses the exact vote/tally/Firebase infra (see src/lib/votes.js + polls.js).
// You provide { id (hon-…, namespaced so it never collides with daily polls),
// subject, emoji }; the loader hard-codes the two options [HOT, NOT] so vote ids
// are always exactly "hot" / "not". A daily slate (rotateDailyN) gives a fresh set.
export const MANUAL_HOTORNOT = [
  { id: "hon-low-rise-jeans", subject: "Low-rise jeans (the sequel)", emoji: "👖" },
  { id: "hon-frosted-tips", subject: "Frosted tips, unironically", emoji: "💇" },
  { id: "hon-cargo-pants", subject: "Cargo pants with eleven pockets", emoji: "🩳" },
  { id: "hon-flip-phone", subject: "Carrying a flip phone in 2026", emoji: "📱" },
  { id: "hon-trucker-hat", subject: "The trucker hat revival", emoji: "🧢" },
  { id: "hon-emo-fringe", subject: "The emo side-swept fringe", emoji: "🖤" },
  { id: "hon-y2k-aesthetic", subject: "The whole Y2K aesthetic, again", emoji: "💿" },
  { id: "hon-juicy-tracksuit", subject: "The velour tracksuit", emoji: "🛼" },
  { id: "hon-dvd-collection", subject: "Owning physical DVDs again", emoji: "📀" },
  { id: "hon-band-tshirt", subject: "Band tee for a band you can't name", emoji: "🎸" },
  { id: "hon-side-part", subject: "The side part vs. the middle part war", emoji: "💈" },
  { id: "hon-myspace-top8", subject: "Ranking your friends in a Top 8", emoji: "🏆" },
];
