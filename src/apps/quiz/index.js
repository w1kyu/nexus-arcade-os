// @ts-check
import { createGameShell, gsButton } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { BUNDLED_QUESTIONS, get5050Eliminations, getStreakMultiplier, validateQuizPack } from './logic.js';
import './styles.css';

const APP_ID = 'nexus.quiz';
const QUESTION_TIME = 15; // seconds

export const commands = {
  'quiz.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  quiz: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-quiz' });
  const { t, root, audio } = shell;
  await shell.load();

  const isDe = ctx?.i18n?.locale === 'de';
  let questions = [...BUNDLED_QUESTIONS];
  let currentQIdx = 0;
  let score = 0;
  let streak = 0;
  let timeLeft = QUESTION_TIME;
  let answered = false;
  let used5050 = false;
  let timerInterval = 0;

  // Top Bar HUD
  const qEl = h('b', {}, `1/${questions.length}`);
  const scoreEl = h('b', {}, '0');
  const streakEl = h('b', {}, '0');

  const hud = h(
    'div',
    { class: 'nx-quiz-hud' },
    h('div', {}, t('hud.question') + ':', qEl),
    h('div', {}, t('hud.score') + ':', scoreEl),
    h('div', {}, t('hud.streak') + ':', streakEl),
  );

  const btn5050 = gsButton(t('actions.fiftyFifty'), () => onUse5050(), { 'data-testid': 'quiz-5050' });
  const btnNext = gsButton(t('actions.next'), () => onNextQuestion(), {
    class: 'primary',
    'data-testid': 'quiz-next',
  });
  btnNext.disabled = true;

  const bar = h(
    'div',
    { class: 'nx-quiz-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    btn5050,
    btnNext,
    gsButton(t('actions.customPack'), () => showImportPackDialog()),
    gsButton(shell.labels().stats, () =>
      shell.statsDialog([{ mode: 'classic', label: 'Classic Quiz' }], { score: true }),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Timer Bar
  const timerBar = h('div', { class: 'nx-quiz-timer-bar' });
  const timerWrap = h('div', { class: 'nx-quiz-timer-bar-wrap' }, timerBar);

  // Main Card
  const questionTextEl = h('div', { class: 'nx-quiz-question' });
  const optionsWrap = h('div', { class: 'nx-quiz-options' });
  const explanationEl = h('div', { class: 'nx-quiz-explanation', hidden: true });

  const card = h(
    'div',
    { class: 'nx-quiz-card', 'data-testid': 'quiz-card' },
    questionTextEl,
    optionsWrap,
    explanationEl,
  );
  const main = h('div', { class: 'nx-quiz-main' }, card);

  root.append(bar, timerWrap, main);

  function resetGame() {
    currentQIdx = 0;
    score = 0;
    streak = 0;
    used5050 = false;
    btn5050.disabled = false;
    showQuestion(0);
  }

  function showQuestion(idx) {
    clearInterval(timerInterval);
    answered = false;
    btnNext.disabled = true;
    timeLeft = QUESTION_TIME;
    timerBar.style.width = '100%';
    explanationEl.hidden = true;
    explanationEl.textContent = '';

    const q = questions[idx];
    qEl.textContent = `${idx + 1}/${questions.length}`;
    scoreEl.textContent = String(score);
    streakEl.textContent = String(streak);

    questionTextEl.textContent = isDe ? q.text.de : q.text.en;
    optionsWrap.innerHTML = '';

    const opts = isDe ? q.options.de : q.options.en;
    const letters = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < opts.length; i++) {
      const btn = /** @type {HTMLButtonElement} */ (
        h(
          'button',
          {
            type: 'button',
            class: 'nx-quiz-opt-btn',
            'data-opt': String(i),
            onclick: () => onSelectOption(i),
          },
          h('span', { class: 'nx-quiz-opt-letter' }, letters[i]),
          h('span', {}, opts[i]),
        )
      );
      optionsWrap.append(btn);
    }

    startTimer();
  }

  function startTimer() {
    timerInterval = window.setInterval(() => {
      if (shell.paused || answered) return;

      timeLeft -= 0.1;
      const pct = Math.max(0, (timeLeft / QUESTION_TIME) * 100);
      timerBar.style.width = `${pct}%`;

      if (timeLeft <= 0) {
        onTimeOut();
      }
    }, 100);
  }

  function onSelectOption(index) {
    if (answered || shell.paused) return;
    answered = true;
    clearInterval(timerInterval);

    const q = questions[currentQIdx];
    const isCorrect = index === q.correct;
    const buttons = optionsWrap.querySelectorAll('.nx-quiz-opt-btn');

    buttons.forEach((b) => /** @type {HTMLButtonElement} */ (b.disabled = true));

    if (isCorrect) {
      buttons[index]?.classList.add('correct');
      audio.play('victory');
      streak++;
      const mult = getStreakMultiplier(streak);
      const points = Math.round((100 + timeLeft * 10) * mult);
      score += points;

      if (streak >= 5) ctx.achievements.unlock('quiz_streak_5');
    } else {
      buttons[index]?.classList.add('incorrect');
      buttons[q.correct]?.classList.add('correct');
      audio.play('drop');
      streak = 0;
    }

    scoreEl.textContent = String(score);
    streakEl.textContent = String(streak);

    // Show Explanation
    explanationEl.hidden = false;
    explanationEl.textContent = isDe ? q.explanation.de : q.explanation.en;

    btnNext.disabled = false;
  }

  function onTimeOut() {
    answered = true;
    clearInterval(timerInterval);
    streak = 0;
    audio.play('gameover');

    const q = questions[currentQIdx];
    const buttons = optionsWrap.querySelectorAll('.nx-quiz-opt-btn');
    buttons.forEach((b) => /** @type {HTMLButtonElement} */ (b.disabled = true));
    buttons[q.correct]?.classList.add('correct');

    explanationEl.hidden = false;
    explanationEl.textContent = isDe ? q.explanation.de : q.explanation.en;
    btnNext.disabled = false;
  }

  function onNextQuestion() {
    if (currentQIdx + 1 < questions.length) {
      currentQIdx++;
      showQuestion(currentQIdx);
    } else {
      handleComplete();
    }
  }

  function onUse5050() {
    if (used5050 || answered) return;
    used5050 = true;
    btn5050.disabled = true;

    const q = questions[currentQIdx];
    const elim = get5050Eliminations(q.correct);
    const buttons = optionsWrap.querySelectorAll('.nx-quiz-opt-btn');

    for (const idx of elim) {
      const b = /** @type {HTMLButtonElement} */ (buttons[idx]);
      if (b) {
        b.style.visibility = 'hidden';
      }
    }
    audio.play('blip');
  }

  function showImportPackDialog() {
    const area = /** @type {HTMLTextAreaElement} */ (
      h('textarea', {
        placeholder: 'Paste custom quiz pack JSON...',
        style: 'width: 100%; height: 160px; font-family: monospace; font-size: 11px;',
      })
    );
    shell.dialog(
      'Import Quiz Pack',
      [area],
      [
        {
          label: 'Load Pack',
          primary: true,
          onClick: () => {
            try {
              const pack = JSON.parse(area.value);
              if (validateQuizPack(pack)) {
                questions = pack.questions;
                resetGame();
                shell.toast('Custom pack loaded!');
                return true;
              }
            } catch {
              // Ignore
            }
            shell.toast('Invalid quiz pack JSON');
            return false;
          },
        },
      ],
    );
  }

  function handleComplete() {
    ctx.achievements.unlock('quiz_first_clear');
    shell.finish({
      won: true,
      score,
      mode: 'classic',
      scoreText: `${score} points (${streak} best streak)`,
      onRestart: resetGame,
    });
  }

  shell.enablePause({
    onRestart: resetGame,
  });

  shell.onDispose(() => {
    clearInterval(timerInterval);
  });

  resetGame();

  return {
    unmount: () => shell.dispose(),
  };
}
