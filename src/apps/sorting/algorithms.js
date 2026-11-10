// @ts-check

/**
 * @typedef {object} AlgorithmMeta
 * @property {{ en: string, de: string }} name
 * @property {{ best: string, average: string, worst: string, space: string, stable: boolean, inPlace: boolean }} complexity
 * @property {{ en: string[], de: string[] }} pseudocode
 * @property {(arr: number[], opts?: any) => Generator<any, void, unknown>} generator
 */

/**
 * Chooses pivot index based on strategy.
 * @param {number[]} arr
 * @param {number} low
 * @param {number} high
 * @param {string} strategy
 */
export function choosePivotIndex(arr, low, high, strategy = 'last') {
  if (strategy === 'first') return low;
  if (strategy === 'middle') return Math.floor((low + high) / 2);
  if (strategy === 'random') return Math.floor(Math.random() * (high - low + 1)) + low;
  if (strategy === 'median3') {
    const mid = Math.floor((low + high) / 2);
    const a = arr[low],
      b = arr[mid],
      c = arr[high];
    if ((a <= b && b <= c) || (c <= b && b <= a)) return mid;
    if ((b <= a && a <= c) || (c <= a && a <= b)) return low;
    return high;
  }
  return high; // default 'last'
}

/**
 * Bubble Sort generator
 * @param {number[]} arr
 */
export function* bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    yield { type: 'highlight', line: 2, indices: [] };
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      yield { type: 'compare', line: 3, indices: [j, j + 1] };
      if (arr[j] > arr[j + 1]) {
        yield { type: 'swap', line: 4, indices: [j, j + 1] };
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
        swapped = true;
      }
    }
    yield { type: 'sorted', line: 5, indices: [n - i - 1] };
    if (!swapped) break;
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

/**
 * Selection Sort generator
 * @param {number[]} arr
 */
export function* selectionSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    yield { type: 'highlight', line: 2, indices: [i] };
    for (let j = i + 1; j < n; j++) {
      yield { type: 'compare', line: 3, indices: [j, minIdx] };
      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        yield { type: 'highlight', line: 4, indices: [minIdx] };
      }
    }
    if (minIdx !== i) {
      yield { type: 'swap', line: 5, indices: [i, minIdx] };
      const tmp = arr[i];
      arr[i] = arr[minIdx];
      arr[minIdx] = tmp;
    }
    yield { type: 'sorted', line: 6, indices: [i] };
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

/**
 * Insertion Sort generator
 * @param {number[]} arr
 */
