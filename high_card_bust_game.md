# "High Card Bust" Card Game Design Doc

## Working Concept

A digital arcade poker-solitaire game where the player manages **five active poker lanes**, trying to build scoring hands while avoiding dead lanes. The game combines:

* Poker hand recognition
* Solitaire-style placement
* Lane survival
* Limited discard management
* Push-your-luck chip betting

The player is not trying to beat another player or dealer. The objective is to survive as long as possible and earn the highest score before all lanes are locked.

---

# 1. Core Fantasy

The game should feel like:

> Poker solitaire meets Tetris.

Each card draw creates a placement decision. The player must decide which lane can best absorb the card, which lane is close to scoring, and which lane is in danger of becoming a high-card bust.

The best moments should feel like:

* “This card saves Lane 3.”
* “I can finish this lane, but it ruins my bet.”
* “Do I use my one discard now or risk it?”
* “I need one more good hand before the whole board collapses.”

---

# 2. Core Rules

## Board

* The game has **5 lanes**.
* Each lane can hold up to **5 cards**.
* Lanes begin empty and unlocked.
* A locked lane can no longer receive cards.

## Drawing Cards

* The player draws **one card at a time**.
* The drawn card must be placed into one unlocked lane unless discarded.
* The deck is effectively infinite in the default digital mode:

  * Cards keep coming.
  * The deck may reshuffle after exhaustion.
  * The run ends only when all lanes are locked.

## Lane Resolution

A lane resolves when it reaches **5 cards**.

When a lane resolves:

* If the lane contains **Pair or better**, it scores and clears.
* If the lane contains only **High Card**, it busts and becomes locked.

Important clarification:

> A lane does not bust just because it temporarily contains unmatched cards. It only busts when it reaches 5 cards and has no valid scoring poker hand.

---

# 3. Core Loop

1. Draw a card.
2. Place it into one unlocked lane.
3. If a lane reaches 5 cards, resolve it.
4. Scoring hands clear the lane.
5. High-card lanes bust and lock.
6. Bets create optional risk/reward.
7. The run ends when all 5 lanes are locked.

---

# 4. Game End

## Main Digital Mode

The game ends when:

> **All 5 lanes are locked.**

The player’s final score is the total score earned during the run.

## Why This Works

* Lanes act as the player’s lives.
* Locked lanes reduce future placement options.
* The board gets increasingly tense over time.
* The player is always trying to survive one more draw.

---

# 5. Discard System

The player has **one discard**.

## Discard Rules

* The player may discard the currently drawn card instead of placing it.
* After using the discard, it becomes unavailable.
* The discard refreshes whenever any lane successfully scores.
* The discard does not refresh from a busted lane.

## Purpose

The discard is the player’s emergency valve.

It should feel valuable but not generous:

> “I can dodge one bad card, but I need to earn that safety back.”

---

# 6. Scoring

When a lane resolves with a valid poker hand, it scores according to the hand type.

| Hand            | Base Points |
| --------------- | ----------- |
| Pair            | 10          |
| Two Pair        | 25          |
| Three of a Kind | 40          |
| Straight        | 60          |
| Flush           | 75          |
| Full House      | 100         |
| Four of a Kind  | 200         |
| Straight Flush  | 500         |
| Royal Flush     | 1000        |

## Score Role

Score is the main measurement of success.

* Score = how well the player is doing.
* Chips = how aggressively the player can gamble.
* Lanes = the player’s lives.
* Discard = the player’s safety valve.

---

# 7. Betting with Chips

## Chip Bank

The player starts each run with:

> **10 betting chips**

Chips are a limited risk resource. They are not the main win condition.

The player spends chips to place bets on lanes. Successful bets multiply score and return chip rewards. Failed bets lose the wagered chips.

---

# 8. When the Player Can Bet

A player may only bet on a lane if:

* The lane has **3 or fewer cards**
* The lane does **not already contain a scoring hand**
* The lane is not locked or disabled
* The player has enough chips to afford the selected tier

## “Already Contains a Scoring Hand” Clarification

A lane with a partial scoring hand cannot be newly bet.

Examples:

| Lane Cards  | Can Bet? | Reason                                      |
| ----------- | -------- | ------------------------------------------- |
| `7♣ 7♦`     | No       | Already has a Pair                          |
| `9♣ 9♦ K♠`  | No       | Already has a Pair                          |
| `5♣ 5♦ 5♥`  | No       | Already has Three of a Kind                 |
| `8♣ 9♣ 10♣` | Yes      | Strong draw, but not a completed poker hand |
| `2♠ 6♥ Q♦`  | Yes      | No made hand yet                            |
| Empty lane  | Optional | Allow only if blind betting is desired      |

Design recommendation:

> For the cleanest balance, betting should usually happen on lanes with 1–3 cards and no made hand. If empty-lane betting is allowed, it should be treated as a “blind bet” and may need a stricter expiration timer.

---

# 9. Multiple-Tap Chip Tiers

Each lane has a poker chip below it.

Tapping the chip cycles through wager tiers.

