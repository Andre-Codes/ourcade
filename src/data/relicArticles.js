/* ─────────────────────────────────────────────────────────────────────────
   DAILY RELIC RUN — fake-wiki articles, one per node.

   These are the readable, encyclopedia-style pages a player surfs. Topology
   (which pages connect) lives in relicNodes.js as `links`; the prose here is a
   pure rendering layer that *expresses* those links as inline blue wiki-links.

   GRAMMAR (parsed by src/games/relic-run/article.js):
     [[node-id]]               link to node-id; display = that node's title
     [[node-id|display text]]  link to node-id; display = "display text"
     {{relic}}                 arms the NEXT link as the easter-egg anchor
     [[#|display text]]        relic-only sentinel: clickable, pockets the relic,
                               navigates nowhere

   AUTHORING RULES (enforced by validateRelicNodes / npm run check:relic):
     • COVERAGE: every id in a node's `links` must appear here — either as a
       [[id]] token somewhere in lead/history/legacy, or in `seeAlso`. No edge
       may be unreachable from the page.
     • NO PHANTOM LINKS: never [[link]] to an id that isn't in the node's `links`.
     • Never [[self]]-link; name the article's own subject in plain text.
     • A node with a `relic` has exactly one {{relic}} token (and vice-versa),
       arming a link — usually the [[#|word]] sentinel so the egg blocks no route.

   Shape: id → { lead, history?, legacy?, seeAlso? }. Only `lead` is required.
   Voice: warm, factual, a little wry — true to the real artifact, never padded.
   ───────────────────────────────────────────────────────────────────────── */

