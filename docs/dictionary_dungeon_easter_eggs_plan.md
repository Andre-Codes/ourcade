# Dictionary Dungeon — Starting Secrets & First-Word Title Design Doc

## 1. Feature summary

The first room of a run can secretly recognize certain player word choices and assign flavor-only identity markers.

The system has three layers:

```text
First valid word → RPG Title
Early word behavior → Secret Omen / Badge
Starting level text → Flavor reaction
```

The goal is to make the beginning of a run feel like a lightweight RPG character creation moment without adding balance problems.

---

# 2. Design goals

## Primary goals

* Add surprise and personality.
* Encourage replay and experimentation.
* Create shareable “I found a secret” moments.
* Make the dungeon feel reactive.
* Support RPG/Zork flavor without requiring graphics or complex systems.

## Non-goals

* Do not create optimal starting words.
* Do not affect leaderboard fairness.
* Do not add major mechanical perks.
* Do not require players to know the secrets.
* Do not punish players who ignore the system.

---

# 3. Core rule

## Daily mode

Starting secrets should be:

```text
Cosmetic only.
```

Allowed rewards:

* title
* badge
* omen
* alternate room text
* run recap callout
* small achievement unlock
* special log line

Avoid:

* extra hearts
* free scrolls
* free relics
* damage bonuses
* mistake forgiveness
* healing
* major coin rewards

## Practice mode

Practice mode may optionally allow tiny perks later, but the MVP should keep everything cosmetic everywhere.

---

# 4. System layers

## Layer 1: First-word title

The player’s **first valid submitted word** is checked against a title map.

Example:

```text
First word: WIZARD
Title gained: Ink Wizard
```

This is the identity layer.

## Layer 2: Starting secret triggers

The game checks the player’s first few valid words for hidden patterns.

Example:

```text
First words: FIGHTER → THIEF → CLERIC → WIZARD
Secret badge: Full Party Assembled
```

This is the discovery layer.

## Layer 3: Flavor reaction

The starting level reacts with text.

Example:

```text
The torches flare blue for the Ink Wizard.
Somewhere in the wall, a goblin applauds your party formation.
```

This is the immersion layer.

---

# 5. Trigger timing

Use the first few valid words only.

Recommended window:

```text
First 1–4 valid words of the run
```

Why:

* Keeps the secret tied to “character creation.”
* Prevents the whole game from becoming secret-trigger soup.
* Makes the opening feel special.
* Easier to implement and test.

Suggested trigger checks:

| Check                  | Timing                  |
| ---------------------- | ----------------------- |
| First-word title       | after first valid word  |
| First-word omen        | after first valid word  |
| Two-word secret        | after second valid word |
| Three-word secret      | after third valid word  |
| Four-word party secret | after fourth valid word |
| Starting-level recap   | after leaving Level 1   |

---

# 6. Priority rules

A first word may match multiple systems.

Example:

```text
PALADIN
```

Could be:

* RPG title word
* holy archetype
* long word
* contains repeated? no
* starts with P

To avoid clutter, use priority.

## Recommended priority

```text
1. First-word RPG Title
2. Exact secret phrase or sequence
3. Rare/obscure word omen
4. Structural omen
5. Polite/funny word omen
6. Generic fallback
```

The player can receive:

* one title
* up to two starting omens/badges
* multiple hidden log reactions, if subtle

Do not spam the player with five unlock popups.

---

# 7. UI behavior


## First title reveal



Show a small special message after the first recognized word.

```text
The dungeon remembers your first word.

You are named:
INK WIZARD
```

Persistent Title UI Element

The player’s title should not only appear at reveal—it should persist throughout the run as a distinctive, always-visible identity marker.

Design concept

Create a Title Banner UI element that feels like a character nameplate in an RPG, but styled to match the dungeon’s tone.

## Secret badge reveal

Use a smaller treatment.

```text
Secret found:
FULL PARTY ASSEMBLED
```

## Run recap

At the end of the run, show identity markers.

```text
Title: Ink Wizard
Omen: Mirror-Touched
Badge: Full Party Assembled
Rarest Word: XYLYL
```

