// Ourcade Daily Relic Run node graph
// Generated as a static, reusable graph for deterministic daily route puzzles.
// Links are neighbor node IDs. The graph is intentionally connected and cross-linked.
//
// TOPOLOGY ONLY: each node here owns its graph data (links, category, relic). The
// readable wiki-style ARTICLE prose lives in ./relicArticles.js and is merged in
// at the bottom of this file (node.article = RELIC_ARTICLES[id]), so this file
// stays a small, reviewable graph while the long prose lives apart.

import { RELIC_ARTICLES } from "./relicArticles.js";
import { inspectArticle } from "../games/relic-run/article.js";

const RAW_RELIC_NODES = {
  "hamster-dance": {
    "id": "hamster-dance",
    "title": "Hamster Dance Shrine",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "gif",
      "music",
      "loop",
      "animals"
    ],
    "links": [
      "peanut-butter-jelly-time",
      "badger-badger-badger",
      "keyboard-cat",
      "oolong-pancake-bunny",
      "midi-zone",
      "animated-gif",
      "webring-hub"
    ]
  },
  "peanut-butter-jelly-time": {
    "id": "peanut-butter-jelly-time",
    "title": "Peanut Butter Jelly Time",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "flash",
      "music",
      "dancing-banana",
      "loop"
    ],
    "links": [
      "hamster-dance",
      "badger-badger-badger",
      "numa-numa",
      "oolong-pancake-bunny",
      "animated-gif",
      "swf-file",
      "newgrounds-portal"
    ]
  },
  "badger-badger-badger": {
    "id": "badger-badger-badger",
    "title": "Badger Badger Badger Den",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "flash",
      "weebl",
      "music",
      "badgers"
    ],
    "links": [
      "hamster-dance",
      "peanut-butter-jelly-time",
      "numa-numa",
      "dancing-baby",
      "magical-trevor",
      "flashpoint-archive",
      "newgrounds-portal"
    ]
  },
  "numa-numa": {
    "id": "numa-numa",
    "title": "Numa Numa Webcam Room",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "newgrounds",
      "webcam",
      "music",
      "lip-sync"
    ],
    "links": [
      "peanut-butter-jelly-time",
      "badger-badger-badger",
      "dancing-baby",
      "all-your-base",
      "newgrounds-portal",
      "quicktime-trailer",
      "myspace-profile"
    ]
  },
  "dancing-baby": {
    "id": "dancing-baby",
    "title": "Dancing Baby Nursery",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "cgi",
      "email-forward",
      "viral-video",
      "loop"
    ],
    "links": [
      "badger-badger-badger",
      "numa-numa",
      "all-your-base",
      "star-wars-kid",
      "chain-email",
      "animated-gif",
      "email-me-gif"
    ]
  },
  "all-your-base": {
    "id": "all-your-base",
    "title": "All Your Base Command Deck",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "zero-wing",
      "translation",
      "gaming",
      "catchphrase"
    ],
    "links": [
      "numa-numa",
      "dancing-baby",
      "star-wars-kid",
      "dramatic-chipmunk",
      "newgrounds-portal",
      "forum-signature",
      "swf-file"
    ]
  },
  "star-wars-kid": {
    "id": "star-wars-kid",
    "title": "Star Wars Kid Tape Room",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "viral-video",
      "webcam",
      "fan-culture",
      "ethics"
    ],
    "links": [
      "dancing-baby",
      "all-your-base",
      "dramatic-chipmunk",
      "numa-forum-mirror",
      "quicktime-trailer",
      "forum-signature",
      "image-host-broken"
    ]
  },
  "dramatic-chipmunk": {
    "id": "dramatic-chipmunk",
    "title": "Dramatic Chipmunk Cliff",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "reaction",
      "short-video",
      "animals",
      "mid-2000s"
    ],
    "links": [
      "all-your-base",
      "star-wars-kid",
      "numa-forum-mirror",
      "leekspin",
      "fark-headline",
      "quicktime-trailer"
    ]
  },
  "numa-forum-mirror": {
    "id": "numa-forum-mirror",
    "title": "Numa Forum Mirror",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "mirror",
      "reupload",
      "forums",
      "video"
    ],
    "links": [
      "star-wars-kid",
      "dramatic-chipmunk",
      "leekspin",
      "llama-song",
      "phpbb-thread",
      "photobucket-bucket"
    ]
  },
  "leekspin": {
    "id": "leekspin",
    "title": "Leekspin Loop",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "anime",
      "loop",
      "music",
      "gif"
    ],
    "links": [
      "dramatic-chipmunk",
      "numa-forum-mirror",
      "llama-song",
      "magical-trevor",
      "animated-gif",
      "midi-zone"
    ]
  },
  "llama-song": {
    "id": "llama-song",
    "title": "Llama Song Pasture",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "flash",
      "song",
      "absurd",
      "animals"
    ],
    "links": [
      "numa-forum-mirror",
      "leekspin",
      "magical-trevor",
      "end-of-ze-world",
      "newgrounds-portal"
    ]
  },
  "magical-trevor": {
    "id": "magical-trevor",
    "title": "Magical Trevor Tent",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "flash",
      "weebl",
      "song",
      "loop"
    ],
    "links": [
      "leekspin",
      "llama-song",
      "end-of-ze-world",
      "rickroll-redirect",
      "badger-badger-badger"
    ]
  },
  "end-of-ze-world": {
    "id": "end-of-ze-world",
    "title": "End of Ze World Bunker",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "flash",
      "animation",
      "quoteable",
      "satire"
    ],
    "links": [
      "llama-song",
      "magical-trevor",
      "rickroll-redirect",
      "keyboard-cat",
      "flashpoint-archive",
      "fark-headline"
    ]
  },
  "rickroll-redirect": {
    "id": "rickroll-redirect",
    "title": "Rickroll Redirect",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "bait-link",
      "music-video",
      "redirect",
      "prank"
    ],
    "links": [
      "magical-trevor",
      "end-of-ze-world",
      "keyboard-cat",
      "oolong-pancake-bunny",
      "download-button-decoy",
      "myspace-profile"
    ]
  },
  "keyboard-cat": {
    "id": "keyboard-cat",
    "title": "Keyboard Cat Green Room",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "video",
      "reaction",
      "music",
      "cat"
    ],
    "links": [
      "end-of-ze-world",
      "rickroll-redirect",
      "oolong-pancake-bunny",
      "hamster-dance",
      "quicktime-trailer",
      "fark-headline"
    ]
  },
  "oolong-pancake-bunny": {
    "id": "oolong-pancake-bunny",
    "title": "Pancake Bunny Photo Shelf",
    "category": "meme",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "meme",
      "viral",
      "old-internet",
      "photo-meme",
      "animal",
      "forum",
      "image"
    ],
    "links": [
      "rickroll-redirect",
      "keyboard-cat",
      "hamster-dance",
      "peanut-butter-jelly-time",
      "forum-signature",
      "photobucket-bucket"
    ]
  },
  "newgrounds-portal": {
    "id": "newgrounds-portal",
    "title": "Newgrounds Portal",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "newgrounds",
      "swf",
      "ratings",
      "creator-culture"
    ],
    "links": [
      "alien-hominid",
      "pico-school",
      "club-penguin-plaza",
      "neopets-faerieland",
      "peanut-butter-jelly-time",
      "badger-badger-badger",
      "numa-numa",
      "all-your-base",
      "llama-song",
      "swf-file",
      "flashpoint-archive",
      "ruffle-emulator"
    ]
  },
  "alien-hominid": {
    "id": "alien-hominid",
    "title": "Alien Hominid Crash Site",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "newgrounds",
      "run-and-gun",
      "the-behemoth",
      "console-jump"
    ],
    "links": [
      "newgrounds-portal",
      "pico-school",
      "madness-combat",
      "neopets-faerieland",
      "game-boy-advance"
    ]
  },
  "pico-school": {
    "id": "pico-school",
    "title": "Pico School Hallway",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "newgrounds",
      "pico",
      "flash-animation",
      "mascot"
    ],
    "links": [
      "newgrounds-portal",
      "alien-hominid",
      "madness-combat",
      "fancy-pants-adventure",
      "forum-signature",
      "swf-file"
    ]
  },
  "madness-combat": {
    "id": "madness-combat",
    "title": "Madness Combat Wasteland",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "newgrounds",
      "animation",
      "action",
      "krinkels"
    ],
    "links": [
      "alien-hominid",
      "pico-school",
      "fancy-pants-adventure",
      "line-rider",
      "animated-gif",
      "phpbb-thread"
    ]
  },
  "fancy-pants-adventure": {
    "id": "fancy-pants-adventure",
    "title": "Fancy Pants Adventure Hills",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "platformer",
      "brad-borne",
      "momentum",
      "animation"
    ],
    "links": [
      "pico-school",
      "madness-combat",
      "line-rider",
      "stick-rpg",
      "flashpoint-archive"
    ]
  },
  "line-rider": {
    "id": "line-rider",
    "title": "Line Rider Sketchbook",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "physics",
      "drawing",
      "sandbox",
      "sled"
    ],
    "links": [
      "madness-combat",
      "fancy-pants-adventure",
      "stick-rpg",
      "defend-your-castle",
      "photobucket-bucket",
      "desktop-tower-defense"
    ]
  },
  "stick-rpg": {
    "id": "stick-rpg",
    "title": "Stick RPG Paper City",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "xgen",
      "rpg",
      "stick-figure",
      "simulation"
    ],
    "links": [
      "fancy-pants-adventure",
      "line-rider",
      "defend-your-castle",
      "bloons",
      "xanga-diary",
      "neopets-faerieland"
    ]
  },
  "defend-your-castle": {
    "id": "defend-your-castle",
    "title": "Defend Your Castle Wall",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "xgen",
      "mouse-game",
      "stick-figure",
      "defense"
    ],
    "links": [
      "line-rider",
      "stick-rpg",
      "bloons",
      "motherload",
      "desktop-tower-defense",
      "copter-game"
    ]
  },
  "bloons": {
    "id": "bloons",
    "title": "Bloons Dart Booth",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "puzzle",
      "darts",
      "monkey",
      "balloons"
    ],
    "links": [
      "stick-rpg",
      "defend-your-castle",
      "motherload",
      "impossible-quiz",
      "desktop-tower-defense",
      "neopets-faerieland"
    ]
  },
  "motherload": {
    "id": "motherload",
    "title": "Motherload Mining Shaft",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "xgen",
      "mining",
      "upgrade-loop",
      "mars"
    ],
    "links": [
      "defend-your-castle",
      "bloons",
      "impossible-quiz",
      "punk-o-matic",
      "dell-dimension-tower",
      "swf-file"
    ]
  },
  "impossible-quiz": {
    "id": "impossible-quiz",
    "title": "Impossible Quiz Trapdoor",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "quiz",
      "trick-questions",
      "absurd",
      "challenge"
    ],
    "links": [
      "bloons",
      "motherload",
      "punk-o-matic",
      "desktop-tower-defense",
      "captcha-goblin",
      "download-button-decoy"
    ]
  },
  "punk-o-matic": {
    "id": "punk-o-matic",
    "title": "Punk-O-Matic Garage",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "music-maker",
      "sequencer",
      "punk",
      "loops"
    ],
    "links": [
      "motherload",
      "impossible-quiz",
      "desktop-tower-defense",
      "copter-game",
      "winamp-skins",
      "mp3-hoard"
    ]
  },
  "desktop-tower-defense": {
    "id": "desktop-tower-defense",
    "title": "Desktop Tower Defense Desk",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "strategy",
      "tower-defense",
      "maze",
      "office"
    ],
    "links": [
      "impossible-quiz",
      "punk-o-matic",
      "copter-game",
      "club-penguin-plaza",
      "line-rider",
      "defend-your-castle",
      "bloons"
    ]
  },
  "copter-game": {
    "id": "copter-game",
    "title": "Copter Game Tunnel",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "one-button",
      "endless",
      "skill",
      "tunnel"
    ],
    "links": [
      "punk-o-matic",
      "desktop-tower-defense",
      "club-penguin-plaza",
      "neopets-faerieland",
      "defend-your-castle",
      "internet-explorer-six"
    ]
  },
  "club-penguin-plaza": {
    "id": "club-penguin-plaza",
    "title": "Club Penguin Plaza",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "virtual-world",
      "chat",
      "avatar",
      "snow"
    ],
    "links": [
      "desktop-tower-defense",
      "copter-game",
      "neopets-faerieland",
      "newgrounds-portal",
      "myspace-profile",
      "aim-away-message"
    ]
  },
  "neopets-faerieland": {
    "id": "neopets-faerieland",
    "title": "Neopets Faerieland",
    "category": "flash-game",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "flash-game",
      "browser-game",
      "arcade",
      "virtual-pets",
      "economy",
      "quests",
      "web-game"
    ],
    "links": [
      "copter-game",
      "club-penguin-plaza",
      "newgrounds-portal",
      "alien-hominid",
      "stick-rpg",
      "bloons",
      "yahoo-directory",
      "forum-signature"
    ]
  },
  "geocities-homepage": {
    "id": "geocities-homepage",
    "title": "GeoCities Homepage",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "geocities",
      "free-hosting",
      "html",
      "personal-site"
    ],
    "links": [
      "angelfire-attic",
      "tripod-page",
      "email-me-gif",
      "award-badge-wall",
      "webring-hub",
      "guestbook",
      "under-construction",
      "hit-counter",
      "tiled-background",
      "midi-zone",
      "netscape-navigator"
    ]
  },
  "angelfire-attic": {
    "id": "angelfire-attic",
    "title": "Angelfire Attic",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "angelfire",
      "free-hosting",
      "fan-site",
      "banner-ad"
    ],
    "links": [
      "geocities-homepage",
      "tripod-page",
      "webring-hub",
      "award-badge-wall",
      "blink-tag"
    ]
  },
  "tripod-page": {
    "id": "tripod-page",
    "title": "Tripod Page",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "tripod",
      "free-hosting",
      "personal-site",
      "sidebar"
    ],
    "links": [
      "geocities-homepage",
      "angelfire-attic",
      "webring-hub",
      "guestbook",
      "frameset-labyrinth",
      "best-viewed-800x600"
    ]
  },
  "webring-hub": {
    "id": "webring-hub",
    "title": "Webring Hub",
    "relic": { "id": "webring-token", "where": "token" },
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "webring",
      "navigation",
      "discovery",
      "link-culture"
    ],
    "links": [
      "angelfire-attic",
      "tripod-page",
      "guestbook",
      "under-construction",
      "hamster-dance",
      "geocities-homepage",
      "yahoo-directory",
      "slashdot-frontpage",
      "four-oh-four-page"
    ]
  },
  "guestbook": {
    "id": "guestbook",
    "title": "Guestbook Chamber",
    "relic": { "id": "guestbook-signature", "where": "signature" },
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "guestbook",
      "comments",
      "spam",
      "visitor"
    ],
    "links": [
      "tripod-page",
      "webring-hub",
      "under-construction",
      "hit-counter",
      "geocities-homepage",
      "chain-email",
      "phpbb-thread",
      "captcha-goblin"
    ]
  },
  "under-construction": {
    "id": "under-construction",
    "title": "Under Construction GIF Quarry",
    "relic": { "id": "geo-under-construction", "where": "sign" },
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "gif",
      "construction",
      "unfinished"
    ],
    "links": [
      "webring-hub",
      "guestbook",
      "hit-counter",
      "marquee-museum",
      "geocities-homepage",
      "animated-gif",
      "four-oh-four-page"
    ]
  },
  "hit-counter": {
    "id": "hit-counter",
    "title": "Hit Counter Vault",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "counter",
      "stats",
      "cgi",
      "visitor"
    ],
    "links": [
      "guestbook",
      "under-construction",
      "marquee-museum",
      "tiled-background",
      "geocities-homepage",
      "popup-ad-alley"
    ]
  },
  "marquee-museum": {
    "id": "marquee-museum",
    "title": "Marquee Museum",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "marquee",
      "html",
      "scrolling-text",
      "novelty"
    ],
    "links": [
      "under-construction",
      "hit-counter",
      "tiled-background",
      "midi-zone",
      "blink-tag",
      "dancing-cursor-trail"
    ]
  },
  "tiled-background": {
    "id": "tiled-background",
    "title": "Tiled Background Swamp",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "background",
      "texture",
      "starfield",
      "design"
    ],
    "links": [
      "hit-counter",
      "marquee-museum",
      "midi-zone",
      "blink-tag",
      "geocities-homepage",
      "myspace-profile",
      "xanga-diary",
      "dancing-cursor-trail"
    ]
  },
  "midi-zone": {
    "id": "midi-zone",
    "title": "MIDI Zone",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "midi",
      "autoplay",
      "music",
      "webpage"
    ],
    "links": [
      "marquee-museum",
      "tiled-background",
      "blink-tag",
      "frameset-labyrinth",
      "hamster-dance",
      "leekspin",
      "geocities-homepage",
      "winamp-skins",
      "mp3-hoard"
    ]
  },
  "blink-tag": {
    "id": "blink-tag",
    "title": "Blink Tag Lighthouse",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "html",
      "typography",
      "blinking-text",
      "browser"
    ],
    "links": [
      "tiled-background",
      "midi-zone",
      "frameset-labyrinth",
      "splash-page",
      "angelfire-attic",
      "marquee-museum"
    ]
  },
  "frameset-labyrinth": {
    "id": "frameset-labyrinth",
    "title": "Frameset Labyrinth",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "frames",
      "layout",
      "scrollbars",
      "html"
    ],
    "links": [
      "midi-zone",
      "blink-tag",
      "splash-page",
      "best-viewed-800x600",
      "tripod-page",
      "internet-explorer-six"
    ]
  },
  "splash-page": {
    "id": "splash-page",
    "title": "Splash Page Gate",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "intro",
      "flash",
      "bandwidth-choice",
      "gateway"
    ],
    "links": [
      "blink-tag",
      "frameset-labyrinth",
      "best-viewed-800x600",
      "email-me-gif",
      "swf-file"
    ]
  },
  "best-viewed-800x600": {
    "id": "best-viewed-800x600",
    "title": "Best Viewed 800x600 Shrine",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "badge",
      "resolution",
      "crt",
      "layout"
    ],
    "links": [
      "frameset-labyrinth",
      "splash-page",
      "email-me-gif",
      "award-badge-wall",
      "tripod-page",
      "crt-monitor-glow"
    ]
  },
  "email-me-gif": {
    "id": "email-me-gif",
    "title": "Email Me GIF Mailbox",
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "email",
      "gif",
      "contact",
      "mailto"
    ],
    "links": [
      "splash-page",
      "best-viewed-800x600",
      "award-badge-wall",
      "geocities-homepage",
      "dancing-baby",
      "chain-email",
      "animated-gif"
    ]
  },
  "award-badge-wall": {
    "id": "award-badge-wall",
    "title": "Award Badge Wall",
    "relic": { "id": "broken-button-88x31", "where": "button" },
    "category": "web-relic",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "early-web",
      "homepage",
      "web-relic",
      "badge",
      "top-site",
      "awards",
      "prestige"
    ],
    "links": [
      "best-viewed-800x600",
      "email-me-gif",
      "geocities-homepage",
      "angelfire-attic",
      "forum-signature"
    ]
  },
  "winamp-skins": {
    "id": "winamp-skins",
    "title": "Winamp Skin Drawer",
    "relic": { "id": "winamp-skin-wsz", "where": "skin" },
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "winamp",
      "mp3",
      "skins",
      "nullsoft"
    ],
    "links": [
      "limewire-library",
      "napster-basement",
      "netscape-navigator",
      "internet-explorer-six",
      "punk-o-matic",
      "midi-zone",
      "mp3-hoard",
      "windows-media-player-visualizer"
    ]
  },
  "limewire-library": {
    "id": "limewire-library",
    "title": "LimeWire Library",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "p2p",
      "downloads",
      "mp3",
      "file-sharing"
    ],
    "links": [
      "winamp-skins",
      "napster-basement",
      "kazaa-kiosk",
      "internet-explorer-six",
      "mp3-hoard",
      "zip-file",
      "spyware-scan",
      "ipod-click-wheel"
    ]
  },
  "napster-basement": {
    "id": "napster-basement",
    "title": "Napster Basement",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "p2p",
      "music",
      "file-sharing",
      "mp3"
    ],
    "links": [
      "winamp-skins",
      "limewire-library",
      "kazaa-kiosk",
      "realplayer-popup",
      "mp3-hoard",
      "cd-r-spindle"
    ]
  },
  "kazaa-kiosk": {
    "id": "kazaa-kiosk",
    "title": "KaZaA Kiosk",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "p2p",
      "downloads",
      "toolbars",
      "risk"
    ],
    "links": [
      "limewire-library",
      "napster-basement",
      "realplayer-popup",
      "quicktime-trailer",
      "spyware-scan",
      "browser-toolbar-stack"
    ]
  },
  "realplayer-popup": {
    "id": "realplayer-popup",
    "title": "RealPlayer Popup",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "streaming",
      "media-player",
      "buffering",
      "plugin"
    ],
    "links": [
      "napster-basement",
      "kazaa-kiosk",
      "quicktime-trailer",
      "windows-media-player-visualizer",
      "popup-ad-alley"
    ]
  },
  "quicktime-trailer": {
    "id": "quicktime-trailer",
    "title": "QuickTime Trailer Booth",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "quicktime",
      "movie-trailer",
      "buffering",
      "plugin"
    ],
    "links": [
      "kazaa-kiosk",
      "realplayer-popup",
      "windows-media-player-visualizer",
      "aim-away-message",
      "numa-numa",
      "star-wars-kid",
      "dramatic-chipmunk",
      "keyboard-cat",
      "ipod-click-wheel",
      "cd-r-spindle",
      "translucent-imac-g3"
    ]
  },
  "windows-media-player-visualizer": {
    "id": "windows-media-player-visualizer",
    "title": "Windows Media Visualizer Dome",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "visualizer",
      "mp3",
      "windows",
      "screensaver"
    ],
    "links": [
      "realplayer-popup",
      "quicktime-trailer",
      "aim-away-message",
      "icq-uh-oh",
      "winamp-skins",
      "crt-monitor-glow",
      "dell-dimension-tower"
    ]
  },
  "aim-away-message": {
    "id": "aim-away-message",
    "title": "AIM Away Message Desk",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "aim",
      "status",
      "chat",
      "lyrics"
    ],
    "links": [
      "quicktime-trailer",
      "windows-media-player-visualizer",
      "icq-uh-oh",
      "msn-wink-vault",
      "club-penguin-plaza",
      "livejournal-entry",
      "nokia-3310"
    ]
  },
  "icq-uh-oh": {
    "id": "icq-uh-oh",
    "title": "ICQ Uh-Oh Switchboard",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "icq",
      "messaging",
      "contacts",
      "sound"
    ],
    "links": [
      "windows-media-player-visualizer",
      "aim-away-message",
      "msn-wink-vault",
      "bonzibuddy-office",
      "forum-signature"
    ]
  },
  "msn-wink-vault": {
    "id": "msn-wink-vault",
    "title": "MSN Wink Vault",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "msn",
      "messenger",
      "emoticons",
      "animation"
    ],
    "links": [
      "aim-away-message",
      "icq-uh-oh",
      "bonzibuddy-office",
      "ask-jeeves-desk",
      "myspace-profile"
    ]
  },
  "bonzibuddy-office": {
    "id": "bonzibuddy-office",
    "title": "BonziBuddy Office",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "assistant",
      "adware",
      "purple-gorilla"
    ],
    "links": [
      "icq-uh-oh",
      "msn-wink-vault",
      "ask-jeeves-desk",
      "yahoo-directory",
      "spyware-scan",
      "browser-toolbar-stack"
    ]
  },
  "ask-jeeves-desk": {
    "id": "ask-jeeves-desk",
    "title": "Ask Jeeves Desk",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "search",
      "directory",
      "butler",
      "questions"
    ],
    "links": [
      "msn-wink-vault",
      "bonzibuddy-office",
      "yahoo-directory",
      "altavista-oracle"
    ]
  },
  "yahoo-directory": {
    "id": "yahoo-directory",
    "title": "Yahoo Directory Stacks",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "yahoo",
      "directory",
      "taxonomy",
      "browsing"
    ],
    "links": [
      "bonzibuddy-office",
      "ask-jeeves-desk",
      "altavista-oracle",
      "netscape-navigator",
      "neopets-faerieland",
      "webring-hub"
    ]
  },
  "altavista-oracle": {
    "id": "altavista-oracle",
    "title": "AltaVista Oracle",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "search",
      "index",
      "query",
      "pre-google"
    ],
    "links": [
      "ask-jeeves-desk",
      "yahoo-directory",
      "netscape-navigator",
      "internet-explorer-six"
    ]
  },
  "netscape-navigator": {
    "id": "netscape-navigator",
    "title": "Netscape Navigator Helm",
    "relic": { "id": "first-pixel", "where": "pixel" },
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "browser",
      "netscape",
      "frames",
      "javascript"
    ],
    "links": [
      "yahoo-directory",
      "altavista-oracle",
      "internet-explorer-six",
      "winamp-skins",
      "geocities-homepage",
      "translucent-imac-g3"
    ]
  },
  "internet-explorer-six": {
    "id": "internet-explorer-six",
    "title": "Internet Explorer 6 Basement",
    "category": "software",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "software",
      "desktop",
      "old-internet",
      "browser",
      "ie6",
      "css",
      "security"
    ],
    "links": [
      "altavista-oracle",
      "netscape-navigator",
      "winamp-skins",
      "limewire-library",
      "copter-game",
      "frameset-labyrinth",
      "browser-toolbar-stack",
      "popup-ad-alley"
    ]
  },
  "nokia-3310": {
    "id": "nokia-3310",
    "title": "Nokia 3310 Brick",
    "relic": { "id": "unbreakable-brick", "where": "brick" },
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "phone",
      "snake",
      "t9",
      "monochrome"
    ],
    "links": [
      "motorola-razr",
      "ipod-click-wheel",
      "animated-gif",
      "mp3-hoard",
      "game-boy-advance",
      "aim-away-message"
    ]
  },
  "motorola-razr": {
    "id": "motorola-razr",
    "title": "Motorola Razr Mirror",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "phone",
      "flip-phone",
      "camera",
      "style"
    ],
    "links": [
      "nokia-3310",
      "ipod-click-wheel",
      "game-boy-advance",
      "mp3-hoard",
      "myspace-profile",
      "top-eight-drama"
    ]
  },
  "ipod-click-wheel": {
    "id": "ipod-click-wheel",
    "title": "iPod Click Wheel Shrine",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "ipod",
      "music",
      "mp3",
      "click-wheel"
    ],
    "links": [
      "nokia-3310",
      "motorola-razr",
      "game-boy-advance",
      "gba-sp-backlight",
      "quicktime-trailer",
      "mp3-hoard",
      "limewire-library"
    ]
  },
  "game-boy-advance": {
    "id": "game-boy-advance",
    "title": "Game Boy Advance Backpack",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "handheld",
      "nintendo",
      "cartridge",
      "link-cable"
    ],
    "links": [
      "motorola-razr",
      "ipod-click-wheel",
      "gba-sp-backlight",
      "playstation-2-memory-card",
      "alien-hominid",
      "nokia-3310",
      "dreamcast-vmu"
    ]
  },
  "gba-sp-backlight": {
    "id": "gba-sp-backlight",
    "title": "GBA SP Backlight Chapel",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "handheld",
      "clamshell",
      "backlight",
      "nintendo"
    ],
    "links": [
      "ipod-click-wheel",
      "game-boy-advance",
      "playstation-2-memory-card",
      "dreamcast-vmu"
    ]
  },
  "playstation-2-memory-card": {
    "id": "playstation-2-memory-card",
    "title": "PS2 Memory Card Slot",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "ps2",
      "save-file",
      "memory-card",
      "console"
    ],
    "links": [
      "game-boy-advance",
      "gba-sp-backlight",
      "dreamcast-vmu",
      "crt-monitor-glow"
    ]
  },
  "dreamcast-vmu": {
    "id": "dreamcast-vmu",
    "title": "Dreamcast VMU Pocket",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "dreamcast",
      "memory-card",
      "mini-screen",
      "sega"
    ],
    "links": [
      "gba-sp-backlight",
      "playstation-2-memory-card",
      "crt-monitor-glow",
      "translucent-imac-g3",
      "game-boy-advance",
      "forum-signature"
    ]
  },
  "crt-monitor-glow": {
    "id": "crt-monitor-glow",
    "title": "CRT Monitor Glow",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "crt",
      "monitor",
      "scanlines",
      "desk"
    ],
    "links": [
      "playstation-2-memory-card",
      "dreamcast-vmu",
      "translucent-imac-g3",
      "dell-dimension-tower",
      "best-viewed-800x600",
      "windows-media-player-visualizer"
    ]
  },
  "translucent-imac-g3": {
    "id": "translucent-imac-g3",
    "title": "Translucent iMac G3 Cove",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "imac",
      "translucent",
      "apple",
      "color"
    ],
    "links": [
      "dreamcast-vmu",
      "crt-monitor-glow",
      "dell-dimension-tower",
      "floppy-disk",
      "netscape-navigator",
      "quicktime-trailer"
    ]
  },
  "dell-dimension-tower": {
    "id": "dell-dimension-tower",
    "title": "Dell Dimension Tower",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "pc",
      "family-computer",
      "windows",
      "tower"
    ],
    "links": [
      "crt-monitor-glow",
      "translucent-imac-g3",
      "floppy-disk",
      "cd-r-spindle",
      "motherload",
      "windows-media-player-visualizer"
    ]
  },
  "floppy-disk": {
    "id": "floppy-disk",
    "title": "Floppy Disk Drawer",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "storage",
      "save-file",
      "label",
      "retro"
    ],
    "links": [
      "translucent-imac-g3",
      "dell-dimension-tower",
      "cd-r-spindle",
      "zip-file",
      "four-oh-four-page"
    ]
  },
  "cd-r-spindle": {
    "id": "cd-r-spindle",
    "title": "CD-R Spindle",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "storage",
      "burned-disc",
      "mix-cd",
      "backup"
    ],
    "links": [
      "dell-dimension-tower",
      "floppy-disk",
      "zip-file",
      "swf-file",
      "napster-basement",
      "quicktime-trailer",
      "mp3-hoard"
    ]
  },
  "zip-file": {
    "id": "zip-file",
    "title": "ZIP File Chest",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "archive",
      "compression",
      "download",
      "folder"
    ],
    "links": [
      "floppy-disk",
      "cd-r-spindle",
      "swf-file",
      "animated-gif",
      "limewire-library",
      "download-button-decoy"
    ]
  },
  "swf-file": {
    "id": "swf-file",
    "title": "SWF File Vault",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "flash",
      "file-format",
      "animation",
      "game"
    ],
    "links": [
      "cd-r-spindle",
      "zip-file",
      "animated-gif",
      "mp3-hoard",
      "peanut-butter-jelly-time",
      "all-your-base",
      "newgrounds-portal",
      "pico-school",
      "motherload",
      "splash-page",
      "ruffle-emulator",
      "flashpoint-archive"
    ]
  },
  "animated-gif": {
    "id": "animated-gif",
    "title": "Animated GIF Aquarium",
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "gif",
      "loop",
      "transparent",
      "sprite"
    ],
    "links": [
      "zip-file",
      "swf-file",
      "mp3-hoard",
      "nokia-3310",
      "hamster-dance",
      "peanut-butter-jelly-time",
      "dancing-baby",
      "leekspin",
      "madness-combat",
      "under-construction",
      "email-me-gif"
    ]
  },
  "mp3-hoard": {
    "id": "mp3-hoard",
    "title": "MP3 Hoard",
    "relic": { "id": "first-ripped-mp3", "where": "rip" },
    "category": "device-file",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "hardware",
      "files",
      "nostalgia",
      "music",
      "mp3",
      "metadata",
      "downloads"
    ],
    "links": [
      "swf-file",
      "animated-gif",
      "nokia-3310",
      "motorola-razr",
      "punk-o-matic",
      "midi-zone",
      "winamp-skins",
      "limewire-library",
      "napster-basement",
      "ipod-click-wheel",
      "cd-r-spindle"
    ]
  },
  "forum-signature": {
    "id": "forum-signature",
    "title": "Forum Signature Forge",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "forums",
      "signature",
      "banner",
      "avatar"
    ],
    "links": [
      "phpbb-thread",
      "livejournal-entry",
      "slashdot-frontpage",
      "fark-headline",
      "all-your-base",
      "star-wars-kid",
      "oolong-pancake-bunny",
      "pico-school",
      "neopets-faerieland",
      "award-badge-wall",
      "icq-uh-oh",
      "dreamcast-vmu",
      "image-host-broken"
    ]
  },
  "phpbb-thread": {
    "id": "phpbb-thread",
    "title": "phpBB Thread Hall",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "forum",
      "thread",
      "moderation",
      "quotes"
    ],
    "links": [
      "forum-signature",
      "livejournal-entry",
      "xanga-diary",
      "fark-headline",
      "numa-forum-mirror",
      "madness-combat",
      "guestbook",
      "slashdot-frontpage"
    ]
  },
  "livejournal-entry": {
    "id": "livejournal-entry",
    "title": "LiveJournal Entry",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "blog",
      "diary",
      "mood",
      "comments"
    ],
    "links": [
      "forum-signature",
      "phpbb-thread",
      "xanga-diary",
      "myspace-profile",
      "aim-away-message"
    ]
  },
  "xanga-diary": {
    "id": "xanga-diary",
    "title": "Xanga Diary",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "blog",
      "layout",
      "survey",
      "teen-web"
    ],
    "links": [
      "phpbb-thread",
      "livejournal-entry",
      "myspace-profile",
      "top-eight-drama",
      "stick-rpg",
      "tiled-background"
    ]
  },
  "myspace-profile": {
    "id": "myspace-profile",
    "title": "Myspace Profile Stage",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "profile",
      "css",
      "autoplay",
      "music"
    ],
    "links": [
      "livejournal-entry",
      "xanga-diary",
      "top-eight-drama",
      "photobucket-bucket",
      "numa-numa",
      "rickroll-redirect",
      "club-penguin-plaza",
      "tiled-background",
      "msn-wink-vault",
      "motorola-razr"
    ]
  },
  "top-eight-drama": {
    "id": "top-eight-drama",
    "title": "Top 8 Drama Court",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "myspace",
      "ranking",
      "friendship",
      "profile"
    ],
    "links": [
      "xanga-diary",
      "myspace-profile",
      "photobucket-bucket",
      "image-host-broken",
      "motorola-razr"
    ]
  },
  "photobucket-bucket": {
    "id": "photobucket-bucket",
    "title": "Photobucket Bucket",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "image-hosting",
      "avatars",
      "hotlink",
      "album"
    ],
    "links": [
      "myspace-profile",
      "top-eight-drama",
      "image-host-broken",
      "slashdot-frontpage",
      "numa-forum-mirror",
      "oolong-pancake-bunny",
      "line-rider"
    ]
  },
  "image-host-broken": {
    "id": "image-host-broken",
    "title": "Broken Image Host Graveyard",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "broken-image",
      "hotlink",
      "forum",
      "archive-decay"
    ],
    "links": [
      "top-eight-drama",
      "photobucket-bucket",
      "slashdot-frontpage",
      "fark-headline",
      "star-wars-kid",
      "forum-signature",
      "four-oh-four-page"
    ]
  },
  "slashdot-frontpage": {
    "id": "slashdot-frontpage",
    "title": "Slashdot Frontpage",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "news",
      "comments",
      "slashdot-effect",
      "nerd-culture"
    ],
    "links": [
      "photobucket-bucket",
      "image-host-broken",
      "fark-headline",
      "forum-signature",
      "webring-hub",
      "phpbb-thread"
    ]
  },
  "fark-headline": {
    "id": "fark-headline",
    "title": "Fark Headline Desk",
    "category": "community",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "community",
      "social-web",
      "old-internet",
      "news",
      "snark",
      "headline",
      "weird"
    ],
    "links": [
      "image-host-broken",
      "slashdot-frontpage",
      "forum-signature",
      "phpbb-thread",
      "dramatic-chipmunk",
      "end-of-ze-world",
      "keyboard-cat",
      "popup-ad-alley"
    ]
  },
  "popup-ad-alley": {
    "id": "popup-ad-alley",
    "title": "Popup Ad Alley",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "popup",
      "ads",
      "window",
      "annoyance"
    ],
    "links": [
      "spyware-scan",
      "download-button-decoy",
      "flashpoint-archive",
      "ruffle-emulator",
      "hit-counter",
      "realplayer-popup",
      "internet-explorer-six",
      "fark-headline"
    ]
  },
  "spyware-scan": {
    "id": "spyware-scan",
    "title": "Spyware Scan Van",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "spyware",
      "fake-scan",
      "security",
      "adware"
    ],
    "links": [
      "popup-ad-alley",
      "download-button-decoy",
      "four-oh-four-page",
      "ruffle-emulator",
      "limewire-library",
      "kazaa-kiosk",
      "bonzibuddy-office",
      "browser-toolbar-stack"
    ]
  },
  "download-button-decoy": {
    "id": "download-button-decoy",
    "title": "Download Button Decoy",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "download",
      "misdirection",
      "ads",
      "risk"
    ],
    "links": [
      "popup-ad-alley",
      "spyware-scan",
      "four-oh-four-page",
      "captcha-goblin",
      "rickroll-redirect",
      "impossible-quiz",
      "zip-file"
    ]
  },
  "four-oh-four-page": {
    "id": "four-oh-four-page",
    "title": "404 Page Basement",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "404",
      "missing-page",
      "broken-link",
      "error"
    ],
    "links": [
      "spyware-scan",
      "download-button-decoy",
      "captcha-goblin",
      "chain-email",
      "under-construction",
      "floppy-disk",
      "image-host-broken",
      "webring-hub"
    ]
  },
  "captcha-goblin": {
    "id": "captcha-goblin",
    "title": "CAPTCHA Goblin Bridge",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "captcha",
      "verification",
      "letters",
      "friction"
    ],
    "links": [
      "download-button-decoy",
      "four-oh-four-page",
      "chain-email",
      "dancing-cursor-trail",
      "impossible-quiz",
      "guestbook"
    ]
  },
  "chain-email": {
    "id": "chain-email",
    "title": "Chain Email Crypt",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "email",
      "forward",
      "urban-legend",
      "chain-letter"
    ],
    "links": [
      "four-oh-four-page",
      "captcha-goblin",
      "dancing-cursor-trail",
      "browser-toolbar-stack",
      "dancing-baby",
      "guestbook",
      "email-me-gif"
    ]
  },
  "dancing-cursor-trail": {
    "id": "dancing-cursor-trail",
    "title": "Dancing Cursor Trail",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "cursor",
      "javascript",
      "stars",
      "effects"
    ],
    "links": [
      "captcha-goblin",
      "chain-email",
      "browser-toolbar-stack",
      "flashpoint-archive",
      "marquee-museum",
      "tiled-background"
    ]
  },
  "browser-toolbar-stack": {
    "id": "browser-toolbar-stack",
    "title": "Browser Toolbar Stack",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "toolbar",
      "browser",
      "adware",
      "clutter"
    ],
    "links": [
      "chain-email",
      "dancing-cursor-trail",
      "flashpoint-archive",
      "ruffle-emulator",
      "kazaa-kiosk",
      "bonzibuddy-office",
      "internet-explorer-six",
      "spyware-scan"
    ]
  },
  "flashpoint-archive": {
    "id": "flashpoint-archive",
    "title": "Flashpoint Archive Vault",
    "relic": { "id": "preserved-swf", "where": "file" },
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "preservation",
      "flashpoint",
      "archive",
      "browser-history"
    ],
    "links": [
      "dancing-cursor-trail",
      "browser-toolbar-stack",
      "ruffle-emulator",
      "popup-ad-alley",
      "badger-badger-badger",
      "end-of-ze-world",
      "newgrounds-portal",
      "fancy-pants-adventure",
      "swf-file"
    ]
  },
  "ruffle-emulator": {
    "id": "ruffle-emulator",
    "title": "Ruffle Emulator Workshop",
    "category": "hazard",
    "era": "late-1990s-to-mid-2000s",
    "tags": [
      "web-hazard",
      "browser-chaos",
      "old-internet",
      "ruffle",
      "emulation",
      "flash",
      "wasm"
    ],
    "links": [
      "browser-toolbar-stack",
      "flashpoint-archive",
      "popup-ad-alley",
      "spyware-scan",
      "newgrounds-portal",
      "swf-file"
    ]
  }
};

