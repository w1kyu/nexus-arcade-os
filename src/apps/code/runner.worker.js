// @ts-check
/* eslint-disable no-new-func */
// Node-lite: isolated web worker for running user JavaScript scripts safely with captured console.

self.onmessage = async (e) => {
  const { id, code } = e.data || {};
  if (!code) {
    self.postMessage({ id, type: 'error', error: 'No code provided' });
    return;
  }

  const logs = [];
  const capture =
    (level) =>
    (...args) => {
      const formatted = args
        .map((arg) => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');
      logs.push({ level, message: formatted, time: Date.now() });
    };

  const origConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  console.log = capture('log');
  console.warn = capture('warn');
  console.error = capture('error');
  console.info = capture('info');

  const start = performance.now();
  let result;
  let error = null;

  try {
    // Run script inside async wrapper to allow top-level await
    const asyncFn = new Function(
      'console',
      `return (async () => {
${code}
})();`,
    );
    result = await asyncFn(console);
  } catch (err) {
    error = err instanceof Error ? { message: err.message, stack: err.stack } : { message: String(err) };
    capture('error')(error.message);
  } finally {
    console.log = origConsole.log;
    console.warn = origConsole.warn;
    console.error = origConsole.error;
    console.info = origConsole.info;
  }

  const duration = Math.round(performance.now() - start);

  self.postMessage({
    id,
    type: 'done',
    logs,
    result: typeof result === 'undefined' ? null : String(result),
    error,
    duration,
  });
};
