// @ts-check
import { h, icon } from '../../ui/dom.js';
import { BEAT_PRESETS } from './presets.js';
import { BeatScheduler } from './scheduler.js';
import './styles.css';
import { DRUM_NAMES } from './synth-drums.js';
import { audioBufferToWav } from './wav-export.js';

/**
 * Beat Lab Drum Sequencer Application.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(container, ctx) {
  let AudioCtxClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  let audioCtx = AudioCtxClass ? new AudioCtxClass() : null;
  let dest = audioCtx ? audioCtx.destination : null;

  const scheduler = new BeatScheduler(audioCtx, dest, (step, _patternKey) => {
    highlightStep(step);
  });

  // Load default preset (Synthwave Arcade)
  const defaultPreset = BEAT_PRESETS['synthwave-arcade'];
  scheduler.bpm = defaultPreset.bpm;
  scheduler.swing = defaultPreset.swing;
  scheduler.patterns.A = JSON.parse(JSON.stringify(defaultPreset.pattern));

  const root = h('div', { class: 'nx-beatlab' });

  // Topbar
  const topbar = h('header', { class: 'nx-beatlab-topbar' });

  const btnPlay = h(
    'button',
    {
      class: 'nx-btn is-primary',
      type: 'button',
      onclick: () => togglePlay(),
    },
    icon('play', { size: 18 }),
    h('span', { text: 'Play' }),
  );

  const bpmLabel = h('span', {
    style: 'font-variant-numeric: tabular-nums; font-size: 13px;',
    text: `${scheduler.bpm} BPM`,
  });
  const bpmSlider = h('input', {
    class: 'nx-slider',
    type: 'range',
    min: '50',
    max: '200',
    value: String(scheduler.bpm),
    style: 'width: 90px;',
    oninput: (e) => {
      scheduler.bpm = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10);
      bpmLabel.textContent = `${scheduler.bpm} BPM`;
    },
  });

  const swingLabel = h('span', {
    style: 'font-variant-numeric: tabular-nums; font-size: 13px;',
    text: `${scheduler.swing}% Swing`,
  });
  const swingSlider = h('input', {
    class: 'nx-slider',
    type: 'range',
    min: '0',
    max: '70',
    value: String(scheduler.swing),
    style: 'width: 80px;',
    oninput: (e) => {
      scheduler.swing = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10);
      swingLabel.textContent = `${scheduler.swing}% Swing`;
    },
  });

  // Pattern A, B, C, D selector
  const patternSelect = h(
    'select',
    {
      class: 'nx-select',
      style: 'width: 100px;',
      onchange: (e) => {
        scheduler.currentPatternKey = /** @type {HTMLSelectElement} */ (e.target).value;
        renderMatrix();
      },
    },
    h('option', { value: 'A', text: 'Pattern A' }),
    h('option', { value: 'B', text: 'Pattern B' }),
    h('option', { value: 'C', text: 'Pattern C' }),
    h('option', { value: 'D', text: 'Pattern D' }),
  );

  // Preset selector
  const presetSelect = h(
    'select',
    {
      class: 'nx-select',
      style: 'width: 130px;',
      onchange: (e) => {
        const pKey = /** @type {HTMLSelectElement} */ (e.target).value;
        const p = BEAT_PRESETS[pKey];
        if (p) {
          scheduler.bpm = p.bpm;
          scheduler.swing = p.swing;
          scheduler.patterns[scheduler.currentPatternKey] = JSON.parse(JSON.stringify(p.pattern));
          bpmSlider.value = String(p.bpm);
          bpmLabel.textContent = `${p.bpm} BPM`;
          swingSlider.value = String(p.swing);
          swingLabel.textContent = `${p.swing}% Swing`;
          renderMatrix();
        }
      },
    },
    h('option', { value: 'synthwave-arcade', text: 'Synthwave' }),
    h('option', { value: '808-trap', text: '808 Trap' }),
    h('option', { value: '909-techno', text: '909 Techno' }),
    h('option', { value: 'lofi-groove', text: 'Lo-Fi Hip Hop' }),
  );

  const btnExportWav = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      onclick: () => exportSongAsWav(),
    },
    icon('download', { size: 16 }),
    h('span', { text: 'Export WAV' }),
  );

  const btnSaveProject = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      onclick: () => saveProject(),
    },
    icon('hard-drive', { size: 16 }),
    h('span', { text: 'Save' }),
  );

  topbar.append(
    h(
      'div',
      { style: 'display: flex; gap: 12px; align-items: center;' },
      btnPlay,
      bpmSlider,
      bpmLabel,
      swingSlider,
      swingLabel,
    ),
    h(
      'div',
      { style: 'display: flex; gap: 8px; align-items: center;' },
      patternSelect,
      presetSelect,
      btnSaveProject,
      btnExportWav,
    ),
  );

  // Matrix sequencer grid
  const main = h('main', { class: 'nx-beatlab-main nx-beatlab-grid' });
  root.append(topbar, main);

  async function togglePlay() {
    if (audioCtx && audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {
        /* ignore */
      }
    }
    if (scheduler.isPlaying) {
      scheduler.stop();
      btnPlay.replaceChildren(icon('play', { size: 18 }), h('span', { text: 'Play' }));
      clearStepHighlights();
    } else {
      scheduler.start();
      btnPlay.replaceChildren(icon('stop', { size: 18 }), h('span', { text: 'Stop' }));
    }
  }

  function clearStepHighlights() {
    const steps = main.querySelectorAll('.nx-beatlab-step');
    steps.forEach((s) => s.classList.remove('is-current'));
  }

  function highlightStep(stepIndex) {
    clearStepHighlights();
    const currentSteps = main.querySelectorAll(`.nx-beatlab-step[data-step="${stepIndex}"]`);
    currentSteps.forEach((s) => s.classList.add('is-current'));
  }

  // Render 8 drum tracks x 16 steps
  function renderMatrix() {
    const curPattern = scheduler.patterns[scheduler.currentPatternKey] || scheduler.patterns.A;

    main.replaceChildren(
      ...DRUM_NAMES.map((track) => {
        const cfg = scheduler.trackConfig[track];
        const steps = curPattern[track] || new Array(16).fill(0);

        // Mute & Solo buttons
        const btnMute = h('button', {
          class: `nx-beatlab-track-btn${cfg.mute ? ' is-active-mute' : ''}`,
          type: 'button',
          text: 'M',
          title: 'Mute',
          onclick: () => {
            cfg.mute = !cfg.mute;
            btnMute.classList.toggle('is-active-mute', cfg.mute);
          },
        });

        const btnSolo = h('button', {
          class: `nx-beatlab-track-btn${cfg.solo ? ' is-active-solo' : ''}`,
          type: 'button',
          text: 'S',
          title: 'Solo',
          onclick: () => {
            cfg.solo = !cfg.solo;
            btnSolo.classList.toggle('is-active-solo', cfg.solo);
          },
        });

        const trackTitle = track.charAt(0).toUpperCase() + track.slice(1);
        const info = h(
          'div',
          { class: 'nx-beatlab-track-info' },
          h('span', { text: trackTitle }),
          h('div', { class: 'nx-beatlab-track-btns' }, btnMute, btnSolo),
        );

        const stepsRow = h(
          'div',
          { class: 'nx-beatlab-steps' },
          ...steps.map((vel, sIdx) => {
            const isBeatStart = sIdx % 4 === 0;
            const stepBtn = h('div', {
              class: `nx-beatlab-step${isBeatStart ? ' is-beat-start' : ''}${vel > 0 ? ' is-active' : ''}`,
              dataset: { step: String(sIdx) },
              title: `Step ${sIdx + 1} (${track})`,
              onclick: () => {
                const newVel = steps[sIdx] > 0 ? 0 : 0.85;
                steps[sIdx] = newVel;
                stepBtn.classList.toggle('is-active', newVel > 0);
              },
            });
            return stepBtn;
          }),
        );

        return h('div', { class: 'nx-beatlab-row nx-beatlab-track' }, info, stepsRow);
      }),
    );
  }

  // Export song as WAV
  async function exportSongAsWav() {
    try {
      ctx.notifications.show({ title: 'Exporting WAV', body: 'Rendering audio offline…' });
      const renderedBuffer = await scheduler.renderOffline(4);
      const wavBlob = audioBufferToWav(renderedBuffer);

      const filename = `Beat_${Date.now()}.wav`;
      const targetPath = `/Music/${filename}`;
      await ctx.vfs.write(targetPath, wavBlob);

      // Trigger download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(wavBlob);
      a.download = filename;
      a.click();

      ctx.notifications.show({ title: 'Beat Exported', body: `Saved to ${targetPath} and downloaded.` });
    } catch (err) {
      console.warn('WAV export error:', err);
    }
  }

  // Save project .nbeat
  async function saveProject() {
    const data = {
      bpm: scheduler.bpm,
      swing: scheduler.swing,
      patterns: scheduler.patterns,
      songChain: scheduler.songChain,
      trackConfig: scheduler.trackConfig,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `Project_${Date.now()}.nbeat`;
    const path = `/Music/${filename}`;
    try {
      await ctx.vfs.write(path, new Blob([jsonStr], { type: 'application/json' }));
      ctx.notifications.show({ title: 'Project Saved', body: `Saved to ${path}` });
    } catch (err) {
      console.warn('Save error:', err);
    }
  }

  renderMatrix();

  container.append(root);

  return {
    unmount() {
      scheduler.stop();
      if (audioCtx) audioCtx.close();
    },
  };
}
