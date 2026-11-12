import { describe, expect, it } from 'vitest';
import { parseExif, stripExif } from '../../src/apps/photos/exif.js';

describe('JPEG EXIF Parser & Stripper', () => {
  it('handles non-JPEG or short buffers gracefully', () => {
    expect(parseExif(new ArrayBuffer(2))).toBeNull();
    expect(parseExif(new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer)).toBeNull();
  });

  it('parses structured EXIF data from synthetic JPEG APP1 segment', () => {
    // Construct minimal JPEG with APP1 EXIF segment:
    // SOI: 0xFF, 0xD8
    // Marker: 0xFF, 0xE1
    // Length: 2 bytes
    // 'Exif\0\0' (6 bytes)
    // TIFF header: 'II' (little endian: 0x49, 0x49), 42 (0x2A, 0x00), offset to IFD0 (8, 0, 0, 0)
    // IFD0: count = 2
    // Tag 1: 0x010F (Make), type 2 (ASCII), count 6, offset
    // Tag 2: 0x0110 (Model), type 2 (ASCII), count 8, offset

    const data = [
      0xff,
      0xd8, // SOI
      0xff,
      0xe1, // APP1
      0x00,
      0x50, // Length: 80 bytes
      0x45,
      0x78,
      0x69,
      0x66,
      0x00,
      0x00, // 'Exif\0\0'
      // TIFF header at tiffStart (index 10)
      0x49,
      0x49, // Little endian 'II'
      0x2a,
      0x00, // 42
      0x08,
      0x00,
      0x00,
      0x00, // IFD0 offset: 8 bytes from tiffStart
      // IFD0: 2 entries (index 18)
      0x02,
      0x00,
      // Entry 1: Make (0x010F), ASCII (2), count 6, offset 38 (from tiffStart => index 50)
      0x0f,
      0x01,
      0x02,
      0x00,
      0x06,
      0x00,
      0x00,
      0x00,
      0x26,
      0x00,
      0x00,
      0x00,
      // Entry 2: Model (0x0110), ASCII (2), count 8, offset 44 (from tiffStart => index 56)
      0x10,
      0x01,
      0x02,
      0x00,
      0x08,
      0x00,
      0x00,
      0x00,
      0x2c,
      0x00,
      0x00,
      0x00,
      // Next IFD offset: 0
      0x00,
      0x00,
      0x00,
      0x00,
      // String 1 at offset 38: "Nexus\0"
      0x4e,
      0x65,
      0x78,
      0x75,
      0x73,
      0x00,
      // String 2 at offset 44: "Cam Pro\0"
      0x43,
      0x61,
      0x6d,
      0x20,
      0x50,
      0x72,
      0x6f,
      0x00,
      0xff,
      0xda, // SOS
    ];

    const buf = new Uint8Array(data).buffer;
    const meta = parseExif(buf);
    expect(meta).not.toBeNull();
    expect(meta?.make).toBe('Nexus');
    expect(meta?.model).toBe('Cam Pro');
  });

  it('strips APP1 EXIF segment while preserving SOI and image payload', () => {
    const data = [
      0xff,
      0xd8, // SOI
      0xff,
      0xe1,
      0x00,
      0x08,
      0x45,
      0x78,
      0x69,
      0x66,
      0x00,
      0x00, // APP1 Exif
      0xff,
      0xda,
      0x12,
      0x34, // SOS
    ];
    const buf = new Uint8Array(data).buffer;
    const cleanBuf = stripExif(buf);
    const cleanBytes = new Uint8Array(cleanBuf);

    // Should contain SOI (0xFFD8) and SOS (0xFFDA 0x1234), without 0xFFE1
    expect(cleanBytes[0]).toBe(0xff);
    expect(cleanBytes[1]).toBe(0xd8);
    expect(cleanBytes[2]).toBe(0xff);
    expect(cleanBytes[3]).toBe(0xda);
    expect(cleanBytes[4]).toBe(0x12);
    expect(cleanBytes[5]).toBe(0x34);
    expect(cleanBytes.length).toBe(6);
  });
});
