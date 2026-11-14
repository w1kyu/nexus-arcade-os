// @ts-check
import { GameScoreService } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import './styles.css';

/**
 * @typedef {object} ArcadeGameDef
 * @property {string} id
 * @property {string} name
 * @property {string} genre
 * @property {string} desc
 * @property {string} iconName
 * @property {string} bgGradient
 */

const ARCADE_GAMES = [
  {
    id: 'nexus.snake',
    name: 'Snake Evolution',
    genre: 'action',
    desc: 'Interpolated cyber snake with 6 maps, power-up cascades, and hazard patrols.',
    iconName: '🐍',
    bgGradient: 'linear-gradient(135deg, #051923, #003554)',
  },
  {
    id: 'nexus.breakout',
    name: 'Breakout Nexus',
    genre: 'arcade',
    desc: 'Continuous ball collision physics, 30 handcrafted levels, and integrated level editor.',
    iconName: '🧱',
    bgGradient: 'linear-gradient(135deg, #10002b, #240046)',
  },
  {
    id: 'nexus.blockfall',
    name: 'Blockfall',
    genre: 'puzzle',
    desc: 'Super Rotation falling-blocks puzzle with ghost projection, hold piece, and 4 game modes.',
    iconName: '🧊',
    bgGradient: 'linear-gradient(135deg, #091b29, #003666)',
  },
  {
    id: 'nexus.minesweeper',
    name: 'Minesweeper',
    genre: 'puzzle',
    desc: 'Tactical mine clearance with safe first click opening, chording, and custom grid sizes.',
    iconName: '💣',
    bgGradient: 'linear-gradient(135deg, #1b1f24, #2d333b)',
  },
  {
    id: 'nexus.drifter',
    name: 'Void Drifter',
    genre: 'action',
    desc: 'Vector neon space combat with inertia physics, splitting asteroids, and UFO enemies.',
    iconName: '🚀',
    bgGradient: 'linear-gradient(135deg, #120b24, #2a154d)',
  },
  {
    id: 'nexus.sudoku',
    name: 'Sudoku',
    genre: 'puzzle',
    desc: 'Logic number placement with unique solutions, pencil notes, and technique hints.',
    iconName: '🔢',
    bgGradient: 'linear-gradient(135deg, #0d1b2a, #1b263b)',
  },
  {
    id: 'nexus.typing',
    name: 'Typing Trainer',
    genre: 'reflex',
    desc: 'Professional touch typing trainer with WPM benchmarks, visual keyboard, and code mode.',
    iconName: '⌨️',
    bgGradient: 'linear-gradient(135deg, #161a29, #232b42)',
  },
  {
    id: 'nexus.pong',
    name: 'Neon Pong',
    genre: 'arcade',
    desc: 'High-velocity cyber table tennis with spin dynamics, power-ups, and AI or 2-player modes.',
    iconName: '🏓',
    bgGradient: 'linear-gradient(135deg, #240046, #3c096c)',
  },
  {
    id: 'nexus.memory',
    name: 'Memory Master',
    genre: 'puzzle',
    desc: 'Card matching trainer with 3D flip animations, combo scoring, and CS themes.',
    iconName: '🃏',
    bgGradient: 'linear-gradient(135deg, #0b132b, #1c2541)',
  },
  {
    id: 'nexus.2048',
    name: '2048 Cyber',
    genre: 'puzzle',
    desc: 'The classic 2048 sliding puzzle with undo, multiple board sizes, and endless mode.',
    iconName: '🔢',
    bgGradient: 'linear-gradient(135deg, #1f1d36, #3f3351)',
  },
  {
    id: 'nexus.reaction',
    name: 'Reaction Trainer',
    genre: 'reflex',
    desc: 'Benchmark sensory reaction time, aim precision, and cognitive memory spans.',
    iconName: '⚡',
    bgGradient: 'linear-gradient(135deg, #14213d, #000000)',
  },
  {
    id: 'nexus.solitaire',
    name: 'Solitaire Collection',
    genre: 'cards',
    desc: 'Klondike, Spider, and FreeCell solitaire with infinite undo, solvable deals, and auto-complete.',
    iconName: '🂠',
    bgGradient: 'linear-gradient(135deg, #0b3d20, #14522d)',
  },
  {
    id: 'nexus.chess',
    name: 'Nexus Chess',
    genre: 'board',
    desc: 'Full-featured chess engine with alpha-beta AI, puzzle challenges, PGN import/export, and move history.',
    iconName: '♟️',
    bgGradient: 'linear-gradient(135deg, #1f2937, #111827)',
  },
  {
    id: 'nexus.connectfour',
    name: 'Connect Four',
    genre: 'board',
    desc: 'Classic vertical four-in-a-row with tactical minimax AI and local two-player duel mode.',
    iconName: '🔴',
    bgGradient: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
  },
  {
    id: 'nexus.checkers',
    name: 'Checkers / Dame',
    genre: 'board',
    desc: 'Standard and International draughts with mandatory multi-jump captures and intelligent AI opponent.',
    iconName: '⚪',
    bgGradient: 'linear-gradient(135deg, #374151, #1f2937)',
  },
  {
    id: 'nexus.battleships',
    name: 'Battleships',
    genre: 'board',
    desc: 'Naval fleet combat with ship placement editor, salvo tracking, and hunt-and-target probability AI.',
    iconName: '🚢',
    bgGradient: 'linear-gradient(135deg, #0c4a6e, #075985)',
  },
  {
    id: 'nexus.hexword',
    name: 'Hexword',
    genre: 'puzzle',
    desc: 'Daily 5-letter word puzzle in English and German with curated dictionaries and emoji grid sharing.',
    iconName: '🔤',
    bgGradient: 'linear-gradient(135deg, #065f46, #047857)',
  },
  {
    id: 'nexus.sokoban',
    name: 'Block Pusher',
    genre: 'puzzle',
    desc: 'Warehouse box-pushing puzzle with 60+ verified solvable levels, undo history, and custom level editor.',
    iconName: '📦',
    bgGradient: 'linear-gradient(135deg, #78350f, #92400e)',
  },
  {
    id: 'nexus.nonogram',
    name: 'Nonogram',
    genre: 'puzzle',
    desc: 'Picross picture logic grid puzzles with line hints, cross-out helpers, and procedural puzzle generator.',
    iconName: '▦',
    bgGradient: 'linear-gradient(135deg, #312e81, #4338ca)',
  },
  {
    id: 'nexus.invaders',
    name: 'Grid Invaders',
    genre: 'arcade',
    desc: 'Retro fixed shooter with descending alien formations, destructible shields, diving squadrons, and boss waves.',
    iconName: '👾',
    bgGradient: 'linear-gradient(135deg, #4c1d95, #581c87)',
  },
  {
    id: 'nexus.glide',
    name: 'Neon Glide',
    genre: 'arcade',
    desc: 'One-button neon flyer with aerodynamic inertia, procedural obstacles, particle trails, and ghost replay.',
    iconName: '🔷',
    bgGradient: 'linear-gradient(135deg, #0e7490, #155e75)',
  },
  {
    id: 'nexus.griddefense',
    name: 'Grid Defense',
    genre: 'action',
    desc: 'Tower defense with 11 maps, 6 upgradable tower types, enemy creep varieties, waves, and speed controls.',
    iconName: '🏰',
    bgGradient: 'linear-gradient(135deg, #1e1b4b, #2e1065)',
  },
  {
    id: 'nexus.runner',
    name: 'Pixel Runner',
    genre: 'action',
    desc: 'Precision platformer with tight coyote-jump physics, 20 handcrafted levels, and custom level editor.',
    iconName: '🏃',
    bgGradient: 'linear-gradient(135deg, #022c22, #064e3b)',
  },
  {
    id: 'nexus.racer',
    name: 'Neon Racer',
    genre: 'arcade',
    desc: 'Top-down neon racing circuit with drift physics, AI opponents, ghost car replay, and 5 tracks.',
    iconName: '🏎️',
    bgGradient: 'linear-gradient(135deg, #831843, #701a75)',
  },
  {
    id: 'nexus.uttt',
    name: 'Ultimate Tic-Tac-Toe',
    genre: 'board',
    desc: 'Strategic nested 9x9 board with forced sub-grid targeting, heuristic AI, and local 2-player mode.',
    iconName: '⚔️',
    bgGradient: 'linear-gradient(135deg, #172554, #1e3a8a)',
  },
  {
    id: 'nexus.mahjong',
    name: 'Mahjong Solitaire',
    genre: 'puzzle',
    desc: 'Tile-matching with 3D layouts, elevation occlusion, hint, shuffle, and 100% solvable deals.',
    iconName: '🀄',
    bgGradient: 'linear-gradient(135deg, #14532d, #166534)',
  },
  {
    id: 'nexus.match3',
    name: 'Match-3 Puzzle',
    genre: 'puzzle',
    desc: 'Swap matcher with cascade combos, special bombs and lasers, and 10 objective levels.',
    iconName: '💎',
    bgGradient: 'linear-gradient(135deg, #701a75, #4a044e)',
  },
  {
    id: 'nexus.bubbles',
    name: 'Bubble Shooter',
    genre: 'arcade',
    desc: 'Aim and bank-shot trajectory physics with color matching, cluster pops, and floating bubble cascades.',
    iconName: '🫧',
    bgGradient: 'linear-gradient(135deg, #0369a1, #0c4a6e)',
  },
  {
    id: 'nexus.life',
    name: 'Game of Life Sandbox',
    genre: 'puzzle',
    desc: 'Toroidal cellular automata simulator with pattern library, interactive pencil, and 5 rule engines.',
    iconName: '🧬',
    bgGradient: 'linear-gradient(135deg, #042f2e, #134e4a)',
  },
  {
    id: 'nexus.quiz',
    name: 'Quiz Arena',
    genre: 'reflex',
    desc: 'Trivia quiz arena with CS fundamentals and web architecture packs in EN and DE, streaks, and lifelines.',
    iconName: '💡',
    bgGradient: 'linear-gradient(135deg, #451a03, #78350f)',
  },
];

