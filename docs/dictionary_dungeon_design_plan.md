# Dictionary Dungeon — Fuller Design Plan

## 1. Core concept

**Dictionary Dungeon** is a fixed-level text adventure roguelike word game.

The feel:

> **Zork’s room descriptions** + **Slay the Spire-style choices** + **Boggle/Wordle-adjacent word validation**.

The player explores a dungeon by typing valid words. Words unlock doors, damage enemies, disarm traps, activate relics, and solve magical constraints.

The game is not “make as many words as possible.”
It is:

> “Can you survive a weird dungeon where language is the weapon?”

---

# 2. Target experience

## Session length

Aim for a full run to last:

> **15–20 minutes**

That is long enough to feel like a real game, but short enough for an Ourcade daily/arcade experience.

## Core promise

Each run should create moments like:

* “Wait, that’s a real word?”
* “I could play a safe common word, or risk a rare one.”
* “This room changed how I think about the letters.”
* “I barely beat the boss with some goblin nonsense word.”

That last one is the juice.

---

# 3. Overall structure

Use **fixed levels**, not endless survival.

Recommended structure:

| Section                      |                 Rooms | Target time |
| ---------------------------- | --------------------: | ----------: |
| Level 1: Entry Hall          |   4 rooms + mini-boss |       3 min |
| Level 2: Vowel Crypt         |       4 rooms + event |       3 min |
| Level 3: Goblin Library      |   5 rooms + mini-boss |       4 min |
| Level 4: Consonant Catacombs | 5 rooms + hard choice |       4 min |
| Level 5: The Final Lexicon   |  4 rooms + final boss |     4–6 min |

Total:

> **22–25 rooms**, depending on optional branches.

That gives a full game arc without becoming a forever treadmill.

---

# 4. Game ending

The game ends in one of three ways:

## 1. Victory

Player defeats the final boss:

> **The Unabridged Lich**

They get a final score, run recap, rarest word, best word, relic build, and leaderboard placement.

## 2. Defeat

Player loses all hearts before the final boss.

Show:

* floor reached
* cause of death
* best submitted word
* rarest submitted word
* “one word that could have saved you” if you want to be cruel/funny later

## 3. Escape ending

Optional but good:

At certain points, the player can leave with their current score.

Example:

> “A cracked stairway leads upward. Escape with your treasure, or descend into the next wing?”

This creates risk/reward without endless mode.

For MVP, victory/defeat is enough.

---

# 5. Player resources

Keep the player model simple.

| Resource    | Purpose                           |
| ----------- | --------------------------------- |
| **Hearts**  | Survival. Start with 5 or 6.      |
| **Ink**     | Optional spell/item currency.     |
| **Coins**   | Buy relics, hints, healing.       |
| **Keys**    | Open bonus rooms or locked paths. |
| **Relics**  | Passive modifiers.                |
| **Scrolls** | One-use powers.                   |

MVP recommendation:

```text
Hearts
Coins
Relics
Scrolls
```

Skip XP, levels, mana, armor, and deep RPG stats at first.

---

# 6. Core loop

Each room follows this loop:

1. Read short room description.
2. See the current challenge.
3. Type a valid word.
4. Game checks:

   * Is it in ENABLE?
   * Does it satisfy the room rule?
   * How common/rare is it?
   * How much damage/value does it produce?
5. Resolve room result.
6. Choose next door or reward.

Example:

```text
You enter the Vowel Crypt. The walls hum with missing sounds.

Rule:
Play a valid word with exactly one vowel.

Enemy:
MUMBLER — 12 HP

You type: CRYPT

CRYPT is valid.
One vowel: Y counts as special crypt-vowel.
Damage: 9
Mumbler has 3 HP left.
```

Maybe do not count Y as a vowel unless you want the rules goblin to appear immediately.

---

# 7. Word list logic

You have two major lists:

## ENABLE

Used for:

```text
Is this a legal word?
```

## Google top 10,000

Used for:

```text
How familiar/common is this word?
```

This lets the game split words into useful tiers.

| Tier     | Meaning                      | Example use                        |
| -------- | ---------------------------- | ---------------------------------- |
| Common   | In top 2,000                 | Safer, may heal, lower damage      |
| Familiar | Top 10,000                   | Normal                             |
| Obscure  | ENABLE but not Google 10k    | Higher damage, risk/reward         |
| Goblin   | Valid but very weird-looking | Bonus effects, humor, achievements |

Important: the game should **not require obscure words** too early. Obscure words should feel like clever shortcuts, not mandatory homework.

---

# 8. Scoring and damage

Use a simple, readable formula.

## Base damage

```text
Damage = word length + rare-letter bonus + rarity bonus + relic bonuses
```

Example:

| Word  | Length |                Bonus | Damage |
| ----- | -----: | -------------------: | -----: |
| STONE |      5 |                    0 |      5 |
| BLAZE |      5 |             +3 for Z |      8 |
| XYLYL |      5 | +6 rare/goblin bonus |     11 |

Do not make the formula too visible at first. Show the outcome cleanly:

```text
BLAZE hits for 8.
Z burns through armor.
```

Then allow advanced players to learn the math.

---

# 9. Room types

## 1. Gate Room

A pure constraint room.

Examples:

* “Play a 5-letter word.”
* “Play a word starting with S.”
* “Play a word containing two vowels.”
* “Play a word with no repeated letters.”

Purpose: pacing, simple puzzle beat.

---

## 2. Monster Room

Enemy has HP. Player plays words to damage it.

Example:

```text
Skeleton Scribe
HP: 16
Rule: Words must contain R.
Intent: Deals 1 heart damage next turn.
```

Player may need 1–3 submissions.

---

## 3. Trap Room

Wrong answers punish harder.

Example:

```text
The floor is a crossword of cracked tiles.

Rule:
Play a word with no letter E.

Failure:
Lose 1 heart.
```

This creates tension without animation.

---

## 4. Treasure Room

Player chooses a reward.

Example:

```text
Choose one:

Rusty Quill
+2 damage for 6-letter words.

Commoner’s Cloak
Top-2,000 words heal 1 once per level.

Goblin Lens
Obscure words reveal the next room.
```

---

## 5. Shrine Room

A tradeoff.

Examples:

