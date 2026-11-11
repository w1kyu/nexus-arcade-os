// @ts-check
// Tweening and easing functions

/**
 * Standard easing functions taking t in [0, 1] and returning ease value.
 */
export const Easing = {
  linear: (/** @type {number} */ t) => t,
  easeInQuad: (/** @type {number} */ t) => t * t,
  easeOutQuad: (/** @type {number} */ t) => t * (2 - t),
  easeInOutQuad: (/** @type {number} */ t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (/** @type {number} */ t) => t * t * t,
  easeOutCubic: (/** @type {number} */ t) => --t * t * t + 1,
  easeInOutCubic: (/** @type {number} */ t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeOutBounce: (/** @type {number} */ t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeOutElastic: (/** @type {number} */ t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
  },
  easeOutBack: (/** @type {number} */ t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/**
 * @typedef {object} Tween
 * @property {Record<string, any>} target
 * @property {Record<string, number>} from
 * @property {Record<string, number>} to
 * @property {number} duration
 * @property {number} elapsed
 * @property {(t: number) => number} easing
 * @property {((t: Tween) => void) | undefined} [onUpdate]
 * @property {((t: Tween) => void) | undefined} [onComplete]
 * @property {boolean} finished
 */

export class TweenManager {
  constructor() {
    /** @type {Set<Tween>} */
    this.tweens = new Set();
  }

  /**
   * @param {Record<string, any>} target
   * @param {Record<string, number>} to
   * @param {number} duration In seconds
   * @param {object} [options]
   * @param {(t: number) => number} [options.easing]
   * @param {(t: Tween) => void} [options.onUpdate]
   * @param {(t: Tween) => void} [options.onComplete]
   * @returns {Tween}
   */
  to(target, to, duration, { easing = Easing.easeOutQuad, onUpdate, onComplete } = {}) {
    /** @type {Record<string, number>} */
    const from = {};
    for (const key of Object.keys(to)) {
      from[key] = typeof target[key] === 'number' ? target[key] : 0;
    }
    /** @type {Tween} */
    const tween = {
      target,
      from,
      to,
      duration: Math.max(0.0001, duration),
      elapsed: 0,
      easing,
      onUpdate,
      onComplete,
      finished: false,
    };
    this.tweens.add(tween);
    return tween;
  }

  /**
   * @param {Tween} tween
   */
  cancel(tween) {
    this.tweens.delete(tween);
  }

  clear() {
    this.tweens.clear();
  }

  /**
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    if (this.tweens.size === 0) return;
    for (const tween of this.tweens) {
      tween.elapsed += dt;
      const progress = Math.min(1, tween.elapsed / tween.duration);
      const easeVal = tween.easing(progress);

      for (const key of Object.keys(tween.to)) {
        const start = tween.from[key];
        const end = tween.to[key];
        tween.target[key] = start + (end - start) * easeVal;
      }

      tween.onUpdate?.(tween);

      if (progress >= 1) {
        tween.finished = true;
        this.tweens.delete(tween);
        tween.onComplete?.(tween);
      }
    }
  }
}
