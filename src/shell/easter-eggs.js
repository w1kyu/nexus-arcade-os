// @ts-check
// Subtle desktop easter eggs: Konami code triggers a brief rainbow glow + secret achievement.

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

/** @param {import('./shell.js').ShellContext} shell */
export function installEasterEggs(shell) {
  const sys = shell.system();
  const { t } = shell;
  let index = 0;

  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === KONAMI[index]) {
      index++;
      if (index === KONAMI.length) {
        index = 0;
        triggerKonami();
      }
    } else {
      index = key === KONAMI[0] ? 1 : 0;
    }
  };

  function triggerKonami() {
    sys.bus.emit('easter-egg:konami', { at: Date.now() });
    document.documentElement.classList.add('nx-rainbow-party');
    setTimeout(() => document.documentElement.classList.remove('nx-rainbow-party'), 2600);
    void sys.notifications.notify({
      title: t('easterEgg.konamiTitle'),
      body: t('easterEgg.konamiBody'),
      icon: 'sparkles',
      silent: true,
    });
  }

  addEventListener('keydown', onKeyDown);
  return () => removeEventListener('keydown', onKeyDown);
}
