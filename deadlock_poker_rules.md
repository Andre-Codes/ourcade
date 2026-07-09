# Deadlock Poker — How to Play

*Deadlock Poker is a solo, push-your-luck poker cabinet. (Internally the game is
still coded as "chip-panic"; it was previously titled "High Card Bust." An earlier,
retired version used per-lane resolution timers — that ruleset lived in git history
through commit `1e0c69e` and no longer applies.)*

---

## The idea

You're playing poker by yourself, against a rising economy. Cards come one at a
time. You drop each one into one of your **four lanes**, building toward a five-card
poker hand in each.

The rule that makes it tense: **a lane must reach Two Pair or better to score.**
Anything less — a High Card *or* even a single Pair — **busts** and locks the lane
for good. And the **ante** you pay to open lanes **climbs steeply** as you go, so
chips stay scarce. A bust hurts twice: you lose the lane *and* the ante you paid for
it.

Your goal is simple: **score as many points as you can before you run out of chips
or the whole board locks up.**

---

## What you're working with

- **4 lanes.** Each holds up to **5 cards** (one poker hand). Lanes start closed.
- **12 starting chips.** Chips are your fuel — you spend them to open lanes and to
  raise. You earn them back only by scoring hands. Run out and you can't open lanes.
- **1 discard.** A single "get out of this card" token (see below).

---

## Your turn, step by step

1. **A card is drawn** into your tray (the single card near the top).
2. **You place it** into one of your lanes — tap the lane once to greenlight it, tap
   again to drop the card. (Or spend your discard to throw the card away.)
3. A **fresh card is drawn**, and it's your turn again.

There's no clock — take all the time you want. The pressure is your **wallet**, not a
timer.

---

## Opening a lane and the ANTE (this is the pressure)

Lanes start empty and closed. **To start a lane, you pay its ANTE** — charged
automatically the first time you drop a card into an empty lane.

- The ante starts at **1 chip**.
- **The ante rises steeply over the run** (like blinds climbing in real poker). It
  goes up by **2 chips** for every **4 scoring hands** you make and for every **2
  Wanted objectives** you complete, plus **1 more** for every 20 cards you draw.
  These stack, and the ante **never comes back down.**
- Before long, opening a fresh lane costs a real chunk of chips — so you must keep
  **scoring** to afford staying in the game. **Running out of chips to open lanes is
  the most common way a run ends.**

You'll see `ANTE 1` (or `NEED 5`, etc.) on an empty lane. Can't afford it? You can't
open that lane.

> **A lane you've already opened is always free to keep playing.** The ante is a
> one-time cost to *open* a lane; you only need chips on hand to open a **new** lane
> or to **raise**.

---

## When a lane fills (5 cards) — two outcomes

A lane resolves the moment it holds **5 cards**. The cards are read as a poker hand:

### ✅ SCORE — Two Pair or better
The hand scores points, the lane **clears** (freeing the slot to reopen), your
**discard refreshes**, and you're **paid chips** (see *Earning chips*). This is what
you're aiming for.

### 💥 BUST — anything below Two Pair
A **High Card OR any single Pair** busts: the lane **locks permanently.** You lose
the ante (and any raise on it), and your Wanted **streak resets.** That lane is gone
for the rest of the run.

> A **pair is not safe** — it busts just like a high card. You must push each lane to
> **two pair or better.** Locking all four lanes ends the run.

---

## Earning chips

Chips come back **only when a lane SCORES** (Two Pair or better). The math:

**You get your ante back, plus a profit that scales with the hand:**

| Hand           | Profit (chips **on top of** your returned ante) |
| -------------- | ----------------------------------------------- |
| Two Pair       | +1                                              |
| Three of a Kind| +2                                              |
| Straight       | +3                                              |
| Flush          | +4                                              |
| Full House     | +6                                              |
| Four of a Kind | +10                                             |
| Straight Flush | +14                                             |
| Royal Flush    | +20                                             |

So a scoring lane **always at least breaks even** (ante back + a little profit), and
**big hands are real windfalls.** Because the ante keeps climbing, weak two-pair
scores barely keep you afloat while strong hands actually grow your bank — chasing
better hands is how you survive the rising stakes.

**A bust returns nothing** — you lose the ante you paid (and any raise).

> The number floating over an open lane is the chips you'd pocket if it scores. Before
> the lane is finished the game can't know your final hand, so it shows the **floor**
> (the two-pair payout); land something bigger and you'll be paid more.

