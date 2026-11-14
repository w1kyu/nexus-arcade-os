// Boots the OS into its root element. Shared by both editions; edition-specific work
// (Service Worker) lives in the entry files.
import '../styles/base.css';
import { rememberFastBoot, showBootScreen } from './boot-screen.js';
import { registerShellCommands } from './commands.js';
import { createNotificationCenter } from './center/center.js';
import { createDialogs } from './dialogs/dialogs.js';
import { createDesktop } from './desktop/desktop.js';
import { createWallpaper } from './desktop/wallpaper.js';
import { createWidgetHost } from './widgets/host.js';
import { createDock } from './dock.js';
import { createLauncher } from './launcher/launcher.js';
import { createLockScreen } from './lock/lock.js';
import { createMobileShell } from './mobile/mobile.js';
import { createAnnouncer } from './announcer.js';
import { createPalette } from './palette/palette.js';
import { createShortcutsOverlay } from './shortcuts/shortcuts-overlay.js';
import { createPersonalize } from './personalize/personalize.js';
import { createTour } from './tour/tour.js';
import { createWhatsNew } from './whats-new.js';
import { installEasterEggs } from './easter-eggs.js';
import { registerCommand } from './util.js';
import { createTipsService } from '../services/tips/tips.js';
import { startShell } from './shell.js';
import { pickStrings } from './strings.js';
import { createToastHost } from './toast.js';
import { createTopBar } from './topbar.js';
import { createOverview } from './wm/overview.js';
import { createSwitcher } from './wm/switcher.js';

/** @param {HTMLElement} root */
export function boot(root) {
  const { t, locale } = pickStrings(navigator.languages ?? [navigator.language]);
  document.documentElement.lang = locale;
  const toasts = createToastHost(document.body);

  const bootScreen = showBootScreen(document.body, {
    title: t.bootTitle,
    skip: t.bootSkip,
    safeMode: t.bootSafeMode,
    steps: t.bootSteps,
  });
  const yieldMain = () => new Promise((r) => setTimeout(r, 0));
  const system = startShell(root, {
    onProgress: bootScreen.progress,
    onLog: bootScreen.log,
    beforeLogin: bootScreen.hide,
  })
    .then(async (shell) => {
      const sys = shell.system();
      // Swap the kernel's native fallbacks for the system dialogs (same object, so ctx.dialog and
      // the intents picker pick them up).
      shell.ui.dialogs = createDialogs(shell);
      Object.assign(sys.dialogs, shell.ui.dialogs);
      sys.permissions.setAsk((appId, permission) => shell.ui.dialogs.askPermission(appId, permission));
      shell.ui.wallpaper = createWallpaper(shell);
      shell.ui.desktop = createDesktop(shell);
      shell.ui.widgets = createWidgetHost(shell);
      shell.ui.topbar = createTopBar(shell);
      shell.ui.dock = createDock(shell);
      await yieldMain();
      registerShellCommands(shell);
      shell.ui.palette = createPalette(shell);
      shell.ui.launcher = createLauncher(shell);
      shell.ui.center = createNotificationCenter(shell);
      shell.ui.personalize = createPersonalize(shell);
      shell.ui.overview = createOverview(shell);
      shell.ui.switcher = createSwitcher(shell);
      shell.ui.lock = createLockScreen(shell);
      shell.ui.shortcuts = createShortcutsOverlay(shell);
      await yieldMain();
      shell.ui.mobile = createMobileShell(shell);
      shell.ui.announcer = createAnnouncer(shell);
      shell.ui.tour = createTour(shell);
      shell.ui.whatsNew = createWhatsNew(shell);
      installEasterEggs(shell);
      registerCommand(sys, {
        id: 'shell.demoProfile',
        title: 'demo.command',
        icon: 'sparkles',
        category: 'shell',
        run: async () => {
          const created = await sys.profiles.create({ name: shell.t('demo.profileName'), demo: true });
          const kernel = /** @type {any} */ (shell).kernel;
          if (kernel?.systemKv) await kernel.systemKv.set('lastProfile', created.id);
          await shell.session.save();
          location.reload();
        },
      });
      rememberFastBoot(!!sys.settings.get('system', 'fastBoot'));
      sys.settings.onChange('system', 'fastBoot', (on) => rememberFastBoot(!!on));
      void bootScreen.done();
      shell.wm.relayout();
      await yieldMain();
      if (!shell.wm.list().length && !shell.session.data.windows.length) void shell.launch('nexus.welcome');
      void shell.ui.whatsNew.checkOnBoot().catch(() => {});
      const tips = createTipsService({
        kv: sys.kv('system:tips'),
        settings: sys.settings,
        notifications: sys.notifications,
        executeCommand: (id, args) => sys.commands.execute(id, args),
        text: (k, vars) => shell.t(k, vars),
        profileCreatedAt: sys.profile.createdAt,
      });
      setTimeout(() => void tips.maybeShowTip().catch(() => {}), 2500);
      showNotificationToasts(sys, toasts, t.dismiss);
      if (import.meta.env.DEV) void wireDebugScreen(sys);
      document.documentElement.dataset.kernel = 'ready';
      document.documentElement.dataset.storage = sys.engine.kind;
      document.documentElement.dataset.search = sys.search.backendKind;
      return sys;
    })
    .catch((error) => {
      document.documentElement.dataset.kernel = 'failed';
      bootScreen.hide();
      console.error('Nexus could not start', error);
      throw error;
    });

  return {
    t,
    system,
    /** @param {Omit<import('./toast.js').ToastOptions, 'dismissLabel'>} options */
    toast: (options) => toasts.show({ ...options, dismissLabel: t.dismiss }),
  };
}

/**
 * Shows the notification service's toasts.
 * @param {import('../kernel/system.js').System} system
 * @param {ReturnType<typeof createToastHost>} toasts
 * @param {string} dismissLabel
 */
function showNotificationToasts(system, toasts, dismissLabel) {
  /** @type {Map<string, () => void>} */
  const open = new Map();
  system.bus.on('notification:shown', (n) => {
    const action = n.actions[0];
    const close = toasts.show({
      message: n.title,
      body: n.body,
      timeoutMs: n.timeoutMs,
      dismissLabel,
      action: action && { label: action.label, run: () => system.notifications.triggerAction(n.id, action.id) },
    });
    open.set(n.id, close);
  });
  system.bus.on('notification:closed', ({ id }) => {
    open.get(id)?.();
    open.delete(id);
  });
}

/**
 * Dev builds: the kernel debug screen opens over the shell with #debug or a command.
 * @param {import('../kernel/system.js').System} sys
 */
async function wireDebugScreen(sys) {
  const open = async () => {
    const { renderDebugScreen } = await import('../dev/debug.js');
    renderDebugScreen(document.body, sys);
  };
  sys.commands.register({ id: 'dev.debug', title: 'Kernel debug screen (dev)', icon: 'flask', run: open });
  addEventListener('hashchange', () => location.hash === '#debug' && void open());
  if (location.hash === '#debug') await open();
}