// Merge the readable article prose onto each node, then deep-freeze. Topology
// (links/category/relic) comes from RAW_RELIC_NODES above; the wiki-style article
// ({ lead, history, legacy, seeAlso }) comes from relicArticles.js. The two are
// kept in lockstep by validateRelicNodes() (every link in an article == node.links).
export const RELIC_NODES = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_RELIC_NODES).map(([id, node]) => [
      id,
      Object.freeze({ ...node, article: RELIC_ARTICLES[id] }),
    ])
  )
);

export const RELIC_NODE_IDS = Object.freeze(Object.keys(RELIC_NODES));

export function validateRelicNodes(nodes = RELIC_NODES) {
  const ids = Object.keys(nodes);
  const idSet = new Set(ids);
  const errors = [];

  if (ids.length !== 100) {
    errors.push(`Expected 100 nodes, found ${ids.length}.`);
  }

  for (const id of ids) {
    const node = nodes[id];

    if (node.id !== id) {
      errors.push(`${id} has mismatched internal id: ${node.id}.`);
    }

    if (!Array.isArray(node.links) || node.links.length < 4) {
      errors.push(`${id} should have at least 4 links.`);
    }

    for (const link of node.links || []) {
      if (!idSet.has(link)) {
        errors.push(`${id} links to missing node: ${link}.`);
      }

      if (link === id) {
        errors.push(`${id} links to itself.`);
      }
    }

    // ── Article integrity (the wiki prose must faithfully express the graph) ──
    // Every node must have an authored article with at least a lead.
    const article = node.article;
    if (!article || !article.lead) {
      errors.push(`${id} is missing an article (lead required).`);
    } else {
      const { linkIds, relicCount, relicArmsLink, selfLinks, malformed } =
        inspectArticle(article, id);

      // (5) Well-formed tokens.
      if (malformed) errors.push(`${id} article has a malformed/unclosed [[ token.`);
      // (4) No self-link in prose.
      for (const sl of selfLinks) errors.push(`${id} article links to itself: ${sl}.`);

      const links = new Set(node.links || []);
      // (1) Coverage: every graph edge is reachable from the article UI.
      for (const link of links) {
        if (!linkIds.has(link)) {
          errors.push(`${id} article never links to neighbor: ${link}.`);
        }
      }
      // (2) No phantom links: the article can't navigate where the graph doesn't.
      // (3) Resolvable: a linked id must be a real node.
      for (const link of linkIds) {
        if (!links.has(link)) {
          errors.push(`${id} article links to non-neighbor: ${link}.`);
        }
        if (!idSet.has(link)) {
          errors.push(`${id} article links to missing node: ${link}.`);
        }
      }
      // (6) Relic-token integrity: a {{relic}} appears iff the node has a relic,
      //     exactly once, and must arm a link.
      const wantEgg = !!node.relic;
      if (wantEgg && relicCount !== 1) {
        errors.push(`${id} has a relic but ${relicCount} {{relic}} token(s) (want 1).`);
      }
      if (!wantEgg && relicCount !== 0) {
        errors.push(`${id} has no relic but ${relicCount} {{relic}} token(s).`);
      }
      if (relicCount > 0 && !relicArmsLink) {
        errors.push(`${id} has a {{relic}} token that arms no link.`);
      }
    }
  }

  // Connectivity check from the first node.
  const start = ids[0];
  const visited = new Set();
  const queue = start ? [start] : [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;

    visited.add(current);

    for (const next of nodes[current].links || []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  if (visited.size !== ids.length) {
    errors.push(`Graph is not fully connected. Reached ${visited.size} of ${ids.length} nodes.`);
  }

  return {
    ok: errors.length === 0,
    nodeCount: ids.length,
    reachedCount: visited.size,
    errors
  };
}