* Lose 1 heart, gain a relic.
* Sacrifice coins, remove a curse.
* Submit a rare word, gain a key.
* Submit a common word, heal.

---

## 6. Merchant Room

Spend coins on:

* healing
* scrolls
* relics
* hints
* extra attempts

Low graphics, high utility.

---

## 7. Boss Room

Boss has multiple phases or layered constraints.

Example:

```text
The Unabridged Lich
Phase 1: Play words with 5+ letters.
Phase 2: Must contain a rare letter.
Phase 3: Must not use E, A, or S.
```

Bosses should feel like rule-changing fights, not HP sponges.

---

# 10. Level themes

## Level 1 — Entry Hall

Purpose: teach basic rules.

Constraints:

* word length
* starting letters
* contains a letter
* no repeats

Boss:

> **The Doorwarden**

Mechanic:

* requires three valid words
* each word must be longer than the last

---

## Level 2 — Vowel Crypt

Purpose: introduce letter-category rules.

Constraints:

* exactly 2 vowels
* no E
* starts and ends with consonants
* only one vowel type

Boss:

> **The Mute Choir**

Mechanic:

* each turn bans one vowel
* player must adapt

---

## Level 3 — Goblin Library

Purpose: introduce commonness/rarity.

Constraints:

* play a common word to avoid damage
* play an obscure word for bonus damage
* identify fake vs real words
* use words outside top 10k for treasure

Boss:

> **The Footnote Goblin**

Mechanic:

* common words do low damage
* obscure valid words break its shield

This is where ENABLE starts to shine.

---

## Level 4 — Consonant Catacombs

Purpose: harder structural constraints.

Constraints:

* no vowels except one
* contains double letters
* must include one rare letter
* cannot use letters from your previous word
* must share a letter with the enemy’s name

Boss:

> **The Scrabble Wyrm**

Mechanic:

* rare letters do huge damage
* common letters are resisted

---

## Level 5 — The Final Lexicon

Purpose: combine everything.

Constraints:

* length
* rarity
* banned letters
* required letters
* no repeated previous words
* boss phases

Final boss:

> **The Unabridged Lich**

Mechanic:

* Phase 1: common words only damage it
* Phase 2: obscure words only damage it
* Phase 3: must alternate common/obscure words
* Final blow: word must satisfy a special constraint

Example final blow:

```text
Play a valid word:
- 6+ letters
- contains R
- contains no E
- not in the top 2,000 common words
```

That feels like a final exam without needing particle effects.

---

# 11. Player progression inside a run

Avoid traditional RPG leveling. Use **relic builds**.

The player grows by acquiring modifiers.

## Relic examples

| Relic                 | Effect                                                |
| --------------------- | ----------------------------------------------------- |
| **Rusty Quill**       | +2 damage for 6-letter words.                         |
| **Goblin Dictionary** | Obscure words deal +50%.                              |
| **Vowel Charm**       | Once per level, ignore a vowel restriction.           |
| **Lantern of Hints**  | Reveals one valid starting letter in each boss fight. |
| **Commoner’s Cloak**  | First common word per level heals 1.                  |
| **Ink Dagger**        | 4-letter words deal +3 damage.                        |
| **Palindrome Coin**   | Repeated letters give bonus coins.                    |
| **Broken Thesaurus**  | Once per run, reroll a room rule.                     |

The important thing: relics should change what words the player wants to play.

---

# 12. Enemy scaling

Scale enemies through **constraints**, not massive numbers.

Bad scaling:

```text
Goblin: 10 HP
Later goblin: 400 HP
```

Better scaling:

```text
Early goblin:
Any 4+ letter word.

Later goblin:
6+ letters, no E, must contain a rare letter.
```

Enemy difficulty knobs:

| Knob             | Easy              | Hard                    |
| ---------------- | ----------------- | ----------------------- |
| Word length      | 4+                | 7+                      |
| Required letters | common letters    | rare letters            |
| Banned letters   | one banned letter | multiple banned letters |
| Rarity           | any valid word    | obscure/common-specific |
| Attempts         | unlimited         | limited                 |
| Damage           | every 3 turns     | every failed word       |
| Memory           | repeats allowed   | no reused letters/words |

---

# 13. Fixed-level design with light branching

Even with fixed levels, give the player small choices.

After some rooms, offer two doors:

```text
North: Monster Room — better reward
East: Shrine Room — safer but costly
```

The levels remain fixed, but the path has variation.

Recommended model:

* Levels are fixed.
* Each level has 1–2 choice points.
* Choice affects reward/risk, not the whole structure.

This keeps development manageable.

---

# 14. Zork-style presentation

You do not need a parser-heavy text adventure. Use **flavored descriptions** plus clear buttons/input.

Example room:

```text
You stand before a door made of old dictionary pages.
Every definition has been scratched out except one word:

OPEN

The brass mouth on the door whispers:
“Bring me a word with five letters and no E.”
```

Then the UI shows:

```text
Rule: 5 letters, no E
Hearts: ♥ ♥ ♥ ♥
Input: ______
```

This gives Zork flavor without requiring a full command parser.

Use a few recurring commands/buttons:

* Submit word
* Use scroll
* View relics
* Take left door
* Take right door
* Rest
* Flee

Do not make the player type “go north” unless it is purely cosmetic.

---

# 15. UI design

Low-graphics layout:

```text
[ Dungeon Scene Text ]

[ Enemy / Door / Trap Card ]

[ Rule Box ]

[ Word Input ]

[ Result Log ]

[ Player Status: hearts, coins, relics ]

[ Door Choices ]
```

The result log is important. It makes the game feel alive.

Example:

```text
> You played BLAZE.
> Valid word.
> Z cuts through the ward.
> 8 damage.
> The Skeleton Scribe crumbles into punctuation.
```

That is cheap to build and high in flavor.

---

# 16. Custom assets needed

You only need a small set.

## Essential assets

* Dungeon door
* Goblin/scribe enemy
* Skeleton enemy
* Chest
* Shrine
* Boss silhouette
* Heart icon
* Coin icon
* Scroll icon
* Relic frame/card
* Background parchment/stone texture

## Optional polish

* Small animated torch GIF/CSS animation
* Typewriter text effect
* Room transition wipe
* Damage shake
* Glowing valid/invalid word result

