// @ts-check
// "What's new" release notes modal powered by CHANGELOG.md.
// Shows automatically only after an actual version upgrade (`lastSeenVersion !== currentVersion`),
// and is always accessible via the `shell.whatsNew` command or Settings → Updates.
import { version as APP_VERSION } from '../env.js';
import { h } from '../ui/dom.js';
import { renderMarkdownInto } from '../ui/markdown.js';
import { openModal } from '../ui/overlay.js';
import { registerCommand } from './util.js';

/**
 * Extracts the top release section (or full text if single section) from CHANGELOG.md.
 * @param {string} markdown
 */
export function extractLatestChangelog(markdown) {
  const sections = markdown.split(/\n(?=##\s+\[?v?\d)/);
  if (sections.length <= 1) return markdown;
  const header = sections[0].trim();
  const latest = sections[1].trim();
  return header ? `${header}\n\n${latest}` : latest;
}

/** @param {import('./shell.js').ShellContext} shell */
export function createWhatsNew(shell) {
  const sys = shell.system();
  const { t } = shell;
  const kv = sys.kv('system:whats-new');

  async function show(latestOnly = true) {
    const raw = await sys
      .systemApi('nexus.shell')
      .about.changelog()
      .catch(() => '');
    const md = latestOnly ? extractLatestChangelog(raw) : raw;
    const body = h('div', { class: 'nx-markdown', style: { maxHeight: '62vh', overflowY: 'auto' } });
    await renderMarkdownInto(body, md);
    await openModal({
      title: t('whatsNew.title', { version: APP_VERSION }),
      body,
      actions: [{ label: t('whatsNew.close'), value: true, variant: 'primary' }],
      dismissValue: true,
      size: 'lg',
    });
    await kv.set('lastSeenVersion', APP_VERSION);
  }

  async function checkOnBoot() {
    const prev = await kv.get('lastSeenVersion');
    if (typeof prev !== 'string' || !prev) {
      await kv.set('lastSeenVersion', APP_VERSION);
      return false;
    }
    if (prev !== APP_VERSION) {
      await show(true);
      return true;
    }
    return false;
  }

  registerCommand(sys, {
    id: 'shell.whatsNew',
    title: 'whatsNew.command',
    icon: 'sparkles',
    category: 'shell',
    run: () => show(true),
  });

  return { show, checkOnBoot };
}
