This is a good direction. It has a clearer identity than “Candy Crush with cards” because the board becomes a **resource-management puzzle**, not just an infinite cascade machine.

The core hook:

> **A solitaire poker puzzle where every hand you make destroys part of the board, and gravity turns today’s good move into tomorrow’s setup.**

## Core rules

### Board

Use a rectangular grid, maybe:

* **7×7** for tighter strategy
* **8×8** for more combo potential
* **9×9** if you want longer games

Cards are randomly dealt into the grid.

### Selection

Player taps a connected path of cards:

* Minimum: **2 cards**
* Maximum: **5 cards**
* Path must move orthogonally: up, down, left, right
* No diagonals
* No revisiting the same card
* Optional stricter version: path must be a straight row/column only

I’d recommend **orthogonal pathing**, not just straight lines. It feels more tactical and gives the player more agency.

Example valid path:

```text
[7♣] - [8♦] - [9♠]
          |
        [10♥] - [J♣]
```

That forms a straight.

## Scoring hands

Because players can select fewer than 5 cards, you can support both **mini-hands** and full poker hands.

| Selection | Hand type                                        |
| --------: | ------------------------------------------------ |
|   2 cards | Pair                                             |
|   3 cards | Three of a kind / mini straight / mini flush     |
|   4 cards | Four of a kind / 4-straight / 4-flush / two pair |
|   5 cards | Full poker hands                                 |

But the best scores should require **5-card hands**.

## Suggested paytable

| Hand            | Score | Board effect                                        |
| --------------- | ----: | --------------------------------------------------- |
| Pair            |    10 | Consumes selected cards                             |
| Two Pair        |    30 | Consumes selected cards                             |
| Three of a Kind |    60 | Consumes selected cards + 1 bonus card              |
| Straight        |   100 | Clears selected path                                |
| Flush           |   120 | Clears selected path + all touching same-suit cards |
| Full House      |   180 | Clears a small burst around center card             |
| Four of a Kind  |   300 | Clears all cards of that rank on board              |
| Straight Flush  |   700 | Clears selected path + row/column shockwave         |
| Royal Flush     |  1500 | Big board clear / jackpot animation                 |

For balance, **Flush should not be too easy** if suits are common. Either make flush require 5 cards or score it lower than straight flush/full house.

## The key design decision: refill or no refill?

You described the board getting more sparse over time. That is interesting, but it changes the game from match-3 into more of a **survival puzzle**.

### Option A: No refill

Cards fall into empty spaces, but no new cards enter.

**Pros:**

* Strategic and tense
* Every move matters
* Natural end condition

**Cons:**

* Game can become unwinnable quickly
* Less flashy/cascadey
* Harder to tune

Best for: thoughtful solitaire puzzle.

### Option B: Limited deck refill

Cards fall, then new cards are dealt from a finite deck/reserve.

Example:

* Start with 64 cards on board.
* Reserve deck has 52 more cards.
* Every consumed card gets replaced until the reserve runs out.
* After that, the board gets sparse.

**This is probably the best version.**

It gives early-game momentum, mid-game planning, and late-game scarcity.

### Option C: Infinite arcade refill

Cards always refill from the top.

**Pros:**

* More Candy Crush-like
* Better for combos and score chasing

**Cons:**

* Less strategic
* Harder to make “sparse board” matter

Best for timed arcade mode.

## Best structure: three modes

### **1. Classic Mode**

Finite deck. No timer.

Goal: maximize score before no valid hands remain.

This is your main “thinking person’s poker puzzle.”

### **2. Arcade Mode**

Infinite refill. Timer-based.

Goal: score as much as possible in 2 minutes.

This is the dopamine mode.

### **3. Daily Deal**

Everyone gets the same seed/board.

Goal: best score with identical cards.

This is great for leaderboards and replayability.

## Gravity rules

Make gravity deterministic and readable.

After a hand is consumed:

1. Cards disappear.
2. Cards above fall downward.
3. Empty spaces remain at the top.
4. If reserve deck exists, new cards deal into top spaces.
5. Cascades do **not** auto-score unless player selects them.

