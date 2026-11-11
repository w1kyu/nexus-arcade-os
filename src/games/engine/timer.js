// @ts-check
// Game timer manager tied to engine timestep (pauses and scales with game)

/**
 * @typedef {object} GameTimer
 * @property {number} duration
 * @property {number} remaining
 * @property {boolean} repeat
 * @property {() => void} callback
 * @property {boolean} active
 */

export class TimerManager {
  constructor() {
    /** @type {Set<GameTimer>} */
    this.timers = new Set();
  }

  /**
   * @param {number} seconds
   * @param {() => void} callback
   * @returns {GameTimer}
   */
  after(seconds, callback) {
    const timer = {
      duration: seconds,
      remaining: seconds,
      repeat: false,
      callback,
      active: true,
    };
    this.timers.add(timer);
    return timer;
  }

  /**
   * @param {number} seconds
   * @param {() => void} callback
   * @returns {GameTimer}
   */
  every(seconds, callback) {
    const timer = {
      duration: seconds,
      remaining: seconds,
      repeat: true,
      callback,
      active: true,
    };
    this.timers.add(timer);
    return timer;
  }

  /** @param {GameTimer} timer */
  cancel(timer) {
    timer.active = false;
    this.timers.delete(timer);
  }

  clear() {
    for (const t of this.timers) t.active = false;
    this.timers.clear();
  }

  /** @param {number} dt */
  update(dt) {
    for (const timer of this.timers) {
      if (!timer.active) {
        this.timers.delete(timer);
        continue;
      }
      timer.remaining -= dt;
      if (timer.remaining <= 0) {
        timer.callback();
        if (timer.repeat && timer.active) {
          timer.remaining += timer.duration;
        } else {
          timer.active = false;
          this.timers.delete(timer);
        }
      }
    }
  }
}
