// @ts-check
import { h, icon } from '../../ui/dom.js';
import { Arpeggiator } from './arpeggiator.js';
import { SynthEngine } from './engine.js';
import { SYNTH_PRESETS } from './presets.js';
import './styles.css';

/**
 * Key code to MIDI note mapping for QWERTY keyboard.
 * @type {Record<string, number>}
 */
const KEY_MAP = {
  KeyA: 60, // C4
  KeyW: 61, // C#4
  KeyS: 62, // D4
  KeyE: 63, // D#4
  KeyD: 64, // E4
  KeyF: 65, // F4
  KeyT: 66, // F#4
  KeyG: 67, // G4
  KeyY: 68, // G#4
  KeyH: 69, // A4
  KeyU: 70, // A#4
  KeyJ: 71, // B4
  KeyK: 72, // C5
  KeyO: 73, // C#5
  KeyL: 74, // D5
  KeyP: 75, // D#5
  Semicolon: 76, // E5
  Quote: 77, // F5
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Synthesizer main application.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(container, ctx) {
  const AudioCtxClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  let audioCtx = AudioCtxClass ? new AudioCtxClass() : null;

  const engine = new SynthEngine(audioCtx);
  const arpeggiator = new Arpeggiator(engine);

  // Apply default preset (Cyberpunk Lead)
  Object.assign(engine.patch, JSON.parse(JSON.stringify(SYNTH_PRESETS.cyberpunkLead)));

  const activeMidiNotes = new Set();
  /** @type {Record<number, HTMLElement>} */
  const keyElements = {};

  const root = h('div', { class: 'nx-synth' });

  // Topbar
  const topbar = h('header', { class: 'nx-synth-topbar' });

  const presetSelect = h(
    'select',
    { class: 'nx-select' },
    Object.keys(SYNTH_PRESETS).map((k) =>
      h('option', { value: k, selected: k === 'cyberpunkLead' ? 'selected' : undefined }, SYNTH_PRESETS[k].name),
    ),
  );

  presetSelect.addEventListener('change', () => {
    const key = presetSelect.value;
    if (SYNTH_PRESETS[key]) {
      engine.patch = JSON.parse(JSON.stringify(SYNTH_PRESETS[key]));
      syncDashboard();
    }
  });

  const arpToggleBtn = h('button', { class: 'nx-btn nx-btn-secondary' }, arpeggiator.enabled ? 'Arp: ON' : 'Arp: OFF');
  arpToggleBtn.onclick = () => {
    arpeggiator.enabled = !arpeggiator.enabled;
    arpToggleBtn.textContent = arpeggiator.enabled ? 'Arp: ON' : 'Arp: OFF';
    arpToggleBtn.classList.toggle('nx-btn-primary', arpeggiator.enabled);
    if (!arpeggiator.enabled) arpeggiator.stop();
  };

  const arpModeSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'up' }, 'Arp: Up'),
    h('option', { value: 'down' }, 'Arp: Down'),
    h('option', { value: 'upDown' }, 'Arp: Up/Down'),
    h('option', { value: 'random' }, 'Arp: Random'),
  );
  arpModeSelect.addEventListener('change', () => {
    arpeggiator.mode = /** @type {'up' | 'down' | 'upDown' | 'random'} */ (arpModeSelect.value);
  });

  const btnPanic = h('button', { class: 'nx-btn nx-btn-secondary' }, icon('activity'), 'Silence');
  btnPanic.onclick = () => {
    engine.allNotesOff();
    arpeggiator.stop();
    for (const el of Object.values(keyElements)) {
      el.classList.remove('is-active');
    }
    activeMidiNotes.clear();
  };

  const btnSavePreset = h('button', { class: 'nx-btn nx-btn-secondary' }, icon('save'), 'Save');
  btnSavePreset.onclick = async () => {
    const filename = `Preset_${Date.now()}.nsynth`;
    const path = `/Music/${filename}`;
    try {
      await ctx.vfs.write(path, JSON.stringify(engine.patch, null, 2));
      ctx.notifications.show({ title: 'Preset Saved', body: `Saved to ${path}` });
    } catch {
      /* ignore */
    }
  };

  const btnLoadPreset = h('button', { class: 'nx-btn nx-btn-secondary' }, icon('folder'), 'Load');
  btnLoadPreset.onclick = async () => {
    try {
      const files = await ctx.vfs.list('/Music');
      const nsynthFiles = files.filter((f) => f.name.endsWith('.nsynth'));
      if (nsynthFiles.length === 0) {
        ctx.notifications.show({ title: 'No Presets', body: 'No .nsynth files found in /Music' });
        return;
      }
      const raw = await ctx.vfs.readText(nsynthFiles[0].path);
      const parsed = JSON.parse(raw);
      Object.assign(engine.patch, parsed);
      syncDashboard();
      ctx.notifications.show({ title: 'Preset Loaded', body: `Loaded ${nsynthFiles[0].name}` });
    } catch {
      /* ignore */
    }
  };

  topbar.append(
    h('div', { style: 'display:flex;align-items:center;gap:8px;' }, icon('activity'), h('strong', {}, 'Synth')),
    h(
      'div',
      { style: 'display:flex;align-items:center;gap:8px;' },
      presetSelect,
      btnSavePreset,
      btnLoadPreset,
      arpToggleBtn,
      arpModeSelect,
      btnPanic,
    ),
  );

  // Visualizer bar
  const visualizerBar = h('div', { class: 'nx-synth-visualizer-bar' });
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-synth-canvas' }));
  visualizerBar.append(canvas);

  // Dashboard with Parameter Modules
  const dashboard = h('div', { class: 'nx-synth-dashboard' });

  // Module creation helpers
  function createSlider(label, min, max, step, getValue, setValue) {
    const valDisplay = h('span', { style: 'color:#94a3b8;font-size:10px;' }, String(getValue()));
    const slider = h('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(getValue()),
      style: 'flex:1;',
    });
    slider.addEventListener('input', () => {
      const num = parseFloat(slider.value);
      setValue(num);
      valDisplay.textContent = String(num);
    });
    return {
      element: h('div', { class: 'nx-synth-param-row' }, h('span', {}, label), slider, valDisplay),
      update: () => {
        slider.value = String(getValue());
        valDisplay.textContent = String(getValue());
      },
    };
  }

  function createSelect(label, options, getValue, setValue) {
    const select = h(
      'select',
      { class: 'nx-select', style: 'padding:2px 6px;font-size:11px;' },
      options.map((opt) => h('option', { value: opt, selected: opt === getValue() ? 'selected' : undefined }, opt)),
    );
    select.addEventListener('change', () => {
      setValue(select.value);
    });
    return {
      element: h('div', { class: 'nx-synth-param-row' }, h('span', {}, label), select),
      update: () => {
        select.value = getValue();
      },
    };
  }

  const registeredUpdaters = [];

  // 1. Osc 1
  const osc1Mod = h('div', { class: 'nx-synth-module' }, h('div', { class: 'nx-synth-module-title' }, 'Oscillator 1'));
  const osc1Type = createSelect(
    'Wave',
    ['sawtooth', 'square', 'sine', 'triangle', 'noise'],
    () => engine.patch.osc1.type,
    (v) => (engine.patch.osc1.type = v),
  );
  const osc1Oct = createSlider(
    'Octave',
    -2,
    2,
    1,
    () => engine.patch.osc1.octave,
    (v) => (engine.patch.osc1.octave = v),
  );
  const osc1Semi = createSlider(
    'Semi',
    -12,
    12,
    1,
    () => engine.patch.osc1.semi,
    (v) => (engine.patch.osc1.semi = v),
  );
  const osc1Fine = createSlider(
    'Fine',
    -50,
    50,
    1,
    () => engine.patch.osc1.fine,
    (v) => (engine.patch.osc1.fine = v),
  );
  const osc1Gain = createSlider(
    'Gain',
    0,
    1,
    0.05,
    () => engine.patch.osc1.gain,
    (v) => (engine.patch.osc1.gain = v),
  );
  osc1Mod.append(osc1Type.element, osc1Oct.element, osc1Semi.element, osc1Fine.element, osc1Gain.element);
  registeredUpdaters.push(osc1Type.update, osc1Oct.update, osc1Semi.update, osc1Fine.update, osc1Gain.update);

  // 2. Osc 2
  const osc2Mod = h('div', { class: 'nx-synth-module' }, h('div', { class: 'nx-synth-module-title' }, 'Oscillator 2'));
  const osc2Type = createSelect(
    'Wave',
    ['sawtooth', 'square', 'sine', 'triangle', 'noise'],
    () => engine.patch.osc2.type,
    (v) => (engine.patch.osc2.type = v),
  );
  const osc2Oct = createSlider(
    'Octave',
    -2,
    2,
    1,
    () => engine.patch.osc2.octave,
    (v) => (engine.patch.osc2.octave = v),
  );
  const osc2Semi = createSlider(
    'Semi',
    -12,
    12,
    1,
    () => engine.patch.osc2.semi,
    (v) => (engine.patch.osc2.semi = v),
  );
  const osc2Fine = createSlider(
    'Fine',
    -50,
    50,
    1,
    () => engine.patch.osc2.fine,
    (v) => (engine.patch.osc2.fine = v),
  );
  const osc2Gain = createSlider(
    'Gain',
    0,
    1,
    0.05,
    () => engine.patch.osc2.gain,
    (v) => (engine.patch.osc2.gain = v),
  );
  osc2Mod.append(osc2Type.element, osc2Oct.element, osc2Semi.element, osc2Fine.element, osc2Gain.element);
  registeredUpdaters.push(osc2Type.update, osc2Oct.update, osc2Semi.update, osc2Fine.update, osc2Gain.update);

  // 3. Filter
  const filterMod = h('div', { class: 'nx-synth-module' }, h('div', { class: 'nx-synth-module-title' }, 'Filter'));
  const filtCutoff = createSlider(
    'Cutoff',
    100,
    12000,
    50,
    () => engine.patch.filter.cutoff,
    (v) => (engine.patch.filter.cutoff = v),
  );
  const filtRes = createSlider(
    'Resonance',
    0.5,
    15,
    0.5,
    () => engine.patch.filter.resonance,
    (v) => (engine.patch.filter.resonance = v),
  );
  const filtEnvAmt = createSlider(
    'Env Amt',
    0,
    1,
    0.05,
    () => engine.patch.filter.envAmount,
    (v) => (engine.patch.filter.envAmount = v),
  );
  filterMod.append(filtCutoff.element, filtRes.element, filtEnvAmt.element);
  registeredUpdaters.push(filtCutoff.update, filtRes.update, filtEnvAmt.update);

  // 4. Amp Envelope
  const ampEnvMod = h(
    'div',
    { class: 'nx-synth-module' },
    h('div', { class: 'nx-synth-module-title' }, 'Amp Envelope'),
  );
  const ampA = createSlider(
    'Attack',
    0.005,
    1.5,
    0.01,
    () => engine.patch.ampEnv.attack,
    (v) => (engine.patch.ampEnv.attack = v),
  );
  const ampD = createSlider(
    'Decay',
    0.01,
    2.0,
    0.02,
    () => engine.patch.ampEnv.decay,
    (v) => (engine.patch.ampEnv.decay = v),
  );
  const ampS = createSlider(
    'Sustain',
    0,
    1,
    0.05,
    () => engine.patch.ampEnv.sustain,
    (v) => (engine.patch.ampEnv.sustain = v),
  );
  const ampR = createSlider(
    'Release',
    0.02,
    2.5,
    0.05,
    () => engine.patch.ampEnv.release,
    (v) => (engine.patch.ampEnv.release = v),
  );
  ampEnvMod.append(ampA.element, ampD.element, ampS.element, ampR.element);
  registeredUpdaters.push(ampA.update, ampD.update, ampS.update, ampR.update);

  // 5. Filter Envelope
  const fEnvMod = h(
    'div',
    { class: 'nx-synth-module' },
    h('div', { class: 'nx-synth-module-title' }, 'Filter Envelope'),
  );
  const fA = createSlider(
    'Attack',
    0.005,
    1.5,
    0.01,
    () => engine.patch.filterEnv.attack,
    (v) => (engine.patch.filterEnv.attack = v),
  );
  const fD = createSlider(
    'Decay',
    0.01,
    2.0,
    0.02,
    () => engine.patch.filterEnv.decay,
    (v) => (engine.patch.filterEnv.decay = v),
  );
  const fS = createSlider(
    'Sustain',
    0,
    1,
    0.05,
    () => engine.patch.filterEnv.sustain,
    (v) => (engine.patch.filterEnv.sustain = v),
  );
  const fR = createSlider(
    'Release',
    0.02,
    2.5,
    0.05,
    () => engine.patch.filterEnv.release,
    (v) => (engine.patch.filterEnv.release = v),
  );
  fEnvMod.append(fA.element, fD.element, fS.element, fR.element);
  registeredUpdaters.push(fA.update, fD.update, fS.update, fR.update);

  // 6. LFO & Effects
  const fxMod = h('div', { class: 'nx-synth-module' }, h('div', { class: 'nx-synth-module-title' }, 'LFO & FX'));
  const lfoRate = createSlider(
    'LFO Rate',
    0.2,
    15,
    0.2,
    () => engine.patch.lfo.rate,
    (v) => (engine.patch.lfo.rate = v),
  );
  const lfoDepth = createSlider(
    'LFO Depth',
    0,
    1,
    0.05,
    () => engine.patch.lfo.depth,
    (v) => (engine.patch.lfo.depth = v),
  );
  const lfoTarget = createSelect(
    'LFO Dest',
    ['filter', 'pitch'],
    () => engine.patch.lfo.target,
    (v) => (engine.patch.lfo.target = v),
  );
  const delayMix = createSlider(
    'Delay Mix',
    0,
    0.8,
    0.05,
    () => engine.effects?.delayWet?.gain?.value ?? 0.25,
    (v) => engine.effects?.setDelay(0.3, 0.4, v),
  );
  const reverbMix = createSlider(
    'Reverb Mix',
    0,
    0.8,
    0.05,
    () => engine.effects?.reverbWet?.gain?.value ?? 0.2,
    (v) => engine.effects?.setReverb(v),
  );
  fxMod.append(lfoRate.element, lfoDepth.element, lfoTarget.element, delayMix.element, reverbMix.element);
  registeredUpdaters.push(lfoRate.update, lfoDepth.update, lfoTarget.update, delayMix.update, reverbMix.update);

  dashboard.append(osc1Mod, osc2Mod, filterMod, ampEnvMod, fEnvMod, fxMod);

  function syncDashboard() {
    for (const update of registeredUpdaters) {
      update();
    }
  }

  // Piano Keyboard (3 Octaves: C3 (48) to B5 (83))
  const keyboardWrap = h('div', { class: 'nx-synth-keyboard-wrap' });
  const keyboard = h('div', { class: 'nx-synth-keyboard' });

  function playNote(midi) {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (arpeggiator.enabled) {
      arpeggiator.addNote(midi);
    } else {
      engine.noteOn(midi);
    }
    activeMidiNotes.add(midi);
    if (keyElements[midi]) keyElements[midi].classList.add('is-active');
  }

  function stopNote(midi) {
    if (arpeggiator.enabled) {
      arpeggiator.removeNote(midi);
    } else {
      engine.noteOff(midi);
    }
    activeMidiNotes.delete(midi);
    if (keyElements[midi]) keyElements[midi].classList.remove('is-active');
  }

  // Generate 3 octaves (36 keys: 21 white, 15 black)
  let whiteKeyIndex = 0;
  for (let midi = 48; midi <= 83; midi++) {
    const noteInOct = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(noteInOct);
    const noteName = NOTE_NAMES[noteInOct];

    if (!isBlack) {
      const keyEl = h('div', { class: 'nx-synth-key-white', 'data-note': midi }, `${noteName}`);
      keyElements[midi] = keyEl;

      keyEl.addEventListener('mousedown', (e) => {
        if (e.button === 0) playNote(midi);
      });
      keyEl.addEventListener('mouseup', () => stopNote(midi));
      keyEl.addEventListener('mouseleave', () => {
        if (activeMidiNotes.has(midi)) stopNote(midi);
      });
      keyEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        playNote(midi);
      });
      keyEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopNote(midi);
      });

      keyboard.append(keyEl);
      whiteKeyIndex++;
    } else {
      // Position black key over the previous white key
      const keyEl = h('div', { class: 'nx-synth-key-black', 'data-note': midi });
      const leftOffset = (whiteKeyIndex - 1) * 38 + 26;
      keyEl.style.left = `${leftOffset}px`;
      keyElements[midi] = keyEl;

      keyEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (e.button === 0) playNote(midi);
      });
      keyEl.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        stopNote(midi);
      });
      keyEl.addEventListener('mouseleave', () => {
        if (activeMidiNotes.has(midi)) stopNote(midi);
      });
      keyEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playNote(midi);
      });
      keyEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopNote(midi);
      });

      keyboard.append(keyEl);
    }
  }

  keyboardWrap.append(keyboard);

  root.append(topbar, visualizerBar, dashboard, keyboardWrap);

  // Oscilloscope Canvas Rendering
  let animId = null;
  const canvasCtx = canvas.getContext('2d');
  const waveData = new Uint8Array(256);

  function drawOscilloscope() {
    animId = requestAnimationFrame(drawOscilloscope);
    if (!canvasCtx) return;

    const w = (canvas.width = canvas.offsetWidth || 800);
    const h = (canvas.height = canvas.offsetHeight || 70);

    engine.getWaveformData(waveData);

    canvasCtx.fillStyle = '#050811';
    canvasCtx.fillRect(0, 0, w, h);

    // Grid line
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    canvasCtx.lineWidth = 1;
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, h / 2);
    canvasCtx.lineTo(w, h / 2);
    canvasCtx.stroke();

    // Waveform line
    canvasCtx.strokeStyle = '#6366f1';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();

    const sliceWidth = w / waveData.length;
    let x = 0;

    for (let i = 0; i < waveData.length; i++) {
      const v = waveData[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }

    canvasCtx.stroke();
  }

  drawOscilloscope();

  // QWERTY keyboard listener
  /** @param {KeyboardEvent} e */
  const onKeyDown = (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.repeat) return;
    const midi = KEY_MAP[e.code];
    if (midi && !activeMidiNotes.has(midi)) {
      playNote(midi);
    }
  };

  /** @param {KeyboardEvent} e */
  const onKeyUp = (e) => {
    const midi = KEY_MAP[e.code];
    if (midi && activeMidiNotes.has(midi)) {
      stopNote(midi);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Web MIDI API support
  /** @type {any} */
  let midiAccess = null;

  if (navigator.requestMIDIAccess) {
    navigator
      .requestMIDIAccess()
      .then((access) => {
        midiAccess = access;
        for (const input of access.inputs.values()) {
          input.onmidimessage = (/** @type {any} */ msg) => {
            const [status, note, velocity] = msg.data;
            const command = status >> 4;
            if (command === 9 && velocity > 0) {
              playNote(note);
            } else if (command === 8 || (command === 9 && velocity === 0)) {
              stopNote(note);
            }
          };
        }
      })
      .catch(() => {
        /* MIDI not granted or unsupported */
      });
  }

  container.append(root);

  return {
    unmount() {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      engine.allNotesOff();
      arpeggiator.stop();
      if (midiAccess) {
        for (const input of midiAccess.inputs.values()) {
          input.onmidimessage = null;
        }
      }
    },
  };
}
