# Baloney

**Nine Discord party games, zero setup, one message per game.**

[![CI](https://github.com/AverageDeveloper517/baloney/actions/workflows/ci.yml/badge.svg)](https://github.com/AverageDeveloper517/baloney/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.1-5865f2)](CHANGELOG.md)

Run a command, press **Join**, and the whole game lives inside a single message
that edits itself. No dashboard, no API keys, no accounts, no paid commands, no
premium tier. Invite it and play.

`/bluff` · `/mostlikely` · `/trivia` · `/wyr` · `/number` · `/duel` · `/chain` ·
`/impostor` · `/scatter` — plus `/party` for a whole night of games with one
champion.

**Repo:** <https://github.com/AverageDeveloper517/baloney> · **Version 2.0.1**

<details>
<summary><strong>Contents</strong></summary>

- [Why this one gets invited](#why-this-one-gets-invited)
- [The games](#the-games)
- [Party mode](#party-mode)
- [Progression (cosmetic only)](#progression-cosmetic-only)
- [Commands](#commands)
- [Quick start](#quick-start)
- [Permissions](#permissions)
- [How one round works](#how-one-round-works)
- [Data and privacy](#data-and-privacy)
- [Hosting](#hosting)
- [Tests](#tests)
- [Project layout](#project-layout)
- [Customising](#customising)
- [Troubleshooting](#troubleshooting)

</details>

---

## Why this one gets invited

Most bots are a private utility. Baloney is the opposite.

- **The whole channel plays at once.** A lobby is a public message with a Join
  button. Four people can be playing within ten seconds of the command.
- **Watching is almost playing.** Every prompt is public. A spectator only has to
  press one button to join the next game.
- **One message, no spam.** Each game creates one card and edits it through every
  phase. A marathon night still leaves one message behind.
- **No setup, ever.** No config command is required. Invite it, type `/party`, or
  pick a game.
- **It asks for almost nothing.** Four ordinary permissions. No administrator,
  no message history, no privileged intents.
- **Everything is free.** All 21 commands work in every server. Coins and themes
  are cosmetic and earned by playing.
- **The ending is shareable.** The final card names the winner and carries an
  invite button.

---

## The games

Every game has a public lobby. The host presses **Start**, or the lobby starts
itself when it fills. Private answers happen in ephemeral replies and modals, so
the table stays readable.

| game | players | default rounds | how it plays |
|---|---|---|---|
| `/bluff [rounds] [pack]` | 3–10 | 3 | one prompt has a real answer; everyone writes a lie, then votes for the truth |
| `/mostlikely [rounds]` | 3–10 | 3 | one situation, one tap. majority picks who it fits best |
| `/trivia [rounds]` | 2–12 | 5 | four buttons, fifteen seconds, +100 correct and +50 for a fast answer |
| `/wyr [rounds]` | 2–12 | 4 | would you rather: two buttons, majority takes the point |
| `/number [rounds]` | 2–12 | 3 | guess closest to a secret number. exact = 5, next = 3, next = 1 |
| `/duel` | 2 | best of three | rock paper scissors, first to two rounds |
| `/chain [rounds]` | 3–10 | 2 | one sentence each, then vote for the line that belongs in the story |
| `/impostor [rounds]` | 3–10 | 2 | one player gets a different word; the room votes out the fake |
| `/scatter [rounds]` | 2–10 | 2 | one letter, three categories, sixty seconds. unique answers score double |

**Bluff** is the flagship. The prompt is public, the lies are private, and the
answer bank is 68 hand-written facts split into six packs (`animals`, `food`,
`science`, `tech`, `words`, `history`) plus `all`. Identical lies merge and both
authors get credit. Writing the actual answer is allowed, but you sit out that
vote. The reveal explains the fact, so a round ends with the room learning
something.

**Scoring is always visible** on the reveal card. A game ends on its own; there
is no host admin work after Start.

---

## Party mode

`/party [playlist] [rounds]` opens one lobby, runs several games back to back,
and ends with a champion board. Between games there is an eight-second break
card, then the next game reuses the same message and the same roster.

| playlist | lineup |
|---|---|
| `quick` | trivia → would you rather → number |
| `classic` | bluff → trivia → most likely to |
| `chaos` | scatter → impostor → chain |
| `marathon` | bluff → trivia → would you rather → impostor → scatter → most likely to |

Each game pays party points by finish: **5 / 3 / 2 / 1**, with ties sharing a
rank. Finishing a whole night unlocks the **Party Animal** badge and pays bonus
XP and coins to everyone who stayed.

`duel` is not in a playlist because it is strictly a two-player game and a party
lobby needs at least three.

---

## Progression (cosmetic only)

Everything here is earned by playing. Nothing changes a game's rules, and
nothing costs real money.

- **XP and levels.** A finished game pays 20 XP + 5 per round, +25 for a win.
  Levels follow `50 × (n−1) × n` cumulative XP.
- **Coins.** 10 + 2 per round, +15 for a win. `/daily` pays 30 coins, plus 5 for
  every streak day, capped at 60.
- **28 badges.** First game, first win, 100 games, 50 wins, 100 people fooled,
  flawless trivia, catching the impostor, a clean scatter sweep, Explorer (all
  nine games), Party Animal, a seven-day streak, level 25, and more.
- **6 card themes.** House Gold, Mint, Rose, Violet, Ocean and Midnight. Buy once
  with coins, swap freely. They change the embed colour on your cards.

`/profile` shows your level, record and collection. `/stats` is the detailed
receipt. `/top` ranks the server by wins, lies, XP, coins, games or quiz answers.
`/badges` lists everything and what is still missing.

---

## Commands

| command | what it does |
|---|---|
| `/bluff` `/mostlikely` `/trivia` `/wyr` `/number` `/duel` `/chain` `/impostor` `/scatter` | open a lobby for that game |
| `/party [playlist] [rounds]` | one lobby, several games, one champion |
| `/help` | all games, party mode, permissions and how a round works |
| `/invite` | the exact invite URL, scopes and permission integer |
| `/profile [user]` | level, coins, badges, record, equipped theme |
| `/stats [user]` | games, wins, truths found, people fooled, best bluff |
| `/top [metric]` | server leaderboard: wins, fooled, XP, coins, games, correct |
| `/daily` | free coins once a day, with a streak bonus |
| `/shop` | the six cosmetic themes and how coins are earned |
| `/theme [id]` | equip a theme, buying it with coins if needed |
| `/badges [user]` | every badge, earned and locked |
| `/setup [rounds] [pace] [reset]` | optional server defaults (Manage Server) |
| `/debug` | runtime status, bot owner only |

Every game command except `/duel` takes `rounds` and supports a per-command
override. `/setup` sets optional server defaults: rounds (1–8) and pace (`fast`,
`standard`, `relaxed`). **No setup is required**; without it each game uses its
own defaults.

---

## Quick start

You need **Node 20 or newer** and a Discord application. Four steps:

1. **Create the application**
   <https://discord.com/developers/applications> → *New Application*.

2. **Copy two values into `.env`**
   - *Bot* → *Reset Token* → `DISCORD_TOKEN`
   - *General Information* → *Application ID* → `CLIENT_ID`

   ```bash
   cp .env.example .env
   # then edit .env
   ```

3. **Install and register**

   ```bash
   npm install
   npm run deploy
   ```

4. **Run it**

   ```bash
   npm start
   ```

`npm run doctor` checks the setup and prints your invite link with the scopes and
permissions already filled in. `npm run check` imports every module without a
token. `npm test` runs the offline suite.

> Leave every privileged intent **off** in the Developer Portal. Baloney only
> needs the `Guilds` intent, which requires no toggle. Presence, Server Members
> and Message Content are not used.

### Docker

```bash
cp .env.example .env        # fill in DISCORD_TOKEN and CLIENT_ID
docker compose run --rm baloney npm run deploy
docker compose up -d
```

The compose file keeps `data/` on the host so stats survive rebuilds. A plain
image works too:

```bash
docker build -t baloney .
docker run --env-file .env -v "$PWD/data:/app/data" baloney
```

---

## Permissions

**Scopes**

```
bot
applications.commands
```

**Bot permissions**

| permission | why |
|---|---|
| View Channels | see the channel the command was used in |
| Send Messages | post the game message |
| Embed Links | the game is a card, not a wall of text |
| Send Messages in Threads | parties happen in threads |

Permission integer: **`274877926400`**

Full invite URL (replace the id):

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=274877926400
```

**Deliberately not requested**

Administrator · Manage Server · Manage Messages · Manage Channels · Kick or Ban ·
Read Message History · Message Content intent · Server Members intent

The bot never reads messages. It reacts only to slash commands, button presses
and the modals it opens itself.

---

## How one round works

```
/trivia
  lobby        Join / Leave / Start / Cancel         3 minutes
     │
  play         one question, four buttons            15 seconds
     │         private replies, no channel spam
  reveal       the answer, the split, the scores     7 seconds
     │
  next question, or the final card with an invite
```

The same shape applies to every game:

- if everyone has answered or voted, the phase closes early
- a timer that fires early waits for the real deadline
- duplicate votes, self-votes and late votes are refused with a short reason
- players who leave keep their score but are no longer asked for input
- a deleted game message closes the session instead of throwing
- one game per channel and one game per player at a time
- a failed post rolls back the locks so nobody is stranded

---

## Data and privacy

- Games live **in memory**. A restart ends a game in progress; stats persist.
- Stats live in **one JSON file** (`data/stats.json`), written atomically with a
  one-generation `.bak`.
- Stats are **scoped to the server**: `${guildId}:${userId}`. A record in one
  server is not visible in another.
- Stored fields: user id, server id, display name, XP, coins, games, wins,
  rounds, truths found, people fooled, best bluff, quiz correctness, daily
  streak, theme, badges, games tried, small counters, last played. Nothing else.
- **No message content is stored or read.** Lies and clues exist only in memory
  for the duration of the round.
- Delete `data/stats.json` to wipe every record. There is no hidden cache.
- A corrupt file is moved aside as `stats.json.corrupt-<timestamp>` and the bot
  starts clean instead of refusing to boot. Version 1 files are migrated in place.

---

## Hosting

- **Runtime:** Node 20+ (tested on Node 24). One process, no build step.
- **Memory:** roughly 80–120 MB.
- **Network:** outbound HTTPS only. No inbound port, no web server.
- **Database:** none.
- **Disk:** only `data/stats.json` and its `.bak`.
- **Restarts:** safe. Live games end; stats persist.

Any Node host works: a VPS, a Raspberry Pi, Railway, Render, Fly, a spare PC.
Free tiers are fine — the bot is idle when nobody is playing.

`GUILD_ID` is optional. Set it during development to register commands instantly
in one server. Without it, commands are global and can take up to an hour.
`OWNER_ID` is optional and only enables `/debug`.

Step-by-step guides live in [`docs/SELF-HOSTING.md`](docs/SELF-HOSTING.md)
(systemd, Docker, PaaS and backups) and [`docs/GAMES.md`](docs/GAMES.md) (rules
and scoring for every game).

---

## Tests

```bash
npm test
npm run check
npm run test:coverage
```

**120 offline tests, no network, no Discord token.** They cover:

- all nine game engines: scoring, validation, early phase closes, ties, timers,
  leaving mid-game and every final card
- the full button/modal/route path for bluff, trivia, impostor and a complete
  `/party quick` night, including stats settlement
- one-game-per-channel and one-game-per-player locks, a failed post rolling back
  the host lock, forged buttons, duplicate interactions and the error boundary
- every screen of every game against Discord's real embed and button limits,
  including ten players with maximum-length names and text
- store v2: atomic writes, per-server scoping, migration from v1, corrupt-file
  recovery, one-generation backup, counter and badge clamping
- progression: level curve, XP/coins, all 28 badges, daily streaks, theme buying
- content banks: unique ids, no leaked answers, disjoint bluff packs, balanced
  trivia answers and the exact scatter letter set

CI runs the same suite on Node 20 and 22 for every push and pull request.

The game logic has no `discord.js` import, which is why the whole loop runs
headlessly.

---

## Project layout

```
src/
  index.js              boot: .env, then app
  app.js                client, commands, router, sweep, shutdown
  router.js             commands, buttons and modals, with one error boundary
  game-service.js       live sessions, party orchestration, locks, settlement
  session.js            one game ↔ one message ↔ one timer
  party.js              lobby → games → break → champion board
  meta.js               XP, coins, 28 badges, themes, daily streaks
  store.js              atomic JSON v2, migration, backup, leaderboards
  ui.js                 view model → Discord payload, with hard limits
  permissions.js        the invite link and the exact permission ask
  game-command.js       the shared builder behind the nine game commands
  commands/             21 slash commands
  games/
    base.js             lobby, rounds, text safety, shared formatting
    index.js            the game registry and content wiring
    bluff.js  mostlikely.js  trivia.js  wyr.js  number.js
    duel.js   chain.js       impostor.js  scatter.js
  content/
    prompts.js          68 bluff prompts in six packs
    situations.js       50 most-likely-to prompts
    trivia.js           60 questions across 11 categories
    wyr.js              50 would-you-rather pairs
    impostor.js         46 word pairs
    chain.js            40 story openers
    scatter.js          44 categories, 15 letters
scripts/
  deploy.js             register the 21 slash commands
  doctor.js             setup check, invite link and content counts
  check.js              import every module without a token
test/                   120 offline tests
test-support/           shared table, payload and fake-interaction helpers
```

---

## Customising

- **Bluff prompts:** `src/content/prompts.js`. Each entry needs an `id`, a
  `prompt` containing `___`, an `answer` and a one-line `fact`. `npm test`
  rejects duplicates, missing blanks and answers leaked in the prompt.
- **Other banks:** `situations.js`, `trivia.js`, `wyr.js`, `impostor.js`,
  `chain.js`, `scatter.js`. Each has its own integrity test.
- **Timers and points:** the `*_TIMING` / `*_POINTS` exports at the top of each
  file in `src/games/`.
- **Branding:** colours in `src/games/base.js`, wording in each `view()` method.
- **Theme prices:** `THEMES` in `src/meta.js`.

No build step. Edit, run `npm test`, restart.

---

## Troubleshooting

| symptom | cause | fix |
|---|---|---|
| commands do not appear | `applications.commands` scope missing, or deploy skipped | re-invite with the scope, run `npm run deploy` |
| commands appear slowly | global registration | set `GUILD_ID` and redeploy for instant updates |
| "The application did not respond" | an interaction threw before replying | check the console; the router logs the stack |
| buttons say the game has ended | the bot restarted, or the game was cancelled | games are in memory; start a new one |
| a lie never shows up | blank, under two characters, over 80, or merged with an identical one | try a different answer |
| the lobby says nobody started | the lobby timer expired before enough players joined | run the command again |
| stats reset after a deploy | the host uses an ephemeral disk | mount a volume, or accept it |
| invite links are hidden | `CLIENT_ID` is not set | add it to `.env` and restart |
| a room looks stuck | someone left and one person has not acted | the phase timer always closes it |

---

## Licence

MIT. No paid commands, no keys, no tracking.

See [`CHANGELOG.md`](CHANGELOG.md) for release notes and
[`CONTRIBUTING.md`](CONTRIBUTING.md) if you want to add a game or a content
bank.
