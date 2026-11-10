// @ts-check
// CodeMirror 6 integration for Nexus Code editor.
import { startCompletion } from '@codemirror/autocomplete';
import { indentWithTab, toggleComment } from '@codemirror/commands';
import { LanguageDescription, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { gotoLine, openSearchPanel } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup, EditorView } from 'codemirror';
import contentCss from '../../ui/content.css?inline';

let tokenSheet = /** @type {CSSStyleSheet | null} */ (null);
const tokenStyles = () => {
  if (!tokenSheet) {
    tokenSheet = new CSSStyleSheet();
    tokenSheet.replaceSync(contentCss);
  }
  return tokenSheet;
};

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--text-1)', backgroundColor: 'transparent' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'color-mix(in srgb, var(--surface-1) 70%, transparent)',
    color: 'var(--text-3)',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--surface-2) 55%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-2)', color: 'var(--text-1)' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', outline: 'none' },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--accent-2) 18%, transparent)' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--warning) 30%, transparent)' },
  '.cm-panels': { backgroundColor: 'var(--surface-1)', color: 'var(--text-1)', borderColor: 'var(--border)' },
  '.cm-textfield': {
    backgroundColor: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-1)',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-1)',
  },
  '.cm-tooltip': { backgroundColor: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-contrast)',
  },
});

/**
 * Finds language description for file name.
 * @param {string} name
 */
export function languageFor(name) {
  return LanguageDescription.matchFilename(languages, name);
}

/**
 * Creates CodeMirror editor instance.
 * @param {object} options
 * @param {string} options.text
 * @param {string} options.name
 * @param {(update: { docChanged: boolean, line: number, column: number, selected: number }) => void} options.onUpdate
 * @param {() => void} [options.onSave]
 */
export function createCodeEditor({ text, name, onUpdate, onSave }) {
  const language = new Compartment();
  const host = document.createElement('div');
  host.className = 'nx-code-editor-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.adoptedStyleSheets = [tokenStyles()];

  const customKeys = keymap.of([
    indentWithTab,
    { key: 'Mod-/', run: toggleComment },
    { key: 'Mod-f', run: openSearchPanel },
    {
      key: 'Mod-s',
      run: () => {
        onSave?.();
        return true;
      },
    },
    { key: 'Ctrl-Space', run: startCompletion },
  ]);

  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [
        basicSetup,
        theme,
        syntaxHighlighting(classHighlighter),
        customKeys,
        language.of([]),
        EditorView.updateListener.of((u) => {
          const sel = u.state.selection.main;
          const line = u.state.doc.lineAt(sel.head);
          onUpdate({
            docChanged: u.docChanged,
            line: line.number,
            column: sel.head - line.from + 1,
            selected: Math.abs(sel.to - sel.from),
          });
        }),
      ],
    }),
    root: shadow,
    parent: shadow,
  });

  const langDesc = languageFor(name);
  if (langDesc) {
    langDesc
      .load()
      .then((support) => {
        view.dispatch({ effects: language.reconfigure(support) });
      })
      .catch(() => {});
  }

  return {
    host,
    view,
    get text() {
      return view.state.doc.toString();
    },
    setText(newText) {
      if (newText === view.state.doc.toString()) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newText },
      });
    },
    setName(newName) {
      const nextLang = languageFor(newName);
      if (nextLang) {
        nextLang
          .load()
          .then((support) => {
            view.dispatch({ effects: language.reconfigure(support) });
          })
          .catch(() => {});
      } else {
        view.dispatch({ effects: language.reconfigure([]) });
      }
    },
    focus() {
      view.focus();
    },
    goToLine(lineNum) {
      gotoLine(view);
      const line = Math.max(1, Math.min(lineNum, view.state.doc.lines));
      const pos = view.state.doc.line(line).from;
      view.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });
    },
    openSearch() {
      openSearchPanel(view);
    },
    destroy() {
      view.destroy();
    },
  };
}
