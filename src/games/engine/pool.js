// @ts-check
// Generic object pool to avoid garbage collection spikes in games

/**
 * @template T
 */
export class ObjectPool {
  /**
   * @param {() => T} createFn
   * @param {(item: T) => void} [resetFn]
   * @param {number} [initialSize]
   */
  constructor(createFn, resetFn, initialSize = 32) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    /** @type {T[]} */
    this.available = [];
    /** @type {Set<T>} */
    this.active = new Set();

    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.createFn());
    }
  }

  /**
   * Acquires an object from the pool, reusing an existing one or creating if empty.
   * @returns {T}
   */
  acquire() {
    let item = this.available.pop();
    if (!item) {
      item = this.createFn();
    }
    this.resetFn?.(item);
    this.active.add(item);
    return item;
  }

  /**
   * Returns an object back to the pool.
   * @param {T} item
   */
  release(item) {
    if (this.active.delete(item)) {
      this.available.push(item);
    }
  }

  /**
   * Releases all currently active objects back to the pool.
   */
  releaseAll() {
    for (const item of this.active) {
      this.available.push(item);
    }
    this.active.clear();
  }

  get activeCount() {
    return this.active.size;
  }

  get availableCount() {
    return this.available.length;
  }
}
