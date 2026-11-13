// @ts-check
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../src/kernel/bus.js';
import { createAi } from '../../src/services/ai/ai.js';
import { chunkText, cosineSimilarity } from '../../src/services/ai/rag.js';
import { decryptApiKey, encryptApiKey } from '../../src/services/ai/security.js';
import { executeToolCall, formatToolConfirmation, TOOL_DECLARATIONS } from '../../src/services/ai/tools.js';

function createMockStore() {
  /** @type {Map<string, any>} */
  const map = new Map();
  return {
    async get(/** @type {string} */ key) {
      return map.get(key);
    },
    async set(/** @type {string} */ key, /** @type {any} */ value) {
      map.set(key, value);
    },
    has: (/** @type {string} */ key) => map.has(key),
  };
}

describe('AI Security: device-key encryption at rest', () => {
  it('encrypts and decrypts API keys round-trip', async () => {
    const rawKey = 'sk-proj-1234567890abcdef';
    const encrypted = await encryptApiKey(rawKey, null);
    expect(encrypted).not.toBe(rawKey);
    const decrypted = await decryptApiKey(encrypted, null);
    expect(decrypted).toBe(rawKey);
  });

  it('handles empty strings and plain text gracefully', async () => {
    expect(await encryptApiKey('', null)).toBe('');
    expect(await decryptApiKey('', null)).toBe('');
    expect(await decryptApiKey('plain-mock-key', null)).toBe('plain-mock-key');
  });
});

describe('AI Service: Provider Management', () => {
  it('initializes with default presets and isAvailable is false initially', async () => {
    const bus = createEventBus();
    const store = createMockStore();
    const ai = createAi({ bus, store });
    await ai.load();

    expect(ai.isAvailable()).toBe(false);
    const profiles = await ai.listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(4);
    expect(profiles.some((p) => p.type === 'ollama')).toBe(true);
    expect(profiles.some((p) => p.type === 'openai')).toBe(true);
    expect(profiles.some((p) => p.type === 'anthropic')).toBe(true);
  });

  it('saving an enabled profile updates isAvailable and notifies listeners', async () => {
    const bus = createEventBus();
    const store = createMockStore();
    const ai = createAi({ bus, store });
    await ai.load();

    let availabilityNotified = false;
    ai.onAvailabilityChange((available) => {
      availabilityNotified = available;
    });

    const saved = await ai.saveProfile({
      id: 'custom-ollama',
      name: 'My Ollama',
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      defaultModel: 'mistral:latest',
      enabled: true,
      rawApiKey: 'secret-key-123',
    });

    await ai.setActiveProfile(saved.id);

    expect(ai.isAvailable()).toBe(true);
    expect(availabilityNotified).toBe(true);

    const active = await ai.getActiveProfile();
    expect(active?.id).toBe('custom-ollama');
    expect(active?.apiKey).toBe('secret-key-123');
  });

  it('masks API keys when listing profiles', async () => {
    const bus = createEventBus();
    const store = createMockStore();
    const ai = createAi({ bus, store });
    await ai.load();

    await ai.saveProfile({
      id: 'openai-test',
      name: 'OpenAI Test',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      enabled: true,
      rawApiKey: 'sk-super-secret-key',
    });

    const list = await ai.listProfiles();
    const item = list.find((p) => p.id === 'openai-test');
    expect(item).toBeDefined();
    expect(item?.apiKey).toBe('••••••••');
    expect(item?.hasKey).toBe(true);
  });
});

