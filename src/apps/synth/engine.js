// @ts-check
import { SynthEffectsRack } from './effects.js';

export function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Creates noise buffer for noise oscillator.
 * @param {BaseAudioContext} ctx
 * @returns {AudioBuffer}
 */
function getNoiseBuffer(ctx) {
  const size = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Single Polyphonic Voice.
 */
class SynthVoice {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} dest
   * @param {number} midiNote
   * @param {number} velocity
   * @param {object} patch
   */
  constructor(ctx, dest, midiNote, velocity, patch) {
    this.ctx = ctx;
    this.midiNote = midiNote;
    this.baseFreq = midiToFreq(midiNote);
    this.patch = patch;
    this.isReleased = false;

    const now = ctx.currentTime;

    // Filter Node
    this.filter = ctx.createBiquadFilter();
    this.filter.type = patch.filter.type || 'lowpass';
    this.filter.Q.value = patch.filter.resonance ?? 3.0;

    // Filter ADSR Envelope
    const baseCutoff = Math.max(20, Math.min(20000, patch.filter.cutoff ?? 2000));
    const envAmt = (patch.filter.envAmount ?? 0.5) * 8000;
    const fA = Math.max(0.005, patch.filterEnv.attack ?? 0.05);
    const fD = Math.max(0.01, patch.filterEnv.decay ?? 0.2);
    const fS = Math.max(0, Math.min(1, patch.filterEnv.sustain ?? 0.4));

    this.filter.frequency.setValueAtTime(baseCutoff, now);
    this.filter.frequency.linearRampToValueAtTime(Math.max(20, baseCutoff + envAmt), now + fA);
    this.filter.frequency.exponentialRampToValueAtTime(Math.max(20, baseCutoff + envAmt * fS), now + fA + fD);

    // Voice Gain Node (Amp Envelope)
    this.voiceGain = ctx.createGain();
    const aA = Math.max(0.005, patch.ampEnv.attack ?? 0.02);
    const aD = Math.max(0.01, patch.ampEnv.decay ?? 0.25);
    const aS = Math.max(0.001, Math.min(1, patch.ampEnv.sustain ?? 0.6));
    const maxGain = (velocity / 127) * (patch.masterGain ?? 0.8);

    this.voiceGain.gain.setValueAtTime(0.0001, now);
    this.voiceGain.gain.linearRampToValueAtTime(maxGain, now + aA);
    this.voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, maxGain * aS), now + aA + aD);

    // Oscillators 1 & 2
    this.osc1 = this._createOscillator(patch.osc1, this.baseFreq);
    this.osc2 = this._createOscillator(patch.osc2, this.baseFreq);

    // Connect Osc -> Filter -> VoiceGain -> Destination
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.filter.connect(this.voiceGain);
    this.voiceGain.connect(dest);

    // LFO Modulation
    if (patch.lfo && patch.lfo.depth > 0) {
      this.lfo = ctx.createOscillator();
      this.lfo.type = patch.lfo.type || 'sine';
      this.lfo.frequency.value = patch.lfo.rate ?? 5.0;

      const lfoGain = ctx.createGain();
      if (patch.lfo.target === 'filter') {
        lfoGain.gain.value = patch.lfo.depth * 3000;
        this.lfo.connect(lfoGain);
        lfoGain.connect(this.filter.frequency);
      } else if (patch.lfo.target === 'pitch') {
        lfoGain.gain.value = patch.lfo.depth * 50; // cents
        this.lfo.connect(lfoGain);
        if ('detune' in this.osc1) lfoGain.connect(/** @type {any} */ (this.osc1).detune);
        if ('detune' in this.osc2) lfoGain.connect(/** @type {any} */ (this.osc2).detune);
      }
      this.lfo.start(now);
    }

    if ('start' in this.osc1) this.osc1.start(now);
    if ('start' in this.osc2) this.osc2.start(now);
  }

  _createOscillator(cfg, freq) {
    const pitchOffset = (cfg.octave || 0) * 12 + (cfg.semi || 0);
    const targetFreq = freq * Math.pow(2, pitchOffset / 12);

    if (cfg.type === 'noise') {
      const src = this.ctx.createBufferSource();
      src.buffer = getNoiseBuffer(this.ctx);
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = cfg.gain ?? 0.5;
      src.connect(gain);
      src.start();
      return gain;
    }

    const osc = this.ctx.createOscillator();
    osc.type = cfg.type || 'sawtooth';
    osc.frequency.value = targetFreq;
    if (cfg.fine) osc.detune.value = cfg.fine;

    const gain = this.ctx.createGain();
    gain.gain.value = cfg.gain ?? 0.5;
    osc.connect(gain);
    return osc;
  }

  release() {
    if (this.isReleased) return;
    this.isReleased = true;
    const now = this.ctx.currentTime;
    const releaseTime = Math.max(0.02, this.patch.ampEnv.release ?? 0.3);

    this.voiceGain.gain.cancelScheduledValues(now);
    this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, now);
    this.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    setTimeout(
      () => {
        try {
          if ('stop' in this.osc1) this.osc1.stop();
          if ('stop' in this.osc2) this.osc2.stop();
          if (this.lfo) this.lfo.stop();
        } catch {
          /* ignore */
        }
      },
      releaseTime * 1000 + 50,
    );
  }
}

/**
 * Main Synthesizer Engine.
 */
export class SynthEngine {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} [dest]
   */
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.outputNode = dest || ctx.destination;

    // Effects rack
    this.effects = new SynthEffectsRack(ctx, this.outputNode);

    // Analyser node for oscilloscope and spectrum display
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.effects.output.connect(this.analyser);

    /** @type {Map<number, SynthVoice>} */
    this.voices = new Map();

    // Default Patch
    this.patch = {
      masterGain: 0.75,
      osc1: { type: 'sawtooth', octave: 0, semi: 0, fine: 0, gain: 0.5 },
      osc2: { type: 'square', octave: 0, semi: 7, fine: 5, gain: 0.4 },
      filter: { type: 'lowpass', cutoff: 2800, resonance: 4.0, envAmount: 0.6 },
      filterEnv: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.4 },
      ampEnv: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.35 },
      lfo: { type: 'sine', rate: 4.0, depth: 0.2, target: 'filter' },
    };
  }

  noteOn(midiNote, velocity = 100) {
    // If voice already playing this note, release it
    if (this.voices.has(midiNote)) {
      this.voices.get(midiNote)?.release();
    }
    const voice = new SynthVoice(this.ctx, this.effects.input, midiNote, velocity, this.patch);
    this.voices.set(midiNote, voice);
  }

  noteOff(midiNote) {
    const voice = this.voices.get(midiNote);
    if (voice) {
      voice.release();
      this.voices.delete(midiNote);
    }
  }

  allNotesOff() {
    for (const [, voice] of this.voices) {
      voice.release();
    }
    this.voices.clear();
  }

  getWaveformData(array) {
    const data = array || new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  getFrequencyData(array) {
    const data = array || new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}