export const RELIC_ARTICLES = {
  // ═══════════════════════════════ MEMES ═══════════════════════════════════
  "hamster-dance": {
    lead:
      "The Hamster Dance was one of the earliest websites to go truly viral — a " +
      "single page tiled with rows of crudely [[animated-gif|animated GIFs]] of " +
      "hamsters bobbing to a sped-up nine-second loop of \"Whistle Stop\" from " +
      "Disney's Robin Hood. Built by Canadian art student Deidre LaCarte in 1998, " +
      "it became shorthand for the idea that a webpage could be a shared, joyful " +
      "fever dream.",
    history:
      "LaCarte reportedly made the page as a friendly contest to see who could draw " +
      "the most traffic. It exploded by word of mouth in 1999, passed around the " +
      "same way a [[webring-hub|webring]] passed visitors site to site, and quickly " +
      "spawned the loop-and-squeak template later copied by everything from " +
      "[[peanut-butter-jelly-time|the dancing banana]] to the disciplined rows of " +
      "[[badger-badger-badger|badgers]].",
    legacy:
      "Its DNA runs through the whole looping-animal canon — the deadpan stare of " +
      "[[keyboard-cat|Keyboard Cat]], the sad dignity of " +
      "[[oolong-pancake-bunny|Oolong the pancake rabbit]] — and the tinny, " +
      "ever-present soundtrack ties it to the [[midi-zone|MIDI]] era that scored " +
      "the early web.",
  },

  "peanut-butter-jelly-time": {
    lead:
      "\"Peanut Butter Jelly Time\" is a [[swf-file|Flash]] cartoon of a costumed " +
      "banana dancing to a chirpy Buckwheat Boyz novelty song. Spreading from 2002 " +
      "onward, it fused a catchy hook with an absurd looping visual into one of the " +
      "definitive early-web earworms.",
    history:
      "Like most Flash of its day it lived on portals such as " +
      "[[newgrounds-portal|Newgrounds]], shoulder to shoulder with the bobbing " +
      "[[hamster-dance|hamsters]] and the bouncing [[badger-badger-badger|badgers]]. " +
      "It was a forward-em-to-everyone kind of clip, in the same family as " +
      "[[numa-numa|the Numa Numa lip-sync]].",
    legacy:
      "It hardened the loop-forever formula the [[oolong-pancake-bunny|pancake bunny]] " +
      "and countless GIFs would ride, and as a piece of vector animation it endures " +
      "as a humble [[animated-gif|animated GIF]] long after its original player " +
      "stopped loading.",
  },

  "badger-badger-badger": {
    lead:
      "\"Badger Badger Badger\" is a 2003 Flash loop by British animator Jonti Picking " +
      "(Weebl) in which a row of identical badgers calisthenically pop up and down " +
      "while a chant of \"badger badger badger\" is interrupted by a mushroom and, " +
      "alarmingly, a snake.",
    history:
      "It rode the same viral rails as the [[hamster-dance|Hamster Dance]] and " +
      "[[peanut-butter-jelly-time|Peanut Butter Jelly Time]], shared endlessly and " +
      "mirrored across portals like [[newgrounds-portal|Newgrounds]]. Weebl would go " +
      "on to a whole catalogue of nonsense loops, among them " +
      "[[magical-trevor|Magical Trevor]].",
    legacy:
      "Its rhythmic, hypnotic repetition made it a template for the chant-meme, in " +
      "the same breath as the lip-sync of [[numa-numa|Numa Numa]] and the office " +
      "shuffle of [[dancing-baby|the Dancing Baby]]. As an obsolete Flash file it now " +
      "survives chiefly through preservation efforts like the " +
      "[[flashpoint-archive|Flashpoint archive]].",
  },

  "numa-numa": {
    lead:
      "The \"Numa Numa\" video is a 2004 webcam clip of New Jersey teenager Gary " +
      "Brolsma exuberantly lip-syncing and arm-dancing to the Romanian pop song " +
      "\"Dragostea Din Tei\" by O-Zone. Recorded at his desk, it became one of the " +
      "first webcam performances to reach a global audience.",
    history:
      "Brolsma posted it to the portal Newgrounds — the same " +
      "[[newgrounds-portal|Newgrounds]] that hosted [[badger-badger-badger|Badger]] " +
      "and [[peanut-butter-jelly-time|the dancing banana]] — and it spread from " +
      "there into the meme bloodstream alongside clips like " +
      "[[dancing-baby|the Dancing Baby]].",
    legacy:
      "It helped prove that an ordinary person at a [[myspace-profile|profile-page]] " +
      "level of fame could become an internet sensation overnight, in the same " +
      "lineage as the absurd [[all-your-base|All Your Base]] craze. Re-encoded for " +
      "every player from RealVideo to [[quicktime-trailer|QuickTime]], the clip is a " +
      "founding document of webcam culture.",
  },

  "dancing-baby": {
    lead:
      "The Dancing Baby — also called \"Baby Cha-Cha\" — is a 3D-rendered infant that " +
      "shuffles in a cha-cha step. Created in 1996 as a sample animation for " +
      "character-studio software, it leaked out as a passed-around video file and " +
      "became arguably the first true internet meme.",
    history:
      "It spread primarily as a forwarded email attachment, much like the " +
      "[[chain-email|chain letters]] of the same era, and was traded as a looping " +
      "[[animated-gif|GIF]] and an \"[[email-me-gif|email me]]\"-style novelty before " +
      "broadband. A 1998 cameo on the TV show Ally McBeal cemented its fame.",
    legacy:
      "As a proof-of-concept that a clip could escape its origin and take on a life " +
      "of its own, it set the stage for everything from " +
      "[[numa-numa|the Numa Numa guy]] to [[all-your-base|All Your Base]], the " +
      "bouncing [[badger-badger-badger|badgers]], and tape-traded oddities like " +
      "[[star-wars-kid|the Star Wars Kid]].",
  },

  "all-your-base": {
    lead:
      "\"All your base are belong to us\" is a garbled English line from the 1992 Sega " +
      "Mega Drive port of the game Zero Wing. Its broken machine-translation grammar " +
      "made it irresistible, and around 2000–2001 it became one of the web's first " +
      "explosively shared in-jokes.",
    history:
      "The phrase took off as a [[swf-file|Flash]] music video and a flood of " +
      "Photoshopped images pasting the slogan onto signs and storefronts, much of it " +
      "rallying through the portal [[newgrounds-portal|Newgrounds]]. Like " +
      "[[dancing-baby|the Dancing Baby]] and the lip-sync of " +
      "[[numa-numa|Numa Numa]], it was forwarded relentlessly.",
    legacy:
      "It became a load-bearing piece of [[forum-signature|forum signature]] culture " +
      "and helped define the copy-paste catchphrase, paving the road for later " +
      "absurdist hits like [[star-wars-kid|the Star Wars Kid]] and " +
      "[[dramatic-chipmunk|the Dramatic Chipmunk]].",
  },

  "star-wars-kid": {
    lead:
      "The \"Star Wars Kid\" is a 2002 home video of Canadian teenager Ghyslain Raza " +
      "swinging a golf-ball retriever like a lightsaber. Uploaded by classmates " +
      "without his consent, it became one of the most-viewed early viral clips — and " +
      "an early, sobering lesson in online humiliation.",
    history:
      "It began on a literal tape before being digitized and traded as a video file, " +
      "in the same circulation that carried [[dancing-baby|the Dancing Baby]] and " +
      "[[all-your-base|All Your Base]]. Fans re-cut it with effects and passed the " +
      "versions through [[quicktime-trailer|QuickTime]] downloads, " +
      "[[forum-signature|forum signatures]], and the comment threads later mirrored " +
      "at [[numa-forum-mirror|fan forums]].",
    legacy:
      "Raza was harassed for years, and his case is still cited in conversations " +
      "about consent and digital permanence. Many of its remixed copies eventually " +
      "rotted into the dead links of the " +
      "[[image-host-broken|broken image graveyard]], while the " +
      "[[dramatic-chipmunk|Dramatic Chipmunk]] cliffhanger inherited its remix " +
      "energy.",
  },

  "dramatic-chipmunk": {
    lead:
      "The \"Dramatic Chipmunk\" is a five-second 2007 clip — actually a prairie dog — " +
      "that snaps its head toward the camera as an ominous sting plays. Brevity was " +
      "the whole joke: a perfect, reusable beat of manufactured suspense.",
    history:
      "Lifted from a Japanese television show, it spread as an endlessly " +
      "re-purposable reaction clip alongside oddities like " +
      "[[all-your-base|All Your Base]] and [[star-wars-kid|the Star Wars Kid]], and " +
      "was a staple punchline on aggregators like " +
      "[[fark-headline|Fark]]. It often shared a page with another animal loop, " +
      "[[leekspin|the leek-spinning anime girl]].",
    legacy:
      "It helped codify the \"reaction clip\" as a unit of online conversation, the " +
      "kind of sting later dropped into [[quicktime-trailer|trailer]] parodies and " +
      "re-hosted at fan mirrors like [[numa-forum-mirror|the Numa forum]].",
  },

  "numa-forum-mirror": {
    lead:
      "The Numa Forum Mirror is a relic of how memes actually traveled before " +
      "centralized video: a fan-run message board that re-hosted clips and the " +
      "threads discussing them, so a viral video could outlive any single broken " +
      "link.",
    history:
      "Mirrors like this were ordinary [[phpbb-thread|phpBB]] boards where users " +
      "embedded reaction clips — [[dramatic-chipmunk|the Dramatic Chipmunk]], " +
      "[[star-wars-kid|the Star Wars Kid]], [[leekspin|Loituma Girl]], " +
      "[[llama-song|the Llama Song]] — and argued over who found them first. " +
      "Image-heavy posts leaned on hosts like [[photobucket-bucket|Photobucket]].",
    legacy:
      "These scrappy mirrors were the unglamorous backbone of meme preservation, the " +
      "human equivalent of a backup drive, keeping clips alive while the original " +
      "uploads quietly went dark.",
  },

  "leekspin": {
    lead:
      "\"Leekspin\" (also \"Loituma Girl\") is a 2006 loop pairing a hand-drawn anime " +
      "character, Orihime Inoue, twirling a leek with a clip of the Finnish folk song " +
      "\"Ievan Polkka.\" It is the platonic ideal of the endless-loop meme: a few " +
      "seconds that you could, and did, watch for far too long.",
    history:
      "It was traded as a looping [[animated-gif|GIF]] and mirrored, like every clip " +
      "of its kind, at fan boards such as [[numa-forum-mirror|the Numa forum]]. Its " +
      "catchy a-cappella scat made it a cousin of the [[midi-zone|MIDI-soundtracked]] " +
      "web, and it surfaced constantly beside [[dramatic-chipmunk|the Dramatic " +
      "Chipmunk]].",
    legacy:
      "It reinforced the idea that the loop itself — not a beginning or end — was the " +
      "content, a lineage that runs onward to nonsense like " +
      "[[llama-song|the Llama Song]] and [[magical-trevor|Magical Trevor]].",
  },

  "llama-song": {
    lead:
      "\"The Llama Song\" is a 2004 [[newgrounds-portal|Flash]] piece by Burton Earny: " +
      "a rapid, rhyming, deliberately nonsensical chant set to a bouncing red llama " +
      "and a relentless tune you cannot evict from your head.",
    history:
      "It thrived in the same loop-and-chant ecosystem as " +
      "[[leekspin|Loituma Girl]] and the [[numa-forum-mirror|forum-mirrored]] clips, " +
      "and shared a sensibility with the woodland chant of " +
      "[[magical-trevor|Magical Trevor]].",
    legacy:
      "Its sing-along nonsense is a direct ancestor of the doom-comedy singalong " +
      "[[end-of-ze-world|\"End of Ze World\"]], part of a brief golden age when a " +
      "catchy song plus a looping cartoon was a complete cultural event.",
  },

  "magical-trevor": {
    lead:
      "\"Magical Trevor\" is a 2004 [[badger-badger-badger|Weebl]] cartoon about a " +
      "magician whose trick — making a cow vanish and reappear — is narrated by an " +
      "infuriatingly hummable looping song. It is nonsense engineered, with some " +
      "precision, to lodge in memory.",
    history:
      "It came from the same studio as Badger Badger Badger and lived among kindred " +
      "chant-loops like [[leekspin|Leekspin]] and [[llama-song|the Llama Song]]. " +
      "Spread by sheer earworm force, it was forwarded the way every clip of the era " +
      "was.",
    legacy:
      "Trevor spawned a series of sequels, an early example of meme-as-franchise, and " +
      "sits comfortably beside doom-comedy like " +
      "[[end-of-ze-world|\"End of Ze World\"]] and the great prank tradition of the " +
      "[[rickroll-redirect|Rickroll]].",
  },

  "end-of-ze-world": {
    lead:
      "\"End of Ze World\" (2003) is a frantic Flash animation by Jason Windsor " +
      "imagining nuclear apocalypse as absurdist comedy, narrated in a cartoonish " +
      "accent and stuffed with quotable throwaway lines.",
    history:
      "It was a fixture of the chant-and-nonsense canon, traded alongside " +
      "[[llama-song|the Llama Song]] and [[magical-trevor|Magical Trevor]], and " +
      "endlessly linked from aggregators like [[fark-headline|Fark]].",
    legacy:
      "Its quotability made it [[keyboard-cat|inside-joke]] fuel for years — the same " +
      "prank-comedy spirit that powered [[rickroll-redirect|the Rickroll]] — and as a " +
      "Flash artifact it now depends on preservation work like " +
      "[[flashpoint-archive|the Flashpoint archive]] to stay watchable.",
  },

  "rickroll-redirect": {
    lead:
      "The \"Rickroll\" is a bait-and-switch prank in which a tempting link instead " +
      "delivers the music video for Rick Astley's 1987 hit \"Never Gonna Give You " +
      "Up.\" Emerging around 2007, it turned a disappointed click into a global " +
      "running gag.",
    history:
      "It descended from an earlier 4chan bait called \"duckrolling\" and joined the " +
      "grand prank lineage that includes stunts like " +
      "[[magical-trevor|Magical Trevor's]] misdirection and the doom-comedy of " +
      "[[end-of-ze-world|End of Ze World]]. The disappointed-but-charmed feeling it " +
      "produced is a sibling to [[keyboard-cat|a Keyboard Cat play-off]] or a " +
      "[[oolong-pancake-bunny|deadpan bunny]].",
    legacy:
      "It is the canonical example of a malicious-seeming [[download-button-decoy|decoy link]] " +
      "that turns out to be harmless fun, and it became so beloved that being " +
      "rickrolled from a friend's [[myspace-profile|profile]] was practically a badge " +
      "of belonging.",
  },

  "keyboard-cat": {
    lead:
      "\"Keyboard Cat\" is footage of a cat named Fatso, filmed in 1984 by Charlie " +
      "Schmidt, its paws worked like a marionette to \"play\" a jaunty keyboard tune. " +
      "Rediscovered online around 2007, it became the internet's way of " +
      "\"playing off\" anything that ended in failure.",
    history:
      "Editors appended the clip to blooper videos as a punchline, in the same spirit " +
      "as the prank of [[end-of-ze-world|apocalypse comedy]] and " +
      "[[rickroll-redirect|the Rickroll]]. It shared the looping-animal stage with " +
      "elders like the [[hamster-dance|Hamster Dance]] and the deadpan " +
      "[[oolong-pancake-bunny|pancake bunny]].",
    legacy:
      "\"Play him off, Keyboard Cat\" became a catchphrase, the clip re-encoded for " +
      "every player including [[quicktime-trailer|QuickTime]] and re-posted to " +
      "aggregators like [[fark-headline|Fark]] — proof that an ordinary home video " +
      "could become a universal punctuation mark.",
  },

  "oolong-pancake-bunny": {
    lead:
      "Oolong was a real Dutch dwarf rabbit, photographed by owner Hironori Akutagawa " +
      "between 1999 and 2003 balancing small objects — most famously a pancake — on " +
      "its remarkably flat head. The \"head performance\" photos became an early, " +
      "gentle staple of web absurdism.",
    history:
      "Oolong's deadpan images circulated as forwarded pictures and were embedded " +
      "from hosts like [[photobucket-bucket|Photobucket]], slotting neatly beside the " +
      "looping animals of the [[hamster-dance|Hamster Dance]] and " +
      "[[keyboard-cat|Keyboard Cat]]. The \"I have no idea what I'm doing\" energy " +
      "made it [[forum-signature|signature]] material.",
    legacy:
      "As one of the first beloved animal memes, Oolong is an ancestor of the entire " +
      "cute-pet internet, sharing the same family tree as the dancing banana of " +
      "[[peanut-butter-jelly-time|PB&J Time]] and the misdirection of " +
      "[[rickroll-redirect|the Rickroll]].",
  },

  // ═══════════════════════════════ FLASH GAMES ═════════════════════════════
  "newgrounds-portal": {
    lead:
      "Newgrounds is a portal founded by Tom Fulp in 1995 that became the beating " +
      "heart of [[swf-file|Flash]] animation and games. Its user-voted \"Portal\" let " +
      "anyone submit a movie or game, and its irreverent, anything-goes culture " +
      "incubated a generation of web creators.",
    history:
      "It was the launchpad for countless hits — the run-and-gun chaos of " +
      "[[alien-hominid|Alien Hominid]], the schoolyard mayhem of " +
      "[[pico-school|Pico's School]] — and the place memes like " +
      "[[numa-numa|Numa Numa]], [[peanut-butter-jelly-time|Peanut Butter Jelly Time]], " +
      "[[badger-badger-badger|Badger Badger Badger]], [[all-your-base|All Your Base]] " +
      "and [[llama-song|the Llama Song]] were first dropped into the wild.",
    legacy:
      "Newgrounds outlasted the format that built it. When browsers killed the Flash " +
      "plugin, it embraced the [[ruffle-emulator|Ruffle]] emulator to keep its " +
      "back-catalogue of [[swf-file|SWF]] files playable, a mission it shares with the " +
      "[[flashpoint-archive|Flashpoint archive]].",
    seeAlso: ["club-penguin-plaza", "neopets-faerieland"],
  },

  "alien-hominid": {
    lead:
      "Alien Hominid is a 2002 [[newgrounds-portal|Newgrounds]] Flash game by Tom Fulp " +
      "and Dan Paladin in which a small yellow alien fends off " +
      "government agents with a blaster. Its brutal difficulty and slick hand-drawn " +
      "art made it stand out from the portal's crowd.",
    history:
      "The Flash original was popular enough to be developed by The Behemoth into a " +
      "full console release in 2004, a rare leap from free browser toy to retail " +
      "title — and onto handhelds like the [[game-boy-advance|Game Boy Advance]].",
    legacy:
      "It proved a web game could punch through the browser ceiling, a lineage it " +
      "shares with portal-mates like the stick-figure carnage of " +
      "[[madness-combat|Madness Combat]] and [[pico-school|Pico's School]]. It also " +
      "kept company with the kid-friendly worlds of " +
      "[[neopets-faerieland|Neopets]].",
  },

  "pico-school": {
    lead:
      "Pico's School (1999) is one of [[newgrounds-portal|Newgrounds]] founder Tom " +
      "Fulp's signature [[swf-file|Flash]] games: a point-and-click in which the boy " +
      "Pico fights through a school besieged by a violent cult. Crude and gleefully " +
      "transgressive, it became a Newgrounds mascot piece.",
    history:
      "Pico grew into a recurring character and an unofficial site mascot, alongside " +
      "the studio's other breakout, [[alien-hominid|Alien Hominid]]. The game's " +
      "cult-classic status was endlessly discussed in " +
      "[[forum-signature|forum signatures]] and fan threads.",
    legacy:
      "It helped define the chaotic, no-rules Newgrounds house style later inherited " +
      "by ultra-violent animations like [[madness-combat|Madness Combat]] and the " +
      "platforming polish of [[fancy-pants-adventure|Fancy Pants Adventure]].",
  },

  "madness-combat": {
    lead:
      "Madness Combat is a hyper-violent Flash animation series begun in 2002 by " +
      "Krinkels on Newgrounds, following a relentless stick-figure protagonist through " +
      "stylized, balletic gun-and-melee carnage.",
    history:
      "It became one of Newgrounds' longest-running franchises, sitting in the same " +
      "stick-figure-action neighborhood as [[pico-school|Pico's School]], the early " +
      "console crossover of [[alien-hominid|Alien Hominid]], and the fluid platforming " +
      "of [[fancy-pants-adventure|Fancy Pants Adventure]].",
    legacy:
      "Its sleek choreography influenced a wave of stick animation — a sibling to the " +
      "physics-sketch of [[line-rider|Line Rider]] — and its many episodes endure as " +
      "looping [[animated-gif|GIF]] sets and clips re-shared on boards like " +
      "[[phpbb-thread|phpBB]].",
  },

  "fancy-pants-adventure": {
    lead:
      "The Fancy Pants Adventures, begun in 2006 by Brad Borne, are Flash platformers " +
      "starring a stick figure in fancy pants. Their claim to fame was momentum: " +
      "fluid, skateboard-like running and wall-sliding that felt better than almost " +
      "anything else in a browser.",
    history:
      "They launched on portals amid stick-figure peers such as " +
      "[[pico-school|Pico's School]] and [[madness-combat|Madness Combat]], but won " +
      "fans with craftsmanship rather than shock.",
    legacy:
      "The series' silky movement set a high bar for browser platforming, the polished " +
      "cousin of doodle-physics toys like [[line-rider|Line Rider]] and open-ended " +
      "Flash worlds like [[stick-rpg|Stick RPG]]. As Flash sunset, its files joined the " +
      "ranks needing [[flashpoint-archive|archival]] to stay playable.",
  },

  "line-rider": {
    lead:
      "Line Rider, created in 2006 by Bostjan Cadez, is less a game than a toy: you " +
      "draw a track with a pencil and a tiny sledder named Bosh rides your lines under " +
      "gravity. There is no score and no goal — only the physics and your imagination.",
    history:
      "It began as a Flash sketch and spread through the same browser-toy circuit as " +
      "[[madness-combat|Madness Combat]] and " +
      "[[fancy-pants-adventure|Fancy Pants Adventure]]. Elaborate hand-built tracks " +
      "were captured and shared, often with screenshots hosted on " +
      "[[photobucket-bucket|Photobucket]].",
    legacy:
      "Its sandbox spirit linked it to other emergent-play hits like " +
      "[[stick-rpg|Stick RPG]], the wave-survival of " +
      "[[defend-your-castle|Defend Your Castle]], and the strategy doodle of " +
      "[[desktop-tower-defense|Desktop Tower Defense]]; player-made Line Rider courses " +
      "became an early form of user-generated video art.",
  },

  "stick-rpg": {
    lead:
      "Stick RPG (2003) by XGen Studios is a Flash life-sim in a two-dimensional " +
      "\"Paper City\" where a stick figure works jobs, studies, " +
      "gambles, and brawls to raise stats and get rich. It packed a surprising amount " +
      "of open-ended progression into a browser tab.",
    history:
      "It sat among the open-play Flash games of its era beside " +
      "[[fancy-pants-adventure|Fancy Pants]] and the sandbox of " +
      "[[line-rider|Line Rider]], and its grindy stat-building gave players the same " +
      "compulsive hooks as a kid-MMO like [[neopets-faerieland|Neopets]].",
    legacy:
      "Its mix of mini-games and stat progression anticipated the casual-RPG loop, " +
      "and it was a fixture of the same after-school browser sessions as " +
      "[[defend-your-castle|Defend Your Castle]], [[bloons|Bloons]], and the diary " +
      "posts of [[xanga-diary|Xanga]].",
  },

  "defend-your-castle": {
    lead:
      "Defend Your Castle (2003), another XGen Studios Flash hit, is a mouse-driven " +
      "siege game: you fling attacking stick figures into the air to " +
      "protect your castle, spending the spoils on walls, archers, and upgrades.",
    history:
      "It was a cornerstone of the casual-defense genre alongside browser staples like " +
      "[[line-rider|Line Rider]] and [[stick-rpg|Stick RPG]], and its wave-survival " +
      "loop made it a natural neighbor to [[bloons|Bloons]] and the tower-builder " +
      "[[desktop-tower-defense|Desktop Tower Defense]].",
    legacy:
      "Its simple, escalating defense became a template copied endlessly, and the game " +
      "itself proved durable enough to be re-released on later consoles — a path " +
      "shared with arcade-style toys like [[motherload|Motherload]] and the endless " +
      "[[copter-game|Copter]].",
  },

  "bloons": {
    lead:
      "Bloons, launched in 2007 by Ninja Kiwi, is a Flash puzzle game where you pop " +
      "fields of balloons by aiming a dart-throwing monkey across physics-based " +
      "bounces. Its bright, friendly hook made it instantly addictive.",
    history:
      "It lived among the puzzle-and-strategy browser hits of the late Flash era, near " +
      "[[stick-rpg|Stick RPG]], [[defend-your-castle|Defend Your Castle]], the " +
      "mining grind of [[motherload|Motherload]], and the fiendish " +
      "[[impossible-quiz|Impossible Quiz]]. Its monkey mascot shared the casual, " +
      "kid-welcoming tone of [[neopets-faerieland|Neopets]].",
    legacy:
      "Bloons spawned the wildly successful Bloons Tower Defense spin-offs, joining " +
      "[[desktop-tower-defense|Desktop Tower Defense]] in cementing the tower-defense " +
      "boom — proof a free browser toy could grow into a lasting franchise.",
  },

  "motherload": {
    lead:
      "Motherload (2004) by XGen Studios is a [[swf-file|Flash]] mining game: piloting " +
      "a little pod, you dig ever deeper into a Martian crust, selling ore to upgrade " +
      "your drill, hull, and fuel while a creeping mystery waits below.",
    history:
      "It was a beloved entry in the same XGen browser stable as " +
      "[[defend-your-castle|Defend Your Castle]], and its dig-and-upgrade loop made it " +
      "a cousin of arcade toys like [[bloons|Bloons]] and the trapdoor cruelty of " +
      "[[impossible-quiz|the Impossible Quiz]]. Players ran it on family PCs like the " +
      "[[dell-dimension-tower|Dell Dimension]].",
    legacy:
      "Its addictive risk-reward digging is a direct ancestor of later mining games, " +
      "and like all Flash titles it survives today as an archived " +
      "[[swf-file|SWF]] needing an emulator to run, near other garage-band toys like " +
      "[[punk-o-matic|Punk-O-Matic]].",
  },

  "impossible-quiz": {
    lead:
      "The Impossible Quiz (2007) by Splapp-Me-Do is a Flash trivia game built on " +
      "lateral-thinking trick questions, absurd wrong-answer traps, and a " +
      "merciless three-lives limit. It is a comedy of frustration as much as a quiz.",
    history:
      "It thrived among the puzzle-and-punishment Flash games near " +
      "[[bloons|Bloons]], [[motherload|Motherload]], and the garage-band toy " +
      "[[punk-o-matic|Punk-O-Matic]]. Its bait answers had the same gotcha spirit as a " +
      "[[download-button-decoy|fake download button]] or a " +
      "[[captcha-goblin|CAPTCHA]] designed to trip you up.",
    legacy:
      "Its trick-question format spawned sequels and a whole micro-genre of " +
      "\"impossible\" games, and its rage-inducing difficulty made it endlessly " +
      "clip-worthy — sharing shelf space with strategy darlings like " +
      "[[desktop-tower-defense|Desktop Tower Defense]].",
  },

  "punk-o-matic": {
    lead:
      "Punk-O-Matic (2006) is a Flash toy that doubles as a game: you assemble " +
      "punk-rock songs by chaining pre-recorded riffs into a sequencer, then " +
      "share the resulting track. It turned the browser into a tiny garage studio.",
    history:
      "It sat among the creative Flash toys near [[motherload|Motherload]] and the " +
      "trick-quiz of [[impossible-quiz|the Impossible Quiz]], with the same " +
      "make-your-own appeal as the looping doodles of " +
      "[[copter-game|the Copter game]] and the build-and-defend of " +
      "[[desktop-tower-defense|Desktop Tower Defense]].",
    legacy:
      "Its riff-sequencer scratched the same itch as the [[winamp-skins|Winamp]] " +
      "tinkerer's drive to customize, and the songs people built ended up in their " +
      "[[mp3-hoard|MP3 collections]] and on profile pages across the web.",
  },

  "desktop-tower-defense": {
    lead:
      "Desktop Tower Defense (2007) by Paul Preece is the Flash game that made tower " +
      "defense a mainstream genre. Played on a faux-desktop field, you build mazes of " +
      "turrets to funnel and destroy waves of creeps.",
    history:
      "It became a runaway hit on the same casual-strategy circuit as " +
      "[[bloons|Bloons]], [[defend-your-castle|Defend Your Castle]], the trick-quiz " +
      "[[impossible-quiz|Impossible Quiz]], and the endless [[copter-game|Copter game]], " +
      "and shared portal space with [[club-penguin-plaza|Club Penguin]] and the garage " +
      "toy [[punk-o-matic|Punk-O-Matic]].",
    legacy:
      "Its open-field maze design influenced nearly every tower-defense game that " +
      "followed, a peer to other emergent-play sandboxes like " +
      "[[line-rider|Line Rider]] in proving how much depth a browser game could hold.",
  },

  "copter-game": {
    lead:
      "The Copter Game (popularized around 2004) is a one-button Flash classic: hold " +
      "to rise, release to fall, and thread a tiny helicopter through an " +
      "endless scrolling cave for as long as you can. It defined the pre-mobile " +
      "endless-runner.",
    history:
      "It was the kind of \"just one more try\" filler kept in a browser tab beside " +
      "[[punk-o-matic|Punk-O-Matic]] and the strategy of " +
      "[[desktop-tower-defense|Desktop Tower Defense]] and " +
      "[[defend-your-castle|Defend Your Castle]]. Many a copy ran in " +
      "[[internet-explorer-six|Internet Explorer 6]].",
    legacy:
      "Its single-input, high-score loop is the clear ancestor of later one-tap " +
      "endless games, and it shared the friendly browser-arcade scene with kid-worlds " +
      "like [[club-penguin-plaza|Club Penguin]] and [[neopets-faerieland|Neopets]].",
  },

  "club-penguin-plaza": {
    lead:
      "Club Penguin, launched in 2005, was a massively popular children's virtual " +
      "world where players waddled around as penguins, played mini-games, and chatted " +
      "in a snowy town square. Disney acquired it in 2007.",
    history:
      "It was a Flash-powered hub of kid-friendly mini-games in the same family as " +
      "[[neopets-faerieland|Neopets]] and the casual toys at " +
      "[[newgrounds-portal|Newgrounds]] like [[desktop-tower-defense|Desktop Tower " +
      "Defense]] and the endless [[copter-game|Copter]]. Kids juggled it with chatting " +
      "on an [[aim-away-message|AIM]] window.",
    legacy:
      "Club Penguin defined the moderated children's MMO and the social-world idea " +
      "later echoed by teen profile pages on [[myspace-profile|Myspace]] — a safe, " +
      "walled garden whose 2017 shutdown is still mourned by a nostalgic generation.",
  },

  "neopets-faerieland": {
    lead:
      "Neopets, founded in 1999, is a virtual-pet website where users adopt and care " +
      "for digital creatures, earn \"Neopoints,\" and explore themed lands — among them " +
      "the cloud-borne Faerieland. It blended a pet sim with a sprawling economy and " +
      "hundreds of mini-games.",
    history:
      "Its Flash mini-games and kid-welcoming tone placed it beside " +
      "[[club-penguin-plaza|Club Penguin]] and the casual toys at " +
      "[[newgrounds-portal|Newgrounds]], from [[alien-hominid|Alien Hominid]] to " +
      "[[bloons|Bloons]] and the endless [[copter-game|Copter]]. Its open-ended " +
      "grind echoed life-sims like [[stick-rpg|Stick RPG]].",
    legacy:
      "Neopets built one of the web's first virtual economies and devoted fan " +
      "communities, indexed in old directories like " +
      "[[yahoo-directory|Yahoo's]] and discussed in endless " +
      "[[forum-signature|forum signatures]] — a pillar of childhood internet for a " +
      "whole generation.",
  },

  // ═══════════════════════════════ WEB RELICS ══════════════════════════════
  "geocities-homepage": {
    lead:
      "GeoCities, launched in 1994, was a free web-hosting service that organized " +
      "personal pages into themed \"neighborhoods.\" For millions it was the first " +
      "place they ever built a homepage, and its garish, heartfelt amateur aesthetic " +
      "defines the look of the early web to this day.",
    history:
      "A typical GeoCities page was a riot of [[tiled-background|tiled backgrounds]], " +
      "a [[midi-zone|MIDI]] soundtrack, an [[under-construction|under-construction " +
      "sign]], and a [[hit-counter|hit counter]] proudly logging visitors. Owners " +
      "decorated with an [[email-me-gif|\"email me\" mailbox]] and a wall of " +
      "[[award-badge-wall|award badges]], and joined a [[webring-hub|webring]] to find " +
      "neighbors. Rivals [[angelfire-attic|Angelfire]] and [[tripod-page|Tripod]] " +
      "offered much the same.",
    legacy:
      "Yahoo bought GeoCities in 1999 and shut down the US site in 2009, erasing a " +
      "vast amateur archive overnight. Best browsed in [[netscape-navigator|Netscape]] " +
      "and remembered for its [[guestbook|guestbooks]], it remains the defining " +
      "monument of the do-it-yourself web.",
  },

  "angelfire-attic": {
    lead:
      "Angelfire was a free web-hosting service, launched in 1996, that — alongside " +
      "[[geocities-homepage|GeoCities]] and [[tripod-page|Tripod]] — gave ordinary " +
      "people a place to build a homepage. Its pages were the same lovable clutter of " +
      "personal shrines, fan sites, and half-finished projects.",
    history:
      "An Angelfire page was rarely complete without a perpetual " +
      "[[blink-tag|<blink> tag]] flashing somewhere and a wall of " +
      "[[award-badge-wall|award badges]] collected from other sites. Like its peers, " +
      "it lived and died by the traffic a [[webring-hub|webring]] could send its way.",
    legacy:
      "Angelfire and Tripod were both folded into the Lycos network and limped on far " +
      "longer than GeoCities, becoming a quieter attic of the abandoned personal web — " +
      "a near-twin to the GeoCities story.",
  },

  "tripod-page": {
    lead:
      "Tripod, launched in 1995, was a free web host that pivoted from a young-adult " +
      "content site into a homepage builder, joining [[geocities-homepage|GeoCities]] " +
      "and [[angelfire-attic|Angelfire]] as one of the big three places to stake out a " +
      "corner of the early web.",
    history:
      "A Tripod page typically carried the era's full kit: a " +
      "[[guestbook|guestbook]] for visitors to sign, membership in a " +
      "[[webring-hub|webring]], and sometimes a maze of " +
      "[[frameset-labyrinth|frames]] holding it all together — best appreciated, the " +
      "page would insist, when [[best-viewed-800x600|viewed at 800×600]].",
    legacy:
      "Acquired by Lycos in 1998, Tripod outlived GeoCities but faded into the same " +
      "obscurity, a fossil layer of the amateur web preserved mostly in the memories " +
      "of the people who built on it.",
  },

  "webring-hub": {
    lead:
      "A webring was a collection of websites on a shared theme linked into a loop, so " +
      "a visitor could click \"next\" or \"previous\" and tour every member site in " +
      "turn. Hugely popular from the late 1990s, it was a grassroots way to find " +
      "related pages before search engines were any good.",
    history:
      "Webrings bound together the personal pages of " +
      "[[geocities-homepage|GeoCities]], [[angelfire-attic|Angelfire]], and " +
      "[[tripod-page|Tripod]], each member embedding a navigation widget and often a " +
      "{{relic}}[[#|small ring token]] in its footer. They competed with top-down " +
      "directories like [[yahoo-directory|Yahoo's]] for the job of organizing the web, " +
      "and even oddities like the [[hamster-dance|Hamster Dance]] spread along them.",
    legacy:
      "As search improved, the webring faded — but it embodied a communal, " +
      "human-curated ideal of discovery later missed in the algorithmic age. Aging " +
      "rings decayed into [[guestbook|guestbooks]] no one signed, broken " +
      "[[four-oh-four-page|404 pages]], and headlines on aggregators like " +
      "[[slashdot-frontpage|Slashdot]].",
    seeAlso: ["under-construction"],
  },

  "guestbook": {
    lead:
      "A guestbook was a page where visitors to a personal website could leave a " +
      "public message — a scroll of glitter dividers, kind strangers, and the " +
      "occasional spam bot. Every visitor was invited to " +
      "{{relic}}[[#|leave a signature]] before moving on, and etiquette held that a " +
      "good guest signed back.",
    history:
      "Most guestbooks were bolted onto a [[geocities-homepage|GeoCities homepage]] or " +
      "a [[tripod-page|Tripod page]], wedged between a perpetually-blinking " +
      "[[under-construction|under-construction sign]] and a proud " +
      "[[hit-counter|hit counter]]. You typically arrived after following a " +
      "[[webring-hub|webring]] from a neighbor's site.",
    legacy:
      "As traffic grew, guestbooks drowned under [[chain-email|chain-mail]] copy-pastes " +
      "and bot spam, which is why a [[captcha-goblin|CAPTCHA]] was eventually posted at " +
      "the gate. Their threaded, reply-to-reply descendants live on in the " +
      "[[phpbb-thread|phpBB forum]].",
  },

  "under-construction": {
    lead:
      "The \"Under Construction\" graphic — often a little digging worker or a yellow " +
      "road sign — was a near-universal fixture of personal pages, signaling that a " +
      "section was unfinished. In practice it stayed up forever, a permanent " +
      "{{relic}}[[#|blinking sign]] of perpetual good intentions.",
    history:
      "These signs proliferated across [[geocities-homepage|GeoCities]] pages, " +
      "frequently rendered as a looping [[animated-gif|animated GIF]] and parked beside " +
      "a [[hit-counter|hit counter]] or a [[guestbook|guestbook]]. Many were swapped " +
      "and collected like the scrolling text of the [[marquee-museum|marquee]].",
    legacy:
      "It became the visual shorthand for the eternally-unfinished web, sitting " +
      "alongside the [[webring-hub|webring]] in the iconography of the era — and the " +
      "spiritual ancestor of every broken [[four-oh-four-page|404 page]] that followed.",
  },

  "hit-counter": {
    lead:
      "A hit counter was an odometer-style graphic that tallied how many times a page " +
      "had been viewed, usually parked at the bottom of a homepage. Watching the number " +
      "tick upward was, for many early webmasters, the entire reward of having a site.",
    history:
      "Hit counters were a standard ornament on [[geocities-homepage|GeoCities]] pages, " +
      "right next to the [[guestbook|guestbook]] and the eternal " +
      "[[under-construction|under-construction sign]]. They shared the page with " +
      "decorative flourishes like the [[marquee-museum|scrolling marquee]] and a busy " +
      "[[tiled-background|tiled background]].",
    legacy:
      "The visible counter gave way to invisible analytics, but it was a forerunner of " +
      "today's metrics obsession — and the free ones were a notorious vector for the " +
      "[[popup-ad-alley|pop-up ads]] bundled with their hosting.",
  },

  "marquee-museum": {
    lead:
      "The <marquee> tag was a non-standard HTML element, championed by Internet " +
      "Explorer, that scrolled text horizontally across the screen. It was beloved by " +
      "amateur webmasters and loathed by everyone who valued legibility.",
    history:
      "Marquees crawled across personal pages beside the eternal " +
      "[[under-construction|under-construction sign]] and the ticking " +
      "[[hit-counter|hit counter]], often layered over a busy " +
      "[[tiled-background|tiled background]] with a [[midi-zone|MIDI]] tune playing. " +
      "It was the natural partner of that other reviled effect, the " +
      "[[blink-tag|<blink> tag]].",
    legacy:
      "Both <marquee> and <blink> were eventually deprecated from HTML, surviving as " +
      "punchlines about early-web excess — kin to the gaudy motion of a " +
      "[[dancing-cursor-trail|cursor trail]] and the whole maximalist aesthetic.",
  },

  "tiled-background": {
    lead:
      "A tiled background was a small image set to repeat across an entire webpage. " +
      "Used everywhere on the early web, it produced the era's signature look: " +
      "starfields, swirly marble, or a logo wallpapering the screen behind hard-to-read " +
      "text.",
    history:
      "Tiled backgrounds were inescapable on [[geocities-homepage|GeoCities]] pages, " +
      "paired with a ticking [[hit-counter|hit counter]], a scrolling " +
      "[[marquee-museum|marquee]], a flashing [[blink-tag|<blink> tag]], and a " +
      "[[midi-zone|MIDI]] soundtrack. The same wallpaper instinct later filled teen " +
      "profiles on [[myspace-profile|Myspace]] and diary pages on [[xanga-diary|Xanga]].",
    legacy:
      "The aesthetic it created is now lovingly parodied as peak \"old web,\" a sibling " +
      "of effects like the glittery [[dancing-cursor-trail|cursor trail]] that defined " +
      "the maximalist personal page.",
  },

  "midi-zone": {
    lead:
      "Before streaming audio was practical, websites played music as MIDI files — " +
      "tiny sequences of notes rendered by the computer's own synthesizer. A MIDI " +
      "auto-playing on page load, with no obvious way to stop it, is one of the most " +
      "evocative memories of the early web.",
    history:
      "MIDI tunes were a staple of [[geocities-homepage|GeoCities]] pages, drifting " +
      "over a [[tiled-background|tiled background]] beside a scrolling " +
      "[[marquee-museum|marquee]] and a [[blink-tag|<blink> tag]], sometimes inside a " +
      "[[frameset-labyrinth|frameset]]. The whole [[hamster-dance|Hamster Dance]] " +
      "phenomenon was essentially a MIDI-adjacent loop, and tunes like " +
      "[[leekspin|Leekspin's]] lived in the same headspace.",
    legacy:
      "As bandwidth grew, MIDI gave way to the [[winamp-skins|MP3 and its skinnable " +
      "players]], and pages stopped singing at you. Collectors still trade the old " +
      "sequences, a cousin of the curated [[mp3-hoard|MP3 hoard]].",
  },

  "blink-tag": {
    lead:
      "The <blink> tag was a non-standard HTML element, introduced by Netscape, that " +
      "made enclosed text flash on and off. Reviled almost from birth as the epitome " +
      "of bad web design, it was nonetheless irresistible to beginners.",
    history:
      "It flashed away on personal pages beside the era's other reviled effect, the " +
      "scrolling [[marquee-museum|marquee]], often over a busy " +
      "[[tiled-background|tiled background]] with [[midi-zone|MIDI]] music playing. It " +
      "was a hallmark of homemade [[angelfire-attic|Angelfire]] pages and frequently " +
      "trapped inside a [[frameset-labyrinth|frameset]] or behind a " +
      "[[splash-page|splash page]].",
    legacy:
      "<blink> was never adopted as a real standard and was eventually dropped by " +
      "every browser, surviving only as a cautionary joke about the excesses of the " +
      "early, gleefully ugly web.",
  },

  "frameset-labyrinth": {
    lead:
      "HTML framesets split a browser window into multiple independent panes, each " +
      "loading its own page — typically a navigation sidebar plus a content area. " +
      "Convenient for menus, they wreaked havoc on bookmarking, the back button, and " +
      "search engines.",
    history:
      "Framesets were a common skeleton for [[tripod-page|Tripod]] and other personal " +
      "sites, often holding a [[midi-zone|MIDI]] player in a hidden pane and a " +
      "[[blink-tag|<blink>]]-laden menu in another. A grand [[splash-page|splash page]] " +
      "frequently greeted you before the frames loaded, and the layout looked best, " +
      "the site claimed, [[best-viewed-800x600|at 800×600]].",
    legacy:
      "Frames were deprecated in modern HTML and abandoned for cleaner layouts, but " +
      "they were a defining structural quirk of the era — especially in their natural " +
      "home, [[internet-explorer-six|Internet Explorer 6]].",
  },

  "splash-page": {
    lead:
      "A splash page was an introductory screen — often just a logo, an animation, and " +
      "an \"Enter\" link — that greeted visitors before the real homepage. It added a " +
      "theatrical pause and, usually, very little else.",
    history:
      "Splash pages frequently fronted sites built on [[frameset-labyrinth|framesets]], " +
      "decorated with a [[blink-tag|<blink> tag]] and an " +
      "[[email-me-gif|\"email me\" link]]. The fancier ones were full " +
      "[[swf-file|Flash]] intros, complete with a \"skip intro\" button that became a " +
      "running joke.",
    legacy:
      "Almost universally deprecated as a usability sin, the splash page lingered " +
      "longest in the days when a [[best-viewed-800x600|\"best viewed\" notice]] could " +
      "stand in for an actual welcome.",
  },

  "best-viewed-800x600": {
    lead:
      "\"Best viewed at 800×600\" — often paired with a recommended browser — was a " +
      "notice webmasters added because pages were hand-tuned for one specific screen " +
      "resolution and could break on any other. It is a perfect fossil of an era " +
      "before responsive design.",
    history:
      "The notice usually appeared near a wall of [[award-badge-wall|award badges]] and " +
      "an [[email-me-gif|\"email me\" graphic]], greeting visitors arriving through a " +
      "[[frameset-labyrinth|frameset]] or a [[splash-page|splash page]]. It assumed a " +
      "particular [[crt-monitor-glow|CRT monitor]] glowing on the other end.",
    legacy:
      "Resolution notices vanished as screens diversified and layouts learned to flex, " +
      "but they capture the early web's charming, doomed assumption that everyone's " +
      "setup looked just like the author's — and they often sat on a " +
      "[[tripod-page|Tripod page]].",
  },

  "email-me-gif": {
    lead:
      "The animated \"email me\" graphic — a winking envelope or a spinning @ sign — " +
      "was the early web's call-to-action, inviting visitors to send the webmaster a " +
      "message. It was the personal homepage's equivalent of a contact form.",
    history:
      "These little mailboxes adorned [[geocities-homepage|GeoCities]] pages beside the " +
      "wall of [[award-badge-wall|award badges]], a [[splash-page|splash page]], or a " +
      "[[best-viewed-800x600|\"best viewed\" notice]]. They rendered as looping " +
      "[[animated-gif|GIFs]] and were, regrettably, harvested by the bots behind " +
      "[[chain-email|chain mail]] and spam.",
    legacy:
      "The mailto: link gave way to contact forms (partly to fight that very spam), " +
      "but the cheerful \"email me\" icon endures as a token of a more personal, " +
      "reachable web — much like the friendly [[dancing-baby|Dancing Baby]] that " +
      "arrived in so many inboxes.",
  },

  "award-badge-wall": {
    lead:
      "Many early websites displayed rows of small graphic \"awards\" — badges granted " +
      "by other sites or webrings to honor a good page, or simply to cross-promote. A " +
      "proud webmaster's homepage could end in a whole wall of them, including the " +
      "ubiquitous {{relic}}[[#|88×31 button]].",
    history:
      "Award walls were a fixture of [[geocities-homepage|GeoCities]] and " +
      "[[angelfire-attic|Angelfire]] pages, clustered near the " +
      "[[email-me-gif|\"email me\" graphic]] and a " +
      "[[best-viewed-800x600|\"best viewed\" notice]]. The badges doubled as a " +
      "[[forum-signature|signature]]-style flex of one's web pedigree.",
    legacy:
      "The little 88×31 button became one of the most iconic shapes of the old web, " +
      "and a quiet revival movement now collects and trades them again — a deliberate " +
      "rejection of the sleek, badge-less modern page.",
  },

  // ═══════════════════════════════ SOFTWARE ════════════════════════════════
  "winamp-skins": {
    lead:
      "Winamp, released in 1997, was the definitive MP3 player of the era — fast, " +
      "free-ish, and famously \"it really whips the llama's ass.\" Its killer feature " +
      "was skins: users could re-clothe the entire interface, and trading a " +
      "{{relic}}[[#|good skin]] became a hobby of its own.",
    history:
      "Winamp anchored a whole desktop-audio scene next to the file-sharing apps that " +
      "fed it — [[limewire-library|LimeWire]] and the original " +
      "[[napster-basement|Napster]] — and it played the spoils of every " +
      "[[mp3-hoard|MP3 hoard]]. Many a copy was downloaded in " +
      "[[netscape-navigator|Netscape]] or [[internet-explorer-six|Internet Explorer 6]], " +
      "and its tunes once lived as humble [[midi-zone|MIDI]] files.",
    legacy:
      "Its skinnable, plugin-driven design influenced media players for years, from " +
      "the [[windows-media-player-visualizer|Windows Media Player visualizers]] to the " +
      "riff-builder [[punk-o-matic|Punk-O-Matic]]. Winamp's slow decline after AOL " +
      "acquired it is a touchstone of nostalgia for the MP3 age.",
  },

  "limewire-library": {
    lead:
      "LimeWire, launched in 2000, was a wildly popular peer-to-peer file-sharing " +
      "client built on the Gnutella network. For a generation it was simply how you " +
      "got music — and, all too often, a virus instead.",
    history:
      "It rose as the original [[napster-basement|Napster]] fell, sharing the scene " +
      "with [[kazaa-kiosk|KaZaA]] and feeding the [[mp3-hoard|MP3 hoard]] that played " +
      "in [[winamp-skins|Winamp]]. Downloads landed as [[zip-file|ZIP archives]] and " +
      "loose files, synced to an [[ipod-click-wheel|iPod]], and were often bundled with " +
      "the [[spyware-scan|spyware]] that made a [[spyware-scan|scan]] a weekly ritual.",
    legacy:
      "A 2010 court injunction shut LimeWire down, a landmark in the music industry's " +
      "war on P2P. Best run, like everything then, in " +
      "[[internet-explorer-six|Internet Explorer 6]], it remains a byword for the " +
      "lawless, malware-strewn golden age of downloading.",
  },

  "napster-basement": {
    lead:
      "Napster, launched in 1999 by Shawn Fanning and Sean Parker, was the first " +
      "mainstream peer-to-peer music service. It made an entire generation's record " +
      "collection suddenly, freely shareable — and ignited the digital-music wars.",
    history:
      "Napster filled the [[mp3-hoard|MP3 hoard]] that played in " +
      "[[winamp-skins|Winamp]] and burned to a [[cd-r-spindle|CD-R]] for the car. When " +
      "lawsuits killed it, users scattered to successors like " +
      "[[limewire-library|LimeWire]] and [[kazaa-kiosk|KaZaA]], and to streaming " +
      "novelties like the [[realplayer-popup|RealPlayer]] window.",
    legacy:
      "A 2001 court order forced the original Napster offline, but it had already " +
      "proven that listeners wanted music as files, not discs — the disruption that " +
      "eventually birthed legal streaming. \"Napster\" is shorthand for the moment the " +
      "music industry lost control of distribution.",
  },

  "kazaa-kiosk": {
    lead:
      "KaZaA, launched in 2001, was a peer-to-peer file-sharing application enormously " +
      "popular in the early 2000s — and infamous for bundling adware and spyware with " +
      "its installer, a Trojan horse in your downloads folder.",
    history:
      "It shared the post-[[napster-basement|Napster]] P2P scene with " +
      "[[limewire-library|LimeWire]], trading music, fake files, and the occasional " +
      "[[realplayer-popup|RealMedia]] clip. Installing it practically guaranteed a " +
      "[[spyware-scan|spyware infection]] and a fresh stack of " +
      "[[browser-toolbar-stack|browser toolbars]]. Media often arrived in " +
      "[[quicktime-trailer|QuickTime]] format.",
    legacy:
      "KaZaA's adware-laden model made it a cautionary tale about \"free\" software, " +
      "and its legal troubles pushed it toward a short-lived legitimate relaunch — a " +
      "key chapter in the messy P2P era.",
  },

  "realplayer-popup": {
    lead:
      "RealPlayer, from RealNetworks, was a dominant streaming-media player of the " +
      "late 1990s. It pioneered streaming audio and video over slow connections, but " +
      "became notorious for nagging pop-ups, sneaky upsells, and burying the free " +
      "version.",
    history:
      "RealPlayer handled streams from the [[napster-basement|Napster]]-era music " +
      "scene and clips passed around on [[kazaa-kiosk|KaZaA]], competing for the " +
      "desktop with [[quicktime-trailer|QuickTime]] and the " +
      "[[windows-media-player-visualizer|Windows Media Player]]. Its incessant nagging " +
      "made it a poster child for [[popup-ad-alley|pop-up]] fatigue.",
    legacy:
      "The dreaded \".rm\" file and RealPlayer's aggressive tactics made it one of the " +
      "most-resented apps of its day, a lasting lesson in how user-hostile design can " +
      "squander a technical head start.",
  },

  "quicktime-trailer": {
    lead:
      "Apple's QuickTime was a multimedia framework and player, and for years the " +
      "place to watch high-resolution movie trailers online. Downloading a big " +
      "QuickTime trailer over a slow connection was a small event in itself.",
    history:
      "QuickTime competed with the [[realplayer-popup|RealPlayer]] and the " +
      "[[windows-media-player-visualizer|Windows Media Player]] for desktop video, and " +
      "handled clips that traveled through [[kazaa-kiosk|KaZaA]]. Its \".mov\" files " +
      "joined the [[cd-r-spindle|CD-R]] backups and synced to the " +
      "[[ipod-click-wheel|iPod]], whose [[translucent-imac-g3|iMac]] ecosystem it " +
      "anchored.",
    legacy:
      "QuickTime's high-quality trailers helped establish online video as a habit, the " +
      "format that carried clips like [[numa-numa|Numa Numa]], " +
      "[[star-wars-kid|the Star Wars Kid]], [[dramatic-chipmunk|the Dramatic Chipmunk]], " +
      "and [[keyboard-cat|Keyboard Cat]]. It later gave way to the AIM-era chatter of " +
      "the [[aim-away-message|away message]] and web-native players.",
  },

  "windows-media-player-visualizer": {
    lead:
      "Windows Media Player, bundled with Windows, was the default music and video app " +
      "for most PCs. Its hypnotic visualizers — swirling, pulsing graphics that danced " +
      "to your music — were a small, mesmerizing pleasure of the era.",
    history:
      "WMP competed for the desktop with [[realplayer-popup|RealPlayer]], " +
      "[[quicktime-trailer|QuickTime]], and the beloved [[winamp-skins|Winamp]]. It " +
      "shared the screen with chat clients like the [[aim-away-message|AIM]] window and " +
      "[[icq-uh-oh|ICQ]], glowing on a [[crt-monitor-glow|CRT monitor]] atop a " +
      "[[dell-dimension-tower|Dell Dimension tower]].",
    legacy:
      "Its visualizers became an icon of the early-2000s desktop, and WMP's deep " +
      "integration with Windows kept it the default for years — even as skinnable " +
      "rivals won the hearts of enthusiasts.",
  },

  "aim-away-message": {
    lead:
      "AOL Instant Messenger (AIM) was the dominant instant-messaging service of its " +
      "era, and its away messages were a cultural form unto themselves: a status line " +
      "left up when you stepped away, freighted with song lyrics, in-jokes, and " +
      "passive-aggressive subtext.",
    history:
      "AIM sat on the desktop beside the [[windows-media-player-visualizer|Windows " +
      "Media Player]] and [[quicktime-trailer|QuickTime]], competing with " +
      "[[icq-uh-oh|ICQ]] and the [[msn-wink-vault|MSN Messenger]] crowd. Teens kept it " +
      "open while waddling through [[club-penguin-plaza|Club Penguin]], posting to " +
      "[[livejournal-entry|LiveJournal]], and texting on a " +
      "[[nokia-3310|Nokia 3310]].",
    legacy:
      "The away message was a precursor to the modern status update and the read " +
      "receipt's anxieties. AIM's 2017 shutdown closed the book on a foundational " +
      "chapter of how a generation learned to talk online.",
  },

  "icq-uh-oh": {
    lead:
      "ICQ, launched in 1996, was one of the first widely used instant messengers, " +
      "famous for its \"uh-oh!\" new-message sound and for assigning every user a " +
      "numeric ID. Lower numbers were a quiet badge of having been there early.",
    history:
      "ICQ shared the messaging era with the [[aim-away-message|AIM]] away message and " +
      "the [[msn-wink-vault|MSN Messenger]] crowd, often running alongside the " +
      "[[windows-media-player-visualizer|Windows Media Player]]. Its number was a " +
      "common trophy in a [[forum-signature|forum signature]].",
    legacy:
      "Acquired by AOL and later sold on, ICQ faded in the West but lingered abroad. " +
      "That \"uh-oh!\" remains one of the most instantly recognizable sounds of the " +
      "early social internet, alongside the [[bonzibuddy-office|desktop assistants]] " +
      "of the same age.",
  },

  "msn-wink-vault": {
    lead:
      "MSN Messenger (later Windows Live Messenger) was Microsoft's hugely popular " +
      "instant messenger. Beyond chat it offered nudges, emoticons, and \"winks\" — " +
      "little animations you could fling across a conversation.",
    history:
      "It battled the [[aim-away-message|AIM]] away message and the " +
      "[[icq-uh-oh|ICQ]] \"uh-oh\" for messaging supremacy, and many users discovered " +
      "it bundled near desktop pests like [[bonzibuddy-office|BonziBuddy]]. Profiles " +
      "and display pictures spilled over onto [[myspace-profile|Myspace]].",
    legacy:
      "Microsoft eventually merged MSN Messenger into Skype, retiring it in the 2010s. " +
      "For millions it was the after-school social hub, as central to growing up online " +
      "as the directories at [[ask-jeeves-desk|Ask Jeeves]] were to homework.",
  },

  "bonzibuddy-office": {
    lead:
      "BonziBuddy was a free desktop assistant from 1999 — a purple cartoon gorilla " +
      "that told jokes, sang, and \"helped\" you browse. In reality it was adware and " +
      "spyware, one of the most notorious unwanted guests ever to land on a home PC.",
    history:
      "Bonzi belonged to the desktop-assistant fad alongside chat-era staples like " +
      "[[icq-uh-oh|ICQ]] and [[msn-wink-vault|MSN Messenger]], and dressed itself up as " +
      "a friendly search helper to rival [[yahoo-directory|Yahoo]]. Installing it " +
      "meant a [[spyware-scan|spyware infection]] and a teetering " +
      "[[browser-toolbar-stack|stack of browser toolbars]].",
    legacy:
      "Lawsuits and privacy complaints drove BonziBuddy off the web by 2004, and the " +
      "purple ape became the textbook example of malware masquerading as a cute " +
      "helper. It even pulled the old butler routine of [[ask-jeeves-desk|Ask Jeeves]] " +
      "into disrepute by association.",
  },

  "ask-jeeves-desk": {
    lead:
      "Ask Jeeves, launched in 1996, was a search engine built around a natural-language " +
      "gimmick: you asked a question of a polite cartoon butler named Jeeves, and he " +
      "fetched an answer. The mascot was friendlier than the results.",
    history:
      "It competed with the messaging-era web's other front doors — the " +
      "[[msn-wink-vault|MSN]] portal, the [[bonzibuddy-office|desktop assistant]] " +
      "novelty — and with proper search rivals like [[yahoo-directory|Yahoo]] and " +
      "[[altavista-oracle|AltaVista]].",
    legacy:
      "Jeeves was retired in 2006 as the site rebranded to Ask.com, unable to keep " +
      "pace with Google. He endures as a fond mascot of the age when search engines " +
      "still had personality.",
  },

  "yahoo-directory": {
    lead:
      "Before search dominated, Yahoo! began as a hand-built directory: a vast, " +
      "human-edited tree of categories and subcategories cataloguing the web by topic. " +
      "Finding a site meant drilling down through the branches, not typing a query.",
    history:
      "The Yahoo Directory competed with [[ask-jeeves-desk|Ask Jeeves]] and " +
      "[[altavista-oracle|AltaVista]] to organize the web, and embodied the same " +
      "human-curated spirit as the [[webring-hub|webring]]. It was a default home page " +
      "in [[netscape-navigator|Netscape]], and listed everything from " +
      "[[neopets-faerieland|Neopets]] fan sites onward. Its desktop neighbors included " +
      "novelties like [[bonzibuddy-office|BonziBuddy]].",
    legacy:
      "The directory model was buried by algorithmic search and formally closed in " +
      "2014, but it stands as a monument to the brief era when humans, not crawlers, " +
      "decided what the web's map looked like.",
  },

  "altavista-oracle": {
    lead:
      "AltaVista, launched in 1995, was one of the first powerful crawler-based search " +
      "engines, prized for its speed, its huge index, and its early stab at machine " +
      "translation with Babel Fish. For a while it was the smart person's search box.",
    history:
      "AltaVista competed with the directory at [[yahoo-directory|Yahoo]] and the " +
      "butler at [[ask-jeeves-desk|Ask Jeeves]], and was a common search default in " +
      "[[netscape-navigator|Netscape]] and [[internet-explorer-six|Internet Explorer " +
      "6]]. Where Yahoo catalogued by hand, AltaVista trusted the crawler.",
    legacy:
      "Overtaken by Google's cleaner results and acquired by Yahoo, AltaVista was " +
      "finally shut down in 2013 — remembered as a search pioneer that simply got " +
      "out-executed.",
  },

  "netscape-navigator": {
    lead:
      "Netscape Navigator was the web browser that, more than any other, brought the " +
      "internet to the public in the mid-1990s. To browse in Navigator was to watch " +
      "the web itself being invented, one {{relic}}[[#|glowing pixel]] at a time.",
    history:
      "Navigator introduced features the whole web came to rely on, including the " +
      "much-maligned <blink> tag and early JavaScript. It was the window onto " +
      "[[geocities-homepage|GeoCities]], the directories at [[yahoo-directory|Yahoo]] " +
      "and [[altavista-oracle|AltaVista]], and the download tool for apps like " +
      "[[winamp-skins|Winamp]]. It glowed on [[translucent-imac-g3|iMac G3s]] " +
      "everywhere.",
    legacy:
      "Microsoft's [[internet-explorer-six|Internet Explorer]] won the brutal browser " +
      "wars and Navigator faded — but its code was set free as Mozilla, the lineage " +
      "that became Firefox. Few relics carry more of the old web's founding spirit.",
  },

  "internet-explorer-six": {
    lead:
      "Internet Explorer 6, released in 2001, became the most-used web browser on " +
      "Earth after winning the browser wars — and then stagnated for years, a " +
      "byword among developers for security holes and standards-defying quirks.",
    history:
      "IE6 was the default browser that buried [[netscape-navigator|Netscape]] and ran " +
      "everything: the searches at [[altavista-oracle|AltaVista]], downloads of " +
      "[[winamp-skins|Winamp]] and [[limewire-library|LimeWire]], browser games like " +
      "the endless [[copter-game|Copter]], and pages knotted into " +
      "[[frameset-labyrinth|framesets]]. It was also a magnet for " +
      "[[browser-toolbar-stack|toolbars]] and [[popup-ad-alley|pop-ups]].",
    legacy:
      "Its long dominance held the web back for a decade, and \"drop IE6\" campaigns " +
      "became a developer rallying cry. It stands as the cautionary tale of a monopoly " +
      "that stopped innovating.",
  },

  // ═══════════════════════════════ DEVICES & FILES ═════════════════════════
  "nokia-3310": {
    lead:
      "The Nokia 3310, released in 2000, is one of the best-selling and most beloved " +
      "mobile phones ever made — celebrated for its endless battery life, its Snake " +
      "game, customizable ringtones, and, above all, {{relic}}[[#|near-indestructible " +
      "build]]. It became a global meme for sheer toughness.",
    history:
      "It defined the pre-smartphone handset, later joined by flashier rivals like the " +
      "[[motorola-razr|Motorola Razr]]. Its monophonic ringtones had a MIDI-like " +
      "charm, and people loaded them much as they hoarded [[mp3-hoard|MP3s]] for the " +
      "[[ipod-click-wheel|iPod]]. Texting on it filled the gaps between an " +
      "[[aim-away-message|AIM]] session.",
    legacy:
      "The 3310 outsold almost everything and outlived its century in legend, kept in " +
      "the same nostalgic toy box as the [[game-boy-advance|Game Boy Advance]]. Its " +
      "Snake is preserved and re-played to this day as a looping " +
      "[[animated-gif|GIF]] of mobile history.",
  },

  "motorola-razr": {
    lead:
      "The Motorola Razr V3, launched in 2004, was an ultra-thin clamshell phone whose " +
      "sleek aluminum design made it a status symbol and one of the best-selling flip " +
      "phones in history. It was fashion as much as function.",
    history:
      "The Razr was the stylish counterpoint to the rugged [[nokia-3310|Nokia 3310]], " +
      "and it sat in the same pocket-tech moment as the [[ipod-click-wheel|iPod]] and " +
      "the [[game-boy-advance|Game Boy Advance]]. It played [[mp3-hoard|MP3]] " +
      "ringtones and snapped low-res photos destined for a " +
      "[[myspace-profile|Myspace profile]] — and the [[top-eight-drama|Top 8 drama]] " +
      "that came with it.",
    legacy:
      "The Razr's thin clamshell defined mid-2000s phone style, and Motorola revived " +
      "the name decades later for a folding smartphone — proof of how deeply the " +
      "original lodged in cultural memory.",
  },

  "ipod-click-wheel": {
    lead:
      "Apple's iPod, introduced in 2001, put \"1,000 songs in your pocket,\" and its " +
      "click wheel — a touch-sensitive ring for scrolling through long lists — was a " +
      "revelation in interface design. It became the defining gadget of digital music.",
    history:
      "The iPod was filled with the [[mp3-hoard|MP3 hoard]] amassed from " +
      "[[limewire-library|LimeWire]] and ripped CDs, and shared the pocket-tech era " +
      "with the [[nokia-3310|Nokia 3310]] and the [[motorola-razr|Razr]]. It belonged " +
      "to the same gadget love as the [[game-boy-advance|Game Boy Advance]] and its " +
      "[[gba-sp-backlight|backlit SP successor]], and synced via " +
      "[[quicktime-trailer|QuickTime]]-era Apple software.",
    legacy:
      "The iPod and its wheel reshaped the music industry and paved the way, " +
      "interface and all, for the iPhone. The click wheel remains one of the most " +
      "fondly remembered controls ever shipped.",
  },

  "game-boy-advance": {
    lead:
      "The Game Boy Advance, released by Nintendo in 2001, was a 32-bit handheld that " +
      "brought near-SNES-quality games on the go. Its one notorious flaw — an unlit " +
      "screen — sent players hunting for any lamp they could find.",
    history:
      "The GBA was the portable centerpiece of the era's gadget bag, alongside the " +
      "[[ipod-click-wheel|iPod]], the [[nokia-3310|Nokia 3310]], and the " +
      "[[motorola-razr|Razr]]. It even received a port of the Flash hit " +
      "[[alien-hominid|Alien Hominid]], and shared a generation with home consoles " +
      "whose save data lived on a [[playstation-2-memory-card|PS2 memory card]] or a " +
      "[[dreamcast-vmu|Dreamcast VMU]].",
    legacy:
      "The screen problem was famously fixed by the [[gba-sp-backlight|backlit Game " +
      "Boy Advance SP]], and the GBA library is still mined by collectors — a pillar " +
      "of handheld gaming history.",
  },

  "gba-sp-backlight": {
    lead:
      "The Game Boy Advance SP, released in 2003, was a clamshell redesign of " +
      "Nintendo's handheld — and, in its later AGS-101 revision, the first to include " +
      "a proper backlit screen, finally letting players see the game in the dark.",
    history:
      "The SP solved the dim-screen curse of the original " +
      "[[game-boy-advance|Game Boy Advance]] and rode the same handheld wave as the " +
      "[[ipod-click-wheel|iPod]]. Its save carts sat in the same memory-card era as the " +
      "[[playstation-2-memory-card|PS2 memory card]] and the " +
      "[[dreamcast-vmu|Dreamcast VMU]].",
    legacy:
      "The backlit SP is remembered as the definitive way to play the GBA library, and " +
      "its bright clamshell design pointed straight toward the dual-screen Nintendo DS " +
      "that followed.",
  },

  "playstation-2-memory-card": {
    lead:
      "The PlayStation 2 memory card stored your saved games on Sony's best-selling " +
      "console. With a finite number of blocks, it forced players into the small, " +
      "real drama of deciding which saves were worth keeping.",
    history:
      "The PS2 card was the home-console counterpart to a handheld save on the " +
      "[[game-boy-advance|Game Boy Advance]] or its [[gba-sp-backlight|SP]], and a " +
      "direct rival to the [[dreamcast-vmu|Dreamcast's VMU]]. The console it served " +
      "glowed on a [[crt-monitor-glow|CRT]] in countless living rooms.",
    legacy:
      "Limited storage and the dread of a corrupted card are core memories of the " +
      "era, swept away by built-in hard drives and cloud saves. The little card is a " +
      "fossil of when your progress lived in your hand.",
  },

  "dreamcast-vmu": {
    lead:
      "The Visual Memory Unit was Sega's clever memory card for the Dreamcast: it had " +
      "its own tiny LCD screen and buttons, doubling as a minimal handheld that could " +
      "run small games and display in-game info when slotted into the controller.",
    history:
      "The VMU was a more imaginative take on the [[playstation-2-memory-card|PS2 " +
      "memory card]], from the same console generation that the " +
      "[[game-boy-advance|Game Boy Advance]] — and its " +
      "[[gba-sp-backlight|backlit SP]] — ruled on the go. The Dreamcast it served " +
      "glowed on a [[crt-monitor-glow|CRT]] and, with its built-in modem, was a beloved " +
      "topic of many a [[forum-signature|forum signature]]. It shared shelf space with " +
      "the [[translucent-imac-g3|translucent iMac]].",
    legacy:
      "Though the Dreamcast was commercially short-lived, the VMU's screen-in-a-card " +
      "idea is still celebrated as ahead of its time — a tiny, ambitious gadget " +
      "ringed by a devoted fandom.",
  },

  "crt-monitor-glow": {
    lead:
      "The cathode-ray-tube monitor was the heavy, deep glass display that sat on " +
      "every desk before flat panels. Its faint glow, gentle flicker, and warm static " +
      "hum are among the most evocative sensory memories of the early computing age.",
    history:
      "A CRT was where you watched the save data of a " +
      "[[playstation-2-memory-card|PS2 memory card]] or a " +
      "[[dreamcast-vmu|Dreamcast VMU]] come to life, and where the " +
      "[[windows-media-player-visualizer|Windows Media Player]] visualizers pulsed. It " +
      "shared the desk with a [[translucent-imac-g3|translucent iMac]] or a beige " +
      "[[dell-dimension-tower|Dell Dimension tower]], and rendered every page someone " +
      "[[best-viewed-800x600|tuned for 800×600]].",
    legacy:
      "LCDs made CRTs obsolete almost overnight, but their glow is now chased by " +
      "retro-gaming purists for its authentic look — the literal screen on which the " +
      "old web and its games first appeared.",
  },

  "translucent-imac-g3": {
    lead:
      "The iMac G3, launched by Apple in 1998, was the all-in-one computer whose " +
      "translucent, candy-colored shell rescued the company and changed product design " +
      "forever. \"Bondi Blue\" made a beige industry suddenly look ancient.",
    history:
      "The iMac glowed beside the boxy [[crt-monitor-glow|CRT]] and the beige " +
      "[[dell-dimension-tower|Dell Dimension]] it shamed, and shared the consumer-tech " +
      "moment with the [[dreamcast-vmu|Dreamcast]]. It anchored Apple's media push " +
      "around [[quicktime-trailer|QuickTime]] and ran the browser of the day, " +
      "[[netscape-navigator|Netscape]] — its drives reading the humble " +
      "[[floppy-disk|floppy disk]] it famously chose to omit.",
    legacy:
      "By dropping the floppy and embracing USB and bold color, the iMac G3 set Apple " +
      "on the path to the iPod and iPhone. Its translucent look defines the visual " +
      "memory of the turn of the millennium.",
  },

  "dell-dimension-tower": {
    lead:
      "The Dell Dimension was a line of mainstream home desktop PCs — the beige (later " +
      "gray) towers that filled home offices and spare bedrooms during the internet's " +
      "boom years. Ordered by phone or website, it was the default family computer.",
    history:
      "A Dell Dimension typically wore a bulky [[crt-monitor-glow|CRT]] and stood in " +
      "deliberate contrast to the stylish [[translucent-imac-g3|iMac G3]]. Its drives " +
      "swallowed [[floppy-disk|floppy disks]] and burned [[cd-r-spindle|CD-Rs]], and it " +
      "ran games like [[motherload|Motherload]] while the " +
      "[[windows-media-player-visualizer|Windows Media Player]] danced on screen.",
    legacy:
      "Dell's build-to-order model made it a household name and helped put a capable PC " +
      "in millions of homes — the unglamorous beige workhorse on which a generation " +
      "first went online.",
  },

  "floppy-disk": {
    lead:
      "The 3.5-inch floppy disk stored a now-laughable 1.44 megabytes, yet for years " +
      "it was how everyone moved files between machines and handed in homework. Its " +
      "shape lives on forever as the universal \"save\" icon.",
    history:
      "Floppies were read by the [[translucent-imac-g3|iMac G3]] (until Apple " +
      "famously dropped the drive) and the [[dell-dimension-tower|Dell Dimension]], " +
      "before being eclipsed by the roomier [[cd-r-spindle|CD-R]] and the " +
      "[[zip-file|ZIP archive]]. A disk full of bad sectors was its own little " +
      "[[four-oh-four-page|file not found]] tragedy.",
    legacy:
      "The floppy was rendered obsolete by CDs, USB drives, and the cloud, but its " +
      "icon endures in software the world over — the most successful skeuomorph in " +
      "computing history.",
  },

  "cd-r-spindle": {
    lead:
      "The recordable CD-R, stacked by the dozen on a plastic spindle, was the " +
      "burnable disc that defined home media in the late 1990s and early 2000s. " +
      "Burning a mix CD was both a technical ritual and an act of devotion.",
    history:
      "CD-Rs held the [[mp3-hoard|MP3 hoard]] pulled from " +
      "[[napster-basement|Napster]] and the clips saved from " +
      "[[quicktime-trailer|QuickTime]], the higher-capacity successor to the " +
      "[[floppy-disk|floppy disk]] and the [[zip-file|ZIP archive]]. Burned on a " +
      "[[dell-dimension-tower|Dell Dimension]], a disc might hold anything down to a " +
      "stray [[swf-file|Flash file]].",
    legacy:
      "Cheap, finicky, and prone to \"buffer underrun\" coasters, the CD-R was " +
      "eventually buried by flash drives and streaming — but the mix CD remains an " +
      "icon of how people once shared music by hand.",
  },

  "zip-file": {
    lead:
      "The ZIP file is a compressed archive that bundles many files into one smaller " +
      "package. Indispensable for sharing software and media over slow connections, it " +
      "is so fundamental it is still ubiquitous today.",
    history:
      "ZIP archives were how big downloads arrived from [[limewire-library|LimeWire]], " +
      "often holding a [[swf-file|Flash file]] or a folder of " +
      "[[animated-gif|animated GIFs]]. They were a roomier sibling to the " +
      "[[floppy-disk|floppy disk]] and frequently burned onto a " +
      "[[cd-r-spindle|CD-R]] for safekeeping.",
    legacy:
      "Decades on, ZIP remains a backbone of file distribution — but in the download " +
      "era a tempting archive was also a classic lure, the payload behind many a " +
      "[[download-button-decoy|fake download button]].",
  },

  "swf-file": {
    lead:
      "The SWF (\"Small Web Format\") file was the container for Adobe Flash content — " +
      "the animations and games that defined a decade of the interactive web. A single " +
      ".swf could hold an entire cartoon or a complete game.",
    history:
      "SWFs powered the portal at [[newgrounds-portal|Newgrounds]] and games like " +
      "[[pico-school|Pico's School]] and [[motherload|Motherload]], plus memes like " +
      "[[peanut-butter-jelly-time|Peanut Butter Jelly Time]] and " +
      "[[all-your-base|All Your Base]] — and the lavish " +
      "[[splash-page|Flash splash intros]] that fronted so many sites. They were " +
      "traded as loose files, tucked into a [[zip-file|ZIP]], burned to a " +
      "[[cd-r-spindle|CD-R]], and counted among one's [[animated-gif|animated]] and " +
      "[[mp3-hoard|audio]] media.",
    legacy:
      "When browsers dropped the Flash plugin in 2020, a vast trove of SWFs was left " +
      "stranded — now rescued by the [[flashpoint-archive|Flashpoint archive]] and the " +
      "[[ruffle-emulator|Ruffle emulator]] that play them without Flash.",
  },

  "animated-gif": {
    lead:
      "The animated GIF — a looping sequence of frames in a single image file — is one " +
      "of the oldest and most durable formats on the web. Soundless and endlessly " +
      "looping, it has been the internet's native unit of motion since the 1990s.",
    history:
      "Animated GIFs wallpapered the early web: the bobbing " +
      "[[hamster-dance|Hamster Dance]], the [[dancing-baby|Dancing Baby]], the eternal " +
      "[[under-construction|under-construction sign]], and the winking " +
      "[[email-me-gif|\"email me\" mailbox]]. They lived beside [[swf-file|Flash files]] " +
      "and were bundled into a [[zip-file|ZIP]] or counted among one's " +
      "[[mp3-hoard|media hoard]]. Even ringtone-era gadgets like the " +
      "[[nokia-3310|Nokia 3310]] echoed their tiny looping charm, as did clips of " +
      "[[peanut-butter-jelly-time|the dancing banana]], [[leekspin|Leekspin]], and " +
      "[[madness-combat|Madness Combat]].",
    legacy:
      "Long pronounced dead, the GIF was reborn as the reaction loop of modern social " +
      "media and messaging — proof that a humble, ancient format can outlive nearly " +
      "every newer technology.",
  },

  "mp3-hoard": {
    lead:
      "The MP3 hoard was the sprawling, lovingly (dis)organized folder of music files " +
      "that defined personal computing in the early 2000s. Buried somewhere in it, " +
      "every collector liked to imagine, was {{relic}}[[#|the very first rip]] they " +
      "ever made.",
    history:
      "The hoard was filled from [[limewire-library|LimeWire]], the original " +
      "[[napster-basement|Napster]], and ripped CDs, then played in " +
      "[[winamp-skins|Winamp]] and synced to the [[ipod-click-wheel|iPod]], the " +
      "[[motorola-razr|Razr]], and even a ringtone slot on the " +
      "[[nokia-3310|Nokia 3310]]. Tracks were burned to a [[cd-r-spindle|CD-R]] and " +
      "shared as loose files beside [[swf-file|Flash]] and " +
      "[[animated-gif|animated GIFs]]. Its tunes had grown up as " +
      "[[midi-zone|MIDI]] files, and even a riff-builder like " +
      "[[punk-o-matic|Punk-O-Matic]] fed it.",
    legacy:
      "Streaming made the personal music library nearly obsolete, but the carefully " +
      "tended MP3 folder — with its mislabeled tracks and treasured rarities — remains " +
      "a fond emblem of when you owned, rather than rented, your music.",
  },

  // ═══════════════════════════════ COMMUNITY ═══════════════════════════════
  "forum-signature": {
    lead:
      "A forum signature was the block of text and images appended to every post a " +
      "user made on a message board. Part business card and part graffiti, it was " +
      "prime real estate for identity, in-jokes, and flexing — the social currency of " +
      "forum life.",
    history:
      "Signatures bloomed on every [[phpbb-thread|phpBB board]] and blog-forum hybrid " +
      "like [[livejournal-entry|LiveJournal]], stuffed with quotes from " +
      "[[all-your-base|All Your Base]], a still from [[star-wars-kid|the Star Wars " +
      "Kid]], or the deadpan [[oolong-pancake-bunny|pancake bunny]]. Gamers showed off " +
      "a [[pico-school|favorite Flash game]] or a [[neopets-faerieland|Neopets]] pet, a " +
      "wall of [[award-badge-wall|88×31 badges]], and an [[icq-uh-oh|ICQ number]].",
    legacy:
      "Overzealous signatures — huge images that dwarfed the actual posts — were a " +
      "perennial source of friction and strict size rules. The signature is a direct " +
      "ancestor of the modern profile bio, and its image-heavy excess helped fill the " +
      "[[image-host-broken|broken-image graveyard]] when hosts shut down.",
    seeAlso: ["slashdot-frontpage", "fark-headline", "dreamcast-vmu"],
  },

  "phpbb-thread": {
    lead:
      "phpBB is a free, open-source forum package, released in 2000, that powered " +
      "countless online communities. A phpBB thread — a chronological tower of posts, " +
      "quotes, and signatures — was where much of the early social web actually " +
      "happened.",
    history:
      "phpBB boards hosted endless discussion and the [[forum-signature|signatures]] " +
      "below every post, in the same community sphere as the blog-diaries of " +
      "[[livejournal-entry|LiveJournal]] and [[xanga-diary|Xanga]]. Threads dissected " +
      "Flash hits like [[madness-combat|Madness Combat]] and re-hosted clips the way " +
      "[[numa-forum-mirror|the Numa forum mirror]] did, and a hot " +
      "[[guestbook|guestbook]] argument often spilled into a full thread.",
    legacy:
      "Self-hosted phpBB forums were the backbone of niche community for a decade " +
      "before Reddit and Discord, and their reply-quote-flame rhythm shaped online " +
      "discussion everywhere — from [[fark-headline|Fark]] to " +
      "[[slashdot-frontpage|Slashdot]].",
  },

  "livejournal-entry": {
    lead:
      "LiveJournal, launched in 1999, was a pioneering blogging and social-networking " +
      "platform built around the personal journal. Friends lists, mood icons, and " +
      "comment threads made it a confessional, tight-knit corner of the early social " +
      "web.",
    history:
      "LiveJournal sat alongside the diary site [[xanga-diary|Xanga]] and the forums of " +
      "[[phpbb-thread|phpBB]], sharing the era's appetite for public-private writing " +
      "and a good [[forum-signature|signature]]. Many users cross-posted to a " +
      "[[myspace-profile|Myspace profile]] and kept an [[aim-away-message|AIM]] window " +
      "open while writing.",
    legacy:
      "Its community features — the friends feed, the threaded comments — prefigured " +
      "modern social networks, and its fandom communities were hugely influential. A " +
      "later ownership change and move to Russian servers scattered its devoted base.",
  },

  "xanga-diary": {
    lead:
      "Xanga, launched in 1999, was a blogging service especially popular with teenagers " +
      "in the early 2000s. Its \"eProps\" and tight friend circles made keeping a Xanga " +
      "a small social ritual of school-era life online.",
    history:
      "Xanga was the close cousin of [[livejournal-entry|LiveJournal]] and fed the same " +
      "scene as the [[phpbb-thread|phpBB]] forums. Entries linked out to a " +
      "[[myspace-profile|Myspace profile]] and brimmed with the era's signature " +
      "[[top-eight-drama|friend-ranking drama]]. Pages were dressed up with the same " +
      "[[tiled-background|tiled backgrounds]] as a homemade homepage, often beside a " +
      "favorite Flash game like [[stick-rpg|Stick RPG]].",
    legacy:
      "Xanga's teen-diary culture captured a specific moment of growing up online just " +
      "before Facebook standardized everything. Its decline mirrored the broader " +
      "migration from personal blogs to centralized social feeds.",
  },

  "myspace-profile": {
    lead:
      "Myspace, launched in 2003, was the dominant social network of the mid-2000s, " +
      "famous for deeply customizable profiles. Pasting code to restyle your page — " +
      "and ranking your friends — made every profile a loud, personal statement.",
    history:
      "Myspace absorbed the energy of the blog era's [[livejournal-entry|LiveJournal]] " +
      "and [[xanga-diary|Xanga]], with profiles wallpapered in the same " +
      "[[tiled-background|tiled-background]] spirit and photos hosted on " +
      "[[photobucket-bucket|Photobucket]]. Pages auto-played clips like " +
      "[[numa-numa|Numa Numa]] or sprang a [[rickroll-redirect|Rickroll]], and users " +
      "kept up with [[club-penguin-plaza|Club Penguin]], [[msn-wink-vault|MSN " +
      "Messenger]], and a new [[motorola-razr|Razr]].",
    legacy:
      "Its infamous \"Top 8\" turned friendship into public hierarchy — the source of " +
      "endless [[top-eight-drama|Top 8 drama]] — and its customizable chaos is still " +
      "mourned. Facebook's clean uniformity ultimately won, but Myspace defined a " +
      "generation's first social-media home.",
  },

  "top-eight-drama": {
    lead:
      "The \"Top 8\" was a Myspace feature that displayed a user's eight closest " +
      "friends, ranked, on their profile. Who made the list — and in what order — " +
      "became a notorious source of social anxiety and genuine fallouts.",
    history:
      "Top 8 drama was a defining ritual of the [[myspace-profile|Myspace]] era, the " +
      "social-ranking sibling of the eProps and friend circles on " +
      "[[xanga-diary|Xanga]]. Slights played out in profile comments and in photos " +
      "hosted on [[photobucket-bucket|Photobucket]], and a falling-out could leave a " +
      "trail of [[image-host-broken|broken images]] where a friend's pictures used to " +
      "be. Status updates bled over to a new [[motorola-razr|Razr]].",
    legacy:
      "The Top 8 is remembered as a perfect, faintly ridiculous artifact of " +
      "mid-2000s online sociality — quantifying friendship in a way later networks " +
      "wisely (if blandly) abandoned.",
  },

  "photobucket-bucket": {
    lead:
      "Photobucket, launched in 2003, was a leading image-hosting service that let " +
      "users store pictures and hotlink them elsewhere. For years it was the invisible " +
      "engine behind images on forums, auctions, and profile pages across the web.",
    history:
      "Photobucket hosted the photos pasted onto a [[myspace-profile|Myspace profile]] " +
      "and the screenshots embedded across the web, from [[line-rider|Line Rider]] " +
      "tracks to reaction shots mirrored at [[numa-forum-mirror|the Numa forum]] and " +
      "the [[oolong-pancake-bunny|pancake bunny]]. It fed the " +
      "[[top-eight-drama|Top 8 drama]] and the news churn at " +
      "[[slashdot-frontpage|Slashdot]].",
    legacy:
      "In 2017 Photobucket abruptly began charging for hotlinking, instantly breaking " +
      "untold millions of embedded images across the web — a mass-extinction event " +
      "that swelled the [[image-host-broken|broken-image graveyard]] and a cautionary " +
      "tale about depending on a free host.",
  },

  "image-host-broken": {
    lead:
      "The broken-image graveyard is what remains when an image host shuts down or " +
      "starts blocking hotlinks: page after page of that tiny torn-paper \"missing " +
      "image\" icon where photos used to be. It is the visible scar tissue of the " +
      "decaying web.",
    history:
      "These dead embeds litter old [[forum-signature|forum signatures]], the comment " +
      "trails of [[top-eight-drama|Top 8 drama]], and posts that once leaned on " +
      "[[photobucket-bucket|Photobucket]]. Whole remix archives of " +
      "[[star-wars-kid|the Star Wars Kid]] rotted this way, and aggregators like " +
      "[[slashdot-frontpage|Slashdot]] and [[fark-headline|Fark]] are pocked with the " +
      "gaps — each a small [[four-oh-four-page|404]] of its own.",
    legacy:
      "The graveyard is a stark reminder of link rot and digital impermanence: the web " +
      "remembers far less than we assume, and a casual hotlink is a promise no free " +
      "service is obliged to keep.",
  },

  "slashdot-frontpage": {
    lead:
      "Slashdot, launched in 1997 under the tagline \"News for Nerds. Stuff that " +
      "Matters,\" was a hugely influential tech-news aggregator. Its user-submitted, " +
      "editor-curated front page and famous comment moderation shaped early online " +
      "discourse.",
    history:
      "Slashdot ran in the same news-and-discussion sphere as [[fark-headline|Fark]] " +
      "and the forums of [[phpbb-thread|phpBB]], with a comment culture every " +
      "[[forum-signature|signature]]-toting regular knew. Links it surfaced ranged " +
      "across the web, from old [[webring-hub|webrings]] to images on " +
      "[[photobucket-bucket|Photobucket]] and the gaps of the " +
      "[[image-host-broken|broken-image graveyard]].",
    legacy:
      "Being linked by Slashdot could crash a small server outright — the original " +
      "\"Slashdot effect,\" ancestor of being \"hugged to death.\" Its moderation " +
      "system influenced comment design across the internet for years to come.",
  },

  "fark-headline": {
    lead:
      "Fark, launched in 1999, is a news aggregator famous for its irreverent, pun-laden " +
      "user-submitted headlines and standardized tags like \"Florida\" and \"Obvious.\" " +
      "It turned the simple act of linking a news story into a comedy form.",
    history:
      "Fark shared the link-aggregator and comment scene with " +
      "[[slashdot-frontpage|Slashdot]] and the forums of [[phpbb-thread|phpBB]], full " +
      "of regulars with elaborate [[forum-signature|signatures]]. It thrived on viral " +
      "absurdities like [[dramatic-chipmunk|the Dramatic Chipmunk]], " +
      "[[end-of-ze-world|End of Ze World]], and a well-timed " +
      "[[keyboard-cat|Keyboard Cat]] play-off, and its photoshop contests churned out " +
      "images that ended up in the [[image-host-broken|broken-image graveyard]]. Its " +
      "ad-heavy pages were a [[popup-ad-alley|pop-up]] minefield.",
    legacy:
      "Fark's headline style seeped into how the whole internet writes for clicks, and " +
      "its community endured for decades — a living link back to the aggregator era " +
      "that predated the modern social feed.",
  },

  // ═══════════════════════════════ HAZARDS ═════════════════════════════════
  "popup-ad-alley": {
    lead:
      "The pop-up ad was a window that sprang open uninvited over (or under) the page " +
      "you were reading. In the early 2000s they multiplied into swarms that could " +
      "bury the desktop, becoming the most hated artifact of the commercial web.",
    history:
      "Pop-ups gushed from ad-heavy pages like [[fark-headline|Fark]] and from free " +
      "[[hit-counter|hit counters]], and rode in with nagware like the " +
      "[[realplayer-popup|RealPlayer]]. They flourished in " +
      "[[internet-explorer-six|Internet Explorer 6]] and traveled in the same bad " +
      "neighborhood as [[spyware-scan|spyware]] and the " +
      "[[download-button-decoy|fake download button]].",
    legacy:
      "Pop-ups grew so intolerable that the browser pop-up blocker became a headline " +
      "feature — one of the first great wins for users over advertisers. They survive " +
      "in spirit today wherever a [[flashpoint-archive|archived]] page or a " +
      "[[ruffle-emulator|Flash re-host]] dredges up the old layouts.",
    seeAlso: ["ruffle-emulator"],
  },

  "spyware-scan": {
    lead:
      "Spyware was software that secretly installed itself to track activity, serve " +
      "ads, and hijack settings — and the anxious, regular \"spyware scan\" with tools " +
      "like Ad-Aware or Spybot was a defining ritual of keeping a Windows PC alive in " +
      "the 2000s.",
    history:
      "Infections poured in with file-sharing apps like [[limewire-library|LimeWire]] " +
      "and [[kazaa-kiosk|KaZaA]], with desktop pests like " +
      "[[bonzibuddy-office|BonziBuddy]], and through the [[popup-ad-alley|pop-up]] and " +
      "[[download-button-decoy|fake-download]] gauntlet. A bad scan usually turned up a " +
      "teetering [[browser-toolbar-stack|stack of browser toolbars]] too.",
    legacy:
      "The spyware plague drove the rise of built-in OS protection and savvier users, " +
      "and weeding out a [[four-oh-four-page|dead]] or hijacked machine is a shared " +
      "memory of the era — the constant background tax of being online. Even a safe " +
      "[[ruffle-emulator|Flash re-host]] today carries a faint memory of those scare " +
      "pop-ups.",
  },

  "download-button-decoy": {
    lead:
      "The fake \"Download\" button was a deceptive ad designed to look like the real " +
      "download link on a page, tricking users into clicking it instead. It was a " +
      "small, daily act of digital trickery that everyone eventually learned to " +
      "second-guess.",
    history:
      "Decoy buttons swarmed the same pages as [[popup-ad-alley|pop-up ads]] and " +
      "[[spyware-scan|spyware]] installers, often gating a [[zip-file|ZIP download]] " +
      "behind a fake. They were close kin to the bait-and-switch " +
      "[[rickroll-redirect|Rickroll]] and the gotcha questions of " +
      "[[impossible-quiz|the Impossible Quiz]], and a wrong click often dumped you on " +
      "a [[four-oh-four-page|dead-end page]] — or worse.",
    legacy:
      "The fake download button trained a generation to read a page skeptically before " +
      "clicking, and the pattern survives wherever a [[captcha-goblin|verification " +
      "step]] or sketchy ad still tries to misdirect the unwary.",
  },

  "four-oh-four-page": {
    lead:
      "\"404 Not Found\" is the HTTP status code a server returns when a page doesn't " +
      "exist. The 404 page is the web's universal dead end — and, on the best sites, a " +
      "small canvas for a creative apology.",
    history:
      "A 404 is where broken links land: a vanished [[webring-hub|webring]] member, a " +
      "missing image in the [[image-host-broken|graveyard]], a deleted file once " +
      "stored on a [[floppy-disk|floppy disk]]. They lurk near the web's hazards — the " +
      "[[spyware-scan|spyware]] traps, the [[download-button-decoy|fake buttons]], the " +
      "[[captcha-goblin|CAPTCHA gates]] — and a forgotten " +
      "[[under-construction|under-construction]] page often decayed into one. The " +
      "occasional [[chain-email|chain-mail]] link led nowhere too.",
    legacy:
      "The 404 became a beloved canvas for creativity and humor, and \"throwing a 404\" " +
      "entered everyday slang for something gone missing — the most famous error " +
      "message ever written.",
  },

  "captcha-goblin": {
    lead:
      "A CAPTCHA is the challenge — warped letters, picking out crosswalks — that asks " +
      "you to prove you are human before proceeding. Designed to keep bots out, it " +
      "doubled as a small, recurring toll on everyone's patience.",
    history:
      "CAPTCHAs were posted at the gates the spammers attacked: the comment field of a " +
      "[[guestbook|guestbook]], the sign-up forms behind the " +
      "[[download-button-decoy|fake download button]], and the dead-link mazes near a " +
      "[[four-oh-four-page|404 page]]. Beating one had the same gotcha flavor as " +
      "[[impossible-quiz|the Impossible Quiz]], and bots tried to slip past with " +
      "[[chain-email|chain-mail]] spam and even glittery " +
      "[[dancing-cursor-trail|cursor-trail]] junk.",
    legacy:
      "CAPTCHAs grew steadily harder as bots got smarter, evolving into invisible " +
      "behavioral checks — an escalating, never-ending arms race that quietly shapes " +
      "the modern web every time you click \"I'm not a robot.\"",
  },

  "chain-email": {
    lead:
      "The chain email was a message that urged you to forward it to everyone you knew — " +
      "promising luck, threatening doom, or spreading a hoax. It was the early " +
      "internet's most persistent form of viral, well-meaning noise.",
    history:
      "Chain mail clogged inboxes harvested from the [[email-me-gif|\"email me\" " +
      "graphics]] on personal pages, and its forwarded payloads included early memes " +
      "like the [[dancing-baby|Dancing Baby]]. Its junk-and-hoax energy linked it to " +
      "the [[captcha-goblin|CAPTCHA]]-defeating spammers, the spam that drowned a " +
      "[[guestbook|guestbook]], the dead links of a [[four-oh-four-page|404]], and the " +
      "[[browser-toolbar-stack|toolbar]] and [[dancing-cursor-trail|cursor-trail]] " +
      "clutter of the age.",
    legacy:
      "Chain letters mutated into modern spam, phishing, and social-media hoaxes — the " +
      "same forward-this-or-else mechanics dressed in new clothes. The instinct it " +
      "exploited, to pass along a warning just in case, never went away.",
  },

  "dancing-cursor-trail": {
    lead:
      "The cursor trail was a JavaScript effect that made sparkles, stars, or little " +
      "images follow your mouse pointer around a webpage. Pure decorative excess, it " +
      "was a hallmark of the personalized — and performance-sapping — early web.",
    history:
      "Cursor trails glittered across homemade pages beside the scrolling " +
      "[[marquee-museum|marquee]] and over busy [[tiled-background|tiled backgrounds]]. " +
      "As an often-unwanted script it kept company with the web's other nuisances — " +
      "the [[captcha-goblin|CAPTCHA]] gate, [[chain-email|chain mail]], and the " +
      "[[browser-toolbar-stack|toolbar]] clutter — and the gaudiest examples even " +
      "showed up dressed as [[flashpoint-archive|archived]] curiosities.",
    legacy:
      "Cursor trails are now a quintessential \"old web\" novelty, lovingly recreated " +
      "in retro-style projects as shorthand for an era when a webpage could be as " +
      "personal — and as gloriously impractical — as you liked.",
  },

  "browser-toolbar-stack": {
    lead:
      "The browser toolbar stack is the tragicomic sight of a web browser whose " +
      "viewing area has been squeezed to a sliver by row upon row of unwanted " +
      "toolbars — Ask, Yahoo, a dozen others — each silently installed by some other " +
      "program.",
    history:
      "Toolbars piled up from bundled installers: file-sharing apps like " +
      "[[kazaa-kiosk|KaZaA]], desktop pests like [[bonzibuddy-office|BonziBuddy]], and " +
      "anything that arrived with [[spyware-scan|spyware]] or a " +
      "[[chain-email|chain-mail]] link. They infested " +
      "[[internet-explorer-six|Internet Explorer 6]] and traveled with the " +
      "[[dancing-cursor-trail|cursor-trail]] junk and stray " +
      "[[ruffle-emulator|Flash re-hosts]] of the day.",
    legacy:
      "The toolbar stack is the perfect visual symbol of the bloated, hijacked " +
      "mid-2000s PC, and the cleanup against it pushed browsers toward the locked-down " +
      "extension models that protect users now — a relative of every " +
      "[[flashpoint-archive|preservation]] effort to make the old web safe to revisit.",
  },

  "flashpoint-archive": {
    lead:
      "Flashpoint is a vast preservation project, begun in 2018, that archives tens of " +
      "thousands of Flash games and animations so they remain playable after browsers " +
      "dropped the plugin. Tucked in its vault is {{relic}}[[#|one perfectly preserved " +
      "file]] of nearly every web game ever made.",
    history:
      "Flashpoint exists to rescue the [[swf-file|SWF files]] behind the portal at " +
      "[[newgrounds-portal|Newgrounds]] and hits like " +
      "[[fancy-pants-adventure|Fancy Pants Adventure]], plus beloved animations like " +
      "[[badger-badger-badger|Badger Badger Badger]] and " +
      "[[end-of-ze-world|End of Ze World]]. It works hand in hand with the " +
      "[[ruffle-emulator|Ruffle emulator]], and even archives the gaudy hazards — the " +
      "[[popup-ad-alley|pop-up]] layouts, the [[dancing-cursor-trail|cursor trails]], " +
      "the [[browser-toolbar-stack|toolbar]] crud — for the full period picture.",
    legacy:
      "When Adobe killed Flash in 2020, Flashpoint became a digital ark, saving a " +
      "decade of interactive culture from total loss — one of the most important " +
      "preservation efforts the web has produced.",
  },

  "ruffle-emulator": {
    lead:
      "Ruffle is an open-source emulator that runs old Flash content natively in a " +
      "modern browser, without the discontinued Adobe plugin. It is the technology " +
      "that lets a dead format keep playing on the living web.",
    history:
      "Ruffle is the engine behind preservation work like the " +
      "[[flashpoint-archive|Flashpoint archive]], reviving the [[swf-file|SWF files]] " +
      "that powered [[newgrounds-portal|Newgrounds]] — which adopted Ruffle to keep its " +
      "own back-catalogue alive. Re-hosting those old games sometimes drags along the " +
      "era's hazards: a vintage [[popup-ad-alley|pop-up]] layout, a leftover " +
      "[[spyware-scan|spyware]] scare, or a [[browser-toolbar-stack|toolbar]]-choked " +
      "screenshot.",
    legacy:
      "By translating Flash into modern web standards, Ruffle ensures that a generation " +
      "of games and animations is not lost to a single corporate end-of-life date — " +
      "preservation as a public good, keeping the old internet explorable.",
  },
};

