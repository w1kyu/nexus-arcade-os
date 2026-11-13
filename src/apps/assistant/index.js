// @ts-check
// AI Assistant: Quick OS-wide writing and coding companion.

import { h, icon, replace } from '../../ui/dom.js';
import { renderMarkdownInto } from '../../ui/markdown.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'assistant.open': (ctx, args) =>
    ctx.commands.execute('shell.launchApp', {
      appId: 'nexus.assistant',
      args,
    }),
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ vars = {}) => ctx.i18n.t(key, vars);

  let inputText = args?.text || args?.intent?.data?.text || '';
  let outputText = '';
  let isStreaming = false;
  /** @type {AbortController | null} */
  let abortController = null;

  const root = h('div', { class: 'nx-assistant', dataset: { testid: 'ai-assistant' } });
  const actionsBar = h('div', { class: 'nx-assistant-actions-bar' });
  const inputEl = h('textarea', {
    class: 'nx-assistant-input-area',
    placeholder: t('input.placeholder'),
    dataset: { testid: 'assistant-input' },
    value: inputText,
    oninput: (e) => {
      inputText = /** @type {HTMLTextAreaElement} */ (e.target).value;
    },
  });
  const outputEl = h('div', {
    class: 'nx-assistant-output-area nx-markdown',
    dataset: { testid: 'assistant-output' },
  });
  const footer = h('div', { class: 'nx-assistant-footer' });

  function renderActions() {
    actionsBar.innerHTML = '';
    const actions = [
      { id: 'explain', label: t('actions.explain'), prompt: 'Explain the following text or code clearly:' },
      {
        id: 'summarize',
        label: t('actions.summarize'),
        prompt: 'Summarize the following text into key bullet points:',
      },
      {
        id: 'translate',
        label: t('actions.translate'),
        prompt: 'Translate this text accurately between English and German:',
      },
      {
        id: 'refactor',
        label: t('actions.refactor'),
        prompt: 'Refactor and improve this code for clarity and performance:',
      },
      {
        id: 'fixGrammar',
        label: t('actions.fixGrammar'),
        prompt: 'Fix all grammar, spelling, and phrasing issues in this text:',
      },
    ];

    for (const act of actions) {
      actionsBar.appendChild(
        h(
          'button',
          {
            class: 'nx-assistant-action-btn',
            dataset: { testid: `action-${act.id}` },
            onclick: () => runAction(act.prompt),
          },
          act.label,
        ),
      );
    }
  }

  function renderFooter() {
    footer.innerHTML = '';

    if (outputText) {
      footer.appendChild(
        h(
          'button',
          {
            class: 'nx-assistant-btn-secondary',
            onclick: () => {
              ctx.clipboard.writeText(outputText);
              ctx.notify({ title: t('actions.copied'), duration: 1500 });
            },
          },
          icon('copy', { size: 12 }),
          t('actions.copy'),
        ),
      );

      footer.appendChild(
        h(
          'button',
          {
            class: 'nx-assistant-btn-secondary',
            onclick: () => {
              ctx.commands.execute('shell.launchApp', {
                appId: 'nexus.chat',
                args: { newChat: true },
              });
            },
          },
          icon('message-square', { size: 12 }),
          t('actions.openInChat'),
        ),
      );
    }

    const runBtn = h(
      'button',
      {
        class: isStreaming ? 'nx-assistant-btn-secondary' : 'nx-assistant-btn-primary',
        dataset: { testid: isStreaming ? 'btn-stop' : 'btn-run' },
        onclick: () => {
          if (isStreaming) {
            abortController?.abort();
          } else {
            runAction('Please review or assist with the following text:');
          }
        },
      },
      isStreaming ? t('actions.stop') : t('actions.run'),
    );
    footer.appendChild(runBtn);
  }

  async function runAction(instruction) {
    if (!inputText.trim()) return;
    if (!ctx.ai.isAvailable()) {
      outputEl.textContent = t('emptyState.message');
      return;
    }

    isStreaming = true;
    abortController = new AbortController();
    outputText = '';
    outputEl.textContent = 'Thinking...';
    renderFooter();

    try {
      const messages = [
        {
          role: 'user',
          content: `${instruction}\n\n${inputText}`,
        },
      ];

      const res = await ctx.ai.chat(messages, {
        signal: abortController.signal,
        onToken: (delta) => {
          outputText += delta;
          outputEl.textContent = outputText;
        },
      });

      outputText = res.text;
      await renderMarkdownInto(outputEl, outputText);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      if (error.name !== 'AbortError') {
        outputText = `Error: ${error.message}`;
        outputEl.textContent = outputText;
      } else {
        outputText += ' [Stopped]';
        outputEl.textContent = outputText;
      }
    } finally {
      isStreaming = false;
      abortController = null;
      renderFooter();
    }
  }

  // Initial render
  if (!ctx.ai.isAvailable()) {
    outputEl.textContent = t('emptyState.message');
  } else if (args?.action && inputText) {
    // Automatically trigger action if passed in args
    const promptMap = {
      explain: 'Explain the following clearly:',
      summarize: 'Summarize the following into bullet points:',
      translate: 'Translate this text between English and German:',
      refactor: 'Refactor this code:',
      fix: 'Fix grammar and phrasing in this text:',
    };
    void runAction(promptMap[args.action] || 'Assist with this text:');
  }

  renderActions();
  renderFooter();
  replace(root, actionsBar, inputEl, outputEl, footer);
  replace(container, root);

  return {
    unmount() {
      if (isStreaming) abortController?.abort();
    },
  };
}
