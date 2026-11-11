// @ts-check
import { createGameShell, gsButton, gsSelect } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import {
  BOARD_SIZE,
  MATCH3_LEVELS,
  applyGravityAndRefill,
  createMatch3State,
  findMatches,
  isAdjacent,
  swapGems,
} from './logic.js';
import './styles.css';

const APP_ID = 'nexus.match3';

export const commands = {
  'match3.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  match3: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

const GEM_ICONS = {
  ruby: '💎',
  sapphire: '🔷',
  emerald: '🟢',
  amethyst: '🔮',
  topaz: '🔶',
  diamond: '💠',
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-match3' });
  const { t, root, audio } = shell;
  await shell.load();

  let currentLevelIdx = 0;
  let state = createMatch3State(currentLevelIdx);
  let selectedIdx = -1;
  let busy = false;

  // Top Bar HUD
  const levelEl = h('b', {}, String(state.level.id));
  const scoreEl = h('b', {}, String(state.score));
  const movesEl = h('b', {}, String(state.movesRemaining));
  const goalEl = h('b', {}, `${state.goalCollected}/${state.level.goalCount}`);

  const hud = h(
    'div',
    { class: 'nx-match3-hud' },
    h('div', {}, t('hud.level') + ':', levelEl),
    h('div', {}, t('hud.score') + ':', scoreEl),
    h('div', {}, t('hud.moves') + ':', movesEl),
    h('div', {}, t('hud.goal') + ':', goalEl),
  );

  const levelSelect = gsSelect(
    MATCH3_LEVELS.map((lvl, idx) => ({ value: String(idx), label: `L${lvl.id}` })),
    '0',
    (val) => {
      currentLevelIdx = Number(val);
      loadLevel(currentLevelIdx);
    },
    { 'aria-label': t('actions.selectLevel') },
  );

  const bar = h(
    'div',
    { class: 'nx-match3-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    levelSelect,
    gsButton(t('actions.restart'), () => loadLevel(currentLevelIdx)),
    gsButton(shell.labels().stats, () =>
      shell.statsDialog(
        MATCH3_LEVELS.map((lvl) => ({ mode: `lvl_${lvl.id}`, label: `L${lvl.id}` })),
        { score: true },
      ),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Main 8x8 Grid
  const gridEl = h('div', { class: 'nx-match3-grid', 'data-testid': 'match3-board' });
  /** @type {HTMLButtonElement[]} */
  const cellButtons = [];

  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const btn = /** @type {HTMLButtonElement} */ (
      h('button', {
        type: 'button',
        class: 'nx-match3-cell',
        'data-index': String(i),
        onclick: () => onCellClick(i),
      })
    );
    cellButtons.push(btn);
    gridEl.append(btn);
  }

  const main = h('div', { class: 'nx-match3-main' }, gridEl);
  root.append(bar, main);

  function loadLevel(idx) {
    state = createMatch3State(idx);
    selectedIdx = -1;
    busy = false;
    render();
    updateHUD();
  }

  function updateHUD() {
    levelEl.textContent = String(state.level.id);
    scoreEl.textContent = String(state.score);
    movesEl.textContent = String(state.movesRemaining);
    goalEl.textContent = `${state.goalCollected}/${state.level.goalCount}`;
  }

  function render() {
    for (let i = 0; i < state.board.length; i++) {
      const gem = state.board[i];
      const btn = cellButtons[i];

      if (gem) {
        btn.textContent = GEM_ICONS[/** @type {keyof typeof GEM_ICONS} */ (gem.type)] || '💎';
        btn.dataset.type = gem.type;
      } else {
        btn.textContent = '';
        btn.dataset.type = '';
      }

      btn.classList.toggle('selected', selectedIdx === i);
      btn.disabled = busy || state.gameOver;
    }
  }

  async function onCellClick(idx) {
    if (busy || state.gameOver || shell.paused) return;

    if (selectedIdx === -1) {
      selectedIdx = idx;
      audio.play('blip');
      render();
      return;
    }

    if (selectedIdx === idx) {
      selectedIdx = -1;
      render();
      return;
    }

    // Try swap if adjacent
    if (isAdjacent(selectedIdx, idx)) {
      const from = selectedIdx;
      const to = idx;
      selectedIdx = -1;
      busy = true;

      swapGems(state.board, from, to);
      render();

      const { matchedSet } = findMatches(state.board);
      if (matchedSet.size === 0) {
        // Invalid swap: revert
        audio.play('drop');
        setTimeout(() => {
          swapGems(state.board, from, to);
          busy = false;
          render();
        }, 200);
      } else {
        // Valid move!
        audio.play('place');
        state.movesRemaining--;
        updateHUD();
        await resolveCascades();
        busy = false;
        render();
        checkGameEnd();
      }
    } else {
      selectedIdx = idx;
      audio.play('blip');
      render();
    }
  }

  async function resolveCascades() {
    let cascades = 0;

    while (true) {
      const { matchedSet, groups } = findMatches(state.board);
      if (matchedSet.size === 0) break;

      cascades++;
      // Score calculation
      let points = 0;
      for (const g of groups) {
        points += g.indices.length * 50 * cascades;
        if (g.type === state.level.goalGem) {
          state.goalCollected += g.indices.length;
        }
      }
      state.score += points;
      updateHUD();

      // Clear & Gravity
      applyGravityAndRefill(state.board, matchedSet);
      audio.play('blip');
      render();

      await new Promise((res) => setTimeout(res, 220));
    }

    if (cascades >= 4) {
      ctx.achievements.unlock('match3_cascade_4');
    }
  }

  function checkGameEnd() {
    const goalMet = state.goalCollected >= state.level.goalCount || state.score >= state.level.targetScore;

    if (goalMet) {
      state.gameOver = true;
      state.won = true;
      audio.play('victory');
      if (currentLevelIdx === 0) ctx.achievements.unlock('match3_first_clear');

      shell.finish({
        won: true,
        score: state.score + state.movesRemaining * 100,
        mode: `lvl_${state.level.id}`,
        scoreText: `${state.score} pts (${state.movesRemaining} moves left)`,
        onRestart: () => {
          if (currentLevelIdx + 1 < MATCH3_LEVELS.length) {
            currentLevelIdx++;
            levelSelect.value = String(currentLevelIdx);
          }
          loadLevel(currentLevelIdx);
        },
      });
    } else if (state.movesRemaining <= 0) {
      state.gameOver = true;
      state.won = false;
      audio.play('gameover');

      shell.finish({
        won: false,
        score: state.score,
        mode: `lvl_${state.level.id}`,
        scoreText: String(state.score),
        onRestart: () => loadLevel(currentLevelIdx),
      });
    }
  }

  shell.enablePause({
    onRestart: () => loadLevel(currentLevelIdx),
  });

  loadLevel(0);

  return {
    unmount: () => shell.dispose(),
  };
}