This makes secrets feel collectible without affecting play.

---

# 8. Data model

## First-word title map

```ts
type FirstWordTitle = {
  word: string;
  title: string;
  category: "class" | "race" | "monster" | "royalty" | "profession" | "mythic" | "adventurer";
  revealText?: string;
};
```

## Secret trigger

```ts
type StartingSecret = {
  id: string;
  name: string;
  triggerType:
    | "first_word_exact"
    | "first_word_category"
    | "word_sequence"
    | "word_pair"
    | "structural_pattern"
    | "rarity_pattern"
    | "theme_resonance";
  timingWindow: 1 | 2 | 3 | 4;
  conditions: unknown;
  resultType: "omen" | "badge" | "flavor";
  resultName: string;
  resultText: string;
  maxPerRun?: number;
  dailyLeaderboardSafe: true;
};
```

---

# 9. First-word RPG title list

These trigger only if the player’s first valid word exactly matches the listed word.

Normalize input before checking:

```text
lowercase
trim whitespace
singular/plural rules optional
```

For MVP, use exact singular matching first.

---

## Class titles

| First word  | Title                  |
| ----------- | ---------------------- |
| WIZARD      | Ink Wizard             |
| MAGE        | Page Mage              |
| SORCERER    | Spellbound Sorcerer    |
| WARLOCK     | Glyph Warlock          |
| WITCH       | Vowel Witch            |
| CLERIC      | Page Cleric            |
| PRIEST      | Archive Priest         |
| PALADIN     | Oath Paladin           |
| DRUID       | Root Druid             |
| SHAMAN      | Rune Shaman            |
| NECROMANCER | Deadword Necromancer   |
| ENCHANTER   | Lexicon Enchanter      |
| ALCHEMIST   | Syllable Alchemist     |
| ORACLE      | Oracle of Ink          |
| SEER        | Candlelit Seer         |
| BARD        | Dungeon Bard           |
| MINSTREL    | Minstrel of Margins    |
| ROGUE       | Letter Rogue           |
| THIEF       | Quiet Thief            |
| ASSASSIN    | Silent Syllable        |
| NINJA       | Shadow Scribe          |
| RANGER      | Lexicon Ranger         |
| HUNTER      | Word Hunter            |
| ARCHER      | Quill Archer           |
| SCOUT       | Mapless Scout          |
| KNIGHT      | Vowel Knight           |
| WARRIOR     | Word Warrior           |
| FIGHTER     | Ink Fighter            |
| BARBARIAN   | Margin Barbarian       |
| BERSERKER   | Berserker of Books     |
| MONK        | Silent Monk            |
| SAMURAI     | Blade Scribe           |
| GLADIATOR   | Arena Grammarian       |
| MERCENARY   | Coinblade Mercenary    |
| SOLDIER     | Sentence Soldier       |
| DUELIST     | Duelist of Definitions |
| SPELLBLADE  | Spellblade Scribe      |
| TEMPLAR     | Templar of Text        |
| WARDEN      | Door Warden            |
| SENTINEL    | Silent Sentinel        |
| GUARDIAN    | Gate Guardian          |
| CHAMPION    | Champion of Chapters   |
| HERO        | Firstword Hero         |

---

## Fantasy race titles

| First word | Title              |
| ---------- | ------------------ |
| ELF        | Glossary Elf       |
| DWARF      | Stone Dwarf        |
| ORC        | Word Orc           |
| GOBLIN     | Footnote Goblin    |
| TROLL      | Bridge Troll       |
| GNOME      | Index Gnome        |
| HALFLING   | Hearth Halfling    |
| HOBBIT     | Pantry Pilgrim     |
| FAIRY      | Marginal Fairy     |
| SPRITE     | Ink Sprite         |
| PIXIE      | Punctuation Pixie  |
| GIANT      | Tower Giant        |
| OGRE       | Blunt Ogre         |
| HUMAN      | Plainspoken Human  |
| NYMPH      | Willow Nymph       |
| SATYR      | Laughing Satyr     |
| DRYAD      | Rootbound Dryad    |
| MERFOLK    | Tidebound Merfolk  |
| MERMAID    | Tidebound Mermaid  |
| SIREN      | Singing Siren      |
| CENTAUR    | Centaur of Stanzas |
| KOBOLD     | Candle Kobold      |
| IMP        | Margin Imp         |
| GREMLIN    | Gremlin of Grammar |
| FAUN       | Footnote Faun      |

