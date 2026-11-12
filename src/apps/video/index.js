// @ts-check
import { h, icon } from '../../ui/dom.js';
import './styles.css';
import { parseSubtitles } from './subtitles.js';

function formatVideoTime(sec) {
  if (isNaN(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Video Player Application.
 * @param {HTMLElement} hostElement
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(hostElement, ctx) {
  const t = (key, fallback) => ctx.i18n.t(key, fallback);

  /** @type {Array<{ id: string, name: string, url: string, path?: string, blob?: Blob }>} */
  let playlist = [];
  let currentVideoIndex = -1;
  let isPlaying = false;
  /** @type {Array<import('./subtitles').SubtitleCue>} */
  let subtitleCues = [];
  let subtitleOffset = 0;
  let subtitleSize = 18;
  let subtitleColor = '#ffffff';

  // A-B loop state
  /** @type {number | null} */
  let loopA = null;
  /** @type {number | null} */
  let loopB = null;

  // Saved resume positions
  /** @type {Record<string, number>} */
  let resumePositions = {};
  try {
    const saved = await ctx.storage.get('playback', 'positions');
    if (saved) resumePositions = saved;
  } catch {
    /* storage optional */
  }

  const root = h('div', { class: 'nx-video' });

  // Main video container
  const container = h('div', { class: 'nx-video-container' });
  const video = /** @type {HTMLVideoElement} */ (
    h('video', {
      class: 'nx-video-element',
      playsInline: true,
      crossOrigin: 'anonymous',
    })
  );

  // Hidden preview video for scrubber hover previews
  const previewVideo = /** @type {HTMLVideoElement} */ (
    h('video', {
      playsInline: true,
      muted: true,
      crossOrigin: 'anonymous',
      style: 'display: none;',
    })
  );

  const previewCanvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-video-preview-canvas' }));
  const previewTime = h('span', { class: 'nx-video-preview-time', text: '0:00' });
  const scrubberPreview = h(
    'div',
    { class: 'nx-video-scrubber-preview', style: 'display: none;' },
    previewCanvas,
    previewTime,
  );

  // Subtitle overlay
  const subtitleText = h('div', { class: 'nx-video-subtitle-cue', style: 'display: none;' });
  const subtitleOverlay = h('div', { class: 'nx-video-subtitle-overlay' }, subtitleText);

  // Controls overlay
  const controls = h('div', { class: 'nx-video-controls' });
  /** @type {ReturnType<typeof setTimeout> | null} */
  let hideControlsTimer = null;

  function showControls() {
    controls.classList.remove('is-hidden');
    if (hideControlsTimer) clearTimeout(hideControlsTimer);
    if (isPlaying) {
      hideControlsTimer = setTimeout(() => {
        controls.classList.add('is-hidden');
      }, 3500);
    }
  }

  container.onmousemove = () => showControls();
  container.onclick = (e) => {
    // If clicking directly on video, toggle play
    if (e.target === video || e.target === container) {
      togglePlay();
    }
  };

  // Timeline
  const progressBar = h('input', {
    class: 'nx-slider',
    type: 'range',
    min: '0',
    max: '100',
    value: '0',
    style: 'flex: 1;',
  });

  const timeLabel = h('span', { class: 'nx-video-time', text: '0:00 / 0:00' });
  const timelineRow = h('div', { class: 'nx-video-timeline-row' }, progressBar, timeLabel, scrubberPreview);

  // Control buttons
  const btnPlay = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('play', { size: 20 }));
  const btnStepBack = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: t('video.stepBack', 'Step -1 frame') },
    icon('chevron-left', { size: 16 }),
  );
  const btnStepForward = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: t('video.stepForward', 'Step +1 frame') },
    icon('chevron-right', { size: 16 }),
  );

  const btnVol = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('volume', { size: 18 }));
  const volSlider = h('input', {
    class: 'nx-slider',
    type: 'range',
    min: '0',
    max: '1',
    step: '0.05',
    value: '1',
    style: 'width: 72px;',
  });

  const speedSelect = h(
    'select',
    {
      class: 'nx-select',
      style: 'background: rgba(30, 41, 59, 0.8); color: white; width: 68px; padding: 2px 4px; font-size: 11px;',
      onchange: (e) => {
        video.playbackRate = parseFloat(/** @type {HTMLSelectElement} */ (e.target).value);
      },
    },
    h('option', { value: '0.25', text: '0.25x' }),
    h('option', { value: '0.5', text: '0.5x' }),
    h('option', { value: '0.75', text: '0.75x' }),
    h('option', { value: '1.0', text: '1.0x', selected: true }),
    h('option', { value: '1.25', text: '1.25x' }),
    h('option', { value: '1.5', text: '1.5x' }),
    h('option', { value: '2.0', text: '2.0x' }),
    h('option', { value: '3.0', text: '3.0x' }),
  );

  const filterSelect = h(
    'select',
    {
      class: 'nx-select',
      style: 'background: rgba(30, 41, 59, 0.8); color: white; width: 88px; padding: 2px 4px; font-size: 11px;',
      onchange: (e) => {
        const f = /** @type {HTMLSelectElement} */ (e.target).value;
        if (f === 'bright') video.style.filter = 'brightness(1.3) contrast(1.1)';
        else if (f === 'contrast') video.style.filter = 'contrast(1.4) saturate(1.2)';
        else if (f === 'vibrant') video.style.filter = 'saturate(1.6) contrast(1.1)';
        else if (f === 'bw') video.style.filter = 'grayscale(1)';
        else if (f === 'invert') video.style.filter = 'invert(1)';
        else if (f === 'night') video.style.filter = 'sepia(0.8) hue-rotate(80deg)';
        else video.style.filter = 'none';
      },
    },
    h('option', { value: 'normal', text: 'Filter: None' }),
    h('option', { value: 'bright', text: 'Bright' }),
    h('option', { value: 'contrast', text: 'High Contrast' }),
    h('option', { value: 'vibrant', text: 'Vibrant' }),
    h('option', { value: 'bw', text: 'B&W' }),
    h('option', { value: 'night', text: 'Night Vision' }),
    h('option', { value: 'invert', text: 'Invert' }),
  );

  const btnLoopAB = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: t('video.loopAB', 'A-B Loop (Set A / Set B / Clear)'),
    },
    h('span', { text: 'A-B' }),
  );

  const btnSubtitles = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: t('video.subtitles', 'Load Subtitles (.srt, .vtt)'),
      onclick: () => openSubtitlesPicker(),
    },
    icon('file-text', { size: 18 }),
  );

  const btnScreenshot = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: t('video.screenshot', 'Screenshot Frame to Pictures'),
      onclick: () => captureFrameScreenshot(),
    },
    icon('camera', { size: 18 }),
  );

  const btnPip = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: t('video.pip', 'Picture-in-Picture'),
      onclick: async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            await video.requestPictureInPicture();
          }
        } catch (err) {
          console.warn('PiP not supported or failed:', err);
        }
      },
    },
    icon('window', { size: 18 }),
  );

  const btnFullscreen = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: t('video.fullscreen', 'Fullscreen'),
      onclick: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (container.requestFullscreen) {
          container.requestFullscreen();
        }
      },
    },
    icon('maximize', { size: 18 }),
  );

  const btnPlaylistToggle = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: t('video.playlist', 'Toggle Playlist'),
      onclick: () => {
        sidebar.classList.toggle('is-collapsed');
      },
    },
    icon('menu', { size: 18 }),
  );

  const leftControls = h(
    'div',
    { class: 'nx-video-btn-group' },
    btnPlay,
    btnStepBack,
    btnStepForward,
    btnVol,
    volSlider,
    btnLoopAB,
  );
  const rightControls = h(
    'div',
    { class: 'nx-video-btn-group' },
    speedSelect,
    filterSelect,
    btnSubtitles,
    btnScreenshot,
    btnPip,
    btnFullscreen,
    btnPlaylistToggle,
  );

  const buttonsRow = h('div', { class: 'nx-video-buttons-row' }, leftControls, rightControls);
  controls.append(timelineRow, buttonsRow);

  container.append(video, previewVideo, subtitleOverlay, controls);

  // Sidebar Playlist
  const sidebar = h('aside', { class: 'nx-video-sidebar is-collapsed' });
  const playlistHead = h(
    'div',
    { class: 'nx-video-sidebar-head' },
    h('span', { text: t('video.playlist', 'Playlist') }),
    h(
      'button',
      {
        class: 'nx-btn is-ghost',
        type: 'button',
        title: 'Open local video file',
        onclick: () => importVideoFile(),
      },
      icon('plus', { size: 16 }),
    ),
  );
  const playlistItems = h('div', { class: 'nx-video-playlist-items' });
  sidebar.append(playlistHead, playlistItems);

  root.append(container, sidebar);

  // Video playback functions
  function togglePlay() {
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  function playVideoIndex(index) {
    if (index < 0 || index >= playlist.length) return;
    currentVideoIndex = index;
    const item = playlist[index];
    video.src = item.url;
    previewVideo.src = item.url;

    // Check resume position
    const resumeAt = resumePositions[item.id] || resumePositions[item.path || ''];
    if (resumeAt && resumeAt > 10) {
      video.currentTime = resumeAt;
    }

    video.play().catch(() => {});
    renderPlaylist();
  }

  function renderPlaylist() {
    playlistItems.replaceChildren(
      ...playlist.map((item, idx) =>
        h(
          'button',
          {
            class: `nx-video-playlist-item${idx === currentVideoIndex ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => playVideoIndex(idx),
          },
          icon('file-video', { size: 16 }),
          h('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;', text: item.name }),
        ),
      ),
    );
  }

  async function savePositions() {
    try {
      await ctx.storage.set('playback', 'positions', resumePositions);
    } catch {
      /* storage optional */
    }
  }

  // Scrubber preview on hover
  progressBar.addEventListener('mousemove', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * (video.duration || 0);

    scrubberPreview.style.display = 'flex';
    scrubberPreview.style.left = `${e.clientX - rect.left}px`;
    previewTime.textContent = formatVideoTime(targetTime);

    if (previewVideo.duration) {
      previewVideo.currentTime = targetTime;
      const pctx = previewCanvas.getContext('2d');
      if (pctx) {
        previewCanvas.width = 120;
        previewCanvas.height = 68;
        pctx.drawImage(previewVideo, 0, 0, 120, 68);
      }
    }
  });

  progressBar.addEventListener('mouseleave', () => {
    scrubberPreview.style.display = 'none';
  });

  progressBar.oninput = (e) => {
    const pct = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) / 100;
    if (video.duration) {
      video.currentTime = pct * video.duration;
    }
  };

  btnPlay.onclick = () => togglePlay();
  btnStepBack.onclick = () => {
    video.currentTime = Math.max(0, video.currentTime - 1 / 30);
  };
  btnStepForward.onclick = () => {
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 1 / 30);
  };

  btnVol.onclick = () => {
    video.muted = !video.muted;
    btnVol.replaceChildren(icon(video.muted ? 'volume-off' : 'volume', { size: 18 }));
  };

  volSlider.oninput = (e) => {
    video.volume = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
    video.muted = false;
    btnVol.replaceChildren(icon(video.volume === 0 ? 'volume-off' : 'volume', { size: 18 }));
  };

  // A-B loop button
  btnLoopAB.onclick = () => {
    if (loopA === null) {
      loopA = video.currentTime;
      btnLoopAB.style.color = '#38bdf8';
      btnLoopAB.title = `Loop A set: ${formatVideoTime(loopA)}. Click again to set B.`;
    } else if (loopB === null) {
      loopB = Math.max(loopA + 0.5, video.currentTime);
      btnLoopAB.style.color = '#4ade80';
      btnLoopAB.title = `Looping ${formatVideoTime(loopA)} - ${formatVideoTime(loopB)}. Click to clear.`;
    } else {
      loopA = null;
      loopB = null;
      btnLoopAB.style.color = '';
      btnLoopAB.title = t('video.loopAB', 'A-B Loop');
    }
  };

  // Video Events
  video.addEventListener('play', () => {
    isPlaying = true;
    btnPlay.replaceChildren(icon('pause', { size: 20 }));
    showControls();
  });

  video.addEventListener('pause', () => {
    isPlaying = false;
    btnPlay.replaceChildren(icon('play', { size: 20 }));
    showControls();
  });

  video.addEventListener('timeupdate', () => {
    const cur = video.currentTime;
    const dur = video.duration || 0;
    if (dur > 0) {
      progressBar.value = String((cur / dur) * 100);
      timeLabel.textContent = `${formatVideoTime(cur)} / ${formatVideoTime(dur)}`;
    }

    // A-B Loop check
    if (loopA !== null && loopB !== null && cur >= loopB) {
      video.currentTime = loopA;
    }

    // Save position
    if (currentVideoIndex >= 0 && playlist[currentVideoIndex]) {
      const item = playlist[currentVideoIndex];
      resumePositions[item.id] = cur;
    }

    // Subtitle cue matching
    if (subtitleCues.length > 0) {
      const activeCue = subtitleCues.find((c) => cur >= c.start && cur <= c.end);
      if (activeCue) {
        subtitleText.style.display = 'inline-block';
        subtitleText.textContent = activeCue.text;
        subtitleText.style.fontSize = `${subtitleSize}px`;
        subtitleText.style.color = subtitleColor;
      } else {
        subtitleText.style.display = 'none';
      }
    } else {
      subtitleText.style.display = 'none';
    }
  });

  video.addEventListener('ended', () => {
    if (currentVideoIndex + 1 < playlist.length) {
      playVideoIndex(currentVideoIndex + 1);
    }
  });

  // Capture frame screenshot to /Pictures
  async function captureFrameScreenshot() {
    if (!video.videoWidth || !video.videoHeight) return;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const sctx = snapCanvas.getContext('2d');
    if (!sctx) return;
    sctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

    snapCanvas.toBlob(async (blob) => {
      if (!blob) return;
      const filename = `Screenshot_${Date.now()}.png`;
      const targetPath = `/Pictures/${filename}`;
      try {
        await ctx.vfs.write(targetPath, blob);
        ctx.notifications.show({
          title: 'Screenshot Captured',
          body: `Saved frame to ${targetPath}`,
        });
      } catch (err) {
        console.warn('Screenshot save error:', err);
      }
    }, 'image/png');
  }

  // Load subtitles dialog
  async function openSubtitlesPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.vtt,text/vtt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      subtitleCues = parseSubtitles(text, subtitleOffset);
      ctx.notifications.show({
        title: 'Subtitles Loaded',
        body: `Parsed ${subtitleCues.length} subtitle cues from ${file.name}`,
      });
    };
    input.click();
  }

  // Import local video
  function importVideoFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'video/*,.mp4,.webm,.ogv,.mkv,.mov';
    input.onchange = () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        playlist.push({
          id: `vid-${Date.now()}-${i}`,
          name: file.name,
          url,
          blob: file,
        });
      }
      renderPlaylist();
      if (currentVideoIndex === -1 && playlist.length > 0) {
        playVideoIndex(0);
      }
    };
    input.click();
  }

  // Check initial file opened via handle action (e.g. double click in Files)
  if (ctx.params?.file) {
    const file = ctx.params.file;
    const url = URL.createObjectURL(file);
    playlist.push({
      id: `open-${Date.now()}`,
      name: file.name || 'Video',
      url,
      blob: file,
    });
    playVideoIndex(0);
  } else if (ctx.params?.path) {
    // Read from VFS
    try {
      const blob = await ctx.vfs.read(ctx.params.path);
      const url = URL.createObjectURL(blob);
      playlist.push({
        id: ctx.params.path,
        name: ctx.params.path.split('/').pop() || 'Video',
        url,
        path: ctx.params.path,
        blob,
      });
      playVideoIndex(0);
    } catch {
      /* file not found */
    }
  }

  // Scan VFS /Videos folder for videos if playlist empty
  if (playlist.length === 0) {
    try {
      const entries = await ctx.vfs.list('/Videos');
      for (const entry of entries) {
        if (entry.type === 'file' && /\.(mp4|webm|ogv|mov)$/i.test(entry.name)) {
          const path = `/Videos/${entry.name}`;
          const blob = await ctx.vfs.read(path);
          playlist.push({
            id: path,
            name: entry.name,
            url: URL.createObjectURL(blob),
            path,
            blob,
          });
        }
      }
      if (playlist.length > 0) {
        playVideoIndex(0);
      }
    } catch {
      /* /Videos empty or not created yet */
    }
  }

  renderPlaylist();

  hostElement.append(root);

  return {
    unmount() {
      video.pause();
      savePositions();
      if (hideControlsTimer) clearTimeout(hideControlsTimer);
    },
  };
}
