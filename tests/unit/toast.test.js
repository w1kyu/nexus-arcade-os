// @vitest-environment jsdom
// Toast host (phase 14.4): at most two toasts at once, the rest queue (urgent first, achievements
// last), and toasts of one group merge with a count instead of stacking.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastHost } from '../../src/shell/toast.js';

const titles = () => [...document.querySelectorAll('.nx-toast strong')].map((el) => el.textContent);

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('toast host', () => {
  it('shows two toasts and queues the rest until one closes', () => {
    const host = createToastHost(document.body);
    const close = host.show({ message: 'A', dismissLabel: 'Close', timeoutMs: 0 });
    host.show({ message: 'B', dismissLabel: 'Close', timeoutMs: 0 });
    host.show({ message: 'C', dismissLabel: 'Close', timeoutMs: 0 });
    expect(titles()).toEqual(['A', 'B']);
    expect(host.counts).toEqual({ visible: 2, queued: 1 });
    close();
    expect(titles()).toEqual(['B', 'C']);
  });

  it('puts achievements behind other toasts and lets urgent ones in at once', () => {
    const host = createToastHost(document.body);
    host.show({ message: 'one', dismissLabel: 'x', timeoutMs: 0 });
    host.show({ message: 'two', dismissLabel: 'x', timeoutMs: 0, priority: 'low' });
    host.show({ message: 'trophy', dismissLabel: 'x', timeoutMs: 0, priority: 'low' });
    host.show({ message: 'news', dismissLabel: 'x', timeoutMs: 0 });
    expect(host.counts.queued).toBe(2);
    host.show({ message: 'Alarm', dismissLabel: 'x', timeoutMs: 0, priority: 'high' });
    // The alarm takes the low-priority slot; that toast waits again, ahead of later low ones.
    expect(titles()).toEqual(['one', 'Alarm']);
    /** @type {HTMLElement} */ (document.querySelector('.nx-toast .nx-toast-close')).click();
    expect(titles()).toEqual(['Alarm', 'news']);
  });

  it('merges toasts of one group and counts them', () => {
    vi.useFakeTimers();
    const host = createToastHost(document.body);
    host.show({ message: 'Timer done', dismissLabel: 'x', group: 'app:clock', timeoutMs: 1000 });
    vi.advanceTimersByTime(800);
    host.show({ message: 'Second timer done', dismissLabel: 'x', group: 'app:clock', timeoutMs: 1000 });
    expect(document.querySelectorAll('.nx-toast')).toHaveLength(1);
    expect(document.querySelector('.nx-toast strong')?.textContent).toBe('Second timer done ×2');
    vi.advanceTimersByTime(800); // the merge restarted the timeout
    expect(document.querySelectorAll('.nx-toast')).toHaveLength(1);
    vi.advanceTimersByTime(300);
    expect(document.querySelectorAll('.nx-toast')).toHaveLength(0);
  });
});
