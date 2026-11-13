// @ts-check
// AI service interface and provider manager.
// Universal provider abstraction: Ollama, Lemonade, OpenAI-compatible endpoints, Anthropic.
// API keys are encrypted at rest. Requests are never faked.

import { createAnthropicAdapter } from './adapters/anthropic.js';
import { createLemonadeAdapter } from './adapters/lemonade.js';
import { createOllamaAdapter } from './adapters/ollama.js';
import { createOpenAiAdapter } from './adapters/openai.js';
import { testProviderConnection } from './diagnostics.js';
import { createRagService } from './rag.js';
import { decryptApiKey, encryptApiKey, getDeviceKey } from './security.js';
import { executeToolCall, formatToolConfirmation, getOpenAiToolDefinitions, TOOL_DECLARATIONS } from './tools.js';

/**
 * @typedef {object} ProviderProfile
 * @property {string} id
 * @property {string} name
 * @property {'ollama' | 'openai' | 'anthropic' | 'lemonade'} type
 * @property {string} baseUrl
 * @property {string} [apiKey]
 * @property {string} [defaultModel]
 * @property {Record<string, string>} [extraHeaders]
 * @property {boolean} enabled
 * @property {string[]} [customModels]
 */

/** @type {ProviderProfile[]} */
const DEFAULT_PRESETS = [
  {
    id: 'ollama-local',
    name: 'Local Ollama',
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3:latest',
    enabled: false,
  },
  {
    id: 'lmstudio-local',
    name: 'LM Studio / LocalAI',
    type: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    enabled: false,
  },
  {
    id: 'lemonade-local',
    name: 'Lemonade',
    type: 'lemonade',
    baseUrl: 'http://localhost:8000/v1',
    defaultModel: '',
    enabled: false,
  },
  {
    id: 'openai-cloud',
    name: 'OpenAI (Official)',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    enabled: false,
  },
  {
    id: 'anthropic-cloud',
    name: 'Anthropic Claude',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    enabled: false,
  },
];

/**
 * @param {object} options
 * @param {import('../../kernel/bus.js').EventBus} options.bus
 * @param {{ get(key: string): Promise<unknown>, set(key: string, value: unknown): Promise<void> }} [options.store]
 * @param {any} [options.network] Network log service for System Monitor
 * @param {any} [options.log]
 */
