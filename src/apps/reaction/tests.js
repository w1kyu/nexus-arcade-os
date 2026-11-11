// @ts-check
// Implementations of the 6 Reaction Trainer tests

import { h } from '../../ui/dom.js';

/** @typedef {import('../../games/engine/index.js').GameAudio} GameAudio */

/**
 * 1. Classic Wait-For-Green Reaction Test
 * @param {HTMLElement} container
 * @param {GameAudio} audio
 * @param {(results: { average: number, min: number, max: number, scores: number[] }) => void} onComplete
 */
export function runClassicTest(container, audio, onComplete) {
  container.innerHTML = '';
  const root = h('div', { class: 'nx-reaction-screen nx-classic-screen' });

  let round = 0;
  const maxRounds = 5;
  /** @type {number[]} */
  const scores = [];
  /** @type {'waiting' | 'ready' | 'green' | 'falsestart' | 'roundResult'} */
  let state = 'waiting';
  let timerId = null;
  let startTime = 0;

  const content = h('div', { class: 'nx-reaction-center-content' });
  root.append(content);
  container.append(root);

  function startRound() {
    state = 'ready';
    root.className = 'nx-reaction-screen nx-classic-screen nx-state-red';
    content.innerHTML = `
      <div class="nx-reaction-big-icon">⏱</div>
      <h2>Wait for Green...</h2>
      <p>Round ${round + 1} of ${maxRounds}</p>
    `;

    const delay = 1500 + Math.random() * 3000;
    timerId = /** @type {any} */ (
      setTimeout(() => {
        state = 'green';
        root.className = 'nx-reaction-screen nx-classic-screen nx-state-green';
        content.innerHTML = `
        <div class="nx-reaction-big-icon">⚡</div>
        <h1 style="font-size: 48px;">CLICK!</h1>
      `;
        startTime = performance.now();
      }, delay)
    );
  }

  function handleClick() {
    if (state === 'ready') {
      // False start!
      clearTimeout(timerId);
      state = 'falsestart';
      audio.play('hit');
      root.className = 'nx-reaction-screen nx-classic-screen nx-state-blue';
      content.innerHTML = `
        <div class="nx-reaction-big-icon">⚠️</div>
        <h2>Too Soon!</h2>
        <p>You clicked before the screen turned green.</p>
        <button class="nx-game-btn nx-btn-primary">Try Again</button>
      `;
      content.querySelector('button')?.addEventListener('click', (e) => {
        e.stopPropagation();
        startRound();
      });
    } else if (state === 'green') {
      const ms = Math.round(performance.now() - startTime);
      scores.push(ms);
      round++;
      audio.play('coin');

      if (round >= maxRounds) {
        const sum = scores.reduce((a, b) => a + b, 0);
        const average = Math.round(sum / scores.length);
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        onComplete({ average, min, max, scores });
      } else {
        state = 'roundResult';
        root.className = 'nx-reaction-screen nx-classic-screen nx-state-blue';
        content.innerHTML = `
          <h1 style="font-size: 42px;">${ms} ms</h1>
          <p>Click anywhere to continue to Round ${round + 1}</p>
        `;
      }
    } else if (state === 'roundResult') {
      startRound();
    }
  }

  root.addEventListener('pointerdown', handleClick);
  startRound();

  return () => {
    clearTimeout(timerId);
  };
}

/**
 * 2. Aim Trainer (30 targets)
 * @param {HTMLElement} container
 * @param {GameAudio} audio
 * @param {(results: { msPerTarget: number, accuracy: number, hits: number, totalClicks: number }) => void} onComplete
 */
export function runAimTrainer(container, audio, onComplete) {
  container.innerHTML = '';
  const root = h('div', { class: 'nx-reaction-screen nx-aim-screen' });
  container.append(root);

  let targetCount = 0;
  const maxTargets = 30;
  let totalClicks = 0;
  let hits = 0;
  let startTime = 0;

  const targetEl = h('div', { class: 'nx-aim-target' });
  root.append(targetEl);

  function spawnNext() {
    targetCount++;
    if (targetCount > maxTargets) {
      const elapsed = performance.now() - startTime;
      const msPerTarget = Math.round(elapsed / maxTargets);
      const accuracy = Math.round((hits / Math.max(1, totalClicks)) * 100);
      onComplete({ msPerTarget, accuracy, hits, totalClicks });
      return;
    }

    const rect = root.getBoundingClientRect();
    const margin = 50;
    const x = margin + Math.random() * (rect.width - margin * 2);
    const y = margin + Math.random() * (rect.height - margin * 2);

    targetEl.style.left = `${x}px`;
    targetEl.style.top = `${y}px`;
  }

  root.addEventListener('pointerdown', (e) => {
    totalClicks++;
    if (e.target === targetEl) {
      hits++;
      audio.play('jump');
      spawnNext();
    } else {
      audio.play('hit');
    }
  });

  startTime = performance.now();
  spawnNext();
}

