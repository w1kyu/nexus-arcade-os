// @ts-check
/**
 * Fully synthesized drum synthesizer engine using Web Audio API nodes.
 * No external samples or recordings needed.
 */

/**
 * Creates a white noise buffer.
 * @param {BaseAudioContext} ctx
 * @param {number} duration
 * @returns {AudioBuffer}
 */
function createNoiseBuffer(ctx, duration = 0.5) {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export const DRUM_NAMES = ['kick', 'snare', 'hihatClosed', 'hihatOpen', 'clap', 'tom', 'rim', 'cowbell'];

export const DEFAULT_DRUM_PARAMS = {
  kick: { pitch: 55, decay: 0.35, tone: 0.5 },
  snare: { pitch: 180, decay: 0.22, tone: 0.7 },
  hihatClosed: { pitch: 8000, decay: 0.05, tone: 0.6 },
  hihatOpen: { pitch: 7500, decay: 0.38, tone: 0.6 },
  clap: { pitch: 1200, decay: 0.25, tone: 0.8 },
  tom: { pitch: 110, decay: 0.3, tone: 0.4 },
  rim: { pitch: 1800, decay: 0.03, tone: 0.5 },
  cowbell: { pitch: 560, decay: 0.3, tone: 0.5 },
};

/**
 * Plays a synthesized drum sound.
 * @param {string} instrument - 'kick' | 'snare' | 'hihatClosed' | etc.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} time
 * @param {number} [velocity] - 0.0 to 1.0
 * @param {object} [params] - { pitch, decay, tone }
 */
export function playDrumSound(instrument, ctx, dest, time, velocity = 0.8, params = {}) {
  const p = { ...DEFAULT_DRUM_PARAMS[instrument], ...params };
  const vel = Math.max(0.01, Math.min(1.0, velocity));

  switch (instrument) {
    case 'kick': {
      // Sine wave with rapid exponential pitch envelope + gain envelope
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startFreq = p.pitch * 3.5;
      const endFreq = Math.max(25, p.pitch * 0.6);
      const decayTime = Math.max(0.08, p.decay * 0.8);

      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + decayTime);

      gain.gain.setValueAtTime(vel * 1.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(time);
      osc.stop(time + decayTime + 0.05);
      break;
    }

    case 'snare': {
      // Noise component + tonal triangle drop
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.4);

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000 * p.tone, time);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vel * 0.8, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);

      // Body tone
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(p.pitch, time);
      osc.frequency.exponentialRampToValueAtTime(p.pitch * 0.4, time + 0.1);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(vel * 0.7, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      osc.connect(oscGain);
      oscGain.connect(dest);

      noise.start(time);
      noise.stop(time + p.decay + 0.05);
      osc.start(time);
      osc.stop(time + 0.2);
      break;
    }

    case 'hihatClosed': {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.1);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(p.pitch, time);
      filter.Q.value = 5.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(time);
      noise.stop(time + p.decay + 0.02);
      break;
    }

    case 'hihatOpen': {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.6);

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(p.pitch * 0.9, time);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.65, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(time);
      noise.stop(time + p.decay + 0.05);
      break;
    }

    case 'clap': {
      // 3 rapid noise micro-bursts followed by sustained decay
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.5);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(p.pitch, time);
      filter.Q.value = 2.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.setValueAtTime(vel * 0.7, time);
      gain.gain.setValueAtTime(0.001, time + 0.012);
      gain.gain.setValueAtTime(vel * 0.75, time + 0.013);
      gain.gain.setValueAtTime(0.001, time + 0.025);
      gain.gain.setValueAtTime(vel * 0.8, time + 0.026);
      gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(time);
      noise.stop(time + p.decay + 0.05);
      break;
    }

    case 'tom': {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.pitch * 1.6, time);
      osc.frequency.exponentialRampToValueAtTime(p.pitch, time + p.decay);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.9, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(time);
      osc.stop(time + p.decay + 0.05);
      break;
    }

    case 'rim': {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(p.pitch, time);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(p.pitch, time);
      filter.Q.value = 10;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.85, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(time);
      osc.stop(time + p.decay + 0.02);
      break;
    }

    case 'cowbell': {
      // 2 detuned bandpass square waves
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(p.pitch, time);
      osc2.frequency.setValueAtTime(p.pitch * 1.5, time);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(p.pitch * 1.25, time);
      filter.Q.value = 3;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + p.decay);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + p.decay + 0.05);
      osc2.stop(time + p.decay + 0.05);
      break;
    }
  }
}
