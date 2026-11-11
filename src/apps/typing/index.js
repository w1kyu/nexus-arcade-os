// @ts-check
import { GameAudio, GameScoreService, createGameOverModal, createPauseModal } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import {
  CODE_SNIPPETS,
  COMMON_WORDS_EN,
  FINGER_COLORS,
  GERMAN_TEXTS,
  KEY_FINGER_MAP,
  QWERTY_LAYOUT,
  QWERTZ_LAYOUT,
  QUOTES,
} from './content.js';
import { calculateAccuracy, calculateConsistency, calculateRawWpm, calculateWpm } from './stats.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-typing-app' });
  const audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
  const scores = new GameScoreService('nexus.typing', ctx);

  // Settings & state
  let currentMode = 'words'; // 'words' | 'quotes' | 'code' | 'german'
  let currentLayout = 'qwerty'; // 'qwerty' | 'qwertz'
  let showHeatmap = false;

  let targetText = '';
  let currentIndex = 0;
  /** @type {('correct' | 'incorrect' | 'pending')[]} */
  let charStates = [];

  // Metrics tracking
  let startTime = 0;
  let elapsedSeconds = 0;
  let timerId = null;
  let totalKeystrokes = 0;
  let correctKeystrokes = 0;
  let errorCount = 0;
  /** @type {number[]} */
  const wpmSamples = [];
  /** @type {Record<string, number>} */
  const errorHeatmap = {};
  let isCompleted = false;
  let isPaused = false;

  // Toolbar
  const toolbar = h('div', { class: 'nx-typing-toolbar' });
  const modesEl = h('div', { class: 'nx-typing-modes' });
  /** @type {Record<string, HTMLButtonElement>} */
  const modeBtns = {};

  for (const m of ['words', 'quotes', 'code', 'german']) {
    const btn = /** @type {HTMLButtonElement} */ (
      h('button', { class: `nx-typing-btn ${m === currentMode ? 'active' : ''}` }, t(`modes.${m}`))
    );
    btn.addEventListener('click', () => {
      currentMode = m;
      for (const [k, b] of Object.entries(modeBtns)) {
        b.classList.toggle('active', k === currentMode);
      }
      startSession();
    });
    modeBtns[m] = btn;
    modesEl.append(btn);
  }

  const optionsEl = h('div', { class: 'nx-typing-options' });
  const btnLayout = h('button', { class: 'nx-typing-btn' }, 'Layout: QWERTY');
  btnLayout.addEventListener('click', () => {
    currentLayout = currentLayout === 'qwerty' ? 'qwertz' : 'qwerty';
    btnLayout.textContent = `Layout: ${currentLayout.toUpperCase()}`;
    renderKeyboard();
  });

  const btnHeatmap = h('button', { class: 'nx-typing-btn' }, 'Heatmap: OFF');
  btnHeatmap.addEventListener('click', () => {
    showHeatmap = !showHeatmap;
    btnHeatmap.textContent = `Heatmap: ${showHeatmap ? 'ON' : 'OFF'}`;
    btnHeatmap.classList.toggle('active', showHeatmap);
    renderKeyboard();
  });

  optionsEl.append(btnLayout, btnHeatmap);
  toolbar.append(modesEl, optionsEl);

  // HUD
  const hud = h('div', { class: 'nx-typing-stats-hud' });
  const wpmVal = h('div', { class: 'nx-typing-stat-val' }, '0');
  const rawVal = h('div', { class: 'nx-typing-stat-val' }, '0');
  const accVal = h('div', { class: 'nx-typing-stat-val' }, '100%');
  const consVal = h('div', { class: 'nx-typing-stat-val' }, '100%');

  hud.append(
    h('div', { class: 'nx-typing-stat-box' }, wpmVal, h('div', { class: 'nx-typing-stat-lbl' }, t('stats.wpm'))),
    h('div', { class: 'nx-typing-stat-box' }, rawVal, h('div', { class: 'nx-typing-stat-lbl' }, t('stats.rawWpm'))),
    h('div', { class: 'nx-typing-stat-box' }, accVal, h('div', { class: 'nx-typing-stat-lbl' }, t('stats.accuracy'))),
    h(
      'div',
      { class: 'nx-typing-stat-box' },
      consVal,
      h('div', { class: 'nx-typing-stat-lbl' }, t('stats.consistency')),
    ),
  );

  // Text display container (focusable)
  const textWrap = h('div', { class: 'nx-typing-text-wrap', tabindex: '0' });

  // Virtual Keyboard
  const keyboardEl = h('div', { class: 'nx-typing-keyboard' });

  // Finger Legend
  const legendEl = h('div', { class: 'nx-typing-finger-legend' });
  const legendTags = [
    { label: 'Pinky', color: FINGER_COLORS.leftPinky },
    { label: 'Ring', color: FINGER_COLORS.leftRing },
    { label: 'Middle', color: FINGER_COLORS.leftMiddle },
    { label: 'Index', color: FINGER_COLORS.leftIndex },
    { label: 'Thumb', color: FINGER_COLORS.thumb },
  ];
  for (const item of legendTags) {
    const tag = h(
      'div',
      { class: 'nx-typing-finger-tag' },
      h('div', { class: 'nx-typing-finger-dot', style: `background: ${item.color};` }),
      h('span', {}, item.label),
    );
    legendEl.append(tag);
  }

  function startSession() {
    stopTimer();
    isCompleted = false;
    currentIndex = 0;
    startTime = 0;
    elapsedSeconds = 0;
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    errorCount = 0;
    wpmSamples.length = 0;

    // Pick target text based on mode
    if (currentMode === 'words') {
      const shuffled = [...COMMON_WORDS_EN].sort(() => Math.random() - 0.5);
      targetText = shuffled.slice(0, 30).join(' ');
    } else if (currentMode === 'quotes') {
      targetText = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    } else if (currentMode === 'code') {
      const langs = Object.keys(CODE_SNIPPETS);
      const l = langs[Math.floor(Math.random() * langs.length)];
      const list = CODE_SNIPPETS[/** @type {keyof typeof CODE_SNIPPETS} */ (l)];
      targetText = list[Math.floor(Math.random() * list.length)];
    } else if (currentMode === 'german') {
      targetText = GERMAN_TEXTS[Math.floor(Math.random() * GERMAN_TEXTS.length)];
    }

    charStates = Array(targetText.length).fill('pending');
    renderText();
    renderKeyboard();
    updateHUD();
    textWrap.focus();
  }

  function startTimer() {
    if (timerId !== null) return;
    startTime = Date.now();
    timerId = window.setInterval(() => {
      if (!isPaused && !isCompleted && startTime > 0) {
        elapsedSeconds = (Date.now() - startTime) / 1000;
        const currentWpm = calculateWpm(correctKeystrokes, elapsedSeconds);
        wpmSamples.push(currentWpm);
        updateHUD();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updateHUD() {
    wpmVal.textContent = String(calculateWpm(correctKeystrokes, elapsedSeconds));
    rawVal.textContent = String(calculateRawWpm(totalKeystrokes, elapsedSeconds));
    accVal.textContent = `${calculateAccuracy(correctKeystrokes, totalKeystrokes)}%`;
    consVal.textContent = `${calculateConsistency(wpmSamples)}%`;
  }

  function renderText() {
    textWrap.innerHTML = '';
    for (let i = 0; i < targetText.length; i++) {
      const ch = targetText[i];
      const span = h('span', { class: 'nx-typing-char' }, ch === ' ' ? ' ' : ch);
      if (i < currentIndex) {
        span.classList.add(charStates[i]);
      } else if (i === currentIndex) {
        span.classList.add('current');
      }
      textWrap.append(span);
    }
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = '';
    const layout = currentLayout === 'qwertz' ? QWERTZ_LAYOUT : QWERTY_LAYOUT;
    const nextChar = targetText[currentIndex] || '';

    // Find finger color for next character
    const fingerName = KEY_FINGER_MAP[nextChar];
    const fingerColor = fingerName ? FINGER_COLORS[fingerName] : '#00f0ff';

    for (const row of layout) {
      const rowEl = h('div', { class: 'nx-typing-kb-row' });
      for (const key of row) {
        const keyEl = h('div', { class: 'nx-typing-key' }, key);
        if (key === 'Space') keyEl.classList.add('space');
        if (['Backspace', 'Tab', 'Caps', 'Enter', 'Shift'].includes(key)) keyEl.classList.add('wide');

        // Check if this key matches next character
        const isMatch = (key === 'Space' && nextChar === ' ') || key.toLowerCase() === nextChar.toLowerCase();

        if (isMatch && !isCompleted) {
          keyEl.classList.add('highlight-next');
          keyEl.style.setProperty('--finger-color', fingerColor);
        }

        // Error heatmap overlay
        if (showHeatmap && errorHeatmap[key.toLowerCase()]) {
          const errors = errorHeatmap[key.toLowerCase()];
          const opacity = Math.min(0.8, 0.2 + errors * 0.15);
          keyEl.classList.add('heatmap-error');
          keyEl.style.setProperty('--heat-opacity', String(opacity));
        }

        rowEl.append(keyEl);
      }
      keyboardEl.append(rowEl);
    }
  }

  function handleKeyInput(/** @type {KeyboardEvent} */ e) {
    if (isCompleted || isPaused) return;

    if (e.key === 'Escape') {
      togglePause();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (currentIndex > 0) {
        currentIndex--;
        charStates[currentIndex] = 'pending';
        audio.play('blip');
        renderText();
        renderKeyboard();
      }
      return;
    }

    // Only process printable single character inputs
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    e.preventDefault();
    if (startTime === 0) startTimer();

    const expected = targetText[currentIndex];
    const typed = e.key;
    totalKeystrokes++;

    if (typed === expected) {
      charStates[currentIndex] = 'correct';
      correctKeystrokes++;
      audio.play('blip');
    } else {
      charStates[currentIndex] = 'incorrect';
      errorCount++;
      const normKey = expected.toLowerCase();
      errorHeatmap[normKey] = (errorHeatmap[normKey] || 0) + 1;
      audio.play('hit');
    }

    currentIndex++;
    renderText();
    renderKeyboard();
    updateHUD();

    if (currentIndex >= targetText.length) {
      finishSession();
    }
  }

  function finishSession() {
    isCompleted = true;
    stopTimer();
    audio.play('victory');

    const finalWpm = calculateWpm(correctKeystrokes, elapsedSeconds);
    const finalAccuracy = calculateAccuracy(correctKeystrokes, totalKeystrokes);
    const finalConsistency = calculateConsistency(wpmSamples);

    scores
      .submitScore(finalWpm, currentMode, {
        details: { accuracy: finalAccuracy, consistency: finalConsistency, errors: errorCount },
      })
      .then((res) => {
        const modal = createGameOverModal({
          score: finalWpm,
          isNewHigh: res.isNewHigh,
          rank: res.rank,
          xpEarned: Math.min(50, Math.max(15, Math.floor(finalWpm / 2))),
          onRestart: () => startSession(),
        });
        const label = modal.querySelector('.nx-game-score-label');
        if (label) label.textContent = 'WORDS PER MINUTE (WPM)';
        root.append(modal);
      });

    if (ctx?.achievements?.unlock) {
      if (finalWpm >= 60) ctx.achievements.unlock('typing_60_wpm');
      if (finalWpm >= 100) ctx.achievements.unlock('typing_100_wpm');
      if (finalAccuracy >= 98) ctx.achievements.unlock('typing_accuracy_98');
      if (currentMode === 'code' && finalAccuracy >= 95) ctx.achievements.unlock('typing_code_master');
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      const modal = createPauseModal({
        onResume: () => {
          isPaused = false;
        },
        onRestart: () => {
          isPaused = false;
          startSession();
        },
        audio,
        title: 'TYPING TRAINER PAUSED',
      });
      root.append(modal);
    }
  }

  textWrap.addEventListener('keydown', handleKeyInput);
  root.addEventListener('click', () => {
    if (!isCompleted && !isPaused) textWrap.focus();
  });

  root.append(toolbar, hud, textWrap, keyboardEl, legendEl);
  container.append(root);
  startSession();

  return () => {
    stopTimer();
    textWrap.removeEventListener('keydown', handleKeyInput);
  };
}

export const terminal = {
  typing: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Typing Trainer...');
    if (ctx.commands) {
      await ctx.commands.execute('typing.open');
    }
    return 0;
  },
};
