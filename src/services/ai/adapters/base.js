// @ts-check
// Base utilities for AI streaming and token statistics.

/**
 * Parses an SSE (Server-Sent Events) stream from a fetch Response.
 * @param {Response} response
 * @param {(data: string, eventName?: string) => void} onEvent
 * @param {AbortSignal} [signal]
 */
export async function parseSseStream(response, onEvent, signal) {
  if (!response.body) throw new Error('Response body is null');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = '';
          continue;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();
          onEvent(data, currentEvent);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses an NDJSON (newline-delimited JSON) stream from a fetch Response.
 * @param {Response} response
 * @param {(json: any) => void} onLine
 * @param {AbortSignal} [signal]
 */
export async function parseNdjsonStream(response, onLine, signal) {
  if (!response.body) throw new Error('Response body is null');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          onLine(parsed);
        } catch {
          // Ignore partial or unparseable lines
        }
      }
    }
    if (buffer.trim()) {
      try {
        onLine(JSON.parse(buffer.trim()));
      } catch {
        // Ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Estimates token count from text using character heuristic (~4 chars/token).
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Tracks response timing and computes tokens/sec and latency.
 */
export function createMetricsTracker() {
  const startTime = Date.now();
  let firstTokenTime = 0;
  let completionTokens = 0;

  return {
    recordToken(tokenCount = 1) {
      if (!firstTokenTime) firstTokenTime = Date.now();
      completionTokens += tokenCount;
    },
    /**
     * @param {{ promptTokens?: number, completionTokens?: number }} [reportedUsage]
     */
    finish(reportedUsage) {
      const endTime = Date.now();
      const durationMs = Math.max(1, endTime - startTime);
      const latencyMs = firstTokenTime ? firstTokenTime - startTime : durationMs;
      const tokensOut = reportedUsage?.completionTokens ?? completionTokens;
      const genDurationSec = (endTime - (firstTokenTime || startTime)) / 1000;
      const tokensPerSec = genDurationSec > 0.05 ? Math.round((tokensOut / genDurationSec) * 10) / 10 : 0;

      return {
        durationMs,
        latencyMs,
        tokensPerSec,
        promptTokens: reportedUsage?.promptTokens ?? 0,
        completionTokens: tokensOut,
        totalTokens: (reportedUsage?.promptTokens ?? 0) + tokensOut,
      };
    },
  };
}