| Chip Tier  | Cost    | Hand Required        | Payout Multiplier |
| ---------- | ------- | -------------------- | ----------------- |
| No Bet     | 0       | Any valid hand       | 1x                |
| Blue Chip  | 1 chip  | Pair or better       | 2x                |
| Red Chip   | 2 chips | Two Pair or better   | 3x                |
| Gold Chip  | 3 chips | Straight or better   | 5x                |
| Black Chip | 5 chips | Full House or better | 8x                |

## Tier Cycling

Recommended tap cycle:

> No Bet → Blue → Red → Gold → Black → No Bet

Cycling back to No Bet lets the player correct a bad tap before committing.

## “Or Better” Clarification

“Or better” follows standard poker hand ranking.

Examples:

* Gold requires Straight or better.

  * Straight succeeds.
  * Flush succeeds.
  * Full House succeeds.
  * Three of a Kind fails.
* Black requires Full House or better.

  * Full House succeeds.
  * Four of a Kind succeeds.
  * Straight Flush succeeds.
  * Flush fails.

---

# 10. Bet Commitment

A bet is not committed the instant the player taps the chip. This allows the player to preview/cycle tiers.

A bet becomes committed when:

* The next card is drawn, or
* The player places the current card after selecting the bet, or
* The player confirms the bet, depending on UI implementation.

Once committed:

* The wagered chips are reserved.
* The tier cannot be freely changed.
* The bet timer begins.
* The lane must meet the requirement to win the bet.

---

# 11. Bet Expiration

To prevent players from betting a lane and ignoring it forever, each committed bet expires.

Recommended rule:

> A bet must succeed within **5 draws**, or the bet fails.

## Expiration Behavior

After a bet is committed:

* A countdown appears on or near the chip.
* Each new card draw reduces the counter.
* If the counter reaches 0 before the lane scores, the bet fails.
* The lane remains playable unless another rule causes it to bust or lock.

## Purpose

The expiration timer turns betting into a real commitment.

The question becomes:

> “Can I finish this lane soon enough?”

Not:

> “Can I protect this lane forever until destiny mails me the right card?”

---

# 12. Successful Bets

A bet succeeds if the lane resolves with a hand that meets or exceeds the selected chip tier.

When a bet succeeds:

* The hand scores.
* The score multiplier is applied.
* The player receives chip winnings.
* The lane clears.
* The discard refreshes.

## Chip Profit Table

| Bet Tier | Cost    | If Successful         |
| -------- | ------- | --------------------- |
| Blue     | 1 chip  | Get 1 back + 1 profit |
| Red      | 2 chips | Get 2 back + 1 profit |
| Gold     | 3 chips | Get 3 back + 2 profit |
| Black    | 5 chips | Get 5 back + 3 profit |

## Example

The player places a Red Chip bet.

* Cost: 2 chips
* Requirement: Two Pair or better
* Lane resolves as Full House
* Result:

  * Bet succeeds
  * Hand scores as Full House
  * Score is multiplied by 3x
  * Player gets 2 chips back + 1 chip profit
  * Lane clears
  * Discard refreshes

---

# 13. Failed Bets

A bet fails if:

* The lane scores below the required tier
* The lane busts as High Card
* The bet expires before the lane scores

When a bet fails:

* The wagered chips are lost.
* No multiplier is applied.
* If the lane still produced a valid hand, the hand may still score normally.
* If the lane busts as High Card, the lane locks.

## Example: Scores Too Low

The player places a Gold Chip bet.

* Cost: 3 chips
* Requirement: Straight or better
* Lane resolves as One Pair

Result:

* The Pair scores normally for 10 points.
* The Gold bet fails.
* No 5x multiplier is applied.
* The player loses the 3 wagered chips.
* The lane clears because it still scored a valid hand.
* Discard refreshes because the lane scored.

## Example: Bust

The player places a Blue Chip bet.

* Cost: 1 chip
* Requirement: Pair or better
* Lane resolves as High Card

Result:

* No score.
* Bet fails.
* Player loses 1 chip.
* Lane locks.
* Discard does not refresh.

---

# 14. Game Modes

## Classic Mode

Classic Mode is the default strategic mode.

Rules:

* No timer on card placement.
* Player may think as long as needed.
* Bets still have draw-based expiration.
* Best for thoughtful, solitaire-style play.

Purpose:

> Strategic lane management and push-your-luck betting.

---

## Panic Mode

Panic Mode is the arcade variant.

Rules:

* Each drawn card has a short placement timer.
* If the timer expires, the card burns instead of auto-placing.
* Burning a card may reset a combo or reduce a bonus meter.
* Panic Mode may have a higher score multiplier.

Recommended timeout behavior:

> Do not auto-place the card into Lane 1. That feels arbitrary and unfair.

Better timeout penalties:

* Burn the card
* Reset combo
* Lose a small score bonus
* Consume discard if available
* Reduce a panic-mode streak meter

Purpose:

> Fast arcade pressure without wrecking the board unfairly.

---

