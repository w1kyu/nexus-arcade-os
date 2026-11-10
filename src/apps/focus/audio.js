// @ts-check
// Procedural Web Audio ambient sound generator for Focus (4.4).
// Generates rain, thunderstorm, white/pink/brown noise, café murmur,
// fireplace crackle, ocean waves, forest/birds, and binaural beats
// routed through ctx.sound.output('media').

/**
 * @typedef {'rain' | 'thunder' | 'white' | 'pink' | 'brown' | 'cafe' | 'fireplace' | 'ocean' | 'forest' | 'binaural'} AmbientChannelId
 */

/** @type {Array<{ id: AmbientChannelId, icon: string, labelKey: string }>} */
export const AMBIENT_CHANNELS = [
  { id: 'rain', icon: 'cloud', labelKey: 'soundRain' },
  { id: 'thunder', icon: 'zap', labelKey: 'soundThunder' },
  { id: 'white', icon: 'volume', labelKey: 'soundWhite' },
  { id: 'pink', icon: 'volume', labelKey: 'soundPink' },
  { id: 'brown', icon: 'volume', labelKey: 'soundBrown' },
  { id: 'cafe', icon: 'users', labelKey: 'soundCafe' },
  { id: 'fireplace', icon: 'flame', labelKey: 'soundFireplace' },
  { id: 'ocean', icon: 'globe', labelKey: 'soundOcean' },
  { id: 'forest', icon: 'sparkles', labelKey: 'soundForest' },
  { id: 'binaural', icon: 'headphones', labelKey: 'soundBinaural' },
];

/**
 * Generates a 3-second noise AudioBuffer (`'white' | 'pink' | 'brown' | 'crackle'`).
 * @param {AudioContext} actx
 * @param {'white' | 'pink' | 'brown' | 'crackle'} kind
 * @returns {AudioBuffer}
 */
function createNoiseBuffer(actx, kind) {
  const sampleRate = actx.sampleRate || 44100;
  const length = sampleRate * 3;
  const buffer = actx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (kind === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }
  } else if (kind === 'pink') {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.06;
      b6 = w * 0.115926;
    }
  } else if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 1.4;
    }
  } else {
    // Crackle: warm low brown base + stochastic impulses
    let last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.015 * w) / 1.015;
      const pop = Math.random() < 0.0018 ? (Math.random() * 2 - 1) * 0.85 : 0;
      data[i] = last * 0.7 + pop;
    }
  }
  return buffer;
}

/**
 * Creates a procedural Web Audio ambient sound mixer.
 * @param {import('../../kernel/types').AppContext['sound']} sound
 */
export function createAmbientMixer(sound) {
  /** @type {Record<AmbientChannelId, number>} */
  const volumes = {
    rain: 0,
    thunder: 0,
    white: 0,
    pink: 0,
    brown: 0,
    cafe: 0,
    fireplace: 0,
    ocean: 0,
    forest: 0,
    binaural: 0,
  };

  /** @type {Map<AmbientChannelId, { gain: GainNode, stop: () => void }>} */
  const activeNodes = new Map();

  /**
   * Starts a procedural channel node graph.
   * @param {AmbientChannelId} id
   * @param {number} initialVolume
   */
  function startChannel(id, initialVolume) {
    const out = sound.output('media');
    if (!out) return null;
    const { context: actx, destination } = out;
    const gain = actx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, initialVolume));
    gain.connect(destination);

    /** @type {Array<{ stop?: () => void, disconnect?: () => void }>} */
    const cleanupList = [gain];

    if (id === 'binaural') {
      // 40 Hz gamma focus binaural tone: 200 Hz Left, 240 Hz Right
      const oscL = actx.createOscillator();
      const oscR = actx.createOscillator();
      oscL.type = 'sine';
      oscR.type = 'sine';
      oscL.frequency.value = 200;
      oscR.frequency.value = 240;

      const subGain = actx.createGain();
      subGain.gain.value = 0.18;
      oscL.connect(subGain);
      oscR.connect(subGain);
      subGain.connect(gain);
      oscL.start();
      oscR.start();
      cleanupList.push(oscL, oscR, subGain);
    } else {
      const noiseKind =
        id === 'white'
          ? 'white'
          : id === 'brown' || id === 'thunder'
            ? 'brown'
            : id === 'fireplace'
              ? 'crackle'
              : 'pink';
      const src = actx.createBufferSource();
      src.buffer = createNoiseBuffer(actx, noiseKind);
      src.loop = true;

      const filter = actx.createBiquadFilter();
      if (id === 'rain') {
        filter.type = 'bandpass';
        filter.frequency.value = 1100;
        filter.Q.value = 0.7;
      } else if (id === 'thunder') {
        filter.type = 'lowpass';
        filter.frequency.value = 110;
      } else if (id === 'cafe') {
        filter.type = 'bandpass';
        filter.frequency.value = 480;
        filter.Q.value = 1.2;
      } else if (id === 'fireplace') {
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
      } else if (id === 'ocean') {
        filter.type = 'lowpass';
        filter.frequency.value = 380;
        // Modulate cutoff with slow 0.12 Hz wave LFO
        const lfo = actx.createOscillator();
        const lfoGain = actx.createGain();
        lfo.frequency.value = 0.12;
        lfoGain.gain.value = 240;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        cleanupList.push(lfo, lfoGain);
      } else if (id === 'forest') {
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 2.0;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = 6000;
      }

      src.connect(filter);
      filter.connect(gain);
      src.start();
      cleanupList.push(src, filter);
    }

    return {
      gain,
      stop() {
        for (const node of cleanupList) {
          try {
            node.stop?.();
          } catch {
            // ignore already stopped
          }
          try {
            node.disconnect?.();
          } catch {
            // ignore
          }
        }
      },
    };
  }

  return {
    /**
     * Sets volume (`0..1`) for a channel.
     * @param {AmbientChannelId} id
     * @param {number} vol
     */
    setVolume(id, vol) {
      const clamped = Math.max(0, Math.min(1, Number(vol) || 0));
      volumes[id] = clamped;
      const existing = activeNodes.get(id);
      if (clamped <= 0.001) {
        if (existing) {
          existing.stop();
          activeNodes.delete(id);
        }
        return;
      }
      if (existing) {
        existing.gain.gain.value = clamped;
      } else {
        const created = startChannel(id, clamped);
        if (created) activeNodes.set(id, created);
      }
    },

    /** @returns {Record<AmbientChannelId, number>} */
    getVolumes() {
      return { ...volumes };
    },

    /**
     * Applies a full mix dictionary.
     * @param {Partial<Record<AmbientChannelId, number>>} mix
     */
    applyMix(mix) {
      for (const ch of AMBIENT_CHANNELS) {
        this.setVolume(ch.id, mix[ch.id] ?? 0);
      }
    },

    /** Stops all active ambient channels. */
    stopAll() {
      for (const [id, entry] of activeNodes.entries()) {
        entry.stop();
        activeNodes.delete(id);
        volumes[id] = 0;
      }
    },
  };
}
