// @ts-check
// Adapter for OpenAI-compatible APIs (OpenAI, LM Studio, vLLM, llama.cpp, OpenRouter, LocalAI).
import { createMetricsTracker, estimateTokens, parseSseStream } from './base.js';

/**
 * Normalizes baseUrl so endpoint paths like `/models` or `/chat/completions` attach cleanly.
 * @param {string} url
 */
function normalizeBaseUrl(url) {
  let cleaned = (url || 'http://localhost:1234/v1').replace(/\/+$/, '');
  return cleaned;
}

/**
 * @param {object} config
 * @param {string} [config.baseUrl]
 * @param {string} [config.apiKey]
 * @param {Record<string, string>} [config.extraHeaders]
 */
export function createOpenAiAdapter(config) {
  const baseUrl = normalizeBaseUrl(config.baseUrl || 'https://api.openai.com/v1');
  const apiKey = config.apiKey || '';
  const extraHeaders = config.extraHeaders || {};

  /**
   * Builds request headers including Bearer token if apiKey is set.
   */
  function getHeaders() {
    /** @type {Record<string, string>} */
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...extraHeaders,
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
  }

  const capabilities = {
    streaming: true,
    tools: true,
    vision: true,
    embeddings: true,
    jsonMode: true,
  };

  return {
    type: 'openai',
    capabilities,

    async listModels() {
      const url = `${baseUrl}/models`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        throw new Error(`OpenAI listModels failed: HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      return list.map((/** @type {any} */ m) => ({
        id: m.id || m.name,
        name: m.id || m.name,
        ownedBy: m.owned_by,
      }));
    },

    /**
     * @param {Array<{ role: string, content: string | any[] }>} messages
     * @param {object} options
     * @param {string} options.model
     * @param {number} [options.temperature]
     * @param {number} [options.top_p]
     * @param {number} [options.max_tokens]
     * @param {any[]} [options.tools]
     * @param {string} [options.tool_choice]
     * @param {AbortSignal} [options.signal]
     * @param {(token: string) => void} [options.onToken]
     * @param {(chunk: { delta: string, text: string, done: boolean, usage?: any, toolCalls?: any[] }) => void} [options.onChunk]
     */
    async chat(messages, options) {
      const metrics = createMetricsTracker();
      const model = options.model;
      if (!model) throw new Error('Model is required for chat');

      const body = {
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
        ...(options.max_tokens !== undefined ? { max_tokens: options.max_tokens } : {}),
        ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
        ...(options.tool_choice ? { tool_choice: options.tool_choice } : {}),
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenAI chat failed (HTTP ${res.status}): ${errText || res.statusText}`);
      }

      let fullText = '';
      let finishReason = 'stop';
      /** @type {Map<number, { id: string, name: string, arguments: string }>} */
      const toolCallsMap = new Map();
      let reportedUsage = { promptTokens: 0, completionTokens: 0 };

      await parseSseStream(
        res,
        (data) => {
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) {
              reportedUsage = {
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
              };
            }
            const choice = parsed.choices?.[0];
            if (!choice) return;

            if (choice.finish_reason) {
              finishReason = choice.finish_reason;
            }

            const delta = choice.delta;
            if (delta?.content) {
              fullText += delta.content;
              metrics.recordToken(1);
              options.onToken?.(delta.content);
              options.onChunk?.({ delta: delta.content, text: fullText, done: false });
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                let existing = toolCallsMap.get(idx);
                if (!existing) {
                  existing = { id: tc.id || '', name: tc.function?.name || '', arguments: '' };
                  toolCallsMap.set(idx, existing);
                }
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          } catch {
            // Ignore parse errors on individual SSE chunks
          }
        },
        options.signal,
      );

      /** @type {any[] | undefined} */
      const assembledToolCalls =
        toolCallsMap.size > 0
          ? Array.from(toolCallsMap.values()).map((tc) => ({
              id: tc.id || `call_${Math.random().toString(36).slice(2, 9)}`,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            }))
          : undefined;

      if (!reportedUsage.promptTokens && !reportedUsage.completionTokens) {
        reportedUsage = {
          promptTokens: estimateTokens(JSON.stringify(messages)),
          completionTokens: estimateTokens(fullText),
        };
      }

      const stats = metrics.finish(reportedUsage);
      options.onChunk?.({
        delta: '',
        text: fullText,
        done: true,
        usage: {
          promptTokens: stats.promptTokens,
          completionTokens: stats.completionTokens,
          totalTokens: stats.totalTokens,
        },
        toolCalls: assembledToolCalls,
      });

      return {
        text: fullText,
        toolCalls: assembledToolCalls,
        finishReason,
        usage: {
          promptTokens: stats.promptTokens,
          completionTokens: stats.completionTokens,
          totalTokens: stats.totalTokens,
        },
        stats,
      };
    },

    /**
     * @param {string | string[]} texts
     * @param {object} [options]
     * @param {string} [options.model]
     * @param {AbortSignal} [options.signal]
     * @returns {Promise<number[][]>}
     */
    async embed(texts, options = {}) {
      const model = options.model || 'text-embedding-3-small';
      const input = Array.isArray(texts) ? texts : [texts];

      const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ model, input }),
        signal: options.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenAI embed failed (HTTP ${res.status}): ${errText || res.statusText}`);
      }

      const data = await res.json();
      if (!Array.isArray(data.data)) {
        throw new Error('Unexpected embeddings response format');
      }
      return data.data.map((/** @type {any} */ item) => item.embedding);
    },
  };
}