export function* insertionSort(arr) {
  const n = arr.length;
  for (let i = 1; i < n; i++) {
    const key = arr[i];
    let j = i - 1;
    yield { type: 'highlight', line: 2, indices: [i] };
    while (j >= 0) {
      yield { type: 'compare', line: 3, indices: [j, j + 1] };
      if (arr[j] > key) {
        yield { type: 'set', line: 4, index: j + 1, value: arr[j], indices: [j, j + 1] };
        arr[j + 1] = arr[j];
        j--;
      } else {
        break;
      }
    }
    yield { type: 'set', line: 5, index: j + 1, value: key, indices: [j + 1] };
    arr[j + 1] = key;
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

/**
 * Shell Sort generator
 * @param {number[]} arr
 */
export function* shellSort(arr) {
  const n = arr.length;
  // Gap sequence: n/2, n/4, ...
  for (let gap = Math.floor(n / 2); gap > 0; Math.floor((gap = gap / 2))) {
    yield { type: 'highlight', line: 1, indices: [] };
    for (let i = gap; i < n; i++) {
      const temp = arr[i];
      let j = i;
      yield { type: 'compare', line: 3, indices: [j - gap, i] };
      while (j >= gap && arr[j - gap] > temp) {
        yield { type: 'set', line: 4, index: j, value: arr[j - gap], indices: [j, j - gap] };
        arr[j] = arr[j - gap];
        j -= gap;
        if (j >= gap) {
          yield { type: 'compare', line: 3, indices: [j - gap, i] };
        }
      }
      yield { type: 'set', line: 5, index: j, value: temp, indices: [j] };
      arr[j] = temp;
    }
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

/**
 * Merge Sort generator
 * @param {number[]} arr
 */
export function* mergeSort(arr) {
  yield* mergeSortHelper(arr, 0, arr.length - 1);
  yield { type: 'sorted', line: 6, indices: Array.from({ length: arr.length }, (_, i) => i) };
}

function* mergeSortHelper(arr, left, right) {
  if (left >= right) return;
  const mid = Math.floor((left + right) / 2);
  yield { type: 'highlight', line: 1, indices: [left, right] };
  yield* mergeSortHelper(arr, left, mid);
  yield* mergeSortHelper(arr, mid + 1, right);
  yield* merge(arr, left, mid, right);
}

function* merge(arr, left, mid, right) {
  const temp = [];
  let i = left;
  let j = mid + 1;
  while (i <= mid && j <= right) {
    yield { type: 'compare', line: 3, indices: [i, j] };
    if (arr[i] <= arr[j]) {
      temp.push(arr[i++]);
    } else {
      temp.push(arr[j++]);
    }
  }
  while (i <= mid) temp.push(arr[i++]);
  while (j <= right) temp.push(arr[j++]);

  for (let k = 0; k < temp.length; k++) {
    yield { type: 'set', line: 4, index: left + k, value: temp[k], indices: [left + k] };
    arr[left + k] = temp[k];
  }
}

/**
 * Quick Sort generator
 * @param {number[]} arr
 * @param {object} [opts]
 * @param {'lomuto' | 'hoare'} [opts.partition]
 * @param {'first' | 'last' | 'middle' | 'random' | 'median3'} [opts.pivot]
 */
export function* quickSort(arr, opts = {}) {
  const partition = opts.partition || 'lomuto';
  const pivot = opts.pivot || 'last';
  if (partition === 'hoare') {
    yield* quickSortHoareHelper(arr, 0, arr.length - 1, pivot);
  } else {
    yield* quickSortLomutoHelper(arr, 0, arr.length - 1, pivot);
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: arr.length }, (_, i) => i) };
}

function* quickSortLomutoHelper(arr, low, high, pivotStrategy) {
  if (low < high) {
    const pIdx = choosePivotIndex(arr, low, high, pivotStrategy);
    if (pIdx !== high) {
      yield { type: 'swap', line: 2, indices: [pIdx, high] };
      const t = arr[pIdx];
      arr[pIdx] = arr[high];
      arr[high] = t;
    }
    const pivot = arr[high];
    let i = low - 1;
    for (let j = low; j < high; j++) {
      yield { type: 'compare', line: 3, indices: [j, high] };
      if (arr[j] <= pivot) {
        i++;
        if (i !== j) {
          yield { type: 'swap', line: 4, indices: [i, j] };
          const tmp = arr[i];
          arr[i] = arr[j];
          arr[j] = tmp;
        }
      }
    }
    yield { type: 'swap', line: 5, indices: [i + 1, high] };
    const tmp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = tmp;
    const pi = i + 1;

    yield* quickSortLomutoHelper(arr, low, pi - 1, pivotStrategy);
    yield* quickSortLomutoHelper(arr, pi + 1, high, pivotStrategy);
  }
}

function* quickSortHoareHelper(arr, low, high, pivotStrategy) {
  if (low < high) {
    const pIdx = choosePivotIndex(arr, low, high, pivotStrategy);
    if (pIdx !== low) {
      yield { type: 'swap', line: 2, indices: [pIdx, low] };
      const t = arr[pIdx];
      arr[pIdx] = arr[low];
      arr[low] = t;
    }
    const pivot = arr[low];
    let i = low - 1;
    let j = high + 1;
    while (true) {
      do {
        i++;
        yield { type: 'compare', line: 3, indices: [i, low] };
      } while (arr[i] < pivot);

      do {
        j--;
        yield { type: 'compare', line: 3, indices: [j, low] };
      } while (arr[j] > pivot);

      if (i >= j) break;
      yield { type: 'swap', line: 4, indices: [i, j] };
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    yield* quickSortHoareHelper(arr, low, j, pivotStrategy);
    yield* quickSortHoareHelper(arr, j + 1, high, pivotStrategy);
  }
}

/**
 * Heap Sort generator
 * @param {number[]} arr
 */
export function* heapSort(arr) {
  const n = arr.length;
  // Build max heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    yield* heapify(arr, n, i);
  }
  // Extract elements from heap
  for (let i = n - 1; i > 0; i--) {
    yield { type: 'swap', line: 4, indices: [0, i] };
    const tmp = arr[0];
    arr[0] = arr[i];
    arr[i] = tmp;
    yield { type: 'sorted', line: 4, indices: [i] };
    yield* heapify(arr, i, 0);
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

function* heapify(arr, n, i) {
  let largest = i;
  const left = 2 * i + 1;
  const right = 2 * i + 2;

  if (left < n) {
    yield { type: 'compare', line: 2, indices: [left, largest] };
    if (arr[left] > arr[largest]) largest = left;
  }
  if (right < n) {
    yield { type: 'compare', line: 2, indices: [right, largest] };
    if (arr[right] > arr[largest]) largest = right;
  }
  if (largest !== i) {
    yield { type: 'swap', line: 3, indices: [i, largest] };
    const tmp = arr[i];
    arr[i] = arr[largest];
    arr[largest] = tmp;
    yield* heapify(arr, n, largest);
  }
}

/**
 * Counting Sort generator (for non-negative integers)
 * @param {number[]} arr
 */
export function* countingSort(arr) {
  const n = arr.length;
  if (n === 0) return;
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min + 1;
  const count = new Array(range).fill(0);

  yield { type: 'highlight', line: 1, indices: [] };
  for (let i = 0; i < n; i++) {
    yield { type: 'highlight', line: 2, indices: [i] };
    count[arr[i] - min]++;
  }

  let idx = 0;
  for (let i = 0; i < range; i++) {
    while (count[i] > 0) {
      yield { type: 'set', line: 4, index: idx, value: i + min, indices: [idx] };
      arr[idx] = i + min;
      count[i]--;
      idx++;
    }
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

/**
 * Radix Sort generator (LSD)
 * @param {number[]} arr
 */
export function* radixSort(arr) {
  const n = arr.length;
  if (n === 0) return;
  const max = Math.max(...arr);
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    yield { type: 'highlight', line: 1, indices: [] };
    const output = new Array(n).fill(0);
    const count = new Array(10).fill(0);

    for (let i = 0; i < n; i++) {
      yield { type: 'compare', line: 2, indices: [i] };
      const digit = Math.floor(arr[i] / exp) % 10;
      count[digit]++;
    }

    for (let i = 1; i < 10; i++) count[i] += count[i - 1];

    for (let i = n - 1; i >= 0; i--) {
      const digit = Math.floor(arr[i] / exp) % 10;
      output[count[digit] - 1] = arr[i];
      count[digit]--;
    }

    for (let i = 0; i < n; i++) {
      yield { type: 'set', line: 4, index: i, value: output[i], indices: [i] };
      arr[i] = output[i];
    }
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

/**
 * Bucket Sort generator
 * @param {number[]} arr
 */
export function* bucketSort(arr) {
  const n = arr.length;
  if (n <= 1) return;
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const bucketCount = Math.max(2, Math.floor(Math.sqrt(n)));
  const buckets = Array.from({ length: bucketCount }, () => []);

  yield { type: 'highlight', line: 1, indices: [] };
  const range = (max - min) / bucketCount || 1;
  for (let i = 0; i < n; i++) {
    yield { type: 'highlight', line: 2, indices: [i] };
    let bIdx = Math.floor((arr[i] - min) / range);
    if (bIdx >= bucketCount) bIdx = bucketCount - 1;
    buckets[bIdx].push(arr[i]);
  }

  let idx = 0;
  for (let b = 0; b < bucketCount; b++) {
    buckets[b].sort((a, b) => a - b);
    for (let k = 0; k < buckets[b].length; k++) {
      yield { type: 'set', line: 4, index: idx, value: buckets[b][k], indices: [idx] };
      arr[idx] = buckets[b][k];
      idx++;
    }
  }
  yield { type: 'sorted', line: 6, indices: Array.from({ length: n }, (_, i) => i) };
}

/** @type {Record<string, AlgorithmMeta>} */
export const SORTING_ALGORITHMS = {
  bubble: {
    name: { en: 'Bubble Sort', de: 'Bubblesort' },
    complexity: {
      best: 'O(n)',
      average: 'O(n²)',
      worst: 'O(n²)',
      space: 'O(1)',
      stable: true,
      inPlace: true,
    },
    pseudocode: {
      en: [
        'for i = 0 to n-1:',
        '  swapped = false',
        '  for j = 0 to n-i-2:',
        '    if A[j] > A[j+1]:',
        '      swap(A[j], A[j+1]); swapped = true',
        '  if not swapped: break',
      ],
      de: [
        'für i = 0 bis n-1:',
        '  getauscht = falsch',
        '  für j = 0 bis n-i-2:',
        '    wenn A[j] > A[j+1]:',
        '      tausche(A[j], A[j+1]); getauscht = wahr',
        '  wenn nicht getauscht: abbruch',
      ],
    },
    generator: bubbleSort,
  },
  selection: {
    name: { en: 'Selection Sort', de: 'Selectionsort' },
    complexity: {
      best: 'O(n²)',
      average: 'O(n²)',
      worst: 'O(n²)',
      space: 'O(1)',
      stable: false,
      inPlace: true,
    },
    pseudocode: {
      en: [
        'for i = 0 to n-2:',
        '  min_idx = i',
        '  for j = i+1 to n-1:',
        '    if A[j] < A[min_idx]: min_idx = j',
        '  swap(A[i], A[min_idx])',
        'mark A[i] sorted',
      ],
      de: [
        'für i = 0 bis n-2:',
        '  min_idx = i',
        '  für j = i+1 bis n-1:',
        '    wenn A[j] < A[min_idx]: min_idx = j',
        '  tausche(A[i], A[min_idx])',
        'markiere A[i] als sortiert',
      ],
    },
    generator: selectionSort,
  },
  insertion: {
    name: { en: 'Insertion Sort', de: 'Insertionsort' },
    complexity: {
      best: 'O(n)',
      average: 'O(n²)',
      worst: 'O(n²)',
      space: 'O(1)',
      stable: true,
      inPlace: true,
    },
    pseudocode: {
      en: [
        'for i = 1 to n-1:',
        '  key = A[i]; j = i-1',
        '  while j >= 0 and A[j] > key:',
        '    A[j+1] = A[j]; j--',
        '  A[j+1] = key',
        'mark A[0..i] sorted',
      ],
      de: [
        'für i = 1 bis n-1:',
        '  schlüssel = A[i]; j = i-1',
        '  solange j >= 0 und A[j] > schlüssel:',
        '    A[j+1] = A[j]; j--',
        '  A[j+1] = schlüssel',
        'markiere A[0..i] als sortiert',
      ],
    },
    generator: insertionSort,
  },
  shell: {
    name: { en: 'Shell Sort', de: 'Shellsort' },
    complexity: {
      best: 'O(n log n)',
      average: 'O(n^(4/3))',
      worst: 'O(n²)',
      space: 'O(1)',
      stable: false,
      inPlace: true,
    },
    pseudocode: {
      en: [
        'for gap = n/2 down to 1:',
        '  for i = gap to n-1:',
        '    temp = A[i]; j = i',
        '    while j >= gap and A[j-gap] > temp:',
        '      A[j] = A[j-gap]; j -= gap',
        '    A[j] = temp',
      ],
      de: [
        'für abstand = n/2 abwärts bis 1:',
        '  für i = abstand bis n-1:',
        '    temp = A[i]; j = i',
        '    solange j >= abstand und A[j-abstand] > temp:',
        '      A[j] = A[j-abstand]; j -= abstand',
        '    A[j] = temp',
      ],
    },
    generator: shellSort,
  },
  merge: {
    name: { en: 'Merge Sort', de: 'Mergesort' },
    complexity: {
      best: 'O(n log n)',
      average: 'O(n log n)',
      worst: 'O(n log n)',
      space: 'O(n)',
      stable: true,
      inPlace: false,
    },
    pseudocode: {
      en: [
        'function mergeSort(A, l, r):',
        '  if l < r: mid = (l+r)/2',
        '  mergeSort(A, l, mid); mergeSort(A, mid+1, r)',
        '  merge(A, l, mid, r)',
        '  copy temp back to A[l..r]',
        'return A',
      ],
      de: [
        'Funktion mergeSort(A, l, r):',
        '  wenn l < r: mitte = (l+r)/2',
        '  mergeSort(A, l, mitte); mergeSort(A, mitte+1, r)',
        '  merge(A, l, mitte, r)',
        '  kopiere temp zurück in A[l..r]',
        'rückgabe A',
      ],
    },
    generator: mergeSort,
  },
  quick: {
    name: { en: 'Quick Sort', de: 'Quicksort' },
    complexity: {
      best: 'O(n log n)',
      average: 'O(n log n)',
      worst: 'O(n²)',
      space: 'O(log n)',
      stable: false,
      inPlace: true,
    },
    pseudocode: {
      en: [
        'function quickSort(A, low, high):',
        '  choose pivot and partition:',
        '  while scan elements: compare with pivot',
        '  swap smaller to left side',
        '  place pivot at partition index p',
        '  quickSort(low, p-1); quickSort(p+1, high)',
      ],
      de: [
        'Funktion quickSort(A, low, high):',
        '  wähle Pivot und partitioniere:',
        '  vergleiche Elemente mit Pivot',
        '  tausche kleinere nach links',
        '  setze Pivot an Trennposition p',
        '  quickSort(low, p-1); quickSort(p+1, high)',
      ],
    },
    generator: quickSort,
  },
  heap: {
    name: { en: 'Heap Sort', de: 'Heapsort' },
    complexity: {
      best: 'O(n log n)',
      average: 'O(n log n)',
      worst: 'O(n log n)',
      space: 'O(1)',
      stable: false,
      inPlace: true,
    },
    pseudocode: {
      en: [
        'buildMaxHeap(A)',
        'for i = n-1 down to 1:',
        '  swap(A[0], A[i])',
        '  heapify(A, i, 0)',
        '  mark A[i] sorted',
        'return A',
      ],
      de: [
        'erstelleMaxHeap(A)',
        'für i = n-1 abwärts bis 1:',
        '  tausche(A[0], A[i])',
        '  heapify(A, i, 0)',
        '  markiere A[i] als sortiert',
        'rückgabe A',
      ],
    },
    generator: heapSort,
  },
  counting: {
    name: { en: 'Counting Sort', de: 'Countingsort' },
    complexity: {
      best: 'O(n + k)',
      average: 'O(n + k)',
      worst: 'O(n + k)',
      space: 'O(k)',
      stable: true,
      inPlace: false,
    },
    pseudocode: {
      en: [
        'find min and max values',
        'count occurrences of each key in range',
        'accumulate prefix sums of counts',
        'write elements back to array in order',
        'mark all sorted',
      ],
      de: [
        'bestimme Min- und Max-Werte',
        'zähle Häufigkeiten jedes Schlüssels',
        'akkumuliere Präfixsummen der Zähler',
        'schreibe Elemente geordnet zurück',
        'alle als sortiert markieren',
      ],
    },
    generator: countingSort,
  },
  radix: {
    name: { en: 'Radix Sort (LSD)', de: 'Radixsort (LSD)' },
    complexity: {
      best: 'O(d · (n + k))',
      average: 'O(d · (n + k))',
      worst: 'O(d · (n + k))',
      space: 'O(n + k)',
      stable: true,
      inPlace: false,
    },
    pseudocode: {
      en: [
        'for exp = 1; max / exp > 0; exp *= 10:',
        '  count occurrences of digit at exp',
        '  stable distribute into output array',
        '  copy output back to A',
        'repeat until highest digit reached',
      ],
      de: [
        'für exp = 1; max / exp > 0; exp *= 10:',
        '  zähle Ziffern an Stelle exp',
        '  stabile Verteilung in Ausgabearray',
        '  kopiere Ausgabe zurück nach A',
        'wiederhole bis zur höchsten Ziffer',
      ],
    },
    generator: radixSort,
  },
  bucket: {
    name: { en: 'Bucket Sort', de: 'Bucketsort' },
    complexity: {
      best: 'O(n + k)',
      average: 'O(n + k)',
      worst: 'O(n²)',
      space: 'O(n)',
      stable: true,
      inPlace: false,
    },
    pseudocode: {
      en: [
        'create k empty buckets',
        'distribute A[i] into bucket based on value',
        'sort individual buckets (insertion/merge)',
        'concatenate all buckets into A',
        'mark array sorted',
      ],
      de: [
        'erstelle k leere Eimer (Buckets)',
        'verteile A[i] wertabhängig in Buckets',
        'sortiere einzelne Buckets',
        'konkateniere alle Buckets nach A',
        'Array als sortiert markieren',
      ],
    },
    generator: bucketSort,
  },
};

/**
 * Generates an array according to a preset type.
 * @param {string} type - 'random' | 'sorted' | 'reversed' | 'nearly' | 'few_unique' | 'custom'
 * @param {number} size
 * @param {string} [customStr]
 */
export function generateInputArray(type, size = 30, customStr = '') {
  if (type === 'custom' && customStr) {
    const parsed = customStr
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
    if (parsed.length > 0) return parsed;
  }
  const arr = Array.from({ length: size }, (_, i) => i + 1);
  if (type === 'sorted') return arr;
  if (type === 'reversed') return arr.reverse();
  if (type === 'few_unique') {
    const uniques = [10, 25, 50, 75, 90];
    return Array.from({ length: size }, () => uniques[Math.floor(Math.random() * uniques.length)]);
  }
  if (type === 'nearly') {
    for (let k = 0; k < Math.max(1, Math.floor(size * 0.1)); k++) {
      const i = Math.floor(Math.random() * size);
      const j = Math.floor(Math.random() * size);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
  // random (Fisher-Yates shuffle)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
