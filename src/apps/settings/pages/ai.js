// @ts-check
// Settings page for AI Workspace: providers, encryption, diagnostics, and RAG knowledge.
import { h, icon } from '../../../ui/dom.js';
import { group, infoRow } from '../form.js';

/** @type {import('./types.js').Page} */
export const ai = {
  id: 'ai',
  icon: 'bot',
  keys: [],
  async render(pc) {
    const { ctx } = pc;
    const aiService = ctx.ai;

    if (!aiService) {
      return [infoRow('AI Service', 'AI Service is not available in this context.')];
    }

    const profiles = await aiService.listProfiles();
    const activeProfile = await aiService.getActiveProfile();
    const stats = aiService.getStats();
    const ragStatus = await aiService.rag?.getStatus();

    /** @type {Map<string, { status: string, message: string, details?: string }>} */
    const testResults = new Map();

    // ─── 1. Active Provider Group ──────────────────────────────────────
    const activeSelect = h(
      'select',
      {
        id: 'ai-active-provider-select',
        class: 'nx-select',
        dataset: { testid: 'settings-active-provider' },
        onchange: async (e) => {
          const id = /** @type {HTMLSelectElement} */ (e.target).value;
          await aiService.setActiveProfile(id);
          pc.toast('Active AI provider updated');
          pc.refresh();
        },
      },
      ...profiles.map((p) =>
        h('option', { value: p.id, selected: activeProfile?.id === p.id }, `${p.name} (${p.type})`),
      ),
    );

    const activeToggle = h('input', {
      type: 'checkbox',
      role: 'switch',
      checked: activeProfile?.enabled ?? false,
      dataset: { testid: 'settings-active-toggle' },
      onchange: async (e) => {
        if (!activeProfile) return;
        activeProfile.enabled = /** @type {HTMLInputElement} */ (e.target).checked;
        await aiService.saveProfile(activeProfile);
        pc.toast(activeProfile.enabled ? 'AI Provider enabled' : 'AI Provider disabled');
        pc.refresh();
      },
    });

    const activeRow = infoRow(
      'Active Provider Profile',
      activeProfile
        ? `${activeProfile.baseUrl} · Model: ${activeProfile.defaultModel || 'Default'}`
        : 'No active profile',
      h('label', { class: 'nx-toggle nx-set-switch' }, activeToggle, h('span')),
      activeSelect,
    );

    // ─── 2. Saved Provider Profiles List ──────────────────────────────
    const profileCards = [];
    for (const p of profiles) {
      const diag = testResults.get(p.id);

      const testBtn = h(
        'button',
        {
          type: 'button',
          class: 'nx-btn',
          dataset: { testid: `btn-test-profile-${p.id}` },
          onclick: async (e) => {
            const btn = /** @type {HTMLButtonElement} */ (e.target);
            btn.disabled = true;
            btn.textContent = 'Testing...';
            try {
              const res = await aiService.testConnection(p.id);
              testResults.set(p.id, res);
              pc.toast(res.message);
            } catch (err) {
              const error = /** @type {Error} */ (err);
              testResults.set(p.id, { status: 'error', message: error.message });
            } finally {
              btn.disabled = false;
              btn.textContent = 'Test';
              pc.refresh();
            }
          },
        },
        'Test',
      );

      const editBtn = h(
        'button',
        {
          type: 'button',
          class: 'nx-btn',
          onclick: () => showEditProfileModal(p),
        },
        'Edit',
      );

      const deleteBtn = h(
        'button',
        {
          type: 'button',
          class: 'nx-btn is-danger',
          onclick: async () => {
            const confirmed = await pc.confirm(`Delete provider profile "${p.name}"?`, { danger: true });
            if (confirmed) {
              await aiService.deleteProfile(p.id);
              pc.toast(`Profile "${p.name}" deleted`);
              pc.refresh();
            }
          },
        },
        'Delete',
      );

      const statusBadge = diag
        ? h(
            'div',
            {
              style: `margin-top: 6px; padding: 6px 10px; border-radius: 4px; font-size: 12px; font-family: monospace; ${
                diag.status === 'ok'
                  ? 'background: rgba(34, 197, 94, 0.15); color: #4ade80;'
                  : 'background: rgba(239, 68, 68, 0.15); color: #f87171;'
              }`,
            },
            `${diag.status.toUpperCase()}: ${diag.message}${diag.details ? ` (${diag.details})` : ''}`,
          )
        : null;

      profileCards.push(
        h(
          'div',
          { class: 'nx-set-row nx-ai-profile-card' },
          h(
            'div',
            { class: 'nx-set-text' },
            h('span', { class: 'nx-set-label', text: p.name }),
            h(
              'p',
              { class: 'nx-set-desc' },
              `${p.type.toUpperCase()} · ${p.baseUrl} · Key: ${p.hasKey ? '•••••••• (Encrypted)' : 'None'} · ${p.enabled ? 'Enabled' : 'Disabled'}`,
            ),
            statusBadge,
          ),
          h('div', { class: 'nx-set-control' }, testBtn, editBtn, deleteBtn),
        ),
      );
    }

    const addProfileBtn = h(
      'button',
      {
        type: 'button',
        class: 'nx-btn is-primary',
        style: 'margin-top: 8px;',
        dataset: { testid: 'btn-add-profile' },
        onclick: () => showAddProfileModal(),
      },
      icon('plus', { size: 14 }),
      'Add Provider Profile',
    );

    // ─── 3. Knowledge Base (RAG) ───────────────────────────────────────
    const ragInfo = infoRow(
      'Notes Vector Index (RAG)',
      ragStatus
        ? `${ragStatus.chunkCount} chunks indexed across ${ragStatus.documentCount} notes. Last updated: ${ragStatus.lastIndexedAt ? new Date(ragStatus.lastIndexedAt).toLocaleString() : 'Never'}`
        : 'RAG indexer ready',
      h(
        'button',
        {
          type: 'button',
          class: 'nx-btn',
          dataset: { testid: 'btn-index-notes' },
          onclick: async (e) => {
            const btn = /** @type {HTMLButtonElement} */ (e.target);
            btn.disabled = true;
            btn.textContent = 'Indexing...';
            try {
              const res = await aiService.rag.indexFolder(pc.ctx.fs, '/Notes');
              pc.toast(`Indexed ${res.indexedDocs} notes (${res.indexedChunks} chunks)`);
            } catch (err) {
              const error = /** @type {Error} */ (err);
              pc.toast(`Indexing failed: ${error.message}`);
            } finally {
              btn.disabled = false;
              btn.textContent = 'Index Notes';
              pc.refresh();
            }
          },
        },
        'Index Notes',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'nx-btn is-danger',
          onclick: async () => {
            await aiService.rag.clearIndex();
            pc.toast('Notes vector index cleared');
            pc.refresh();
          },
        },
        'Clear Index',
      ),
    );

    // ─── 4. Privacy & Statistics ───────────────────────────────────────
    const privacyNotice = infoRow(
      'Device Security & Privacy',
      'API keys are encrypted at rest with an on-device key and never sent to logs or backups. Prompt queries are dispatched directly from your browser to your configured AI server URL only.',
    );

    const statsInfo = infoRow(
      'Usage Statistics',
      `Total requests: ${stats.totalRequests} · Tokens in: ${stats.totalTokensIn} · Tokens out: ${stats.totalTokensOut} · Avg latency: ${stats.averageLatencyMs}ms`,
    );

    // ─── Modals for Add / Edit Profile ─────────────────────────────────
    function showAddProfileModal() {
      showProfileForm({
        id: `profile-${Date.now()}`,
        name: 'New Provider',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3:latest',
        enabled: true,
      });
    }

    async function showEditProfileModal(profile) {
      const fullProfile = await aiService.getProfile(profile.id);
      showProfileForm(fullProfile || profile);
    }

    function showProfileForm(initial) {
      const nameInput = h('input', { id: 'ai-profile-name', class: 'nx-input', value: initial.name || '' });
      const typeSelect = h(
        'select',
        { id: 'ai-profile-type', class: 'nx-select' },
        h('option', { value: 'ollama', selected: initial.type === 'ollama' }, 'Ollama (Native API)'),
        h('option', { value: 'openai', selected: initial.type === 'openai' }, 'OpenAI / LM Studio / OpenRouter'),
        h('option', { value: 'lemonade', selected: initial.type === 'lemonade' }, 'Lemonade'),
        h('option', { value: 'anthropic', selected: initial.type === 'anthropic' }, 'Anthropic Claude'),
      );
      const urlInput = h('input', { id: 'ai-profile-endpoint', class: 'nx-input', value: initial.baseUrl || '' });
      const keyInput = h('input', {
        id: 'ai-profile-key',
        class: 'nx-input',
        type: 'password',
        placeholder: initial.apiKey ? '••••••••' : 'Enter API key (stored encrypted)',
        value: initial.apiKey || '',
      });
      const modelInput = h('input', { id: 'ai-profile-model', class: 'nx-input', value: initial.defaultModel || '' });
      const enabledCheckbox = h('input', { type: 'checkbox', checked: initial.enabled });

      const testResultEl = h('div', {
        id: 'ai-test-result',
        style: 'font-size: 12px; margin-top: 4px;',
      });

      const testBtn = h(
        'button',
        {
          type: 'button',
          class: 'nx-btn',
          onclick: async () => {
            testBtn.disabled = true;
            testBtn.textContent = 'Testing...';
            try {
              const tempProfile = {
                id: initial.id || 'temp',
                name: nameInput.value.trim(),
                type: /** @type {any} */ (typeSelect.value),
                baseUrl: urlInput.value.trim(),
                rawApiKey: keyInput.value.trim() === '••••••••' ? undefined : keyInput.value.trim(),
                defaultModel: modelInput.value.trim(),
                enabled: true,
              };
              // Save temporarily to test or test connection
              await aiService.saveProfile(tempProfile);
              const res = await aiService.testConnection(tempProfile.id);
              testResultEl.textContent = `${res.message}${res.details ? ` (${res.details})` : ''}`;
              testResultEl.style.color =
                res.status === 'ok' ? 'var(--color-success, #4ade80)' : 'var(--color-danger, #f87171)';
            } catch (err) {
              const error = /** @type {Error} */ (err);
              testResultEl.textContent = `Error: ${error.message}`;
              testResultEl.style.color = 'var(--color-danger, #f87171)';
            } finally {
              testBtn.disabled = false;
              testBtn.textContent = 'Test Connection';
            }
          },
        },
        'Test Connection',
      );

      const backdrop = h(
        'div',
        {
          class: 'nx-dialog-backdrop',
          style:
            'position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;',
        },
        h(
          'div',
          {
            class: 'nx-dialog',
            style:
              'background: var(--bg-surface, #202028); padding: 20px; border-radius: 10px; width: 440px; display: flex; flex-direction: column; gap: 12px; border: 1px solid rgba(255,255,255,0.1);',
          },
          h('h3', { style: 'margin: 0; font-size: 16px;' }, initial.id ? 'Edit AI Provider' : 'Add AI Provider'),
          h('label', { style: 'font-size: 12px;' }, 'Name:'),
          nameInput,
          h('label', { style: 'font-size: 12px;' }, 'Provider Type:'),
          typeSelect,
          h('label', { style: 'font-size: 12px;' }, 'Base URL:'),
          urlInput,
          h('label', { style: 'font-size: 12px;' }, 'API Key (Encrypted at rest):'),
          keyInput,
          h('label', { style: 'font-size: 12px;' }, 'Default Model:'),
          modelInput,
          h(
            'label',
            { style: 'font-size: 12px; display: flex; align-items: center; gap: 6px;' },
            enabledCheckbox,
            'Enabled',
          ),
          h(
            'div',
            { style: 'display: flex; align-items: center; justify-content: space-between; margin-top: 10px;' },
            testBtn,
            h(
              'div',
              { style: 'display: flex; gap: 8px;' },
              h(
                'button',
                {
                  class: 'nx-btn',
                  onclick: () => backdrop.remove(),
                },
                'Cancel',
              ),
              h(
                'button',
                {
                  class: 'nx-btn is-primary',
                  onclick: async () => {
                    const rawKey = keyInput.value.trim();
                    await aiService.saveProfile({
                      id: initial.id,
                      name: nameInput.value.trim() || 'AI Provider',
                      type: /** @type {any} */ (typeSelect.value),
                      baseUrl: urlInput.value.trim(),
                      rawApiKey: rawKey === '••••••••' ? undefined : rawKey,
                      defaultModel: modelInput.value.trim(),
                      enabled: enabledCheckbox.checked,
                    });
                    backdrop.remove();
                    pc.toast('Provider profile saved');
                    pc.refresh();
                  },
                },
                'Save Profile',
              ),
            ),
          ),
          testResultEl,
        ),
      );

      document.body.appendChild(backdrop);
    }

    const profilesGroup = group('Configured Provider Profiles', ...profileCards, addProfileBtn);
    profilesGroup.dataset.setting = 'ai-profiles';

    return [
      group('Active AI Provider', activeRow),
      profilesGroup,
      group('Knowledge Base (RAG)', ragInfo),
      group('Security & Telemetry', privacyNotice, statsInfo),
    ];
  },
};
