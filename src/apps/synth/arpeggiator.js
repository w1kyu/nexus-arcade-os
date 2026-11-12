// @ts-check
/**
 * Synthesizer Arpeggiator supporting Up, Down, Up/Down and Random modes across 1–3 octaves.
 */

export class Arpeggiator {
  /**
   * @param {import('./engine').SynthEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
    this.enabled = false;
    this.bpm = 120;
    /** @type {'up' | 'down' | 'upDown' | 'random'} */
    this.mode = 'up';
    this.octaves = 2; // 1, 2 or 3
    this.rate = 16; // 8 = 1/8 notes, 16 = 1/16 notes

    /** @type {number[]} */
    this.heldNotes = [];
    this.currentIndex = 0;
    /** @type {ReturnType<typeof setInterval> | null} */
    this._timer = null;
    this.lastPlayedNote = null;
  }

  addNote(midiNote) {
    if (!this.heldNotes.includes(midiNote)) {
      this.heldNotes.push(midiNote);
      this.heldNotes.sort((a, b) => a - b);
    }
    if (this.enabled && !this._timer) {
      this.start();
    }
  }

  removeNote(midiNote) {
    this.heldNotes = this.heldNotes.filter((n) => n !== midiNote);
    if (this.heldNotes.length === 0) {
      this.stop();
    }
  }

  start() {
    this.stop();
    if (this.heldNotes.length === 0) return;
    const intervalMs = (60000 / this.bpm) * (4 / this.rate);

    this.currentIndex = 0;
    this._timer = setInterval(() => this._step(), intervalMs);
    this._step();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this.lastPlayedNote !== null) {
      this.engine.noteOff(this.lastPlayedNote);
      this.lastPlayedNote = null;
    }
  }

  _step() {
    if (this.heldNotes.length === 0) {
      this.stop();
      return;
    }

    if (this.lastPlayedNote !== null) {
      this.engine.noteOff(this.lastPlayedNote);
    }

    // Build multi-octave note pool
    const pool = [];
    for (let oct = 0; oct < this.octaves; oct++) {
      for (const n of this.heldNotes) {
        pool.push(n + oct * 12);
      }
    }

    let noteToPlay;
    if (this.mode === 'up') {
      noteToPlay = pool[this.currentIndex % pool.length];
      this.currentIndex++;
    } else if (this.mode === 'down') {
      const rev = [...pool].reverse();
      noteToPlay = rev[this.currentIndex % rev.length];
      this.currentIndex++;
    } else if (this.mode === 'upDown') {
      const upDownPool = [...pool, ...pool.slice(1, -1).reverse()];
      noteToPlay = upDownPool[this.currentIndex % upDownPool.length];
      this.currentIndex++;
    } else {
      // random
      noteToPlay = pool[Math.floor(Math.random() * pool.length)];
    }

    this.lastPlayedNote = noteToPlay;
    this.engine.noteOn(noteToPlay, 100);
  }
}
