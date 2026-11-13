// @ts-check
// Adapter for native Ollama API (/api/tags, /api/chat, /api/embed).
import { createMetricsTracker, estimateTokens, parseNdjsonStream } from './base.js';

/**
 * @param {object} config
 * @param {string} [config.baseUrl]
 * @param {Record<string, string>} [config.extraHeaders]
 */
export function createOllamaAdapter(config) {
  const baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const extraHeaders = config.extraHeaders || {};

  const capabilities = {
    streaming: true,
    tools: true,
    vision: true,
    embeddings: true,
    jsonMode: true,
  };

  return {
    type: 'ollama',
    capabilities,

    async listModels() {
      const res = await fetch(`${baseUrl}/api/tags`, {
        headers: { Accept: 'application/json', ...extraHeaders },
      });
      if (!res.ok) {
        throw new Error(`Ollama listModels failed: HTTP ${res.status}`);
      }
      const data = await res.json();
      return (data.models || []).map((/** @type {any} */ m) => ({
        id: m.name,
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        details: m.details,
      }));
    },

    /**
     * @param {Array<{ role: string, content: string | any[], images?: string[] }>} messages
     * @param {object} options
     * @param {string} options.model
     * @param {number} [options.temperature]
     * @param {number} [options.top_p]
     * @param {number} [options.max_tokens]
     * @param {any[]} [options.tools]
     * @param {string} [options.format]
     * @param {AbortSignal} [options.signal]
     * @param {(token: string) => void} [options.onToken]
     * @param {(chunk: { delta: string, text: string, done: boolean, usage?: any, toolCalls?: any[] }) => void} [options.onChunk]
     */
    async chat(messages, options) {
      const metrics = createMetricsTracker();
      const model = options.model;
      if (!model) throw new Error('Model is required for chat');

      // Convert messages to Ollama format: string content, images array
      const ollamaMessages = messages.map((m) => {
        let content = '';
        /** @type {string[]} */
        const images = [];

        if (typeof m.content === 'string') {
          content = m.content;
        } else if (Array.isArray(m.content)) {
          for (const part of m.content) {
            if (part.type === 'text') {
              content += part.text;
            } else if (part.type === 'image_url' && part.image_url?.url) {
              const url = part.image_url.url;
              // strip data:image/...;base64,
              const b64 = url.includes(',') ? url.split(',')[1] : url;
              images.push(b64);
            }
          }
        }
        if (m.images) images.push(...m.images);

        return {
          role: m.role,
          content,
          ...(images.length > 0 ? { images } : {}),
        };
      });

      const body = {
        model,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: options.temperature,
          top_p: options.top_p,
          num_predict: options.max_tokens,
        },
        ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
        ...(options.format ? { format: options.format } : {}),
      };

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Ollama chat failed (HTTP ${res.status}): ${errText || res.statusText}`);
      }

      let fullText = '';
      /** @type {any[]} */
      let toolCalls = [];
      let reportedUsage = { promptTokens: 0, completionTokens: 0 };
      let finishReason = 'stop';

      await parseNdjsonStream(
        res,
        (line) => {
          if (line.message?.content) {
            const delta = line.message.content;
            fullText += delta;
            metrics.recordToken(1);
            options.onToken?.(delta);
            options.onChunk?.({ delta, text: fullText, done: false });
          }
          if (line.message?.tool_calls) {
            toolCalls = line.message.tool_calls;
          }
          if (line.done) {
            reportedUsage = {
              promptTokens: line.prompt_eval_count || estimateTokens(JSON.stringify(messages)),
              completionTokens: line.eval_count || estimateTokens(fullText),
            };
            if (line.done_reason) finishReason = line.done_reason;
          }
        },
        options.signal,
      );

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
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      return {
        text: fullText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
      const model = options.model || 'nomic-embed-text';
      const inputs = Array.isArray(texts) ? texts : [texts];

      // Try /api/embed first
      try {
        const res = await fetch(`${baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...extraHeaders },
          body: JSON.stringify({ model, input: inputs }),
          signal: options.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.embeddings)) return data.embeddings;
        }
      } catch {
        // Fallback to /api/embeddings
      }

      // Fallback: call /api/embeddings for each input
      const results = [];
      for (const input of inputs) {
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...extraHeaders },
          body: JSON.stringify({ model, prompt: input }),
          signal: options.signal,
        });
        if (!res.ok) throw new Error(`Ollama embed failed: HTTP ${res.status}`);
        const data = await res.json();
        results.push(data.embedding || []);
      }
      return results;
    },
  };
}