---

## Raising — betting for a multiplier

On top of the ante, you can **raise** a lane to wager more chips for a **points
multiplier** and extra chip profit. Tap the **chip button** under a lane to cycle
through the raise tiers.

**When you can raise:** the lane must be **open**, **unlocked**, and hold **3 cards or
fewer** with **no made hand yet** — you have to call your shot early.

**The tiers:**

| Raise  | Extra cost | Needs to win  | Points multiplier | Chips back if it wins |
| ------ | ---------- | ------------- | ----------------- | --------------------- |
| Red    | 1 chip     | Trips+        | ×3                | your 1 back + 1 profit |
| Gold   | 2 chips    | Straight+     | ×5                | your 2 back + 2 profit |
| Black  | 4 chips    | Full House+   | ×8                | your 4 back + 3 profit |

**How a raise plays out:**
- You **cycle** the chip to preview a tier — nothing is spent yet. The raise
  **commits on your next draw** (that's when the chips are deducted).
- Once committed, the raise **must land within 5 draws** or it **expires** (the stake
  is gone; the lane keeps playing). A small countdown on the chip shows the draws
  left.
- **If the lane resolves at or above the raise's requirement**, you win: the hand's
  points are **multiplied**, and you get your raise stake back **plus** its profit —
  on top of the normal ante payout.
- **If the lane scores but falls short** of the raise, the hand **still scores
  normally** — you just **lose the raised chips**, no multiplier.
- **If the lane busts,** you lose everything staked (ante and raise).

So the payout number over a raised lane is the **total** you'd collect on a win: ante
back + ante profit + raise back + raise profit, with the multiplier on the points.

---

## The WANTED objective

A rotating **WANTED** target shows up top. Complete it **on a scoring lane** for bonus
points and chips, and to build a **streak**. Tap the WANTED bar in-game for the
current target and exactly how to complete it.

- A Wanted is either a **specific hand** (make *exactly* that hand — e.g. "Two Pair")
  or a **condition** on the five cards (e.g. "All Red," "Blackjack 21," "Rainbow
  Lane"). A condition still requires the lane to **score** (Two Pair+) as well.
- Completing a Wanted pays a **bonus** (bigger for harder targets) and advances your
  **streak**. Targets get harder as your streak climbs.

**Streak milestones** (based on the streak you reach):
- **2 →** +25% bonus points
- **3 →** +1 bonus chip
- **4 →** +50% bonus points
- **5 →** **unlock one locked lane** (a second chance!)

**A bust resets your streak to zero.** Every completed Wanted also nudges the ante up.

---

## The JACKPOT

Land a **Straight Flush** or a **Royal Flush** in any lane, any time, and you hit the
**JACKPOT** — a huge bonus on top of the normal payout, regardless of the current
Wanted:

- **Straight Flush →** +1000 points, +8 chips
- **Royal Flush →** +2500 points, +10 chips

These also count toward your streak like a Wanted.

---

## The discard

You have **one discard.** Instead of placing the drawn card, you can throw it away —
handy when the card would wreck a lane.

- Using the discard **spends it.** It **recharges when any lane scores** (Two Pair+).
- The discard buys you out of one bad card — spend it wisely, since you earn it back
  only by scoring.

---

## Scoring & the end of the run

Your **score** is the sum of every hand's base points (× any winning raise
multiplier), plus all your Wanted and Jackpot bonuses. It's what goes on the arcade
leaderboard.

The run **ends** when:
- you're **out of chips** with no affordable lane and nowhere legal to play, or
- **all four lanes are locked.**

Then your final score is locked in.

---

## Quick strategy tips

- **A pair is a bust.** Never settle a lane at a pair — always push for **two pair or
  better**, or don't fill that 5th slot yet.
- **Chase strength when you can.** Bigger hands pay far more chips (and points), and
  chips are what let you keep opening lanes as the ante climbs.
- **Mind the rising ante.** Every few scores it jumps by 2. If chips are tight, make
  sure your open lanes can actually reach two pair before you commit more of them.
- **A bust is doubly punishing** — a lost lane *and* a lost ante. When a lane looks
  hopeless, your discard (or simply feeding elsewhere) can save you the ante.
- **Raise early and honestly.** You can only raise before a lane makes a hand, so
  raise the lanes you truly believe in — and watch the 5-draw clock.
