import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, decode, encode } from '../../src/services/storage/serialize.js';

const roundTrip = async (value) => decode(JSON.parse(JSON.stringify(await encode(value))));

describe('serialize', () => {
  it('round-trips plain JSON unchanged', async () => {
    const value = { a: 1, b: 'x', c: [true, null, { d: [] }] };
    expect(await encode(value)).toEqual(value);
    expect(await roundTrip(value)).toEqual(value);
  });

  it('round-trips special numbers, undefined and bigint', async () => {
    const out = await roundTrip({ nan: NaN, inf: Infinity, ninf: -Infinity, nz: -0, u: undefined, big: 2n ** 70n });
    expect(out.nan).toBeNaN();
    expect(out.inf).toBe(Infinity);
    expect(out.ninf).toBe(-Infinity);
    expect(Object.is(out.nz, -0)).toBe(true);
    expect('u' in out && out.u === undefined).toBe(true);
    expect(out.big).toBe(2n ** 70n);
  });

  it('round-trips Date, Blob, File, ArrayBuffer, typed arrays, Map and Set', async () => {
    const out = await roundTrip({
      date: new Date(123456),
      blob: new Blob([new Uint8Array([0, 1, 254])], { type: 'application/octet-stream' }),
      file: new File(['hi'], 'hi.txt', { type: 'text/plain', lastModified: 99 }),
      buffer: new Uint8Array([9, 8]).buffer,
      floats: new Float32Array([1.5, -2]),
      view: new DataView(new Uint8Array([7]).buffer),
      map: new Map([[1, { deep: new Date(5) }]]),
      set: new Set(['a', 'b']),
    });
    expect(out.date.getTime()).toBe(123456);
    expect([...new Uint8Array(await out.blob.arrayBuffer())]).toEqual([0, 1, 254]);
    expect(out.blob.type).toBe('application/octet-stream');
    expect(out.file).toBeInstanceOf(File);
    expect([out.file.name, out.file.type, out.file.lastModified, await out.file.text()]).toEqual([
      'hi.txt',
      'text/plain',
      99,
      'hi',
    ]);
    expect([...new Uint8Array(out.buffer)]).toEqual([9, 8]);
    expect(out.floats).toBeInstanceOf(Float32Array);
    expect([...out.floats]).toEqual([1.5, -2]);
    expect(out.view.getUint8(0)).toBe(7);
    expect(out.map.get(1).deep.getTime()).toBe(5);
    expect([...out.set]).toEqual(['a', 'b']);
  });

  it('does not confuse user objects that use the tag key', async () => {
    const value = { $nx: 'date', v: 1 };
    expect(await roundTrip(value)).toEqual(value);
  });

  it('base64 handles large binary data', () => {
    // Larger than one 32 KB conversion chunk.
    const bytes = new Uint8Array(80_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('stores binary payloads through external BinaryHooks including unaligned views', async () => {
    const store = new Map();
    let seq = 0;
    const put = (bytes) => {
      const ref = String(++seq);
      // Wrap inside a larger offset buffer to verify alignment-safe decoding.
      const padded = new Uint8Array(bytes.byteLength + 1);
      padded.set(bytes, 1);
      store.set(ref, padded.subarray(1));
      return ref;
    };
    const get = (ref) => store.get(ref);
    const encoded = await encode(
      {
        bytes: new Uint8Array([1, 2, 3]),
        floats: new Float32Array([1.5, -2.25]),
        buffer: new Uint8Array([9, 8]).buffer,
      },
      { put },
    );
    expect(store.size).toBe(3);
    const out = decode(JSON.parse(JSON.stringify(encoded)), { get });
    expect(out.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(out.floats).toBeInstanceOf(Float32Array);
    expect([...out.floats]).toEqual([1.5, -2.25]);
    expect([...new Uint8Array(out.buffer)]).toEqual([9, 8]);
  });
});
