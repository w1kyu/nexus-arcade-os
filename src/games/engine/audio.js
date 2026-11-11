// @ts-check
// Procedural audio synthesizer (jsfxr-style) and chiptune tracker player

/**
 * @typedef {object} SoundPresetConfig
 * @property {OscillatorType | 'noise'} [wave]
 * @property {number} [freq] Base frequency in Hz
 * @property {number} [freqSlide] Frequency delta over duration
 * @property {number} [attack] Attack time in seconds
 * @property {number} [sustain] Sustain time in seconds
 * @property {number} [decay] Decay time in seconds
 * @property {number} [punch] Initial punch volume boost
 * @property {number} [gain] Max gain (0-1)
 * @property {number} [pitchJump] Target frequency for sudden arpeggio pitch jump
 * @property {number} [pitchJumpTime] Time into sound to jump pitch
 */

export class GameAudio {
  /**
   * @param {object} [options]
   * @param {{ context: AudioContext, destination: AudioNode } | null} [options.output] OS games audio bus
   */
  constructor({ output = null } = {}) {
    this.output = output;
    /** @type {AudioContext | null} */
    this.internalCtx = null;
    this.sfxVolume = 1.0;
    this.musicVolume = 0.7;
    this.muted = false;

    /** @type {GainNode | null} */
    this.sfxBus = null;
    /** @type {GainNode | null} */
    this.musicBus = null;

    /** @type {number | null} */
    this.musicTimer = null;
    this.currentSong = null;
    this.songStep = 0;
  }

  _getContext() {
    if (this.output) return this.output.context;
    if (!this.internalCtx && typeof AudioContext !== 'undefined') {
      this.internalCtx = new AudioContext();
    }
    return this.internalCtx;
  }

  _getBuses() {
    const ctx = this._getContext();
    if (!ctx) return null;
    if (!this.sfxBus || !this.musicBus) {
      const dest = this.output ? this.output.destination : ctx.destination;
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.muted ? 0 : this.sfxVolume;
      this.sfxBus.connect(dest);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.muted ? 0 : this.musicVolume;
      this.musicBus.connect(dest);
    }
    return { sfx: this.sfxBus, music: this.musicBus };
  }

