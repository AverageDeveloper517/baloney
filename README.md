# Baloney

A Discord party bot with no setup, no API keys and no paid commands.

`/bluff` opens a lobby in the channel. Everyone writes a lie, the game shuffles
the lies with the real answer, and the room votes for the truth. Points for
finding it, points for every person who falls for yours.

`/mostlikely` is the 30-second version: no typing, one tap per round, the room
votes for whoever fits the situation best.

Both games run inside **one message per game**. The channel does not fill up
with spam, spectators can follow along, and when the game ends the message turns
into the podium with an invite button.

---

## Why this one gets invited

Most bots are a private utility: one person uses them and nobody else notices.
Baloney is the opposite.

- **The whole channel plays at once.** A lobby is a public message with a Join
  button. Four people can be playing within ten seconds of the command.
- **Watching is almost playing.** The prompt and the options are public. A
  spectator only has to press one letter to join the next round.
- **No setup, ever.** No dashboard, no config command, no account, no key. Invite
  it and type `/bluff`.
- **It asks for almost nothing.** No administrator, no message history, no
  privileged intents. A cautious server owner can read the whole permission ask
  in one line.
- **The fun is visible.** The final card names the biggest liar and the sharpest
  player. People screenshot it. The card carries an invite link.
- **Nothing is gated.** Every command works in every server. No premium tier, no
  vote-locked features, no "upgrade to start a game".

---

## Quick start

You need Node 18.17 or newer and a Discord application. Four steps:

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

`npm run doctor` checks the whole setup and prints your invite link with the
correct scopes and permissions already filled in.

> Leave every privileged intent **off** in the Developer Portal. The bot only
> asks Discord for the `Guilds` intent, which needs no toggle. Presence, Server
> Members and Message Content are not used.

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

The bot never reads messages. It only reacts to slash commands, button presses
and the modals it opens itself.

---

## Commands

| command | what it does |
|---|---|
| `/bluff [rounds]` | open a Bluff lobby (1–5 rounds, default 3) |
| `/mostlikely [rounds]` | open a Most Likely To lobby |
| `/stats [user]` | games, wins, truths found, people fooled, best bluff |
| `/top [metric]` | this server's leaderboard: wins, people fooled or games played |
| `/help` | how it works and what it asks for |

Every command is public except the private replies during a game.

---

## How Bluff works

```
/bluff
  lobby        Join / Leave / Start / Cancel         5 minutes
     │
  write        each player opens a private modal     60 seconds
     │         (the prompt is public, the lies are not)
  vote         A–K buttons, one vote each            45 seconds
     │         you cannot vote for your own lie
  reveal       the truth, every lie, who wrote it    12 seconds
     │
  next round, or the final card
```

**Scoring**

- vote for the real answer: **+1000**
- each person who votes for your lie: **+500**

**The fairness rules**

- identical lies merge, and both authors are paid for the shared answer
- writing the actual answer is allowed, but you sit out that vote — you already
  know it
- duplicate votes, self-votes and votes after the deadline are rejected
- if every player writes the truth, the round reveals immediately instead of
  showing a one-button vote
- if everyone has answered or voted, the phase closes early instead of making
  the room wait for a timer
- players who leave mid-game keep their score but are no longer asked for input

The answer bank is 68 hand-written facts. The reveal shows a one-line
explanation, so a round ends with the room learning something instead of just
arguing.

## How Most Likely To works

Three rounds by default, 35 seconds each. The prompt is something like
"most likely to argue with a self-checkout machine". Everyone taps a player.
Majority takes the point; a tie splits it. No typing, no facts, no waiting.

---

## Data and privacy

- Games live **in memory**. A restart ends a game in progress; the message simply
  stops updating, and a new command starts fresh.
- Stats live in **one JSON file** (`data/stats.json`), written atomically.
- Stats are **scoped to the server**. A record in one server is not visible in
  another.
- The file stores: user id, server id, display name, games, wins, rounds, truths
  found, people fooled, best single bluff, last played. Nothing else.
- **No message content is stored or read.** Lies exist only in memory for the
  duration of the round.
- Delete `data/stats.json` to wipe every record. There is no hidden cache.

