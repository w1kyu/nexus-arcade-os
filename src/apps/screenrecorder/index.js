// @ts-check
import { h, icon } from '../../ui/dom.js';
import './styles.css';

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Screen Recorder application.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(container, ctx) {
  let isRecording = false;
  let isPaused = false;
  let elapsedSec = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let timerInterval = null;

  /** @type {MediaStream | null} */
  let displayStream = null;
  /** @type {MediaStream | null} */
  let micStream = null;
  /** @type {MediaRecorder | null} */
  let mediaRecorder = null;
  /** @type {Blob[]} */
  let recordedChunks = [];
  let includeMic = false;

  const root = h('div', { class: 'nx-screenrecorder' });

  // Preview container
  const previewWrap = h('div', { class: 'nx-screenrecorder-preview-wrap' });
  const previewVideo = /** @type {HTMLVideoElement} */ (
    h('video', {
      class: 'nx-screenrecorder-video',
      autoplay: true,
      playsInline: true,
      muted: true,
    })
  );

  const placeholder = h(
    'div',
    { style: 'display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--nx-text-muted);' },
    icon('monitor', { size: 48 }),
    h('span', { text: 'Ready to record screen, window or browser tab' }),
  );

  const badge = h(
    'div',
    { class: 'nx-screenrecorder-badge', style: 'display: none;' },
    h('span', { class: 'nx-screenrecorder-badge-dot' }),
    h('span', { class: 'nx-screenrecorder-timer-text', text: 'REC 00:00' }),
  );

  previewWrap.append(placeholder, previewVideo, badge);

  // Controls Toolbar
  const toolbar = h('div', { class: 'nx-screenrecorder-toolbar' });

  const micCheckbox = h('input', {
    type: 'checkbox',
    id: 'nx-sr-mic',
    onchange: (e) => {
      includeMic = /** @type {HTMLInputElement} */ (e.target).checked;
    },
  });

  const micLabel = h(
    'label',
    { for: 'nx-sr-mic', style: 'display: flex; gap: 6px; align-items: center; font-size: 13px; cursor: pointer;' },
    micCheckbox,
    icon('mic', { size: 16 }),
    h('span', { text: 'Include Microphone' }),
  );

  const btnRecord = h(
    'button',
    {
      class: 'nx-btn is-primary',
      type: 'button',
      onclick: () => toggleScreenRecording(),
    },
    icon('video', { size: 18 }),
    h('span', { text: 'Start Recording' }),
  );

  const btnPause = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      style: 'display: none;',
      onclick: () => togglePause(),
    },
    icon('pause', { size: 18 }),
    h('span', { text: 'Pause' }),
  );

  toolbar.append(micLabel, btnPause, btnRecord);
  root.append(previewWrap, toolbar);

  async function toggleScreenRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      ctx.notifications.show({
        title: 'Not Supported',
        body: 'Screen recording (getDisplayMedia) is not supported by your current browser.',
      });
      return;
    }

    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      });

      // Handle user clicking native "Stop sharing" button
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      let combinedStream = displayStream;

      if (includeMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const AudioContextClass = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
          if (AudioContextClass) {
            const actx = new AudioContextClass();
            const dest = actx.createMediaStreamDestination();
            const micSource = actx.createMediaStreamSource(micStream);
            micSource.connect(dest);

            if (displayStream.getAudioTracks().length > 0) {
              const sysSource = actx.createMediaStreamSource(displayStream);
              sysSource.connect(dest);
            }

            combinedStream = new MediaStream([...displayStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
          }
        } catch {
          /* mic optional */
        }
      }

      previewVideo.srcObject = displayStream;
      placeholder.style.display = 'none';
      previewVideo.style.display = 'block';

      recordedChunks = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: mime });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        await saveRecording(blob);
      };

      mediaRecorder.start(1000);
      isRecording = true;
      isPaused = false;
      elapsedSec = 0;

      btnRecord.classList.remove('is-primary');
      btnRecord.classList.add('is-danger');
      btnRecord.replaceChildren(icon('stop', { size: 18 }), h('span', { text: 'Stop Recording' }));
      btnPause.style.display = 'inline-flex';
      badge.style.display = 'flex';

      timerInterval = setInterval(() => {
        elapsedSec++;
        const timerText = badge.querySelector('.nx-screenrecorder-timer-text');
        if (timerText) timerText.textContent = `REC ${formatDuration(elapsedSec)}`;
      }, 1000);
    } catch (err) {
      console.warn('Screen recording cancelled or failed:', err);
    }
  }

  function togglePause() {
    if (!mediaRecorder) return;
    if (!isPaused) {
      mediaRecorder.pause();
      isPaused = true;
      btnPause.replaceChildren(icon('play', { size: 18 }), h('span', { text: 'Resume' }));
      if (timerInterval) clearInterval(timerInterval);
    } else {
      mediaRecorder.resume();
      isPaused = false;
      btnPause.replaceChildren(icon('pause', { size: 18 }), h('span', { text: 'Pause' }));
      timerInterval = setInterval(() => {
        elapsedSec++;
        const timerText = badge.querySelector('.nx-screenrecorder-timer-text');
        if (timerText) timerText.textContent = `REC ${formatDuration(elapsedSec)}`;
      }, 1000);
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
      if (micStream) micStream.getTracks().forEach((t) => t.stop());
      if (timerInterval) clearInterval(timerInterval);

      isRecording = false;
      isPaused = false;
      btnRecord.classList.remove('is-danger');
      btnRecord.classList.add('is-primary');
      btnRecord.replaceChildren(icon('video', { size: 18 }), h('span', { text: 'Start Recording' }));
      btnPause.style.display = 'none';
      badge.style.display = 'none';
      placeholder.style.display = 'flex';
      previewVideo.style.display = 'none';
    }
  }

  async function saveRecording(blob) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `ScreenRecording_${timestamp}.webm`;
    const path = `/Videos/${filename}`;
    try {
      await ctx.vfs.write(path, blob);
      ctx.notifications.show({
        title: 'Screen Recording Saved',
        body: `Saved ${filename} to /Videos`,
      });
    } catch (err) {
      console.warn('VFS save error:', err);
    }
  }

  container.append(root);

  return {
    unmount() {
      stopRecording();
    },
  };
}
