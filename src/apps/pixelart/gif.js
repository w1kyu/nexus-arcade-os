// @ts-check
// Pure JavaScript GIF89a animated GIF encoder.
// Encodes multiple frames into an animated GIF byte array without any external dependencies.

/**
 * Encode frames into an animated GIF Uint8Array.
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {{ pixels: Uint8Array, delayMs: number }[]} options.frames  pixels are indexed colors (0..palette.length-1)
 * @param {number[][]} options.palette  Array of [R, G, B]
 * @param {number} [options.transparentIndex=-1]
 * @param {number} [options.loopCount=0]  0 = infinite loop
 * @returns {Uint8Array}
 */
export function encodeGif({ width, height, frames, palette, transparentIndex = -1, loopCount = 0 }) {
  const bytes = [];

  function writeByte(b) {
    bytes.push(b & 0xff);
  }

  function writeWord(w) {
    bytes.push(w & 0xff, (w >> 8) & 0xff);
  }

  function writeString(s) {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  }

  // 1. Header
  writeString('GIF89a');

  // 2. Logical Screen Descriptor
  writeWord(width);
  writeWord(height);

  // Palette size calculation: 2^(N+1) >= palette.length
  let colorDepth = 1;
  while (1 << colorDepth < palette.length && colorDepth < 8) colorDepth++;
  const tableSize = 1 << colorDepth;

  // Packed: GCT flag (1 bit), Color Res (3 bits), Sort (0), GCT size (3 bits = colorDepth - 1)
  const gctPacked = 0x80 | ((colorDepth - 1) << 4) | (colorDepth - 1);
  writeByte(gctPacked);
  writeByte(0); // Background color index
  writeByte(0); // Pixel aspect ratio

  // 3. Global Color Table
  for (let i = 0; i < tableSize; i++) {
    if (i < palette.length) {
      writeByte(palette[i][0]);
      writeByte(palette[i][1]);
      writeByte(palette[i][2]);
    } else {
      writeByte(0);
      writeByte(0);
      writeByte(0);
    }
  }

  // 4. Netscape 2.0 Loop Extension
  if (loopCount >= 0) {
    writeByte(0x21); // Extension Introducer
    writeByte(0xff); // Application Extension Label
    writeByte(11); // Block Size
    writeString('NETSCAPE2.0');
    writeByte(3); // Sub-block Size
    writeByte(1); // Loop sub-block ID
    writeWord(loopCount);
    writeByte(0); // Block Terminator
  }

  // 5. Frames
  for (const frame of frames) {
    // Graphic Control Extension
    writeByte(0x21); // Extension Introducer
    writeByte(0xf9); // Graphic Control Label
    writeByte(4); // Block size
    const hasTransparency = transparentIndex >= 0;
    const packed = (2 << 2) | (hasTransparency ? 1 : 0); // Disposal: Restore to background
    writeByte(packed);
    writeWord(Math.round(frame.delayMs / 10)); // Delay in 1/100s
    writeByte(hasTransparency ? transparentIndex : 0);
    writeByte(0); // Block Terminator

    // Image Descriptor
    writeByte(0x2c); // Image Separator
    writeWord(0); // Left
    writeWord(0); // Top
    writeWord(width);
    writeWord(height);
    writeByte(0); // No local color table, not interlaced

    // Image Data (LZW)
    const minCodeSize = Math.max(2, colorDepth);
    writeByte(minCodeSize);

    // LZW Compression
    const lzwData = lzwCompress(frame.pixels, minCodeSize);
    // Write sub-blocks (max 255 bytes each)
    let offset = 0;
    while (offset < lzwData.length) {
      const chunkSize = Math.min(255, lzwData.length - offset);
      writeByte(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        writeByte(lzwData[offset + i]);
      }
      offset += chunkSize;
    }
    writeByte(0); // Sub-block Terminator
  }

  // 6. Trailer
  writeByte(0x3b);

  return new Uint8Array(bytes);
}

/**
 * GIF LZW compressor.
 * @param {Uint8Array} pixels
 * @param {number} minCodeSize
 * @returns {Uint8Array}
 */
function lzwCompress(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let nextCode = clearCode + 2;

  /** @type {Map<string, number>} */
  const table = new Map();
  function resetTable() {
    table.clear();
    for (let i = 0; i < clearCode; i++) {
      table.set(String(i), i);
    }
    codeSize = minCodeSize + 1;
    nextCode = clearCode + 2;
  }
  resetTable();

  const outputBits = [];
  let currentWord = 0;
  let bitsInWord = 0;

  function emitCode(code) {
    currentWord |= code << bitsInWord;
    bitsInWord += codeSize;
    while (bitsInWord >= 8) {
      outputBits.push(currentWord & 0xff);
      currentWord >>= 8;
      bitsInWord -= 8;
    }
  }

  function flushBits() {
    while (bitsInWord > 0) {
      outputBits.push(currentWord & 0xff);
      currentWord >>= 8;
      bitsInWord -= 8;
    }
  }

  emitCode(clearCode);

  let currentSeq = '';

  for (let i = 0; i < pixels.length; i++) {
    const val = String(pixels[i]);
    const nextSeq = currentSeq === '' ? val : `${currentSeq},${val}`;

    if (table.has(nextSeq)) {
      currentSeq = nextSeq;
    } else {
      emitCode(table.get(currentSeq));

      if (nextCode < 4096) {
        table.set(nextSeq, nextCode++);
        if (nextCode > 1 << codeSize && codeSize < 12) {
          codeSize++;
        }
      } else {
        emitCode(clearCode);
        resetTable();
      }
      currentSeq = val;
    }
  }

  if (currentSeq !== '') {
    emitCode(table.get(currentSeq));
  }
  emitCode(eoiCode);
  flushBits();

  return new Uint8Array(outputBits);
}
