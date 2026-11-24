import { toPayload } from './ui.js';

const MAX_DELAY = 2_000_000_000; // setTimeout caps out around 24.8 days
const MAX_TRANSITIONS = 16;

/**
 * Binds a game to one Discord message and one timer.
 *
 * Games that finish can hand the session a successor (party night does this),
 * in which case the same message carries on with the next game instead of the
 * session closing. Timers are injectable so the whole lifecycle can be tested
 * without waiting.
 */
export class Session {
  constructor({
    game,
    update,
    onEnd,
    onClose,
    planNext,
    invite = null,
    timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle) },
    now = () => Date.now(),
    log = () => {}
  }) {
    this.game = game;
    this.update = update;
    this.onEnd = onEnd;
    this.onClose = onClose;
    this.planNext = planNext;
    this.invite = invite;
    this.timers = timers;
    this.now = now;
    this.log = log;

    this.timer = null;
    this.ended = false;
    this.rendering = false;
    this.dirty = false;
    this.transitions = 0;
  }

  get id() {
    return this.game.id;
  }

  get phase() {
    return this.game.phase;
  }

  /**
   * Render, coalescing bursts. A vote and a phase change often land together;
   * one edit is enough and it keeps us well clear of rate limits.
   */
  async render() {
    if (this.ended) return;
    if (this.rendering) {
      this.dirty = true;
      return;
    }

    this.rendering = true;
    try {
      do {
        this.dirty = false;
        await this.update(toPayload(this.game.view(), { invite: this.invite }));
      } while (this.dirty && !this.ended);
    } catch (err) {
      // The message was deleted, the channel was nuked, or we lost permissions.
      this.log(`cannot update game message: ${err.message}`);
      await this.finish('lost-message');
    } finally {
      this.rendering = false;
    }
  }

  clearTimer() {
    if (!this.timer) return;
    this.timers.clear(this.timer);
    this.timer = null;
  }

  arm() {
    this.clearTimer();
    if (this.ended) return;

    const end = this.game.phaseEndsAt;
    if (!end) return;

    const delay = Math.max(50, Math.min(MAX_DELAY, end - this.now()));
    this.timer = this.timers.set(() => {
      this.onTimer().catch((err) => this.log(`timer failed: ${err.message}`));
    }, delay);
  }

  async onTimer() {
    if (this.ended) return;

    const end = this.game.phaseEndsAt;
    // Real timers can fire a hair early. Wait out the remainder instead of
    // closing a phase before its deadline.
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
    if (this.ended) return;

    if (this.game.closed || this.game.phase === 'done' || this.game.phase === 'dead') {
      await this.complete(this.game.phase);
      return;
    }

    this.arm();
  }

  /** A game finished: record it, then either continue the night or close. */
  async complete(reason = 'done') {
    if (this.ended) return;

    let current = reason;
    for (let guard = 0; guard < MAX_TRANSITIONS; guard += 1) {
      this.clearTimer();

      try {
        await this.onEnd?.(this.game, current);
      } catch (err) {
        this.log(`game end hook failed: ${err.message}`);
      }

      let next = null;
      try {
        next = (await this.planNext?.(this.game, current)) ?? null;
      } catch (err) {
        this.log(`next game failed: ${err.message}`);
      }

      if (!next) {
        await this.close(current);
        return;
      }

      this.game = next;
      this.transitions += 1;
      await this.render();
      if (this.ended) return;

      if (!next.closed) {
        this.arm();
        return;
      }

      current = next.phase;
    }

    this.log('too many game transitions in a row; closing the session');
    await this.close('loop-guard');
  }

  async close(reason = 'done') {
    if (this.ended) return;
    this.ended = true;
    this.clearTimer();

    try {
      await this.onClose?.(this.game, reason);
    } catch (err) {
      this.log(`cleanup failed: ${err.message}`);
    }
  }

  /** Close without recording anything: cancel, shutdown, or a lost message. */
  async finish(reason = 'closed') {
    if (this.ended) return;
    this.ended = true;
    this.clearTimer();

    try {
      await this.onClose?.(this.game, reason);
    } catch (err) {
      this.log(`cleanup failed: ${err.message}`);
    }
  }
}
