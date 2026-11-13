// @ts-check
// Adapter for Anthropic Messages API.
// Requires `anthropic-dangerous-direct-browser-access: true` when running client-side.
import { createMetricsTracker, estimateTokens, parseSseStream } from './base.js';

const KNOWN_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
];

/**
 * @param {object} config
 * @param {string} [config.baseUrl]
 * @param {string} [config.apiKey]
 * @param {Record<string, string>} [config.extraHeaders]
 */
export function createAnthropicAdapter(config) {
  const baseUrl = (config.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
  const apiKey = config.apiKey || '';
  const extraHeaders = config.extraHeaders || {};

  function getHeaders() {
    /** @type {Record<string, string>} */
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      ...extraHeaders,
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    return headers;
  }

  const capabilities = {
    streaming: true,
    tools: true,
    vision: true,
    embeddings: false,
    jsonMode: true,
  };

  return {
    type: 'anthropic',
    capabilities,

    async listModels() {
      // Try GET /v1/models if supported by proxy or API
      try {
        const res = await fetch(`${baseUrl}/v1/models`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data) && data.data.length > 0) {
            return data.data.map((/** @type {any} */ m) => ({
              id: m.id,
              name: m.display_name || m.id,
            }));
          }
        }
      } catch {
        // Fallback to known models
      }
      return KNOWN_MODELS;
    },

    /**
     * @param {Array<{ role: string, content: string | any[] }>} messages
     * @param {object} options
     * @param {string} options.model
     * @param {number} [options.temperature]
     * @param {number} [options.top_p]
     * @param {number} [options.max_tokens]
     * @param {any[]} [options.tools]
     * @param {AbortSignal} [options.signal]
     * @param {(token: string) => void} [options.onToken]
     * @param {(chunk: { delta: string, text: string, done: boolean, usage?: any, toolCalls?: any[] }) => void} [options.onChunk]
     */
    async chat(messages, options) {
      const metrics = createMetricsTracker();
      const model = options.model || 'claude-3-5-sonnet-20241022';

      // Extract system messages to top-level system parameter
      let systemPrompt = '';
      /** @type {Array<{ role: 'user' | 'assistant', content: string | any[] }>} */
      const anthropicMessages = [];

      for (const m of messages) {
        if (m.role === 'system') {
          systemPrompt += (systemPrompt ? '\n\n' : '') + (typeof m.content === 'string' ? m.content : '');
          continue;
        }

        const role = m.role === 'assistant' ? 'assistant' : 'user';

        // Format message content with image blocks if necessary
        let content = m.content;
        if (Array.isArray(m.content)) {
          const blocks = [];
          for (const part of m.content) {
            if (part.type === 'text') {
              blocks.push({ type: 'text', text: part.text });
            } else if (part.type === 'image_url' && part.image_url?.url) {
              const url = part.image_url.url;
              // Extract data URI media type and base64
              const match = /^data:(image\/[a-zA-Z]+);base64,(.+)$/.exec(url);
              if (match) {
                blocks.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: match[1],
                    data: match[2],
                  },
                });
              }
            }
          }
          content = blocks;
        }

        // Merge consecutive messages of the same role
        const last = anthropicMessages[anthropicMessages.length - 1];
        if (last && last.role === role && typeof last.content === 'string' && typeof content === 'string') {
          last.content += `\n\n${content}`;
        } else {
          anthropicMessages.push({ role, content });
        }
      }

      if (anthropicMessages.length === 0) {
        anthropicMessages.push({ role: 'user', content: 'Hello' });
      }

      const body = {
        model,
        messages: anthropicMessages,
        max_tokens: options.max_tokens || 4096,
        stream: true,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
      };

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Anthropic chat failed (HTTP ${res.status}): ${errText || res.statusText}`);
      }

      let fullText = '';
      let finishReason = 'stop';
      let reportedUsage = { promptTokens: 0, completionTokens: 0 };

      await parseSseStream(
        res,
        (data, eventName) => {
          try {
            const parsed = JSON.parse(data);
            if (eventName === 'message_start' && parsed.message?.usage) {
              reportedUsage.promptTokens = parsed.message.usage.input_tokens || 0;
            } else if (eventName === 'content_block_delta' && parsed.delta?.text) {
              const delta = parsed.delta.text;
              fullText += delta;
              metrics.recordToken(1);
              options.onToken?.(delta);
              options.onChunk?.({ delta, text: fullText, done: false });
            } else if (eventName === 'message_delta') {
              if (parsed.usage?.output_tokens) {
                reportedUsage.completionTokens = parsed.usage.output_tokens;
              }
              if (parsed.delta?.stop_reason) {
                finishReason = parsed.delta.stop_reason;
              }
            }
          } catch {
            // Ignore parse errors on individual SSE chunks
          }
        },
        options.signal,
      );

      if (!reportedUsage.promptTokens && !reportedUsage.completionTokens) {
        reportedUsage = {
          promptTokens: estimateTokens(systemPrompt + JSON.stringify(anthropicMessages)),
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
      });

      return {
        text: fullText,
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
     * Anthropic does not provide an embeddings endpoint.
     */
    async embed() {
      throw new Error(
        'Anthropic does not offer an embeddings endpoint. Use Ollama or an OpenAI-compatible server for embeddings.',
      );
    },
  };
}
