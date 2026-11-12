// @ts-check
import { playDrumSound } from './synth-drums.js';

/**
 * Lookahead Web Audio step sequencer scheduler with swing and offline rendering.
 */

export class BeatScheduler {
  /**
   * @param {BaseAudioContext} audioCtx
   * @param {AudioNode} destination
   * @param {(step: number, patternKey: string) => void} [onStep]
   */
  constructor(audioCtx, destination, onStep) {
    this.audioCtx = audioCtx;
    this.dest = destination;
    this.onStep = onStep;

    this.bpm = 120;
    this.swing = 0; // 0 to 75%
    this.stepsPerBar = 16;
    this.isPlaying = false;

    // Multi-pattern store: patterns[patternKey][trackName][step] = velocity (0.0 to 1.0)
    /** @type {Record<string, Record<string, number[]>>} */
    this.patterns = {
      A: this._createEmptyPattern(),
      B: this._createEmptyPattern(),
      C: this._createEmptyPattern(),
      D: this._createEmptyPattern(),
    };

    this.currentPatternKey = 'A';
    /** @type {string[]} */
    this.songChain = ['A'];
    this.songChainIndex = 0;
    this.songMode = false;

    // Track parameters & mute/solo
    /** @type {Record<string, { mute: boolean, solo: boolean, volume: number, params: any }>} */
    this.trackConfig = {
      kick: { mute: false, solo: false, volume: 1.0, params: {} },
      snare: { mute: false, solo: false, volume: 1.0, params: {} },
      hihatClosed: { mute: false, solo: false, volume: 1.0, params: {} },
      hihatOpen: { mute: false, solo: false, volume: 1.0, params: {} },
      clap: { mute: false, solo: false, volume: 1.0, params: {} },
      tom: { mute: false, solo: false, volume: 1.0, params: {} },
      rim: { mute: false, solo: false, volume: 1.0, params: {} },
      cowbell: { mute: false, solo: false, volume: 1.0, params: {} },
    };

    // Scheduler internal state
    this.currentStep = 0;
    this.nextNoteTime = 0.0;
    this.lookaheadMs = 25.0;
    this.scheduleAheadTime = 0.1; // 100ms
    /** @type {ReturnType<typeof setInterval> | null} */
    this._timer = null;
  }

  _createEmptyPattern() {
    return {
      kick: new Array(16).fill(0),
      snare: new Array(16).fill(0),
      hihatClosed: new Array(16).fill(0),
      hihatOpen: new Array(16).fill(0),
      clap: new Array(16).fill(0),
      tom: new Array(16).fill(0),
      rim: new Array(16).fill(0),
      cowbell: new Array(16).fill(0),
    };
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.songChainIndex = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this._timer = setInterval(() => this._schedulerLoop(), this.lookaheadMs);
  }

  stop() {
    this.isPlaying = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.currentStep = 0;
  }

  _schedulerLoop() {
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this._scheduleStep(this.currentStep, this.nextNoteTime);
      this._advanceStep();
    }
  }

  _scheduleStep(step, time) {
    const patternKey = this.songMode ? this.songChain[this.songChainIndex] || 'A' : this.currentPatternKey;
    const pattern = this.patterns[patternKey] || this.patterns.A;

    const anySolo = Object.values(this.trackConfig).some((c) => c.solo);

    for (const [track, steps] of Object.entries(pattern)) {
      const cfg = this.trackConfig[track];
      if (cfg.mute) continue;
      if (anySolo && !cfg.solo) continue;

      const vel = steps[step];
      if (vel > 0) {
        playDrumSound(track, this.audioCtx, this.dest, time, vel * cfg.volume, cfg.params);
      }
    }

    // Schedule UI callback
    const delay = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isPlaying) {
        this.onStep?.(step, patternKey);
      }
    }, delay);
  }

  _advanceStep() {
    // 16th note step duration in seconds
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = 0.25 * secondsPerBeat;

    // Apply swing on odd steps
    let swingDelta = 0;
    if (this.currentStep % 2 === 1) {
      swingDelta = (this.swing / 100) * (stepDuration * 0.4);
    }
    this.nextNoteTime += stepDuration + swingDelta;

    this.currentStep++;
    if (this.currentStep >= this.stepsPerBar) {
      this.currentStep = 0;
      if (this.songMode) {
        this.songChainIndex = (this.songChainIndex + 1) % this.songChain.length;
      }
    }
  }

  /**
   * Renders the song or pattern offline to an AudioBuffer for WAV export.
   * @param {number} [bars]
   * @returns {Promise<AudioBuffer>}
   */
  async renderOffline(bars = 4) {
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = 0.25 * secondsPerBeat;
    const barDuration = stepDuration * 16;
    const totalDuration = barDuration * bars + 1.0; // +1s for natural drum decays

    const offlineCtx = new OfflineAudioContext(2, Math.ceil(44100 * totalDuration), 44100);
    const dest = offlineCtx.destination;

    let time = 0.05;
    for (let b = 0; b < bars; b++) {
      const patternKey = this.songMode ? this.songChain[b % this.songChain.length] || 'A' : this.currentPatternKey;
      const pattern = this.patterns[patternKey] || this.patterns.A;
      const anySolo = Object.values(this.trackConfig).some((c) => c.solo);

      for (let s = 0; s < 16; s++) {
        let stepTime = time + s * stepDuration;
        if (s % 2 === 1) {
          stepTime += (this.swing / 100) * (stepDuration * 0.4);
        }

        for (const [track, steps] of Object.entries(pattern)) {
          const cfg = this.trackConfig[track];
          if (cfg.mute) continue;
          if (anySolo && !cfg.solo) continue;
          const vel = steps[s];
          if (vel > 0) {
            playDrumSound(track, offlineCtx, dest, stepTime, vel * cfg.volume, cfg.params);
          }
        }
      }
      time += barDuration;
    }

    return await offlineCtx.startRendering();
  }
}
