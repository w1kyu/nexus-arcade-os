// @ts-check
// CodeMirror 6 Markdown editor for Nexus Notes with formatting commands, wiki-link (`[[...]]`)
// autocomplete, image paste/drop handling, and scroll synchronization.
import { autocompletion, startCompletion } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { LanguageDescription, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { openSearchPanel } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup, EditorView } from 'codemirror';
import contentCss from '../../ui/content.css?inline';

/** Shared token stylesheet for shadow roots. */
let tokenSheet = /** @type {CSSStyleSheet | null} */ (null);
const tokenStyles = () => {
  if (!tokenSheet) {
    tokenSheet = new CSSStyleSheet();
    tokenSheet.replaceSync(contentCss);
  }
  return tokenSheet;
};

const PHRASES_DE = {
  Find: 'Suchen',
  Replace: 'Ersetzen',
  next: 'Weiter',
  previous: 'Zurück',
  all: 'Alle',
  'match case': 'Groß/klein',
  regexp: 'Regulärer Ausdruck',
  'by word': 'Ganzes Wort',
  replace: 'Ersetzen',
  'replace all': 'Alle ersetzen',
  close: 'Schließen',
};

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--text-1)', backgroundColor: 'transparent', fontSize: '14px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', padding: '8px 0' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '0 14px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'color-mix(in srgb, var(--surface-1) 65%, transparent)',
    color: 'var(--text-3)',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--surface-2) 50%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-2)', color: 'var(--text-1)' },
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
 * @param {object} options
 * @param {string} options.text
 * @param {'en' | 'de'} options.locale
 * @param {boolean} [options.readOnly]
 * @param {() => string[]} options.getNoteTitles
 * @param {(text: string, docChanged: boolean) => void} options.onChange
 * @param {(files: File[]) => void} [options.onPasteImages]
 * @param {(ratio: number) => void} [options.onScroll]
 */
