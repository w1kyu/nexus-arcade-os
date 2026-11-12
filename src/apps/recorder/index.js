// @ts-check
import { h, icon } from '../../ui/dom.js';
import './styles.css';

function formatRecorderTime(sec) {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}

/**
 * Voice Recorder Application.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(container, ctx) {
  const t = (key, fallback) => ctx.i18n.t(key, fallback);

  /** @type {'idle' | 'recording' | 'paused' | 'playback'} */
  let state = 'idle';

  /** @type {MediaStream | null} */
  let mediaStream = null;
  /** @type {MediaRecorder | null} */
  let mediaRecorder = null;
  /** @type {Blob[]} */
  let audioChunks = [];
  /** @type {AudioContext | null} */
  let audioCtx = null;
  /** @type {AnalyserNode | null} */
  let analyser = null;

  let elapsedSec = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let timerInterval = null;
  let animFrameId = 0;

  /** @type {Array<{ time: number, label: string }>} */
  let bookmarks = [];

  /** @type {Array<{ id: string, name: string, path: string, blob: Blob, duration: number, date: number, tags: string[] }>} */
  let recordings = [];
  let selectedRecordingIndex = -1;

  // Playback audio element
  const player = typeof Audio !== 'undefined' ? new Audio() : null;
  let playbackSpeed = 1.0;

  // Trimming state
  let trimStart = 0;
  let trimEnd = 0;

  const root = h('div', { class: 'nx-recorder' });

  // Main recording section
  const main = h('main', { class: 'nx-recorder-main' });
  const timerLabel = h('div', { class: 'nx-recorder-timer', text: '00:00.0' });

  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-recorder-waveform-canvas' }));
  const controlsRow = h('div', { class: 'nx-recorder-controls' });

  const btnRecord = h(
    'button',
    { class: 'nx-recorder-record-btn', type: 'button', title: 'Record' },
    icon('mic', { size: 28 }),
  );
  const btnPause = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Pause', style: 'display: none;' },
    icon('pause', { size: 22 }),
  );
  const btnStop = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Stop', style: 'display: none;' },
    icon('stop', { size: 22 }),
  );
  const btnBookmark = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Add Bookmark', style: 'display: none;' },
    icon('bookmark', { size: 20 }),
    h('span', { text: 'Bookmark' }),
  );

  controlsRow.append(btnPause, btnRecord, btnStop, btnBookmark);

  // Playback & Trimming Section
  const playbackPanel = h('div', { class: 'nx-recorder-trim-panel', style: 'display: none;' });
  const playbackProgress = h('input', { class: 'nx-slider', type: 'range', min: '0', max: '100', value: '0' });
  const playbackTime = h('span', {
    style: 'font-size: 12px; color: var(--nx-text-muted); text-align: center;',
    text: '00:00 / 00:00',
  });

  const speedSelect = h(
    'select',
    {
      class: 'nx-select',
      style: 'width: 72px;',
      onchange: (e) => {
        playbackSpeed = parseFloat(/** @type {HTMLSelectElement} */ (e.target).value);
        if (player) player.playbackRate = playbackSpeed;
      },
    },
    h('option', { value: '0.5', text: '0.5x' }),
    h('option', { value: '0.75', text: '0.75x' }),
    h('option', { value: '1.0', text: '1.0x', selected: true }),
    h('option', { value: '1.25', text: '1.25x' }),
    h('option', { value: '1.5', text: '1.5x' }),
    h('option', { value: '2.0', text: '2.0x' }),
  );

  const btnTrim = h('button', { class: 'nx-btn is-ghost', type: 'button', text: 'Trim Selection' });
  const btnDownload = h('button', { class: 'nx-btn is-ghost', type: 'button', text: 'Download WAV' });

  const playbackControls = h(
    'div',
    { style: 'display: flex; gap: 8px; justify-content: center; align-items: center;' },
    speedSelect,
    btnTrim,
    btnDownload,
  );

  playbackPanel.append(playbackProgress, playbackTime, playbackControls);
  main.append(timerLabel, canvas, controlsRow, playbackPanel);

  // Sidebar Recordings List
  const sidebar = h('aside', { class: 'nx-recorder-sidebar' });
  const sidebarHeader = h('div', {
    class: 'nx-recorder-sidebar-header',
    text: t('recorder.recordings', 'Saved Recordings'),
  });
  const listEl = h('div', { class: 'nx-recorder-list' });
  sidebar.append(sidebarHeader, listEl);

  root.append(main, sidebar);

  // Canvas visualizer loop
  function drawLiveWaveform() {
    const cctx = canvas.getContext('2d');
    if (!cctx) return;
    const w = canvas.width;
    const h = canvas.height;
    cctx.clearRect(0, 0, w, h);

    if (state === 'recording' && analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);

      cctx.lineWidth = 2.5;
      cctx.strokeStyle = '#ef4444';
      cctx.beginPath();

      const sliceWidth = w / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) cctx.moveTo(x, y);
        else cctx.lineTo(x, y);
        x += sliceWidth;
      }
      cctx.stroke();
    } else {
      // Idle straight line
      cctx.lineWidth = 1.5;
      cctx.strokeStyle = '#334155';
      cctx.beginPath();
      cctx.moveTo(0, h / 2);
      cctx.lineTo(w, h / 2);
      cctx.stroke();
    }

    animFrameId = requestAnimationFrame(drawLiveWaveform);
  }

  // Recording controls
  async function startRecording() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || /** @type {any} */ (window).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      mediaRecorder = new MediaRecorder(mediaStream);
      audioChunks = [];
      bookmarks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        await saveRecording(audioBlob);
      };

      mediaRecorder.start(250);
      state = 'recording';
      elapsedSec = 0;
      timerLabel.classList.add('is-recording');

      btnRecord.classList.add('is-active');
      btnPause.style.display = 'inline-flex';
      btnStop.style.display = 'inline-flex';
      btnBookmark.style.display = 'inline-flex';
      playbackPanel.style.display = 'none';

      timerInterval = setInterval(() => {
        elapsedSec += 0.1;
        timerLabel.textContent = formatRecorderTime(elapsedSec);
      }, 100);
    } catch (err) {
      console.warn('Microphone permission error:', err);
      ctx.notifications.show({ title: 'Microphone Error', body: 'Could not access microphone.' });
    }
  }

  function pauseRecording() {
    if (state === 'recording' && mediaRecorder) {
      mediaRecorder.pause();
      state = 'paused';
      btnPause.replaceChildren(icon('play', { size: 22 }));
      if (timerInterval) clearInterval(timerInterval);
    } else if (state === 'paused' && mediaRecorder) {
      mediaRecorder.resume();
      state = 'recording';
      btnPause.replaceChildren(icon('pause', { size: 22 }));
      timerInterval = setInterval(() => {
        elapsedSec += 0.1;
        timerLabel.textContent = formatRecorderTime(elapsedSec);
      }, 100);
    }
  }

  function stopRecording() {
    if (mediaRecorder && state !== 'idle') {
      mediaRecorder.stop();
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      if (audioCtx) audioCtx.close();
      if (timerInterval) clearInterval(timerInterval);

      state = 'idle';
      timerLabel.classList.remove('is-recording');
      btnRecord.classList.remove('is-active');
      btnPause.style.display = 'none';
      btnStop.style.display = 'none';
      btnBookmark.style.display = 'none';
    }
  }

  btnRecord.onclick = () => {
    if (state === 'idle') startRecording();
    else stopRecording();
  };
  btnPause.onclick = () => pauseRecording();
  btnStop.onclick = () => stopRecording();

  btnBookmark.onclick = () => {
    bookmarks.push({ time: elapsedSec, label: `Bookmark @ ${formatRecorderTime(elapsedSec)}` });
    ctx.notifications.show({ title: 'Bookmark Added', body: `Marker at ${formatRecorderTime(elapsedSec)}` });
  };

  // Save recording to VFS /Music/Recordings
  async function saveRecording(blob) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Recording_${timestamp}.webm`;
    const path = `/Music/Recordings/${filename}`;

    try {
      await ctx.vfs.write(path, blob);
    } catch {
      /* ignore */
    }

    recordings.unshift({
      id: path,
      name: filename,
      path,
      blob,
      duration: elapsedSec,
      date: Date.now(),
      tags: [],
    });

    renderRecordingsList();
    ctx.notifications.show({ title: 'Recording Saved', body: `Saved to ${path}` });
  }

  // Scan existing recordings in /Music/Recordings
  async function scanVfsRecordings() {
    try {
      const entries = await ctx.vfs.list('/Music/Recordings');
      for (const entry of entries) {
        if (entry.type === 'file' && /\.(webm|wav|ogg|mp3)$/i.test(entry.name)) {
          const path = `/Music/Recordings/${entry.name}`;
          if (!recordings.some((r) => r.path === path)) {
            const blob = await ctx.vfs.read(path);
            recordings.push({
              id: path,
              name: entry.name,
              path,
              blob,
              duration: 0,
              date: Date.now(),
              tags: [],
            });
          }
        }
      }
      renderRecordingsList();
    } catch {
      /* /Music/Recordings empty */
    }
  }

  function renderRecordingsList() {
    if (recordings.length === 0) {
      listEl.replaceChildren(
        h('div', {
          style: 'padding: 20px; text-align: center; color: var(--nx-text-muted); font-size: 12px;',
          text: 'No recordings yet',
        }),
      );
      return;
    }

    listEl.replaceChildren(
      ...recordings.map((rec, idx) =>
        h(
          'div',
          {
            class: `nx-recorder-item${idx === selectedRecordingIndex ? ' is-selected' : ''}`,
            onclick: () => selectRecording(idx),
          },
          h('span', { class: 'nx-recorder-item-title', text: rec.name }),
          h(
            'div',
            { class: 'nx-recorder-item-meta' },
            h('span', {
              text: rec.duration ? formatRecorderTime(rec.duration) : `${(rec.blob.size / 1024).toFixed(0)} KB`,
            }),
            h('span', { text: new Date(rec.date).toLocaleDateString() }),
          ),
        ),
      ),
    );
  }

  function selectRecording(index) {
    if (index < 0 || index >= recordings.length || !player) return;
    selectedRecordingIndex = index;
    renderRecordingsList();
    const rec = recordings[index];
    const url = URL.createObjectURL(rec.blob);
    player.src = url;
    player.playbackRate = playbackSpeed;

    playbackPanel.style.display = 'flex';
    trimStart = 0;
    trimEnd = rec.duration || 10;

    player.play().catch(() => {});
  }

  if (player) {
    player.addEventListener('timeupdate', () => {
      const cur = player.currentTime;
      const dur = player.duration || 0;
      if (dur > 0) {
        playbackProgress.value = String((cur / dur) * 100);
        playbackTime.textContent = `${formatRecorderTime(cur)} / ${formatRecorderTime(dur)}`;
      }
    });
  }

  playbackProgress.oninput = (e) => {
    if (!player || !player.duration) return;
    const pct = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) / 100;
    player.currentTime = pct * player.duration;
  };

  btnDownload.onclick = () => {
    if (selectedRecordingIndex < 0) return;
    const rec = recordings[selectedRecordingIndex];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(rec.blob);
    a.download = rec.name;
    a.click();
  };

  btnTrim.onclick = async () => {
    if (selectedRecordingIndex < 0 || !player) return;
    const rec = recordings[selectedRecordingIndex];
    const dur = player.duration || rec.duration;
    const startStr = await ctx.dialog.prompt('Trim start time (seconds):', '0');
    if (startStr === null) return;
    const endStr = await ctx.dialog.prompt(`Trim end time (seconds, max ${dur.toFixed(1)}):`, String(dur.toFixed(1)));
    if (endStr === null) return;

    trimStart = Math.max(0, parseFloat(startStr));
    trimEnd = Math.min(dur, parseFloat(endStr));

    ctx.notifications.show({
      title: 'Trim Configured',
      body: `Trim window set from ${trimStart}s to ${trimEnd}s`,
    });
  };

  setTimeout(() => {
    canvas.width = canvas.clientWidth || 600;
    canvas.height = canvas.clientHeight || 140;
    drawLiveWaveform();
  }, 50);

  scanVfsRecordings();

  container.append(root);

  return {
    unmount() {
      stopRecording();
      if (player) player.pause();
      if (animFrameId) cancelAnimationFrame(animFrameId);
    },
  };
}