I would avoid automatic poker-hand cascades at first. Let the player create hands manually. Otherwise the game may feel random, and poker scoring becomes noisy.

## Strategic layer

The game becomes interesting if players think about:

* Should I take a quick pair now?
* Should I leave these cards to set up a straight?
* Should I consume low-value cards to drop an Ace into position?
* Should I preserve same-suit clusters?
* Should I burn a weak hand to open the board?

That is the good stuff.

## Add “chip” mechanics

Chips can be score and also utility.

| Chip action     | Effect                                   |
| --------------- | ---------------------------------------- |
| **Shuffle**     | Rearranges remaining cards               |
| **Peek**        | Shows next 5 reserve cards               |
| **Jokerize**    | Turns one card into a wild               |
| **Nudge**       | Move one card one space                  |
| **Burn**        | Remove one unwanted card                 |
| **Double Down** | Next hand scores 2×, but must be 5 cards |

This adds choice without overcomplicating the base game.

## Important balance issue

If players can score any pair, they may just spam pairs.

Fixes:

### Option 1: Move limit

Give the player, say, **25 moves**. Now weak hands cost opportunity.

### Option 2: Ante system

Each hand costs 1 chip to play. Bad hands may not be worth it.

### Option 3: Rising minimum

Early game allows pairs. Later, the minimum hand requirement increases.

Example:

| Phase          | Minimum scoring hand       |
| -------------- | -------------------------- |
| Start          | Pair                       |
| After 10 moves | Two Pair / Three of a Kind |
| After 20 moves | Straight or better         |
| Endgame        | Full House or better       |

That creates tension.

## My recommended MVP

Build this first:

# **Royal Path Poker**

### Rules

* 8×8 grid
* Tap connected orthogonal path of **2–5 cards**
* Confirm to score a poker hand
* Cards are removed
* Remaining cards fall downward
* New cards refill from a finite reserve deck
* Game ends when reserve is empty and no scoring hands remain
* Score is paid in chips

### Scoring

Keep it simple:

| Hand            | Chips |
| --------------- | ----: |
| Pair            |     5 |
| Two Pair        |    15 |
| Three of a Kind |    30 |
| Straight        |    60 |
| Flush           |    75 |
| Full House      |   120 |
| Four of a Kind  |   250 |
| Straight Flush  |   500 |
| Royal Flush     |  1000 |

### Bonuses

* **5-card hand bonus:** +25%
* **Consecutive better hands:** streak multiplier
* **No-pair hand:** invalid, unless it is straight/flush
* **Joker tile:** wild card, rare

## UI idea

When the player selects cards, show a live evaluation:

```text
Selected:
7♠ 8♦ 9♣ 10♥ J♠

Hand:
STRAIGHT

Pays:
60 chips
```

Then the confirm button becomes a big old-web casino button:

```text
[ CASH HAND ]
```

If the hand is invalid:

```text
NO PAY — TRY AGAIN
```

Very satisfying. Slightly rude. Correct energy.

## Theme names

Strong candidates:

* **Royal Path Poker**
* **Cardfall Casino**
* **Flushfall**
* **Poker Cascade**
* **Chip Drop Royale**
* **The Falling Deck**
* **Path to Vegas**
* **Joker Grid**
* **CardCrunch Poker**
* **404 Poker Palace**

Best name from the mechanic: **Cardfall Casino**.
Best name from the poker angle: **Royal Path Poker**.
Best old-internet name: **404 Poker Palace**.

## Old internet wrapper

Make it feel like a suspicious Java applet casino game:

* “Best viewed in Internet Explorer 5”
* Fake visitor counter
* Pixelated jackpot marquee
* Green felt tiled background
* Big beveled buttons
* Fake popups:

  * “CONGRATULATIONS!!! You found a pair.”
  * “DealerBot has entered the chat.”
  * “Error 21: Blackjack not found.”
* Leaderboard called **Guestbook**
* Daily challenge called **Today’s Hot Deal**

## One strong design twist

Add a **Dealer Hand** target.

Every round, the dealer wants a specific hand:

```text
Dealer Challenge:
Make a Flush within 5 moves
Reward: 3× payout
```

This gives each run mini-objectives without needing full level design.
