// @ts-check
/**
 * Zero-dependency JPEG EXIF parser and stripper.
 * Reads TIFF IFD0, Exif SubIFD, and GPS IFD (converts DMS rational numbers to decimal lat/lon).
 */

/**
 * @typedef {object} ExifData
 * @property {string} [make]
 * @property {string} [model]
 * @property {string} [lensModel]
 * @property {string} [software]
 * @property {string} [dateTime]
 * @property {string} [exposureTime]
 * @property {number} [fNumber]
 * @property {number} [iso]
 * @property {number} [focalLength]
 * @property {number} [orientation]
 * @property {number} [latitude] - Decimal degrees
 * @property {number} [longitude] - Decimal degrees
 * @property {number} [altitude]
 */

/**
 * Parses EXIF metadata from a JPEG ArrayBuffer or Blob.
 * @param {ArrayBuffer} buffer
 * @returns {ExifData | null}
 */
export function parseExif(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return null;

  // Check SOI marker 0xFFD8
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  let app1Offset = -1;

  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (marker === 0xffe1) {
      // APP1 marker
      app1Offset = offset;
      break;
    } else if ((marker & 0xff00) === 0xff00 && marker !== 0xff00 && marker !== 0xffd8 && marker !== 0xffd9) {
      // Skip other variable markers (APP0, APP2, SOF, DQT, etc.)
      const length = view.getUint16(offset);
      offset += length;
    } else {
      break;
    }
  }

  if (app1Offset === -1) return null;
  const tiffStart = app1Offset + 2 + 6; // skip length (2 bytes) + 'Exif\0\0' (6 bytes)

  // Verify 'Exif\0\0' header
  const exifHeader = String.fromCharCode(
    view.getUint8(app1Offset + 2),
    view.getUint8(app1Offset + 3),
    view.getUint8(app1Offset + 4),
    view.getUint8(app1Offset + 5),
  );
  if (exifHeader !== 'Exif') return null;

  // Read TIFF header
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949; // 'II' = Intel, 'MM' = Motorola
  if (!littleEndian && byteOrder !== 0x4d4d) return null;

  // Verify 42
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return null;

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  if (firstIfdOffset < 8) return null;

  /** @type {ExifData} */
  const result = {};

  function readTagValue(tagOffset) {
    const type = view.getUint16(tagOffset + 2, littleEndian);
    const count = view.getUint32(tagOffset + 4, littleEndian);

    const getValueOffset = () => {
      // If data fits in 4 bytes, it's stored directly at offset 8, else pointer
      if (type === 1 || type === 2 || type === 7) {
        return count <= 4 ? tagOffset + 8 : tiffStart + view.getUint32(tagOffset + 8, littleEndian);
      }
      if (type === 3) {
        return count <= 2 ? tagOffset + 8 : tiffStart + view.getUint32(tagOffset + 8, littleEndian);
      }
      return tiffStart + view.getUint32(tagOffset + 8, littleEndian);
    };

    const valOffset = getValueOffset();
    if (valOffset >= buffer.byteLength) return null;

    if (type === 2) {
      // ASCII string
      let str = '';
      for (let i = 0; i < count - 1; i++) {
        const c = view.getUint8(valOffset + i);
        if (c === 0) break;
        str += String.fromCharCode(c);
      }
      return str.trim();
    }
    if (type === 3) {
      // SHORT (16-bit)
      return view.getUint16(valOffset, littleEndian);
    }
    if (type === 4) {
      // LONG (32-bit)
      return view.getUint32(valOffset, littleEndian);
    }
    if (type === 5) {
      // RATIONAL (two 32-bit uints: num / denom)
      const num = view.getUint32(valOffset, littleEndian);
      const den = view.getUint32(valOffset + 4, littleEndian);
      return den ? num / den : 0;
    }
    return null;
  }

  function readIfd(ifdOffset) {
    if (tiffStart + ifdOffset + 2 > buffer.byteLength) return {};
    const numEntries = view.getUint16(tiffStart + ifdOffset, littleEndian);
    const tags = {};
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > buffer.byteLength) break;
      const tag = view.getUint16(entryOffset, littleEndian);
      tags[tag] = readTagValue(entryOffset);
    }
    return tags;
  }

  // Read IFD0
  const ifd0 = readIfd(firstIfdOffset);
  if (ifd0[0x010f]) result.make = String(ifd0[0x010f]);
  if (ifd0[0x0110]) result.model = String(ifd0[0x0110]);
  if (ifd0[0x0112]) result.orientation = Number(ifd0[0x0112]);
  if (ifd0[0x0131]) result.software = String(ifd0[0x0131]);
  if (ifd0[0x0132]) result.dateTime = String(ifd0[0x0132]);

  // Read Exif SubIFD (tag 0x8769)
  const exifSubIfdPointer = ifd0[0x8769];
  if (exifSubIfdPointer && typeof exifSubIfdPointer === 'number') {
    const exifIfd = readIfd(exifSubIfdPointer);
    if (exifIfd[0x829a]) {
      // Exposure time
      const exp = exifIfd[0x829a];
      result.exposureTime = exp < 1 && exp > 0 ? `1/${Math.round(1 / exp)}s` : `${exp}s`;
    }
    if (exifIfd[0x829d]) result.fNumber = Math.round(Number(exifIfd[0x829d]) * 10) / 10;
    if (exifIfd[0x8827]) result.iso = Number(exifIfd[0x8827]);
    if (exifIfd[0x9003]) result.dateTime = String(exifIfd[0x9003]);
    if (exifIfd[0x920a]) result.focalLength = Math.round(Number(exifIfd[0x920a]));
    if (exifIfd[0xa434]) result.lensModel = String(exifIfd[0xa434]);
  }

  // Read GPS IFD (tag 0x8825)
  const gpsIfdPointer = ifd0[0x8825];
  if (gpsIfdPointer && typeof gpsIfdPointer === 'number') {
    if (tiffStart + gpsIfdPointer + 2 <= buffer.byteLength) {
      const numGps = view.getUint16(tiffStart + gpsIfdPointer, littleEndian);
      const gpsTags = {};
      for (let i = 0; i < numGps; i++) {
        const entryOffset = tiffStart + gpsIfdPointer + 2 + i * 12;
        if (entryOffset + 12 > buffer.byteLength) break;
        const tag = view.getUint16(entryOffset, littleEndian);
        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);

        if (tag === 0x0001 || tag === 0x0003) {
          // LatitudeRef ('N'/'S') or LongitudeRef ('E'/'W')
          gpsTags[tag] = String.fromCharCode(view.getUint8(entryOffset + 8));
        } else if (type === 5 && count === 3) {
          // Rational DMS
          const valOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
          if (valOffset + 24 <= buffer.byteLength) {
            const d = view.getUint32(valOffset, littleEndian) / (view.getUint32(valOffset + 4, littleEndian) || 1);
            const m = view.getUint32(valOffset + 8, littleEndian) / (view.getUint32(valOffset + 12, littleEndian) || 1);
            const s =
              view.getUint32(valOffset + 16, littleEndian) / (view.getUint32(valOffset + 20, littleEndian) || 1);
            gpsTags[tag] = d + m / 60 + s / 3600;
          }
        }
      }

      if (gpsTags[0x0002]) {
        let lat = Number(gpsTags[0x0002]);
        if (gpsTags[0x0001] === 'S') lat = -lat;
        result.latitude = Math.round(lat * 1000000) / 1000000;
      }
      if (gpsTags[0x0004]) {
        let lon = Number(gpsTags[0x0004]);
        if (gpsTags[0x0003] === 'W') lon = -lon;
        result.longitude = Math.round(lon * 1000000) / 1000000;
      }
    }
  }

  return result;
}

/**
 * Strips EXIF APP1 segment from a JPEG ArrayBuffer for privacy on export.
 * @param {ArrayBuffer} buffer
 * @returns {ArrayBuffer}
 */
export function stripExif(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return buffer;

  const chunks = [new Uint8Array(buffer, 0, 2)]; // 0xFFD8 SOI
  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if (marker === 0xffda) {
      // Start of Scan (SOS): image data starts, keep remainder
      chunks.push(new Uint8Array(buffer, offset));
      break;
    }
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1) {
      // Skip APP1 EXIF segment!
      offset += 2 + length;
    } else {
      chunks.push(new Uint8Array(buffer, offset, 2 + length));
      offset += 2 + length;
    }
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const clean = new Uint8Array(totalLen);
  let cur = 0;
  for (const c of chunks) {
    clean.set(c, cur);
    cur += c.length;
  }
  return clean.buffer;
}