Use CSS and SVG-style assets. Do not go sprite-heavy.

---

# 17. Hints and accessibility

Since word games can get frustrating, include hints.

Hint types:

| Hint            | Effect                                   |
| --------------- | ---------------------------------------- |
| Starter Letter  | Reveals one valid first letter.          |
| Length Hint     | Suggests a viable length.                |
| Common Hint     | Says whether a common word can solve it. |
| Letter Bank     | Shows 5 useful letters.                  |
| Example Pattern | Shows `_ R _ _ E` style pattern.         |

Hints can cost coins or scrolls.

Important: a player should rarely be completely stuck.

---

# 18. Solvability system

This is critical.

Every generated/fixed room must be checked against the dictionary before appearing.

For each room rule, precompute or validate:

```text
How many ENABLE words satisfy this?
How many Google 10k words satisfy this?
What is the shortest solution?
What is the most common solution?
What is the best scoring solution?
```

Avoid rooms with only obscure answers unless intentionally labeled as hard.

Example difficulty rule:

| Difficulty | Minimum valid answers |
| ---------- | --------------------: |
| Easy       |                  500+ |
| Medium     |                  100+ |
| Hard       |                   25+ |
| Boss       |                   10+ |
| Final blow |       3–10 acceptable |

This prevents unfair “dictionary hostage situations.”

---

# 19. Firestore integration

Good Firestore uses:

## Daily dungeon

Store:

```text
date
seed
level layout
boss config
available relic pool
leaderboard entries
```

Everyone plays the same dungeon that day.

## Leaderboard

Store:

```text
user/display name
score
win/loss
floor reached
time completed
rarest word
best damage word
final relics
```

## Player stats

Store:

```text
total runs
wins
best score
rarest word ever found
bosses defeated
relics discovered
```

## Word discoveries

This could be very fun:

```text
“Only 3 players found XYLYL today.”
```

That creates community without chat or social complexity.

---

# 20. Scoring

Final score should reward survival and cleverness.

Suggested formula:

```text
Score =
room clear points
+ boss points
+ remaining hearts bonus
+ coins bonus
+ rare word bonuses
+ unused scroll bonus
+ speed bonus, optional
```

Avoid making speed too important. It punishes thoughtful wordplay.

Better leaderboard categories:

* Highest score
* Fastest win
* Rarest word
* Biggest hit
* Fewest hints used

This lets different player types feel smart.

---

# 21. Daily mode

The main mode should probably be:

> **Daily Dungeon**

Every day:

* same fixed level sequence
* same bosses
* same relic pool
* same room rules
* same leaderboard

This fits Ourcade extremely well because it creates a shared tiny ritual.

You can also allow:

> **Practice Dungeon**

Same game, random seed, no leaderboard or separate leaderboard.

---

# 22. MVP scope

## MVP feature set

Build this first:

* 5 fixed levels
* 20–25 rooms total
* 5–6 hearts
* ENABLE validation
* Google 10k rarity tiers
* 10–15 relics
* 5 scrolls
* 8–10 room rule types
* 5 bosses
* daily seed
* leaderboard
* run recap

## Skip for MVP

Do not build yet:

* full text parser
* animations beyond CSS
* account-heavy progression
* deep inventory
* multiplayer
* procedural infinite dungeon
* custom enemy art for every monster
* complex definitions/clues

The MVP should prove the loop first.

---

# 23. Example run flow

```text
Level 1: Entry Hall

Room 1:
Gate — play any 4+ letter word.

Room 2:
Monster — defeat Paper Rat. Words must start with C.

Room 3:
Treasure — choose one relic.

Room 4:
Trap — no repeated letters.

Mini-Boss:
Doorwarden — play three words, each longer than the last.
```

```text
Level 2: Vowel Crypt

Room 1:
Gate — exactly two vowels.

Room 2:
Monster — Mute Choirling. No E allowed.

Room 3:
Shrine — sacrifice a common word to heal.

Room 4:
Monster — words must start and end with consonants.

Boss:
The Mute Choir — each turn bans a vowel.
```

```text
Level 5: Final Lexicon

Room 1:
Monster — obscure words break shield.

Room 2:
Trap — cannot use letters from previous word.

Room 3:
Treasure — final relic choice.

Room 4:
Gate — 7+ letters, no E.

Final Boss:
The Unabridged Lich — common/obscure alternating phases.
```

---

# 24. Design principle

The dungeon should not ask:

> “Do you know the weirdest word?”

It should ask:

> “Can you make smart word choices under strange pressure?”

That is the difference between a word quiz and a game.

---

# 25. Best version in one sentence

**Dictionary Dungeon is a 15-minute fixed-run text roguelike where every room is a word constraint, every enemy is beaten by valid words, and the player’s relics turn vocabulary into strategy.**


---

---

# Dictionary Dungeon — Daily Feature & Content Pool Design Plan

## 1. Daily feature goal

The daily mode should feel like:

> Everyone gets the same dungeon today, but tomorrow’s dungeon is meaningfully different.

This gives you:

* fair leaderboards
* shared daily challenge
* replayable content
* controlled difficulty
* low manual maintenance

The key model:

```text
Daily seed + curated pools + fixed structure = fresh but balanced dungeon
```

Not pure random. Not the same clone every day.

---

# 2. Daily dungeon structure

Use a **fixed run skeleton**.

Example:

```text
Level 1 — Easy intro
Level 2 — Letter-category focus
Level 3 — Rarity/commonness focus
Level 4 — hard constraints
Level 5 — final mixed challenge
```

Each level has a fixed number of slots:

```text
Level 1: 4 rooms + mini-boss
Level 2: 4 rooms + event/boss
Level 3: 5 rooms + mini-boss
Level 4: 5 rooms + elite/boss
Level 5: 4 rooms + final boss
```

Total:

```text
22–25 rooms
15–20 minutes
```

The **role of each level stays stable**.
The **theme, rules, enemies, rewards, and paths can rotate**.

---

# 3. Daily generation pipeline

Each day, generate one official dungeon.

## Step 1: Create daily seed

Example:

```text
2026-07-04-dictionary-dungeon
```

The seed controls all selections.

## Step 2: Choose level themes

