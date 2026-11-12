// @ts-check
import { h, icon, replace } from '../../ui/dom.js';
import { parseAudioMetadata, parseLrcLyrics } from './metadata.js';
import { EQ_PRESETS, getSharedAudioEngine } from './player.js';
import './styles.css';
import { MusicVisualizer } from './visualizer.js';

/**
 * Formats seconds into mm:ss or hh:mm:ss
 * @param {number} sec
 * @returns {string}
 */
function formatTime(sec) {
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
 * Nexus Music main application.
 * @param {HTMLElement} hostElement
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(hostElement, ctx) {
  const engine = getSharedAudioEngine();
  const t = (key, fallback) => ctx.i18n.t(key, fallback);

  /** @type {import('./player').Track[]} */
  let library = [];
  /** @type {Record<string, string[]>} */
  let playlists = {
    favorites: [],
  };
  /** @type {'songs' | 'albums' | 'artists' | 'playlists' | 'visualizer' | 'equalizer' | 'lyrics'} */
  let activeView = 'songs';
  /** @type {string | null} */
  let activePlaylistId = null;
  let searchQuery = '';
  /** @type {MusicVisualizer | null} */
  let visualizer = null;

  // Load playlists and library data from storage if available
  try {
    const savedPlaylists = await ctx.storage.get('playlists', 'user');
    if (savedPlaylists) playlists = { ...playlists, ...savedPlaylists };
    const savedLib = await ctx.storage.get('library', 'tracks');
    if (Array.isArray(savedLib)) library = savedLib;
  } catch {
    /* storage not available or empty */
  }

  // If library empty, seed bundled demo synthesized track or scan VFS
  if (library.length === 0) {
    library.push({
      id: 'demo-synthwave',
      title: 'Neon Odyssey',
      artist: 'Nexus Audio Labs',
      album: 'Arcade Dreams',
      duration: 184,
      year: '2026',
      track: 1,
      genre: 'Synthwave',
      playCount: 12,
      rating: 5,
      lyrics: `[00:00.00]Instrumental Intro
[00:15.00]Cruising through the electric night
[00:30.00]Neon reflections in the rearview mirror
[00:45.00]Synthesizers pulse through the digital air
[01:10.00]Accelerating into the cyber horizon
[01:40.00]Beat drops in cybernetic rhythm
[02:10.00]The city lights fade into binary memory`,
    });
  }

  const container = h('div', { class: 'nx-music' });

  // Sidebar
  const sidebar = h('aside', { class: 'nx-music-sidebar' });
  const playlistsContainer = h('div', { class: 'nx-music-playlists-list' });

  // Main area
  const main = h('main', { class: 'nx-music-main' });
  const header = h('div', { class: 'nx-music-header' });
  const titleEl = h('h2', { class: 'nx-music-title', text: 'Songs' });
  const searchInput = h('input', {
    class: 'nx-input nx-music-search',
    type: 'search',
    placeholder: t('music.search', 'Search songs, albums, artists…'),
    oninput: (e) => {
      searchQuery = /** @type {HTMLInputElement} */ (e.target).value.toLowerCase();
      renderContent();
    },
  });

  const scanBtn = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      onclick: () => scanVfsMusicFolder(),
    },
    icon('refresh', { size: 16 }),
    h('span', { text: t('music.scan', 'Scan /Music') }),
  );

  const importBtn = h(
    'button',
    {
      class: 'nx-btn is-primary',
      type: 'button',
      onclick: () => importLocalFiles(),
    },
    icon('plus', { size: 16 }),
    h('span', { text: t('music.import', 'Import Files') }),
  );

  header.append(
    titleEl,
    h('div', { style: 'display: flex; gap: 8px; align-items: center;' }, searchInput, scanBtn, importBtn),
  );

  const contentArea = h('div', { style: 'flex: 1; overflow-y: auto; display: flex; flex-direction: column;' });

  // Bottom player bar
  const playerBar = h('div', { class: 'nx-music-player-bar' });
  const barArt = h('div', { class: 'nx-music-bar-art' }, icon('music', { size: 24 }));
  const barTitle = h('span', { class: 'nx-music-bar-title', text: 'Nexus Music' });
  const barArtist = h('span', { class: 'nx-music-bar-artist', text: 'No track playing' });
  const barLeft = h(
    'div',
    { class: 'nx-music-bar-left' },
    barArt,
    h('div', { class: 'nx-music-bar-meta' }, barTitle, barArtist),
  );

  const btnShuffle = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('refresh', { size: 16 }));
  const btnPrev = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('skip-back', { size: 18 }));
  const btnPlay = h('button', { class: 'nx-music-btn-play', type: 'button' }, icon('play', { size: 20 }));
  const btnNext = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('skip-forward', { size: 18 }));
  const btnRepeat = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('refresh', { size: 16 }));

  const btnSkipBack = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: '-15s' },
    h('span', { text: '-15' }),
  );
  const btnSkipForward = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: '+30s' },
    h('span', { text: '+30' }),
  );

  const controls = h(
    'div',
    { class: 'nx-music-controls' },
    btnShuffle,
    btnSkipBack,
    btnPrev,
    btnPlay,
    btnNext,
    btnSkipForward,
    btnRepeat,
  );

  const timeCurrent = h('span', { class: 'nx-music-time', text: '0:00' });
  const timeTotal = h('span', { class: 'nx-music-time', text: '0:00' });
  const progressBar = h('input', {
    class: 'nx-slider',
    type: 'range',
    min: '0',
    max: '100',
    value: '0',
    style: 'flex: 1;',
  });

  const timeline = h('div', { class: 'nx-music-timeline' }, timeCurrent, progressBar, timeTotal);
  const barCenter = h('div', { class: 'nx-music-bar-center' }, controls, timeline);

  const speedSelect = h(
    'select',
    {
      class: 'nx-select',
      style: 'width: 68px; padding: 2px 4px; font-size: 11px;',
      onchange: (e) => engine.setSpeed(parseFloat(/** @type {HTMLSelectElement} */ (e.target).value)),
    },
    h('option', { value: '0.75', text: '0.75x' }),
    h('option', { value: '1.0', text: '1.0x', selected: true }),
    h('option', { value: '1.25', text: '1.25x' }),
    h('option', { value: '1.5', text: '1.5x' }),
    h('option', { value: '2.0', text: '2.0x' }),
  );

  const btnEq = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Equalizer' },
    icon('sliders', { size: 18 }),
  );
  const btnLyrics = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Lyrics' },
    icon('file-text', { size: 18 }),
  );
  const btnTimer = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Sleep Timer' },
    icon('timer', { size: 18 }),
  );

  const volumeSlider = h('input', {
    class: 'nx-slider',
    type: 'range',
    min: '0',
    max: '1',
    step: '0.02',
    value: String(engine.volume),
    style: 'width: 80px;',
  });

  const barRight = h(
    'div',
    { class: 'nx-music-bar-right' },
    speedSelect,
    btnEq,
    btnLyrics,
    btnTimer,
    icon('volume', { size: 18 }),
    volumeSlider,
  );

  playerBar.append(barLeft, barCenter, barRight);

  // Layout assembly
  const layout = h('div', { class: 'nx-music-layout' }, sidebar, main);
  main.append(header, contentArea);
  container.append(layout, playerBar);

  // Navigation rendering
  function renderSidebar() {
    const navItem = (id, iconName, label) =>
      h(
        'button',
        {
          class: `nx-music-nav-item${activeView === id ? ' is-active' : ''}`,
          type: 'button',
          onclick: () => {
            activeView = id;
            activePlaylistId = null;
            renderSidebar();
            renderContent();
          },
        },
        icon(iconName, { size: 18 }),
        h('span', { text: label }),
      );

    replace(
      sidebar,
      navItem('songs', 'music', t('music.songs', 'Songs')),
      navItem('albums', 'cards', t('music.albums', 'Albums')),
      navItem('artists', 'user', t('music.artists', 'Artists')),
      navItem('visualizer', 'activity', t('music.visualizer', 'Visualizer')),
      navItem('equalizer', 'sliders', t('music.equalizer', 'Equalizer')),
      navItem('lyrics', 'file-text', t('music.lyrics', 'Lyrics')),
      h('div', { class: 'nx-music-sidebar-heading', text: t('music.playlists', 'Playlists') }),
      playlistsContainer,
    );

    renderPlaylistsList();
  }

  function renderPlaylistsList() {
    playlistsContainer.replaceChildren(
      ...Object.keys(playlists).map((plId) =>
        h(
          'button',
          {
            class: `nx-music-nav-item${activeView === 'playlists' && activePlaylistId === plId ? ' is-active' : ''}`,
            type: 'button',
            onclick: () => {
              activeView = 'playlists';
              activePlaylistId = plId;
              renderSidebar();
              renderContent();
            },
          },
          icon('bookmark', { size: 16 }),
          h('span', { text: plId.charAt(0).toUpperCase() + plId.slice(1) }),
        ),
      ),
      h(
        'button',
        {
          class: 'nx-music-nav-item',
          type: 'button',
          onclick: async () => {
            const name = await ctx.dialog.prompt(t('music.newPlaylist', 'Playlist name:'), 'My Playlist');
            if (name && !playlists[name]) {
              playlists[name] = [];
              await savePlaylists();
              renderPlaylistsList();
            }
          },
        },
        icon('plus', { size: 16 }),
        h('span', { text: t('music.addPlaylist', 'New Playlist') }),
      ),
    );
  }

  async function savePlaylists() {
    try {
      await ctx.storage.set('playlists', 'user', playlists);
    } catch {
      /* ignore storage failure */
    }
  }

  async function saveLibrary() {
    try {
      await ctx.storage.set('library', 'tracks', library);
    } catch {
      /* ignore storage failure */
    }
  }

  // Scanning VFS
  async function scanVfsMusicFolder() {
    try {
      const musicEntries = await ctx.vfs.list('/Music');
      let added = 0;
      for (const entry of musicEntries) {
        if (entry.type === 'file' && /\.(mp3|ogg|flac|wav|m4a|aac)$/i.test(entry.name)) {
          const path = `/Music/${entry.name}`;
          const existing = library.find((t) => t.path === path);
          if (!existing) {
            const blob = await ctx.vfs.read(path);
            const meta = await parseAudioMetadata(blob, entry.name);
            library.push({
              id: `vfs-${entry.name}`,
              title: meta.title,
              artist: meta.artist,
              album: meta.album,
              duration: meta.duration || 0,
              year: meta.year,
              track: meta.track,
              lyrics: meta.lyrics,
              coverUrl: meta.coverUrl,
              path,
              blob,
            });
            added++;
          }
        }
      }
      if (added > 0) {
        await saveLibrary();
        renderContent();
        ctx.notifications.show({ title: 'Nexus Music', body: `Added ${added} new tracks from /Music` });
      } else {
        ctx.notifications.show({ title: 'Nexus Music', body: 'No new audio files found in /Music' });
      }
    } catch (err) {
      console.warn('Scan error:', err);
    }
  }

  async function importLocalFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,.mp3,.ogg,.flac,.wav,.m4a';
    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = await parseAudioMetadata(file, file.name);
        const track = {
          id: `file-${Date.now()}-${i}`,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          year: meta.year,
          track: meta.track,
          coverUrl: meta.coverUrl,
          lyrics: meta.lyrics,
          blob: file,
          duration: meta.duration || 0,
        };
        library.push(track);
        // Also save to VFS /Music
        try {
          await ctx.vfs.write(`/Music/${file.name}`, file);
        } catch {
          /* ignore vfs write error */
        }
      }
      await saveLibrary();
      renderContent();
    };
    input.click();
  }

  // Render main content area
  function renderContent() {
    if (visualizer) {
      visualizer.stop();
      visualizer = null;
    }

    if (activeView === 'songs') {
      renderSongsView();
    } else if (activeView === 'albums') {
      renderAlbumsView();
    } else if (activeView === 'artists') {
      renderArtistsView();
    } else if (activeView === 'playlists') {
      renderPlaylistView();
    } else if (activeView === 'visualizer') {
      renderVisualizerView();
    } else if (activeView === 'equalizer') {
      renderEqualizerView();
    } else if (activeView === 'lyrics') {
      renderLyricsView();
    }
  }

  function getFilteredTracks() {
    return library.filter((t) => {
      if (!searchQuery) return true;
      return (
        t.title.toLowerCase().includes(searchQuery) ||
        t.artist.toLowerCase().includes(searchQuery) ||
        t.album.toLowerCase().includes(searchQuery)
      );
    });
  }

  function renderSongsView() {
    titleEl.textContent = t('music.songs', 'Songs');
    const tracks = getFilteredTracks();

    const table = h(
      'table',
      { class: 'nx-music-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { style: 'width: 40px;', text: '#' }),
          h('th', { text: t('music.title', 'Title') }),
          h('th', { text: t('music.artist', 'Artist') }),
          h('th', { text: t('music.album', 'Album') }),
          h('th', { style: 'width: 80px;', text: t('music.duration', 'Duration') }),
          h('th', { style: 'width: 40px;' }),
        ),
      ),
      h(
        'tbody',
        {},
        ...tracks.map((track, idx) => {
          const isPlaying = engine.currentTrack?.id === track.id;
          const tr = h(
            'tr',
            {
              class: `nx-music-row${isPlaying ? ' is-playing' : ''}`,
              onclick: () => {
                engine.setQueue(tracks, idx);
              },
            },
            h('td', { text: String(idx + 1) }),
            h('td', { style: 'font-weight: 600;' }, h('span', { text: track.title })),
            h('td', { text: track.artist }),
            h('td', { text: track.album }),
            h('td', { text: formatTime(track.duration || 0) }),
            h(
              'td',
              {},
              h(
                'button',
                {
                  class: 'nx-btn is-ghost',
                  type: 'button',
                  title: 'Favorite',
                  onclick: (e) => {
                    e.stopPropagation();
                    const favs = playlists.favorites || [];
                    const found = favs.indexOf(track.id);
                    if (found >= 0) favs.splice(found, 1);
                    else favs.push(track.id);
                    playlists.favorites = favs;
                    savePlaylists();
                    renderContent();
                  },
                },
                icon(playlists.favorites?.includes(track.id) ? 'star' : 'star', {
                  size: 16,
                  style: playlists.favorites?.includes(track.id) ? 'color: #eab308;' : 'opacity: 0.4;',
                }),
              ),
            ),
          );
          return tr;
        }),
      ),
    );

    contentArea.replaceChildren(table);
  }

  function renderAlbumsView() {
    titleEl.textContent = t('music.albums', 'Albums');
    const tracks = getFilteredTracks();
    const albumsMap = new Map();

    for (const t of tracks) {
      const key = `${t.album}---${t.artist}`;
      if (!albumsMap.has(key)) {
        albumsMap.set(key, { album: t.album, artist: t.artist, coverUrl: t.coverUrl, tracks: [] });
      }
      albumsMap.get(key).tracks.push(t);
    }

    const grid = h(
      'div',
      { class: 'nx-music-grid' },
      ...Array.from(albumsMap.values()).map((album) =>
        h(
          'div',
          {
            class: 'nx-music-card',
            onclick: () => {
              engine.setQueue(album.tracks, 0);
            },
          },
          h(
            'div',
            { class: 'nx-music-card-art' },
            album.coverUrl
              ? h('img', { src: album.coverUrl, style: 'width: 100%; height: 100%; object-fit: cover;' })
              : icon('disc', { size: 48 }),
          ),
          h('div', { class: 'nx-music-card-title', text: album.album }),
          h('div', { class: 'nx-music-card-sub', text: `${album.artist} • ${album.tracks.length} tracks` }),
        ),
      ),
    );

    contentArea.replaceChildren(grid);
  }

  function renderArtistsView() {
    titleEl.textContent = t('music.artists', 'Artists');
    const tracks = getFilteredTracks();
    const artistsMap = new Map();

    for (const t of tracks) {
      if (!artistsMap.has(t.artist)) {
        artistsMap.set(t.artist, []);
      }
      artistsMap.get(t.artist).push(t);
    }

    const grid = h(
      'div',
      { class: 'nx-music-grid' },
      ...Array.from(artistsMap.entries()).map(([artist, artistTracks]) =>
        h(
          'div',
          {
            class: 'nx-music-card',
            onclick: () => {
              engine.setQueue(artistTracks, 0);
            },
          },
          h('div', { class: 'nx-music-card-art', style: 'border-radius: 50%;' }, icon('user', { size: 48 })),
          h('div', { class: 'nx-music-card-title', text: artist }),
          h('div', { class: 'nx-music-card-sub', text: `${artistTracks.length} songs` }),
        ),
      ),
    );

    contentArea.replaceChildren(grid);
  }

  function renderPlaylistView() {
    if (!activePlaylistId) return;
    titleEl.textContent = activePlaylistId.charAt(0).toUpperCase() + activePlaylistId.slice(1);
    const trackIds = playlists[activePlaylistId] || [];
    const tracks = library.filter((t) => trackIds.includes(t.id));

    const playAllBtn = h(
      'button',
      {
        class: 'nx-btn is-primary',
        style: 'margin: 16px 20px; align-self: flex-start;',
        onclick: () => {
          if (tracks.length > 0) engine.setQueue(tracks, 0);
        },
      },
      icon('play', { size: 16 }),
      h('span', { text: t('music.playAll', 'Play All') }),
    );

    const deletePlBtn = h(
      'button',
      {
        class: 'nx-btn is-ghost',
        style: 'margin-left: 8px;',
        onclick: async () => {
          if (await ctx.dialog.confirm(t('music.deletePlaylistConfirm', `Delete playlist "${activePlaylistId}"?`))) {
            delete playlists[activePlaylistId];
            await savePlaylists();
            activeView = 'songs';
            renderSidebar();
            renderContent();
          }
        },
      },
      icon('trash', { size: 16 }),
      h('span', { text: t('music.deletePlaylist', 'Delete') }),
    );

    const controlsRow = h('div', { style: 'display: flex; align-items: center;' }, playAllBtn, deletePlBtn);

    const table = h(
      'table',
      { class: 'nx-music-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { style: 'width: 40px;', text: '#' }),
          h('th', { text: t('music.title', 'Title') }),
          h('th', { text: t('music.artist', 'Artist') }),
          h('th', { style: 'width: 80px;', text: t('music.duration', 'Duration') }),
        ),
      ),
      h(
        'tbody',
        {},
        ...tracks.map((track, idx) =>
          h(
            'tr',
            {
              class: 'nx-music-row',
              onclick: () => engine.setQueue(tracks, idx),
            },
            h('td', { text: String(idx + 1) }),
            h('td', { style: 'font-weight: 600;', text: track.title }),
            h('td', { text: track.artist }),
            h('td', { text: formatTime(track.duration || 0) }),
          ),
        ),
      ),
    );

    contentArea.replaceChildren(controlsRow, table);
  }

  function renderVisualizerView() {
    titleEl.textContent = t('music.visualizer', 'Visualizer');
    const container = h('div', { class: 'nx-music-visualizer-container' });
    const canvas = h('canvas', { class: 'nx-music-visualizer-canvas' });
    container.append(canvas);

    visualizer = new MusicVisualizer(canvas, engine);

    const styleSelect = h(
      'select',
      {
        class: 'nx-select',
        style: 'background: rgba(30, 41, 59, 0.8); color: white;',
        onchange: (e) => visualizer?.setStyle(/** @type {any} */ (/** @type {HTMLSelectElement} */ (e.target).value)),
      },
      h('option', { value: 'bars', text: 'Bars' }),
      h('option', { value: 'circle', text: 'Circular Radial' }),
      h('option', { value: 'waveform', text: 'Waveform' }),
      h('option', { value: 'bass', text: 'Bass Particles' }),
      h('option', { value: 'starfield', text: 'Starfield 3D' }),
    );

    const fsBtn = h(
      'button',
      {
        class: 'nx-btn is-ghost',
        type: 'button',
        title: 'Fullscreen',
        onclick: () => {
          if (container.requestFullscreen) container.requestFullscreen();
        },
      },
      icon('maximize', { size: 16 }),
    );

    const toolbar = h('div', { class: 'nx-music-visualizer-toolbar' }, styleSelect, fsBtn);
    container.append(toolbar);

    contentArea.replaceChildren(container);

    // Canvas size sync
    setTimeout(() => {
      canvas.width = container.clientWidth || 800;
      canvas.height = container.clientHeight || 500;
      visualizer?.start();
    }, 50);
  }

  function renderEqualizerView() {
    titleEl.textContent = t('music.equalizer', 'Equalizer');
    const eqPanel = h('div', { class: 'nx-music-eq-panel' });

    const presetSelect = h(
      'select',
      {
        class: 'nx-select',
        style: 'max-width: 200px;',
        onchange: (e) => {
          const p = /** @type {HTMLSelectElement} */ (e.target).value;
          engine.applyEqualizerPreset(p);
          renderContent();
        },
      },
      ...Object.keys(EQ_PRESETS).map((preset) =>
        h('option', { value: preset, text: preset.charAt(0).toUpperCase() + preset.slice(1) }),
      ),
    );

    const bandsContainer = h('div', { class: 'nx-music-eq-sliders' });
    const bands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

    bands.forEach((freq, i) => {
      const currentGain = engine.eqFilters[i]?.gain?.value || 0;
      const gainLabel = h('span', { text: `${currentGain > 0 ? '+' : ''}${Math.round(currentGain)}dB` });
      const slider = h('input', {
        class: 'nx-music-eq-slider',
        type: 'range',
        min: '-12',
        max: '12',
        step: '1',
        value: String(currentGain),
        oninput: (e) => {
          const val = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
          if (engine.eqFilters[i]) {
            engine.eqFilters[i].gain.value = val;
          }
          gainLabel.textContent = `${val > 0 ? '+' : ''}${val}dB`;
        },
      });

      const freqText = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      bandsContainer.append(h('div', { class: 'nx-music-eq-band' }, gainLabel, slider, h('span', { text: freqText })));
    });

    eqPanel.append(
      h(
        'div',
        { style: 'display: flex; gap: 12px; align-items: center;' },
        h('span', { text: 'Preset:' }),
        presetSelect,
      ),
      bandsContainer,
    );
    contentArea.replaceChildren(eqPanel);
  }

  function renderLyricsView() {
    titleEl.textContent = t('music.lyrics', 'Lyrics');
    const track = engine.currentTrack;
    if (!track || !track.lyrics) {
      contentArea.replaceChildren(
        h(
          'div',
          { style: 'padding: 40px; text-align: center; color: var(--nx-text-muted);' },
          icon('file-text', { size: 48 }),
          h('p', { text: 'No synchronized lyrics found for this track' }),
        ),
      );
      return;
    }

    const parsedLyrics = parseLrcLyrics(track.lyrics);
    const lyricsContainer = h('div', { class: 'nx-music-lyrics-container' });

    parsedLyrics.forEach((line) => {
      const lineEl = h('div', {
        class: 'nx-music-lyric-line',
        dataset: { time: String(line.time) },
        text: line.text,
        onclick: () => engine.seek(line.time),
      });
      lyricsContainer.append(lineEl);
    });

    contentArea.replaceChildren(lyricsContainer);
  }

  // Sleep timer modal
  async function openSleepTimerDialog() {
    const min = await ctx.dialog.prompt(t('music.sleepTimerPrompt', 'Sleep timer minutes (0 to cancel):'), '30');
    if (min !== null) {
      engine.setSleepTimer(parseInt(min, 10) || 0);
    }
  }

  // Update Player Bar State
  function updatePlayerBar() {
    const track = engine.currentTrack;
    if (track) {
      barTitle.textContent = track.title;
      barArtist.textContent = `${track.artist} — ${track.album}`;
      if (track.coverUrl) {
        barArt.replaceChildren(
          h('img', { src: track.coverUrl, style: 'width: 100%; height: 100%; border-radius: 6px; object-fit: cover;' }),
        );
      } else {
        barArt.replaceChildren(icon('music', { size: 24 }));
      }
    } else {
      barTitle.textContent = 'Nexus Music';
      barArtist.textContent = 'No track playing';
      barArt.replaceChildren(icon('music', { size: 24 }));
    }

    btnPlay.replaceChildren(icon(engine.isPlaying ? 'pause' : 'play', { size: 20 }));
    btnShuffle.style.opacity = engine.isShuffled ? '1' : '0.4';
    btnRepeat.replaceChildren(icon('refresh', { size: 16 }));
    btnRepeat.style.opacity = engine.repeatMode !== 'off' ? '1' : '0.4';
  }

  // Audio Engine Event Listeners
  btnPlay.onclick = () => engine.togglePlay();
  btnNext.onclick = () => engine.next();
  btnPrev.onclick = () => engine.previous();
  btnSkipBack.onclick = () => engine.skip(-15);
  btnSkipForward.onclick = () => engine.skip(30);
  btnShuffle.onclick = () => engine.setShuffle(!engine.isShuffled);
  btnRepeat.onclick = () => {
    const modes = ['all', 'one', 'off'];
    const nextMode = modes[(modes.indexOf(engine.repeatMode) + 1) % modes.length];
    engine.setRepeat(/** @type {any} */ (nextMode));
  };

  btnEq.onclick = () => {
    activeView = 'equalizer';
    renderSidebar();
    renderContent();
  };

  btnLyrics.onclick = () => {
    activeView = 'lyrics';
    renderSidebar();
    renderContent();
  };

  btnTimer.onclick = () => openSleepTimerDialog();

  volumeSlider.oninput = (e) => engine.setVolume(parseFloat(/** @type {HTMLInputElement} */ (e.target).value));

  progressBar.oninput = (e) => {
    const pct = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) / 100;
    if (engine.duration > 0) {
      engine.seek(pct * engine.duration);
    }
  };

  const unsubEngine = engine.subscribe(() => {
    updatePlayerBar();
    if (activeView === 'songs') {
      // update active playing track row
      const rows = contentArea.querySelectorAll('.nx-music-row');
      rows.forEach((r, idx) => {
        const tr = library[idx];
        if (tr && tr.id === engine.currentTrack?.id) r.classList.add('is-playing');
        else r.classList.remove('is-playing');
      });
    }
  });

  const timeUpdateInterval = setInterval(() => {
    if (engine.duration > 0) {
      progressBar.value = String((engine.currentTime / engine.duration) * 100);
      timeCurrent.textContent = formatTime(engine.currentTime);
      timeTotal.textContent = formatTime(engine.duration);

      // Synced lyrics highlight
      if (activeView === 'lyrics') {
        const lines = contentArea.querySelectorAll('.nx-music-lyric-line');
        let currentLine = null;
        lines.forEach((l) => {
          const t = parseFloat(/** @type {HTMLElement} */ (l).dataset.time || '0');
          if (engine.currentTime >= t) {
            currentLine = l;
          }
        });
        if (currentLine) {
          lines.forEach((l) => l.classList.remove('is-active'));
          currentLine.classList.add('is-active');
          currentLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } else {
      timeCurrent.textContent = '0:00';
      timeTotal.textContent = '0:00';
    }
  }, 400);

  // Initial renders
  renderSidebar();
  renderContent();
  updatePlayerBar();

  hostElement.append(container);

  // Return component mount contract
  return {
    unmount() {
      unsubEngine();
      clearInterval(timeUpdateInterval);
      if (visualizer) visualizer.stop();
    },
  };
}