---

## Monster and undead titles

| First word | Title               |
| ---------- | ------------------- |
| DRAGON     | Dictionary Dragon   |
| DEMON      | Red Ink Demon       |
| ANGEL      | Golden Gloss Angel  |
| DEVIL      | Contract Devil      |
| VAMPIRE    | Redacted Vampire    |
| WEREWOLF   | Moonlit Werewolf    |
| SKELETON   | Bone Scribe         |
| ZOMBIE     | Dead Letter         |
| GHOST      | Whispering Ghost    |
| LICH       | Unabridged Lich     |
| GOLEM      | Stonebound Golem    |
| PHOENIX    | Ashword Phoenix     |
| HYDRA      | Many-Headed Reader  |
| MINOTAUR   | Maze Minotaur       |
| CYCLOPS    | One-Eyed Editor     |
| CHIMERA    | Patchwork Chimera   |
| BASILISK   | Basilisk of Blanks  |
| GARGOYLE   | Gargoyle of Grammar |
| WRAITH     | Hollow Wraith       |
| SHADE      | Margin Shade        |
| SPECTER    | Specter of Syntax   |
| MUMMY      | Wrapped Mummy       |
| SLIME      | Greenroom Slime     |
| MIMIC      | Chest Mimic         |
| BEHOLDER   | One-Eyed Beholder   |
| KRAKEN     | Kraken of Clauses   |
| HARPY      | Harpy of Hyphens    |
| WYVERN     | Wyvern of Words     |
| SPHINX     | Riddle Sphinx       |

---

## Royalty and nobility titles

| First word | Title                   |
| ---------- | ----------------------- |
| KING       | Lexicon King            |
| QUEEN      | Marginal Queen          |
| PRINCE     | Page Prince             |
| PRINCESS   | Lantern Princess        |
| EMPEROR    | Emperor of Entries      |
| EMPRESS    | Empress of Ink          |
| LORD       | Lord of Letters         |
| LADY       | Lady of Lines           |
| BARON      | Baron of Banned Letters |
| BARONESS   | Baroness of Blanks      |
| DUKE       | Duke of Diction         |
| DUCHESS    | Duchess of Definitions  |
| COUNT      | Count of Clauses        |
| COUNTESS   | Countess of Commas      |
| EARL       | Earl of Echoes          |
| HEIR       | Heir of Ink             |
| REGENT     | Regent of Runes         |
| NOBLE      | Noble of Names          |
| SQUIRE     | Squire of Scrolls       |
| JESTER     | Jester of Jargon        |
| FOOL       | Blessed Fool            |

---

## Scholar, book, and dungeon-adjacent titles

| First word   | Title                  |
| ------------ | ---------------------- |
| SAGE         | Dusty Sage             |
| SCHOLAR      | Candle Scholar         |
| SCRIBE       | Dungeon Scribe         |
| LIBRARIAN    | Forbidden Librarian    |
| CARTOGRAPHER | Mapmaker of Margins    |
| EXPLORER     | Crypt Explorer         |
| ADVENTURER   | Lantern Adventurer     |
| PILGRIM      | Paper Pilgrim          |
| WANDERER     | Wandering Word         |
| NOMAD        | Nomad of Names         |
| HERMIT       | Hermit of Footnotes    |
| APPRENTICE   | Apprentice of Ink      |
| MASTER       | Master of Margins      |
| STUDENT      | Student of Spells      |
| PROFESSOR    | Professor of Pages     |
| KEEPER       | Keeper of Keys         |
| CURATOR      | Curator of Curses      |
| ARCHIVIST    | Archivist of Ash       |
| EDITOR       | Editor of Echoes       |
| READER       | Reader of Runes        |
| AUTHOR       | Author of Omens        |
| POET         | Poet of Portals        |
| PROPHET      | Prophet of Pages       |
| HERALD       | Herald of Hidden Doors |
| MESSENGER    | Messenger of Margins   |

