// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  generateCurlSnippet,
  generateFetchSnippet,
  interpolateVariables,
} from '../../src/apps/httpclient/http-core.js';

describe('http-core', () => {
  it('interpolates environment variables', () => {
    const vars = { baseUrl: 'https://api.example.com', token: 'secret123' };
    const url = interpolateVariables('{{baseUrl}}/users/{{userId}}', vars);
    expect(url).toBe('https://api.example.com/users/{{userId}}');

    const auth = interpolateVariables('Bearer {{token}}', vars);
    expect(auth).toBe('Bearer secret123');
  });

  it('generates curl snippet', () => {
    const cmd = generateCurlSnippet({
      method: 'POST',
      url: 'https://api.example.com/login',
      headers: { 'Content-Type': 'application/json' },
      body: '{"user":"test"}',
    });
    expect(cmd).toContain('curl -X POST "https://api.example.com/login"');
    expect(cmd).toContain('-H "Content-Type: application/json"');
    expect(cmd).toContain('-d "{\\"user\\":\\"test\\"}"');
  });

  it('generates fetch snippet', () => {
    const js = generateFetchSnippet({
      method: 'GET',
      url: 'https://api.example.com/items',
    });
    expect(js).toContain('fetch("https://api.example.com/items"');
    expect(js).toContain('"method": "GET"');
  });
});