If the file is ever corrupted, the bot moves it aside as
`stats.json.corrupt-<timestamp>` and starts clean instead of refusing to boot.

---

## Hosting

- **Runtime:** Node 18.17+ (tested on Node 24). One process, no build step.
- **Memory:** roughly 80–120 MB.
- **Network:** outbound HTTPS only. No inbound port, no web server.
- **Database:** none.
- **Disk:** only `data/stats.json`. On hosts with ephemeral disks (some free
  tiers), mount a volume or accept that stats reset on redeploy.
- **Restarts:** safe. Games are in memory, so they end; stats persist.

Any Node host works: a VPS, a Raspberry Pi, Railway, Render, Fly, a spare PC.
Free tiers are fine — the bot is idle when nobody is playing.

`GUILD_ID` is optional. Set it during development to register commands
instantly in one server. Without it, commands are global and can take up to an
hour to appear.

---

## Tests

```bash
npm test
```

**50 tests, no network.** They cover:

- lobby limits, host transfer, expiry and cancel
- deterministic round flow, early phase closes, timers that fire early
- scoring for truths, lies, merged lies and truth-writers
- vote rules: own lie, duplicate vote, closed window, left players
- the full button/modal/route path through the game service, including the
  one-game-per-channel and one-game-per-player locks
- a failed game post rolling back the host's lock, and forged buttons being
  refused instead of crashing
- stats accumulation, per-server scoping, leaderboard ordering and a corrupt
  save file
- every screen checked against Discord's embed and button limits, including a
  ten-player table with maximum-length lies
- mention and ping stripping from player-written text
- prompt bank integrity: unique ids, no answer leaked in the prompt, no
  duplicates

The game logic has no `discord.js` import, which is why the whole loop can run
headlessly.

---

## Customising

- **Prompts:** `src/content/prompts.js`. Each entry needs an `id`, a `prompt`
  containing `___`, an `answer`, and a one-line `fact`. `npm test` rejects
  duplicates, missing blanks and answers that already appear in the prompt.
- **Situations:** `src/content/situations.js`. Plain sentences that complete
  "most likely to ...".
- **Timers and scoring:** `BLUFF_TIMING` / `BLUFF_POINTS` in
  `src/games/bluff.js`, `ML_TIMING` in `src/games/mostlikely.js`.
- **Branding:** colours in `src/games/base.js`, wording in the `view()` methods.

No build step. Edit, restart.

---

## Project layout

```
src/
  index.js              boot: .env, then app
  app.js                client, commands, router, shutdown
  router.js             commands, buttons and modals, with one error boundary
  game-service.js       live games, channel/player locks, stats recording
  session.js            one game ↔ one message ↔ one timer
  ui.js                 view model → Discord payload, with hard limits
  store.js              atomic JSON stats, scoped per server
  permissions.js        the invite link and the exact permission ask
  commands/             bluff, mostlikely, stats, top, help
  games/
    base.js             lobby, text safety, shared formatting
    bluff.js            rounds, submissions, votes, scoring
    mostlikely.js       player voting and majority scoring
  content/
    prompts.js          68 bluff prompts with real answers
    situations.js       50 most-likely-to prompts
scripts/
  deploy.js             register slash commands
  doctor.js             setup check + invite link
test/                   50 offline tests
```

---

## Troubleshooting

| symptom | cause | fix |
|---|---|---|
| commands do not appear | `applications.commands` scope missing, or deploy skipped | re-invite with the scope, run `npm run deploy` |
| commands appear slowly | global registration | set `GUILD_ID` and redeploy for instant updates |
| "The application did not respond" | an interaction threw before replying | check the console; the router logs the stack |
| buttons say the game has ended | the bot restarted, or the game was cancelled | games are in memory; start a new one |
| a lie never shows up | blank, under 2 characters, over 80, or it merged with an identical one | try a different answer |
| the lobby says nobody started | five minutes passed before three players joined | run the command again |
| stats reset after a deploy | the host uses an ephemeral disk | mount a volume, or accept it |
| invite link missing from `/help` | `CLIENT_ID` is not set | add it to `.env` and restart |
| no invite button on the podium | same as above | same |

---

## Licence

MIT. No paid commands, no keys, no tracking.