---

## Adventuring and pirate titles

| First word | Title                 |
| ---------- | --------------------- |
| PIRATE     | Plunderquill Pirate   |
| CAPTAIN    | Captain of Clauses    |
| SAILOR     | Sailor of Scrolls     |
| RAIDER     | Raider of Runes       |
| BANDIT     | Bandit of Blanks      |
| OUTLAW     | Outlaw of Ink         |
| VAGABOND   | Vagabond of Vowels    |
| TRAVELER   | Traveler of Text      |
| SEEKER     | Seeker of Syllables   |
| DELVER     | Dungeon Delver        |
| SPELUNKER  | Spelunker of Spelling |
| MARINER    | Mariner of Margins    |
| CORSAIR    | Corsair of Commas     |
| BUCCANEER  | Buccaneer of Books    |
| PATHFINDER | Pathfinder of Pages   |

---

# 10. Additional starting secrets

These are separate from RPG titles. They can combine with a title.

Example final identity:

```text
Title: Ink Wizard
Omen: Mirror-Touched
Badge: Full Party Assembled
```

---

## Exact first-word omens

| Trigger               | Result type | Result name         | Result text                                        |
| --------------------- | ----------- | ------------------- | -------------------------------------------------- |
| First word is ZORK    | Omen        | Old Lantern Lit     | The dungeon briefly forgets it is modern.          |
| First word is HELLO   | Omen        | The Dungeon Answers | Something behind the wall says hello back.         |
| First word is PLEASE  | Omen        | Polite Delver       | The door appreciates your manners. Suspiciously.   |
| First word is THANKS  | Omen        | Grateful Guest      | The dungeon accepts gratitude as legal tender.     |
| First word is DOOM    | Omen        | Bad Omen            | The torches lean away from you.                    |
| First word is DEATH   | Omen        | Cheerful Start      | The dungeon underlines your optimism.              |
| First word is CURSE   | Omen        | Marked in Red       | Your name appears briefly in the margin.           |
| First word is GOLD    | Omen        | Treasure-Sniffer    | A coin coughs somewhere in the dark.               |
| First word is COIN    | Omen        | Pocket Prophet      | The dungeon suspects you are here for the economy. |
| First word is CHEST   | Omen        | Box Thinker         | Every chest in the dungeon feels judged.           |
| First word is BOOK    | Omen        | Book-Touched        | The shelves rustle like they recognize you.        |
| First word is PAGE    | Omen        | Pagebound           | One loose page follows you for a while.            |
| First word is INK     | Omen        | Inkmarked           | Your word stains the air before fading.            |
| First word is QUILL   | Omen        | Quillbearer         | An invisible pen scratches your name into the run. |
| First word is DOOR    | Omen        | Knockless Entry     | The first door takes this personally.              |
| First word is KEY     | Omen        | Keydreamer          | A keyhole blinks open, then pretends it did not.   |
| First word is DUNGEON | Omen        | Too Direct          | The dungeon seems flattered by the mention.        |
| First word is MONSTER | Omen        | Creature Caller     | Something with too many syllables notices you.     |

---

## First-word structural secrets

| Trigger                                                     | Result type | Result name       | Result text                                            |
| ----------------------------------------------------------- | ----------- | ----------------- | ------------------------------------------------------ |
| First word is a palindrome, e.g. LEVEL, ROTOR, CIVIC        | Omen        | Mirror-Touched    | The room folds in half and matches itself.             |
| First word has no A/E/I/O/U, e.g. CRYPT, GLYPH, MYTH        | Omen        | Silent Initiate   | The vowels go quiet in your presence.                  |
| First word contains X, Z, Q, or J and is outside Google 10k | Omen        | Goblin-Approved   | A goblin writes “real word??” beside your name.        |
| First word has 8+ letters                                   | Omen        | Longblade Opening | Your first word arrives carrying its own shadow.       |
| First word has exactly 3 letters                            | Omen        | Small Key         | A tiny word opens a tiny lock.                         |
| First word has double letters, e.g. BOOK, SPELL, ROOM       | Omen        | Echo Mark         | One letter repeats itself from the rafters.            |
| First word uses 6+ unique letters                           | Omen        | Wide Step         | The alphabet gives you a little more room.             |
| First word starts and ends with same letter                 | Omen        | Closed Loop       | The dungeon notices your word came back home.          |
| First word is all common letters, no rare letters           | Omen        | Plainspoken       | The room relaxes. This is usually unwise.              |
| First word contains all five vowels                         | Omen        | Vowel Feast       | The Vowel Crypt, somewhere far below, wakes up hungry. |

