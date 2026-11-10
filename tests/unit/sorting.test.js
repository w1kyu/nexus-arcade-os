// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  SORTING_ALGORITHMS,
  bubbleSort,
  bucketSort,
  choosePivotIndex,
  countingSort,
  generateInputArray,
  heapSort,
  insertionSort,
  mergeSort,
  quickSort,
  radixSort,
  selectionSort,
  shellSort,
} from '../../src/apps/sorting/algorithms.js';

describe('Sorting Algorithms', () => {
  const testCases = [
    [5, 2, 8, 1, 9, 3, 7, 4, 6],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    [4, 2, 4, 2, 4, 2],
    [42],
    [10, 100, 5, 23, 77, 99, 1, 0],
  ];

  function runSort(generatorFn, arr, opts) {
    const copy = [...arr];
    const gen = generatorFn(copy, opts);
    let step = gen.next();
    let count = 0;
    while (!step.done && count < 10000) {
      step = gen.next();
      count++;
    }
    return copy;
  }

  it('verifies all 10 algorithms sort correctly', () => {
    const algos = [
      bubbleSort,
      selectionSort,
      insertionSort,
      shellSort,
      mergeSort,
      heapSort,
      countingSort,
      radixSort,
      bucketSort,
    ];

    for (const algo of algos) {
      for (const tc of testCases) {
        const sorted = runSort(algo, tc);
        const expected = [...tc].sort((a, b) => a - b);
        expect(sorted).toEqual(expected);
      }
    }
  });

  it('verifies quickSort with both Lomuto and Hoare partitions and pivot options', () => {
    for (const partition of ['lomuto', 'hoare']) {
      for (const pivot of ['first', 'last', 'middle', 'median3']) {
        for (const tc of testCases) {
          const sorted = runSort(quickSort, tc, { partition, pivot });
          const expected = [...tc].sort((a, b) => a - b);
          expect(sorted).toEqual(expected);
        }
      }
    }
  });

  it('tests pivot selector helper', () => {
    const arr = [10, 50, 30];
    expect(choosePivotIndex(arr, 0, 2, 'first')).toBe(0);
    expect(choosePivotIndex(arr, 0, 2, 'last')).toBe(2);
    expect(choosePivotIndex(arr, 0, 2, 'middle')).toBe(1);
    expect(choosePivotIndex(arr, 0, 2, 'median3')).toBe(2);
  });

  it('tests generateInputArray for all preset types', () => {
    const random = generateInputArray('random', 20);
    expect(random.length).toBe(20);

    const sorted = generateInputArray('sorted', 20);
    expect(sorted).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

    const reversed = generateInputArray('reversed', 20);
    expect(reversed[0]).toBe(20);
    expect(reversed[19]).toBe(1);

    const custom = generateInputArray('custom', 10, '8, 3, 9, 2');
    expect(custom).toEqual([8, 3, 9, 2]);
  });

  it('has metadata and pseudocode for all 10 algorithms in EN and DE', () => {
    const keys = Object.keys(SORTING_ALGORITHMS);
    expect(keys.length).toBe(10);
    for (const key of keys) {
      const meta = SORTING_ALGORITHMS[key];
      expect(meta.name.en).toBeTruthy();
      expect(meta.name.de).toBeTruthy();
      expect(meta.pseudocode.en.length).toBeGreaterThan(0);
      expect(meta.pseudocode.de.length).toBeGreaterThan(0);
      expect(meta.complexity.worst).toBeTruthy();
    }
  });
});
