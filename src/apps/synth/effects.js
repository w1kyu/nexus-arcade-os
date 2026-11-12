// @ts-check
/**
 * Synthesizer audio effects rack: Delay, Distortion, Chorus, and Reverb.
 */

/**
 * Creates an algorithmic impulse response buffer for ConvolverNode reverb.
 * @param {BaseAudioContext} ctx
 * @param {number} duration - In seconds (default 2.0)
 * @param {number} decay - Decay factor (default 2.5)
 * @returns {AudioBuffer}
 */
export function createReverbImpulse(ctx, duration = 2.0, decay = 2.5) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const factor = Math.exp(-t * decay);
    // Decorrelated noise for stereo widening
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }

  return impulse;
}

/**
 * Creates a distortion wave shaper curve.
 * @param {number} k - Distortion amount (0 to 100)
 * @returns {Float32Array}
 */
export function makeDistortionCurve(k = 20) {
  const n = 4096;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export class SynthEffectsRack {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} dest
   */
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.input = ctx.createGain();

    // 1. Distortion
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = makeDistortionCurve(0);
    this.shaper.oversample = '4x';
    this.distGain = ctx.createGain();
    this.distGain.gain.value = 0.0;

    // 2. Delay
    this.delay = ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.35;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.35;
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0.25;

    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayWet);

    // 3. Reverb
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = createReverbImpulse(ctx, 2.0, 2.8);
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = 0.2;
    this.convolver.connect(this.reverbWet);

    // Master Dry / Output
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.85;

    this.output = ctx.createGain();

    // Connect graph
    this.input.connect(this.dryGain);
    this.input.connect(this.delay);
    this.input.connect(this.convolver);
    this.input.connect(this.shaper);

    this.dryGain.connect(this.output);
    this.delayWet.connect(this.output);
    this.reverbWet.connect(this.output);
    this.shaper.connect(this.output);

    this.output.connect(dest);
  }

  setDelay(time, feedback, wet) {
    this.delay.delayTime.setTargetAtTime(Math.max(0.01, Math.min(2.0, time)), this.ctx.currentTime, 0.02);
    this.delayFeedback.gain.setTargetAtTime(Math.max(0, Math.min(0.9, feedback)), this.ctx.currentTime, 0.02);
    this.delayWet.gain.setTargetAtTime(Math.max(0, Math.min(1.0, wet)), this.ctx.currentTime, 0.02);
  }

  setReverb(wet) {
    this.reverbWet.gain.setTargetAtTime(Math.max(0, Math.min(1.0, wet)), this.ctx.currentTime, 0.02);
  }

  setDistortion(amount) {
    if (amount <= 0) {
      this.shaper.curve = null;
    } else {
      this.shaper.curve = makeDistortionCurve(amount * 50);
    }
  }
}