Example:

```text
Level 1: Entry Hall
Level 2: Vowel Crypt
Level 3: Goblin Library
Level 4: Consonant Catacombs
Level 5: Final Lexicon
```

Later, themes can rotate:

```text
Level 2:
- Vowel Crypt
- Consonant Chapel
- Silent Scriptorium
```

## Step 3: Fill room slots from room pools

Example:

```text
Room 1: Gate
Room 2: Monster
Room 3: Treasure
Room 4: Trap
Boss: Mute Choir
```

## Step 4: Assign rule packages

Each room gets a rule appropriate to its:

* level
* theme
* difficulty
* room type

## Step 5: Validate solvability

Before publishing the daily dungeon, check:

```text
Does every room have enough valid answers?
Does every boss have enough possible solutions?
Are there common-word paths through early levels?
Are there any impossible relic/rule combinations?
```

## Step 6: Store daily dungeon in Firestore

Do not regenerate differently per player.
Generate once, then all players load the same daily config.

---

# 4. Pool categories

You need several content pools.

The core pools:

1. Level theme pool
2. Room template pool
3. Rule pool
4. Enemy pool
5. Boss pool
6. Relic pool
7. Scroll pool
8. Event/shrine pool
9. Merchant/reward pool
10. Flavor text pool
11. Difficulty modifier pool
12. Scoring/achievement pool

---

# 5. Level theme pool

Level themes control flavor and allowed mechanics.

## Example themes

| Theme            | Primary mechanic           |
| ---------------- | -------------------------- |
| Entry Hall       | basic word rules           |
| Vowel Crypt      | vowel restrictions         |
| Consonant Chapel | consonant restrictions     |
| Goblin Library   | obscure/common words       |
| Forgotten Index  | rarity and definitions     |
| Cursed Stacks    | banned letters             |
| Mirror Archive   | repeated/reversed patterns |
| Final Lexicon    | mixed challenge            |

## Needed fields

Each theme should define:

```text
id
displayName
descriptionTone
allowedLevels
primaryMechanics
enemyPoolTags
rulePoolTags
bossPoolTags
flavorTextPool
backgroundStyle
difficultyRange
```

## MVP quantity

Start with:

```text
5 fixed themes
```

One per level.

Later expand to:

```text
2–3 possible themes per level role
```

---

# 6. Room template pool

Room templates define what type of encounter happens.

## Room types

| Room type | Function                      |
| --------- | ----------------------------- |
| Gate      | simple constraint puzzle      |
| Monster   | enemy HP encounter            |
| Trap      | higher penalty room           |
| Treasure  | reward choice                 |
| Shrine    | tradeoff choice               |
| Merchant  | spend coins                   |
| Event     | strange text-adventure choice |
| Elite     | harder enemy, better reward   |
| Mini-boss | level climax                  |
| Boss      | major level endpoint          |

## Needed fields

```text
id
roomType
allowedLevels
difficultyRange
themeTags
requiredRuleTags
rewardType
failurePenalty
estimatedTimeSeconds
canAppearMultipleTimes
```

## MVP quantity

Minimum:

```text
8–10 room templates
```

Healthy version:

```text
20–30 room templates
```

---

# 7. Rule pool

This is the most important pool.

Rules are the actual word constraints.

## Rule examples

### Basic rules

```text
Play a 5+ letter word.
Play a word starting with S.
Play a word ending with T.
Play a word containing R.
```

### Vowel rules

```text
Exactly 2 vowels.
No E allowed.
Only one vowel type.
Starts and ends with consonants.
```

### Rarity rules

```text
Play a common word.
Play a word outside the top 10,000.
Obscure words deal bonus damage.
Common words are blocked.
```

### Structural rules

```text
No repeated letters.
Must contain double letters.
Must be longer than your previous word.
Cannot use letters from your previous word.
```

### Hard rules

```text
7+ letters, no E.
Contains one rare letter.
Exactly 2 vowels and no repeated letters.
Must not be in top 2,000 common words.
```

## Needed fields

Each rule needs metadata:

```text
id
displayText
ruleLogic
tags
difficulty
allowedLevels
allowedRoomTypes
minValidAnswers
minCommonAnswers
estimatedDifficulty
synergyTags
antiSynergyTags
scoringModifier
```

## Critical solvability fields

Every rule should know:

```text
validAnswerCount
commonAnswerCount
obscureAnswerCount
sampleEasyAnswers
sampleHardAnswers
bestScoringAnswers
```

This prevents unfair rooms.

## MVP quantity

Minimum:

```text
30–40 rules
```

Better:

```text
75–100 rules
```

The rule pool matters more than enemy art.

---

# 8. Enemy pool

Enemies are mostly flavor + mechanical modifiers.

## Enemy examples

| Enemy             | Mechanic                    |
| ----------------- | --------------------------- |
| Paper Rat         | low HP, basic rule          |
| Skeleton Scribe   | requires a letter           |
| Mute Choirling    | vowel rule                  |
| Footnote Goblin   | obscure words hurt more     |
| Ink Leech         | steals coins on failed word |
| Apostrophe Wraith | blocks short words          |
| Scrabble Wyrm     | rare letters deal bonus     |
| Redaction Slime   | bans a letter each turn     |

## Needed fields

```text
id
displayName
themeTags
allowedLevels
baseHP
damage
intentText
ruleTags
weaknessTags
resistanceTags
rewardProfile
flavorLines
iconAsset
```

## MVP quantity

Minimum:

```text
12–15 enemies
```

Healthy:

```text
30–40 enemies
```

You can reuse icons. The mechanics matter more than unique art.

---

# 9. Boss pool

Bosses should be more authored than normal enemies.

Each boss needs a distinct rule pattern.

## Boss examples

| Boss                 | Core mechanic                          |
| -------------------- | -------------------------------------- |
| Doorwarden           | each word must be longer than the last |
| Mute Choir           | bans a vowel each phase                |
| Footnote Goblin King | obscure words break shield             |
| Scrabble Wyrm        | rare letters are required              |
| Unabridged Lich      | alternates common/obscure phases       |

## Needed fields

```text
id
displayName
allowedLevels
themeTags
phaseCount
phaseRules
phaseHP
intentPattern
specialMechanic
rewardProfile
victoryText
defeatText
iconAsset
```

