// Toast host: the update prompt and the notification service's toasts (title, body, one action).
// At most two toasts are visible (phase 14.4); the rest wait in a queue, high priority first and
// low priority (achievements) last. A new toast with the same `group` as a visible one replaces
// its text and shows a count instead of stacking.
import './toast.css';

const MAX_VISIBLE = 2;
const RANK = { high: 0, normal: 1, low: 2 };

/**
 * @typedef {object} ToastOptions
 * @property {string} message      title line
 * @property {string} [body]
 * @property {{ label: string, run: () => void }} [action]
 * @property {number} [timeoutMs]  0 = sticky until dismissed
 * @property {string} dismissLabel
 * @property {string} [group]      toasts of one group (e.g. per app) merge into one
 * @property {'high' | 'normal' | 'low'} [priority]
 */

/**
 * @typedef {object} Entry
 * @property {ToastOptions} options
 * @property {HTMLElement | null} el
 * @property {number} count
 * @property {ReturnType<typeof setTimeout> | undefined} timer
 * @property {boolean} closed
 */

/** @param {HTMLElement} root */
export function createToastHost(root) {
  const host = document.createElement('div');
  host.className = 'nx-toasts';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  root.append(host);
  /** @type {Entry[]} */
  const visible = [];
  /** @type {Entry[]} */
  const queue = [];

  /** @param {Entry} entry */
  function render(entry) {
    const { message, body, action, dismissLabel } = entry.options;
    const toast = entry.el ?? document.createElement('div');
    toast.className = 'nx-toast';
    const text = document.createElement('span');
    text.className = 'nx-toast-text';
    const title = document.createElement('strong');
    title.textContent = message;
    if (entry.count > 1) {
      const count = document.createElement('span');
      count.className = 'nx-badge is-neutral nx-toast-count';
      count.textContent = `×${entry.count}`;
      title.append(' ', count);
    }
    text.append(title);
    if (body) {
      const detail = document.createElement('span');
      detail.textContent = body;
      text.append(detail);
    }
    toast.replaceChildren(text);
    if (action) {
      const button = document.createElement('button');
      button.className = 'nx-toast-action';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        close(entry);
        action.run();
      });
      toast.append(button);
    }
    const dismiss = document.createElement('button');
    dismiss.className = 'nx-toast-close';
    dismiss.textContent = '×';
    dismiss.setAttribute('aria-label', dismissLabel);
    dismiss.addEventListener('click', () => close(entry));
    toast.append(dismiss);
    entry.el = toast;
    return toast;
  }

  /** @param {Entry} entry */
  function arm(entry) {
    clearTimeout(entry.timer);
    const ms = entry.options.timeoutMs ?? 6000;
    if (ms > 0) entry.timer = setTimeout(() => close(entry), ms);
  }

  /** @param {Entry} entry */
  function display(entry) {
    visible.push(entry);
    host.append(render(entry));
    arm(entry);
  }

  function pump() {
    while (visible.length < MAX_VISIBLE && queue.length) display(/** @type {Entry} */ (queue.shift()));
  }

  /** @param {Entry} entry */
  function close(entry) {
    if (entry.closed) return;
    entry.closed = true;
    clearTimeout(entry.timer);
    const qi = queue.indexOf(entry);
    if (qi >= 0) queue.splice(qi, 1);
    const vi = visible.indexOf(entry);
    if (vi >= 0) visible.splice(vi, 1);
    entry.el?.remove();
    pump();
  }

  /** @param {ToastOptions} options */
  function show(options) {
    const group = options.group;
    const same = group ? [...visible, ...queue].find((e) => e.options.group === group && !e.closed) : undefined;
    if (same) {
      same.options = options;
      same.count++;
      if (same.el) {
        render(same);
        arm(same);
      }
      return () => close(same);
    }
    /** @type {Entry} */
    const entry = { options, el: null, count: 1, timer: undefined, closed: false };
    const rankOf = (/** @type {Entry} */ e) => RANK[e.options.priority ?? 'normal'];
    const rank = rankOf(entry);
    // Urgent toasts (alarms, update prompt) take the slot of the lowest-priority visible one (the
    // newest of equals), which waits again ahead of its peers.
    const bump =
      rank === 0 && visible.length >= MAX_VISIBLE
        ? visible.reduce((low, e) => (rankOf(e) >= rankOf(low) ? e : low), visible[0])
        : null;
    if (visible.length < MAX_VISIBLE && !queue.length) display(entry);
    else if (bump && rankOf(bump) > 0) {
      clearTimeout(bump.timer);
      visible.splice(visible.indexOf(bump), 1);
      bump.el?.remove();
      const at = queue.findIndex((e) => rankOf(e) >= rankOf(bump));
      queue.splice(at < 0 ? queue.length : at, 0, bump);
      display(entry);
    } else {
      const at = queue.findIndex((e) => rankOf(e) > rank);
      queue.splice(at < 0 ? queue.length : at, 0, entry);
      pump();
    }
    return () => close(entry);
  }

  return {
    show,
    /** Visible and waiting counts (for tests). */
    get counts() {
      return { visible: visible.length, queued: queue.length };
    },
  };
}
