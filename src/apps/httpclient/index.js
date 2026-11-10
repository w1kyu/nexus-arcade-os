// @ts-check
import { h, icon } from '../../ui/dom.js';
import { executeHttpRequest, generateCurlSnippet, generateFetchSnippet } from './http-core.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  const root = h('div', { class: 'nx-http-app' });

  // Environment dictionary
  /** @type {Record<string, string>} */
  const envVars = {
    baseUrl: 'https://jsonplaceholder.typicode.com',
    token: 'nexus-dev-token-2026',
  };

  /** @type {{ method: string, url: string, headers: Record<string, string>, body: string, authType: string, authToken: string }} */
  const currentRequest = {
    method: 'GET',
    url: '{{baseUrl}}/todos/1',
    headers: {
      Accept: 'application/json',
    },
    body: '{\n  "title": "New Task",\n  "completed": false\n}',
    authType: 'none',
    authToken: '',
  };

  // Sidebar
  const sidebar = h('aside', { class: 'nx-http-sidebar' });
  const sidebarHeader = h(
    'div',
    { class: 'nx-http-sidebar-header' },
    h('span', { class: 'nx-http-sidebar-title' }, t('sidebar.requests')),
    h('button', { class: 'nx-button ghost small', title: t('sidebar.newRequest') }, icon('file-plus', { size: 14 })),
  );
  const requestsList = h('ul', { class: 'nx-http-sidebar-list' });
  sidebar.append(sidebarHeader, requestsList);

  const savedRequests = [
    { id: '1', name: 'Get Todo Item', method: 'GET', url: '{{baseUrl}}/todos/1' },
    { id: '2', name: 'List Users', method: 'GET', url: '{{baseUrl}}/users' },
    { id: '3', name: 'Create Post', method: 'POST', url: '{{baseUrl}}/posts' },
  ];

  function renderSavedRequests() {
    requestsList.replaceChildren();
    for (const item of savedRequests) {
      const li = h(
        'li',
        { class: `nx-http-request-item${currentRequest.url === item.url ? ' active' : ''}` },
        h('span', { class: `nx-http-method-badge ${item.method}` }, item.method),
        h('span', { style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, item.name),
      );
      li.addEventListener('click', () => {
        currentRequest.method = item.method;
        currentRequest.url = item.url;
        methodSelect.value = item.method;
        urlInput.value = item.url;
        renderSavedRequests();
      });
      requestsList.append(li);
    }
  }

  // Main Area
  const mainArea = h('main', { class: 'nx-http-main' });
  root.append(sidebar, mainArea);
  container.append(root);

  // URL Bar
  const urlBar = h('div', { class: 'nx-http-url-bar' });
  const methodSelect = h(
    'select',
    { class: 'nx-http-method-select' },
    h('option', { value: 'GET' }, 'GET'),
    h('option', { value: 'POST' }, 'POST'),
    h('option', { value: 'PUT' }, 'PUT'),
    h('option', { value: 'DELETE' }, 'DELETE'),
    h('option', { value: 'PATCH' }, 'PATCH'),
    h('option', { value: 'HEAD' }, 'HEAD'),
    h('option', { value: 'OPTIONS' }, 'OPTIONS'),
  );
  const urlInput = h('input', {
    type: 'text',
    class: 'nx-http-url-input',
    placeholder: t('request.urlPlaceholder'),
    value: currentRequest.url,
    spellcheck: 'false',
  });
  const sendBtn = h('button', { class: 'nx-button primary' }, icon('play', { size: 14 }), t('request.send'));
  urlBar.append(methodSelect, urlInput, sendBtn);

  methodSelect.addEventListener('change', () => {
    // @ts-ignore
    currentRequest.method = methodSelect.value;
  });
  urlInput.addEventListener('input', () => {
    currentRequest.url = urlInput.value;
  });

  // Split container (Request tabs on top, Response on bottom)
  const split = h('div', { class: 'nx-http-split' });
  mainArea.append(urlBar, split);

  // Request Pane
  const reqPane = h('div', { class: 'nx-http-pane' });
  const reqTabsHeader = h('div', { class: 'nx-http-tabs-header' });
  const reqTabKeys = ['params', 'headers', 'body', 'auth', 'snippets'];
  /** @type {Record<string, HTMLButtonElement>} */
  const reqTabBtns = {};
  /** @type {Record<string, HTMLElement>} */
  const reqTabPanes = {};

  for (const key of reqTabKeys) {
    const btn = h('button', { class: `nx-http-tab-btn${key === 'params' ? ' active' : ''}` }, t(`request.${key}`));
    reqTabBtns[key] = btn;
    btn.addEventListener('click', () => switchReqTab(key));
    reqTabsHeader.append(btn);

    const p = h('div', { class: 'nx-http-pane-content' });
    if (key !== 'params') p.hidden = true;
    reqTabPanes[key] = p;
  }

  reqPane.append(reqTabsHeader);
  for (const p of Object.values(reqTabPanes)) reqPane.append(p);

  function switchReqTab(/** @type {string} */ target) {
    for (const k of reqTabKeys) {
      reqTabBtns[k].classList.toggle('active', k === target);
      reqTabPanes[k].hidden = k !== target;
    }
    if (target === 'snippets') updateSnippets();
  }

  // Params Tab
  const paramsText = h('textarea', {
    class: 'nx-tool-textarea',
    placeholder: 'Query parameters as key=value (one per line)...',
    value: 'limit=10\nsort=desc',
    spellcheck: 'false',
  });
  reqTabPanes.params.append(paramsText);

  // Headers Tab
  const headersText = h('textarea', {
    class: 'nx-tool-textarea',
    placeholder: 'Headers as Key: Value (one per line)...',
    value: 'Accept: application/json\nContent-Type: application/json',
    spellcheck: 'false',
  });
  reqTabPanes.headers.append(headersText);

  // Body Tab
  const bodyText = h('textarea', {
    class: 'nx-tool-textarea',
    placeholder: 'Request body (JSON, form data, or raw text)...',
    value: currentRequest.body,
    spellcheck: 'false',
  });
  reqTabPanes.body.append(bodyText);

  // Auth Tab
  const authBox = h('div', { style: 'display: flex; flex-direction: column; gap: 10px; max-width: 480px;' });
  const authSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'none' }, 'No Auth'),
    h('option', { value: 'bearer' }, 'Bearer Token'),
    h('option', { value: 'basic' }, 'Basic Auth'),
  );
  const tokenInput = h('input', {
    type: 'text',
    class: 'nx-colorlab-format-input',
    placeholder: 'Bearer token or {{token}}...',
    value: '{{token}}',
  });
  authBox.append(h('label', { style: 'font-weight: 600;' }, 'Type:'), authSelect, tokenInput);
  reqTabPanes.auth.append(authBox);

  // Snippets Tab
  const snippetArea = h('textarea', {
    class: 'nx-tool-textarea',
    readonly: 'true',
    spellcheck: 'false',
  });
  reqTabPanes.snippets.append(snippetArea);

  function updateSnippets() {
    const curl = generateCurlSnippet({
      method: methodSelect.value,
      url: urlInput.value,
      headers: currentRequest.headers,
      body: bodyText.value,
    });
    const js = generateFetchSnippet({
      method: methodSelect.value,
      url: urlInput.value,
      headers: currentRequest.headers,
      body: bodyText.value,
    });
    snippetArea.value = `─── cURL ───\n${curl}\n\n─── JavaScript fetch() ───\n${js}`;
  }

  // Response Pane
  const resPane = h('div', { class: 'nx-http-pane' });
  const resTabsHeader = h('div', { class: 'nx-http-tabs-header' });

  const resBodyBtn = h('button', { class: 'nx-http-tab-btn active' }, t('response.body'));
  const resHeadersBtn = h('button', { class: 'nx-http-tab-btn' }, t('response.headers'));

  const resMeta = h('div', { class: 'nx-http-response-meta' });
  const statusTag = h('span', { class: 'nx-http-status-tag ok', style: 'display: none;' }, '200 OK');
  const timeTag = h('span', { style: 'color: var(--text-2);' });
  const sizeTag = h('span', { style: 'color: var(--text-2);' });
  const copyResBtn = h(
    'button',
    { class: 'nx-button ghost small', title: t('response.copy') },
    icon('copy', { size: 14 }),
  );

  resMeta.append(statusTag, timeTag, sizeTag, copyResBtn);
  resTabsHeader.append(resBodyBtn, resHeadersBtn, resMeta);

  const resContent = h('div', { class: 'nx-http-pane-content' });
  const resPlaceholder = h('div', { style: 'color: var(--text-3); font-size: 13px;' }, t('response.empty'));
  const resTextarea = h('textarea', {
    class: 'nx-tool-textarea',
    readonly: 'true',
    style: 'display: none;',
    spellcheck: 'false',
  });
  const resHeadersList = h('textarea', {
    class: 'nx-tool-textarea',
    readonly: 'true',
    style: 'display: none;',
    spellcheck: 'false',
  });
  const diagCard = h('div', { class: 'nx-http-diag-card', style: 'display: none;' });

  resContent.append(resPlaceholder, diagCard, resTextarea, resHeadersList);
  resPane.append(resTabsHeader, resContent);
  split.append(reqPane, resPane);

  resBodyBtn.addEventListener('click', () => {
    resBodyBtn.classList.add('active');
    resHeadersBtn.classList.remove('active');
    if (resTextarea.value) resTextarea.style.display = 'block';
    resHeadersList.style.display = 'none';
  });

  resHeadersBtn.addEventListener('click', () => {
    resHeadersBtn.classList.add('active');
    resBodyBtn.classList.remove('active');
    resTextarea.style.display = 'none';
    if (resHeadersList.value) resHeadersList.style.display = 'block';
  });

  copyResBtn.addEventListener('click', async () => {
    if (resTextarea.value) {
      await navigator.clipboard.writeText(resTextarea.value);
      ctx.notifications?.notify?.({ title: t('response.copied'), level: 'info' });
    }
  });

  // Send Request Execution
  async function sendRequest() {
    sendBtn.disabled = true;
    sendBtn.textContent = t('request.sending');

    // Parse headers from headers textarea
    /** @type {Record<string, string>} */
    const customHeaders = {};
    const hLines = headersText.value.split('\n');
    for (const line of hLines) {
      const colon = line.indexOf(':');
      if (colon > 0) {
        const k = line.slice(0, colon).trim();
        const v = line.slice(colon + 1).trim();
        if (k) customHeaders[k] = v;
      }
    }

    // Add auth header if configured
    // @ts-ignore
    if (authSelect.value === 'bearer' && tokenInput.value.trim()) {
      customHeaders.Authorization = `Bearer ${tokenInput.value.trim()}`;
    }

    const reqObj = {
      method: methodSelect.value,
      url: urlInput.value,
      headers: customHeaders,
      body: ['GET', 'HEAD'].includes(methodSelect.value) ? undefined : bodyText.value,
    };

    const res = await executeHttpRequest(reqObj, envVars);
    sendBtn.disabled = false;
    sendBtn.replaceChildren(icon('play', { size: 14 }), t('request.send'));

    resPlaceholder.style.display = 'none';
    statusTag.style.display = 'inline-block';
    statusTag.textContent = `${res.status} ${res.statusText}`;
    statusTag.className = `nx-http-status-tag ${res.ok ? 'ok' : 'error'}`;

    timeTag.textContent = `${res.timeMs} ms`;
    sizeTag.textContent = res.sizeBytes > 1024 ? `${(res.sizeBytes / 1024).toFixed(1)} KB` : `${res.sizeBytes} B`;

    if (res.error) {
      diagCard.style.display = 'block';
      diagCard.replaceChildren();
      const isCors = res.error.type === 'cors';
      const isOffline = res.error.type === 'offline';

      const titleEl = h(
        'div',
        { class: 'nx-http-diag-title' },
        isCors ? t('error.corsTitle') : isOffline ? t('error.offlineTitle') : 'Request Error',
      );
      const descEl = h(
        'div',
        { class: 'nx-http-diag-desc' },
        isCors ? t('error.corsDesc') : isOffline ? t('error.offlineDesc') : res.error.message,
      );
      diagCard.append(titleEl, descEl);

      if (res.error.curl) {
        const curlBox = h(
          'textarea',
          {
            class: 'nx-tool-textarea',
            style: 'height: 80px; margin-top: 6px;',
            readonly: 'true',
            spellcheck: 'false',
          },
          res.error.curl,
        );
        diagCard.append(curlBox);
      }
      resTextarea.style.display = 'none';
    } else {
      diagCard.style.display = 'none';
      resTextarea.style.display = 'block';

      // Pretty print if JSON
      let bodyFormatted = res.body;
      try {
        bodyFormatted = JSON.stringify(JSON.parse(res.body), null, 2);
      } catch {
        // keep as raw text
      }
      resTextarea.value = bodyFormatted;

      // Headers text
      const hList = Object.entries(res.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      resHeadersList.value = hList;
    }
  }

  sendBtn.addEventListener('click', sendRequest);
  renderSavedRequests();

  return () => {
    root.remove();
  };
}

export const commands = {
  'httpclient.open': (ctx, args) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.httpclient', args }),
  'httpclient.new': (ctx) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.httpclient' }),
};

export const terminal = {
  curl: async (_ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      io.stderr?.('Usage: curl [-X METHOD] <url>\n');
      return 1;
    }
    let method = 'GET';
    let url = '';
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-X' && args[i + 1]) {
        method = args[i + 1].toUpperCase();
        i++;
      } else if (!args[i].startsWith('-')) {
        url = args[i];
      }
    }
    if (!url) {
      io.stderr?.('curl: no URL specified\n');
      return 1;
    }
    try {
      const res = await executeHttpRequest({ method, url });
      if (res.error) {
        io.stderr?.(`curl: (${res.error.type}) ${res.error.message}\n`);
        return 1;
      }
      io.stdout?.(`${res.body}\n`);
      return 0;
    } catch (err) {
      io.stderr?.(`curl: ${String(err?.message || err)}\n`);
      return 1;
    }
  },
};
