import { describe, expect, it } from 'vitest';
import { parseSrt, parseSubtitles, parseTimestamp, parseVtt } from '../../src/apps/video/subtitles.js';

describe('Video Subtitle Parser', () => {
  it('parses timestamps correctly', () => {
    expect(parseTimestamp('00:01:23,500')).toBe(83.5);
    expect(parseTimestamp('01:23.500')).toBe(83.5);
    expect(parseTimestamp('02:00:00')).toBe(7200);
  });

  it('parses SRT subtitle blocks', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello World!

2
00:00:05,500 --> 00:00:08,200
Welcome to Nexus Arcade OS.
Second line of subtitle.`;

    const cues = parseSrt(srt);
    expect(cues.length).toBe(2);
    expect(cues[0]).toEqual({
      start: 1,
      end: 4,
      text: 'Hello World!',
    });
    expect(cues[1]).toEqual({
      start: 5.5,
      end: 8.2,
      text: 'Welcome to Nexus Arcade OS.\nSecond line of subtitle.',
    });
  });

  it('parses WebVTT subtitles with offset', () => {
    const vtt = `WEBVTT - Sample

00:01:00.000 --> 00:01:05.000
First VTT cue`;

    const cues = parseVtt(vtt, 2.5);
    expect(cues.length).toBe(1);
    expect(cues[0].start).toBe(62.5);
    expect(cues[0].end).toBe(67.5);
    expect(cues[0].text).toBe('First VTT cue');
  });

  it('automatically detects format with parseSubtitles', () => {
    const srt = `1\n00:00:02,000 --> 00:00:03,000\nSRT cue`;
    const vtt = `WEBVTT\n\n00:00:02.000 --> 00:00:03.000\nVTT cue`;

    expect(parseSubtitles(srt)[0].text).toBe('SRT cue');
    expect(parseSubtitles(vtt)[0].text).toBe('VTT cue');
  });
});
