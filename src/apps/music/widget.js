// @ts-check
import { h, icon } from '../../ui/dom.js';
import { getSharedAudioEngine } from './player.js';

/**
 * Mini Player Desktop Widget for Nexus Music.
 * @param {import('../../kernel/types').WidgetContext} ctx
 */
export default function mountMusicWidget(ctx) {
  const engine = getSharedAudioEngine();
  const root = h('div', { class: 'nx-music-widget' });

  const art = h('div', { class: 'nx-music-widget-art' }, icon('music', { size: 24 }));
  const title = h('div', { class: 'nx-music-widget-title', text: 'No track playing' });
  const artist = h('div', { class: 'nx-music-widget-artist', text: 'Nexus Music' });
  const playBtn = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('play', { size: 18 }));
  const nextBtn = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('skip-forward', { size: 18 }));

  const progress = h('input', {
    class: 'nx-slider',
    type: 'range',
    min: '0',
    max: '100',
    value: '0',
    style: 'height: 4px; margin: 0;',
  });

  const controls = h(
    'div',
    { style: 'display: flex; align-items: center; justify-content: center; gap: 8px;' },
    playBtn,
    nextBtn,
  );

  root.append(
    h(
      'div',
      {
        class: 'nx-music-widget-meta',
        style: 'cursor: pointer;',
        onclick: () => ctx.system.apps.open('nexus.music'),
      },
      art,
      h('div', { class: 'nx-music-widget-info' }, title, artist),
    ),
    progress,
    controls,
  );

  function update() {
    const track = engine.currentTrack;
    if (track) {
      title.textContent = track.title;
      artist.textContent = track.artist;
      if (track.coverUrl) {
        art.replaceChildren(
          h('img', { src: track.coverUrl, style: 'width: 100%; height: 100%; border-radius: 6px; object-fit: cover;' }),
        );
      } else {
        art.replaceChildren(icon('music', { size: 24 }));
      }
    } else {
      title.textContent = 'Nexus Music';
      artist.textContent = 'Library ready';
      art.replaceChildren(icon('music', { size: 24 }));
    }

    playBtn.replaceChildren(icon(engine.isPlaying ? 'pause' : 'play', { size: 18 }));
  }

  playBtn.onclick = () => engine.togglePlay();
  nextBtn.onclick = () => engine.next();

  progress.oninput = (e) => {
    const pct = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) / 100;
    if (engine.duration > 0) {
      engine.seek(pct * engine.duration);
    }
  };

  const unsubscribe = engine.subscribe(update);
  const timeUpdateUnsub = () => {
    if (engine.duration > 0) {
      progress.value = String((engine.currentTime / engine.duration) * 100);
    } else {
      progress.value = '0';
    }
  };

  const timer = setInterval(timeUpdateUnsub, 500);

  update();

  return {
    element: root,
    unmount() {
      unsubscribe();
      clearInterval(timer);
    },
  };
}