---

## Two-word secrets

| Trigger             | Result type | Result name          | Result text                                   |
| ------------------- | ----------- | -------------------- | --------------------------------------------- |
| SWORD → SHIELD      | Badge       | Armed Adventurer     | The dungeon recognizes a classic loadout.     |
| BOW → ARROW         | Badge       | Straight Shot        | A painted arrow on the wall points deeper.    |
| STAFF → SPELL       | Badge       | Proper Caster        | The spellbook nods approvingly.               |
| DAGGER → CLOAK      | Badge       | Back Alley Grammar   | A shadow in the margin gives a thumbs-up.     |
| BOOK → CANDLE       | Badge       | Late Reader          | The dungeon lowers the lights for study.      |
| INK → QUILL         | Badge       | Ready to Write       | The next page is afraid of you.               |
| LOCK → KEY          | Badge       | Obvious Solution     | The door hates how effective that was.        |
| LIVE → EVIL         | Badge       | Mirror Knock         | A mirror opens one eye.                       |
| STRESSED → DESSERTS | Badge       | Mirror Knock         | Somewhere, a cursed bakery becomes relevant.  |
| ANGEL → DEMON       | Badge       | Balanced Ledger      | The dungeon records both sides.               |
| SUN → MOON          | Badge       | Day-Night Pact       | A cold light crosses the floor.               |
| FIRE → ICE          | Badge       | Element Split        | The torches freeze for one second.            |
| KING → QUEEN        | Badge       | Royal Pair           | Two crowns appear in the dust.                |
| ORC → ELF           | Badge       | Awkward Alliance     | The dungeon braces for party drama.           |
| RAT → BAT           | Badge       | Small Monsters       | Something squeaks in stereo.                  |
| GOLD → DRAGON       | Badge       | Bad Treasure Sense   | The dungeon appreciates your genre literacy.  |
| HELLO → DOOR        | Badge       | Conversational Entry | The door considers answering.                 |
| PLEASE → OPEN       | Badge       | Polite Knock         | The door almost feels bad about being locked. |
| DARK → LIGHT        | Badge       | Lantern Logic        | The shadows make room.                        |
| LOST → FOUND        | Badge       | Mapless Miracle      | A blank map draws one confident line.         |

---

## Three-word secrets

