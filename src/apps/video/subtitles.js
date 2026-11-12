// @ts-check
/**
 * Subtitle parser for .srt (SubRip) and .vtt (WebVTT) formats.
 */

/**
 * @typedef {object} SubtitleCue
 * @property {number} start - In seconds
 * @property {number} end - In seconds
 * @property {string} text - Subtitle text content
 */

/**
 * Converts timestamp string (00:01:23,456 or 01:23.456) to seconds.
 * @param {string} ts
 * @returns {number}
 */
export function parseTimestamp(ts) {
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return parseFloat(cleaned) || 0;
}

/**
 * Parses SRT subtitle text into cues.
 * @param {string} text
 * @param {number} [offsetSec]
 * @returns {SubtitleCue[]}
 */
export function parseSrt(text, offsetSec = 0) {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  /** @type {SubtitleCue[]} */
  const cues = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    // Check if line 0 is numeric index
    if (/^\d+$/.test(lines[0].trim()) && lines.length >= 2) {
      timeLineIdx = 1;
    }

    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/,
    );
    if (!match) continue;

    const start = Math.max(0, parseTimestamp(match[1]) + offsetSec);
    const end = Math.max(0, parseTimestamp(match[2]) + offsetSec);
    const cueText = lines
      .slice(timeLineIdx + 1)
      .join('\n')
      .trim();

    if (cueText) {
      cues.push({ start, end, text: cueText });
    }
  }

  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Parses WebVTT subtitle text into cues.
 * @param {string} text
 * @param {number} [offsetSec]
 * @returns {SubtitleCue[]}
 */
export function parseVtt(text, offsetSec = 0) {
  if (!text) return [];
  const cleaned = text.replace(/^WEBVTT[^\n]*\n+/i, '');
  return parseSrt(cleaned, offsetSec);
}

/**
 * Automatically detects format and parses subtitles.
 * @param {string} text
 * @param {number} [offsetSec]
 * @returns {SubtitleCue[]}
 */
export function parseSubtitles(text, offsetSec = 0) {
  if (!text) return [];
  if (text.trim().startsWith('WEBVTT')) {
    return parseVtt(text, offsetSec);
  }
  return parseSrt(text, offsetSec);
}
