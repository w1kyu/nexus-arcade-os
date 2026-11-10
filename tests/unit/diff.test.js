// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createDiffViewer, createUnifiedPatch, diffArrays, diffLines, diffWords } from '../../src/ui/diff.js';

describe('diff engine', () => {
  it('computes basic array diff', () => {
    const a = ['apple', 'banana', 'cherry'];
    const b = ['apple', 'blueberry', 'cherry'];
    const res = diffArrays(a, b);
    expect(res).toEqual([
      { type: 'equal', aItem: 'apple', bItem: 'apple', aIndex: 0, bIndex: 0 },
      { type: 'delete', aItem: 'banana', aIndex: 1 },
      { type: 'insert', bItem: 'blueberry', bIndex: 1 },
      { type: 'equal', aItem: 'cherry', bItem: 'cherry', aIndex: 2, bIndex: 2 },
    ]);
  });

  it('computes word diffs correctly', () => {
    const res = diffWords('hello world', 'hello brave world');
    expect(res.some((w) => w.type === 'insert' && w.bItem === 'brave')).toBe(true);
  });

  it('computes line diff and change stats', () => {
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nline 2 modified\nline 3\nline 4';
    const { added, deleted } = diffLines(oldText, newText);
    expect(added).toBe(2);
    expect(deleted).toBe(1);
  });

  it('generates unified diff patch', () => {
    const patch = createUnifiedPatch('test.txt', 'one\ntwo', 'one\nthree');
    expect(patch).toContain('--- a/test.txt');
    expect(patch).toContain('+++ b/test.txt');
    expect(patch).toContain('-two');
    expect(patch).toContain('+three');
  });

  it('renders diff viewer component', () => {
    const viewer = createDiffViewer({ oldText: 'abc\ndef', newText: 'abc\nxyz', mode: 'split' });
    expect(viewer.root).toBeInstanceOf(HTMLElement);
    expect(viewer.root.querySelectorAll('.nx-diff-line').length).toBeGreaterThan(0);
    viewer.setValues('hello', 'world');
    expect(viewer.exportPatch()).toContain('+world');
  });
});
