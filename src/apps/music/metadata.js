// @ts-check
/**
 * Zero-dependency audio metadata parser for ID3v2 (MP3), ID3v1, Vorbis Comments (OGG/FLAC),
 * and MP4/M4A metadata atoms. Extracts title, artist, album, year, track number, cover art and lyrics.
 */

/**
 * @typedef {object} AudioMetadata
 * @property {string} title
 * @property {string} artist
 * @property {string} album
 * @property {string} [year]
 * @property {number} [track]
 * @property {number} [trackTotal]
 * @property {string} [genre]
 * @property {string} [lyrics]
 * @property {string} [coverUrl] - Blob URL or data URL if artwork present
 * @property {number} [duration] - In seconds if available
 */

/**
 * Helper to decode text with various encodings.
 * @param {Uint8Array} bytes
 * @param {string} [encoding]
 * @returns {string}
 */
function decodeText(bytes, encoding = 'utf-8') {
  try {
    const decoder = new TextDecoder(encoding);
    let str = decoder.decode(bytes);
    // Strip trailing null characters
    const nullIdx = str.indexOf('\0');
    if (nullIdx !== -1) str = str.slice(0, nullIdx);
    return str.trim();
  } catch {
    return String.fromCharCode(...bytes)
      .replace(/\0+$/, '')
      .trim();
  }
}

/**
 * Parses ID3v2 metadata from an ArrayBuffer.
 * @param {DataView} view
 * @returns {Partial<AudioMetadata> | null}
 */
function parseID3v2(view) {
  if (view.byteLength < 10) return null;
  // Check 'ID3' marker
  if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
    return null;
  }

  const majorVersion = view.getUint8(3); // 3 for ID3v2.3, 4 for ID3v2.4
  const flags = view.getUint8(5);
  // Synchsafe integer size (7 bits per byte)
  const size =
    ((view.getUint8(6) & 0x7f) << 21) |
    ((view.getUint8(7) & 0x7f) << 14) |
    ((view.getUint8(8) & 0x7f) << 7) |
    (view.getUint8(9) & 0x7f);

  const tagEnd = Math.min(view.byteLength, 10 + size);
  let offset = 10;

  // Extended header flag (bit 6)
  if (flags & 0x40 && offset + 4 <= tagEnd) {
    const extSize =
      majorVersion === 4
        ? ((view.getUint8(offset) & 0x7f) << 21) |
          ((view.getUint8(offset + 1) & 0x7f) << 14) |
          ((view.getUint8(offset + 2) & 0x7f) << 7) |
          (view.getUint8(offset + 3) & 0x7f)
        : view.getUint32(offset);
    offset += extSize;
  }

  /** @type {Partial<AudioMetadata>} */
  const meta = {};

  while (offset + 10 <= tagEnd) {
    // Read 4-character Frame ID
    const frameIdBytes = new Uint8Array(view.buffer, view.byteOffset + offset, 4);
    const frameId = String.fromCharCode(...frameIdBytes);
    // If we hit padding (0s), stop
    if (frameIdBytes[0] === 0) break;

    const frameSize =
      majorVersion === 4
        ? ((view.getUint8(offset + 4) & 0x7f) << 21) |
          ((view.getUint8(offset + 5) & 0x7f) << 14) |
          ((view.getUint8(offset + 6) & 0x7f) << 7) |
          (view.getUint8(offset + 7) & 0x7f)
        : view.getUint32(offset + 4);

    offset += 10;
    if (frameSize <= 0 || offset + frameSize > tagEnd) break;

    const frameBytes = new Uint8Array(view.buffer, view.byteOffset + offset, frameSize);

    // Text frames
    if (frameId.startsWith('T') && frameId !== 'TXXX') {
      const encodingByte = frameBytes[0];
      const enc = encodingByte === 1 || encodingByte === 2 ? 'utf-16' : encodingByte === 3 ? 'utf-8' : 'iso-8859-1';
      const text = decodeText(frameBytes.subarray(1), enc);

      if (frameId === 'TIT2') meta.title = text;
      else if (frameId === 'TPE1' || frameId === 'TPE2') meta.artist = meta.artist || text;
      else if (frameId === 'TALB') meta.album = text;
      else if (frameId === 'TYER' || frameId === 'TDRC') meta.year = text.slice(0, 4);
      else if (frameId === 'TCON') meta.genre = text;
      else if (frameId === 'TRCK') {
        const [num, total] = text.split('/');
        if (num) meta.track = parseInt(num, 10) || undefined;
        if (total) meta.trackTotal = parseInt(total, 10) || undefined;
      }
    } else if (frameId === 'USLT') {
      // Unsynchronised lyrics
      const encodingByte = frameBytes[0];
      const enc = encodingByte === 1 || encodingByte === 2 ? 'utf-16' : 'utf-8';
      // Language (3 bytes), content descriptor terminated by null, then lyrics text
      if (frameBytes.length > 5) {
        let textOffset = 4;
        while (textOffset < frameBytes.length && frameBytes[textOffset] !== 0) textOffset++;
        textOffset++; // skip null
        if (textOffset < frameBytes.length) {
          meta.lyrics = decodeText(frameBytes.subarray(textOffset), enc);
        }
      }
    } else if (frameId === 'APIC') {
      // Attached picture
      try {
        const encodingByte = frameBytes[0];
        let p = 1;
        // MIME type is latin1 terminated by 0
        let mime = '';
        while (p < frameBytes.length && frameBytes[p] !== 0) {
          mime += String.fromCharCode(frameBytes[p]);
          p++;
        }
        p++; // skip null
        p++; // skip picture type byte
        // Description terminated by null (1 byte or 2 for utf16)
        if (encodingByte === 1 || encodingByte === 2) {
          while (p + 1 < frameBytes.length && !(frameBytes[p] === 0 && frameBytes[p + 1] === 0)) p += 2;
          p += 2;
        } else {
          while (p < frameBytes.length && frameBytes[p] !== 0) p++;
          p++;
        }
        if (p < frameBytes.length) {
          const imgBytes = frameBytes.subarray(p);
          const mimeType = mime || 'image/jpeg';
          const blob = new Blob([imgBytes], { type: mimeType });
          meta.coverUrl = URL.createObjectURL(blob);
        }
      } catch {
        // ignore image parse error
      }
    }

    offset += frameSize;
  }

  return meta;
}

