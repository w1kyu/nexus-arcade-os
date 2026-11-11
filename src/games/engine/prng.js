// @ts-check
// Seeded PRNG based on Mulberry32 for deterministic gameplay, daily challenges, and replays

export class SeededRng {
  /**
   * @param {number | string} [seed]
   */
  constructor(seed = Date.now()) {
    this.seed = 0;
    this.state = 0;
    this.reseed(seed);
  }

  /**
   * @param {number | string} seed
   */
  reseed(seed) {
    if (typeof seed === 'string') {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
      }
      this.seed = h;
    } else {
      this.seed = seed >>> 0;
    }
    this.state = this.seed;
  }

  /**
   * Returns a float in [0, 1)
   * @returns {number}
   */
  next() {
    let z = (this.state += 0x6d2b79f5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a float in [min, max)
   * @param {number} min
   * @param {number} max
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Returns an integer in [min, max] inclusive
   * @param {number} min
   * @param {number} max
   */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Chooses one random element from an array
   * @template T
   * @param {T[]} array
   * @returns {T}
   */
  choice(array) {
    return array[this.int(0, array.length - 1)];
  }

  /**
   * In-place Fisher-Yates shuffle
   * @template T
   * @param {T[]} array
   * @returns {T[]}
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