const MULTIPLAYER_GAMES = [
  { id: 'nexus.connectfour', name: 'Connect Four', icon: '🔴' },
  { id: 'nexus.checkers', name: 'Checkers / Dame', icon: '⚪' },
  { id: 'nexus.chess', name: 'Nexus Chess', icon: '♟️' },
  { id: 'nexus.pong', name: 'Neon Pong', icon: '🏓' },
  { id: 'nexus.uttt', name: 'Ultimate Tic-Tac-Toe', icon: '⚔️' },
];

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-arcade-app' });

  // State
  let activeFilter = 'all';
  let searchQuery = '';
  /** @type {Set<string>} */
  let favorites = new Set();
  let selectedCardIndex = 0;
  let gamepadPollId = 0;

  // Load favorites from storage
  if (ctx.storage?.kv) {
    try {
      const favList = await ctx.storage.kv.get('arcade_favorites');
      if (Array.isArray(favList)) favorites = new Set(favList);
    } catch {
      // Ignore
    }
  }

  // Header & Banner
  const header = h('div', { class: 'nx-arcade-header' });
  const banner = h('div', { class: 'nx-arcade-banner' });
  const titleGroup = h(
    'div',
    { class: 'nx-arcade-title-group' },
    h('h1', {}, t('app.title')),
    h('p', {}, t('app.description')),
  );

  // Player Profile Widget
  const profileWidget = h('div', { class: 'nx-arcade-profile' });
  const avatar = h('div', { class: 'nx-profile-avatar' }, '🎮');
  const profileInfo = h('div', { class: 'nx-profile-info' });

  const nameRow = h(
    'div',
    { class: 'nx-profile-name-row' },
    h('span', { class: 'nx-profile-level' }, 'Level 1'),
    h('span', { class: 'nx-profile-xp-text' }, '0 / 100 XP'),
  );

  const barBg = h('div', { class: 'nx-profile-bar-bg' });
  const barFill = h('div', { class: 'nx-profile-bar-fill', style: 'width: 0%;' });
  barBg.append(barFill);
  profileInfo.append(nameRow, barBg);
  profileWidget.append(avatar, profileInfo);

  banner.append(titleGroup, profileWidget);

  // Toolbar & Filters
  const toolbar = h('div', { class: 'nx-arcade-toolbar' });
  const filtersEl = h('div', { class: 'nx-arcade-filters' });

  const filterTabs = ['all', 'action', 'arcade', 'cards', 'board', 'puzzle', 'reflex', 'favorites'];
  /** @type {Record<string, HTMLButtonElement>} */
  const filterBtns = {};

  for (const f of filterTabs) {
    const btn = /** @type {HTMLButtonElement} */ (
      h('button', { class: `nx-filter-btn ${activeFilter === f ? 'active' : ''}` }, t(`toolbar.${f}`))
    );
    btn.addEventListener('click', () => {
      activeFilter = f;
      Object.values(filterBtns).forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderGameGrid();
    });
    filterBtns[f] = btn;
    filtersEl.append(btn);
  }

  const randomBtn = h('button', { class: 'nx-random-btn' }, `🎲 ${t('toolbar.random')}`);
  randomBtn.addEventListener('click', () => {
    const pick = ARCADE_GAMES[Math.floor(Math.random() * ARCADE_GAMES.length)];
    launchGame(pick.id);
  });

  const lobbyBtn = h('button', { class: 'nx-lobby-btn' }, `👥 ${t('toolbar.lobby')}`);
  lobbyBtn.addEventListener('click', () => {
    openLobbyModal();
  });

  const searchBox = h('div', { class: 'nx-arcade-search-box' });
  const searchInput = /** @type {HTMLInputElement} */ (h('input', { type: 'text', placeholder: t('toolbar.search') }));
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    renderGameGrid();
  });
  searchBox.append(searchInput);

  toolbar.append(filtersEl, randomBtn, lobbyBtn, searchBox);
  header.append(banner, toolbar);

  // Rotating featured game banner (daily rotation)
  const today = new Date();
  const featuredIndex = (today.getDate() + today.getMonth() * 31) % ARCADE_GAMES.length;
  const featuredGame = ARCADE_GAMES[featuredIndex];

  const featuredBanner = h('div', { class: 'nx-arcade-featured' });
  const featuredLeft = h(
    'div',
    {},
    h('span', { class: 'nx-featured-badge' }, `★ ${t('featured.badge')}`),
    h('h2', { class: 'nx-featured-title' }, `${featuredGame.iconName} ${featuredGame.name}`),
    h('p', { class: 'nx-featured-desc' }, featuredGame.desc),
  );
  const featuredPlayBtn = h('button', { class: 'nx-featured-play-btn' }, t('featured.play'));
  featuredPlayBtn.addEventListener('click', () => launchGame(featuredGame.id));
  featuredBanner.append(featuredLeft, featuredPlayBtn);

  // Content Area
  const content = h('div', { class: 'nx-arcade-content' });
  const gridEl = h('div', { class: 'nx-arcade-grid' });
  content.append(gridEl);

  // Achievements section
  const achievementsSec = h('div', { class: 'nx-arcade-achievements' });
  const achievementsTitle = h('h2', { class: 'nx-achievements-title' }, t('stats.achievements'));
  const achievementsGrid = h('div', { class: 'nx-achievements-grid' });
  achievementsSec.append(achievementsTitle, achievementsGrid);
  content.append(achievementsSec);

  root.append(header, featuredBanner, content);
  container.append(root);

  async function updateProfile() {
    const levelInfo = ctx.achievements?.level?.() ?? { level: 1, xp: 0, current: 0, needed: 100 };
    const currentLvl = levelInfo.level;
    const xpCurrent = levelInfo.current;
    const xpNeeded = Math.max(1, levelInfo.needed);

    const lvlEl = nameRow.querySelector('.nx-profile-level');
    const xpEl = nameRow.querySelector('.nx-profile-xp-text');
    if (lvlEl) lvlEl.textContent = `${t('stats.level')} ${currentLvl}`;
    if (xpEl) xpEl.textContent = `${xpCurrent} / ${xpNeeded} ${t('stats.xp')}`;
    barFill.style.width = `${Math.min(100, Math.round((xpCurrent / xpNeeded) * 100))}%`;
  }

  async function renderGameGrid() {
    gridEl.innerHTML = '';

    const filtered = ARCADE_GAMES.filter((g) => {
      if (activeFilter === 'favorites') {
        if (!favorites.has(g.id)) return false;
      } else if (activeFilter !== 'all') {
        if (g.genre !== activeFilter) return false;
      }
      if (searchQuery && !g.name.toLowerCase().includes(searchQuery) && !g.desc.toLowerCase().includes(searchQuery)) {
        return false;
      }
      return true;
    });

    for (let i = 0; i < filtered.length; i++) {
      const g = filtered[i];
      const card = h('div', { class: `nx-game-card ${i === selectedCardIndex ? 'gamepad-selected' : ''}` });

      // Cover Art
      const cover = h('div', { class: 'nx-card-cover', style: `background: ${g.bgGradient};` });
      const coverArt = h('div', { class: 'nx-card-cover-art' }, g.iconName);

      const favBtn = h(
        'button',
        { class: `nx-card-favorite-btn ${favorites.has(g.id) ? 'favorited' : ''}` },
        favorites.has(g.id) ? '★' : '☆',
      );

      favBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (favorites.has(g.id)) {
          favorites.delete(g.id);
          favBtn.textContent = '☆';
          favBtn.classList.remove('favorited');
        } else {
          favorites.add(g.id);
          favBtn.textContent = '★';
          favBtn.classList.add('favorited');
        }
        if (ctx.storage?.kv) {
          await ctx.storage.kv.set('arcade_favorites', [...favorites]);
        }
        if (activeFilter === 'favorites') renderGameGrid();
      });

      cover.append(coverArt, favBtn);

      // Body
      const body = h('div', { class: 'nx-card-body' });
      const headerRow = h('div', { class: 'nx-card-header-row' });
      const name = h('div', { class: 'nx-card-name' }, g.name);
      const genre = h('div', { class: 'nx-card-genre' }, g.genre);
      headerRow.append(name, genre);

      const desc = h('div', { class: 'nx-card-desc' }, g.desc);

      // Stats
      const statsRow = h('div', { class: 'nx-card-stats' });
      const scoresService = new GameScoreService(g.id, ctx);
      const lb = await scoresService.getLeaderboard('classic');
      const bestScore = lb.length > 0 ? lb[0].score : 0;

      statsRow.innerHTML = `
        <span>${t('stats.highScore')}: <strong>${bestScore}</strong></span>
        <span>${t('stats.played')}: <strong>${lb.length}</strong></span>
      `;

      // Play button
      const playBtn = h('button', { class: 'nx-card-play-btn' }, t('actions.play'));
      playBtn.addEventListener('click', () => launchGame(g.id));

      body.append(headerRow, desc, statsRow, playBtn);
      card.append(cover, body);
      gridEl.append(card);
    }
  }

  /**
   * Launches game window
   * @param {string} appId
   * @param {unknown} [args]
   */
  async function launchGame(appId, args = {}) {
    if (ctx.system?.windows?.launch) {
      await ctx.system.windows.launch(appId, args);
    } else if (ctx.commands) {
      const cmdId = appId.replace('nexus.', '') + '.open';
      try {
        await ctx.commands.execute(cmdId, args);
      } catch {
        // Fallback
      }
    }
  }

  function openLobbyModal() {
    let selectedGame = MULTIPLAYER_GAMES[0].id;
    let p1Device = 'keyboard';
    let p1GamepadIdx = 0;
    let p2Device = 'keyboard';
    let p2GamepadIdx = 1;

    const overlay = h('div', { class: 'nx-lobby-overlay' });
    const modal = h('div', { class: 'nx-lobby-modal' });

    // Header
    const mHeader = h('div', { class: 'nx-lobby-header' });
    const mTitle = h('h2', {}, t('lobby.title'));
    const closeBtn = h('button', { class: 'nx-lobby-close-btn' }, '✕');
    closeBtn.addEventListener('click', () => overlay.remove());
    mHeader.append(mTitle, closeBtn);

    const mSubtitle = h('p', { class: 'nx-lobby-subtitle' }, t('lobby.subtitle'));

    // Game picker
    const gameSection = h('div', { class: 'nx-lobby-section' });
    const gameLabel = h('label', { class: 'nx-lobby-label' }, t('lobby.game'));
    const gameList = h('div', { class: 'nx-lobby-game-list' });

    /** @type {HTMLButtonElement[]} */
    const gameBtns = [];
    for (const g of MULTIPLAYER_GAMES) {
      const gBtn = /** @type {HTMLButtonElement} */ (
        h('button', { class: `nx-lobby-game-btn ${g.id === selectedGame ? 'active' : ''}` }, `${g.icon} ${g.name}`)
      );
      gBtn.addEventListener('click', () => {
        selectedGame = g.id;
        gameBtns.forEach((b) => b.classList.remove('active'));
        gBtn.classList.add('active');
      });
      gameBtns.push(gBtn);
      gameList.append(gBtn);
    }
    gameSection.append(gameLabel, gameList);

    // Player controls section
    const playersRow = h('div', { class: 'nx-lobby-players-row' });

    // Player 1
    const p1Card = h('div', { class: 'nx-lobby-player-card' });
    p1Card.append(h('h3', {}, `🔴 ${t('lobby.player1')}`));
    const p1Select = /** @type {HTMLSelectElement} */ (h('select', { class: 'nx-lobby-select' }));
    p1Select.innerHTML = `
      <option value="keyboard">${t('lobby.keyboard')} (WASD / Left)</option>
      <option value="gamepad-0">${t('lobby.gamepad')} 1</option>
      <option value="gamepad-1">${t('lobby.gamepad')} 2</option>
    `;
    p1Select.addEventListener('change', () => {
      const val = p1Select.value;
      if (val.startsWith('gamepad-')) {
        p1Device = 'gamepad';
        p1GamepadIdx = parseInt(val.replace('gamepad-', ''), 10);
      } else {
        p1Device = 'keyboard';
      }
    });
    p1Card.append(p1Select);

    // Player 2
    const p2Card = h('div', { class: 'nx-lobby-player-card' });
    p2Card.append(h('h3', {}, `🟡 ${t('lobby.player2')}`));
    const p2Select = /** @type {HTMLSelectElement} */ (h('select', { class: 'nx-lobby-select' }));
    p2Select.innerHTML = `
      <option value="keyboard" selected>${t('lobby.keyboard')} (Arrows / Right)</option>
      <option value="gamepad-0">${t('lobby.gamepad')} 1</option>
      <option value="gamepad-1">${t('lobby.gamepad')} 2</option>
    `;
    p2Select.addEventListener('change', () => {
      const val = p2Select.value;
      if (val.startsWith('gamepad-')) {
        p2Device = 'gamepad';
        p2GamepadIdx = parseInt(val.replace('gamepad-', ''), 10);
      } else {
        p2Device = 'keyboard';
      }
    });
    p2Card.append(p2Select);

    playersRow.append(p1Card, p2Card);

    // Gamepad status info
    const connectedCount =
      typeof navigator !== 'undefined' && navigator.getGamepads
        ? Array.from(navigator.getGamepads()).filter(Boolean).length
        : 0;
    const statusInfo = h(
      'div',
      { class: 'nx-lobby-status' },
      connectedCount > 0 ? t('lobby.gamepadsDetected', { count: connectedCount }) : t('lobby.noGamepads'),
    );

    // Footer actions
    const footer = h('div', { class: 'nx-lobby-footer' });
    const cancelBtn = h('button', { class: 'nx-lobby-btn-cancel' }, t('lobby.cancel'));
    cancelBtn.addEventListener('click', () => overlay.remove());

    const startBtn = h('button', { class: 'nx-lobby-btn-start' }, `⚔️ ${t('lobby.launch')}`);
    startBtn.addEventListener('click', () => {
      overlay.remove();
      launchGame(selectedGame, {
        mode: 'local',
        players: [
          { device: p1Device, index: p1GamepadIdx },
          { device: p2Device, index: p2GamepadIdx },
        ],
      });
    });

    footer.append(cancelBtn, startBtn);

    modal.append(mHeader, mSubtitle, gameSection, playersRow, statusInfo, footer);
    overlay.append(modal);
    root.append(overlay);
  }

  async function renderAchievementsGallery() {
    achievementsGrid.replaceChildren();
    const locale = ctx.i18n.locale === 'de' ? 'de' : 'en';
    const all = (await ctx.achievements?.listAll?.().catch(() => [])) ?? [];
    const list = all.sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt)).slice(0, 12);

    if (!list.length) {
      achievementsGrid.append(
        h('p', {
          class: 'nx-achievement-desc',
          text: t('stats.achievementsEmpty') || 'Play games to unlock achievements!',
        }),
      );
      return;
    }

    for (const ach of list) {
      const unlocked = !!ach.unlockedAt;
      const titleText = ach.title
        ? typeof ach.title === 'string'
          ? ach.title
          : (ach.title[locale] ?? ach.title.en)
        : '???';
      const descText = ach.description
        ? typeof ach.description === 'string'
          ? ach.description
          : (ach.description[locale] ?? ach.description.en)
        : locale === 'de'
          ? 'Geheimer Erfolg'
          : 'Secret achievement';
      const progressSuffix = !unlocked && ach.goal ? ` (${Math.min(ach.progress, ach.goal)}/${ach.goal})` : '';
      const badge = h(
        'div',
        { class: `nx-achievement-badge ${unlocked ? 'unlocked' : 'locked'}` },
        h('div', { class: 'nx-achievement-icon', text: unlocked ? '🏆' : '🔒' }),
        h(
          'div',
          {},
          h('div', { class: 'nx-achievement-name', text: titleText }),
          h('div', { class: 'nx-achievement-desc', text: `${descText}${progressSuffix}` }),
        ),
      );
      achievementsGrid.append(badge);
    }
  }

  // Gamepad navigation loop
  let lastNavTime = 0;
  function pollGamepad() {
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gp = navigator.getGamepads()[0];
      if (gp) {
        const now = performance.now();
        if (now - lastNavTime > 200) {
          const cards = gridEl.querySelectorAll('.nx-game-card');
          if (cards.length > 0) {
            // D-pad or stick left/right
            if (gp.axes[0] > 0.5 || gp.buttons[15]?.pressed) {
              selectedCardIndex = (selectedCardIndex + 1) % cards.length;
              lastNavTime = now;
              renderSelection(cards);
            } else if (gp.axes[0] < -0.5 || gp.buttons[14]?.pressed) {
              selectedCardIndex = (selectedCardIndex - 1 + cards.length) % cards.length;
              lastNavTime = now;
              renderSelection(cards);
            }

            // A button (button 0) to play
            if (gp.buttons[0]?.pressed) {
              const activeBtn = cards[selectedCardIndex]?.querySelector('.nx-card-play-btn');
              if (activeBtn) /** @type {HTMLButtonElement} */ (activeBtn).click();
              lastNavTime = now + 400;
            }
          }
        }
      }
    }
    gamepadPollId = requestAnimationFrame(pollGamepad);
  }

  /**
   * @param {NodeListOf<Element>} cards
   */
  function renderSelection(cards) {
    cards.forEach((c, idx) => {
      c.classList.toggle('gamepad-selected', idx === selectedCardIndex);
    });
  }

  await updateProfile();
  await renderGameGrid();
  await renderAchievementsGallery();
  gamepadPollId = requestAnimationFrame(pollGamepad);

  return () => {
    if (gamepadPollId) cancelAnimationFrame(gamepadPollId);
  };
}

export const terminal = {
  arcade: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Arcade Hub...');
    if (ctx.commands) {
      await ctx.commands.execute('arcade.open');
    }
    return 0;
  },
};