/**
 * Parses ID3v1 metadata from the last 128 bytes of an MP3.
 * @param {DataView} view
 * @returns {Partial<AudioMetadata> | null}
 */
function parseID3v1(view) {
  if (view.byteLength < 128) return null;
  const offset = view.byteLength - 128;
  // Check 'TAG' marker
  if (view.getUint8(offset) !== 0x54 || view.getUint8(offset + 1) !== 0x41 || view.getUint8(offset + 2) !== 0x47) {
    return null;
  }
  const title = decodeText(new Uint8Array(view.buffer, view.byteOffset + offset + 3, 30), 'iso-8859-1');
  const artist = decodeText(new Uint8Array(view.buffer, view.byteOffset + offset + 33, 30), 'iso-8859-1');
  const album = decodeText(new Uint8Array(view.buffer, view.byteOffset + offset + 63, 30), 'iso-8859-1');
  const year = decodeText(new Uint8Array(view.buffer, view.byteOffset + offset + 93, 4), 'iso-8859-1');

  // Track number in ID3v1.1: byte 125 is 0 and byte 126 is track
  let track;
  if (view.getUint8(offset + 125) === 0 && view.getUint8(offset + 126) !== 0) {
    track = view.getUint8(offset + 126);
  }

  return {
    title: title || undefined,
    artist: artist || undefined,
    album: album || undefined,
    year: year || undefined,
    track,
  };
}

/**
 * Parses Vorbis Comments from a Uint8Array block (common to OGG and FLAC).
 * @param {Uint8Array} bytes
 * @param {number} [startOffset]
 * @returns {Partial<AudioMetadata>}
 */
export function parseVorbisComment(bytes, startOffset = 0) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = startOffset;
  if (offset + 4 > bytes.length) return {};

  const vendorLen = view.getUint32(offset, true); // little endian
  offset += 4 + vendorLen;
  if (offset + 4 > bytes.length) return {};

  const userCommentCount = view.getUint32(offset, true);
  offset += 4;

  /** @type {Partial<AudioMetadata>} */
  const meta = {};

  for (let i = 0; i < userCommentCount; i++) {
    if (offset + 4 > bytes.length) break;
    const len = view.getUint32(offset, true);
    offset += 4;
    if (offset + len > bytes.length) break;
    const comment = decodeText(bytes.subarray(offset, offset + len), 'utf-8');
    offset += len;

    const eq = comment.indexOf('=');
    if (eq > 0) {
      const key = comment.slice(0, eq).toUpperCase();
      const val = comment.slice(eq + 1).trim();
      if (key === 'TITLE') meta.title = val;
      else if (key === 'ARTIST') meta.artist = meta.artist ? `${meta.artist}, ${val}` : val;
      else if (key === 'ALBUM') meta.album = val;
      else if (key === 'DATE' || key === 'YEAR') meta.year = val.slice(0, 4);
      else if (key === 'GENRE') meta.genre = val;
      else if (key === 'LYRICS') meta.lyrics = val;
      else if (key === 'TRACKNUMBER') {
        const [n, t] = val.split('/');
        if (n) meta.track = parseInt(n, 10) || undefined;
        if (t) meta.trackTotal = parseInt(t, 10) || undefined;
      } else if (key === 'METADATA_BLOCK_PICTURE') {
        try {
          // Parse base64 picture block
          const binaryStr = atob(val);
          const picBytes = new Uint8Array(binaryStr.length);
          for (let b = 0; b < binaryStr.length; b++) picBytes[b] = binaryStr.charCodeAt(b);
          const picView = new DataView(picBytes.buffer);
          let pOff = 4; // skip type (4 bytes)
          const mimeLen = picView.getUint32(pOff);
          pOff += 4;
          const mime = String.fromCharCode(...picBytes.subarray(pOff, pOff + mimeLen));
          pOff += mimeLen;
          const descLen = picView.getUint32(pOff);
          pOff += 4 + descLen + 16; // skip desc + width, height, depth, colors
          const dataLen = picView.getUint32(pOff);
          pOff += 4;
          const imgData = picBytes.subarray(pOff, pOff + dataLen);
          const blob = new Blob([imgData], { type: mime || 'image/jpeg' });
          meta.coverUrl = URL.createObjectURL(blob);
        } catch {
          // ignore picture decode error
        }
      }
    }
  }

  return meta;
}