export function createNoteEditor({ text, locale, readOnly = false, getNoteTitles, onChange, onPasteImages, onScroll }) {
  const language = new Compartment();
  const editable = new Compartment();
  const phrases = new Compartment();

  const host = document.createElement('div');
  host.className = 'nx-notes-cm-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.adoptedStyleSheets = [tokenStyles()];

  /** Wiki-link completion source triggered after `[[`. */
  function wikiCompletion(/** @type {import('@codemirror/autocomplete').CompletionContext} */ context) {
    const before = context.matchBefore(/\[\[[^\]|#\n]*$/);
    if (!before) return null;
    const query = before.text.slice(2).toLowerCase();
    const titles = getNoteTitles();
    const options = titles
      .filter((t) => t.toLowerCase().includes(query))
      .map((t) => ({
        label: t,
        type: 'text',
        apply: `[[${t}]]`,
      }));
    return {
      from: before.from,
      options,
      filter: false,
    };
  }

  const view = new EditorView({
    root: shadow,
    parent: shadow,
    state: EditorState.create({
      doc: text,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        syntaxHighlighting(classHighlighter),
        theme,
        EditorView.lineWrapping,
        language.of([]),
        editable.of(EditorState.readOnly.of(readOnly)),
        phrases.of(locale === 'de' ? EditorState.phrases.of(PHRASES_DE) : []),
        autocompletion({ override: [wikiCompletion], activateOnTyping: true }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            onChange(u.state.doc.toString(), true);
          }
        }),
        EditorView.domEventHandlers({
          paste(event) {
            if (!onPasteImages || !event.clipboardData) return false;
            const images = [...event.clipboardData.files].filter((f) => f.type.startsWith('image/'));
            if (images.length) {
              event.preventDefault();
              onPasteImages(images);
              return true;
            }
            return false;
          },
          drop(event) {
            if (!onPasteImages || !event.dataTransfer) return false;
            const images = [...event.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
            if (images.length) {
              event.preventDefault();
              onPasteImages(images);
              return true;
            }
            return false;
          },
        }),
        EditorView.contentAttributes.of({ 'aria-label': 'Note markdown editor' }),
      ],
    }),
  });
  view.scrollDOM.tabIndex = 0;

  // Load Markdown language parser lazily.
  const mdDesc = LanguageDescription.matchFilename(languages, 'note.md');
  if (mdDesc) {
    void mdDesc.load().then((support) => {
      view.dispatch({ effects: language.reconfigure(support) });
    });
  }

  if (onScroll) {
    view.scrollDOM.addEventListener('scroll', () => {
      const max = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
      onScroll(max > 0 ? view.scrollDOM.scrollTop / max : 0);
    });
  }

  /**
   * Wraps selection with `before` and `after` (or inserts `placeholder` inside).
   * @param {string} before
   * @param {string} after
   * @param {string} [placeholder]
   */
  function wrapSelection(before, after, placeholder = 'text') {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const inner = selected || placeholder;
    const replacement = `${before}${inner}${after}`;
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + before.length, head: from + before.length + inner.length },
    });
    view.focus();
  }

  /**
   * Prefixes the current line(s) with `prefix`.
   * @param {string} prefix
   */
  function prefixLine(prefix) {
    const { from, to } = view.state.selection.main;
    const startLine = view.state.doc.lineAt(from);
    const endLine = view.state.doc.lineAt(to);
    /** @type {{ from: number, to: number, insert: string }[]} */
    const changes = [];
    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = view.state.doc.line(n);
      if (line.text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
      } else {
        changes.push({ from: line.from, to: line.from, insert: prefix });
      }
    }
    view.dispatch({ changes });
    view.focus();
  }

  /**
   * Inserts raw text at the current cursor position.
   * @param {string} snippet
   */
  function insertText(snippet) {
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length },
    });
    view.focus();
  }

  /**
   * Applies a toolbar formatting command.
   * @param {'bold' | 'italic' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'task' | 'code' | 'codeblock' | 'quote' | 'link' | 'wikilink' | 'table' | 'hr' | 'math'} action
   */
  function format(action) {
    switch (action) {
      case 'bold':
        wrapSelection('**', '**', 'bold');
        break;
      case 'italic':
        wrapSelection('*', '*', 'italic');
        break;
      case 'h1':
        prefixLine('# ');
        break;
      case 'h2':
        prefixLine('## ');
        break;
      case 'h3':
        prefixLine('### ');
        break;
      case 'ul':
        prefixLine('- ');
        break;
      case 'ol':
        prefixLine('1. ');
        break;
      case 'task':
        prefixLine('- [ ] ');
        break;
      case 'code':
        wrapSelection('`', '`', 'code');
        break;
      case 'codeblock':
        wrapSelection('\n```js\n', '\n```\n', '// code');
        break;
      case 'quote':
        prefixLine('> ');
        break;
      case 'link':
        wrapSelection('[', '](https://)', 'link');
        break;
      case 'wikilink':
        wrapSelection('[[', ']]', 'Note');
        startCompletion(view);
        break;
      case 'table':
        insertText('\n| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |\n');
        break;
      case 'hr':
        insertText('\n---\n');
        break;
      case 'math':
        wrapSelection('$', '$', 'E = mc^2');
        break;
    }
  }

  return {
    view,
    dom: host,
    get text() {
      return view.state.doc.toString();
    },
    /** @param {string} next */
    setText(next) {
      const current = view.state.doc.toString();
      if (current === next) return;
      const head = Math.min(view.state.selection.main.head, next.length);
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next }, selection: { anchor: head } });
    },
    /** @param {boolean} on */
    setReadOnly: (on) => view.dispatch({ effects: editable.reconfigure(EditorState.readOnly.of(on)) }),
    /** @param {'en' | 'de'} next */
    setLocale: (next) =>
      view.dispatch({ effects: phrases.reconfigure(next === 'de' ? EditorState.phrases.of(PHRASES_DE) : []) }),
    /** @param {number} lineNumber 1-based */
    scrollToLine(lineNumber) {
      const line = view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines)));
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' }),
      });
      view.focus();
    },
    /** @param {number} ratio 0..1 */
    setScrollRatio(ratio) {
      const max = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
      if (max > 0) view.scrollDOM.scrollTop = ratio * max;
    },
    format,
    insertText,
    find: () => openSearchPanel(view),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
