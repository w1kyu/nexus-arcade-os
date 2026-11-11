// @ts-check
import { createGameShell, dayKey, gsButton, gsToggleGroup } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { evaluateGuess, generateShareGrid, getDailyWord, validateHardMode } from './logic.js';
import { TARGETS_DE, TARGETS_EN, VALID_GUESSES_DE, VALID_GUESSES_EN } from './words.js';
import './styles.css';

const APP_ID = 'nexus.hexword';

export const commands = {
  'hexword.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  hexword: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-hexword' });
  const { t, root, audio } = shell;
  await shell.load();

  const isGerman = ctx.i18n.locale === 'de';
  const targetList = isGerman ? TARGETS_DE : TARGETS_EN;
  const validSet = isGerman ? VALID_GUESSES_DE : VALID_GUESSES_EN;

  /** @type {'daily' | 'random'} */
  let mode = 'daily';
  let hardMode = false;
  let targetWord = '';
  /** @type {string[]} */
  let guesses = [];
  /** @type {import('./logic.js').LetterStatus[][]} */
  let evaluations = [];
  let currentInput = '';
  let gameOver = false;

  // Key color states: letter -> 'correct' | 'present' | 'absent'
  /** @type {Record<string, import('./logic.js').LetterStatus>} */
  let letterStates = {};

  // Toolbar & HUD
  const topBar = h('div', { class: 'nx-gs-bar' });

  const modeGroup = gsToggleGroup(
    [
      { value: 'daily', label: t('mode.daily') },
      { value: 'random', label: t('mode.random') },
    ],
    mode,
    (v) => {
      mode = /** @type {any} */ (v);
      btnNew.hidden = mode !== 'random';
      newGame();
    },
    'hw-mode',
  );

  const btnHard = gsButton(
    t('actions.hardMode'),
    () => {
      if (guesses.length === 0) {
        hardMode = !hardMode;
        btnHard.classList.toggle('primary', hardMode);
      }
    },
    { 'data-testid': 'hw-hard' },
  );

  const btnNew = gsButton(t('actions.newGame'), () => newGame(), { 'data-testid': 'hw-new' });
  btnNew.hidden = mode !== 'random';

  const btnShare = gsButton(t('actions.share'), () => shareGrid(), { 'data-testid': 'hw-share' });
  btnShare.hidden = true;

  const btnStats = gsButton(
    t('actions.stats'),
    () => {
      shell.statsDialog(
        [
          { mode: 'daily', label: t('mode.daily') },
          { mode: 'random', label: t('mode.random') },
        ],
        { moves: true },
      );
    },
    { 'data-testid': 'hw-stats' },
  );

  topBar.append(modeGroup.el, btnHard, btnNew, btnShare, btnStats);

  // Main area
  const mainEl = h('div', { class: 'nx-hw-main' });
  const gridEl = h('div', { class: 'nx-hw-grid', 'data-testid': 'hw-grid' });
  const keyboardEl = h('div', { class: 'nx-hw-keyboard', 'data-testid': 'hw-keyboard' });

  mainEl.append(gridEl, keyboardEl);
  root.append(topBar, mainEl);

  // Keyboard layout
  const KB_LAYOUT_EN = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ];

  const KB_LAYOUT_DE = [
    ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Y', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ];

  const kbLayout = isGerman ? KB_LAYOUT_DE : KB_LAYOUT_EN;

  function newGame() {
    guesses = [];
    evaluations = [];
    currentInput = '';
    gameOver = false;
    letterStates = {};
    btnShare.hidden = true;

    if (mode === 'daily') {
      targetWord = getDailyWord(isGerman ? 'de' : 'en', dayKey());
    } else {
      const idx = Math.floor(Math.random() * targetList.length);
      targetWord = targetList[idx].toUpperCase();
    }

    renderGrid();
    renderKeyboard();
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    for (let r = 0; r < 6; r++) {
      const rowEl = h('div', { class: 'nx-hw-row', 'data-row': String(r) });
      const guess = guesses[r];
      const ev = evaluations[r];

      for (let c = 0; c < 5; c++) {
        const cellEl = h('div', { class: 'nx-hw-cell' });
        if (guess) {
          cellEl.textContent = guess[c];
          cellEl.classList.add(ev[c]);
        } else if (r === guesses.length) {
          const char = currentInput[c];
          if (char) {
            cellEl.textContent = char;
            cellEl.classList.add('filled');
          }
        }
        rowEl.append(cellEl);
      }
      gridEl.append(rowEl);
    }
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = '';
    for (const row of kbLayout) {
      const rowEl = h('div', { class: 'nx-hw-kb-row' });
      for (const key of row) {
        const isWide = key === 'ENTER' || key === '⌫';
        const st = letterStates[key];
        const btn = h(
          'button',
          {
            type: 'button',
            class: `nx-hw-key ${isWide ? 'wide' : ''} ${st ? st : ''}`,
            'data-key': key,
            onclick: () => onKeyClick(key),
          },
          key,
        );
        rowEl.append(btn);
      }
      keyboardEl.append(rowEl);
    }
  }

  function onKeyClick(key) {
    if (gameOver) return;
    if (key === 'ENTER') {
      submitGuess();
    } else if (key === '⌫' || key === 'BACKSPACE') {
      currentInput = currentInput.slice(0, -1);
      renderGrid();
    } else if (/^[A-Z]$/.test(key) && currentInput.length < 5) {
      currentInput += key;
      renderGrid();
    }
  }

  // Physical keyboard handling
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (gameOver || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') {
      submitGuess();
    } else if (e.key === 'Backspace') {
      currentInput = currentInput.slice(0, -1);
      renderGrid();
    } else if (/^[a-zA-Z]$/.test(e.key) && currentInput.length < 5) {
      currentInput += e.key.toUpperCase();
      renderGrid();
    }
  };
  root.addEventListener('keydown', onKeyDown);
  shell.onDispose(() => root.removeEventListener('keydown', onKeyDown));

  function submitGuess() {
    if (currentInput.length < 5) {
      shell.toast(t('status.tooShort'));
      return;
    }

    const guess = currentInput.toUpperCase();
    if (!validSet.has(guess) && !targetList.includes(guess)) {
      shell.toast(t('status.notInWordList'));
      return;
    }

    if (hardMode && guesses.length > 0) {
      const history = guesses.map((g, idx) => ({ guess: g, evaluation: evaluations[idx] }));
      const check = validateHardMode(guess, history);
      if (!check.valid) {
        shell.toast(check.reason ?? t('actions.hardMode'));
        return;
      }
    }

    const ev = evaluateGuess(targetWord, guess);
    guesses.push(guess);
    evaluations.push(ev);
    currentInput = '';

    // Update keyboard letter states (priority: correct > present > absent)
    for (let i = 0; i < 5; i++) {
      const ch = guess[i];
      const status = ev[i];
      const prev = letterStates[ch];
      if (status === 'correct') letterStates[ch] = 'correct';
      else if (status === 'present' && prev !== 'correct') letterStates[ch] = 'present';
      else if (!prev) letterStates[ch] = 'absent';
    }

    audio.play(guess === targetWord ? 'victory' : 'laser');
    renderGrid();
    renderKeyboard();

    if (guess === targetWord) {
      handleGameEnd(true);
    } else if (guesses.length >= 6) {
      handleGameEnd(false);
    }
  }

  function handleGameEnd(won) {
    gameOver = true;
    btnShare.hidden = false;

    if (won) {
      ctx.achievements?.unlock('hexword_first_win');
      if (guesses.length <= 2) ctx.achievements?.unlock('hexword_genius');
      if (hardMode) ctx.achievements?.unlock('hexword_hard_mode');

      const score = Math.max(100, 1000 - (guesses.length - 1) * 150);
      shell.finish({
        won: true,
        score,
        mode,
        moves: guesses.length,
        title: t('status.won'),
        scoreText: `${guesses.length}/6 ${t('hud.shots') ?? 'guesses'}`,
        onRestart: () => newGame(),
      });
    } else {
      shell.finish({
        won: false,
        score: 50,
        mode,
        title: t('status.lost', { word: targetWord }),
        onRestart: () => newGame(),
      });
    }
  }

  function shareGrid() {
    const text = generateShareGrid(guesses, targetWord, dayKey(), hardMode);
    if (ctx.clipboard?.writeText) {
      ctx.clipboard.writeText(text);
      shell.toast(t('status.copied'));
    }
  }

  shell.enablePause({
    canPause: () => true,
    onRestart: () => newGame(),
  });

  newGame();

  return {
    unmount: () => shell.dispose(),
  };
}