## MVP quantity

Minimum:

```text
5 bosses
```

One per level.

Healthy:

```text
2–3 bosses per level role
```

---

# 10. Relic pool

Relics create builds. They should change what words the player wants to play.

## Relic categories

| Category           | Example                                 |
| ------------------ | --------------------------------------- |
| Length relics      | +2 damage for 6-letter words            |
| Rarity relics      | obscure words deal +50%                 |
| Commonness relics  | common words heal once per level        |
| Letter relics      | words with Z/X/Q deal bonus damage      |
| Vowel relics       | ignore one vowel restriction            |
| Defensive relics   | first failed word per level is forgiven |
| Economy relics     | gain coins for unused hints             |
| Information relics | reveal one valid starter letter         |

## Needed fields

```text
id
displayName
description
rarity
allowedLevels
tags
effectLogic
stackable
antiSynergyTags
synergyTags
weight
```

## MVP quantity

Minimum:

```text
15 relics
```

Healthy:

```text
40–60 relics
```

Relics are one of the best ways to make the daily feel different.

---

# 11. Scroll pool

Scrolls are one-use tools.

## Scroll examples

| Scroll         | Effect                                            |
| -------------- | ------------------------------------------------- |
| Hint Scroll    | reveals one valid starter letter                  |
| Clean Slate    | removes current room’s banned letter              |
| Vowel Pardon   | ignores one vowel mistake                         |
| Word Bomb      | deals fixed damage after valid word               |
| Lantern Scroll | reveals 3 possible letters                        |
| Reroll Room    | swaps the current rule for another same-tier rule |

## Needed fields

```text
id
displayName
description
effectLogic
allowedRoomTypes
allowedLevels
rarity
cost
```

## MVP quantity

Minimum:

```text
5–8 scrolls
```

Healthy:

```text
15–20 scrolls
```

---

# 12. Event and shrine pool

These make the game feel Zork-like.

## Event examples

```text
A talking dictionary asks for a common word.
A cracked mirror asks for a word with repeated letters.
A goblin offers a relic if you submit an obscure word.
A shrine heals you if you sacrifice coins.
A cursed door lets you skip a room but lose a heart.
```

## Needed fields

```text
id
displayName
bodyText
choiceA
choiceB
choiceC optional
requirements
outcomes
allowedLevels
themeTags
riskLevel
```

## MVP quantity

Minimum:

```text
8–10 events
```

Healthy:

```text
25–40 events
```

Events are cheap content and very good for atmosphere.

---

# 13. Merchant/reward pool

Rewards should be modular.

## Reward types

```text
heal 1
gain coins
gain relic
gain scroll
upgrade relic
remove curse
reveal future room
gain key
```

## Needed fields

```text
id
rewardType
value
rarity
allowedLevels
weight
conditions
```

## MVP quantity

Minimum:

```text
10 reward definitions
```

Healthy:

```text
25+
```

---

# 14. Flavor text pool

Flavor makes the game feel less like a spreadsheet.

## Needed pools

```text
room intro lines
enemy entrance lines
valid word reactions
invalid word reactions
damage reactions
treasure descriptions
boss taunts
victory lines
defeat lines
```

## Example

```text
The walls rearrange themselves into almost-words.
A choir of missing vowels hums under the floor.
The goblin squints, offended that your word is real.
```

## MVP quantity

Minimum:

```text
50–75 flavor lines
```

Healthy:

```text
200+
```

Flavor can be rotated without changing mechanics.

---

# 15. Difficulty modifier pool

Modifiers let the same room feel different.

## Examples

```text
+2 enemy HP
one banned letter
first failure costs coins instead of hearts
rare letters deal bonus
common words deal reduced damage
hints cost double
```

## Needed fields

```text
id
displayName
effectLogic
difficultyDelta
allowedLevels
allowedRoomTypes
themeTags
antiSynergyTags
```

## MVP quantity

Minimum:

```text
10 modifiers
```

Healthy:

```text
30+
```

---

# 16. Daily assembly rules

The generator should follow strict rules.

## Example daily rules

```text
Each level must include:
- at least 1 gate room
- at least 1 monster room
- at least 1 reward room
- no more than 1 trap before Level 3
- no repeated exact rule in the same run
- no boss rule unless enough valid answers exist
```

## Avoid

```text
No E + exactly 4 vowels
7+ letters + only one vowel + no common answers
rare-letter requirement too early
too many obscure-only rooms
relics with no usable rules
```

The generator should be conservative. Fun beats chaos.

---

# 17. Solvability validation

Before publishing a daily dungeon, run validation.

For every rule combo:

```text
count valid ENABLE answers
count Google 10k answers
count top 2,000 answers
count obscure answers
get sample answers
estimate scoring range
```

## Difficulty thresholds

| Difficulty | Valid answers | Common answers |
| ---------- | ------------: | -------------: |
| Easy       |          500+ |           100+ |
| Medium     |          150+ |            30+ |
| Hard       |           40+ |             5+ |
| Boss       |           20+ |         varies |
| Final blow |          5–20 |       optional |

Do not publish a room if it fails its threshold.

---

# 18. Firestore model

## Daily dungeon document

```text
dailyDungeons/{date}
```

Fields:

```text
date
seed
status: draft/live/archived
levels
roomSequence
relicPool
scrollPool
bosses
validationSummary
createdAt
```

## Player run document

```text
dailyRuns/{date}/runs/{userId}
```

Fields:

```text
userId
displayName
score
completed
won
levelReached
roomReached
heartsRemaining
coinsRemaining
relics
scrollsUsed
hintsUsed
submittedWords
rarestWord
bestDamageWord
completionTime
createdAt
updatedAt
```

## Leaderboard document

```text
dailyLeaderboards/{date}/entries/{userId}
```

Fields:

```text
score
rank
displayName
won
time
rarestWord
bestDamageWord
hintsUsed
```

For privacy/anti-cheat, you may not want to expose every submitted word publicly.

---

# 19. Daily reset behavior

Recommended reset:

```text
One daily dungeon per calendar day
Reset based on site timezone
Archive previous daily
Generate or publish next daily shortly before reset
```

For Ourcade, use a simple visible label:

