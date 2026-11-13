// @ts-check
// Diagnostic test connection utility for AI provider profiles.

/**
 * @typedef {object} DiagnosticResult
 * @property {'ok' | 'offline' | 'unreachable' | 'cors_blocked' | 'unauthorized' | 'not_found' | 'error'} status
 * @property {string} message
 * @property {number} [latencyMs]
 * @property {string[]} [models]
 * @property {string} [details]
 */

/**
 * Tests connection to a provider adapter and diagnoses failure reasons.
 * @param {any} adapter
 * @param {object} [profile]
 * @param {string} [profile.baseUrl]
 * @param {string} [profile.type]
 * @param {string} [profile.defaultModel]
 * @returns {Promise<DiagnosticResult>}
 */
export async function testProviderConnection(adapter, profile = {}) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      status: 'offline',
      message: 'Browser is offline. Connect to the internet or local network.',
    };
  }

  const startTime = Date.now();
  const baseUrl = profile.baseUrl || 'endpoint';

  try {
    const models = await adapter.listModels();
    const latencyMs = Date.now() - startTime;
    const modelNames = models.map((/** @type {any} */ m) => m.name || m.id);

    let details = `Found ${modelNames.length} model(s). Latency: ${latencyMs}ms.`;
    if (profile.defaultModel) {
      const hasDefault = modelNames.includes(profile.defaultModel);
      if (!hasDefault && modelNames.length > 0) {
        details += ` Warning: Default model "${profile.defaultModel}" not found in server list.`;
      }
    }

    return {
      status: 'ok',
      message: `Connection successful (${latencyMs}ms)`,
      latencyMs,
      models: modelNames,
      details,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const error = /** @type {Error} */ (err);
    const msg = error.message || String(error);

    // 401 / 403 Unauthorized
    if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized')) {
      return {
        status: 'unauthorized',
        message: 'Unauthorized (HTTP 401/403). Check your API key.',
        latencyMs,
        details: msg,
      };
    }

    // 404 Not Found
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
      return {
        status: 'not_found',
        message: 'Endpoint not found (HTTP 404). Check the Base URL.',
        latencyMs,
        details: msg,
      };
    }

    // Network / CORS / Mixed-Content errors
    if (
      msg.toLowerCase().includes('failed to fetch') ||
      msg.toLowerCase().includes('networkerror') ||
      msg.toLowerCase().includes('load failed')
    ) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const isRemoteHttp =
        baseUrl.startsWith('http://') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1');

      if (isHttps && isRemoteHttp) {
        return {
          status: 'cors_blocked',
          message: 'Mixed-Content Blocked: Browsers prevent HTTPS sites from calling HTTP servers on other machines.',
          latencyMs,
          details: 'Use HTTPS or localhost, or install Nexus locally to connect to remote HTTP endpoints.',
        };
      }

      if (profile.type === 'ollama') {
        return {
          status: 'cors_blocked',
          message: 'Connection failed or blocked by CORS.',
          latencyMs,
          details:
            'Ensure Ollama is running and allows browser requests. Set OLLAMA_ORIGINS="*" before starting: `OLLAMA_ORIGINS="*" ollama serve`.',
        };
      }

      return {
        status: 'unreachable',
        message: 'Could not connect to server.',
        latencyMs,
        details: `Ensure the server at ${baseUrl} is running and reachable, and that CORS allows requests from ${typeof window !== 'undefined' ? window.location.origin : 'this origin'}.`,
      };
    }

    return {
      status: 'error',
      message: 'Connection failed',
      latencyMs,
      details: msg,
    };
  }
}
