// @ts-check
// Fixed-timestep 60Hz game loop with interpolated rendering, time scaling, and auto-pause

/**
 * @typedef {object} GameLoopOptions
 * @property {(dt: number) => void} update Fixed timestep update (dt is in seconds, e.g. 1/60)
 * @property {(alpha: number) => void} render Render call with interpolation alpha [0, 1]
 * @property {number} [targetFps] Default 60
 * @property {number} [maxSubSteps] Max updates to catch up per frame (prevent spiral of death)
 * @property {boolean} [autoPauseOnBlur] Auto pause on window blur/visibilitychange (default true)
 * @property {HTMLElement | Window} [focusTarget] Element to watch for blur/focus events
 */

export class GameLoop {
  /**
   * @param {GameLoopOptions} options
   */
  constructor({
    update,
    render,
    targetFps = 60,
    maxSubSteps = 5,
    autoPauseOnBlur = true,
    focusTarget = typeof window !== 'undefined' ? window : undefined,
  }) {
    this.updateFn = update;
    this.renderFn = render;
    this.fixedDelta = 1 / targetFps;
    this.maxSubSteps = maxSubSteps;
    this.timeScale = 1.0;

    this.running = false;
    this.paused = false;
    this.autoPaused = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.frameId = 0;

    /** @type {(() => void)[]} */
    this.cleanups = [];

    if (autoPauseOnBlur && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.hidden) {
          if (!this.paused) {
            this.autoPaused = true;
            this.paused = true;
          }
        } else if (this.autoPaused) {
          this.autoPaused = false;
          this.paused = false;
          this.lastTime = performance.now();
        }
      };

      const onBlur = () => {
        if (!this.paused) {
          this.autoPaused = true;
          this.paused = true;
        }
      };

      const onFocus = () => {
        if (this.autoPaused) {
          this.autoPaused = false;
          this.paused = false;
          this.lastTime = performance.now();
        }
      };

      document.addEventListener('visibilitychange', onVisibilityChange);
      this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));

      if (focusTarget) {
        focusTarget.addEventListener('blur', onBlur);
        focusTarget.addEventListener('focus', onFocus);
        this.cleanups.push(() => {
          focusTarget.removeEventListener('blur', onBlur);
          focusTarget.removeEventListener('focus', onFocus);
        });
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;

    const loop = (now) => {
      if (!this.running) return;

      const rawDelta = Math.min((now - this.lastTime) / 1000, 0.25); // Cap to 250ms
      this.lastTime = now;

      if (!this.paused) {
        const scaledDelta = rawDelta * this.timeScale;
        this.accumulator += scaledDelta;

        let steps = 0;
        while (this.accumulator >= this.fixedDelta && steps < this.maxSubSteps) {
          this.updateFn(this.fixedDelta);
          this.accumulator -= this.fixedDelta;
          steps++;
        }

        // Drop remaining accumulator if lagging too much
        if (steps >= this.maxSubSteps) {
          this.accumulator = 0;
        }

        const alpha = Math.max(0, Math.min(1, this.accumulator / this.fixedDelta));
        this.renderFn(alpha);
      } else {
        // Render current state without stepping physics
        this.renderFn(1);
      }

      this.frameId = requestAnimationFrame(loop);
    };

    this.frameId = requestAnimationFrame(loop);
  }

  pause() {
    this.paused = true;
    this.autoPaused = false;
  }

  resume() {
    this.paused = false;
    this.autoPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
    return this.paused;
  }

  isPaused() {
    return this.paused;
  }

  stop() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  dispose() {
    this.stop();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }
}