```text
Today’s Dungeon
Resets tomorrow
```

Avoid complicated streak pressure at first.

---

# 20. Leaderboard categories

Use multiple leaderboard hooks.

## Main leaderboard

```text
Highest score
```

## Secondary highlights

```text
Fastest win
Rarest word found
Biggest hit
Fewest hints used
Best no-relic run
```

This makes the game more social without real multiplayer.

---

# 21. Content quantity targets

## MVP daily mode

Enough to launch:

| Pool           | Minimum |
| -------------- | ------: |
| Level themes   |       5 |
| Room templates |      10 |
| Rules          |      40 |
| Enemies        |      12 |
| Bosses         |       5 |
| Relics         |      15 |
| Scrolls        |       6 |
| Events/shrines |       8 |
| Rewards        |      10 |
| Flavor lines   |      75 |
| Modifiers      |      10 |

This can support a real first version.

## Stronger v1

Feels much fresher:

| Pool           | Better target |
| -------------- | ------------: |
| Level themes   |         10–15 |
| Room templates |            25 |
| Rules          |           100 |
| Enemies        |            30 |
| Bosses         |            12 |
| Relics         |            50 |
| Scrolls        |            15 |
| Events/shrines |            30 |
| Rewards        |            25 |
| Flavor lines   |          200+ |
| Modifiers      |            30 |

---

# 22. MVP recommendation

For the first version, do **not** rotate everything.

Use this:

```text
Fixed level themes
Seeded room/rule/enemy/relic selection
Same final boss every day
Different boss modifiers every day
```

That means:

* Level 1 is always Entry Hall
* Level 2 is always Vowel Crypt
* Level 3 is always Goblin Library
* Level 4 is always Consonant Catacombs
* Level 5 is always Final Lexicon

But inside those levels, the rooms and rules change.

Later:

```text
Rotate level themes too.
```

This avoids building too much before the core game is proven.

---

# 23. Best daily formula

The best daily design is:

```text
Fixed 5-level arc
+ seeded curated room assembly
+ validated word-rule solvability
+ shared leaderboard
+ rotating relic pool
+ light Zork flavor
```

The content pools should not exist to create randomness.
They should exist to create **authored variety**.

That is the key distinction.



---

---

the below info is primarily in regards to the "scribblenauts" mechanic where certain words have special effects... the above information is the more core concept high level design...


## Dictionary Dungeon MVP Plan

### Core concept

A short dungeon word game where each room gives the player:

```text
A themed room
+ one enemy
+ one word rule
+ a chance for semantic word bonuses
```

The player’s main job is to find **valid words that satisfy the rule**.
The fun twist is that some valid words also have **meaning-based effects**.

Example:

```text
Rule: Word must contain R
Enemy: Skeleton Guard

Player enters: SWORD

Result:
Valid word. Rule passed.
Base attack: 2 damage.
Weapon word bonus: +1 damage.

Text:
“You wield a sharp blade and strike the Skeleton Guard for extra damage.”
```

This is much simpler than full Scribblenauts. The word does not create a simulated object. It triggers a **combat modifier plus flavor text**.

---

# 1. Run structure

Keep the run short and fixed.

## Example run

| Step | Level        | Purpose            |
| ---: | ------------ | ------------------ |
|    1 | Cellar       | Intro/simple enemy |
|    2 | Crypt        | Undead + curses    |
|    3 | Library      | Magic + knowledge  |
|    4 | Armory       | Weapons + armor    |
|    5 | Shrine       | Holy/healing       |
|    6 | Vault        | Treasure/locks     |
|    7 | Boss Chamber | Final test         |

For MVP, you could start even smaller:

```text
3 levels
3 rooms per run
1 boss
```

That is enough to test the full loop.

---

# 2. Level design

Each level has a **theme** and a **pool of possible rooms**.

## Example: Crypt level

```ts
const cryptRooms = [
  {
    id: "bone_hall",
    name: "Bone Hall",
    enemy: "Skeleton Guard",
    rule: "word_must_contain_r"
  },
  {
    id: "coffin_niche",
    name: "Coffin Niche",
    enemy: "Restless Corpse",
    rule: "word_length_at_least_5"
  },
  {
    id: "wraith_alcove",
    name: "Wraith Alcove",
    enemy: "Pale Wraith",
    rule: "word_must_not_contain_s"
  },
  {
    id: "spider_crypt",
    name: "Spider Crypt",
    enemy: "Grave Spider",
    rule: "word_must_start_with_vowel"
  }
];
```

Each playthrough selects a few rooms from the pool.

This gives replayability without procedural chaos.

---

# 3. Room format

Each room should be simple.

```ts
type Room = {
  id: string;
  name: string;
  level: "crypt" | "library" | "armory" | "shrine" | "vault";
  enemyId: string;
  ruleId: string;
  introText: string;
};
```

Example:

```ts
const room = {
  id: "bone_hall",
  name: "Bone Hall",
  level: "crypt",
  enemyId: "skeleton_guard",
  ruleId: "must_contain_r",
  introText:
    "You enter a hall carpeted with brittle bones. A Skeleton Guard raises its rusted blade."
};
```

The room does **not** need loot tables, doors, chests, generated objects, or branching interiors yet.

---

# 4. Enemy format

Each room has one specific enemy.

```ts
type Enemy = {
  id: string;
  name: string;
  hp: number;
  attack: number;
  weaknesses: WordEffectCategory[];
  resistances?: WordEffectCategory[];
  introText: string;
  attackText: string;
};
```

Example:

```ts
const skeletonGuard = {
  id: "skeleton_guard",
  name: "Skeleton Guard",
  hp: 7,
  attack: 1,
  weaknesses: ["blunt", "holy", "magic"],
  resistances: ["poison"],
  introText: "A Skeleton Guard clatters toward you.",
  attackText: "The Skeleton Guard scrapes you with a chipped sword."
};
```

## Enemy design principle

Keep numbers small.

| Stat             | MVP range |
| ---------------- | --------: |
| Enemy HP         |      4–10 |
| Enemy attack     |       1–2 |
| Base word damage |       1–2 |
| Bonus damage     |  +1 or +2 |
| Player HP        |      8–12 |

This avoids scaling headaches.

---


---

# 6. Global word-effect system

