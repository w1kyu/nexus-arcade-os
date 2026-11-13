// @ts-check
import { describe, expect, it } from 'vitest';
import { createAnthropicAdapter } from '../../src/services/ai/adapters/anthropic.js';
import {
  createMetricsTracker,
  estimateTokens,
  parseNdjsonStream,
  parseSseStream,
} from '../../src/services/ai/adapters/base.js';
import { createLemonadeAdapter } from '../../src/services/ai/adapters/lemonade.js';
import { createOllamaAdapter } from '../../src/services/ai/adapters/ollama.js';
import { createOpenAiAdapter } from '../../src/services/ai/adapters/openai.js';

describe('AI Base Utilities: Streaming & Metrics', () => {
  it('estimates tokens based on character length heuristic', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('Hello')).toBe(2);
    expect(estimateTokens('12345678')).toBe(2);
    expect(estimateTokens('A much longer sentence for token estimation testing.')).toBe(13);
  });

  it('tracks token metrics and computes latency and tokens/sec', () => {
    const tracker = createMetricsTracker();
    tracker.recordToken(5);
    tracker.recordToken(10);
    const stats = tracker.finish({ promptTokens: 20, completionTokens: 15 });

    expect(stats.promptTokens).toBe(20);
    expect(stats.completionTokens).toBe(15);
    expect(stats.totalTokens).toBe(35);
    expect(stats.durationMs).toBeGreaterThanOrEqual(1);
    expect(stats.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('parses SSE data streams correctly', async () => {
    const ssePayload = [
      'event: message_start\n',
      'data: {"id": "1", "message": "start"}\n\n',
      'data: {"choices": [{"delta": {"content": "Hello"}}]}\n\n',
      'data: {"choices": [{"delta": {"content": " world!"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ssePayload));
        controller.close();
      },
    });

    const response = new Response(stream);
    /** @type {string[]} */
    const events = [];
    await parseSseStream(response, (data) => {
      events.push(data);
    });

    expect(events.length).toBe(4);
    expect(events[1]).toContain('Hello');
    expect(events[2]).toContain('world!');
    expect(events[3]).toBe('[DONE]');
  });

  it('parses NDJSON streams correctly', async () => {
    const ndjsonPayload = [
      JSON.stringify({ message: { content: 'First' }, done: false }),
      JSON.stringify({ message: { content: ' Second' }, done: false }),
      JSON.stringify({ done: true, eval_count: 5, prompt_eval_count: 10 }),
    ].join('\n');

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ndjsonPayload));
        controller.close();
      },
    });

    const response = new Response(stream);
    /** @type {any[]} */
    const lines = [];
    await parseNdjsonStream(response, (line) => {
      lines.push(line);
    });

    expect(lines.length).toBe(3);
    expect(lines[0].message.content).toBe('First');
    expect(lines[1].message.content).toBe(' Second');
    expect(lines[2].done).toBe(true);
  });
});

describe('AI Adapters: Ollama, OpenAI, Anthropic, Lemonade', () => {
  it('instantiates Ollama adapter with capabilities and default url', () => {
    const adapter = createOllamaAdapter({});
    expect(adapter.type).toBe('ollama');
    expect(adapter.capabilities.streaming).toBe(true);
    expect(adapter.capabilities.tools).toBe(true);
    expect(adapter.capabilities.embeddings).toBe(true);
  });

  it('instantiates OpenAI adapter with capabilities and Authorization header', () => {
    const adapter = createOpenAiAdapter({
      baseUrl: 'http://localhost:1234/v1',
      apiKey: 'test-key',
    });
    expect(adapter.type).toBe('openai');
    expect(adapter.capabilities.streaming).toBe(true);
    expect(adapter.capabilities.vision).toBe(true);
  });

  it('instantiates Lemonade adapter with lemonade defaults', () => {
    const adapter = createLemonadeAdapter({});
    expect(adapter.type).toBe('lemonade');
    expect(adapter.capabilities.streaming).toBe(true);
  });

  it('instantiates Anthropic adapter and sets browser access header', () => {
    const adapter = createAnthropicAdapter({ apiKey: 'sk-ant-test' });
    expect(adapter.type).toBe('anthropic');
    expect(adapter.capabilities.streaming).toBe(true);
    expect(adapter.capabilities.embeddings).toBe(false);
  });
});
