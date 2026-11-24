# Contributing to Baloney

Thanks for helping. Baloney is deliberately small: no build step, no database,
one dependency. Keep it that way.

## Set up

```bash
npm install
npm run check     # import every module, no token needed
npm test          # 120 offline tests
```

You do **not** need a Discord token to work on game logic, content, progression
or the store.

## Rules of the road

- **Node 20+**, ESM, two-space indentation, single quotes, semicolons. Follow the
  surrounding file.
- **Game logic never imports `discord.js`.** Games return a view model; `ui.js`
  turns it into a payload.
- **One game is one message.** Do not add a second post during a round.
- **Player text is hostile.** Run names through `safeName`, text through `clean`
  or `truncate`, and never trust a custom id.
- **Everything is free.** No paid commands, no API keys, no external services.
- **No new runtime dependencies** without a strong reason. Discord.js is the only
  one today.

## Adding a game

1. Add an engine in `src/games/<name>.js` extending `Lobby` or `RoundGame`.
   Implement `view()`, the actions (`vote`/`submit`), `finalLine()` and, if it
   needs typing, `writeForm()`.
2. Register it in `src/games/index.js` with a label, namespace, player limits,
   default rounds, maximum rounds and a one-line blurb.
3. Add `src/commands/<name>.js`:

   ```js
   import { gameCommand } from '../game-command.js';
   export default gameCommand('<name>');
   ```

4. Add it to a party playlist only if it supports at least three players.
5. Add coverage in `test/games.test.js` and the views test. `npm test` must stay
   green.
6. Update the README game table and `CHANGELOG.md`.

## Adding content

Content banks are plain arrays in `src/content/`. Each bank has an integrity test
in `test/content.test.js`. If you add a trivia question, a bluff prompt or a
scatter category, run `npm test`; the test will reject duplicates, leaked
answers, wrong lengths and unbalanced data.

Bluff prompt requirements:

- stable `id` (`p69`, `p70`, …)
- a `prompt` containing `___`
- an `answer` of at most 48 characters
- a one-line `fact` of at most 300 characters
- no word from the answer may appear in the prompt

## Tests

```bash
npm test                  # everything
node --test test/games.test.js
npm run test:coverage
```

Tests must not touch the network, the real stats file or Discord. Use
`test-support/helpers.js` for `table()`, `assertPayload()`, `memoryStore()` and
fake interactions.

## Commits and pull requests

- One focused change per commit, present tense: `add scatter game`.
- Include the tests that prove it.
- If behaviour changes, update `CHANGELOG.md`.
- Do not commit `.env`, `data/`, `node_modules/` or tokens.

By contributing you agree that your work is licensed under the MIT licence.