This is the “Scribblenauts-lite” part.

The player can type any valid dictionary word. But if it appears in your global semantic list, it adds a bonus.

## Core model

```text
Valid word = base effect
Valid word with meaning = base effect + semantic bonus + custom flavor text
```

Example:

| Word     | Category   | Bonus                            |
| -------- | ---------- | -------------------------------- |
| `sword`  | weapon     | +1 damage                        |
| `hammer` | blunt      | +2 vs skeletons                  |
| `torch`  | fire/light | +1 damage, reveal-style flavor   |
| `shield` | defense    | block next enemy attack          |
| `apple`  | food       | heal 1                           |
| `holy`   | holy       | +2 vs undead                     |
| `magic`  | magic      | random bonus                     |
| `poison` | poison     | damage over time unless resisted |
| `key`    | tool       | pierce armor / utility bonus     |
| `coin`   | treasure   | bonus score or gold              |

---

# 7. Word-effect data structure

Use categories first, then individual words.

```ts
type WordEffectCategory =
  | "weapon"
  | "blunt"
  | "piercing"
  | "fire"
  | "light"
  | "holy"
  | "magic"
  | "defense"
  | "food"
  | "poison"
  | "tool"
  | "treasure"
  | "dark";

type WordEffect = {
  category: WordEffectCategory;
  baseBonus: {
    damage?: number;
    heal?: number;
    block?: number;
    gold?: number;
    status?: "burn" | "poison" | "stun" | "reveal" | "curse";
  };
  strongAgainst?: string[];
  weakAgainst?: string[];
  text: {
    generic: string[];
    strong?: string[];
    resisted?: string[];
  };
};
```

Example:

```ts
const WORD_EFFECTS: Record<string, WordEffect> = {
  sword: {
    category: "weapon",
    baseBonus: { damage: 1 },
    strongAgainst: ["flesh", "beast"],
    weakAgainst: ["ghost"],
    text: {
      generic: [
        "You wield a sharp blade and strike for extra damage.",
        "A conjured sword flashes through the dark."
      ],
      resisted: [
        "The blade passes with little effect."
      ]
    }
  },

  hammer: {
    category: "blunt",
    baseBonus: { damage: 1 },
    strongAgainst: ["skeleton", "armor"],
    text: {
      generic: [
        "You swing a heavy hammer with bone-rattling force."
      ],
      strong: [
        "The hammer cracks through brittle bone for extra damage."
      ]
    }
  },

  torch: {
    category: "fire",
    baseBonus: { damage: 1, status: "burn" },
    strongAgainst: ["spider", "plant", "undead"],
    text: {
      generic: [
        "You raise a torch, and flame bites into the enemy.",
        "A warm flare pushes back the room’s shadows."
      ],
      strong: [
        "The torch catches perfectly, scorching the creature."
      ]
    }
  },

  shield: {
    category: "defense",
    baseBonus: { block: 1 },
    text: {
      generic: [
        "You brace behind a spectral shield. The next blow is softened.",
        "A shield of letters locks into place before you."
      ]
    }
  },

  apple: {
    category: "food",
    baseBonus: { heal: 1 },
    text: {
      generic: [
        "You take a quick bite and recover a little strength.",
        "A crisp apple appears just long enough to help."
      ]
    }
  },

  holy: {
    category: "holy",
    baseBonus: { damage: 1 },
    strongAgainst: ["undead", "ghost", "demon"],
    text: {
      generic: [
        "A clean light gathers around the word."
      ],
      strong: [
        "Holy light tears through the undead creature."
      ]
    }
  },

  magic: {
    category: "magic",
    baseBonus: { damage: 1, status: "stun" },
    text: {
      generic: [
        "The word hums with unstable magic.",
        "Arcane sparks leap from the letters."
      ]
    }
  }
};
```

---

# 8. Flavor text system

This is worth doing early. It will make the game feel much more alive.

## Text hierarchy

When player submits a word:

1. Validate dictionary.
2. Validate room rule.
3. Apply base damage.
4. Check word effect.
5. Check enemy weakness/resistance.
6. Choose response text.

Example output:

```text
SWORD is valid.

You wield a sharp blade and slash the Skeleton Guard.
Base damage: 2
Weapon bonus: +1
Total damage: 3
```

With weakness:

```text
HAMMER is valid.

You swing a heavy hammer with bone-rattling force.
The Skeleton Guard cracks apart under the blow.
Base damage: 2
Blunt bonus: +1
Weakness bonus: +1
Total damage: 4
```

With resistance:

```text
POISON is valid.

Venom seeps from the word, but the Skeleton Guard has no blood to poison.
Base damage: 2
Poison resisted.
Total damage: 2
```

This gives a lot of personality for very little system complexity.

---

# 9. Combat resolution formula

Keep it predictable.

```ts
function resolveTurn(word, room, enemy, player) {
  if (!isDictionaryWord(word)) {
    return {
      success: false,
      text: `"${word}" is not recognized by the dungeon.`
    };
  }

  if (!room.rule.validate(word)) {
    return {
      success: false,
      text: room.rule.failText
    };
  }

  let damage = 2;
  let messages = [`${word.toUpperCase()} is valid.`];

  const effect = WORD_EFFECTS[word];

  if (effect) {
    const effectResult = applyWordEffect(effect, enemy, player);
    damage += effectResult.damageBonus ?? 0;
    messages.push(effectResult.text);
  } else {
    messages.push("The word lands as a plain strike.");
  }

  enemy.hp -= damage;
  messages.push(`You deal ${damage} damage.`);

  if (enemy.hp > 0) {
    player.hp -= enemy.attack;
    messages.push(enemy.attackText);
  }

  return {
    success: true,
    damage,
    enemyHp: enemy.hp,
    playerHp: player.hp,
    text: messages.join("\n")
  };
}
```

---

# 10. Recommended MVP categories

Start with **8 categories**, not 20.