  /**
   * Plays a custom procedural sound effect.
   * @param {SoundPresetConfig} config
   */
  playCustom(config) {
    if (this.muted) return;
    const ctx = this._getContext();
    const buses = this._getBuses();
    if (!ctx || !buses) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const wave = config.wave || 'square';
    const freq = config.freq || 440;
    const freqSlide = config.freqSlide || 0;
    const attack = config.attack || 0.005;
    const sustain = config.sustain || 0.08;
    const decay = config.decay || 0.12;
    const totalDuration = attack + sustain + decay;
    const gainVal = Math.max(0.001, (config.gain ?? 0.3) * (config.punch ? 1.2 : 1.0));

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gainVal, now + attack);
    gainNode.gain.setValueAtTime(gainVal, now + attack + sustain);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);
    gainNode.connect(buses.sfx);

    if (wave === 'noise') {
      // Procedural white/pink noise buffer
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * totalDuration));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      // Bandpass filter for noise coloring
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, now);
      if (freqSlide !== 0) {
        filter.frequency.linearRampToValueAtTime(Math.max(20, freq + freqSlide), now + totalDuration);
      }

      noiseNode.connect(filter);
      filter.connect(gainNode);
      noiseNode.start(now);
      noiseNode.stop(now + totalDuration + 0.05);
    } else {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);

      if (config.pitchJump && config.pitchJumpTime) {
        osc.frequency.setValueAtTime(config.pitchJump, now + config.pitchJumpTime);
      } else if (freqSlide !== 0) {
        osc.frequency.linearRampToValueAtTime(Math.max(20, freq + freqSlide), now + totalDuration);
      }

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + totalDuration + 0.05);
    }
  }

  /**
   * High-level sound presets
   * @param {'jump' | 'coin' | 'explosion' | 'hit' | 'powerup' | 'laser' | 'blip' | 'gameover' | 'victory'} type
   */
  play(type) {
    switch (type) {
      case 'jump':
        this.playCustom({
          wave: 'square',
          freq: 180,
          freqSlide: 380,
          attack: 0.005,
          sustain: 0.05,
          decay: 0.12,
          gain: 0.25,
        });
        break;
      case 'coin':
        this.playCustom({
          wave: 'sine',
          freq: 880,
          pitchJump: 1320,
          pitchJumpTime: 0.06,
          attack: 0.005,
          sustain: 0.08,
          decay: 0.18,
          gain: 0.28,
        });
        break;
      case 'explosion':
        this.playCustom({
          wave: 'noise',
          freq: 300,
          freqSlide: -220,
          attack: 0.01,
          sustain: 0.15,
          decay: 0.35,
          gain: 0.35,
          punch: 1.5,
        });
        break;
      case 'hit':
        this.playCustom({
          wave: 'triangle',
          freq: 260,
          freqSlide: -140,
          attack: 0.002,
          sustain: 0.03,
          decay: 0.08,
          gain: 0.3,
        });
        break;
      case 'powerup':
        this.playCustom({
          wave: 'triangle',
          freq: 440,
          pitchJump: 880,
          pitchJumpTime: 0.08,
          attack: 0.01,
          sustain: 0.12,
          decay: 0.22,
          gain: 0.3,
        });
        break;
      case 'laser':
        this.playCustom({
          wave: 'sawtooth',
          freq: 900,
          freqSlide: -650,
          attack: 0.002,
          sustain: 0.04,
          decay: 0.08,
          gain: 0.22,
        });
        break;
      case 'blip':
        this.playCustom({
          wave: 'sine',
          freq: 580,
          attack: 0.002,
          sustain: 0.02,
          decay: 0.04,
          gain: 0.2,
        });
        break;
      case 'gameover':
        this.playCustom({
          wave: 'sawtooth',
          freq: 220,
          freqSlide: -120,
          attack: 0.02,
          sustain: 0.2,
          decay: 0.4,
          gain: 0.3,
        });
        break;
      case 'victory':
        this.playCustom({
          wave: 'square',
          freq: 523.25,
          pitchJump: 659.25,
          pitchJumpTime: 0.12,
          attack: 0.01,
          sustain: 0.2,
          decay: 0.3,
          gain: 0.3,
        });
        break;
    }
  }

  /**
   * Plays a simple chiptune loop.
   * Notes are frequencies (0 = rest).
   * @param {object} song
   * @param {number} song.bpm Beats per minute (16th notes)
   * @param {number[][]} song.patterns Array of tracks (0: lead, 1: bass)
   */
  playMusic(song) {
    this.stopMusic();
    this.currentSong = song;
    this.songStep = 0;

    const stepMs = 60000 / song.bpm / 4; // 16th note step duration

    const tick = () => {
      if (!this.currentSong || this.muted) return;
      const ctx = this._getContext();
      const buses = this._getBuses();
      if (!ctx || !buses) return;

      const now = ctx.currentTime;
      const stepDur = stepMs / 1000;

      // Play lead note
      const leadTrack = song.patterns[0];
      if (leadTrack) {
        const freq = leadTrack[this.songStep % leadTrack.length];
        if (freq > 0) {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now);
          env.gain.setValueAtTime(0.0001, now);
          env.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
          env.gain.exponentialRampToValueAtTime(0.0001, now + stepDur * 0.85);
          osc.connect(env);
          env.connect(buses.music);
          osc.start(now);
          osc.stop(now + stepDur);
        }
      }

      // Play bass note
      const bassTrack = song.patterns[1];
      if (bassTrack) {
        const freq = bassTrack[this.songStep % bassTrack.length];
        if (freq > 0) {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          env.gain.setValueAtTime(0.0001, now);
          env.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
          env.gain.exponentialRampToValueAtTime(0.0001, now + stepDur * 0.9);
          osc.connect(env);
          env.connect(buses.music);
          osc.start(now);
          osc.stop(now + stepDur);
        }
      }

      this.songStep++;
      this.musicTimer = /** @type {any} */ (setTimeout(tick, stepMs));
    };

    tick();
  }

  stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentSong = null;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.sfxBus) this.sfxBus.gain.value = muted ? 0 : this.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = muted ? 0 : this.musicVolume;
  }

  dispose() {
    this.stopMusic();
    if (this.internalCtx && this.internalCtx.state !== 'closed') {
      this.internalCtx.close().catch(() => {});
    }
  }
}
