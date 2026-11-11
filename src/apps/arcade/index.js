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

  const filterTabs = ['all', 'action', 'arcade', 'puzzle', 'reflex', 'favorites'];
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

  const searchBox = h('div', { class: 'nx-arcade-search-box' });
  const searchInput = /** @type {HTMLInputElement} */ (h('input', { type: 'text', placeholder: t('toolbar.search') }));
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    renderGameGrid();
  });
  searchBox.append(searchInput);

  toolbar.append(filtersEl, searchBox);
  header.append(banner, toolbar);

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

  root.append(header, content);
  container.append(root);

  async function updateProfile() {
    if (ctx.achievements) {
      try {
        await ctx.achievements.stat('nexus.arcade', 'gamesPlayed', 0);
      } catch {
        // Ignore
      }
    }

    // Try reading profile level
    if (ctx.system?.info) {
      try {
        const info = ctx.system.info();
        if (info?.profile) {
          // Profile exists
        }
      } catch {
        // Ignore
      }
    }

    // Default or calculated level/XP
    const xp = 120;
    const currentLvl = Math.max(1, Math.floor(xp / 100) + 1);
    const xpCurrent = xp % 100;
    const xpNeeded = 100;

    nameRow.querySelector('.nx-profile-level').textContent = `${t('stats.level')} ${currentLvl}`;
    nameRow.querySelector('.nx-profile-xp-text').textContent = `${xpCurrent} / ${xpNeeded} ${t('stats.xp')}`;
    barFill.style.width = `${(xpCurrent / xpNeeded) * 100}%`;
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
   */
  async function launchGame(appId) {
    if (ctx.system?.windows?.launch) {
      await ctx.system.windows.launch(appId);
    } else if (ctx.commands) {
      const cmdId = appId.replace('nexus.', '') + '.open';
      try {
        await ctx.commands.execute(cmdId);
      } catch {
        // Fallback
      }
    }
  }

  async function renderAchievementsGallery() {
    achievementsGrid.innerHTML = '';
    const sampleAchievements = [
      {
        id: 'snake_first_food',
        title: 'First Byte',
        desc: 'Eat your first food particle in Snake Evolution',
        icon: 'star',
        unlocked: true,
      },
      {
        id: 'breakout_first_block',
        title: 'Brick Breaker',
        desc: 'Destroy your first block in Breakout',
        icon: 'star',
        unlocked: true,
      },
      {
        id: 'memory_first_match',
        title: 'Synapse Fire',
        desc: 'Find your first matching card pair',
        icon: 'star',
        unlocked: true,
      },
      {
        id: '2048_reach_2048',
        title: 'Singularity 2048',
        desc: 'Form the legendary 2048 tile',
        icon: 'trophy',
        unlocked: false,
      },
      {
        id: 'reaction_sub_200',
        title: 'Lightning Synapse',
        desc: 'Achieve an average reaction time under 200 ms',
        icon: 'trophy',
        unlocked: false,
      },
    ];

    for (const ach of sampleAchievements) {
      const badge = h('div', { class: `nx-achievement-badge ${ach.unlocked ? 'unlocked' : 'locked'}` });
      badge.innerHTML = `
        <div class="nx-achievement-icon">${ach.unlocked ? '🏆' : '🔒'}</div>
        <div>
          <div class="nx-achievement-name">${ach.title}</div>
          <div class="nx-achievement-desc">${ach.desc}</div>
        </div>
      `;
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
