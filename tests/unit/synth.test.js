// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { midiToFreq } from '../../src/apps/synth/engine.js';
import { SYNTH_PRESETS } from '../../src/apps/synth/presets.js';
import { Arpeggiator } from '../../src/apps/synth/arpeggiator.js';

describe('Synthesizer Engine, Presets & Arpeggiator', () => {
  it('converts MIDI note numbers to standard tuning frequencies (A4 = 440Hz)', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 2); // A4
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1); // Middle C (C4)
    expect(midiToFreq(81)).toBeCloseTo(880, 2); // A5
    expect(midiToFreq(57)).toBeCloseTo(220, 2); // A3
  });

  it('validates structure of built-in sound presets', () => {
    const presetKeys = Object.keys(SYNTH_PRESETS);
    expect(presetKeys.length).toBeGreaterThanOrEqual(4);

    for (const key of presetKeys) {
      const p = SYNTH_PRESETS[key];
      expect(p.name).toBeDefined();
      expect(p.osc1).toBeDefined();
      expect(p.osc2).toBeDefined();
      expect(p.filter).toBeDefined();
      expect(p.filter.cutoff).toBeGreaterThan(0);
      expect(p.ampEnv).toBeDefined();
      expect(p.ampEnv.attack).toBeGreaterThan(0);
      expect(p.ampEnv.release).toBeGreaterThan(0);
      expect(p.filterEnv).toBeDefined();
      expect(p.lfo).toBeDefined();
    }
  });

  it('generates correct note pools and cycles notes in Arpeggiator', () => {
    const mockEngine = {
      played: [],
      noteOn(note) {
        this.played.push({ action: 'on', note });
      },
      noteOff(note) {
        this.played.push({ action: 'off', note });
      },
    };

    const arp = new Arpeggiator(/** @type {any} */ (mockEngine));
    arp.octaves = 2;
    arp.mode = 'up';

    // Add C4 (60) and E4 (64)
    arp.addNote(60);
    arp.addNote(64);

    expect(arp.heldNotes).toEqual([60, 64]);

    arp.enabled = true;
    arp.currentIndex = 0;

    // Step 1: should play C4 (60)
    arp._step();
    expect(arp.lastPlayedNote).toBe(60);

    // Step 2: should turn off 60, play E4 (64)
    arp._step();
    expect(arp.lastPlayedNote).toBe(64);

    // Step 3 (octave 2): should play C5 (72)
    arp._step();
    expect(arp.lastPlayedNote).toBe(72);

    // Step 4 (octave 2): should play E5 (76)
    arp._step();
    expect(arp.lastPlayedNote).toBe(76);

    // Step 5: wrap around to C4 (60)
    arp._step();
    expect(arp.lastPlayedNote).toBe(60);

    arp.stop();
  });
});
