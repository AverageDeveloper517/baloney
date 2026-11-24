import { toPayload } from './ui.js';

/**
 * Binds a game to one Discord message and one timer. Everything the router
 * needs is here: render, advance, expire, clean up.
 *
 * Timers are injectable so the whole lifecycle can be tested without waiting.
 */
export class Session {
  constructor({
    game,
    update,
    onEnd,
    invite = null,
    timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle) },
    now = () => Date.now(),
    log = () => {}
  }) {
    this.game = game;
    this.update = update;
    this.onEnd = onEnd;
    this.invite = invite;
    this.timers = timers;
    this.now = now;
    this.log = log;

    this.timer = null;
    this.ended = false;
  }

  get id() {
    return this.game.id;
  }

  get phase() {
    return this.game.phase;
  }

  async render() {
    if (this.ended) return;
    try {
      await this.update(toPayload(this.game.view(), { invite: this.invite }));
    } catch (err) {
      // The message was deleted, the channel was nuked, or we lost permissions.
      // Either way the game cannot continue visibly.
      this.log(`cannot update game message: ${err.message}`);
      await this.finish('lost-message');
    }
  }

  arm() {
    if (this.timer) {
      this.timers.clear(this.timer);
      this.timer = null;
    }
    if (this.ended) return;

    const end = this.game.phaseEndsAt;
    if (!end) return;

    const delay = Math.max(50, end - this.now());
    this.timer = this.timers.set(() => {
      this.onTimer().catch((err) => this.log(`timer failed: ${err.message}`));
    }, delay);
  }

  async onTimer() {
    if (this.ended) return;

    // Real timers can fire a hair early. Wait out the remainder instead of
    // closing a phase before its deadline.
    const end = this.game.phaseEndsAt;
    if (end && this.now() < end - 25) {
      this.arm();
      return;
    }

    this.game.tick(this.now());
    await this.refresh({ advance: false });
  }

  /** Called after every player action and every timer. */
  async refresh({ advance = true } = {}) {
    if (this.ended) return;

    if (advance) this.game.advanceIfReady?.(this.now());

    await this.render();

    if (this.game.phase === 'done' || this.game.phase === 'dead') {
      await this.finish(this.game.phase);
      return;
    }

    this.arm();
  }

  async finish(reason = 'done') {
    if (this.ended) return;
    this.ended = true;

    if (this.timer) {
      this.timers.clear(this.timer);
      this.timer = null;
    }

    try {
      await this.onEnd?.(this.game, reason);
    } catch (err) {
      this.log(`cleanup failed: ${err.message}`);
    }
  }
}