## One-Deck Mode

One-Deck Mode is the physical-friendly version.

Rules:

* Use one standard 52-card deck.
* No infinite reshuffle.
* The game ends when the deck runs out or all lanes are locked.
* Final score is total points earned.
* Locked lanes reduce future placement options.

Purpose:

> More strategic, finite, puzzle-like gameplay.

This mode is better for physical cards or a more “daily challenge” digital version.

---

# 15. UI / UX Design Ideas

## Board Layout

Use a clear five-lane layout.

Recommended screen structure:

* Top: score, chip bank, discard status, current mode
* Center: five vertical card lanes
* top centered: draw pile and current drawn card
* Under each lane: poker chip button and bet countdown and required bet

---

## Lane Visual States

Each lane should have a clear state.

| Lane State   | Visual Treatment                                                                    |
| ------------ | ----------------------------------------------------------------------------------- |
|              |                                                                                     |
|              |                                                                                     |
|              |                                                                                     |
| Betted       | Chip and dotted lane border glows with tier color                                   |
| Bet Expiring | Countdown pulses                                                                    |
| Scored       | Score burst, then lane clears                                                       |
| Busted       | Cracked/darkened lane                                                               |
| Locked       | Grayed out with lock icon (custom lock asset can be generated later given a prompt) |

---

## Current Card UX

The current drawn card should feel important.

Ideas:

* Place it in a large “drawn card” tray.
* Let the player drag it into a lane.
* Also allow tapping a lane to place the card quickly.

---

## Chip UI

Each lane’s chip should be directly underneath the lane.

Chip behavior:

* Tap to cycle tier.
* tap-Hold or hover to show requirement, multiplier, and cost.
* Chip color indicates risk tier.
* Countdown badge appears after commitment.

The countdown number should be highly visible because expiration is central to betting tension.

---

## Discard UX

The discard should feel like a physical token.

Ideas:

* Show a single discard card/token near the current card. (i can provide custom asset given a prompt)
* When available, it glows.
* When used, it flips over or grays out.
* When refreshed, it pops back with a satisfying animation.

Text label:

> Discard Ready

or

> Discard Spent — Score a Hand to Refresh

---

## Scoring Feedback

Scoring should be juicy and readable.

When a lane scores:

1. Highlight the final hand.
2. Display hand name.
3. Show base points.
4. Show multiplier if bet succeeded.
5. Show final payout.
6. Clear the lane.

Example:

> Full House
> 100 × 3 = 300

For successful bets:

* Chip sparkle
* Chip bank increases
* Multiplier burst

For failed bets:

* Chip cracks or drops away
* “Bet Failed”
* Show why:

  * “Needed Straight+”
  * “Expired”
  * “High Card Bust”

---

## Locked Lane UX

A locked lane should be obvious but not visually annoying.

Ideas:

* Dark overlay
* Lock icon
* Cracked card slots
* Muted color
* Tooltip: “Locked by High Card Bust”

Since all lanes locked ends the game, locked lanes should create visible tension.

---

# 16. Recommended MVP Rule Set

For the first playable version, use:

* 5 lanes
* 5 cards per lane
* Infinite reshuffling deck
* Pair or better scores
* High Card at 5 cards busts and locks the lane
* 1 discard, refreshed by scoring
* 10 starting betting chips
* Bets allowed only on lanes with 3 or fewer cards and no made hand
* Multiple-tap chip tiers
* Bets expire after 5 draws
* Successful bets multiply score and return chip profit
* Failed bets lose wagered chips
* Game ends when all 5 lanes are locked
* Classic Mode has no placement timer
* Panic Mode adds a timer and burns cards on timeout

---

# 17. Balance Levers for Playtesting

These are the values most likely to need adjustment:

| Lever               | Current Recommendation | What It Affects   |
| ------------------- | ---------------------- | ----------------- |
| Starting chips      | 10                     | Betting frequency |
| Bet expiration      | 5 draws                | Bet difficulty    |
| Discard count       | 1                      | Forgiveness       |
| Discard refresh     | On scoring hand        | Momentum          |
| Blue cost           | 1                      | Low-risk betting  |
| Black cost          | 5                      | High-risk betting |
| Pair points         | 10                     | Baseline scoring  |
| Locked lane penalty | Permanent lock         | Difficulty        |
| Panic timer         | 5 seconds              | Arcade pressure   |

If the game feels too easy:

* Reduce starting chips.
* Reduce bet expiration to 4 draws.
* Make locked lanes permanent.
* Increase penalty for failed bets.
* Reduce chip profits.

If the game feels too harsh:

* Start with more chips.
* Let one locked lane reopen after a strong hand.
* Increase bet expiration to 6 draws.
* Award a bonus discard after rare hands.
* Make busts clear the lane instead of locking in beginner mode.

---

# 18. Design Goal

The game should make the player constantly ask:

> “Where can this card do the least damage — or the most good?”

The betting system should add a second question:

> “Which lane am I confident enough to gamble on before it is safe?”

That is the heart of the game.
