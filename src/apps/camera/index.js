// @ts-check
import { h, icon } from '../../ui/dom.js';
import './styles.css';

/**
 * Camera / Photo Booth application with live filters, burst, video clips, and QR detector.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(container, ctx) {
  /** @type {'photo' | 'video' | 'qr'} */
  let mode = 'photo';
  let isRecording = false;
  let countdownSec = 0;
  let isBurst = false;
  /** @type {'normal' | 'grayscale' | 'sepia' | 'neon' | 'pixelate' | 'mirror' | 'thermal' | 'cyberpunk'} */
  let activeFilter = 'normal';

  /** @type {MediaStream | null} */
  let currentStream = null;
  /** @type {MediaRecorder | null} */
  let videoRecorder = null;
  /** @type {Blob[]} */
  let recordedChunks = [];
  let animId = 0;

  const root = h('div', { class: 'nx-camera' });

  // Camera viewport
  const viewWrap = h('div', { class: 'nx-camera-view-wrap' });
  const video = /** @type {HTMLVideoElement} */ (
    h('video', {
      class: 'nx-camera-video',
      autoplay: true,
      playsInline: true,
      muted: true,
    })
  );
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-camera-canvas' }));
  const countdownEl = h('div', { class: 'nx-camera-countdown', style: 'display: none;' });
  const flashEl = h('div', { class: 'nx-camera-flash' });

  viewWrap.append(video, canvas, countdownEl, flashEl);

  // Topbar options
  const topbar = h('div', { class: 'nx-camera-topbar' });

  const deviceSelect = h('select', { class: 'nx-select', style: 'background: rgba(15,23,42,0.8); color: white;' });
  deviceSelect.onchange = () => {
    const devId = /** @type {HTMLSelectElement} */ (deviceSelect).value;
    startCamera(devId);
  };

  const timerSelect = h(
    'select',
    { class: 'nx-select', style: 'background: rgba(15,23,42,0.8); color: white;' },
    h('option', { value: '0', text: 'Timer: Off' }),
    h('option', { value: '3', text: 'Timer: 3s' }),
    h('option', { value: '5', text: 'Timer: 5s' }),
    h('option', { value: '10', text: 'Timer: 10s' }),
  );

  const burstBtn = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: 'Burst mode (3 shots)',
      onclick: () => {
        isBurst = !isBurst;
        burstBtn.style.color = isBurst ? '#38bdf8' : '';
      },
    },
    icon('cards', { size: 18 }),
    h('span', { text: 'Burst' }),
  );

  const filterSelect = h(
    'select',
    {
      class: 'nx-select',
      style: 'background: rgba(15,23,42,0.8); color: white;',
      onchange: (e) => {
        activeFilter = /** @type {any} */ (/** @type {HTMLSelectElement} */ (e.target).value);
      },
    },
    h('option', { value: 'normal', text: 'Filter: Normal' }),
    h('option', { value: 'grayscale', text: 'Grayscale' }),
    h('option', { value: 'sepia', text: 'Sepia' }),
    h('option', { value: 'neon', text: 'Neon Edges' }),
    h('option', { value: 'pixelate', text: 'Pixelate' }),
    h('option', { value: 'mirror', text: 'Mirror' }),
    h('option', { value: 'thermal', text: 'Thermal Heat' }),
    h('option', { value: 'cyberpunk', text: 'Cyberpunk' }),
  );

  topbar.append(deviceSelect, h('div', { style: 'display: flex; gap: 8px;' }, timerSelect, burstBtn, filterSelect));

  // Bottom Toolbar
  const toolbar = h('div', { class: 'nx-camera-toolbar' });

  const modePhotoBtn = h('button', {
    class: 'nx-btn is-ghost',
    type: 'button',
    style: 'color: #818cf8;',
    text: 'Photo',
    onclick: () => setMode('photo'),
  });

  const modeVideoBtn = h('button', {
    class: 'nx-btn is-ghost',
    type: 'button',
    text: 'Video',
    onclick: () => setMode('video'),
  });

  const modeQrBtn = h('button', {
    class: 'nx-btn is-ghost',
    type: 'button',
    text: 'Scan QR',
    onclick: () => setMode('qr'),
  });

  const shutterBtn = h('button', {
    class: 'nx-camera-shutter-btn',
    type: 'button',
    title: 'Capture',
    onclick: () => handleShutterClick(),
  });

  toolbar.append(modePhotoBtn, shutterBtn, modeVideoBtn, modeQrBtn);
  root.append(topbar, viewWrap, toolbar);

  function setMode(newMode) {
    mode = newMode;
    modePhotoBtn.style.color = mode === 'photo' ? '#818cf8' : '';
    modeVideoBtn.style.color = mode === 'video' ? '#818cf8' : '';
    modeQrBtn.style.color = mode === 'qr' ? '#818cf8' : '';

    if (mode === 'video') {
      shutterBtn.classList.add('is-recording-mode');
    } else {
      shutterBtn.classList.remove('is-recording-mode');
    }
  }

  // Camera stream initialization
  async function startCamera(deviceId = '') {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' },
        audio: true,
      };
      currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = currentStream;
      await video.play();

      // Populate device list if not yet done
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      deviceSelect.replaceChildren(
        ...videoDevices.map((d, i) => h('option', { value: d.deviceId, text: d.label || `Camera ${i + 1}` })),
      );
    } catch (err) {
      console.warn('Camera stream error:', err);
      ctx.notifications.show({ title: 'Camera Error', body: 'Could not access camera device.' });
    }
  }

  // Canvas render loop applying live shader / filters
  function renderFrame() {
    const cctx = canvas.getContext('2d');
    if (cctx && video.videoWidth > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const w = canvas.width;
      const h = canvas.height;

      cctx.drawImage(video, 0, 0, w, h);

      if (activeFilter === 'grayscale') {
        const imgData = cctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
        }
        cctx.putImageData(imgData, 0, 0);
      } else if (activeFilter === 'sepia') {
        const imgData = cctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
          data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
          data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
        cctx.putImageData(imgData, 0, 0);
      } else if (activeFilter === 'pixelate') {
        const size = 16;
        const subW = Math.max(1, Math.round(w / size));
        const subH = Math.max(1, Math.round(h / size));
        cctx.imageSmoothingEnabled = false;
        cctx.drawImage(canvas, 0, 0, subW, subH);
        cctx.drawImage(canvas, 0, 0, subW, subH, 0, 0, w, h);
        cctx.imageSmoothingEnabled = true;
      } else if (activeFilter === 'mirror') {
        cctx.drawImage(canvas, 0, 0, w / 2, h, 0, 0, w / 2, h);
        cctx.save();
        cctx.translate(w, 0);
        cctx.scale(-1, 1);
        cctx.drawImage(canvas, 0, 0, w / 2, h, 0, 0, w / 2, h);
        cctx.restore();
      } else if (activeFilter === 'thermal') {
        const imgData = cctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const val = (data[i] + data[i + 1] + data[i + 2]) / 3;
          // Map to thermal palette: Blue -> Green -> Red -> Yellow
          if (val < 64) {
            data[i] = 0;
            data[i + 1] = val * 4;
            data[i + 2] = 255;
          } else if (val < 128) {
            data[i] = 0;
            data[i + 1] = 255;
            data[i + 2] = 255 - (val - 64) * 4;
          } else if (val < 192) {
            data[i] = (val - 128) * 4;
            data[i + 1] = 255;
            data[i + 2] = 0;
          } else {
            data[i] = 255;
            data[i + 1] = 255 - (val - 192) * 4;
            data[i + 2] = (val - 192) * 2;
          }
        }
        cctx.putImageData(imgData, 0, 0);
      } else if (activeFilter === 'cyberpunk') {
        const imgData = cctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.3 + 30); // Neon pink/magenta
          data[i + 2] = Math.min(255, data[i + 2] * 1.4 + 40); // Cyan/blue
        }
        cctx.putImageData(imgData, 0, 0);
      }
    }

    animId = requestAnimationFrame(renderFrame);
  }

  // Trigger flash
  function triggerFlash() {
    flashEl.classList.add('is-flashing');
    setTimeout(() => {
      flashEl.classList.remove('is-flashing');
    }, 120);
  }

  // Shutter action
  async function handleShutterClick() {
    if (mode === 'video') {
      toggleVideoRecording();
      return;
    }

    const timerVal = parseInt(/** @type {HTMLSelectElement} */ (timerSelect).value, 10);
    if (timerVal > 0) {
      countdownSec = timerVal;
      countdownEl.style.display = 'block';
      countdownEl.textContent = String(countdownSec);

      const interval = setInterval(async () => {
        countdownSec--;
        if (countdownSec > 0) {
          countdownEl.textContent = String(countdownSec);
        } else {
          clearInterval(interval);
          countdownEl.style.display = 'none';
          await capturePhoto();
        }
      }, 1000);
    } else {
      await capturePhoto();
    }
  }

  async function capturePhoto() {
    const numShots = isBurst ? 3 : 1;
    for (let s = 0; s < numShots; s++) {
      triggerFlash();
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = canvas.width;
      snapCanvas.height = canvas.height;
      const sctx = snapCanvas.getContext('2d');
      if (sctx) sctx.drawImage(canvas, 0, 0);

      snapCanvas.toBlob(
        async (blob) => {
          if (!blob) return;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const filename = `Photo_${timestamp}_${s + 1}.jpg`;
          const path = `/Pictures/${filename}`;
          try {
            await ctx.vfs.write(path, blob);
            ctx.notifications.show({ title: 'Photo Captured', body: `Saved to ${path}` });
          } catch (err) {
            console.warn('Photo write error:', err);
          }
        },
        'image/jpeg',
        0.95,
      );

      if (numShots > 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  }

  // Video recording
  function toggleVideoRecording() {
    if (!currentStream) return;
    if (isRecording && videoRecorder) {
      videoRecorder.stop();
      isRecording = false;
      shutterBtn.classList.remove('is-recording');
    } else {
      recordedChunks = [];
      videoRecorder = new MediaRecorder(currentStream);
      videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      videoRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `VideoClip_${timestamp}.webm`;
        const path = `/Videos/${filename}`;
        try {
          await ctx.vfs.write(path, blob);
          ctx.notifications.show({ title: 'Video Clip Saved', body: `Saved to ${path}` });
        } catch {
          /* ignore */
        }
      };
      videoRecorder.start();
      isRecording = true;
      shutterBtn.classList.add('is-recording');
    }
  }

  // QR / Barcode detection loop
  async function checkQrCode() {
    if (mode === 'qr' && 'BarcodeDetector' in window && canvas.width > 0) {
      try {
        const detector = new /** @type {any} */ (window).BarcodeDetector({ formats: ['qr_code', 'ean_13'] });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          ctx.notifications.show({ title: 'QR Code Detected', body: raw });
        }
      } catch {
        /* ignore */
      }
    }
  }

  const qrInterval = setInterval(checkQrCode, 1500);

  startCamera();
  renderFrame();

  container.append(root);

  return {
    unmount() {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
      if (animId) cancelAnimationFrame(animId);
      clearInterval(qrInterval);
    },
  };
}
