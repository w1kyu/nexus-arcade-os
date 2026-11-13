// @ts-check
// Adapter for Lemonade (OpenAI-compatible server).
import { createOpenAiAdapter } from './openai.js';

/**
 * @param {object} config
 * @param {string} [config.baseUrl]
 * @param {string} [config.apiKey]
 * @param {Record<string, string>} [config.extraHeaders]
 */
export function createLemonadeAdapter(config) {
  const adapter = createOpenAiAdapter({
    ...config,
    baseUrl: config.baseUrl || 'http://localhost:8000/v1',
  });

  return {
    ...adapter,
    type: 'lemonade',
  };
}