/**
 * 3. Sequence Memory (Simon Says)
 * @param {HTMLElement} container
 * @param {GameAudio} audio
 * @param {(level: number) => void} onComplete
 */
export function runSequenceMemory(container, audio, onComplete) {
  container.innerHTML = '';
  const root = h('div', { class: 'nx-reaction-screen nx-sequence-screen' });

  let level = 1;
  /** @type {number[]} */
  const sequence = [];
  let playerStep = 0;
  let isPlayingSeq = false;

  const header = h('div', { class: 'nx-sequence-header' }, h('h3', {}, `Level ${level}`));
  const grid = h('div', { class: 'nx-sequence-grid' });
  /** @type {HTMLButtonElement[]} */
  const pads = [];

  for (let i = 0; i < 9; i++) {
    const pad = /** @type {HTMLButtonElement} */ (h('button', { class: 'nx-sequence-pad' }));
    pad.addEventListener('click', () => handlePadClick(i));
    pads.push(pad);
    grid.append(pad);
  }

  root.append(header, grid);
  container.append(root);

  function nextLevel() {
    sequence.push(Math.floor(Math.random() * 9));
    playerStep = 0;
    header.querySelector('h3').textContent = `Level ${sequence.length}`;
    playSequence();
  }

  async function playSequence() {
    isPlayingSeq = true;
    await new Promise((r) => setTimeout(r, 600));

    for (const idx of sequence) {
      pads[idx].classList.add('flash');
      audio.play('coin');
      await new Promise((r) => setTimeout(r, 400));
      pads[idx].classList.remove('flash');
      await new Promise((r) => setTimeout(r, 200));
    }

    isPlayingSeq = false;
  }

  function handlePadClick(idx) {
    if (isPlayingSeq) return;

    pads[idx].classList.add('flash');
    setTimeout(() => pads[idx].classList.remove('flash'), 200);

    if (idx === sequence[playerStep]) {
      audio.play('blip');
      playerStep++;
      if (playerStep >= sequence.length) {
        level++;
        nextLevel();
      }
    } else {
      audio.play('gameover');
      onComplete(level);
    }
  }

  nextLevel();
}

/**
 * 4. Number Memory Test
 * @param {HTMLElement} container
 * @param {GameAudio} audio
 * @param {(digits: number) => void} onComplete
 */
export function runNumberMemory(container, audio, onComplete) {
  container.innerHTML = '';
  const root = h('div', { class: 'nx-reaction-screen' });
  container.append(root);

  let digits = 3;

  function startRound() {
    let numStr = '';
    for (let i = 0; i < digits; i++) {
      numStr += Math.floor(Math.random() * 10);
    }

    root.innerHTML = `
      <div class="nx-reaction-center-content">
        <h3 style="color: #8b9bb4;">Level ${digits - 2}</h3>
        <h1 style="font-size: 54px; letter-spacing: 4px; color: #00f0ff;">${numStr}</h1>
        <div class="nx-number-progress-bar"></div>
      </div>
    `;

    const displayMs = 1200 + digits * 500;
    setTimeout(() => {
      promptInput(numStr);
    }, displayMs);
  }

  function promptInput(correctNum) {
    root.innerHTML = `
      <div class="nx-reaction-center-content">
        <h2>What was the number?</h2>
        <input type="text" class="nx-number-input" autofocus />
        <button class="nx-game-btn nx-btn-primary" style="margin-top: 14px;">Submit</button>
      </div>
    `;

    const input = /** @type {HTMLInputElement} */ (root.querySelector('.nx-number-input'));
    const btn = root.querySelector('button');
    input?.focus();

    const check = () => {
      const val = input.value.trim();
      if (val === correctNum) {
        audio.play('coin');
        digits++;
        startRound();
      } else {
        audio.play('gameover');
        onComplete(digits - 1);
      }
    };

    btn?.addEventListener('click', check);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') check();
    });
  }

  startRound();
}

