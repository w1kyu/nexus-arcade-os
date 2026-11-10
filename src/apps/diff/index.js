// @ts-check
import { createDiffViewer } from '../../ui/diff.js';
import { h, icon } from '../../ui/dom.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  let oldText = 'function hello() {\n  console.log("Hello World");\n}\n';
  let newText = 'function hello(name = "World") {\n  console.log(`Hello ${name}!`);\n}\n';

  const root = h('div', { class: 'nx-diff-app' });

  // Inputs Bar
  const bar = h('div', { class: 'nx-diff-inputs-bar' });

  // File A
  const slotA = h('div', { class: 'nx-diff-input-slot' });
  const labelA = h('label', {}, t('labels.original'));
  const inputA = h('input', { type: 'text', placeholder: 'Path or paste text...', value: 'original.js' });
  const btnFileA = h(
    'button',
    { class: 'nx-button ghost small', title: t('labels.openVfs') },
    icon('folder', { size: 14 }),
  );
  const btnPasteA = h(
    'button',
    { class: 'nx-button ghost small', title: t('labels.paste') },
    icon('clipboard', { size: 14 }),
  );
  slotA.append(labelA, inputA, btnFileA, btnPasteA);

  // Swap button
  const swapBtn = h(
    'button',
    { class: 'nx-button ghost small', title: t('labels.swap') },
    icon('arrow-left', { size: 14 }),
    icon('arrow-right', { size: 14 }),
  );

  // File B
  const slotB = h('div', { class: 'nx-diff-input-slot' });
  const labelB = h('label', {}, t('labels.modified'));
  const inputB = h('input', { type: 'text', placeholder: 'Path or paste text...', value: 'modified.js' });
  const btnFileB = h(
    'button',
    { class: 'nx-button ghost small', title: t('labels.openVfs') },
    icon('folder', { size: 14 }),
  );
  const btnPasteB = h(
    'button',
    { class: 'nx-button ghost small', title: t('labels.paste') },
    icon('clipboard', { size: 14 }),
  );
  slotB.append(labelB, inputB, btnFileB, btnPasteB);

  bar.append(slotA, swapBtn, slotB);

  // Diff Viewer Body
  const body = h('div', { class: 'nx-diff-body' });
  const diffViewer = createDiffViewer({ oldText, newText });
  body.append(diffViewer.root);

  root.append(bar, body);
  container.append(root);

  // Handle VFS file opens
  btnFileA.addEventListener('click', async () => {
    try {
      const file = await ctx.dialog?.openFile?.({ filter: '*/*' });
      if (file?.path) {
        const content = await ctx.vfs?.readText?.(file.path);
        if (content !== undefined) {
          oldText = content;
          inputA.value = file.path;
          diffViewer.setValues(oldText, newText);
        }
      }
    } catch (e) {
      ctx.notifications?.notify?.({ title: t('messages.fileError', { name: String(e) }), level: 'error' });
    }
  });

  btnFileB.addEventListener('click', async () => {
    try {
      const file = await ctx.dialog?.openFile?.({ filter: '*/*' });
      if (file?.path) {
        const content = await ctx.vfs?.readText?.(file.path);
        if (content !== undefined) {
          newText = content;
          inputB.value = file.path;
          diffViewer.setValues(oldText, newText);
        }
      }
    } catch (e) {
      ctx.notifications?.notify?.({ title: t('messages.fileError', { name: String(e) }), level: 'error' });
    }
  });

  btnPasteA.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        oldText = text;
        inputA.value = '(pasted text)';
        diffViewer.setValues(oldText, newText);
      }
    } catch {
      // ignore
    }
  });

  btnPasteB.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        newText = text;
        inputB.value = '(pasted text)';
        diffViewer.setValues(oldText, newText);
      }
    } catch {
      // ignore
    }
  });

  swapBtn.addEventListener('click', () => {
    const tempT = oldText;
    oldText = newText;
    newText = tempT;

    const tempVal = inputA.value;
    inputA.value = inputB.value;
    inputB.value = tempVal;

    diffViewer.setValues(oldText, newText);
  });

  // Check intent or launch parameters
  if (ctx.intent?.data?.fileA) {
    void (async () => {
      try {
        const a = await ctx.vfs.readText(ctx.intent.data.fileA);
        oldText = a;
        inputA.value = ctx.intent.data.fileA;
        if (ctx.intent.data.fileB) {
          const b = await ctx.vfs.readText(ctx.intent.data.fileB);
          newText = b;
          inputB.value = ctx.intent.data.fileB;
        }
        diffViewer.setValues(oldText, newText);
      } catch {
        // ignore
      }
    })();
  }

  return () => {
    root.remove();
  };
}

export const commands = {
  'diff.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.diff', args });
  },
};

export const terminal = {
  diff: async (ctx, io) => {
    const args = io.args || [];
    if (args.length < 2) {
      io.stderr?.('Usage: diff <file1> <file2>\n');
      return 1;
    }
    try {
      const fs = /** @type {any} */ (ctx.fs);
      const textA = await fs.readFile(args[0], { as: 'text' });
      const textB = await fs.readFile(args[1], { as: 'text' });
      const { diffLines } = await import('../../ui/diff.js');
      const { diff } = diffLines(textA, textB);
      for (const item of diff) {
        if (item.type === 'delete') io.stdout?.(`\x1b[31m-${item.aItem}\x1b[0m\n`);
        else if (item.type === 'insert') io.stdout?.(`\x1b[32m+${item.bItem}\x1b[0m\n`);
        else io.stdout?.(` ${item.aItem}\n`);
      }
      return 0;
    } catch (err) {
      io.stderr?.(`diff: ${String(err.message || err)}\n`);
      return 1;
    }
  },
};
