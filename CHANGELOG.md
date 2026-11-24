# Changelog

All notable changes to Baloney. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.1] — 2026-11-24

Documentation and packaging cleanup.

### Changed

- README now carries CI, Node, licence and version badges, a contents list and
  links to the self-hosting, game-rules and contributing docs.
- `.env.example` was trimmed to the two required values and one optional
  `GUILD_ID` line.
- Version bumped to 2.0.1.

## [2.0.0] — 2026-11-24

The "whole night" release: nine games, party mode and free progression.

### Added

- **Seven new games** alongside bluff and most likely to: trivia, would you
  rather, number, duel, chain story, impostor and scatter. Every game runs in one
  message that edits itself through every phase.
- **`/party`** with four playlists (`quick`, `classic`, `chaos`, `marathon`).
  One lobby, games back to back, 5/3/2/1 points per game, a break card between
  games and a champion board at the end.
- **Progression**: XP, levels, coins, 28 badges, daily streaks and six cosmetic
  card themes. Everything is earned by playing; nothing is purchasable.
- **`/profile`, `/daily`, `/badges`, `/shop`, `/theme`**, plus expanded `/stats`
  and `/top` metrics.
- **`/setup`** for optional per-server round defaults and pace, and `/debug` for
  the configured owner.
- **`/invite`** states the exact scopes, permission names and integer.
- **Store v2**: per-server keys, automatic migration from v1, one-generation
  `.bak`, corrupt-file quarantine, counter and badge clamping.
- **Docker** image and compose file, GitHub Actions CI, `npm run check`, and
  `npm run test:coverage`.
- **120 offline tests** covering all nine engines, party flow, progression, store
  migration and every screen against Discord's limits.

### Changed

- Content banks grew to 68 bluff prompts (six disjoint packs), 50 situations,
  60 trivia questions, 50 would-you-rather pairs, 46 impostor pairs, 40 chain
  openers and 44 scatter categories.
- Buttons are namespaced per game; modals use `gm:` and are validated against the
  live session.
- The router deduplicates interaction ids, so a reconnect cannot play a vote
  twice.
- Sessions coalesce renders, clamp long timers, and close cleanly when a message
  is deleted.
- Lobbies start automatically when full and every phase can close early when
  everybody has acted.
- Server round defaults are opt-in; each game decides its own rounds unless
  `/setup` overrides them.

### Fixed

- The number game now ranks distinct distances, so an exact guess followed by a
  far-off table scores correctly.
- The first game no longer leaves a lobby in an unrenderable state for games
  without a custom lobby card.
- Trivia records both correct answers and total answers for accuracy.
- Failed writes to the stats file recover on the next write instead of rejecting
  forever.
- A failed game post rolls back the host's channel lock.

## [1.0.0] — 2026-11-20

- Initial release: `/bluff` and `/mostlikely`, one message per game, per-server
  JSON stats, `/stats`, `/top`, `/help`, and a minimal permission ask.
