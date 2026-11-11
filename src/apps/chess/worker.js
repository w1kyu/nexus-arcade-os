// @ts-check
import { Position } from './engine.js';
import { LEVELS, search } from './search.js';

self.onmessage = (e) => {
  const { id, fen, level } = e.data;
  try {
    const pos = new Position(fen);
    const opts = LEVELS[level] ?? LEVELS[3];
    const result = search(pos, opts);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
