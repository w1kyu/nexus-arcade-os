// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { audioBufferToWav } from '../../src/apps/beatlab/wav-export.js';
import { DEFAULT_DRUM_PARAMS, DRUM_NAMES } from '../../src/apps/beatlab/synth-drums.js';

describe('Beat Lab Drum Synthesizer & WAV Export', () => {
  it('defines 8 standard drum instruments with default parameters', () => {
    expect(DRUM_NAMES.length).toBe(8);
    expect(DRUM_NAMES).toContain('kick');
    expect(DRUM_NAMES).toContain('snare');
    expect(DRUM_NAMES).toContain('hihatClosed');
    expect(DRUM_NAMES).toContain('hihatOpen');
    expect(DRUM_NAMES).toContain('clap');
    expect(DRUM_NAMES).toContain('tom');
    expect(DRUM_NAMES).toContain('rim');
    expect(DRUM_NAMES).toContain('cowbell');

    for (const name of DRUM_NAMES) {
      expect(DEFAULT_DRUM_PARAMS[name]).toBeDefined();
      expect(DEFAULT_DRUM_PARAMS[name].pitch).toBeGreaterThan(0);
      expect(DEFAULT_DRUM_PARAMS[name].decay).toBeGreaterThan(0);
    }
  });

  it('encodes AudioBuffer into valid WAV header and binary blob', async () => {
    // Construct fake AudioBuffer with 2 channels, 44100 Hz, 1000 samples
    const sampleRate = 44100;
    const length = 1000;
    const channels = [new Float32Array(length), new Float32Array(length)];

    // Fill sine wave into channel 0
    for (let i = 0; i < length; i++) {
      channels[0][i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI);
      channels[1][i] = Math.sin((i / sampleRate) * 880 * 2 * Math.PI);
    }

    const mockBuffer = {
      numberOfChannels: 2,
      sampleRate,
      length,
      getChannelData: (c) => channels[c],
    };

    const wavBlob = audioBufferToWav(/** @type {any} */ (mockBuffer));
    expect(wavBlob).toBeDefined();
    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBe(44 + length * 2 * 2); // 44 header + length * 2 channels * 2 bytes/sample

    const arrayBuffer = await wavBlob.arrayBuffer();
    const view = new DataView(arrayBuffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(magic).toBe('RIFF');
    expect(wave).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(44100); // sampleRate
    expect(view.getUint16(34, true)).toBe(16); // bitDepth
  });
});
