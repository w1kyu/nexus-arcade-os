// @ts-check

export class SortingAudioSynthesizer {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = false;
  }

  ensureContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.ensureContext();
    return this.enabled;
  }

  /**
   * Plays a pitch proportional to value.
   * @param {number} val
   * @param {number} minVal
   * @param {number} maxVal
   * @param {number} [durationMs]
   */
  playTone(val, minVal = 1, maxVal = 100, durationMs = 40) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const minFreq = 140;
      const maxFreq = 960;
      const normalized = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
      const freq = minFreq + normalized * (maxFreq - minFreq);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio not permitted or interrupted
    }
  }
}