/**
 * Searches for Vorbis Comment in an OGG container or FLAC stream.
 * @param {DataView} view
 * @returns {Partial<AudioMetadata> | null}
 */
function parseOggOrFlac(view) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

  // Check FLAC: 'fLaC' marker
  if (view.byteLength >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    let offset = 4;
    /** @type {Partial<AudioMetadata>} */
    let meta = {};
    while (offset + 4 <= bytes.length) {
      const header = view.getUint8(offset);
      const isLast = (header & 0x80) !== 0;
      const blockType = header & 0x7f;
      const blockSize =
        (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
      offset += 4;
      if (offset + blockSize > bytes.length) break;

      if (blockType === 4) {
        // VORBIS_COMMENT
        meta = { ...meta, ...parseVorbisComment(bytes.subarray(offset, offset + blockSize)) };
      } else if (blockType === 6) {
        // PICTURE
        try {
          const picView = new DataView(bytes.buffer, bytes.byteOffset + offset, blockSize);
          let pOff = 4; // skip type
          const mimeLen = picView.getUint32(pOff);
          pOff += 4;
          const mime = String.fromCharCode(...bytes.subarray(offset + pOff, offset + pOff + mimeLen));
          pOff += mimeLen;
          const descLen = picView.getUint32(pOff);
          pOff += 4 + descLen + 16;
          const dataLen = picView.getUint32(pOff);
          pOff += 4;
          const imgData = bytes.subarray(offset + pOff, offset + pOff + dataLen);
          const blob = new Blob([imgData], { type: mime || 'image/jpeg' });
          meta.coverUrl = URL.createObjectURL(blob);
        } catch {
          // ignore
        }
      }

      if (isLast) break;
      offset += blockSize;
    }
    return meta;
  }

  // Check OGG: 'OggS'
  if (view.byteLength >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    // Scan for vorbis comment header: 0x03 + 'vorbis'
    for (let i = 0; i < Math.min(bytes.length - 7, 8192); i++) {
      if (
        bytes[i] === 0x03 &&
        bytes[i + 1] === 0x76 &&
        bytes[i + 2] === 0x6f &&
        bytes[i + 3] === 0x72 &&
        bytes[i + 4] === 0x62 &&
        bytes[i + 5] === 0x69 &&
        bytes[i + 6] === 0x73
      ) {
        return parseVorbisComment(bytes, i + 7);
      }
    }
  }

  return null;
}

/**
 * Parses MP4/M4A metadata atoms from an ISO Base Media container.
 * @param {DataView} view
 * @returns {Partial<AudioMetadata> | null}
 */