describe('AI Diagnostics', () => {
  it('correctly diagnoses unauthorized (401/403) errors', async () => {
    const bus = createEventBus();
    const store = createMockStore();
    const ai = createAi({ bus, store });
    await ai.load();

    const mockProfile = {
      id: 'mock-unauth',
      name: 'Mock',
      type: /** @type {const} */ ('openai'),
      baseUrl: 'http://mock-unauth',
      enabled: true,
    };

    // Override fetch temporarily
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      /** @type {any} */ ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key provided',
      });

    try {
      const diag = await ai.testConnection(mockProfile);
      expect(diag.status).toBe('unauthorized');
      expect(diag.message).toContain('Unauthorized');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('correctly diagnoses not found (404) errors', async () => {
    const bus = createEventBus();
    const store = createMockStore();
    const ai = createAi({ bus, store });
    await ai.load();

    const mockProfile = {
      id: 'mock-404',
      name: 'Mock 404',
      type: /** @type {const} */ ('openai'),
      baseUrl: 'http://mock-404',
      enabled: true,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      /** @type {any} */ ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Route not found',
      });

    try {
      const diag = await ai.testConnection(mockProfile);
      expect(diag.status).toBe('not_found');
      expect(diag.message).toContain('Endpoint not found');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports ok with model list and latency on success', async () => {
    const bus = createEventBus();
    const store = createMockStore();
    const ai = createAi({ bus, store });
    await ai.load();

    const mockProfile = {
      id: 'mock-ok',
      name: 'Mock OK',
      type: /** @type {const} */ ('openai'),
      baseUrl: 'http://mock-ok',
      defaultModel: 'gpt-4o',
      enabled: true,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      /** @type {any} */ ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
        }),
      });

    try {
      const diag = await ai.testConnection(mockProfile);
      expect(diag.status).toBe('ok');
      expect(diag.models).toEqual(['gpt-4o', 'gpt-4o-mini']);
      expect(diag.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('RAG Knowledge & Text Chunking', () => {
  it('splits text into chunks with overlap', () => {
    const sample =
      'First paragraph about AI systems.\n\nSecond paragraph discussing neural networks and embeddings in Nexus Arcade OS.\n\nThird paragraph about vector similarity search.';
    const chunks = chunkText(sample, 60, 15);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('First paragraph');
    expect(chunks.join(' ')).toContain('vector similarity search');
  });

  it('computes cosine similarity accurately', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];
    const v4 = [0.7071, 0.7071, 0];

    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 4);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(0.0, 4);
    expect(cosineSimilarity(v1, v4)).toBeCloseTo(0.7071, 2);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe('OS Tools & Execution', () => {
  it('exposes declared tools with schemas and confirmation metadata', () => {
    expect(TOOL_DECLARATIONS.length).toBeGreaterThanOrEqual(8);
    const createNote = TOOL_DECLARATIONS.find((t) => t.name === 'create_note');
    expect(createNote).toBeDefined();
    expect(createNote?.isReadOnly).toBe(false);

    const searchNotes = TOOL_DECLARATIONS.find((t) => t.name === 'search_notes');
    expect(searchNotes).toBeDefined();
    expect(searchNotes?.isReadOnly).toBe(true);

    const summary = formatToolConfirmation('create_note', { title: 'Test Note', content: 'Hello' });
    expect(summary.title).toBe('Create Note');
    expect(summary.summary).toContain('Test Note');
    expect(summary.isReadOnly).toBe(false);
  });

  it('executes create_note and search_notes via mock ctx', async () => {
    const files = new Map();
    const mockCtx = /** @type {any} */ ({
      fs: {
        async exists(/** @type {string} */ path) {
          return files.has(path) || path === '/Notes';
        },
        async createFolder() {},
        async uniquePath(/** @type {string} */ path) {
          return path;
        },
        async writeFile(/** @type {string} */ path, /** @type {string} */ content) {
          files.set(path, content);
        },
        async readFile(/** @type {string} */ path) {
          return files.get(path);
        },
        async walk() {
          return Array.from(files.keys()).map((p) => ({
            type: 'file',
            path: p,
            name: p.split('/').pop(),
          }));
        },
      },
    });

    const createRes = await executeToolCall(mockCtx, 'create_note', {
      title: 'Quantum Physics',
      content: 'Schrodinger equation explanation',
      tags: ['physics', 'science'],
    });
    expect(createRes.success).toBe(true);
    expect(files.has('/Notes/Quantum Physics.md')).toBe(true);

    const searchRes = await executeToolCall(mockCtx, 'search_notes', { query: 'Schrodinger' });
    expect(searchRes.success).toBe(true);
    expect(searchRes.output).toContain('Found 1 matching');
  });
});
