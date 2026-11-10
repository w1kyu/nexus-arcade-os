// @ts-check
// HTTP Client core logic: variable interpolation, curl & fetch generators,
// request execution, and CORS/offline diagnostics.

/**
 * Replaces `{{varName}}` with values from the environment dictionary.
 * @param {string} str
 * @param {Record<string, string>} vars
 */
export function interpolateVariables(str, vars = {}) {
  if (!str) return '';
  return str.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    return key in vars ? vars[key] : `{{${key}}}`;
  });
}

/**
 * Generates a curl command string from a request configuration.
 * @param {object} req
 * @param {string} req.method
 * @param {string} req.url
 * @param {Record<string, string>} [req.headers]
 * @param {string} [req.body]
 */
export function generateCurlSnippet(req) {
  let cmd = `curl -X ${req.method} "${req.url}"`;
  if (req.headers) {
    for (const [k, v] of Object.entries(req.headers)) {
      if (k && v) cmd += ` \\\n  -H "${k}: ${v}"`;
    }
  }
  if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
    const escaped = req.body.replace(/"/g, '\\"');
    cmd += ` \\\n  -d "${escaped}"`;
  }
  return cmd;
}

/**
 * Generates a JavaScript fetch() code snippet.
 * @param {object} req
 * @param {string} req.method
 * @param {string} req.url
 * @param {Record<string, string>} [req.headers]
 * @param {string} [req.body]
 */
export function generateFetchSnippet(req) {
  const options = {
    method: req.method,
    headers: req.headers || {},
  };
  if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
    // @ts-ignore
    options.body = req.body;
  }
  return `fetch("${req.url}", ${JSON.stringify(options, null, 2)})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
}

/**
 * Executes an HTTP request with timing, status, and honest diagnostics.
 * @param {object} req
 * @param {string} req.method
 * @param {string} req.url
 * @param {Record<string, string>} [req.headers]
 * @param {string} [req.body]
 * @param {Record<string, string>} [envVars]
 */
export async function executeHttpRequest(req, envVars = {}) {
  const resolvedUrl = interpolateVariables(req.url, envVars);
  const resolvedHeaders = {};
  if (req.headers) {
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.trim()) {
        resolvedHeaders[interpolateVariables(k, envVars)] = interpolateVariables(v, envVars);
      }
    }
  }
  const resolvedBody = req.body ? interpolateVariables(req.body, envVars) : undefined;

  const startTime = performance.now();

  // Offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      status: 0,
      statusText: 'Offline',
      timeMs: 0,
      sizeBytes: 0,
      headers: {},
      body: '',
      error: {
        type: 'offline',
        message: 'The system is currently offline. No network requests can be sent.',
      },
    };
  }

  try {
    const init = {
      method: req.method,
      headers: resolvedHeaders,
    };
    if (resolvedBody && req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = resolvedBody;
    }

    const res = await fetch(resolvedUrl, init);
    const duration = Math.round(performance.now() - startTime);

    /** @type {Record<string, string>} */
    const resHeaders = {};
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });

    const blob = await res.blob();
    const sizeBytes = blob.size;
    const text = await blob.text();
    const contentType = res.headers.get('content-type') || '';

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText || 'OK',
      timeMs: duration,
      sizeBytes,
      contentType,
      headers: resHeaders,
      body: text,
      url: resolvedUrl,
    };
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    const isCors = err instanceof TypeError && String(err.message).toLowerCase().includes('failed to fetch');

    return {
      ok: false,
      status: 0,
      statusText: isCors ? 'CORS / Network Error' : 'Request Failed',
      timeMs: duration,
      sizeBytes: 0,
      headers: {},
      body: '',
      error: {
        type: isCors ? 'cors' : 'network',
        message: isCors
          ? 'Cross-Origin Request Blocked: The target server did not include "Access-Control-Allow-Origin" headers, or the browser blocked the request. You can copy the curl command to run it in a native shell.'
          : String(err?.message || err),
        curl: generateCurlSnippet({
          method: req.method,
          url: resolvedUrl,
          headers: resolvedHeaders,
          body: resolvedBody,
        }),
      },
    };
  }
}
