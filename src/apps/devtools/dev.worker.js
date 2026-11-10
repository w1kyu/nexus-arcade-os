// @ts-check
// Worker for off-thread heavy operations (regex catastrophic backtracking protection, hashes)

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;
  try {
    if (type === 'regex') {
      const { pattern, flags, text } = payload;
      const re = new RegExp(pattern, flags);
      const matches = [];
      let m;
      if (flags.includes('g')) {
        let count = 0;
        while ((m = re.exec(text)) !== null) {
          matches.push({
            index: m.index,
            length: m[0].length,
            value: m[0],
            groups: m.slice(1),
            namedGroups: m.groups || {},
          });
          count++;
          if (count > 2000) break; // safety ceiling
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        m = re.exec(text);
        if (m) {
          matches.push({
            index: m.index,
            length: m[0].length,
            value: m[0],
            groups: m.slice(1),
            namedGroups: m.groups || {},
          });
        }
      }
      self.postMessage({ id, result: matches });
    } else {
      self.postMessage({ id, error: `Unknown worker operation: ${type}` });
    }
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