| Category    | Effect                                     | Example words                |
| ----------- | ------------------------------------------ | ---------------------------- |
| Weapon      | +1 damage                                  | sword, blade, axe, dagger    |
| Blunt       | +1 damage, +1 vs skeleton/armor            | hammer, mace, club, stone    |
| Fire        | +1 damage, strong vs spiders/plants        | torch, flame, fire, ember    |
| Holy        | +1 damage, strong vs undead/ghosts         | holy, prayer, angel, relic   |
| Magic       | +1 damage or small random effect           | magic, spell, rune, wand     |
| Defense     | block/reduce next hit                      | shield, armor, guard, wall   |
| Food        | heal 1                                     | apple, bread, meat, honey    |
| Poison/Dark | damage over time, risky/resisted by undead | poison, venom, curse, shadow |

Later add:

* tool
* treasure
* light
* ice
* water
* animal
* music
* knowledge

But not for MVP.

the words per category can start out as a very large list for mvp, that's fine.

---

# 11. Room/level examples

## Level 1: Cellar

Purpose: teach rules.

Rooms:

| Room          | Enemy      | Rule               |
| ------------- | ---------- | ------------------ |
| Rat Nest      | Giant Rat  | 4+ letters         |
| Broken Pantry | Mold Slime | must contain A     |
| Old Well      | Cave Bat   | must not contain E |

Good word effects:

* `apple` heals
* `torch` burns slime
* `stone` hits bat
* `knife` attacks rat

---

## Level 2: Crypt

Purpose: undead interactions.

Rooms:

| Room          | Enemy           | Rule                  |
| ------------- | --------------- | --------------------- |
| Bone Hall     | Skeleton Guard  | must contain R        |
| Coffin Niche  | Restless Corpse | 5+ letters            |
| Wraith Alcove | Pale Wraith     | must not contain S    |
| Grave Pit     | Bone Rat        | starts with consonant |

Good word effects:

* `hammer` cracks skeletons
* `holy` hurts undead
* `torch` helps against corpse/wraith
* `poison` is resisted by skeletons

---

## Level 3: Library

Purpose: magic/knowledge flavor.

Rooms:

| Room            | Enemy        | Rule                       |
| --------------- | ------------ | -------------------------- |
| Dust Stacks     | Book Imp     | must contain double letter |
| Rune Desk       | Ink Slime    | must contain I             |
| Forbidden Shelf | Paper Wraith | 6+ letters                 |
| Silent Study    | Whisper Bat  | must not contain T         |

Good word effects:

* `magic` stuns
* `rune` bonus
* `book` clue/score
* `fire` strong but risky
* `water` damages ink slime

---

## Level 4: Armory

Purpose: weapon bonuses.

Rooms:

| Room         | Enemy          | Rule           |
| ------------ | -------------- | -------------- |
| Rust Rack    | Armored Goblin | must contain O |
| Shield Wall  | Tin Knight     | 5+ letters     |
| Spear Closet | Training Dummy | starts with S  |
| Broken Forge | Ember Imp      | must avoid A   |

Good word effects:

* weapon words are common
* blunt beats armor
* shield blocks
* fire may be resisted by Ember Imp

---

## Level 5: Shrine

Purpose: healing/holy choices.

Rooms:

| Room          | Enemy       | Rule                  |
| ------------- | ----------- | --------------------- |
| Candle Altar  | Lost Spirit | must contain L        |
| Cracked Font  | Curse Slime | must start with vowel |
| Saint’s Niche | Bone Monk   | 6+ letters            |
| Offering Bowl | Greed Imp   | must avoid R          |

Good word effects:

* holy is strong
* food/heal works
* curse/dark is risky
* treasure may anger greed enemies

---

# 12. Player-facing turn examples

## Plain valid word

```text
BRICK is valid.

The word lands with a dull magical thud.
You deal 2 damage.
```

## Weapon word

```text
SWORD is valid.

You wield a sharp blade and cut through the gloom.
Weapon bonus: +1 damage.
You deal 3 damage.
```

## Blunt vs skeleton

```text
HAMMER is valid.

You swing a heavy hammer with bone-rattling force.
The Skeleton Guard cracks under the blow.
Blunt bonus: +1 damage.
Enemy weakness: +1 damage.
You deal 4 damage.
```

## Fire vs spider

```text
TORCH is valid.

You thrust a torch into the webbed dark.
The Grave Spider recoils from the flame.
Fire bonus: +1 damage.
Enemy weakness: +1 damage.
You deal 4 damage.
```

## Poison vs undead

```text
POISON is valid.

Venom drips from the word, but the Restless Corpse has little left to poison.
Poison resisted.
You deal 2 damage.
```

## Shield

```text
SHIELD is valid.

A shield of pale letters locks into place.
You deal 1 damage.
Your next incoming hit is reduced.
```

## Food

```text
APPLE is valid.

A crisp apple appears in your hand. Questionable dungeon hygiene, useful anyway.
You recover 1 HP.
You deal 1 damage.
```

---

# 13. Recommended content targets

For MVP:

| System                                     |        Target |
| ------------------------------------------ | ------------: |
| Levels                                     |             3 |
| Rooms per level                            |             6 |
| Rooms used per run                         |   3 per level |
| Enemies                                    |         12–18 |
| Word rules                                 |            12 |
| Word effect categories                     |             8 |
| Special word list                          | 100–200 words |
| Flavor lines per category                  |          5–10 |
| Flavor lines per special enemy interaction |           2–4 |

That is enough to feel rich without exploding.

---

# 14. What to avoid in MVP

Avoid these for now:

* Fully generated room contents
* Objects that open into more objects
* Per-room word dictionaries
* Complex inventory
* Dozens of enemy stats
* Permanent equipment
* Big branching maps
* Every noun doing something unique
* Procedural dialogue generated live by AI

Those are tempting. They are also little goblins carrying schedule knives.

---

# 15. Best version of the mechanic

The clean rule should be:

> **The word must satisfy the puzzle rule to work at all. If the word also has meaning, it modifies the combat result.**

That means the word game remains primary.

Example:

```text
Room rule: must contain R

SWORD = valid + weapon bonus
APPLE = invalid, no R, so no heal
BRICK = valid, plain attack
TORCH = valid + fire bonus
MAGIC = invalid, no R, no spell
```

This creates good tension:

> “I know APPLE would heal me, but it doesn’t fit the rule.”

That is where the game gets interesting.

---


# CAVEAT!: any code snippets are suggestions only - you know this codebase better. this doc was not created with the Ourcade codebase specifically in mind.

