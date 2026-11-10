// @ts-check
// Nexus Flashcards: decks & subdecks, Markdown + KaTeX math, cloze deletion,
// FSRS spaced repetition, keyboard-only study, CSV & Anki .apkg import.
import { button, h, replace } from '../../ui/dom.js';
import { renderMarkdownInto } from '../../ui/markdown.js';
import { openModal } from '../../ui/overlay.js';
import { createNewCardFSRS, nextIntervalDays, scheduleCard } from './fsrs.js';
import {
  computeDeckStudyCounts,
  exportCardsToCSV,
  importAnkiApkg,
  renderClozeBack,
  renderClozeFront,
} from './model.js';
import './styles.css';

/** @typedef {import('./model.js').Deck} Deck */
/** @typedef {import('./model.js').Flashcard} Flashcard */
/** @typedef {import('./model.js').CardType} CardType */

/**
 * Terminal command handler: `flashcards [study | stats | decks]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async flashcards(ctx, io) {
    const decksCol = /** @type {import('../../kernel/types').Collection<Deck>} */ (ctx.storage.collection('decks'));
    const cardsCol = /** @type {import('../../kernel/types').Collection<Flashcard>} */ (
      ctx.storage.collection('cards')
    );

    const decks = await decksCol.all();
    const cards = await cardsCol.all();
    const sub = io.args[0] ?? 'decks';

    if (sub === 'decks' || sub === 'stats') {
      io.out(`--- Flashcards Decks (${decks.length}) ---\n`);
      for (const d of decks) {
        const deckCards = cards.filter((c) => c.deckId === d.id);
        const counts = computeDeckStudyCounts(deckCards);
        io.out(
          `• ${d.name}: ${counts.dueCount} Due, ${counts.learningCount} Learn, ${counts.newCount} New (${counts.totalCount} total)\n`,
        );
      }
      return 0;
    }

    if (sub === 'study') {
      await ctx.commands.execute('shell.launchApp', { appId: 'nexus.flashcards', args: { startStudy: true } });
      io.out('Started study session in Flashcards window.\n');
      return 0;
    }

    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'flashcards.study': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.flashcards', args: { startStudy: true } }),
};

