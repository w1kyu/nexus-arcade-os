// @ts-check
/**
 * Audio playback engine with Web Audio graph, 10-band equalizer, AnalyserNode visualizer hooks,
 * queue management, shuffle/repeat modes, sleep timer, and Media Session API sync.
 */

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoost: [6, 5, 3, 1, 0, 0, 0, 0, 0, 0],
  trebleBoost: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  rock: [4, 3, 1, -1, -2, -1, 2, 3, 4, 4],
  pop: [-1, 1, 3, 4, 4, 3, 1, 0, 1, 2],
  electronic: [5, 4, 1, 0, -2, 2, 1, 2, 4, 5],
  vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  acoustic: [3, 2, 1, 1, 1, 2, 3, 3, 2, 2],
};

/**
 * @typedef {object} Track
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string} album
 * @property {string} [path]
 * @property {string} [url]
 * @property {Blob} [blob]
 * @property {string} [coverUrl]
 * @property {number} [duration]
 * @property {string} [year]
 * @property {number} [track]
 * @property {string} [lyrics]
 * @property {number} [playCount]
 * @property {number} [rating]
 * @property {number} [addedAt]
 */

export class AudioEngine {
  /**
   * @param {object} [options]
   * @param {AudioContext} [options.audioContext]
   * @param {(track: Track | null) => void} [options.onTrackChange]
   * @param {(state: { isPlaying: boolean, currentTime: number, duration: number }) => void} [options.onTimeUpdate]
   * @param {() => void} [options.onEnded]
   */
  constructor(options = {}) {
    this.options = options;
    /** @type {Track[]} */
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    /** @type {'off' | 'all' | 'one'} */
    this.repeatMode = 'all';
    this.isShuffled = false;
    /** @type {number[]} */
    this.shuffleOrder = [];
    this.shufflePointer = -1;
    this.volume = 0.8;
    this.playbackRate = 1.0;
    this.crossfadeSec = 0;

    /** @type {Record<string, number>} */
    this.savedPositions = {};

    // Web Audio elements
    this.audioCtx = options.audioContext || null;
    /** @type {HTMLAudioElement | null} */
    this.audioEl = typeof Audio !== 'undefined' ? new Audio() : null;
    if (this.audioEl) {
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.preload = 'metadata';
      this._bindAudioEvents();
    }

    /** @type {MediaElementAudioSourceNode | null} */
    this.sourceNode = null;
    /** @type {BiquadFilterNode[]} */
    this.eqFilters = [];
    /** @type {GainNode | null} */
    this.gainNode = null;
    /** @type {AnalyserNode | null} */
    this.analyserNode = null;
    this.webAudioInitialized = false;

    // Sleep timer
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._sleepTimer = null;
    this.sleepTimerRemaining = 0;

    /** @type {Array<() => void>} */
    this.listeners = [];
  }

