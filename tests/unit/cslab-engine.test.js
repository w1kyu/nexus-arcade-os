// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { VisualizerEngine, renderPseudocodePanel, renderVisualizerControls } from '../../src/ui/visualizer/engine.js';

describe('Shared Visualizer Engine', () => {
  it('steps forward and backward through a generator with counters and snapshots', () => {
    let state = [3, 1, 2];

    function* sortAlgorithm(arr) {
      // Step 1: compare
      yield { type: 'compare', line: 2, data: [0, 1] };
      // Step 2: swap
      const temp = arr[0];
      arr[0] = arr[1];
      arr[1] = temp;
      yield { type: 'swap', line: 3, data: [0, 1] };
      // Step 3: compare
      yield { type: 'compare', line: 2, data: [1, 2] };
    }

    const engine = new VisualizerEngine({
      getSnapshot: () => [...state],
      restoreSnapshot: (snap) => {
        state = [...snap];
      },
    });

    engine.init(sortAlgorithm, state);

    expect(engine.currentIndex).toBe(-1);
    expect(engine.counters.comparisons).toBe(0);
    expect(engine.counters.swaps).toBe(0);

    // Step 1
    const s1 = engine.stepForward();
    expect(s1).toBe(true);
    expect(engine.currentIndex).toBe(0);
    expect(engine.counters.comparisons).toBe(1);
    expect(engine.counters.swaps).toBe(0);

    // Step 2
    const s2 = engine.stepForward();
    expect(s2).toBe(true);
    expect(engine.currentIndex).toBe(1);
    expect(engine.counters.comparisons).toBe(1);
    expect(engine.counters.swaps).toBe(1);
    expect(state).toEqual([1, 3, 2]);

    // Step 3
    const s3 = engine.stepForward();
    expect(s3).toBe(true);
    expect(engine.currentIndex).toBe(2);
    expect(engine.counters.comparisons).toBe(2);

    // Step 4 (end)
    const s4 = engine.stepForward();
    expect(s4).toBe(false);
    expect(engine.isDone).toBe(true);

    // Step Backward to step 2
    const b1 = engine.stepBackward();
    expect(b1).toBe(true);
    expect(engine.currentIndex).toBe(1);
    expect(engine.counters.comparisons).toBe(1);
    expect(engine.counters.swaps).toBe(1);
    expect(state).toEqual([1, 3, 2]);

    // Step Backward to step 1
    const b2 = engine.stepBackward();
    expect(b2).toBe(true);
    expect(engine.currentIndex).toBe(0);
    expect(engine.counters.comparisons).toBe(1);
    expect(engine.counters.swaps).toBe(0);
    expect(state).toEqual([3, 1, 2]);

    // Reset
    engine.reset();
    expect(engine.currentIndex).toBe(-1);
    expect(engine.counters.comparisons).toBe(0);
    expect(state).toEqual([3, 1, 2]);
  });

  it('renders controls and updates on state change', () => {
    function* dummy() {
      yield { type: 'step' };
    }
    const engine = new VisualizerEngine();
    engine.init(dummy);

    const el = renderVisualizerControls(engine);
    expect(el.querySelector('.nx-cs-engine-controls')).toBeTruthy();
    expect(el.querySelector('.nx-cs-counter-badge')).toBeTruthy();
  });

  it('renders pseudocode panel and switches language', () => {
    let curLine = 2;
    const panel = renderPseudocodePanel(
      {
        en: ['line 1', 'line 2', 'line 3'],
        de: ['Zeile 1', 'Zeile 2', 'Zeile 3'],
      },
      () => curLine,
      { locale: 'en' },
    );

    const activeEl = panel.querySelector('.nx-cs-pseudo-line.active');
    expect(activeEl?.textContent).toContain('line 2');

    panel.setLocale('de');
    const activeElDe = panel.querySelector('.nx-cs-pseudo-line.active');
    expect(activeElDe?.textContent).toContain('Zeile 2');
  });
});
