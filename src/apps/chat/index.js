// @ts-check
// AI Chat: Universal conversational interface for local and remote models,
// streaming, branching, personas, prompt templates, RAG citations, OS tools, and code assistant.

import { h, icon, iconButton, replace } from '../../ui/dom.js';
import { renderMarkdownInto } from '../../ui/markdown.js';
import './styles.css';
import { DEFAULT_PERSONAS, DEFAULT_TEMPLATES, extractVariables, interpolateTemplate } from './templates.js';

/**
 * @typedef {object} MessageRecord
 * @property {string} id
 * @property {string} conversationId
 * @property {'user' | 'assistant' | 'system' | 'tool'} role
 * @property {string} content
 * @property {string} [model]
 * @property {number} createdAt
 * @property {any[]} [branches]  alternative versions of this message
 * @property {number} [branchIndex]
 * @property {any[]} [attachments]
 * @property {any[]} [citations]
 * @property {any} [toolCall]
 * @property {boolean} [toolApproved]
 * @property {string} [toolOutput]
 * @property {any} [stats]
 */

/**
 * @typedef {object} ConversationRecord
 * @property {string} id
 * @property {string} title
 * @property {string} [folder]
 * @property {boolean} [pinned]
 * @property {boolean} [archived]
 * @property {string} [model]
 * @property {string} [personaId]
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {object} [parameters]
 * @property {boolean} [allowReadOnlyTools]
 */

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'chat.open': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.chat' }),
  'chat.new': (ctx) =>
    ctx.commands.execute('shell.launchApp', {
      appId: 'nexus.chat',
      args: { newChat: true },
    }),
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ vars = {}) => ctx.i18n.t(key, vars);

  // Collections
  const convCollection = ctx.storage.collection('conversations');
  const msgCollection = ctx.storage.collection('messages');

  // State
  /** @type {ConversationRecord[]} */
  let conversations = [];
  /** @type {ConversationRecord | null} */
  let activeConv = null;
  /** @type {MessageRecord[]} */
  let messages = [];

  let isStreaming = false;
  /** @type {AbortController | null} */
  let activeAbort = null;
  let showParameters = false;
  let useNotes = false;
  let compareMode = false;
  let codePanel = false;
  let codeContent = '// Code assistant panel\nfunction calculate(n) {\n  return n * 2;\n}\n';

  /** @type {Array<{ name: string, type: string, content: string }>} */
  let attachments = [];
  /** @type {Array<{ id: string, name: string }>} */
  let availableModels = [];

  let searchQuery = '';
  let speechRec = null;
  let isListening = false;

  // Root elements
  const root = h('div', { class: 'nx-chat', dataset: { testid: 'ai-chat' } });
  const sidebar = h('aside', { class: 'nx-chat-sidebar', 'aria-label': 'Chat history' });
  const main = h('main', { class: 'nx-chat-main' });

  // ─── Initialize Data ────────────────────────────────────────────────
  async function init() {
    await loadConversations();

    // Check if newChat was requested in args
    if (args?.newChat || conversations.length === 0) {
      await createNewConversation();
    } else {
      await selectConversation(conversations[0].id);
    }

    // Refresh model list from active provider
    if (ctx.ai.isAvailable()) {
      try {
        const models = await ctx.ai.listModels();
        availableModels = models.map((m) => ({ id: m.id, name: m.name || m.id }));
      } catch {
        // Fallback models if offline
        availableModels = [{ id: 'default', name: 'Default Model' }];
      }
    }

    render();

    // Listen for AI availability changes
    ctx.ai.onAvailabilityChange?.(() => {
      void init();
    });
  }

  async function loadConversations() {
    try {
      const list = await convCollection.all();
      conversations = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
      conversations = [];
    }
  }

  async function createNewConversation(initialTitle = '') {
    const activeProfile = await ctx.ai.getActiveProfile?.();
    const newConv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: initialTitle || t('sidebar.untitled'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      archived: false,
      model: activeProfile?.defaultModel || 'default',
      personaId: 'nexus',
      parameters: {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        systemPrompt: '',
      },
      allowReadOnlyTools: false,
    };

    await convCollection.put(newConv);
    conversations.unshift(newConv);
    await selectConversation(newConv.id);
  }

  async function selectConversation(id) {
    activeConv = conversations.find((c) => c.id === id) || null;
    if (activeConv) {
      try {
        const msgs = (await msgCollection.all()).filter((m) => m.conversationId === id);
        messages = msgs.sort((a, b) => a.createdAt - b.createdAt);
      } catch {
        messages = [];
      }
    } else {
      messages = [];
    }
    render();
  }

  // ─── Rendering Functions ───────────────────────────────────────────
  function render() {
    renderSidebar();
    renderMain();
    replace(container, root);
  }

  function renderSidebar() {
    sidebar.innerHTML = '';

    const newBtn = h(
      'button',
      {
        class: 'nx-chat-new-btn',
        dataset: { testid: 'btn-new-chat' },
        onclick: () => createNewConversation(),
      },
      icon('plus', { size: 14 }),
      t('actions.newChat'),
    );

    const searchInput = h('input', {
      type: 'search',
      class: 'nx-chat-sidebar-search',
      placeholder: t('sidebar.search'),
      value: searchQuery,
      oninput: (e) => {
        searchQuery = /** @type {HTMLInputElement} */ (e.target).value.toLowerCase();
        renderSidebar();
      },
    });

    const listContainer = h('div', { class: 'nx-chat-list' });

    const filtered = conversations.filter((c) => !searchQuery || c.title.toLowerCase().includes(searchQuery));
    const pinned = filtered.filter((c) => c.pinned && !c.archived);
    const recent = filtered.filter((c) => !c.pinned && !c.archived);

    if (pinned.length > 0) {
      listContainer.appendChild(h('div', { class: 'nx-chat-section-label' }, t('sidebar.pinned')));
      for (const conv of pinned) {
        listContainer.appendChild(renderConvItem(conv));
      }
    }

    if (recent.length > 0) {
      if (pinned.length > 0) {
        listContainer.appendChild(h('div', { class: 'nx-chat-section-label' }, t('sidebar.recent')));
      }
      for (const conv of recent) {
        listContainer.appendChild(renderConvItem(conv));
      }
    }

    if (filtered.length === 0) {
      listContainer.appendChild(
        h('div', { class: 'nx-text-muted', style: 'padding: 12px; font-size: 13px;' }, t('sidebar.empty')),
      );
    }

    replace(sidebar, h('div', { class: 'nx-chat-sidebar-header' }, newBtn), searchInput, listContainer);
  }

  function renderConvItem(conv) {
    const isActive = activeConv?.id === conv.id;
    const item = h(
      'div',
      {
        class: `nx-chat-item${isActive ? ' active' : ''}`,
        dataset: { testid: `conv-item-${conv.id}` },
        onclick: () => selectConversation(conv.id),
      },
      h('span', { class: 'nx-chat-item-title' }, conv.title),
      h(
        'div',
        { class: 'nx-chat-item-actions' },
        iconButton({
          icon: conv.pinned ? 'pin-off' : 'pin',
          label: conv.pinned ? t('actions.unpin') : t('actions.pin'),
          size: 12,
          onClick: async (e) => {
            e.stopPropagation();
            conv.pinned = !conv.pinned;
            await convCollection.update(conv.id, { pinned: conv.pinned });
            renderSidebar();
          },
        }),
        iconButton({
          icon: 'trash',
          label: t('actions.delete'),
          size: 12,
          onClick: async (e) => {
            e.stopPropagation();
            const confirmed = await ctx.dialog.confirm(`Delete conversation "${conv.title}"?`, {
              title: t('actions.delete'),
              danger: true,
            });
            if (confirmed) {
              await convCollection.delete(conv.id);
              const msgsToDelete = (await msgCollection.all()).filter((m) => m.conversationId === conv.id);
              await Promise.all(msgsToDelete.map((m) => msgCollection.delete(m.id)));
              conversations = conversations.filter((c) => c.id !== conv.id);
              if (activeConv?.id === conv.id) {
                if (conversations.length > 0) {
                  await selectConversation(conversations[0].id);
                } else {
                  await createNewConversation();
                }
              } else {
                renderSidebar();
              }
            }
          },
        }),
      ),
    );
    return item;
  }

  function renderMain() {
    main.innerHTML = '';

    // If AI is not available, show honest empty state
    if (!ctx.ai.isAvailable()) {
      main.appendChild(renderEmptyState());
      replace(root, sidebar, main);
      return;
    }

    // Topbar
    const topbar = renderTopbar();
    main.appendChild(topbar);

    // Parameters Drawer (if toggled)
    if (showParameters && activeConv) {
      main.appendChild(renderParametersDrawer());
    }

    // Workspace (Messages + optional Side Code Panel)
    const workspace = h('div', { class: 'nx-chat-workspace' });
    const messagesPane = renderMessagesContainer();
    workspace.appendChild(messagesPane);

    if (codePanel) {
      const sidePanel = renderSideCodePanel();
      workspace.appendChild(sidePanel);
    }

    main.appendChild(workspace);

    // Input Bar
    const inputArea = renderInputArea();
    main.appendChild(inputArea);

    replace(root, sidebar, main);
  }

  function renderEmptyState() {
    return h(
      'div',
      { class: 'nx-chat-empty-state', dataset: { testid: 'empty-ai-state' } },
      icon('bot', { class: 'nx-chat-empty-icon' }),
      h('h2', { class: 'nx-chat-empty-title' }, t('emptyState.title')),
      h('p', { class: 'nx-chat-empty-subtitle' }, t('emptyState.subtitle')),
      h(
        'div',
        { class: 'nx-chat-empty-guides' },
        h('div', { class: 'nx-chat-empty-guide-card' }, t('emptyState.ollamaGuide')),
        h('div', { class: 'nx-chat-empty-guide-card' }, t('emptyState.openaiGuide')),
      ),
      h(
        'button',
        {
          class: 'nx-chat-empty-btn',
          dataset: { testid: 'btn-configure-ai' },
          onclick: () => {
            void ctx.commands.execute('settings.open', { page: 'ai' });
          },
        },
        t('emptyState.button'),
      ),
    );
  }

  function renderTopbar() {
    const left = h('div', { class: 'nx-chat-topbar-left' });
    if (activeConv) {
      const titleInput = h('input', {
        type: 'text',
        class: 'nx-chat-title-input',
        value: activeConv.title,
        onchange: async (e) => {
          if (!activeConv) return;
          activeConv.title = /** @type {HTMLInputElement} */ (e.target).value;
          activeConv.updatedAt = Date.now();
          await convCollection.update(activeConv.id, { title: activeConv.title, updatedAt: activeConv.updatedAt });
          renderSidebar();
        },
      });
      left.appendChild(titleInput);
    }

    const right = h('div', { class: 'nx-chat-topbar-right' });

    // Model Selector
    const modelSelect = h(
      'select',
      {
        class: 'nx-chat-select',
        dataset: { testid: 'select-model' },
        onchange: async (e) => {
          if (!activeConv) return;
          activeConv.model = /** @type {HTMLSelectElement} */ (e.target).value;
          await convCollection.update(activeConv.id, { model: activeConv.model });
        },
      },
      ...availableModels.map((m) => h('option', { value: m.id, selected: activeConv?.model === m.id }, m.name)),
    );
    right.appendChild(modelSelect);

    // Persona Selector
    const personaSelect = h(
      'select',
      {
        class: 'nx-chat-select',
        dataset: { testid: 'select-persona' },
        onchange: async (e) => {
          if (!activeConv) return;
          activeConv.personaId = /** @type {HTMLSelectElement} */ (e.target).value;
          await convCollection.update(activeConv.id, { personaId: activeConv.personaId });
        },
      },
      ...DEFAULT_PERSONAS.map((p) => h('option', { value: p.id, selected: activeConv?.personaId === p.id }, p.name)),
    );
    right.appendChild(personaSelect);

    // Toggles
    const paramBtn = h(
      'button',
      {
        class: `nx-chat-btn-toggle${showParameters ? ' active' : ''}`,
        onclick: () => {
          showParameters = !showParameters;
          renderMain();
        },
      },
      icon('sliders', { size: 13 }),
      t('toolbar.parameters'),
    );
    right.appendChild(paramBtn);

    const ragBtn = h(
      'button',
      {
        class: `nx-chat-btn-toggle${useNotes ? ' active' : ''}`,
        dataset: { testid: 'toggle-rag' },
        onclick: () => {
          useNotes = !useNotes;
          renderMain();
        },
      },
      icon('book', { size: 13 }),
      t('toolbar.useNotes'),
    );
    right.appendChild(ragBtn);

    const compareBtn = h(
      'button',
      {
        class: `nx-chat-btn-toggle${compareMode ? ' active' : ''}`,
        dataset: { testid: 'toggle-compare' },
        onclick: () => {
          compareMode = !compareMode;
          renderMain();
        },
      },
      icon('columns', { size: 13 }),
      t('toolbar.compare'),
    );
    right.appendChild(compareBtn);

    const codeBtn = h(
      'button',
      {
        class: `nx-chat-btn-toggle${codePanel ? ' active' : ''}`,
        dataset: { testid: 'toggle-code-panel' },
        onclick: () => {
          codePanel = !codePanel;
          renderMain();
        },
      },
      icon('code', { size: 13 }),
      t('toolbar.codePanel'),
    );
    right.appendChild(codeBtn);

    // Export Dropdown
    const exportBtn = iconButton({
      icon: 'download',
      label: t('actions.export'),
      onClick: () => {
        showExportMenu();
      },
    });
    right.appendChild(exportBtn);

    // Settings Button
    const settingsBtn = iconButton({
      icon: 'settings',
      label: t('actions.settings'),
      onClick: () => {
        ctx.commands.execute('shell.launchApp', {
          appId: 'nexus.settings',
          args: { intent: { action: 'open', type: 'application/x-nexus-settings', data: { page: 'ai' } } },
        });
      },
    });
    right.appendChild(settingsBtn);

    return h('div', { class: 'nx-chat-topbar' }, left, right);
  }

  function renderParametersDrawer() {
    if (!activeConv) return h('div');
    const params = activeConv.parameters || {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      systemPrompt: '',
    };

    const tempCol = h(
      'div',
      { class: 'nx-chat-param-col' },
      h('label', {}, t('parameters.temperature', { val: params.temperature })),
      h('input', {
        type: 'range',
        min: '0.0',
        max: '2.0',
        step: '0.05',
        value: String(params.temperature),
        oninput: async (e) => {
          params.temperature = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
          await convCollection.update(activeConv.id, { parameters: params });
          renderMain();
        },
      }),
    );

    const topPCol = h(
      'div',
      { class: 'nx-chat-param-col' },
      h('label', {}, t('parameters.topP', { val: params.topP })),
      h('input', {
        type: 'range',
        min: '0.1',
        max: '1.0',
        step: '0.05',
        value: String(params.topP),
        oninput: async (e) => {
          params.topP = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
          await convCollection.update(activeConv.id, { parameters: params });
          renderMain();
        },
      }),
    );

    const promptCol = h(
      'div',
      { class: 'nx-chat-param-col', style: 'grid-column: span 2;' },
      h('label', {}, t('parameters.systemPrompt')),
      h('textarea', {
        placeholder: 'Custom system instructions for this chat...',
        value: params.systemPrompt || '',
        onchange: async (e) => {
          params.systemPrompt = /** @type {HTMLTextAreaElement} */ (e.target).value;
          await convCollection.update(activeConv.id, { parameters: params });
        },
      }),
    );

    return h('div', { class: 'nx-chat-drawer' }, tempCol, topPCol, promptCol);
  }

  function renderMessagesContainer() {
    const listEl = h('div', { class: 'nx-chat-messages', dataset: { testid: 'messages-list' } });

    if (messages.length === 0) {
      listEl.appendChild(
        h(
          'div',
          { class: 'nx-text-muted', style: 'margin: auto; text-align: center;' },
          icon('message-square', { size: 36, style: 'margin-bottom: 8px; opacity: 0.5;' }),
          h('div', {}, 'Send a message to start conversation.'),
        ),
      );
      return listEl;
    }

    for (const msg of messages) {
      const msgEl = renderMessageBubble(msg);
      listEl.appendChild(msgEl);
    }

    // Auto-scroll to bottom
    setTimeout(() => {
      listEl.scrollTop = listEl.scrollHeight;
    }, 10);

    return listEl;
  }

  function renderMessageBubble(msg) {
    const isUser = msg.role === 'user';
    const containerEl = h('div', {
      class: `nx-chat-msg ${msg.role}`,
      dataset: { testid: `message-${msg.id}`, role: msg.role },
    });

    const headerEl = h(
      'div',
      { class: 'nx-chat-msg-header' },
      icon(isUser ? 'user' : 'bot', { size: 12 }),
      h('span', {}, isUser ? 'You' : msg.model || 'Assistant'),
    );
    containerEl.appendChild(headerEl);

    const bubbleEl = h('div', { class: 'nx-chat-msg-bubble nx-chat-msg-body' });

    // Render markdown content
    if (isUser) {
      bubbleEl.textContent = msg.content;
    } else {
      void renderMarkdownInto(bubbleEl, msg.content);

      // Attach "Apply to Code panel" button to code blocks
      setTimeout(() => {
        const pres = bubbleEl.querySelectorAll('pre');
        pres.forEach((pre) => {
          if (pre.querySelector('.nx-apply-code-btn')) return;
          const applyBtn = h(
            'button',
            {
              class: 'nx-apply-code-btn',
              style:
                'position: absolute; top: 6px; right: 6px; font-size: 11px; padding: 2px 6px; background: rgba(99,102,241,0.2); border: 1px solid #6366f1; color: #fff; border-radius: 4px; cursor: pointer;',
              onclick: () => {
                const code = pre.querySelector('code')?.textContent || pre.textContent || '';
                codeContent = code;
                codePanel = true;
                renderMain();
              },
            },
            'Apply to Code',
          );
          pre.style.position = 'relative';
          pre.appendChild(applyBtn);
        });
      }, 50);
    }

    // Attachments (if user message had attachments)
    if (msg.attachments && msg.attachments.length > 0) {
      const attachRow = h('div', { class: 'nx-chat-attachments-preview', style: 'margin-bottom: 6px;' });
      for (const a of msg.attachments) {
        attachRow.appendChild(h('span', { class: 'nx-chat-attachment-chip' }, icon('file', { size: 12 }), a.name));
      }
      bubbleEl.prepend(attachRow);
    }

    containerEl.appendChild(bubbleEl);

    // Citations (RAG)
    if (msg.citations && msg.citations.length > 0) {
      const citationsRow = h('div', { class: 'nx-chat-citations' });
      for (const c of msg.citations) {
        const pill = h(
          'a',
          {
            class: 'nx-chat-citation-pill',
            onclick: () => {
              ctx.intents?.open(c.docPath);
            },
          },
          icon('file-text', { size: 10 }),
          `${c.title} (${Math.round((c.score || 0) * 100)}%)`,
        );
        citationsRow.appendChild(pill);
      }
      containerEl.appendChild(citationsRow);
    }

    // Tool Approval Card
    if (msg.toolCall) {
      const toolCard = renderToolApprovalCard(msg);
      containerEl.appendChild(toolCard);
    }

    // Actions bar
    const actionsEl = h('div', { class: 'nx-chat-msg-actions' });

    // Copy button
    actionsEl.appendChild(
      h(
        'button',
        {
          class: 'nx-chat-btn-action',
          onclick: () => {
            ctx.clipboard.writeText(msg.content);
            ctx.notify({ title: t('actions.copied'), duration: 1500 });
          },
        },
        icon('copy', { size: 11 }),
        t('actions.copy'),
      ),
    );

    // Speak button
    if ('speechSynthesis' in window && !isUser) {
      actionsEl.appendChild(
        h(
          'button',
          {
            class: 'nx-chat-btn-action',
            onclick: () => {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(msg.content);
              window.speechSynthesis.speak(utterance);
            },
          },
          icon('volume-2', { size: 11 }),
          t('actions.speak'),
        ),
      );
    }

    // Regenerate (for latest assistant message)
    if (!isUser && messages[messages.length - 1]?.id === msg.id && !isStreaming) {
      actionsEl.appendChild(
        h(
          'button',
          {
            class: 'nx-chat-btn-action',
            onclick: () => regenerateResponse(msg.id),
          },
          icon('refresh-cw', { size: 11 }),
          t('actions.regenerate'),
        ),
      );
    }

    // Stats badge
    if (msg.stats) {
      const s = msg.stats;
      const statsText = `${s.tokensPerSec || 0} tok/s · ${s.completionTokens || 0} tok · ${(s.durationMs / 1000).toFixed(1)}s`;
      actionsEl.appendChild(h('span', { class: 'nx-chat-stats-pill' }, statsText));
    }

    containerEl.appendChild(actionsEl);

    return containerEl;
  }

  function renderToolApprovalCard(msg) {
    const call = msg.toolCall;
    const summary = ctx.ai.tools.formatConfirmation(call.name, call.args);

    if (msg.toolApproved) {
      return h(
        'div',
        {
          class: 'nx-chat-tool-card',
          style: 'background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3);',
        },
        h(
          'div',
          { class: 'nx-chat-tool-header', style: 'color: #4ade80;' },
          icon('check', { size: 14 }),
          summary.title,
        ),
        h('div', { class: 'nx-chat-tool-details' }, msg.toolOutput || t('tools.executed')),
      );
    }

    const card = h(
      'div',
      { class: 'nx-chat-tool-card', dataset: { testid: 'tool-approval-card' } },
      h('div', { class: 'nx-chat-tool-header' }, icon('alert-triangle', { size: 14 }), summary.title),
      h('div', { style: 'font-size: 13px; font-weight: 500;' }, summary.summary),
      h('div', { class: 'nx-chat-tool-details' }, summary.details),
      h(
        'div',
        { class: 'nx-chat-tool-actions' },
        h(
          'button',
          {
            class: 'nx-chat-btn-confirm',
            dataset: { testid: 'btn-confirm-tool' },
            onclick: async () => {
              const res = await ctx.ai.tools.execute(ctx, call.name, call.args);
              msg.toolApproved = true;
              msg.toolOutput = res.output;
              await msgCollection.update(msg.id, { toolApproved: true, toolOutput: res.output });
              renderMain();
            },
          },
          t('actions.confirm'),
        ),
        h(
          'button',
          {
            class: 'nx-chat-btn-deny',
            onclick: async () => {
              msg.toolApproved = false;
              msg.toolOutput = t('tools.denied');
              await msgCollection.update(msg.id, { toolApproved: false, toolOutput: t('tools.denied') });
              renderMain();
            },
          },
          t('actions.deny'),
        ),
      ),
    );

    return card;
  }

  function renderSideCodePanel() {
    const panel = h('div', { class: 'nx-chat-code-panel' });

    const header = h(
      'div',
      { class: 'nx-chat-code-header' },
      h('span', { style: 'font-weight: 600; font-size: 13px;' }, t('codePanel.title')),
      iconButton({
        icon: 'x',
        label: t('actions.cancel'),
        size: 13,
        onClick: () => {
          codePanel = false;
          renderMain();
        },
      }),
    );

    const actions = h(
      'div',
      { class: 'nx-chat-code-actions' },
      h(
        'button',
        {
          onclick: () => sendQuickCodeAction('Explain this code in detail and walk through its logic:'),
        },
        t('actions.explainCode'),
      ),
      h(
        'button',
        {
          onclick: () => sendQuickCodeAction('Find bugs, security vulnerabilities, or edge-case issues in this code:'),
        },
        t('actions.findBugs'),
      ),
      h(
        'button',
        {
          onclick: () => sendQuickCodeAction('Add comprehensive documentation comments to this code:'),
        },
        t('actions.addComments'),
      ),
      h(
        'button',
        {
          onclick: () => sendQuickCodeAction('Write unit tests for this code:'),
        },
        t('actions.writeTests'),
      ),
      h(
        'button',
        {
          onclick: () => sendQuickCodeAction('Optimize this code for better performance and complexity:'),
        },
        t('actions.optimize'),
      ),
      h(
        'button',
        {
          style: 'margin-left: auto; background: var(--accent-primary, #6366f1); color: #fff;',
          onclick: () => {
            ctx.commands.execute('shell.launchApp', {
              appId: 'nexus.playground',
              args: { code: codeContent },
            });
          },
        },
        t('actions.runPlayground'),
      ),
    );

    const editor = h('textarea', {
      class: 'nx-chat-code-editor',
      value: codeContent,
      oninput: (e) => {
        codeContent = /** @type {HTMLTextAreaElement} */ (e.target).value;
      },
    });

    replace(panel, header, actions, editor);
    return panel;
  }

  function renderInputArea() {
    const containerEl = h('div', { class: 'nx-chat-input-container' });

    // Attachment chips
    if (attachments.length > 0) {
      const previewEl = h('div', { class: 'nx-chat-attachments-preview' });
      attachments.forEach((a, idx) => {
        const chip = h(
          'span',
          { class: 'nx-chat-attachment-chip' },
          icon('file', { size: 12 }),
          a.name,
          h(
            'button',
            {
              class: 'nx-chat-chip-remove',
              onclick: () => {
                attachments.splice(idx, 1);
                renderMain();
              },
            },
            '×',
          ),
        );
        previewEl.appendChild(chip);
      });
      containerEl.appendChild(previewEl);
    }

    const row = h('div', { class: 'nx-chat-input-row' });

    const textarea = h('textarea', {
      class: 'nx-chat-input-textarea',
      placeholder: isListening ? t('input.listening') : t('input.placeholder'),
      rows: 1,
      dataset: { testid: 'chat-input' },
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const val = textarea.value.trim();
          if (val && !isStreaming) {
            textarea.value = '';
            sendMessage(val);
          }
        }
      },
      oninput: () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
      },
    });

    // Attachment button
    const attachBtn = h(
      'button',
      {
        class: 'nx-chat-input-btn',
        title: t('actions.attach'),
        onclick: async () => {
          try {
            const picked = await ctx.dialog.openFile({
              title: t('actions.attach'),
              extensions: ['.txt', '.md', '.js', '.json', '.html', '.css', '.py'],
            });
            if (picked) {
              const text = await ctx.fs.readFile(picked, { as: 'text' });
              attachments.push({
                name: picked.split('/').pop() || picked,
                type: 'text',
                content: text,
              });
              renderMain();
            }
          } catch {
            // Cancelled
          }
        },
      },
      icon('paperclip', { size: 15 }),
    );

    // Voice button
    const voiceBtn = h(
      'button',
      {
        class: `nx-chat-input-btn${isListening ? ' is-active' : ''}`,
        title: t('actions.voice'),
        onclick: () => toggleVoiceInput(textarea),
      },
      icon('mic', { size: 15 }),
    );

    // Templates button
    const templatesBtn = h(
      'button',
      {
        class: 'nx-chat-input-btn',
        title: t('actions.templates'),
        dataset: { testid: 'btn-templates' },
        onclick: () => showTemplatesModal(textarea),
      },
      icon('sparkles', { size: 15 }),
    );

    // Send / Stop button
    const submitBtn = h(
      'button',
      {
        class: isStreaming ? 'nx-chat-btn-stop' : 'nx-chat-btn-send',
        dataset: { testid: isStreaming ? 'btn-stop' : 'btn-send' },
        onclick: () => {
          if (isStreaming) {
            activeAbort?.abort();
          } else {
            const val = textarea.value.trim();
            if (val) {
              textarea.value = '';
              sendMessage(val);
            }
          }
        },
      },
      isStreaming ? t('actions.stop') : t('actions.send'),
    );

    row.appendChild(attachBtn);
    row.appendChild(templatesBtn);
    row.appendChild(voiceBtn);
    row.appendChild(textarea);
    row.appendChild(submitBtn);

    containerEl.appendChild(row);

    // Footer with token estimation
    const footer = h(
      'div',
      { class: 'nx-chat-input-footer' },
      h('span', {}, isStreaming ? 'Generating response...' : 'Nexus AI Workspace'),
      h(
        'span',
        {},
        t('input.tokenEstimate', { count: Math.round(messages.reduce((a, m) => a + m.content.length / 4, 0)) }),
      ),
    );
    containerEl.appendChild(footer);

    return containerEl;
  }

  // ─── Interaction Handlers ──────────────────────────────────────────
  async function sendMessage(text) {
    if (!activeConv || !text.trim()) return;

    const userMsgId = `msg_${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      conversationId: activeConv.id,
      role: /** @type {const} */ ('user'),
      content: text,
      createdAt: Date.now(),
      attachments: [...attachments],
    };

    attachments = [];
    messages.push(userMsg);
    await msgCollection.put(userMsg);

    // Auto-titling if this is the first message
    if (messages.length === 1 && activeConv.title === t('sidebar.untitled')) {
      const newTitle = text.slice(0, 30).trim() + (text.length > 30 ? '...' : '');
      activeConv.title = newTitle;
      await convCollection.update(activeConv.id, { title: newTitle });
      renderSidebar();
    }

    renderMain();
    await generateAssistantResponse();
  }

  async function generateAssistantResponse() {
    if (!activeConv) return;

    isStreaming = true;
    activeAbort = new AbortController();

    const assistantMsgId = `msg_${Date.now() + 1}`;
    /** @type {MessageRecord} */
    const assistantMsg = {
      id: assistantMsgId,
      conversationId: activeConv.id,
      role: 'assistant',
      content: '',
      model: activeConv.model,
      createdAt: Date.now(),
    };

    messages.push(assistantMsg);
    renderMain();

    try {
      // Find active persona system prompt
      const persona = DEFAULT_PERSONAS.find((p) => p.id === activeConv.personaId);
      let systemPrompt = persona?.systemPrompt || '';
      if (activeConv.parameters?.systemPrompt) {
        systemPrompt += (systemPrompt ? '\n\n' : '') + activeConv.parameters.systemPrompt;
      }

      // Check RAG if "Use Notes" is active
      /** @type {any[]} */
      let citations = [];
      if (useNotes && ctx.ai.rag) {
        try {
          const lastUserMsg = messages[messages.length - 2]?.content || '';
          const results = await ctx.ai.rag.search(lastUserMsg, { topK: 3 });
          if (results.length > 0) {
            citations = results.map((r) => ({
              docPath: r.chunk.docPath,
              title: r.chunk.title,
              score: r.score,
            }));
            const contextText = results
              .map((r) => `[Source: ${r.chunk.title} (${r.chunk.docPath})]\n${r.chunk.text}`)
              .join('\n\n');
            systemPrompt += `\n\nUse the following relevant notes context to answer the user's question:\n${contextText}`;
          }
        } catch {
          // Continue without RAG if search fails
        }
      }

      // Format payload messages
      const chatMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages.slice(0, -1).map((m) => {
          let content = m.content;
          if (m.attachments && m.attachments.length > 0) {
            content += '\n\n' + m.attachments.map((a) => `[Attached File: ${a.name}]\n${a.content}`).join('\n\n');
          }
          return { role: m.role, content };
        }),
      ];

      // Stream response
      const result = await ctx.ai.chat(chatMessages, {
        model: activeConv.model,
        temperature: activeConv.parameters?.temperature,
        top_p: activeConv.parameters?.topP,
        max_tokens: activeConv.parameters?.maxTokens,
        tools: ctx.ai.tools.getOpenAiDeclarations(),
        signal: activeAbort.signal,
        onToken: (token) => {
          assistantMsg.content += token;
          const lastBubble = main.querySelector(`[data-testid="message-${assistantMsgId}"] .nx-chat-msg-bubble`);
          if (lastBubble) {
            lastBubble.textContent = assistantMsg.content;
          }
        },
      });

      assistantMsg.content = result.text;
      assistantMsg.stats = result.stats;
      if (citations.length > 0) {
        assistantMsg.citations = citations;
      }

      // Check for tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        const firstCall = result.toolCalls[0];
        try {
          const args = JSON.parse(firstCall.function.arguments || '{}');
          assistantMsg.toolCall = {
            name: firstCall.function.name,
            args,
          };
          // Auto-execute if user selected "always allow read-only tools" and tool is read-only
          const decl = ctx.ai.tools.declarations.find((d) => d.name === firstCall.function.name);
          if (activeConv.allowReadOnlyTools && decl?.isReadOnly) {
            const toolRes = await ctx.ai.tools.execute(ctx, firstCall.function.name, args);
            assistantMsg.toolApproved = true;
            assistantMsg.toolOutput = toolRes.output;
          }
        } catch {
          //
        }
      }

      await msgCollection.put(assistantMsg);
      activeConv.updatedAt = Date.now();
      await convCollection.update(activeConv.id, { updatedAt: activeConv.updatedAt });
    } catch (err) {
      const error = /** @type {Error} */ (err);
      if (error.name !== 'AbortError') {
        assistantMsg.content = `Error: ${error.message}`;
        await msgCollection.put(assistantMsg);
      } else {
        assistantMsg.content += ' [Stopped]';
        await msgCollection.put(assistantMsg);
      }
    } finally {
      isStreaming = false;
      activeAbort = null;
      renderMain();
    }
  }

  async function regenerateResponse(msgId) {
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    messages = messages.slice(0, idx);
    await msgCollection.delete(msgId);
    renderMain();
    await generateAssistantResponse();
  }

  function sendQuickCodeAction(instruction) {
    const prompt = `${instruction}\n\n\`\`\`\n${codeContent}\n\`\`\``;
    sendMessage(prompt);
  }

  function toggleVoiceInput(textarea) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      ctx.notify({ title: 'Voice input not supported in this browser.', duration: 2500 });
      return;
    }

    if (isListening) {
      speechRec?.stop();
      isListening = false;
      renderMain();
      return;
    }

    try {
      speechRec = new SpeechRecognition();
      speechRec.continuous = false;
      speechRec.interimResults = true;
      speechRec.lang = ctx.i18n.locale === 'de' ? 'de-DE' : 'en-US';

      speechRec.onstart = () => {
        isListening = true;
        renderMain();
      };

      speechRec.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('');
        textarea.value = transcript;
      };

      speechRec.onerror = () => {
        isListening = false;
        renderMain();
      };

      speechRec.onend = () => {
        isListening = false;
        renderMain();
      };

      speechRec.start();
    } catch {
      isListening = false;
      renderMain();
    }
  }

  function showTemplatesModal(textarea) {
    const backdrop = h('div', { class: 'nx-chat-modal-backdrop' });
    const modal = h('div', { class: 'nx-chat-modal' });

    const header = h(
      'div',
      { class: 'nx-chat-modal-header' },
      h('span', {}, t('actions.templates')),
      iconButton({
        icon: 'x',
        label: t('actions.cancel'),
        onClick: () => backdrop.remove(),
      }),
    );

    const body = h('div', { class: 'nx-chat-modal-body' });

    DEFAULT_TEMPLATES.forEach((tpl) => {
      const card = h(
        'div',
        {
          class: 'nx-chat-empty-guide-card nx-chat-template-card',
          style: 'cursor: pointer;',
          onclick: () => {
            renderTemplateForm(tpl, body, backdrop, textarea);
          },
        },
        h('div', { style: 'font-weight: 600; margin-bottom: 2px;' }, tpl.title),
        h('div', { style: 'font-size: 11px; color: #888;' }, tpl.description),
      );
      body.appendChild(card);
    });

    replace(modal, header, body);
    backdrop.appendChild(modal);
    root.appendChild(backdrop);
  }

  function renderTemplateForm(tpl, bodyEl, backdrop, textarea) {
    bodyEl.innerHTML = '';
    const vars = extractVariables(tpl.template);
    /** @type {Record<string, string>} */
    const values = {};

    bodyEl.appendChild(h('h3', { style: 'font-size: 14px; margin-bottom: 8px;' }, tpl.title));

    vars.forEach((v) => {
      const field = h(
        'div',
        {
          class: 'nx-chat-template-var-field',
          style: 'display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;',
        },
        h('label', { style: 'font-size: 12px; font-weight: 500;' }, v),
        h('input', {
          class: 'nx-chat-sidebar-search',
          placeholder: `Value for {{${v}}}`,
          oninput: (e) => {
            values[v] = /** @type {HTMLInputElement} */ (e.target).value;
          },
        }),
      );
      bodyEl.appendChild(field);
    });

    const insertBtn = h(
      'button',
      {
        class: 'nx-chat-new-btn',
        style: 'margin-top: 10px;',
        onclick: () => {
          const interpolated = interpolateTemplate(tpl.template, values);
          textarea.value = interpolated;
          backdrop.remove();
        },
      },
      t('actions.insert'),
    );

    bodyEl.appendChild(insertBtn);
  }

  function showExportMenu() {
    if (!activeConv) return;
    const items = [
      {
        label: t('actions.exportMd'),
        action: () => exportConversationAs('md'),
      },
      {
        label: t('actions.exportJson'),
        action: () => exportConversationAs('json'),
      },
      {
        label: t('actions.exportHtml'),
        action: () => exportConversationAs('html'),
      },
    ];

    const menu = h(
      'div',
      {
        style:
          'position: absolute; top: 40px; right: 20px; background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px; z-index: 100;',
      },
      ...items.map((it) =>
        h(
          'div',
          {
            style: 'padding: 6px 12px; font-size: 12px; cursor: pointer; border-radius: 4px;',
            onmouseenter: (e) => {
              /** @type {HTMLElement} */ (e.target).style.background = '#333';
            },
            onmouseleave: (e) => {
              /** @type {HTMLElement} */ (e.target).style.background = 'transparent';
            },
            onclick: () => {
              it.action();
              menu.remove();
            },
          },
          it.label,
        ),
      ),
    );

    main.appendChild(menu);
    setTimeout(() => {
      const listener = () => {
        menu.remove();
        window.removeEventListener('click', listener);
      };
      window.addEventListener('click', listener);
    }, 10);
  }

  function exportConversationAs(format) {
    if (!activeConv) return;
    let content = '';
    let mime = 'text/plain';
    let ext = 'txt';

    if (format === 'md') {
      mime = 'text/markdown';
      ext = 'md';
      content = `# ${activeConv.title}\n\n`;
      for (const m of messages) {
        content += `### ${m.role === 'user' ? 'User' : 'Assistant'} (${m.model || ''})\n\n${m.content}\n\n---\n\n`;
      }
    } else if (format === 'json') {
      mime = 'application/json';
      ext = 'json';
      content = JSON.stringify({ conversation: activeConv, messages }, null, 2);
    } else if (format === 'html') {
      mime = 'text/html';
      ext = 'html';
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activeConv.title}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;} .msg{margin-bottom:20px;padding:12px;border-radius:8px;} .user{background:#eef2ff;} .assistant{background:#f3f4f6;}</style></head><body><h1>${activeConv.title}</h1>`;
      for (const m of messages) {
        content += `<div class="msg ${m.role}"><strong>${m.role}:</strong><p>${m.content.replace(/\n/g, '<br>')}</p></div>`;
      }
      content += '</body></html>';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeConv.title.replace(/[^\w-]/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Lifecycle Mount Execution ─────────────────────────────────────
  await init();

  return {
    unmount() {
      if (isStreaming) activeAbort?.abort();
      if (isListening) speechRec?.stop();
    },
  };
}
