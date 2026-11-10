// @ts-check
import { h, icon } from '../../ui/dom.js';
import { createToolLayout } from '../../ui/tool-layout.js';
import {
  aesDecrypt,
  aesEncrypt,
  base32Decode,
  base32Encode,
  base64Decode,
  base64Encode,
  crc32,
  cryptoHash,
  generateKeyPair,
  hexDecode,
  hexEncode,
  hmac,
  htmlEntitiesDecode,
  htmlEntitiesEncode,
  md5,
  punycodeDecode,
  punycodeEncode,
  unicodeEscape,
  unicodeUnescape,
} from './tools/crypto-math.js';
import {
  formatJson,
  jsonToCsv,
  jsonToTypes,
  jsonToYaml,
  minifyJson,
  sortJsonKeys,
  validateJson,
} from './tools/json-toolkit.js';
import { COMMON_PATTERNS, explainRegex } from './tools/regex-helper.js';
import {
  convertNumberBase,
  convertTimestamp,
  decodeJwt,
  generateFakeUsers,
  generateMarkdownTable,
  generateNanoId,
  generateQrSvg,
  generateUlid,
  generateUuidV4,
  generateUuidV7,
  generateLorem,
  optimizeSvg,
  parseCron,
  slugify,
  textCaseConvert,
  textStats,
} from './tools/small-tools.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  const root = h('div', { class: 'nx-devtools-app' });

  // Sidebar
  const sidebar = h('aside', { class: 'nx-devtools-sidebar' });
  const searchBox = h('div', { class: 'nx-devtools-search' });
  const searchInput = h('input', { type: 'text', placeholder: t('search'), spellcheck: 'false' });
  searchBox.append(searchInput);

  const toolsList = h('ul', { class: 'nx-devtools-tools-list' });
  sidebar.append(searchBox, toolsList);

  // Main Tool Area
  const mainArea = h('main', { class: 'nx-devtools-main' });
  root.append(sidebar, mainArea);
  container.append(root);

  const categories = [
    {
      id: 'data',
      name: t('categories.data'),
      tools: [{ id: 'json', name: t('tools.json'), icon: 'file-code' }],
    },
    {
      id: 'security',
      name: t('categories.security'),
      tools: [
        { id: 'crypto', name: t('tools.crypto'), icon: 'key' },
        { id: 'jwt', name: t('tools.jwt'), icon: 'shield' },
      ],
    },
    {
      id: 'generators',
      name: t('categories.generators'),
      tools: [
        { id: 'regex', name: t('tools.regex'), icon: 'search' },
        { id: 'uuid', name: t('tools.uuid'), icon: 'cpu' },
        { id: 'faker', name: t('tools.faker'), icon: 'user' },
        { id: 'qr', name: t('tools.qr'), icon: 'camera' },
      ],
    },
    {
      id: 'design',
      name: t('categories.design'),
      tools: [
        { id: 'css', name: t('tools.css'), icon: 'palette' },
        { id: 'svg', name: t('tools.svg'), icon: 'image' },
      ],
    },
    {
      id: 'reference',
      name: t('categories.reference'),
      tools: [
        { id: 'timestamp', name: t('tools.timestamp'), icon: 'clock' },
        { id: 'bases', name: t('tools.bases'), icon: 'calculator' },
        { id: 'cron', name: t('tools.cron'), icon: 'timer' },
        { id: 'text', name: t('tools.text'), icon: 'edit' },
        { id: 'table', name: t('tools.table'), icon: 'table' },
        { id: 'cheatsheet', name: t('tools.cheatsheet'), icon: 'book' },
      ],
    },
  ];

  /** @type {Record<string, HTMLButtonElement>} */
  const toolButtons = {};
  /** @type {Record<string, HTMLElement>} */
  const toolPanes = {};
  let activeTool = 'json';

  // Build sidebar
  for (const cat of categories) {
    const catHeader = h('li', { class: 'nx-devtools-category-header' }, cat.name);
    toolsList.append(catHeader);
    for (const tool of cat.tools) {
      const btn = h(
        'button',
        { class: `nx-devtools-tool-btn${tool.id === activeTool ? ' active' : ''}` },
        icon(tool.icon, { size: 14 }),
        tool.name,
      );
      toolButtons[tool.id] = btn;
      btn.addEventListener('click', () => selectTool(tool.id));
      toolsList.append(h('li', {}, btn));

      const pane = h('div', { class: 'nx-devtools-tool-pane' });
      if (tool.id !== activeTool) pane.hidden = true;
      toolPanes[tool.id] = pane;
      mainArea.append(pane);
    }
  }

  function selectTool(/** @type {string} */ id) {
    if (!toolPanes[id]) return;
    activeTool = id;
    for (const k of Object.keys(toolButtons)) {
      toolButtons[k].classList.toggle('active', k === id);
      toolPanes[k].hidden = k !== id;
    }
  }

  // Sidebar search filtering
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    for (const cat of categories) {
      for (const tool of cat.tools) {
        const match = tool.name.toLowerCase().includes(q) || tool.id.includes(q);
        const li = toolButtons[tool.id]?.parentElement;
        if (li) li.style.display = match ? 'block' : 'none';
      }
    }
  });

  // ─── TOOL 1: JSON Toolkit ──────────────────────────────────────────
  const jsonLayout = createToolLayout({
    title: 'JSON Toolkit',
    iconName: 'file-code',
    inputTitle: 'JSON Input',
    outputTitle: 'Formatted / Converted',
    inputPlaceholder: 'Paste JSON here...',
    outputPlaceholder: 'Output will appear here...',
    allowSwap: true,
    onInput: (text) => {
      const val = validateJson(text);
      if (val.valid) {
        jsonLayout.setStatus('Valid JSON', 'success');
      } else {
        jsonLayout.setStatus(`Syntax Error: ${val.error} (line ${val.line}, col ${val.column})`, 'error');
      }
    },
  });

  // JSON action controls
  const formatBtn = h('button', { class: 'nx-button small primary' }, t('common.format'));
  formatBtn.addEventListener('click', () => {
    try {
      jsonLayout.setOutput(formatJson(jsonLayout.inputTextarea.value, '2'));
      jsonLayout.setStatus('Formatted with 2 spaces', 'success', 2000);
    } catch (e) {
      jsonLayout.setStatus(String(e.message || e), 'error');
    }
  });

  const minifyBtn = h('button', { class: 'nx-button small ghost' }, t('common.minify'));
  minifyBtn.addEventListener('click', () => {
    try {
      jsonLayout.setOutput(minifyJson(jsonLayout.inputTextarea.value));
      jsonLayout.setStatus('Minified JSON', 'success', 2000);
    } catch (e) {
      jsonLayout.setStatus(String(e.message || e), 'error');
    }
  });

  const sortBtn = h('button', { class: 'nx-button small ghost' }, 'Sort Keys');
  sortBtn.addEventListener('click', () => {
    try {
      const sorted = sortJsonKeys(JSON.parse(jsonLayout.inputTextarea.value));
      jsonLayout.setOutput(JSON.stringify(sorted, null, 2));
      jsonLayout.setStatus('Sorted JSON keys', 'success', 2000);
    } catch (e) {
      jsonLayout.setStatus(String(e.message || e), 'error');
    }
  });

  const toCsvBtn = h('button', { class: 'nx-button small ghost' }, 'JSON → CSV');
  toCsvBtn.addEventListener('click', () => {
    try {
      jsonLayout.setOutput(jsonToCsv(jsonLayout.inputTextarea.value));
      jsonLayout.setStatus('Converted to CSV', 'success', 2000);
    } catch (e) {
      jsonLayout.setStatus(String(e.message || e), 'error');
    }
  });

  const toYamlBtn = h('button', { class: 'nx-button small ghost' }, 'JSON → YAML');
  toYamlBtn.addEventListener('click', () => {
    try {
      jsonLayout.setOutput(jsonToYaml(JSON.parse(jsonLayout.inputTextarea.value)));
      jsonLayout.setStatus('Converted to YAML', 'success', 2000);
    } catch (e) {
      jsonLayout.setStatus(String(e.message || e), 'error');
    }
  });

  const toTypesBtn = h('button', { class: 'nx-button small ghost' }, 'JSON → TS Types');
  toTypesBtn.addEventListener('click', () => {
    try {
      const types = jsonToTypes(jsonLayout.inputTextarea.value);
      jsonLayout.setOutput(types.typescript);
      jsonLayout.setStatus('Generated TypeScript types', 'success', 2000);
    } catch (e) {
      jsonLayout.setStatus(String(e.message || e), 'error');
    }
  });

  jsonLayout.optionsBar.append(formatBtn, minifyBtn, sortBtn, toCsvBtn, toYamlBtn, toTypesBtn);
  jsonLayout.optionsBar.hidden = false;
  jsonLayout.setInput(
    '{\n  "title": "Nexus Arcade OS",\n  "version": "1.0.0",\n  "features": ["Offline-first", "PWA", "Desktop UI"],\n  "system": {\n    "kernel": true,\n    "vfs": true\n  }\n}',
  );
  toolPanes.json.append(jsonLayout.root);

  // ─── TOOL 2: Encoding & Crypto ─────────────────────────────────────
  let cryptoOp = 'base64';
  let cryptoAction = 'encode';

  const cryptoLayout = createToolLayout({
    title: 'Encoding & Crypto',
    iconName: 'key',
    inputTitle: 'Input Text / Data',
    outputTitle: 'Output Result',
    allowSwap: true,
    onInput: () => runCrypto(),
  });

  const opSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'base64' }, 'Base64'),
    h('option', { value: 'base64url' }, 'Base64 URL-safe'),
    h('option', { value: 'base32' }, 'Base32'),
    h('option', { value: 'hex' }, 'Hexadecimal'),
    h('option', { value: 'binary' }, 'Binary (01)'),
    h('option', { value: 'url' }, 'URL Encode'),
    h('option', { value: 'html' }, 'HTML Entities'),
    h('option', { value: 'unicode' }, 'Unicode Escapes'),
    h('option', { value: 'punycode' }, 'Punycode'),
    h('option', { value: 'md5' }, 'MD5 Hash'),
    h('option', { value: 'sha256' }, 'SHA-256 Hash'),
    h('option', { value: 'sha512' }, 'SHA-512 Hash'),
    h('option', { value: 'crc32' }, 'CRC32 Hash'),
    h('option', { value: 'hmac256' }, 'HMAC-SHA256'),
    h('option', { value: 'aes' }, 'AES-GCM (Password Encrypt)'),
    h('option', { value: 'rsa' }, 'RSA KeyPair Generator'),
  );

  const actionSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'encode' }, 'Encode / Hash'),
    h('option', { value: 'decode' }, 'Decode / Decrypt'),
  );

  const secretInput = h('input', {
    type: 'password',
    placeholder: 'Secret Key / Password...',
    class: 'nx-tool-format-input',
    style:
      'display: none; width: 180px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px;',
  });

  cryptoLayout.optionsBar.append(opSelect, actionSelect, secretInput);
  cryptoLayout.optionsBar.hidden = false;

  async function runCrypto() {
    const text = cryptoLayout.inputTextarea.value;
    // @ts-ignore
    cryptoOp = opSelect.value;
    // @ts-ignore
    cryptoAction = actionSelect.value;

    secretInput.style.display = ['hmac256', 'aes'].includes(cryptoOp) ? 'inline-block' : 'none';

    try {
      let out = '';
      if (cryptoOp === 'base64') {
        out = cryptoAction === 'encode' ? base64Encode(text) : base64Decode(text);
      } else if (cryptoOp === 'base64url') {
        out = cryptoAction === 'encode' ? base64Encode(text, true) : base64Decode(text);
      } else if (cryptoOp === 'base32') {
        out = cryptoAction === 'encode' ? base32Encode(text) : base32Decode(text);
      } else if (cryptoOp === 'hex') {
        out = cryptoAction === 'encode' ? hexEncode(text) : hexDecode(text);
      } else if (cryptoOp === 'binary') {
        out =
          cryptoAction === 'encode'
            ? Array.from(new TextEncoder().encode(text))
                .map((b) => b.toString(2).padStart(8, '0'))
                .join(' ')
            : text
                .trim()
                .split(/\s+/)
                .map((b) => String.fromCharCode(parseInt(b, 2)))
                .join('');
      } else if (cryptoOp === 'url') {
        out = cryptoAction === 'encode' ? encodeURIComponent(text) : decodeURIComponent(text);
      } else if (cryptoOp === 'html') {
        out = cryptoAction === 'encode' ? htmlEntitiesEncode(text) : htmlEntitiesDecode(text);
      } else if (cryptoOp === 'unicode') {
        out = cryptoAction === 'encode' ? unicodeEscape(text) : unicodeUnescape(text);
      } else if (cryptoOp === 'punycode') {
        out = cryptoAction === 'encode' ? punycodeEncode(text) : punycodeDecode(text);
      } else if (cryptoOp === 'md5') {
        out = md5(text);
      } else if (cryptoOp === 'sha256') {
        out = await cryptoHash('SHA-256', text);
      } else if (cryptoOp === 'sha512') {
        out = await cryptoHash('SHA-512', text);
      } else if (cryptoOp === 'crc32') {
        out = crc32(text);
      } else if (cryptoOp === 'hmac256') {
        out = await hmac('SHA-256', secretInput.value, text);
      } else if (cryptoOp === 'aes') {
        out =
          cryptoAction === 'encode'
            ? await aesEncrypt(secretInput.value, text)
            : await aesDecrypt(secretInput.value, text);
      } else if (cryptoOp === 'rsa') {
        const pair = await generateKeyPair('RSA');
        out = `${pair.publicKey}\n${pair.privateKey}`;
      }
      cryptoLayout.setOutput(out);
      cryptoLayout.setStatus('Processed successfully', 'success', 2000);
    } catch (err) {
      cryptoLayout.setStatus(String(err.message || err), 'error');
    }
  }

  opSelect.addEventListener('change', () => runCrypto());
  actionSelect.addEventListener('change', () => runCrypto());
  secretInput.addEventListener('input', () => runCrypto());

  cryptoLayout.setInput('Hello Nexus Arcade OS 2026!');
  toolPanes.crypto.append(cryptoLayout.root);

  // ─── TOOL 3: Regex Tester ──────────────────────────────────────────
  const regexLayout = createToolLayout({
    title: 'Regex Tester',
    iconName: 'search',
    inputTitle: 'Test String',
    outputTitle: 'Matches & Replacement',
    onInput: () => runRegex(),
  });

  const patternInput = h('input', {
    type: 'text',
    value: '\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b',
    placeholder: 'Regular expression pattern...',
    style:
      'flex: 1; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 13px; color: var(--text-1); background: var(--surface-1);',
  });

  const flagsInput = h('input', {
    type: 'text',
    value: 'gmi',
    placeholder: 'flags (g, i, m, s, u)',
    style:
      'width: 70px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 13px; color: var(--text-1); background: var(--surface-1);',
  });

  const patternSelect = h('select', { class: 'nx-select' }, h('option', { value: '' }, 'Presets...'));
  for (const pat of COMMON_PATTERNS) {
    patternSelect.append(h('option', { value: pat.id }, pat.name));
  }
  patternSelect.addEventListener('change', () => {
    // @ts-ignore
    const p = COMMON_PATTERNS.find((x) => x.id === patternSelect.value);
    if (p) {
      patternInput.value = p.pattern;
      flagsInput.value = p.flags;
      runRegex();
    }
  });

  regexLayout.optionsBar.append(
    h('label', { style: 'font-weight: 600;' }, 'Pattern:'),
    patternInput,
    flagsInput,
    patternSelect,
  );
  regexLayout.optionsBar.hidden = false;

  function runRegex() {
    const text = regexLayout.inputTextarea.value;
    const pattern = patternInput.value;
    const flags = flagsInput.value;

    try {
      const re = new RegExp(pattern, flags);
      const matches = [];
      let m;
      if (flags.includes('g')) {
        while ((m = re.exec(text)) !== null) {
          matches.push(m);
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        m = re.exec(text);
        if (m) matches.push(m);
      }

      let out = `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}:\n\n`;
      matches.forEach((item, idx) => {
        out += `[#${idx + 1}] at index ${item.index}: "${item[0]}"\n`;
        if (item.length > 1) {
          out += `  Captures: ${item
            .slice(1)
            .map((g, gi) => `$${gi + 1}=${g}`)
            .join(', ')}\n`;
        }
        if (item.groups) {
          out += `  Named: ${JSON.stringify(item.groups)}\n`;
        }
      });

      // Explanation
      const explanation = explainRegex(pattern, 'en');
      out += '\n─── Pattern Explanation ───\n';
      explanation.forEach((exp) => {
        out += `${exp.token.padEnd(12)} : ${exp.explanation}\n`;
      });

      regexLayout.setOutput(out);
      regexLayout.setStatus(`${matches.length} matches found`, 'success', 2000);
    } catch (err) {
      regexLayout.setStatus(String(err.message || err), 'error');
    }
  }

  patternInput.addEventListener('input', runRegex);
  flagsInput.addEventListener('input', runRegex);

  regexLayout.setInput('Contact us at support@nexus-os.local or dev-team@example.com for assistance.');
  toolPanes.regex.append(regexLayout.root);

  // ─── TOOL 4: JWT Debugger ──────────────────────────────────────────
  const jwtLayout = createToolLayout({
    title: 'JWT Debugger',
    iconName: 'shield',
    inputTitle: 'Encoded Token',
    outputTitle: 'Decoded Header & Payload',
    inputPlaceholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    onInput: (tok) => {
      try {
        const dec = decodeJwt(tok);
        const out = `─── HEADER ───\n${JSON.stringify(dec.header, null, 2)}\n\n─── PAYLOAD ───\n${JSON.stringify(dec.payload, null, 2)}\n\n─── STATUS ───\nExpired: ${dec.expired} (Expires: ${dec.expiresAt || 'Never'})\nSignature: ${dec.signature}`;
        jwtLayout.setOutput(out);
        jwtLayout.setStatus(
          dec.expired ? 'Token has expired!' : 'Token valid & active',
          dec.expired ? 'error' : 'success',
        );
      } catch (e) {
        jwtLayout.setStatus(String(e.message || e), 'error');
      }
    },
  });
  jwtLayout.setInput(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoyNTIwMDAwMDAwfQ.signature-placeholder',
  );
  toolPanes.jwt.append(jwtLayout.root);

  // ─── TOOL 5: UUID / ULID / NanoID ──────────────────────────────────
  const uuidLayout = createToolLayout({
    title: 'UUID / ULID / NanoID Generator',
    iconName: 'cpu',
    singlePane: true,
    inputTitle: 'Generated Identifiers',
  });

  const uuidType = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'v4' }, 'UUID v4 (Random)'),
    h('option', { value: 'v7' }, 'UUID v7 (Time-Ordered)'),
    h('option', { value: 'ulid' }, 'ULID'),
    h('option', { value: 'nanoid' }, 'NanoID'),
  );

  const countInput = h('input', {
    type: 'number',
    value: '5',
    min: '1',
    max: '500',
    style: 'width: 60px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-sm);',
  });

  const genUuidBtn = h('button', { class: 'nx-button primary small' }, t('common.generate'));

  uuidLayout.optionsBar.append(
    h('label', { style: 'font-weight: 600;' }, 'Type:'),
    uuidType,
    h('label', { style: 'font-weight: 600;' }, 'Count:'),
    countInput,
    genUuidBtn,
  );
  uuidLayout.optionsBar.hidden = false;

  function runGenUuids() {
    // @ts-ignore
    const type = uuidType.value;
    const count = Math.min(Math.max(Number(countInput.value) || 1, 1), 500);
    const list = [];
    for (let i = 0; i < count; i++) {
      if (type === 'v4') list.push(generateUuidV4());
      else if (type === 'v7') list.push(generateUuidV7());
      else if (type === 'ulid') list.push(generateUlid());
      else if (type === 'nanoid') list.push(generateNanoId());
    }
    uuidLayout.inputTextarea.value = list.join('\n');
    uuidLayout.updateStats();
    uuidLayout.setStatus(`Generated ${count} ${type.toUpperCase()} IDs`, 'success', 2000);
  }
  genUuidBtn.addEventListener('click', runGenUuids);
  runGenUuids();
  toolPanes.uuid.append(uuidLayout.root);

  // ─── TOOL 6: Timestamp Converter ───────────────────────────────────
  const tsLayout = createToolLayout({
    title: 'Timestamp Converter',
    iconName: 'clock',
    inputTitle: 'Timestamp / ISO Date Input',
    outputTitle: 'Converted Formats',
    onInput: (val) => {
      try {
        const res = convertTimestamp(val);
        const out = `Unix Seconds:      ${res.unixSec}\nUnix Milliseconds: ${res.unixMs}\nISO 8601 (UTC):    ${res.iso}\nLocal String:      ${res.local}\nUTC String:        ${res.utc}\nRelative:          ${res.relative}`;
        tsLayout.setOutput(out);
        tsLayout.setStatus('Converted successfully', 'success', 2000);
      } catch (e) {
        tsLayout.setStatus(String(e.message || e), 'error');
      }
    },
  });
  const nowBtn = h('button', { class: 'nx-button small primary' }, 'Set to Current Time');
  nowBtn.addEventListener('click', () => {
    tsLayout.setInput(String(Math.floor(Date.now() / 1000)));
  });
  tsLayout.optionsBar.append(nowBtn);
  tsLayout.optionsBar.hidden = false;
  tsLayout.setInput(String(Math.floor(Date.now() / 1000)));
  toolPanes.timestamp.append(tsLayout.root);

  // ─── TOOL 7: Number Base Converter ─────────────────────────────────
  const basesLayout = createToolLayout({
    title: 'Number Base Converter',
    iconName: 'calculator',
    inputTitle: 'Number Input',
    outputTitle: 'Bases & Representations',
    onInput: (val) => {
      try {
        const res = convertNumberBase(val, 10);
        const out = `Decimal:     ${res.decimal}\nHexadecimal: 0x${res.bases[16]}\nBinary:      0b${res.bases[2]}\nOctal:       0o${res.bases[8]}\n\n─── Two's Complement ───\n8-bit:       ${res.comp8}\n16-bit:      ${res.comp16}\n32-bit:      ${res.comp32}\n\n─── Byte Order (32-bit) ───\nBig Endian:    ${res.bigEndian}\nLittle Endian: ${res.littleEndian}`;
        basesLayout.setOutput(out);
        basesLayout.setStatus('Converted successfully', 'success', 2000);
      } catch (e) {
        basesLayout.setStatus(String(e.message || e), 'error');
      }
    },
  });
  basesLayout.setInput('255');
  toolPanes.bases.append(basesLayout.root);

  // ─── TOOL 8: Cron Expression Tool ──────────────────────────────────
  const cronLayout = createToolLayout({
    title: 'Cron Expression Tool',
    iconName: 'timer',
    inputTitle: 'Cron Expression (min hour dom mon dow)',
    outputTitle: 'Explanation & Next Runs',
    onInput: (expr) => {
      try {
        const res = parseCron(expr, 'en');
        const out = `Explanation: ${res.desc}\n\n─── Next 10 Runs ───\n${res.nextDates.map((d, i) => `#${i + 1}: ${d}`).join('\n')}`;
        cronLayout.setOutput(out);
        cronLayout.setStatus('Valid cron expression', 'success', 2000);
      } catch (e) {
        cronLayout.setStatus(String(e.message || e), 'error');
      }
    },
  });
  cronLayout.setInput('0 */2 * * *');
  toolPanes.cron.append(cronLayout.root);

  // ─── TOOL 9: Text Utilities ────────────────────────────────────────
  const textLayout = createToolLayout({
    title: 'Text Utilities',
    iconName: 'edit',
    inputTitle: 'Input Text',
    outputTitle: 'Transformed Output & Stats',
    onInput: (str) => {
      const stats = textStats(str);
      textLayout.setStatus(
        `${stats.characters} chars, ${stats.words} words, ${stats.lines} lines, ${stats.bytes} bytes`,
      );
    },
  });

  const caseSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'camel' }, 'camelCase'),
    h('option', { value: 'pascal' }, 'PascalCase'),
    h('option', { value: 'snake' }, 'snake_case'),
    h('option', { value: 'kebab' }, 'kebab-case'),
    h('option', { value: 'constant' }, 'CONSTANT_CASE'),
    h('option', { value: 'title' }, 'Title Case'),
    h('option', { value: 'slug' }, 'slugify'),
    h('option', { value: 'sort' }, 'Sort Lines'),
    h('option', { value: 'dedupe' }, 'Deduplicate Lines'),
    h('option', { value: 'lorem' }, 'Lorem Ipsum (3 paragraphs)'),
  );

  const applyTextBtn = h('button', { class: 'nx-button small primary' }, 'Apply');
  applyTextBtn.addEventListener('click', () => {
    // @ts-ignore
    const mode = caseSelect.value;
    const val = textLayout.inputTextarea.value;
    let out;
    if (mode === 'slug') out = slugify(val);
    else if (mode === 'sort') out = val.split('\n').sort().join('\n');
    else if (mode === 'dedupe') out = Array.from(new Set(val.split('\n'))).join('\n');
    else if (mode === 'lorem') out = generateLorem(3);
    else out = textCaseConvert(val, mode);

    textLayout.setOutput(out);
  });

  textLayout.optionsBar.append(caseSelect, applyTextBtn);
  textLayout.optionsBar.hidden = false;
  textLayout.setInput('The quick brown fox jumps over the lazy dog.');
  toolPanes.text.append(textLayout.root);

  // ─── TOOL 10: Markdown Table Generator ─────────────────────────────
  const tableLayout = createToolLayout({
    title: 'Markdown Table Generator',
    iconName: 'table',
    singlePane: true,
    inputTitle: 'Generated Table Output',
  });

  /** @type {string[][]} */
  let tableData = [
    ['ID', 'Name', 'Role', 'Status'],
    ['1', 'Ada Lovelace', 'Engineer', 'Active'],
    ['2', 'Alan Turing', 'Cryptanalyst', 'Active'],
    ['3', 'Grace Hopper', 'Architect', 'Active'],
  ];

  const tableModeSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'markdown' }, 'Markdown'),
    h('option', { value: 'html' }, 'HTML <table>'),
    h('option', { value: 'csv' }, 'CSV'),
  );

  const addRowBtn = h('button', { class: 'nx-button small ghost' }, '+ Row');
  const addColBtn = h('button', { class: 'nx-button small ghost' }, '+ Col');

  tableLayout.optionsBar.append(tableModeSelect, addRowBtn, addColBtn);
  tableLayout.optionsBar.hidden = false;

  function renderTableOutput() {
    // @ts-ignore
    const mode = tableModeSelect.value;
    if (mode === 'markdown') {
      tableLayout.inputTextarea.value = generateMarkdownTable(tableData);
    } else if (mode === 'csv') {
      tableLayout.inputTextarea.value = tableData.map((r) => r.join(',')).join('\n');
    } else {
      let html = '<table>\n  <thead>\n    <tr>';
      tableData[0]?.forEach((c) => (html += `<th>${c}</th>`));
      html += '</tr>\n  </thead>\n  <tbody>\n';
      for (let i = 1; i < tableData.length; i++) {
        html += '    <tr>';
        tableData[i]?.forEach((c) => (html += `<td>${c}</td>`));
        html += '</tr>\n';
      }
      html += '  </tbody>\n</table>';
      tableLayout.inputTextarea.value = html;
    }
    tableLayout.updateStats();
  }

  addRowBtn.addEventListener('click', () => {
    tableData.push(Array(tableData[0]?.length || 2).fill(''));
    renderTableOutput();
  });
  addColBtn.addEventListener('click', () => {
    tableData.forEach((row, i) => row.push(i === 0 ? `Col ${row.length + 1}` : ''));
    renderTableOutput();
  });
  tableModeSelect.addEventListener('change', renderTableOutput);

  renderTableOutput();
  toolPanes.table.append(tableLayout.root);

  // ─── TOOL 11: CSS Generators ───────────────────────────────────────
  const cssLayout = createToolLayout({
    title: 'CSS Generators',
    iconName: 'palette',
    singlePane: true,
    inputTitle: 'Generated CSS',
  });

  const cssTypeSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'shadow' }, 'Box Shadow'),
    h('option', { value: 'radius' }, 'Border Radius'),
    h('option', { value: 'bezier' }, 'Cubic Bezier'),
  );

  cssLayout.optionsBar.append(cssTypeSelect);
  cssLayout.optionsBar.hidden = false;

  function updateCssTool() {
    // @ts-ignore
    const val = cssTypeSelect.value;
    if (val === 'shadow') {
      cssLayout.inputTextarea.value =
        'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);';
    } else if (val === 'radius') {
      cssLayout.inputTextarea.value = 'border-radius: 12px 12px 0 0;\n/* Full pill: border-radius: 9999px; */';
    } else {
      cssLayout.inputTextarea.value = 'transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);';
    }
    cssLayout.updateStats();
  }
  cssTypeSelect.addEventListener('change', updateCssTool);
  updateCssTool();
  toolPanes.css.append(cssLayout.root);

  // ─── TOOL 12: SVG Optimizer ────────────────────────────────────────
  const svgLayout = createToolLayout({
    title: 'SVG Optimizer',
    iconName: 'image',
    inputTitle: 'SVG Input',
    outputTitle: 'Optimized SVG & Data URI',
    onInput: (svg) => {
      const opt = optimizeSvg(svg);
      const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(opt)}`;
      svgLayout.setOutput(`${opt}\n\n─── DATA URI ───\n${dataUri}`);
    },
  });
  svgLayout.setInput(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">\n  <!-- icon comment -->\n  <circle cx="12.0001" cy="12.0001" r="10.0000" fill="#3b82f6"/>\n</svg>',
  );
  toolPanes.svg.append(svgLayout.root);

  // ─── TOOL 13: QR Code Generator ────────────────────────────────────
  const qrLayout = createToolLayout({
    title: 'QR Code Generator',
    iconName: 'camera',
    inputTitle: 'Text / URL to Encode',
    outputTitle: 'Generated SVG QR Code',
    onInput: (text) => {
      try {
        const svg = generateQrSvg(text);
        qrLayout.setOutput(svg);
      } catch (e) {
        qrLayout.setStatus(String(e.message || e), 'error');
      }
    },
  });
  qrLayout.setInput('https://nexus-arcade-os.onrender.com');
  toolPanes.qr.append(qrLayout.root);

  // ─── TOOL 14: Fake Data Generator ──────────────────────────────────
  const fakerLayout = createToolLayout({
    title: 'Fake Data Generator',
    iconName: 'user',
    singlePane: true,
    inputTitle: 'Generated JSON / CSV Data',
  });

  const fakerLocale = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'en' }, 'English (US)'),
    h('option', { value: 'de' }, 'German (DE)'),
  );
  const fakerCount = h('input', {
    type: 'number',
    value: '5',
    min: '1',
    max: '100',
    style: 'width: 60px; padding: 4px; border: 1px solid var(--border); border-radius: 4px;',
  });
  const genFakerBtn = h('button', { class: 'nx-button small primary' }, t('common.generate'));

  fakerLayout.optionsBar.append(fakerLocale, fakerCount, genFakerBtn);
  fakerLayout.optionsBar.hidden = false;

  function runGenFaker() {
    // @ts-ignore
    const loc = fakerLocale.value;
    const count = Number(fakerCount.value) || 5;
    const users = generateFakeUsers(count, loc);
    fakerLayout.inputTextarea.value = JSON.stringify(users, null, 2);
    fakerLayout.updateStats();
  }
  genFakerBtn.addEventListener('click', runGenFaker);
  runGenFaker();
  toolPanes.faker.append(fakerLayout.root);

  // ─── TOOL 15: Dev Cheatsheets ──────────────────────────────────────
  const csLayout = createToolLayout({
    title: 'Dev Cheatsheets',
    iconName: 'book',
    singlePane: true,
    inputTitle: 'Reference List',
  });
  csLayout.inputTextarea.value = `─── HTTP Status Codes ───
200 OK — Standard response for successful requests
201 Created — Request fulfilled, new resource created
204 No Content — Successful request, no response body
301 Moved Permanently — URI assigned to resource permanently
304 Not Modified — Cached version is current
400 Bad Request — Malformed request syntax
401 Unauthorized — Authentication required
403 Forbidden — Server refuses authorization
404 Not Found — Resource not found
422 Unprocessable Entity — Semantic errors in request
500 Internal Server Error — Server generic error
502 Bad Gateway — Invalid response from upstream
503 Service Unavailable — Server overloaded or maintenance

─── MIME Types ───
application/json       — JSON data
application/javascript — JavaScript code
text/html              — HTML document
text/css               — CSS stylesheet
image/svg+xml          — SVG graphic
image/png              — PNG image
image/jpeg             — JPEG image
application/pdf        — PDF document

─── Keyboard Event Key Codes ───
Enter: "Enter", Escape: "Escape", Space: " ", Tab: "Tab"
ArrowUp: "ArrowUp", ArrowDown: "ArrowDown"
Mod Key: event.metaKey (macOS) || event.ctrlKey (Windows/Linux)`;
  csLayout.updateStats();
  toolPanes.cheatsheet.append(csLayout.root);

  // Check args or intent for deep linking
  if (ctx.args?.tool) {
    selectTool(ctx.args.tool);
  }

  return () => {
    root.remove();
  };
}

export const commands = {
  'devtools.open': (ctx, args) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args }),
  'devtools.json': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'json' } }),
  'devtools.crypto': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'crypto' } }),
  'devtools.base64': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'crypto' } }),
  'devtools.hash': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'crypto' } }),
  'devtools.regex': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'regex' } }),
  'devtools.jwt': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'jwt' } }),
  'devtools.uuid': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'uuid' } }),
  'devtools.timestamp': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'timestamp' } }),
  'devtools.bases': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'bases' } }),
  'devtools.cron': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'cron' } }),
  'devtools.text': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'text' } }),
  'devtools.css': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'css' } }),
  'devtools.svg': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'svg' } }),
  'devtools.qr': (ctx) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'qr' } }),
  'devtools.faker': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'faker' } }),
  'devtools.cheatsheet': (ctx) =>
    ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: 'cheatsheet' } }),
};

export const terminal = {
  devtools: async (ctx, io) => {
    const args = io.args || [];
    await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.devtools', args: { tool: args[0] } });
    return 0;
  },
  base64: async (_ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      io.stderr?.('Usage: base64 [-d] <text>\n');
      return 1;
    }
    if (args[0] === '-d') {
      io.stdout?.(`${base64Decode(args.slice(1).join(' '))}\n`);
    } else {
      io.stdout?.(`${base64Encode(args.join(' '))}\n`);
    }
    return 0;
  },
  hash: async (_ctx, io) => {
    const args = io.args || [];
    if (args.length < 2) {
      io.stderr?.('Usage: hash <md5|sha256|sha512|crc32> <text>\n');
      return 1;
    }
    const algo = args[0].toLowerCase();
    const text = args.slice(1).join(' ');
    if (algo === 'md5') io.stdout?.(`${md5(text)}\n`);
    else if (algo === 'crc32') io.stdout?.(`${crc32(text)}\n`);
    else if (algo === 'sha256') io.stdout?.(`${await cryptoHash('SHA-256', text)}\n`);
    else if (algo === 'sha512') io.stdout?.(`${await cryptoHash('SHA-512', text)}\n`);
    else {
      io.stderr?.(`Unknown algorithm: ${algo}\n`);
      return 1;
    }
    return 0;
  },
  uuid: async (_ctx, io) => {
    const args = io.args || [];
    const v7 = args.includes('-v7');
    const count = Number(args.find((a) => !a.startsWith('-')) || 1);
    for (let i = 0; i < count; i++) {
      io.stdout?.(`${v7 ? generateUuidV7() : generateUuidV4()}\n`);
    }
    return 0;
  },
};
