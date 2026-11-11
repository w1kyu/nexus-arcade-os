// @ts-check
// Standardized Game UI: Pause Menu, Game Over Modal, and HUD components

import { h } from '../../ui/dom.js';
import './styles.css';

/** English fallbacks; games pass localized `labels`. */
const DEFAULT_LABELS = {
  paused: 'PAUSED',
  resume: 'Resume',
  restart: 'Restart',
  soundOn: 'Sound: ON',
  soundOff: 'Sound: OFF',
  quit: 'Quit',
  gameOver: 'GAME OVER',
  finalScore: 'FINAL SCORE',
  newHigh: '★ NEW HIGH SCORE! ★',
  rank: 'Rank #{rank} on Leaderboard',
  xp: '+{xp} XP Earned',
  playAgain: 'Play Again',
  leaderboard: 'Leaderboard',
  menu: 'Menu',
};

/**
 * Creates a standardized arcade pause overlay.
 * @param {object} options
 * @param {() => void} options.onResume
 * @param {() => void} options.onRestart
 * @param {() => void} [options.onQuit]
 * @param {import('./audio.js').GameAudio} [options.audio]
 * @param {string} [options.title]
 * @param {Partial<typeof DEFAULT_LABELS>} [options.labels] Localized texts
 * @returns {HTMLElement}
 */
export function createPauseModal({ onResume, onRestart, onQuit, audio, title, labels }) {
  const L = { ...DEFAULT_LABELS, ...labels };
  let soundMuted = audio ? audio.muted : false;

  const overlay = h('div', { class: 'nx-game-modal-overlay', 'data-testid': 'game-pause' });
  const modal = h('div', { class: 'nx-game-modal' });

  const titleEl = h('h2', { class: 'nx-game-modal-title' }, title ?? L.paused);
  const btnResume = h('button', { class: 'nx-game-btn nx-btn-primary', 'data-testid': 'game-resume' }, L.resume);
  const btnRestart = h('button', { class: 'nx-game-btn' }, L.restart);
  const btnMute = h('button', { class: 'nx-game-btn nx-game-btn-toggle' }, soundMuted ? L.soundOff : L.soundOn);
  const btnQuit = onQuit ? h('button', { class: 'nx-game-btn nx-btn-danger' }, L.quit) : null;

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
      btnMute.textContent = soundMuted ? L.soundOff : L.soundOn;
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
 * @param {string} [options.title] Replaces "GAME OVER" (e.g. "You win")
 * @param {boolean} [options.won] Uses the positive title color
 * @param {string} [options.scoreLabel] Replaces "FINAL SCORE"
 * @param {string} [options.scoreText] Shown instead of the raw score (e.g. a time)
 * @param {Partial<typeof DEFAULT_LABELS>} [options.labels] Localized texts
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
  title,
  won = false,
  scoreLabel,
  scoreText,
  labels,
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const overlay = h('div', { class: 'nx-game-modal-overlay', 'data-testid': 'game-over' });
  const modal = h('div', { class: 'nx-game-modal' });

  const titleEl = h('h2', { class: `nx-game-modal-title ${won ? '' : 'nx-text-danger'}` }, title ?? L.gameOver);

  const scoreBox = h(
    'div',
    { class: 'nx-game-score-box' },
    h('div', { class: 'nx-game-score-label' }, scoreLabel ?? L.finalScore),
    h('div', { class: 'nx-game-score-num' }, scoreText ?? String(score)),
    isNewHigh
      ? h('div', { class: 'nx-game-badge nx-badge-high' }, L.newHigh)
      : rank > 0
        ? h('div', { class: 'nx-game-badge' }, L.rank.replace('{rank}', String(rank)))
        : '',
    xpEarned > 0 ? h('div', { class: 'nx-game-xp-badge' }, L.xp.replace('{xp}', String(xpEarned))) : '',
  );

  const btnRestart = h('button', { class: 'nx-game-btn nx-btn-primary', 'data-testid': 'game-again' }, L.playAgain);
  const btnLeaderboard = onLeaderboard ? h('button', { class: 'nx-game-btn' }, L.leaderboard) : null;
  const btnQuit = onQuit ? h('button', { class: 'nx-game-btn' }, L.menu) : null;

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
