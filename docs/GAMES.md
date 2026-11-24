# How the games work

All nine games share one shape: a public lobby, a private action, a public
reveal, then the next round or a final card. A game is one message that edits
itself; nothing is posted during a round except ephemeral confirmations.

## Shared rules

- Lobby: Join / Leave / Start / Cancel. The lobby starts itself when full.
- Only the host can Start or Cancel.
- The phase closes early when every active player has acted.
- If a timer fires early it waits for the real deadline.
- Self-votes, duplicate votes and late votes are refused with a short reason.
- A player who leaves keeps their score but is no longer asked for input.
- Ties share the win. A game with no score has no winner.
- Every game ends on its own. There is no host admin work after Start.

## Bluff

3–10 players, 3 rounds, 68 prompts in six packs.

1. The prompt is public; everyone writes a lie in a private modal. Writing the
   real answer is allowed.
2. Identical lies merge, and both authors are paid for the shared answer.
3. Vote for the truth. You cannot vote for your own lie.
4. Reveal: the truth, every lie, the author and the vote count, plus a one-line
   fact.

Scoring: +1000 for finding the truth, +500 for every person who votes for your
lie. If everyone writes the truth, the vote is skipped. A truth-writer sits out
the vote. `big-lie` triggers at five votes on one lie.

## Most Likely To

3–10 players, 3 rounds. One situation, one tap per player. The majority takes the
point; a tie splits it. No typing.

## Trivia

2–12 players, 5 rounds, 60 questions across 11 categories including emoji clues.
Four buttons, 15 seconds. +100 for the correct answer and +50 if it arrives within
five seconds. The reveal shows the split and a fact.

## Would You Rather

2–12 players, 4 rounds, 50 pairs. Two buttons, 25 seconds. The majority side takes
the point; a tie pays everyone who voted. The lone voter on the tiny side earns
the `contrarian` flag.

## The Number Game

2–12 players, 3 rounds. Everyone guesses 1–100 in a modal. Ranked by distinct
distance: exact +5, next closest +3, next +1. An exact guess is a `bullseye`. The
secret never repeats the previous round's number.

## Duel

Exactly 2 players, 3 rounds, first to two. Rock, paper, scissors. A drawn round
awards nothing. The match winner gets a bonus and the `duelist` flag.

## Chain Story

3–10 players, 2 rounds, 40 openers. Everyone adds one sentence in a private
modal, then the room votes for the best line. Every vote pays; the winner's line
becomes part of the story. A round with fewer than two legal lines skips the
vote instead of showing a one-button ballot.

## Impostor

3–10 players, 2 rounds, 46 related word pairs. One player gets a different word.
Everyone opens their word privately, writes a one-word clue, then votes for
whoever sounds like they are faking it.

- Caught: every civilian who voted for the impostor scores, and `caught` fires.
- Survived: the impostor takes four points and `slipped` fires.

## Scatter

2–10 players, 2 rounds, 44 categories and 15 letters. One letter, three
categories, 60 seconds. An answer must start with the letter to count.

- unique legal answer: 2 points
- shared legal answer: 1 point
- wrong letter: 0
- three unique legal answers in one round: +3 and `unique-sweep`

## Party mode

`/party` runs a playlist through one lobby and one message:

| playlist | games |
|---|---|
| `quick` | trivia, would you rather, number |
| `classic` | bluff, trivia, most likely to |
| `chaos` | scatter, impostor, chain |
| `marathon` | bluff, trivia, would you rather, impostor, scatter, most likely to |

Each game pays party points by finish: 5 / 3 / 2 / 1, ties sharing a rank. An
eight-second break card separates games. The roster carries across games; players
who leave are dropped. The final board names the champion and unlocks Party
Animal for everyone who finished.

## Progression

Every finished game pays XP (20 + 5 per round, +25 for a win) and coins (10 + 2
per round, +15 for a win). Party completion adds a bonus. 28 badges, six cosmetic
themes and a daily streak sit on top. None of it changes a game's rules.
