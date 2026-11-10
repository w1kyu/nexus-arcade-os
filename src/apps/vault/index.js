// @ts-check
// Nexus Password Vault: master-password AES-GCM encrypted vault,
// password & passphrase generator, RFC 6238 TOTP authenticator, and local security audit.
import { button, h, icon, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import { generateTotp, getTotpRemainingSeconds } from './totp.js';
import { estimateEntropy, generatePassphrase, generatePassword } from './generator.js';
import { auditVaultHealth } from './model.js';
import './styles.css';

/** @typedef {import('./model.js').VaultEntry} VaultEntry */

/**
 * Terminal command handler: `vault [status | totp <title> | generate [length]]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async vault(ctx, io) {
    const credsCol = /** @type {import('../../kernel/types').Collection<VaultEntry>} */ (
      ctx.storage.collection('credentials')
    );
    const configCol = ctx.storage.collection('config');
    const sub = io.args[0] ?? 'status';

    if (sub === 'generate') {
      const len = parseInt(io.args[1] || '16', 10);
      const pass = generatePassword({ length: len });
      const ent = estimateEntropy(pass);
      io.out(`Generated: ${pass} (${ent} bits entropy)\n`);
      return 0;
    }

    if (sub === 'status') {
      const sec = await configCol.get('master');
      const all = await credsCol.all();
      io.out(`--- Password Vault ---\n`);
      io.out(`Master Password Set: ${Boolean(sec?.passwordHash)}\n`);
      io.out(`Total Credentials:   ${all.length}\n`);
      return 0;
    }

    if (sub === 'totp') {
      const title = io.args.slice(1).join(' ').trim();
      if (!title) {
        io.err('Usage: vault totp <title>\n');
        return 1;
      }
      const all = await credsCol.all();
      const target = all.find((e) => e.title.toLowerCase().includes(title.toLowerCase()));
      if (!target || !target.totpSecret) {
        io.err(`No credential with TOTP secret matching "${title}"\n`);
        return 1;
      }
      const token = await generateTotp(target.totpSecret);
      const rem = getTotpRemainingSeconds();
      io.out(`TOTP for ${target.title}: ${token} (${rem}s remaining)\n`);
      return 0;
    }

    io.err(`Unknown subcommand "${sub}". Try: vault [status | totp <title> | generate [length]]\n`);
    return 1;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'vault.generate': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.vault', args: { action: 'generator' } }),
  'vault.lock': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.vault', args: { action: 'lock' } }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  const credsCol = /** @type {import('../../kernel/types').Collection<VaultEntry>} */ (
    ctx.storage.collection('credentials')
  );
  const configCol = ctx.storage.collection('config');

  /** @type {string | null} */
  let activeMasterPassword = null;
  /** @type {string | null} */
  let selectedEntryId = null;
  let isEditing = false;
  let searchQuery = '';

  const container = h('div', { class: 'nx-vault' });
  replace(root, container);

  async function render() {
    /** @type {{ id: string, passwordHash?: import('../../services/crypto.js').SecretHash } | null} */
    const masterConfig = (await configCol.get('master')) ?? null;

    // If master password not set yet, prompt to create one
    if (!masterConfig?.passwordHash) {
      renderSetupMasterPassword();
      return;
    }

    // If locked, render lock screen
    if (!activeMasterPassword) {
      renderLockScreen(masterConfig);
      return;
    }

    const rawCreds = await credsCol.all();
    /** @type {VaultEntry[]} */
    const credentials = [];

    // Decrypt credentials
    for (const raw of rawCreds) {
      if (raw.isEncrypted && raw.encryptedPayload && activeMasterPassword) {
        try {
          const plain = await ctx.crypto.decryptText(raw.encryptedPayload, activeMasterPassword);
          const data = JSON.parse(plain);
          credentials.push({
            ...raw,
            username: data.username ?? raw.username,
            password: data.password ?? '',
            url: data.url ?? raw.url,
            notes: data.notes ?? raw.notes,
            totpSecret: data.totpSecret ?? raw.totpSecret,
          });
        } catch {
          credentials.push(raw);
        }
      } else {
        credentials.push(raw);
      }
    }

    credentials.sort((a, b) => a.title.localeCompare(b.title));

    if (!selectedEntryId && credentials.length > 0) {
      selectedEntryId = credentials[0].id;
    }

    const selectedEntry = credentials.find((e) => e.id === selectedEntryId) ?? credentials[0] ?? null;

    // Toolbar
    const toolbar = h(
      'header',
      { class: 'nx-vault-toolbar' },
      h(
        'div',
        { class: 'nx-vault-toolbar-title' },
        icon('shield', { size: 18 }),
        h('span', { text: ctx.i18n.t('appTitle') }),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        button({
          label: ctx.i18n.t('newEntry'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => {
            selectedEntryId = null;
            isEditing = true;
            render();
          },
        }),
        button({
          label: ctx.i18n.t('generator'),
          icon: 'key',
          onClick: () => showGeneratorModal(),
        }),
        button({
          label: ctx.i18n.t('healthCheck'),
          icon: 'activity',
          onClick: () => showHealthAuditModal(credentials),
        }),
        button({
          label: ctx.i18n.t('lockNow'),
          icon: 'lock',
          onClick: () => {
            activeMasterPassword = null;
            render();
          },
        }),
      ),
    );

    const banner = h(
      'div',
      { class: 'nx-vault-banner' },
      icon('alert-circle', { size: 14 }),
      h('span', { text: ctx.i18n.t('vaultNotice') }),
    );

    // Sidebar
    const filteredCreds = searchQuery
      ? credentials.filter(
          (c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.username?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : credentials;

    const listItems = filteredCreds.map((c) => {
      const isSelected = selectedEntry?.id === c.id && !isEditing;
      return h(
        'div',
        {
          class: `nx-vault-item${isSelected ? ' is-selected' : ''}`,
          onClick: () => {
            selectedEntryId = c.id;
            isEditing = false;
            render();
          },
        },
        h('strong', { style: { fontSize: '13px' }, text: c.title }),
        h('span', {
          style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
          text: c.username || 'No username',
        }),
      );
    });

    const searchIn = h('input', {
      type: 'text',
      class: 'nx-input',
      value: searchQuery,
      placeholder: ctx.i18n.t('search'),
      style: { width: '100%' },
    });
    searchIn.addEventListener('input', (e) => {
      searchQuery = /** @type {HTMLInputElement} */ (e.target).value;
      render();
    });

    const sidebar = h(
      'aside',
      { class: 'nx-vault-sidebar' },
      h('div', { class: 'nx-vault-sidebar-search' }, searchIn),
      h('div', { class: 'nx-vault-entries-list' }, ...listItems),
    );

    // Main area
    const mainPane = h('main', { class: 'nx-vault-main' });

    if (isEditing || !selectedEntry) {
      renderEditor(mainPane, selectedEntry);
    } else {
      renderViewer(mainPane, selectedEntry);
    }

    const body = h('div', { class: 'nx-vault-body' }, sidebar, mainPane);
    replace(container, toolbar, banner, body);
  }

  function renderSetupMasterPassword() {
    let p1 = '',
      p2 = '';
    const errEl = h('div', { style: { color: '#f87171', fontSize: '13px', display: 'none' } });

    const i1 = h('input', {
      type: 'password',
      class: 'nx-input',
      placeholder: ctx.i18n.t('masterPassword'),
      style: { width: '280px' },
    });
    i1.addEventListener('input', (e) => {
      p1 = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const i2 = h('input', {
      type: 'password',
      class: 'nx-input',
      placeholder: ctx.i18n.t('confirmMasterPassword'),
      style: { width: '280px' },
    });
    i2.addEventListener('input', (e) => {
      p2 = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const screen = h(
      'div',
      { class: 'nx-vault-lock-screen' },
      icon('shield', { size: 48 }),
      h('h2', { text: ctx.i18n.t('setMasterPassword') }),
      h('p', { style: { maxWidth: '440px', color: '#ff8a3d', fontSize: '13px' }, text: ctx.i18n.t('warningLoss') }),
      i1,
      i2,
      errEl,
      button({
        label: ctx.i18n.t('save'),
        variant: 'primary',
        onClick: async () => {
          if (!p1 || p1 !== p2) {
            errEl.textContent = ctx.i18n.t('passwordsDoNotMatch');
            errEl.style.display = 'block';
            return;
          }
          const hash = await ctx.crypto.hashSecret(p1);
          await configCol.put({ id: 'master', passwordHash: hash });
          activeMasterPassword = p1;
          render();
        },
      }),
    );

    replace(container, screen);
  }

  function renderLockScreen(masterConfig) {
    let entered = '';
    const passInput = h('input', {
      type: 'password',
      class: 'nx-input',
      placeholder: ctx.i18n.t('masterPassword'),
      style: { width: '260px' },
    });
    passInput.addEventListener('input', (e) => {
      entered = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const errEl = h('div', { style: { color: '#f87171', fontSize: '13px', display: 'none' } });

    async function unlock() {
      if (!entered) return;
      const ok = await ctx.crypto.verifySecret(entered, masterConfig.passwordHash);
      if (ok) {
        activeMasterPassword = entered;
        render();
      } else {
        errEl.textContent = ctx.i18n.t('wrongPassword');
        errEl.style.display = 'block';
      }
    }

    passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void unlock();
    });

    const screen = h(
      'div',
      { class: 'nx-vault-lock-screen' },
      icon('lock', { size: 48 }),
      h('h2', { text: ctx.i18n.t('lockedTitle') }),
      h('p', { style: { color: 'var(--nx-text-muted, #7d8590)', maxWidth: '400px' }, text: ctx.i18n.t('lockedDesc') }),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        passInput,
        button({ label: ctx.i18n.t('unlock'), variant: 'primary', onClick: () => void unlock() }),
      ),
      errEl,
    );

    replace(container, screen);
  }

  /**
   * Helper to copy sensitive password and auto-clear clipboard after 30 seconds.
   * @param {string} text
   */
  function copySensitive(text) {
    navigator.clipboard.writeText(text);
    alert(ctx.i18n.t('copied'));
    setTimeout(() => {
      navigator.clipboard.writeText('');
    }, 30000);
  }

  /**
   * Credential Viewer
   * @param {HTMLElement} host
   * @param {VaultEntry} entry
   */
  async function renderViewer(host, entry) {
    let showPass = false;

    const header = h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('h2', { style: { margin: '0', fontSize: '20px' }, text: entry.title }),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        button({
          label: ctx.i18n.t('editEntry'),
          icon: 'edit',
          onClick: () => {
            isEditing = true;
            render();
          },
        }),
        button({
          icon: 'trash',
          onClick: async () => {
            if (confirm(ctx.i18n.t('confirmDelete'))) {
              await credsCol.delete(entry.id);
              selectedEntryId = null;
              render();
            }
          },
        }),
      ),
    );

    const card = h('div', { class: 'nx-vault-detail-card' });

    // Username
    if (entry.username) {
      card.appendChild(
        h(
          'div',
          { class: 'nx-vault-field' },
          h('span', { class: 'nx-vault-field-label', text: ctx.i18n.t('username') }),
          h(
            'div',
            { class: 'nx-vault-field-val-row' },
            h('span', { text: entry.username }),
            button({ label: ctx.i18n.t('copy'), size: 'small', onClick: () => copySensitive(entry.username || '') }),
          ),
        ),
      );
    }

    // Password
    const passSpan = h('span', { text: '••••••••••••' });
    const eyeBtn = button({
      icon: 'eye',
      size: 'small',
      onClick: () => {
        showPass = !showPass;
        passSpan.textContent = showPass ? entry.password : '••••••••••••';
      },
    });

    card.appendChild(
      h(
        'div',
        { class: 'nx-vault-field' },
        h('span', { class: 'nx-vault-field-label', text: ctx.i18n.t('password') }),
        h(
          'div',
          { class: 'nx-vault-field-val-row' },
          passSpan,
          h(
            'div',
            { style: { display: 'flex', gap: '6px' } },
            eyeBtn,
            button({ label: ctx.i18n.t('copy'), size: 'small', onClick: () => copySensitive(entry.password) }),
          ),
        ),
      ),
    );

    // URL
    if (entry.url) {
      card.appendChild(
        h(
          'div',
          { class: 'nx-vault-field' },
          h('span', { class: 'nx-vault-field-label', text: ctx.i18n.t('url') }),
          h('a', { href: entry.url, target: '_blank', rel: 'noopener', style: { color: '#38bdf8' }, text: entry.url }),
        ),
      );
    }

    // Notes
    if (entry.notes) {
      card.appendChild(
        h(
          'div',
          { class: 'nx-vault-field' },
          h('span', { class: 'nx-vault-field-label', text: ctx.i18n.t('notes') }),
          h('p', { style: { whiteSpace: 'pre-wrap', margin: '0', fontSize: '13px' }, text: entry.notes }),
        ),
      );
    }

    // TOTP Section
    const totpWrap = h('div');
    if (entry.totpSecret) {
      const code = await generateTotp(entry.totpSecret);
      const rem = getTotpRemainingSeconds();

      totpWrap.appendChild(
        h(
          'div',
          { class: 'nx-vault-totp-card' },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('span', {
              style: { fontSize: '11px', fontWeight: '600', color: 'var(--nx-text-muted, #7d8590)' },
              text: ctx.i18n.t('totp'),
            }),
            h('span', { class: 'nx-vault-totp-token', text: code }),
            h('span', {
              style: { fontSize: '11px', color: '#ff8a3d' },
              text: ctx.i18n.t('totpRemaining', { sec: rem }),
            }),
          ),
          button({
            label: ctx.i18n.t('copy'),
            onClick: () => copySensitive(code),
          }),
        ),
      );
    }

    replace(host, header, card, totpWrap);
  }

  /**
   * Credential Editor
   * @param {HTMLElement} host
   * @param {VaultEntry | null} entry
   */
  function renderEditor(host, entry) {
    let titleVal = entry?.title ?? '';
    let userVal = entry?.username ?? '';
    let passVal = entry?.password ?? generatePassword({ length: 16 });
    let urlVal = entry?.url ?? '';
    let notesVal = entry?.notes ?? '';
    let totpVal = entry?.totpSecret ?? '';

    const tIn = h('input', {
      type: 'text',
      class: 'nx-input',
      value: titleVal,
      placeholder: 'e.g. GitHub, University Portal',
    });
    tIn.addEventListener('input', (e) => {
      titleVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const uIn = h('input', { type: 'text', class: 'nx-input', value: userVal, placeholder: 'username or email' });
    uIn.addEventListener('input', (e) => {
      userVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const pIn = h('input', {
      type: 'text',
      class: 'nx-input',
      value: passVal,
      style: { flex: '1', fontFamily: 'monospace' },
    });
    pIn.addEventListener('input', (e) => {
      passVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const genBtn = button({
      label: ctx.i18n.t('generatePassword'),
      icon: 'refresh-cw',
      size: 'small',
      onClick: () => {
        passVal = generatePassword({ length: 18 });
        pIn.value = passVal;
      },
    });

    const urlIn = h('input', { type: 'url', class: 'nx-input', value: urlVal, placeholder: 'https://...' });
    urlIn.addEventListener('input', (e) => {
      urlVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const totpIn = h('input', {
      type: 'text',
      class: 'nx-input',
      value: totpVal,
      placeholder: 'Base32 secret (e.g. JBSWY3DPEHPK3PXP)',
    });
    totpIn.addEventListener('input', (e) => {
      totpVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const notesIn = h('textarea', { class: 'nx-textarea', value: notesVal, style: { height: '80px' } });
    notesIn.addEventListener('input', (e) => {
      notesVal = /** @type {HTMLTextAreaElement} */ (e.target).value;
    });

    const saveBtn = button({
      label: ctx.i18n.t('save'),
      variant: 'primary',
      icon: 'check',
      onClick: async () => {
        if (!titleVal.trim() || !activeMasterPassword) return;
        const id = entry?.id ?? crypto.randomUUID();

        // Encrypt credentials JSON
        const payloadData = JSON.stringify({
          username: userVal.trim(),
          password: passVal,
          url: urlVal.trim(),
          notes: notesVal.trim(),
          totpSecret: totpVal.trim(),
        });
        const encrypted = await ctx.crypto.encrypt(payloadData, activeMasterPassword);

        await credsCol.put({
          id,
          title: titleVal.trim(),
          username: userVal.trim() || undefined,
          password: '', // Never store plaintext password on disk
          url: urlVal.trim() || undefined,
          notes: '',
          totpSecret: '',
          isEncrypted: true,
          encryptedPayload: encrypted,
          createdAt: entry?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        });

        selectedEntryId = id;
        isEditing = false;
        render();
      },
    });

    const cancelBtn = button({
      label: ctx.i18n.t('cancel'),
      variant: 'secondary',
      onClick: () => {
        isEditing = false;
        render();
      },
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('h3', { text: entry ? ctx.i18n.t('editEntry') : ctx.i18n.t('newEntry') }),
        h('div', { style: { display: 'flex', gap: '8px' } }, saveBtn, cancelBtn),
      ),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('title'), tIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('username'), uIn),
      h(
        'label',
        { style: { fontSize: '12px' } },
        ctx.i18n.t('password'),
        h('div', { style: { display: 'flex', gap: '8px' } }, pIn, genBtn),
      ),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('url'), urlIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('totpSecret'), totpIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('notes'), notesIn),
    );

    replace(host, form);
  }

  function showGeneratorModal() {
    let len = 18;
    let pass = generatePassword({ length: len });
    let isPassphrase = false;

    const outIn = h('input', {
      type: 'text',
      class: 'nx-input',
      value: pass,
      style: { width: '100%', fontFamily: 'monospace', fontSize: '14px' },
    });
    const entSpan = h('span', {
      style: { fontSize: '12px', color: '#4ade80' },
      text: ctx.i18n.t('entropy', { bits: estimateEntropy(pass) }),
    });

    function refresh() {
      if (isPassphrase) {
        pass = generatePassphrase(4, ctx.i18n.lang === 'de' ? 'de' : 'en');
      } else {
        pass = generatePassword({ length: len });
      }
      outIn.value = pass;
      entSpan.textContent = ctx.i18n.t('entropy', { bits: estimateEntropy(pass) });
    }

    const modal = openModal({
      title: ctx.i18n.t('generator'),
      content: h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '320px' } },
        outIn,
        entSpan,
        h(
          'div',
          { style: { display: 'flex', gap: '8px' } },
          button({
            label: ctx.i18n.t('generatePassword'),
            onClick: () => {
              isPassphrase = false;
              refresh();
            },
          }),
          button({
            label: ctx.i18n.t('generatePassphrase'),
            onClick: () => {
              isPassphrase = true;
              refresh();
            },
          }),
        ),
      ),
      actions: [
        {
          label: ctx.i18n.t('copy'),
          variant: 'primary',
          onClick: () => {
            copySensitive(outIn.value);
            modal.close();
          },
        },
      ],
    });
  }

  function showHealthAuditModal(credentials) {
    const audit = auditVaultHealth(credentials);
    openModal({
      title: ctx.i18n.t('healthCheck'),
      content: h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '340px' } },
        h(
          'div',
          {
            style: {
              padding: '16px',
              background: 'var(--nx-bg-surface, #1a1d26)',
              borderRadius: '8px',
              textAlign: 'center',
            },
          },
          h('div', {
            style: { fontSize: '32px', fontWeight: '700', color: audit.score > 70 ? '#4ade80' : '#ff8a3d' },
            text: `${audit.score} / 100`,
          }),
          h('div', {
            style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('healthScore', { score: audit.score }),
          }),
        ),
        h('div', { text: `• ${ctx.i18n.t('weakPasswords', { count: audit.weakCount })}` }),
        h('div', { text: `• ${ctx.i18n.t('reusedPasswords', { count: audit.reusedCount })}` }),
        h('div', { text: `• ${ctx.i18n.t('oldPasswords', { count: audit.oldCount })}` }),
      ),
    });
  }

  render();
}