export function createAi({ bus, store, network, log }) {
  /** @type {ProviderProfile[]} */
  let profiles = [];
  /** @type {string | null} */
  let activeProfileId = null;
  /** @type {CryptoKey | null} */
  let deviceKey = null;

  // Aggregate stats
  let totalRequests = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalLatencyMs = 0;

  async function load() {
    if (!store) return;
    try {
      deviceKey = await getDeviceKey(store);
      const data = /** @type {any} */ (await store.get('profiles_config'));
      if (data && Array.isArray(data.profiles) && data.profiles.length > 0) {
        profiles = data.profiles;
        activeProfileId = data.activeProfileId || null;
      } else {
        // Initialize with default presets (all disabled initially)
        profiles = DEFAULT_PRESETS.map((p) => ({ ...p }));
        activeProfileId = profiles[0].id;
        await save();
      }

      const stats = /** @type {any} */ (await store.get('aggregate_stats'));
      if (stats) {
        totalRequests = stats.totalRequests || 0;
        totalTokensIn = stats.totalTokensIn || 0;
        totalTokensOut = stats.totalTokensOut || 0;
        totalLatencyMs = stats.totalLatencyMs || 0;
      }
    } catch (err) {
      log?.error('Failed to load AI configuration', err);
    }
  }

  async function save() {
    if (!store) return;
    try {
      await store.set('profiles_config', {
        profiles,
        activeProfileId,
      });
      await store.set('aggregate_stats', {
        totalRequests,
        totalTokensIn,
        totalTokensOut,
        totalLatencyMs,
      });
    } catch (err) {
      log?.error('Failed to save AI configuration', err);
    }
  }

  function getActiveRawProfile() {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId) || null;
  }

  /**
   * Instantiates an adapter for a given profile with decrypted API key.
   * @param {ProviderProfile} profile
   */
  async function createAdapterForProfile(profile) {
    const rawKey = profile.apiKey ? await decryptApiKey(profile.apiKey, deviceKey) : '';
    const config = {
      baseUrl: profile.baseUrl,
      apiKey: rawKey,
      extraHeaders: profile.extraHeaders,
    };

    switch (profile.type) {
      case 'ollama':
        return createOllamaAdapter(config);
      case 'lemonade':
        return createLemonadeAdapter(config);
      case 'anthropic':
        return createAnthropicAdapter(config);
      case 'openai':
      default:
        return createOpenAiAdapter(config);
    }
  }

  const rag = createRagService({
    store: store || { get: async () => null, set: async () => {} },
    getEmbedder: () => {
      const active = getActiveRawProfile();
      if (!active || !active.enabled) return null;
      // Synchronous embedder proxy
      return {
        async embed(/** @type {string[]} */ texts, /** @type {any} */ options) {
          const adapter = await createAdapterForProfile(active);
          return adapter.embed(texts, {
            ...options,
            model: options?.model || active.defaultModel,
          });
        },
      };
    },
  });

  return {
    load,

    isAvailable() {
      const active = getActiveRawProfile();
      return !!active && active.enabled;
    },

    /** @param {(available: boolean) => void} fn */
    onAvailabilityChange(fn) {
      return bus.on('ai:availability-changed', (p) => fn(!!p?.available));
    },

    async listProfiles() {
      return profiles.map((p) => ({
        ...p,
        // Mask API key for UI display
        apiKey: p.apiKey ? (p.apiKey.startsWith('enc:') || p.apiKey.startsWith('b64:') ? '••••••••' : '••••••••') : '',
        hasKey: Boolean(p.apiKey),
      }));
    },

    async getProfile(/** @type {string} */ id) {
      const found = profiles.find((p) => p.id === id);
      if (!found) return null;
      const decryptedKey = found.apiKey ? await decryptApiKey(found.apiKey, deviceKey) : '';
      return {
        ...found,
        apiKey: decryptedKey,
      };
    },

    async getActiveProfile() {
      const raw = getActiveRawProfile();
      if (!raw) return null;
      const decryptedKey = raw.apiKey ? await decryptApiKey(raw.apiKey, deviceKey) : '';
      return {
        ...raw,
        apiKey: decryptedKey,
      };
    },

    async setActiveProfile(/** @type {string} */ id) {
      const found = profiles.find((p) => p.id === id);
      if (!found) throw new Error(`Profile "${id}" not found`);
      activeProfileId = id;
      await save();
      bus.emit('ai:profile-changed', { profile: found });
      bus.emit('ai:availability-changed', { available: found.enabled });
    },

    /**
     * @param {ProviderProfile & { rawApiKey?: string }} profile
     */
    async saveProfile(profile) {
      const existingIdx = profiles.findIndex((p) => p.id === profile.id);
      let encryptedKey = profile.apiKey;

      // If a new rawApiKey was provided, encrypt it
      if (profile.rawApiKey !== undefined) {
        encryptedKey = await encryptApiKey(profile.rawApiKey, deviceKey);
      } else if (existingIdx >= 0 && profile.apiKey === '••••••••') {
        // Keep existing encrypted key
        encryptedKey = profiles[existingIdx].apiKey;
      }

      const toSave = {
        id: profile.id || `profile-${Date.now()}`,
        name: profile.name || 'AI Provider',
        type: profile.type || 'openai',
        baseUrl: (profile.baseUrl || '').trim(),
        apiKey: encryptedKey,
        defaultModel: profile.defaultModel || '',
        extraHeaders: profile.extraHeaders || {},
        enabled: Boolean(profile.enabled),
        customModels: profile.customModels || [],
      };

      if (existingIdx >= 0) {
        profiles[existingIdx] = toSave;
      } else {
        profiles.push(toSave);
        if (!activeProfileId) activeProfileId = toSave.id;
      }

      await save();

      const wasAvailable = this.isAvailable();
      bus.emit('ai:profile-changed', { profile: toSave });
      bus.emit('ai:availability-changed', { available: wasAvailable });
      return toSave;
    },

    async deleteProfile(/** @type {string} */ id) {
      profiles = profiles.filter((p) => p.id !== id);
      if (activeProfileId === id) {
        activeProfileId = profiles.length > 0 ? profiles[0].id : null;
      }
      await save();
      bus.emit('ai:availability-changed', { available: this.isAvailable() });
    },

    /**
     * @param {string | ProviderProfile} [profileOrId]
     */
    async testConnection(profileOrId) {
      const profile =
        typeof profileOrId === 'string'
          ? (await this.getProfile(profileOrId)) || null
          : profileOrId && typeof profileOrId === 'object'
            ? profileOrId
            : await this.getActiveProfile();

      if (!profile) {
        return {
          status: /** @type {const} */ ('error'),
          message: 'No provider profile specified.',
        };
      }

      const adapter = await createAdapterForProfile(profile);
      return testProviderConnection(adapter, profile);
    },

    /**
     * @param {string} [profileId]
     */
    async listModels(profileId) {
      const profile = profileId ? await this.getProfile(profileId) : await this.getActiveProfile();
      if (!profile) return [];
      const adapter = await createAdapterForProfile(profile);
      const serverModels = await adapter.listModels().catch(() => []);
      const custom = (profile.customModels || []).map((name) => ({ id: name, name }));
      return [...serverModels, ...custom];
    },

    /**
     * Chat completion with streaming and tool calling.
     * @param {any[]} messages
     * @param {Record<string, any>} [options]
     */
    async chat(messages, options = {}) {
      const active = await this.getActiveProfile();
      if (!active || !active.enabled) {
        throw new Error('No active AI provider configured. Please configure an AI server in Settings.');
      }

      const model = options.model || active.defaultModel;
      if (!model) {
        throw new Error('No model selected. Please select a model in chat or set a default model in Settings.');
      }

      const adapter = await createAdapterForProfile(active);
      const networkTracker = network?.start({
        app: 'nexus.chat',
        method: 'POST',
        url: `${active.baseUrl}/chat`,
      });

      try {
        const result = await adapter.chat(messages, {
          ...options,
          model,
        });

        // Track stats
        totalRequests++;
        totalTokensIn += result.usage?.promptTokens || 0;
        totalTokensOut += result.usage?.completionTokens || 0;
        totalLatencyMs += result.stats?.latencyMs || 0;
        void save();

        networkTracker?.done({ status: 200 });
        return result;
      } catch (err) {
        const error = /** @type {Error} */ (err);
        networkTracker?.done({ status: 500, error: error.message });
        throw err;
      }
    },

    /**
     * Single-turn quick completion helper.
     * @param {string} prompt
     * @param {Record<string, any>} [options]
     * @returns {Promise<string>}
     */
    async complete(prompt, options = {}) {
      const result = await this.chat(
        [...(options.system ? [{ role: 'system', content: options.system }] : []), { role: 'user', content: prompt }],
        options,
      );
      return result.text;
    },

    /**
     * Embedding helper.
     * @param {string | string[]} texts
     * @param {object} [options]
     */
    async embed(texts, options = {}) {
      const active = await this.getActiveProfile();
      if (!active || !active.enabled) {
        throw new Error('No active AI provider configured.');
      }
      const adapter = await createAdapterForProfile(active);
      return adapter.embed(texts, options);
    },

    getStats() {
      return {
        totalRequests,
        totalTokensIn,
        totalTokensOut,
        averageLatencyMs: totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0,
      };
    },

    // RAG and Tools services
    rag,
    tools: {
      declarations: TOOL_DECLARATIONS,
      getOpenAiDeclarations: getOpenAiToolDefinitions,
      formatConfirmation: formatToolConfirmation,
      execute: executeToolCall,
    },
  };
}

/** @typedef {ReturnType<typeof createAi>} AiService */