/**
 * 5. Visual Memory Grid
 * @param {HTMLElement} container
 * @param {GameAudio} audio
 * @param {(level: number) => void} onComplete
 */
export function runVisualMemory(container, audio, onComplete) {
  container.innerHTML = '';
  const root = h('div', { class: 'nx-reaction-screen nx-visual-screen' });
  container.append(root);

  let level = 1;
  let lives = 3;

  function startRound() {
    const size = level <= 2 ? 3 : level <= 5 ? 4 : 5;
    const targetCount = level + 2;

    const allIndices = Array.from({ length: size * size }, (_, i) => i);
    const targets = new Set();
    while (targets.size < targetCount) {
      targets.add(allIndices[Math.floor(Math.random() * allIndices.length)]);
    }

    const clicked = new Set();
    let canClick = false;

    root.innerHTML = '';
    const header = h('div', { class: 'nx-sequence-header' }, h('h3', {}, `Level ${level} — Lives: ${lives}`));
    const grid = h('div', {
      class: 'nx-visual-grid',
      style: `grid-template-columns: repeat(${size}, 1fr); grid-template-rows: repeat(${size}, 1fr);`,
    });

    /** @type {HTMLButtonElement[]} */
    const cells = [];
    for (let i = 0; i < size * size; i++) {
      const cell = /** @type {HTMLButtonElement} */ (h('button', { class: 'nx-visual-cell' }));
      cells.push(cell);
      grid.append(cell);

      cell.addEventListener('click', () => {
        if (!canClick || clicked.has(i)) return;
        clicked.add(i);

        if (targets.has(i)) {
          cell.classList.add('correct');
          audio.play('coin');
          if (clicked.size === targets.size) {
            level++;
            setTimeout(startRound, 600);
          }
        } else {
          cell.classList.add('wrong');
          audio.play('hit');
          lives--;
          if (lives <= 0) {
            onComplete(level);
          } else {
            setTimeout(startRound, 800);
          }
        }
      });
    }

    root.append(header, grid);

    // Flash targets
    for (const idx of targets) {
      cells[idx].classList.add('flash');
    }

    setTimeout(() => {
      for (const idx of targets) {
        cells[idx].classList.remove('flash');
      }
      canClick = true;
    }, 1200);
  }

  startRound();
}

/**
 * 6. Choice Reaction Test (10 trials)
 * @param {HTMLElement} container
 * @param {GameAudio} audio
 * @param {(results: { average: number, min: number, max: number }) => void} onComplete
 */
export function runChoiceReaction(container, audio, onComplete) {
  container.innerHTML = '';
  const root = h('div', { class: 'nx-reaction-screen nx-choice-screen' });
  container.append(root);

  const choices = [
    { dir: 'left', key: 'ArrowLeft', symbol: '←', color: '#00f0ff' },
    { dir: 'right', key: 'ArrowRight', symbol: '→', color: '#ff00aa' },
    { dir: 'up', key: 'ArrowUp', symbol: '↑', color: '#ffd700' },
    { dir: 'down', key: 'ArrowDown', symbol: '↓', color: '#00ff88' },
  ];

  let trial = 0;
  const maxTrials = 10;
  const latencies = [];
  let currentTarget = choices[0];
  let startTime = 0;

  const content = h('div', { class: 'nx-reaction-center-content' });
  root.append(content);

  function startTrial() {
    trial++;
    if (trial > maxTrials) {
      const sum = latencies.reduce((a, b) => a + b, 0);
      const average = Math.round(sum / latencies.length);
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);
      onComplete({ average, min, max });
      return;
    }

    currentTarget = choices[Math.floor(Math.random() * choices.length)];
    content.innerHTML = `
      <div style="font-size: 84px; color: ${currentTarget.color}; font-weight: 900;">${currentTarget.symbol}</div>
      <p style="font-size: 14px; color: #8b9bb4; margin-top: 10px;">Press Arrow Key: ${currentTarget.dir.toUpperCase()}</p>
    `;
    startTime = performance.now();
  }

  const onKey = (/** @type {KeyboardEvent} */ e) => {
    if (e.code === currentTarget.key) {
      const ms = Math.round(performance.now() - startTime);
      latencies.push(ms);
      audio.play('coin');
      startTrial();
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      audio.play('hit');
    }
  };

  window.addEventListener('keydown', onKey);
  startTrial();

  return () => {
    window.removeEventListener('keydown', onKey);
  };
}