function parseMp4Atoms(view) {
  if (view.byteLength < 8) return null;
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

  // Check for 'ftyp' atom near start
  let isMp4 = false;
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    isMp4 = true;
  }
  if (!isMp4) return null;

  /** @type {Partial<AudioMetadata>} */
  const meta = {};

  // Recursive atom finder for 'ilst'
  function findAtom(start, end, targetName) {
    let off = start;
    while (off + 8 <= end) {
      let size = view.getUint32(off);
      const name = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
      if (size === 1 && off + 16 <= end) {
        // 64-bit size
        size = Number(view.getBigUint64(off + 8));
        off += 8;
      }
      if (size < 8) break;
      const atomEnd = Math.min(off + size, end);
      if (name === targetName) {
        return { start: off + 8, end: atomEnd };
      }
      // If container atom, search inside
      if (['moov', 'udta', 'meta'].includes(name)) {
        const skip = name === 'meta' ? 12 : 8; // meta atom often has 4 version/flags bytes
        const found = findAtom(off + skip, atomEnd, targetName);
        if (found) return found;
      }
      off = atomEnd;
    }
    return null;
  }

  const ilst = findAtom(0, bytes.length, 'ilst');
  if (!ilst) return null;

  let off = ilst.start;
  while (off + 8 <= ilst.end) {
    const size = view.getUint32(off);
    if (size < 8 || off + size > ilst.end) break;
    const name = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const dataAtom = findAtom(off + 8, off + size, 'data');
    if (dataAtom) {
      // Data atom: 4 bytes size, 4 bytes 'data', 1 byte version, 3 bytes type flags, 4 bytes locale
      const typeFlags = view.getUint32(dataAtom.start - 8 + 8) & 0xffffff;
      const content = bytes.subarray(dataAtom.start + 8, dataAtom.end);

      if (name === '©nam') {
        meta.title = decodeText(content, 'utf-8');
      } else if (name === '©ART') {
        meta.artist = decodeText(content, 'utf-8');
      } else if (name === '©alb') {
        meta.album = decodeText(content, 'utf-8');
      } else if (name === '©day') {
        meta.year = decodeText(content, 'utf-8').slice(0, 4);
      } else if (name === '©gen') {
        meta.genre = decodeText(content, 'utf-8');
      } else if (name === '©lyr') {
        meta.lyrics = decodeText(content, 'utf-8');
      } else if (name === 'trkn' && content.length >= 6) {
        const trackView = new DataView(content.buffer, content.byteOffset, content.byteLength);
        meta.track = trackView.getUint16(2);
        meta.trackTotal = trackView.getUint16(4);
      } else if (name === 'covr') {
        const mime = typeFlags === 14 ? 'image/png' : 'image/jpeg';
        const blob = new Blob([content], { type: mime });
        meta.coverUrl = URL.createObjectURL(blob);
      }
    }
    off += size;
  }

  return meta;
}

/**
 * Fallback to parse artist and title from file path or name.
 * e.g. "Artist - Song Title.mp3" -> { artist: "Artist", title: "Song Title" }
 * @param {string} filename
 * @returns {AudioMetadata}
 */
export function parseFromFilename(filename) {
  const base =
    filename
      .split('/')
      .pop()
      ?.replace(/\.[a-zA-Z0-9]+$/, '') || 'Untitled';
  const match = base.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (match) {
    return {
      title: match[2].trim(),
      artist: match[1].trim(),
      album: 'Unknown Album',
    };
  }
  return {
    title: base.trim(),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
  };
}

/**
 * Main entry point: extracts full metadata from an ArrayBuffer or File/Blob.
 * @param {ArrayBuffer | Blob | File} source
 * @param {string} [filename]
 * @returns {Promise<AudioMetadata>}
 */
export async function parseAudioMetadata(source, filename = '') {
  /** @type {ArrayBuffer} */
  let buffer;
  if (source instanceof ArrayBuffer) {
    buffer = source;
  } else if (source instanceof Blob) {
    buffer = await source.arrayBuffer();
    if (!filename && 'name' in source) {
      filename = /** @type {File} */ (source).name;
    }
  } else {
    return parseFromFilename(filename);
  }

  const view = new DataView(buffer);
  let parsed = parseID3v2(view);

  if (!parsed || (!parsed.title && !parsed.artist)) {
    const id3v1 = parseID3v1(view);
    if (id3v1) {
      parsed = { ...id3v1, ...parsed };
    }
  }

  if (!parsed || (!parsed.title && !parsed.artist)) {
    const oggFlac = parseOggOrFlac(view);
    if (oggFlac) {
      parsed = { ...oggFlac, ...parsed };
    }
  }

  if (!parsed || (!parsed.title && !parsed.artist)) {
    const mp4 = parseMp4Atoms(view);
    if (mp4) {
      parsed = { ...mp4, ...parsed };
    }
  }

  const fallback = parseFromFilename(filename);

  return {
    title: parsed?.title || fallback.title,
    artist: parsed?.artist || fallback.artist,
    album: parsed?.album || fallback.album,
    year: parsed?.year,
    track: parsed?.track,
    trackTotal: parsed?.trackTotal,
    genre: parsed?.genre,
    lyrics: parsed?.lyrics,
    coverUrl: parsed?.coverUrl,
    duration: parsed?.duration,
  };
}

/**
 * Parses synchronized .lrc lyrics format into timestamped lines.
 * e.g. [01:23.45] Some lyric text -> { time: 83.45, text: "Some lyric text" }
 * @param {string} lrcText
 * @returns {Array<{ time: number, text: string }>}
 */
export function parseLrcLyrics(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  /** @type {Array<{ time: number, text: string }>} */
  const result = [];
  const timeRegex = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let match;
    const timestamps = [];
    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const frac = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      timestamps.push(minutes * 60 + seconds + frac);
    }
    const text = trimmed.replace(timeRegex, '').trim();
    if (timestamps.length > 0 && text) {
      for (const time of timestamps) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}
