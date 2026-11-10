// @ts-check
import { h, icon } from './dom.js';
import './tool-layout.css';

/**
 * @typedef {object} ToolLayoutOptions
 * @property {string} [title]
 * @property {string} [iconName]
 * @property {string} [inputTitle]
 * @property {string} [outputTitle]
 * @property {string} [inputPlaceholder]
 * @property {string} [outputPlaceholder]
 * @property {boolean} [singlePane]
 * @property {boolean} [allowSwap]
 * @property {boolean} [showHistory]
 * @property {(text: string) => void} [onInput]
 * @property {(from: string) => void} [onRestoreHistory]
 * @property {HTMLElement[]} [optionsControls]
 * @property {HTMLElement[]} [headerActions]
 * @property {HTMLElement} [customInputContent]
 * @property {HTMLElement} [customOutputContent]
 */

/**
 * Creates a reusable developer tool layout.
 * @param {ToolLayoutOptions} opts
 */
export function createToolLayout(opts) {
  const root = h('div', { class: 'nx-tool-layout' });

  // 1. Header (if title or options exist)
  const header = h('div', { class: 'nx-tool-header' });
  const titleEl = h(
    'div',
    { class: 'nx-tool-header-title' },
    opts.iconName ? icon(opts.iconName, { size: 16 }) : '',
    h('span', {}, opts.title || ''),
  );
  const headerActions = h('div', { class: 'nx-tool-header-actions' });
  header.append(titleEl, headerActions);

  // 2. Options Bar
  const optionsBar = h('div', { class: 'nx-tool-options-bar' });
  if (opts.optionsControls && opts.optionsControls.length > 0) {
    for (const ctrl of opts.optionsControls) {
      optionsBar.append(ctrl);
    }
  } else {
    optionsBar.hidden = true;
  }

  // 3. Panes container
  const panes = h('div', { class: `nx-tool-panes${opts.singlePane ? ' single-pane' : ''}` });

  // Input Pane
  const inputPane = h('div', { class: 'nx-tool-pane' });
  const inputStats = h('span', { class: 'nx-tool-pane-stats' });
  const inputActions = h('div', { class: 'nx-tool-pane-actions' });
  const inputHeader = h(
    'div',
    { class: 'nx-tool-pane-header' },
    h('div', { class: 'nx-tool-pane-title' }, icon('edit', { size: 14 }), opts.inputTitle || 'Input'),
    inputStats,
    inputActions,
  );

  const inputContent = h('div', { class: 'nx-tool-pane-content' });
  /** @type {HTMLTextAreaElement} */
  const inputTextarea = h('textarea', {
    class: 'nx-tool-textarea',
    placeholder: opts.inputPlaceholder || 'Enter input here...',
    spellcheck: 'false',
  });

  if (opts.customInputContent) {
    inputContent.append(opts.customInputContent);
  } else {
    inputContent.append(inputTextarea);
  }
  inputPane.append(inputHeader, inputContent);

  // Output Pane
  const outputPane = h('div', { class: 'nx-tool-pane' });
  const outputStats = h('span', { class: 'nx-tool-pane-stats' });
  const outputActions = h('div', { class: 'nx-tool-pane-actions' });
  const outputHeader = h(
    'div',
    { class: 'nx-tool-pane-header' },
    h('div', { class: 'nx-tool-pane-title' }, icon('terminal', { size: 14 }), opts.outputTitle || 'Output'),
    outputStats,
    outputActions,
  );

  const outputContent = h('div', { class: 'nx-tool-pane-content' });
  /** @type {HTMLTextAreaElement} */
  const outputTextarea = h('textarea', {
    class: 'nx-tool-textarea',
    placeholder: opts.outputPlaceholder || 'Output will appear here...',
    readonly: 'true',
    spellcheck: 'false',
  });

  if (opts.customOutputContent) {
    outputContent.append(opts.customOutputContent);
  } else {
    outputContent.append(outputTextarea);
  }
  outputPane.append(outputHeader, outputContent);

  panes.append(inputPane);
  if (!opts.singlePane) {
    panes.append(outputPane);
  }

  // Status line
  const statusBar = h('div', { class: 'nx-tool-status' });
  statusBar.hidden = true;

  // History Drawer
  const historyDrawer = h('div', { class: 'nx-tool-history-drawer', hidden: true });
  const historyHeader = h(
    'div',
    { class: 'nx-tool-pane-header' },
    h('div', { class: 'nx-tool-pane-title' }, icon('clock', { size: 14 }), 'Recent Inputs'),
  );
  const historyList = h('ul', { class: 'nx-tool-history-list' });
  historyDrawer.append(historyHeader, historyList);
  panes.append(historyDrawer);

  root.append(header, optionsBar, panes, statusBar);

  // Buttons & standard actions
  const clearBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Clear input' },
    icon('trash', { size: 14 }),
    'Clear',
  );
  clearBtn.addEventListener('click', () => {
    inputTextarea.value = '';
    updateStats();
    opts.onInput?.('');
  });
  inputActions.append(clearBtn);

  const pasteBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Paste from clipboard' },
    icon('clipboard', { size: 14 }),
    'Paste',
  );
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        inputTextarea.value = text;
        updateStats();
        recordHistory(text);
        opts.onInput?.(text);
      }
    } catch {
      // ignore
    }
  });
  inputActions.append(pasteBtn);

  const copyBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Copy output to clipboard' },
    icon('copy', { size: 14 }),
    'Copy',
  );
  copyBtn.addEventListener('click', async () => {
    const text = outputTextarea.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard!', 'success', 2000);
    } catch {
      // fallback
    }
  });
  outputActions.append(copyBtn);

  const downloadBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Download output' },
    icon('download', { size: 14 }),
    'Download',
  );
  downloadBtn.addEventListener('click', () => {
    const text = outputTextarea.value;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
  outputActions.append(downloadBtn);

  if (opts.allowSwap) {
    const swapBtn = h(
      'button',
      { class: 'nx-button ghost small', title: 'Swap input and output' },
      icon('arrow-left', { size: 14 }),
      'Swap',
    );
    swapBtn.addEventListener('click', () => {
      const temp = outputTextarea.value;
      inputTextarea.value = temp;
      updateStats();
      opts.onInput?.(temp);
    });
    outputActions.append(swapBtn);
  }

  // Layout toggle (side-by-side / stacked)
  let isStacked = false;
  const layoutBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Toggle layout (side-by-side / stacked)' },
    icon('layout-split', { size: 14 }),
  );
  layoutBtn.addEventListener('click', () => {
    isStacked = !isStacked;
    panes.classList.toggle('stacked', isStacked);
  });
  headerActions.append(layoutBtn);

  // History button
  const historyItems = /** @type {string[]} */ ([]);
  const historyBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'History of recent inputs' },
    icon('clock', { size: 14 }),
  );
  historyBtn.addEventListener('click', () => {
    historyDrawer.hidden = !historyDrawer.hidden;
  });
  headerActions.append(historyBtn);

  function recordHistory(/** @type {string} */ val) {
    if (!val || val.trim().length === 0) return;
    const existing = historyItems.indexOf(val);
    if (existing >= 0) historyItems.splice(existing, 1);
    historyItems.unshift(val);
    if (historyItems.length > 20) historyItems.pop();
    renderHistory();
  }

  function renderHistory() {
    historyList.replaceChildren();
    if (historyItems.length === 0) {
      historyList.append(h('li', { style: 'padding: 8px; color: var(--text-3); font-size: 11px;' }, 'No history yet'));
      return;
    }
    for (const item of historyItems) {
      const li = h('li', { class: 'nx-tool-history-item' }, item.slice(0, 150));
      li.addEventListener('click', () => {
        inputTextarea.value = item;
        updateStats();
        opts.onInput?.(item);
        historyDrawer.hidden = true;
      });
      historyList.append(li);
    }
  }

  function updateStats() {
    const inVal = inputTextarea.value;
    inputStats.textContent = `${inVal.length} chars, ${inVal ? inVal.split('\n').length : 0} lines`;
    const outVal = outputTextarea.value;
    outputStats.textContent = `${outVal.length} chars, ${outVal ? outVal.split('\n').length : 0} lines`;
  }

  inputTextarea.addEventListener('input', () => {
    updateStats();
    opts.onInput?.(inputTextarea.value);
  });
  inputTextarea.addEventListener('change', () => {
    recordHistory(inputTextarea.value);
  });

  /**
   * Sets the status message.
   * @param {string} msg
   * @param {'info' | 'success' | 'error'} [type]
   * @param {number} [timeout]
   */
  function setStatus(msg, type = 'info', timeout = 0) {
    if (!msg) {
      statusBar.hidden = true;
      statusBar.textContent = '';
      return;
    }
    statusBar.hidden = false;
    statusBar.className = `nx-tool-status ${type}`;
    statusBar.textContent = msg;
    if (timeout > 0) {
      setTimeout(() => {
        if (statusBar.textContent === msg) {
          statusBar.hidden = true;
        }
      }, timeout);
    }
  }

  return {
    root,
    header,
    optionsBar,
    panes,
    inputTextarea,
    outputTextarea,
    inputContent,
    outputContent,
    inputActions,
    outputActions,
    headerActions,
    setStatus,
    recordHistory,
    updateStats,
    setInput(/** @type {string} */ val) {
      inputTextarea.value = val;
      updateStats();
      recordHistory(val);
      opts.onInput?.(val);
    },
    setOutput(/** @type {string} */ val) {
      outputTextarea.value = val;
      updateStats();
    },
  };
}
