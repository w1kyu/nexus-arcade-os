// @ts-check
/**
 * Presets library for Synthesizer.
 */

export const SYNTH_PRESETS = {
  cyberpunkLead: {
    name: 'Cyberpunk Lead',
    masterGain: 0.8,
    osc1: { type: 'sawtooth', octave: 0, semi: 0, fine: 0, gain: 0.6 },
    osc2: { type: 'square', octave: 0, semi: 7, fine: 8, gain: 0.5 },
    filter: { type: 'lowpass', cutoff: 3500, resonance: 4.5, envAmount: 0.6 },
    filterEnv: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.3 },
    ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.25 },
    lfo: { type: 'sine', rate: 5.5, depth: 0.15, target: 'filter' },
  },
  subBass: {
    name: '808 Sub Bass',
    masterGain: 0.9,
    osc1: { type: 'sine', octave: -1, semi: 0, fine: 0, gain: 0.9 },
    osc2: { type: 'triangle', octave: -1, semi: 0, fine: 0, gain: 0.3 },
    filter: { type: 'lowpass', cutoff: 400, resonance: 1.5, envAmount: 0.2 },
    filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.4 },
    ampEnv: { attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.5 },
    lfo: { type: 'sine', rate: 2.0, depth: 0, target: 'filter' },
  },
  retroBrass: {
    name: 'Retro Poly Brass',
    masterGain: 0.75,
    osc1: { type: 'sawtooth', octave: 0, semi: 0, fine: -6, gain: 0.5 },
    osc2: { type: 'sawtooth', octave: 0, semi: 0, fine: 6, gain: 0.5 },
    filter: { type: 'lowpass', cutoff: 2200, resonance: 3.0, envAmount: 0.7 },
    filterEnv: { attack: 0.08, decay: 0.35, sustain: 0.4, release: 0.4 },
    ampEnv: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.45 },
    lfo: { type: 'triangle', rate: 4.0, depth: 0.1, target: 'pitch' },
  },
  dreamPad: {
    name: 'Dream Pad',
    masterGain: 0.7,
    osc1: { type: 'sawtooth', octave: 0, semi: 0, fine: -8, gain: 0.45 },
    osc2: { type: 'triangle', octave: 1, semi: 0, fine: 8, gain: 0.45 },
    filter: { type: 'lowpass', cutoff: 1800, resonance: 2.0, envAmount: 0.4 },
    filterEnv: { attack: 0.4, decay: 0.8, sustain: 0.7, release: 1.2 },
    ampEnv: { attack: 0.35, decay: 0.6, sustain: 0.8, release: 1.0 },
    lfo: { type: 'sine', rate: 1.2, depth: 0.25, target: 'filter' },
  },
  chiptuneArp: {
    name: 'Chiptune Arp',
    masterGain: 0.75,
    osc1: { type: 'square', octave: 1, semi: 0, fine: 0, gain: 0.7 },
    osc2: { type: 'triangle', octave: 0, semi: 0, fine: 0, gain: 0.4 },
    filter: { type: 'lowpass', cutoff: 6000, resonance: 1.0, envAmount: 0.2 },
    filterEnv: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.1 },
    ampEnv: { attack: 0.005, decay: 0.15, sustain: 0.5, release: 0.12 },
    lfo: { type: 'square', rate: 8.0, depth: 0, target: 'pitch' },
  },
};