/**
 * Mounts the Flashcards window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const decksCol = /** @type {import('../../kernel/types').Collection<Deck>} */ (ctx.storage.collection('decks'));
  const cardsCol = /** @type {import('../../kernel/types').Collection<Flashcard>} */ (ctx.storage.collection('cards'));

  /** @type {Deck[]} */
  let decks = [];
  /** @type {Flashcard[]} */
  let cards = [];
  /** @type {string} */
  let selectedDeckId = '';

  // Study session state
  let isStudying = false;
  /** @type {Flashcard[]} */
  let studyQueue = [];
  let currentCardIndex = 0;
  let isFlipped = false;
  /** @type {{ card: Flashcard, prevFSRS: import('./fsrs.js').FSRSCardData } | null} */
  let lastUndo = null;

  async function loadData() {
    decks = await decksCol.all();
    cards = await cardsCol.all();

    if (!decks.length) {
      const defaultDeck = {
        id: crypto.randomUUID(),
        name: 'Informatik::Betriebssysteme',
        color: 'cyan',
        newLimit: 20,
        reviewLimit: 100,
        createdAt: Date.now(),
      };
      await decksCol.put(defaultDeck);
      decks = [defaultDeck];
    }
    selectedDeckId = decks[0].id;

    if (!cards.length) {
      const seeded = [
        {
          id: crypto.randomUUID(),
          deckId: selectedDeckId,
          type: /** @type {const} */ ('basic'),
          front: 'What is **virtual memory**?',
          back: 'An abstraction providing each process with its own contiguous address space, isolated via page tables.',
          tags: ['os', 'memory'],
          fsrs: createNewCardFSRS(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          deckId: selectedDeckId,
          type: /** @type {const} */ ('cloze'),
          front: 'In paging, the MMU translates a {{c1::virtual address}} into a {{c1::physical address}}.',
          back: '',
          tags: ['os', 'mmu'],
          fsrs: createNewCardFSRS(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          deckId: selectedDeckId,
          type: /** @type {const} */ ('basic'),
          front: "State **Amdahl's Law** for parallel speedup:",
          back: '$$S = \\frac{1}{(1 - p) + \\frac{p}{s}}$$\n\nWhere $p$ is the parallel fraction and $s$ is the speedup of that part.',
          tags: ['concurrency', 'math'],
          fsrs: createNewCardFSRS(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      for (const c of seeded) await cardsCol.put(c);
      cards = seeded;
    }
  }

  const root = h('div', { class: 'nx-fc' });
  container.replaceChildren(root);

  function render() {
    replace(root);

    // 1. Sidebar with decks
    const sidebar = h('aside', { class: 'nx-fc-sidebar' });
    const sbHeader = h(
      'div',
      { class: 'nx-fc-sidebar-header' },
      h('strong', { text: t('decks') }),
      button({
        icon: 'plus',
        label: t('newDeck'),
        onClick: () => promptNewDeck(),
      }),
    );
    const deckList = h('div', { class: 'nx-fc-deck-list' });

    for (const d of decks) {
      const deckCards = cards.filter((c) => c.deckId === d.id);
      const counts = computeDeckStudyCounts(deckCards);
      const isSel = d.id === selectedDeckId;

      const item = h(
        'div',
        {
          class: `nx-fc-deck-item${isSel ? ' is-selected' : ''}`,
          onclick: () => {
            selectedDeckId = d.id;
            isStudying = false;
            render();
          },
        },
        h('span', { style: { fontWeight: '600', fontSize: '13px' }, text: d.name }),
        h(
          'div',
          { class: 'nx-fc-counts-pill' },
          h('span', { class: 'nx-fc-pill-due', text: String(counts.dueCount) }),
          h('span', { class: 'nx-fc-pill-learn', text: String(counts.learningCount) }),
          h('span', { class: 'nx-fc-pill-new', text: String(counts.newCount) }),
        ),
      );
      deckList.append(item);
    }
    sidebar.append(sbHeader, deckList);

    // 2. Main content: study mode OR deck manager
    const main = h('main', { class: 'nx-fc-main' });

    if (isStudying && studyQueue.length > 0 && currentCardIndex < studyQueue.length) {
      renderStudySession(main);
    } else {
      renderDeckManager(main);
    }

    root.append(sidebar, main);
  }

  function renderDeckManager(main) {
    const curDeck = decks.find((d) => d.id === selectedDeckId) || decks[0];
    const deckCards = cards.filter((c) => c.deckId === curDeck.id);
    const counts = computeDeckStudyCounts(deckCards);

    const toolbar = h(
      'div',
      { class: 'nx-fc-toolbar' },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('strong', { text: curDeck.name }),
        h('span', { class: 'nx-grades-badge is-passed', text: `${deckCards.length} cards (${counts.dueCount} due)` }),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        button({
          label: t('studyNow'),
          icon: 'play',
          variant: 'primary',
          onClick: () => startStudySession(false),
        }),
        button({
          label: t('newCard'),
          icon: 'plus',
          onClick: () => promptEditCard(),
        }),
        button({
          label: t('importAnki'),
          icon: 'upload',
          onClick: () => promptImportAnki(),
        }),
        button({
          label: t('exportCSV'),
          icon: 'download',
          onClick: () => {
            const csv = exportCardsToCSV(deckCards);
            ctx.fs.downloadBlob(new Blob([csv], { type: 'text/csv' }), `${curDeck.name.replace(/::/g, '_')}.csv`);
          },
        }),
      ),
    );

    const content = h('div', { class: 'nx-fc-content' });

    // Table of cards in current deck
    const table = h('table', { class: 'nx-grades-module-table' });
    const thead = h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { text: t('cardType') }),
        h('th', { text: t('front') }),
        h('th', { text: t('interval') }),
        h('th', { text: '' }),
      ),
    );
    const tbody = h('tbody');

    for (const card of deckCards) {
      const row = h(
        'tr',
        { class: 'nx-grades-module-row' },
        h('td', {}, h('span', { class: 'nx-grades-badge is-planned', text: card.type })),
        h('td', {
          style: { maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          text: card.front,
        }),
        h('td', { text: `${card.fsrs.stability ? `${card.fsrs.stability}d` : 'New'}` }),
        h(
          'td',
          { style: { textAlign: 'right' } },
          button({
            icon: 'edit',
            onClick: () => promptEditCard(card),
          }),
        ),
      );
      tbody.append(row);
    }
    table.append(thead, tbody);
    content.append(table);

    main.append(toolbar, content);
  }

  function startStudySession(cram = false) {
    const curDeck = decks.find((d) => d.id === selectedDeckId) || decks[0];
    const deckCards = cards.filter((c) => c.deckId === curDeck.id);
    const now = Date.now();

    if (cram) {
      studyQueue = [...deckCards];
    } else {
      studyQueue = deckCards.filter((c) => c.fsrs.state === 'new' || c.fsrs.due <= now);
    }

    if (!studyQueue.length) {
      ctx.notify({ title: t('appTitle'), body: t('noCardsDue') });
      return;
    }

    currentCardIndex = 0;
    isFlipped = false;
    isStudying = true;
    render();
  }

  function renderStudySession(main) {
    const card = studyQueue[currentCardIndex];
    const progressText = `${currentCardIndex + 1} / ${studyQueue.length}`;

    const toolbar = h(
      'div',
      { class: 'nx-fc-toolbar' },
      h('strong', { text: `${t('study')}: ${progressText}` }),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        lastUndo
          ? button({
              label: t('undo'),
              icon: 'undo',
              onClick: () => {
                if (lastUndo) {
                  lastUndo.card.fsrs = lastUndo.prevFSRS;
                  void cardsCol.put(lastUndo.card);
                  currentCardIndex = Math.max(0, currentCardIndex - 1);
                  lastUndo = null;
                  render();
                }
              },
            })
          : null,
        button({
          label: t('close'),
          icon: 'close',
          onClick: () => {
            isStudying = false;
            render();
          },
        }),
      ),
    );

    const studyBox = h('div', { class: 'nx-fc-study-box' });

    // Card face container
    const cardContainer = h('div', {
      class: 'nx-fc-card-container',
      onclick: () => {
        if (!isFlipped) {
          isFlipped = true;
          render();
        }
      },
    });

    const frontFace = h('div', { class: 'nx-fc-card-face nx-markdown' });
    const frontText = card.type === 'cloze' ? renderClozeFront(card.front) : card.front;
    void renderMarkdownInto(frontFace, frontText);
    cardContainer.append(frontFace);

    if (isFlipped) {
      cardContainer.append(h('div', { class: 'nx-fc-divider' }));
      const backFace = h('div', { class: 'nx-fc-card-face nx-markdown' });
      const backText = card.type === 'cloze' ? renderClozeBack(card.front) : card.back;
      void renderMarkdownInto(backFace, backText);
      cardContainer.append(backFace);
    }

    studyBox.append(cardContainer);

    // Rating buttons bar if flipped
    if (isFlipped) {
      const ratingBar = h('div', { class: 'nx-fc-rating-bar' });

      for (let r = 1; r <= 4; r++) {
        const rating = /** @type {import('./fsrs.js').Rating} */ (r);
        const previewNext = scheduleCard({ ...card.fsrs }, rating);
        const labelKey = rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy';
        const ivl = nextIntervalDays(previewNext.stability);

        const btn = h(
          'button',
          {
            class: `nx-fc-rating-btn nx-fc-rating-${r}`,
            type: 'button',
            onclick: () => handleCardRating(rating),
          },
          h('span', { text: t(labelKey) }),
          h('span', { style: { fontSize: '11px', opacity: '0.8' }, text: `${ivl}d` }),
        );
        ratingBar.append(btn);
      }
      studyBox.append(ratingBar);
    } else {
      studyBox.append(
        button({
          label: t('flipCard'),
          variant: 'primary',
          onClick: () => {
            isFlipped = true;
            render();
          },
        }),
      );
    }

    const content = h('div', { class: 'nx-fc-content' }, studyBox);
    main.append(toolbar, content);
  }

  async function handleCardRating(/** @type {import('./fsrs.js').Rating} */ rating) {
    const card = studyQueue[currentCardIndex];
    lastUndo = { card, prevFSRS: { ...card.fsrs } };

    card.fsrs = scheduleCard(card.fsrs, rating);
    card.updatedAt = Date.now();
    await cardsCol.put(card);

    currentCardIndex++;
    isFlipped = false;

    if (currentCardIndex >= studyQueue.length) {
      isStudying = false;
      ctx.notify({ title: t('appTitle'), body: t('sessionComplete') });
    }
    render();
  }

  // Keyboard shortcut for study: Space to flip, 1-4 to rate
  ctx.shortcuts?.register('Space', () => {
    if (isStudying && !isFlipped) {
      isFlipped = true;
      render();
    }
  });
  for (let r = 1; r <= 4; r++) {
    const rating = /** @type {import('./fsrs.js').Rating} */ (r);
    ctx.shortcuts?.register(String(r), () => {
      if (isStudying && isFlipped) {
        void handleCardRating(rating);
      }
    });
  }

  async function promptNewDeck() {
    const name = await ctx.dialog.prompt(t('deckName'), 'Computer Science');
    if (name?.trim()) {
      /** @type {Deck} */
      const d = {
        id: crypto.randomUUID(),
        name: name.trim(),
        color: 'cyan',
        newLimit: 20,
        reviewLimit: 100,
        createdAt: Date.now(),
      };
      await decksCol.put(d);
      decks.push(d);
      selectedDeckId = d.id;
      render();
    }
  }

  async function promptEditCard(/** @type {Flashcard} */ [existing]) {
    const frontArea = h('textarea', {
      class: 'nx-input',
      rows: '4',
      text: existing?.front || '',
      placeholder: 'Front question or cloze {{c1::answer}}',
    });
    const backArea = h('textarea', {
      class: 'nx-input',
      rows: '4',
      text: existing?.back || '',
      placeholder: 'Back answer (markdown & math)',
    });
    const typeSelect = h('select', { class: 'nx-select' });
    typeSelect.append(
      h('option', { value: 'basic', text: t('typeBasic'), selected: existing?.type === 'basic' }),
      h('option', { value: 'reversed', text: t('typeReversed'), selected: existing?.type === 'reversed' }),
      h('option', { value: 'cloze', text: t('typeCloze'), selected: existing?.type === 'cloze' }),
      h('option', { value: 'type_answer', text: t('typeAnswer'), selected: existing?.type === 'type_answer' }),
    );

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('label', {}, t('cardType'), typeSelect),
      h('label', {}, t('front'), frontArea),
      h('label', {}, t('back'), backArea),
    );

    await openModal({
      title: existing ? t('editCard') : t('newCard'),
      body: form,
      actions: [
        ...(existing
          ? [
              {
                label: t('delete'),
                value: false,
                variant: /** @type {const} */ ('danger'),
                accept: async () => {
                  await cardsCol.delete(existing.id);
                  cards = cards.filter((c) => c.id !== existing.id);
                  render();
                  return true;
                },
              },
            ]
          : []),
        { label: t('cancel'), value: false },
        {
          label: t('save'),
          value: true,
          variant: 'primary',
          accept: async () => {
            const front = frontArea.value.trim();
            if (!front) return false;
            /** @type {Flashcard} */
            const item = {
              id: existing?.id || crypto.randomUUID(),
              deckId: selectedDeckId,
              type: /** @type {any} */ (typeSelect.value),
              front,
              back: backArea.value.trim(),
              tags: [],
              fsrs: existing?.fsrs || createNewCardFSRS(),
              createdAt: existing?.createdAt || Date.now(),
              updatedAt: Date.now(),
            };
            await cardsCol.put(item);
            const idx = cards.findIndex((c) => c.id === item.id);
            if (idx === -1) cards.push(item);
            else cards[idx] = item;
            render();
            return true;
          },
        },
      ],
    });
  }

  async function promptImportAnki() {
    const input = h('input', { type: 'file', accept: '.apkg' });
    input.click();
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const imported = await importAnkiApkg(bytes, selectedDeckId);
        for (const c of imported) {
          await cardsCol.put(c);
          cards.push(c);
        }
        ctx.notify({ title: t('appTitle'), body: `Imported ${imported.length} cards from Anki!` });
        render();
      } catch (err) {
        ctx.notify({ title: 'Anki Import Failed', body: String(err) });
      }
    });
  }

  await loadData();
  render();

  if (args.startStudy) {
    setTimeout(() => startStudySession(false), 50);
  }

  return {
    saveState: () => ({ selectedDeckId }),
  };
}
