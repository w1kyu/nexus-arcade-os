import { describe, expect, it } from 'vitest';
import {
  calculateRetrievability,
  createNewCardFSRS,
  nextIntervalDays,
  scheduleCard,
} from '../../src/apps/flashcards/fsrs.js';
import {
  computeDeckStudyCounts,
  exportCardsToCSV,
  parseCardsCSV,
  renderClozeBack,
  renderClozeFront,
  splitDeckHierarchy,
} from '../../src/apps/flashcards/model.js';

describe('Flashcards & FSRS Model', () => {
  it('schedules new cards according to FSRS', () => {
    const card = createNewCardFSRS();
    expect(card.state).toBe('new');

    // Review as Good (3)
    const reviewed = scheduleCard(card, 3);
    expect(reviewed.reps).toBe(1);
    expect(reviewed.state).toBe('review');
    expect(reviewed.stability).toBeGreaterThanOrEqual(2.0);
    expect(reviewed.due).toBeGreaterThan(Date.now());
  });

  it('handles lapses and relearning', () => {
    const card = createNewCardFSRS();
    const goodCard = scheduleCard(card, 3);
    // Now fail it with rating 1 (Again)
    const lapsed = scheduleCard(goodCard, 1);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.stability).toBeLessThan(goodCard.stability);
  });

  it('calculates retrievability and intervals', () => {
    const r0 = calculateRetrievability(0, 10);
    expect(r0).toBe(1.0);
    const r10 = calculateRetrievability(10, 10);
    expect(r10).toBeCloseTo(0.9, 1);

    const ivl = nextIntervalDays(10, 0.9);
    expect(ivl).toBeGreaterThanOrEqual(1);
  });

  it('parses and renders cloze deletion', () => {
    const text = 'The capital of France is {{c1::Paris::City}} and Germany is {{c2::Berlin}}.';
    const front1 = renderClozeFront(text, 1);
    expect(front1).toContain('[City]');
    expect(front1).toContain('Berlin');

    const back1 = renderClozeBack(text, 1);
    expect(back1).toContain('**Paris**');
  });

  it('handles CSV export and parsing', () => {
    /** @type {import('../../src/apps/flashcards/model.js').Flashcard[]} */
    const cards = [
      {
        id: '1',
        deckId: 'd1',
        type: 'basic',
        front: 'Question',
        back: 'Answer',
        tags: ['tag1', 'tag2'],
        fsrs: createNewCardFSRS(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const csv = exportCardsToCSV(cards);
    expect(csv).toContain('Front,Back,Type,Tags');
    expect(csv).toContain('"Question","Answer","basic","tag1;tag2"');

    const parsed = parseCardsCSV(csv, 'd2');
    expect(parsed.length).toBe(1);
    expect(parsed[0].front).toBe('Question');
    expect(parsed[0].back).toBe('Answer');
    expect(parsed[0].tags).toEqual(['tag1', 'tag2']);
  });

  it('splits deck hierarchy correctly', () => {
    expect(splitDeckHierarchy('CS::OS::Memory')).toEqual(['CS', 'OS', 'Memory']);
    expect(splitDeckHierarchy('SingleDeck')).toEqual(['SingleDeck']);
  });

  it('computes deck study counts', () => {
    /** @type {import('../../src/apps/flashcards/model.js').Flashcard[]} */
    const cards = [
      {
        id: '1',
        deckId: 'd1',
        type: 'basic',
        front: 'Q1',
        back: 'A1',
        tags: [],
        fsrs: createNewCardFSRS(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: '2',
        deckId: 'd1',
        type: 'basic',
        front: 'Q2',
        back: 'A2',
        tags: [],
        fsrs: { ...createNewCardFSRS(), state: 'review', due: Date.now() - 1000 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const counts = computeDeckStudyCounts(cards);
    expect(counts.totalCount).toBe(2);
    expect(counts.newCount).toBe(1);
    expect(counts.dueCount).toBe(1);
  });
});