| Trigger                                                            | Result type | Result name         | Result text                                                  |
| ------------------------------------------------------------------ | ----------- | ------------------- | ------------------------------------------------------------ |
| First 3 valid words start with consecutive letters, e.g. B → C → D | Badge       | Ordered Steps       | The alphabet accepts your tribute.                           |
| First 3 valid words start with the same letter                     | Badge       | Rune Repeater       | The same initial scratches itself into the wall three times. |
| First 3 valid words end with the same letter                       | Badge       | Tail Echo           | The endings keep following you.                              |
| First 3 words are all 5 letters long                               | Badge       | Measured Pace       | The dungeon respects your symmetry.                          |
| First 3 words strictly increase in length                          | Badge       | Growing Incantation | Each word stands taller than the last.                       |
| First 3 words strictly decrease in length                          | Badge       | Shrinking Spell     | Your words vanish down a staircase of size.                  |
| First 3 words use 15+ unique letters total                         | Badge       | Wide Vocabulary     | The alphabet has to stretch.                                 |
| First 3 words contain no repeated letters internally               | Badge       | Clean Script        | No letter steps on another letter’s toes.                    |
| First 3 words are all common top-2000 words                        | Badge       | Common Tongue       | The dungeon understands you immediately.                     |
| First 3 words are all outside Google 10k                           | Badge       | Goblin Fluency      | The goblins whisper: “one of us.”                            |
| HELLO → DARK → DOOR                                                | Badge       | The Dungeon Answers | Something behind the third word knocks back.                 |
| BOOK → INK → QUILL                                                 | Badge       | Scribe’s Kit        | A blank page follows you like a familiar.                    |
| SWORD → SPELL → SHIELD                                             | Badge       | Balanced Adventurer | Martial, magical, and mildly overprepared.                   |
| RAT → BAT → CAT                                                    | Badge       | Tiny Bestiary       | The dungeon starts with the small problems.                  |
| SUN → MOON → STAR                                                  | Badge       | Sky Sequence        | The ceiling briefly remembers being outside.                 |
| RED → BLUE → GREEN                                                 | Badge       | Color Crawl         | The walls test their palette.                                |
| ONE → TWO → THREE                                                  | Badge       | Counting Charm      | The dungeon can count. This is bad news.                     |
| EAST → WEST → NORTH                                                | Badge       | Bad Compass         | The map sighs audibly.                                       |
| ASH → BONE → DUST                                                  | Badge       | Grave Grammar       | The floor becomes very interested in your boots.             |
| GOLD → GEM → CROWN                                                 | Badge       | Loot Brain          | The treasure chest pretends not to notice.                   |

---

## Four-word party secrets

These are harder to discover and should feel like real easter eggs.

| Trigger                            | Result type | Result name          | Result text                                 |
| ---------------------------------- | ----------- | -------------------- | ------------------------------------------- |
| FIGHTER → THIEF → CLERIC → WIZARD  | Badge       | Full Party Assembled | The dungeon recognizes an old formation.    |
| WARRIOR → ROGUE → PRIEST → MAGE    | Badge       | Balanced Party       | Four shadows join yours, briefly.           |
| KNIGHT → RANGER → CLERIC → WITCH   | Badge       | Strange Fellowship   | The torches argue about who leads.          |
| BARD → BARBARIAN → DRUID → PALADIN | Badge       | Tavern Party         | Somewhere, a quest was accepted too loudly. |
| ELF → DWARF → ORC → HUMAN          | Badge       | Awkward Alliance     | The dungeon prepares extra chairs.          |
| GOBLIN → TROLL → OGRE → GIANT      | Badge       | Monster March        | The floorboards complain about escalation.  |
| KING → QUEEN → PRINCE → PRINCESS   | Badge       | Royal Court          | A tiny crown appears over the room title.   |
| BOOK → CANDLE → INK → QUILL        | Badge       | Scribe’s Table       | The room becomes a desk for one heartbeat.  |
| SWORD → SHIELD → BOW → STAFF       | Badge       | Armory Opened        | The wall inventories your intentions.       |
| FIRE → WATER → EARTH → AIR         | Badge       | Elemental Order      | Four old symbols turn once in the dark.     |
| SUN → MOON → STAR → VOID           | Badge       | Skyfall Omen         | The ceiling goes deeper than expected.      |
| LOCK → KEY → DOOR → OPEN           | Badge       | Dungeon Logic        | The door hates that this worked in order.   |

---

## Theme resonance secrets

These should depend on the starting level theme or first level role.

