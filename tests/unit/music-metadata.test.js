// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  parseAudioMetadata,
  parseFromFilename,
  parseLrcLyrics,
  parseVorbisComment,
} from '../../src/apps/music/metadata.js';

describe('Audio Metadata Parser', () => {
  it('parses artist and title from filename fallback', () => {
    expect(parseFromFilename('Daft Punk - One More Time.mp3')).toEqual({
      artist: 'Daft Punk',
      title: 'One More Time',
      album: 'Unknown Album',
    });
    expect(parseFromFilename('/Music/Electronic/Kraftwerk - Das Model.flac')).toEqual({
      artist: 'Kraftwerk',
      title: 'Das Model',
      album: 'Unknown Album',
    });
    expect(parseFromFilename('SingleNameTrack.ogg')).toEqual({
      artist: 'Unknown Artist',
      title: 'SingleNameTrack',
      album: 'Unknown Album',
    });
  });

  it('parses ID3v1 tags from trailing 128 bytes', async () => {
    const buffer = new ArrayBuffer(256);
    const bytes = new Uint8Array(buffer);

    // TAG marker at offset 128
    const offset = 128;
    bytes[offset] = 0x54; // T
    bytes[offset + 1] = 0x41; // A
    bytes[offset + 2] = 0x47; // G

    const writeAscii = (str, start, maxLen) => {
      for (let i = 0; i < Math.min(str.length, maxLen); i++) {
        bytes[start + i] = str.charCodeAt(i);
      }
    };

    writeAscii('Retro Wave Song', offset + 3, 30);
    writeAscii('Synthmaster', offset + 33, 30);
    writeAscii('Neon Dreams', offset + 63, 30);
    writeAscii('1984', offset + 93, 4);
    // Track number byte 126
    bytes[offset + 125] = 0;
    bytes[offset + 126] = 7;

    const meta = await parseAudioMetadata(buffer, 'fallback.mp3');
    expect(meta.title).toBe('Retro Wave Song');
    expect(meta.artist).toBe('Synthmaster');
    expect(meta.album).toBe('Neon Dreams');
    expect(meta.year).toBe('1984');
    expect(meta.track).toBe(7);
  });

  it('parses ID3v2.3 tags with frames', async () => {
    // Construct minimal ID3v2.3 tag
    // Header: 'ID3', v2.3 (3, 0), flags: 0, size (synchsafe)
    const header = [0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00]; // size = 128

    const createTextFrame = (id, text) => {
      const idBytes = [id.charCodeAt(0), id.charCodeAt(1), id.charCodeAt(2), id.charCodeAt(3)];
      const textBytes = Array.from(new TextEncoder().encode(text));
      const content = [0x03, ...textBytes]; // utf-8 encoding byte (3)
      const size = content.length;
      const sizeBytes = [(size >> 24) & 0xff, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff];
      return [...idBytes, ...sizeBytes, 0x00, 0x00, ...content];
    };

    const tit2 = createTextFrame('TIT2', 'Cyber City');
    const tpe1 = createTextFrame('TPE1', 'Nexus Band');
    const talb = createTextFrame('TALB', 'Arcade Nights');
    const tyer = createTextFrame('TYER', '2026');
    const trck = createTextFrame('TRCK', '3/10');

    const totalPayload = [...header, ...tit2, ...tpe1, ...talb, ...tyer, ...trck];
    const u8 = new Uint8Array(totalPayload);

    const meta = await parseAudioMetadata(u8.buffer, 'ignored.mp3');
    expect(meta.title).toBe('Cyber City');
    expect(meta.artist).toBe('Nexus Band');
    expect(meta.album).toBe('Arcade Nights');
    expect(meta.year).toBe('2026');
    expect(meta.track).toBe(3);
    expect(meta.trackTotal).toBe(10);
  });

  it('parses Vorbis Comments', () => {
    // Vendor length 4, "TEST", user comment count 4
    const encoder = new TextEncoder();
    const vendorBytes = encoder.encode('TEST');
    const comments = ['TITLE=Midnight Drive', 'ARTIST=Kavinsky', 'ALBUM=OutRun', 'TRACKNUMBER=5/12'];

    const chunks = [];
    // Vendor len (little endian 32-bit)
    chunks.push(new Uint8Array([vendorBytes.length, 0, 0, 0]));
    chunks.push(vendorBytes);
    // User comment count (little endian 32-bit)
    chunks.push(new Uint8Array([comments.length, 0, 0, 0]));

    for (const c of comments) {
      const cBytes = encoder.encode(c);
      chunks.push(new Uint8Array([cBytes.length, 0, 0, 0]));
      chunks.push(cBytes);
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const bytes = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      bytes.set(c, off);
      off += c.length;
    }

    const meta = parseVorbisComment(bytes);
    expect(meta.title).toBe('Midnight Drive');
    expect(meta.artist).toBe('Kavinsky');
    expect(meta.album).toBe('OutRun');
    expect(meta.track).toBe(5);
    expect(meta.trackTotal).toBe(12);
  });

  it('parses synchronized .lrc lyrics', () => {
    const lrc = `
[ti:Midnight Drive]
[ar:Nexus Band]
[00:12.50]First line of the song
[00:18.20]Cruising down the highway
[01:05.80]Lights in the neon rain
[01:05.80][02:10.00]Chorus repeats here
    `;

    const parsed = parseLrcLyrics(lrc);
    expect(parsed.length).toBe(5);
    expect(parsed[0]).toEqual({ time: 12.5, text: 'First line of the song' });
    expect(parsed[1]).toEqual({ time: 18.2, text: 'Cruising down the highway' });
    expect(parsed[2]).toEqual({ time: 65.8, text: 'Lights in the neon rain' });
    expect(parsed[3]).toEqual({ time: 65.8, text: 'Chorus repeats here' });
    expect(parsed[4]).toEqual({ time: 130, text: 'Chorus repeats here' });
  });
});
