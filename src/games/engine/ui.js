// @ts-check
// Standardized Game UI: Pause Menu, Game Over Modal, and HUD components

import { h } from '../../ui/dom.js';

/**
 * Creates a standardized arcade pause overlay.
 * @param {object} options
 * @param {() => void} options.onResume
 * @param {() => void} options.onRestart
 * @param {() => void} [options.onQuit]
 * @param {import('./audio.js').GameAudio} [options.audio]
 * @param {string} [options.title]
 * @returns {HTMLElement}
 */
export function createPauseModal({ onResume, onRestart, onQuit, audio, title = 'PAUSED' }) {
  let soundMuted = audio ? audio.muted : false;

  const overlay = h('div', { class: 'nx-game-modal-overlay' });
  const modal = h('div', { class: 'nx-game-modal' });

  const titleEl = h('h2', { class: 'nx-game-modal-title' }, title);
  const btnResume = h('button', { class: 'nx-game-btn nx-btn-primary' }, 'Resume');
  const btnRestart = h('button', { class: 'nx-game-btn' }, 'Restart');
  const btnMute = h('button', { class: 'nx-game-btn nx-game-btn-toggle' }, soundMuted ? 'Sound: OFF' : 'Sound: ON');
  const btnQuit = onQuit ? h('button', { class: 'nx-game-btn nx-btn-danger' }, 'Quit') : null;

  btnResume.addEventListener('click', () => {
    overlay.remove();
    onResume();
  });

  btnRestart.addEventListener('click', () => {
    overlay.remove();
    onRestart();
  });

  btnMute.addEventListener('click', () => {
    if (audio) {
      soundMuted = !soundMuted;
      audio.setMuted(soundMuted);
      btnMute.textContent = soundMuted ? 'Sound: OFF' : 'Sound: ON';
    }
  });

  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      overlay.remove();
      onQuit();
    });
  }

  const actions = h('div', { class: 'nx-game-modal-actions' }, btnResume, btnRestart, btnMute, btnQuit || '');

  modal.append(titleEl, actions);
  overlay.append(modal);
  return overlay;
}

/**
 * Creates a standardized arcade Game Over overlay.
 * @param {object} options
 * @param {number} options.score
 * @param {boolean} [options.isNewHigh]
 * @param {number} [options.rank]
 * @param {number} [options.xpEarned]
 * @param {() => void} options.onRestart
 * @param {() => void} [options.onQuit]
 * @param {() => void} [options.onLeaderboard]
 * @returns {HTMLElement}
 */
export function createGameOverModal({
  score,
  isNewHigh = false,
  rank = 0,
  xpEarned = 15,
  onRestart,
  onQuit,
  onLeaderboard,
}) {
  const overlay = h('div', { class: 'nx-game-modal-overlay' });
  const modal = h('div', { class: 'nx-game-modal' });

  const titleEl = h('h2', { class: 'nx-game-modal-title nx-text-danger' }, 'GAME OVER');

  const scoreBox = h(
    'div',
    { class: 'nx-game-score-box' },
    h('div', { class: 'nx-game-score-label' }, 'FINAL SCORE'),
    h('div', { class: 'nx-game-score-num' }, String(score)),
    isNewHigh
      ? h('div', { class: 'nx-game-badge nx-badge-high' }, '★ NEW HIGH SCORE! ★')
      : rank > 0
        ? h('div', { class: 'nx-game-badge' }, `Rank #${rank} on Leaderboard`)
        : '',
    xpEarned > 0 ? h('div', { class: 'nx-game-xp-badge' }, `+${xpEarned} XP Earned`) : '',
  );

  const btnRestart = h('button', { class: 'nx-game-btn nx-btn-primary' }, 'Play Again');
  const btnLeaderboard = onLeaderboard ? h('button', { class: 'nx-game-btn' }, 'Leaderboard') : null;
  const btnQuit = onQuit ? h('button', { class: 'nx-game-btn' }, 'Menu') : null;

  btnRestart.addEventListener('click', () => {
    overlay.remove();
    onRestart();
  });

  if (btnLeaderboard) {
    btnLeaderboard.addEventListener('click', () => {
      onLeaderboard();
    });
  }

  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      overlay.remove();
      onQuit();
    });
  }

  const actions = h('div', { class: 'nx-game-modal-actions' }, btnRestart, btnLeaderboard || '', btnQuit || '');

  modal.append(titleEl, scoreBox, actions);
  overlay.append(modal);
  return overlay;
}
