// @ts-check
import { GameAudio, GameScoreService } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { getBenchmarkPercentile } from './benchmarks.js';
import './styles.css';
import {
  runAimTrainer,
  runChoiceReaction,
  runClassicTest,
  runNumberMemory,
  runSequenceMemory,
  runVisualMemory,
} from './tests.js';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
  const scores = new GameScoreService('nexus.reaction', ctx);

  const root = h('div', { class: 'nx-reaction-app' });
  const viewWrap = h('div', {
    class: 'nx-reaction-view-wrap',
    style: 'width: 100%; height: 100%; position: relative;',
  });

  const TESTS = [
    { id: 'classic', icon: '⚡' },
    { id: 'aim', icon: '🎯' },
    { id: 'sequence', icon: '🧩' },
    { id: 'number', icon: '🔢' },
    { id: 'visual', icon: '👁️' },
    { id: 'choice', icon: '🔀' },
  ];

  function renderMenu() {
    viewWrap.innerHTML = '';
    const menu = h('div', { class: 'nx-reaction-menu' });
    const title = h('h1', { class: 'nx-reaction-title' }, t('app.title'));
    const subtitle = h('div', { class: 'nx-reaction-subtitle' }, t('app.description'));

    const grid = h('div', { class: 'nx-reaction-tests-grid' });

    for (const test of TESTS) {
      const card = h('div', { class: 'nx-reaction-card' });
      card.innerHTML = `
        <div class="nx-reaction-card-icon">${test.icon}</div>
        <div class="nx-reaction-card-name">${t(`tests.${test.id}.name`)}</div>
        <div class="nx-reaction-card-desc">${t(`tests.${test.id}.desc`)}</div>
      `;
      card.addEventListener('click', () => startTest(test.id));
      grid.append(card);
    }

    menu.append(title, subtitle, grid);
    viewWrap.append(menu);
  }

  /**
   * @param {string} testId
   */
  function startTest(testId) {
    viewWrap.innerHTML = '';

    if (testId === 'classic') {
      runClassicTest(viewWrap, audio, async ({ average }) => {
        scores.unlockAchievement('reaction_first_test');
        if (average < 200) scores.unlockAchievement('reaction_sub_200');
        await scores.submitScore(average, 'classic');
        renderResult('classic', `${average} ms`, average);
      });
    } else if (testId === 'aim') {
      runAimTrainer(viewWrap, audio, async ({ msPerTarget, accuracy }) => {
        scores.unlockAchievement('reaction_first_test');
        if (accuracy >= 95) scores.unlockAchievement('reaction_aim_master');
        await scores.submitScore(msPerTarget, 'aim');
        renderResult('aim', `${msPerTarget} ms (${accuracy}% Acc)`, msPerTarget);
      });
    } else if (testId === 'sequence') {
      runSequenceMemory(viewWrap, audio, async (level) => {
        scores.unlockAchievement('reaction_first_test');
        if (level >= 10) scores.unlockAchievement('reaction_sequence_10');
        await scores.submitScore(level, 'sequence');
        renderResult('sequence', `Level ${level}`, level);
      });
    } else if (testId === 'number') {
      runNumberMemory(viewWrap, audio, async (digits) => {
        scores.unlockAchievement('reaction_first_test');
        if (digits >= 8) scores.unlockAchievement('reaction_number_8');
        await scores.submitScore(digits, 'number');
        renderResult('number', `${digits} Digits`, digits);
      });
    } else if (testId === 'visual') {
      runVisualMemory(viewWrap, audio, async (level) => {
        scores.unlockAchievement('reaction_first_test');
        await scores.submitScore(level, 'visual');
        renderResult('visual', `Level ${level}`, level);
      });
    } else if (testId === 'choice') {
      runChoiceReaction(viewWrap, audio, async ({ average }) => {
        scores.unlockAchievement('reaction_first_test');
        await scores.submitScore(average, 'choice');
        renderResult('choice', `${average} ms`, average);
      });
    }
  }

  /**
   * @param {'classic' | 'aim' | 'sequence' | 'number' | 'visual' | 'choice'} testId
   * @param {string} scoreDisplay
   * @param {number} numericScore
   */
  function renderResult(testId, scoreDisplay, numericScore) {
    viewWrap.innerHTML = '';
    const { percentile, tier } = getBenchmarkPercentile(testId, numericScore);

    const overlay = h('div', { class: 'nx-game-modal-overlay' });
    const modal = h('div', { class: 'nx-game-modal' });

    modal.innerHTML = `
      <h2 class="nx-game-modal-title">${t('results.completed')}</h2>
      <div class="nx-game-score-box">
        <div class="nx-game-score-label">${t(`tests.${testId}.name`).toUpperCase()}</div>
        <div class="nx-game-score-num">${scoreDisplay}</div>
        <div class="nx-game-badge" style="color: #00f0ff; font-size: 15px; font-weight: bold;">
          ${t('results.percentile')}: Top ${100 - percentile}% (${percentile}th)
        </div>
        <div class="nx-game-xp-badge">${tier}</div>
      </div>
      <div class="nx-game-modal-actions">
        <button class="nx-game-btn nx-btn-primary nx-btn-retry">${t('results.playAgain')}</button>
        <button class="nx-game-btn nx-btn-menu">${t('results.menu')}</button>
      </div>
    `;

    modal.querySelector('.nx-btn-retry')?.addEventListener('click', () => {
      overlay.remove();
      startTest(testId);
    });

    modal.querySelector('.nx-btn-menu')?.addEventListener('click', () => {
      overlay.remove();
      renderMenu();
    });

    overlay.append(modal);
    viewWrap.append(overlay);
  }

  root.append(viewWrap);
  renderMenu();
  container.append(root);

  return () => {
    audio.dispose();
  };
}

export const terminal = {
  reaction: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Reaction Trainer...');
    if (ctx.commands) {
      await ctx.commands.execute('reaction.open');
    }
    return 0;
  },
};