  _initWebAudio() {
    if (this.webAudioInitialized || !this.audioEl) return;
    try {
      const AudioCtxClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtxClass();

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);

      // Create 10-band equalizer peaking filters
      let lastNode = /** @type {AudioNode} */ (this.sourceNode);
      this.eqFilters = EQ_FREQUENCIES.map((freq) => {
        const filter = /** @type {AudioContext} */ (this.audioCtx).createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        lastNode.connect(filter);
        lastNode = filter;
        return filter;
      });

      // Gain node
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.volume;
      lastNode.connect(this.gainNode);

      // Analyser node
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.gainNode.connect(this.analyserNode);

      // Output to destination
      this.analyserNode.connect(this.audioCtx.destination);
      this.webAudioInitialized = true;
    } catch {
      // Audio element plays through default audio output if WebAudio fails
    }
  }

  _bindAudioEvents() {
    if (!this.audioEl) return;
    this.audioEl.addEventListener('play', () => {
      this.isPlaying = true;
      this._updateMediaSessionState();
      this._notify();
    });
    this.audioEl.addEventListener('pause', () => {
      this.isPlaying = false;
      this._updateMediaSessionState();
      this._notify();
    });
    this.audioEl.addEventListener('timeupdate', () => {
      if (this.currentTrack) {
        this.savedPositions[this.currentTrack.id] = this.audioEl?.currentTime || 0;
      }
      this.options.onTimeUpdate?.({
        isPlaying: this.isPlaying,
        currentTime: this.audioEl?.currentTime || 0,
        duration: this.audioEl?.duration || 0,
      });
    });
    this.audioEl.addEventListener('ended', () => {
      this.options.onEnded?.();
      this.handleTrackEnded();
    });
    this.audioEl.addEventListener('error', (e) => {
      console.warn('Audio playback error:', e);
      this.next();
    });
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  _notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    }
  }

  get currentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  get currentTime() {
    return this.audioEl ? this.audioEl.currentTime : 0;
  }

  get duration() {
    return this.audioEl ? this.audioEl.duration || 0 : 0;
  }

  /**
   * Sets the track queue.
   * @param {Track[]} tracks
   * @param {number} [startIndex]
   */
  setQueue(tracks, startIndex = 0) {
    this.queue = [...tracks];
    this._rebuildShuffleOrder();
    if (startIndex >= 0 && startIndex < this.queue.length) {
      this.playIndex(startIndex);
    } else {
      this.currentIndex = -1;
      this._notify();
    }
  }

  /**
   * Appends tracks to the queue.
   * @param {Track[]} tracks
   */
  addToQueue(tracks) {
    this.queue.push(...tracks);
    this._rebuildShuffleOrder();
    this._notify();
  }

  /**
   * Adds track right after current playing song.
   * @param {Track} track
   */
  playNext(track) {
    if (this.currentIndex === -1) {
      this.queue = [track];
      this.playIndex(0);
    } else {
      this.queue.splice(this.currentIndex + 1, 0, track);
      this._rebuildShuffleOrder();
      this._notify();
    }
  }

  /**
   * Removes a track by queue index.
   * @param {number} index
   */
  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (this.currentIndex === index) {
      if (this.queue.length > 0) {
        this.playIndex(Math.min(index, this.queue.length - 1));
      } else {
        this.stop();
        this.currentIndex = -1;
      }
    } else if (this.currentIndex > index) {
      this.currentIndex--;
    }
    this._rebuildShuffleOrder();
    this._notify();
  }

  /**
   * Clears queue.
   */
  clearQueue() {
    this.stop();
    this.queue = [];
    this.currentIndex = -1;
    this._notify();
  }

  _rebuildShuffleOrder() {
    this.shuffleOrder = this.queue.map((_, i) => i);
    for (let i = this.shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleOrder[i], this.shuffleOrder[j]] = [this.shuffleOrder[j], this.shuffleOrder[i]];
    }
    this.shufflePointer = this.shuffleOrder.indexOf(this.currentIndex);
  }

  setShuffle(shuffled) {
    this.isShuffled = shuffled;
    if (shuffled) this._rebuildShuffleOrder();
    this._notify();
  }

  setRepeat(mode) {
    this.repeatMode = mode;
    this._notify();
  }

  /**
   * Plays a track by index.
   * @param {number} index
   */
  async playIndex(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.currentIndex = index;
    const track = this.queue[index];

    this._initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        /* ignore resume failure */
      }
    }

    if (this.audioEl) {
      let src = track.url || '';
      if (!src && track.blob) {
        src = URL.createObjectURL(track.blob);
      }
      this.audioEl.src = src;
      this.audioEl.playbackRate = this.playbackRate;

      // Resume position for podcasts or previously played tracks
      const saved = this.savedPositions[track.id];
      if (saved && saved > 5 && (track.duration || 0) > 600) {
        this.audioEl.currentTime = saved;
      }

      try {
        await this.audioEl.play();
      } catch (err) {
        console.warn('Playback error or autoplay prevented:', err);
      }
    }

    this._updateMediaSession(track);
    this.options.onTrackChange?.(track);
    this._notify();
  }

  async play() {
    if (this.currentIndex === -1 && this.queue.length > 0) {
      await this.playIndex(0);
      return;
    }
    this._initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        /* ignore resume failure */
      }
    }
    if (this.audioEl) {
      try {
        await this.audioEl.play();
      } catch (err) {
        console.warn('Audio play failed:', err);
      }
    }
  }

  pause() {
    if (this.audioEl) this.audioEl.pause();
    this.isPlaying = false;
    this._notify();
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  stop() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    this.isPlaying = false;
    this._notify();
  }

  seek(seconds) {
    if (!this.audioEl) return;
    this.audioEl.currentTime = Math.max(0, Math.min(seconds, this.duration));
  }

  skip(seconds) {
    if (!this.audioEl) return;
    this.seek(this.currentTime + seconds);
  }

  next() {
    if (this.queue.length === 0) return;
    if (this.isShuffled) {
      this.shufflePointer++;
      if (this.shufflePointer >= this.shuffleOrder.length) {
        if (this.repeatMode === 'all') {
          this._rebuildShuffleOrder();
          this.shufflePointer = 0;
        } else {
          this.stop();
          return;
        }
      }
      const nextIdx = this.shuffleOrder[this.shufflePointer];
      this.playIndex(nextIdx);
    } else {
      let nextIdx = this.currentIndex + 1;
      if (nextIdx >= this.queue.length) {
        if (this.repeatMode === 'all') nextIdx = 0;
        else {
          this.stop();
          return;
        }
      }
      this.playIndex(nextIdx);
    }
  }

  previous() {
    if (this.queue.length === 0) return;
    // If track is > 3 seconds in, restart track first
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }
    if (this.isShuffled) {
      this.shufflePointer = Math.max(0, this.shufflePointer - 1);
      const prevIdx = this.shuffleOrder[this.shufflePointer];
      this.playIndex(prevIdx);
    } else {
      let prevIdx = this.currentIndex - 1;
      if (prevIdx < 0) {
        if (this.repeatMode === 'all') prevIdx = this.queue.length - 1;
        else prevIdx = 0;
      }
      this.playIndex(prevIdx);
    }
  }

  handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.seek(0);
      this.play();
    } else {
      this.next();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    } else if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
    this._notify();
  }

  setSpeed(rate) {
    this.playbackRate = Math.max(0.25, Math.min(3, rate));
    if (this.audioEl) this.audioEl.playbackRate = this.playbackRate;
    this._notify();
  }

  /**
   * Sets Equalizer gains in dB for the 10 bands.
   * @param {number[]} gains
   */
  setEqualizer(gains) {
    if (!this.eqFilters || this.eqFilters.length === 0) return;
    for (let i = 0; i < Math.min(gains.length, this.eqFilters.length); i++) {
      this.eqFilters[i].gain.value = gains[i];
    }
  }

  applyEqualizerPreset(presetName) {
    const preset = EQ_PRESETS[presetName] || EQ_PRESETS.flat;
    this.setEqualizer(preset);
  }

  /**
   * Starts a sleep timer in minutes.
   * @param {number} minutes (0 to cancel)
   */
  setSleepTimer(minutes) {
    if (this._sleepTimer) {
      clearTimeout(this._sleepTimer);
      this._sleepTimer = null;
    }
    if (minutes <= 0) {
      this.sleepTimerRemaining = 0;
      this._notify();
      return;
    }
    this.sleepTimerRemaining = minutes * 60;
    this._sleepTimer = setInterval(() => {
      this.sleepTimerRemaining--;
      if (this.sleepTimerRemaining <= 0) {
        clearInterval(this._sleepTimer);
        this._sleepTimer = null;
        this.pause();
      }
      this._notify();
    }, 1000);
    this._notify();
  }

  _updateMediaSession(track) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !track) return;
    try {
      const artwork = track.coverUrl ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork,
      });

      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        this.skip(-(details.seekOffset || 15));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        this.skip(details.seekOffset || 30);
      });
    } catch {
      /* media session not supported */
    }
  }

  _updateMediaSessionState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    } catch {
      /* media session error */
    }
  }

  /**
   * Returns byte frequency data array for visualizer rendering.
   * @param {Uint8Array} [array]
   * @returns {Uint8Array}
   */
  getFrequencyData(array) {
    if (!this.analyserNode) {
      return array || new Uint8Array(256);
    }
    const data = array || new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  /**
   * Returns byte time-domain waveform data for oscilloscope visualizer.
   * @param {Uint8Array} [array]
   * @returns {Uint8Array}
   */
  getWaveformData(array) {
    if (!this.analyserNode) {
      return array || new Uint8Array(256);
    }
    const data = array || new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }
}

// Global shared singleton so widgets, center, and music app can link together
/** @type {AudioEngine | null} */
let globalEngineInstance = null;

export function getSharedAudioEngine() {
  if (!globalEngineInstance) {
    globalEngineInstance = new AudioEngine();
    if (typeof globalThis !== 'undefined') {
      /** @type {any} */ (globalThis).__nexus_music_engine = globalEngineInstance;
    }
  }
  return globalEngineInstance;
}