| Starting theme   | Trigger                                                           | Result type | Result name       | Result text                                                 |
| ---------------- | ----------------------------------------------------------------- | ----------- | ----------------- | ----------------------------------------------------------- |
| Entry Hall       | First word is DOOR, KEY, LOCK, OPEN, GATE                         | Omen        | Threshold-Touched | The entrance recognizes entrance vocabulary.                |
| Entry Hall       | First 3 words are exploration words: MAP, PATH, TORCH, ROOM, DOOR | Badge       | Proper Delver     | You seem to know how dungeons work. Suspicious.             |
| Vowel Crypt      | First word has exactly one vowel                                  | Omen        | Crypt Hums Back   | One vowel echoes through the stone.                         |
| Vowel Crypt      | First word has no standard vowels                                 | Omen        | Vowelless Visitor | The crypt goes silent out of respect.                       |
| Vowel Crypt      | First 3 words each use a different main vowel                     | Badge       | Vowel Pilgrim     | The vowels take turns haunting you.                         |
| Consonant Chapel | First word has 5+ consonants                                      | Omen        | Hard Sound        | The chapel clicks its teeth.                                |
| Consonant Chapel | First 3 words start with consonants                               | Badge       | Chapel Knock      | Three consonants rap on the pews.                           |
| Goblin Library   | First word is obscure ENABLE but not Google 10k                   | Omen        | Footnote Friend   | A goblin librarian stamps your word upside down.            |
| Goblin Library   | First 3 words are all obscure                                     | Badge       | Goblin Fluency    | The card catalog starts sweating.                           |
| Forgotten Index  | First word starts with X, Z, Q, or J                              | Omen        | Rare Index        | A neglected drawer slides open.                             |
| Cursed Stacks    | First word contains no E                                          | Omen        | Redaction-Ready   | The most common letter fails to appear. The stacks approve. |
| Mirror Archive   | First word is palindrome or two-word mirror pair                  | Omen        | Mirror-Touched    | Your reflection submits a word too.                         |
| Final Lexicon    | First word is WORD, TEXT, INK, PAGE, BOOK                         | Omen        | Lexicon-Known     | The final book writes your name early.                      |

---

## Hidden “bad idea” omens

These are funny but harmless.

| Trigger            | Result type | Result name         | Result text                                  |
| ------------------ | ----------- | ------------------- | -------------------------------------------- |
| First word is TRAP | Omen        | Trap Caller         | A trap somewhere takes attendance.           |
| First word is BOSS | Omen        | Ambitious           | The dungeon admires your impatience.         |
| First word is LOOT | Omen        | Priorities          | The treasure chest nods approvingly.         |
| First word is RUN  | Omen        | Reasonable Instinct | The exit politely pretends not to hear.      |
| First word is HELP | Omen        | Help Requested      | The dungeon marks your request as pending.   |
| First word is NOPE | Omen        | Sensible Delver     | The first room respects boundary-setting.    |
| First word is EASY | Omen        | Famous Last Word    | The dungeon writes that down.                |
| First word is HARD | Omen        | Tempting Fate       | The walls become slightly more smug.         |
| First word is QUIT | Omen        | Early Honesty       | The dungeon appreciates clear communication. |
| First word is DEAD | Omen        | Premature Epitaph   | Your tombstone briefly loads in draft mode.  |

---

# 11. Combining titles and secrets

## Good combined output

```text
The dungeon remembers your first word.

You are named:
INK WIZARD

Secret omen:
MIRROR-TOUCHED
```

## Better if spaced out

Avoid revealing everything at once. Let the title reveal first, then the secret reveal after the next action.

Example:

```text
After first word:
You are named: INK WIZARD

After second word:
A mirror opens one eye.
Secret found: MIRROR KNOCK
```

This feels less like a debug log.

---

# 12. Run recap display

At the end of the run:

```text
Run Identity
Title: Ink Wizard
Omen: Mirror-Touched
Badge: Full Party Assembled
First Word: WIZARD
Best Word: BLAZE
Rarest Word: XYLYL
```

If no secrets found:

```text
Title: Unnamed Delver
Omen: None
```

# 14. Discovery philosophy

Do not show a complete list of secrets in-game.

Instead, show:

```text
Starting secrets discovered: 3 / ???
```

Maybe show discovered ones in a “Glossary of Omens.”

This lets players share discoveries without the game becoming a checklist too quickly.

---

# 15. Anti-meta rules

To prevent the feature from becoming stale:

## Rule 1: No power rewards

Titles and secrets do not affect run strength.

## Rule 2: Do not include starting title in score formula

No bonus points for choosing WIZARD.

## Rule 3: Do not make one title look “best”

Avoid rarity labels like legendary/epic for starting titles.

## Rule 4: Limit visible unlocks per run

Max:

```text
1 title
2 omens/badges
```

## Rule 5: Allow hidden repeats, but only first discovery matters

If a player repeats WIZARD every day, they can get Ink Wizard again, but the discovery is only new once.

