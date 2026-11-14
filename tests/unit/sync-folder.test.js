import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../src/kernel/bus.js';
import { createSyncFolder, isSyncFolderSupported, scanDirectoryHandle } from '../../src/services/backup/sync-folder.js';
import { createIdbEngine } from '../../src/services/storage/engine-idb.js';
import { META_STORE_SCHEMA } from '../../src/services/storage/migrations.js';
import { createVfs, VFS_STORE_SCHEMA } from '../../src/services/vfs/vfs.js';

function makeMockDir(name = 'SyncMirror') {
  const entriesMap = new Map();

  function makeFileEntry(fileName, content, lastModified = 1000) {
    let data = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
    let mtime = lastModified;
    return {
      kind: 'file',
      name: fileName,
      setData(bytes, newMtime = Date.now()) {
        data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
        mtime = newMtime;
      },
      async getFile() {
        const snapshot = data;
        return {
          name: fileName,
          size: snapshot.byteLength,
          lastModified: mtime,
          async arrayBuffer() {
            return snapshot.buffer.slice(snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength);
          },
          async text() {
            return new TextDecoder().decode(snapshot);
          },
        };
      },
      async createWritable() {
        const chunks = [];
        return {
          async write(chunk) {
            chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
          },
          async close() {
            const total = chunks.reduce((s, c) => s + c.byteLength, 0);
            const merged = new Uint8Array(total);
            let off = 0;
            for (const c of chunks) {
              merged.set(c, off);
              off += c.byteLength;
            }
            data = merged;
            mtime = Math.max(mtime + 1, Date.now());
          },
        };
      },
    };
  }

  function makeDirEntry(dirName) {
    const children = dirName === name ? entriesMap : new Map();
    return {
      kind: 'directory',
      name: dirName,
      children,
      async *entries() {
        for (const [k, v] of children.entries()) {
          yield [k, v];
        }
      },
      async getDirectoryHandle(subName, { create = false } = {}) {
        const existing = children.get(subName);
        if (existing) {
          if (existing.kind !== 'directory') throw new Error('Not a directory');
          return existing;
        }
        if (!create) throw new Error(`Missing directory ${subName}`);
        const sub = makeDirEntry(subName);
        children.set(subName, sub);
        return sub;
      },
      async getFileHandle(fileName, { create = false } = {}) {
        const existing = children.get(fileName);
        if (existing) {
          if (existing.kind !== 'file') throw new Error('Not a file');
          return existing;
        }
        if (!create) throw new Error(`Missing file ${fileName}`);
        const fh = makeFileEntry(fileName, new Uint8Array(0), 1000);
        children.set(fileName, fh);
        return fh;
      },
      _putFile(fileName, content, mtime) {
        const fh = makeFileEntry(fileName, content, mtime);
        children.set(fileName, fh);
        return fh;
      },
    };
  }

  return makeDirEntry(name);
}

async function setupVfs(name) {
  const engine = createIdbEngine();
  const db = await engine.open(name, { ...META_STORE_SCHEMA, ...VFS_STORE_SCHEMA });
  const bus = createEventBus();
  const vfs = createVfs({ db, bus, user: 'ada' });
  await vfs.init();
  return vfs;
}

describe('sync-folder service', () => {
  it('detects browser support honestly', () => {
    expect(isSyncFolderSupported({})).toBe(false);
    expect(isSyncFolderSupported({ showDirectoryPicker: () => {} })).toBe(true);
  });

  it('pushes VFS files, pulls disk files, and skips hidden sync metadata', async () => {
    const vfs = await setupVfs('sync-push-pull');
    await vfs.writeFile('/home/ada/Documents/note.md', 'hello from vfs');

    const rootDir = makeMockDir('NexusMirror');
    const docsDir = await rootDir.getDirectoryHandle('Documents', { create: true });
    docsDir._putFile('from-disk.txt', 'hello from disk', 5000);
    rootDir._putFile('.DS_Store', 'junk', 100);

    const syncer = createSyncFolder({
      vfs,
      pickDirectory: async () => rootDir,
    });
    expect(syncer.supported).toBe(true);
    await syncer.chooseFolder();
    expect(syncer.connected).toBe(true);
    expect(syncer.folderName).toBe('NexusMirror');

    const summary = await syncer.sync();
    expect(summary.pushed).toBeGreaterThanOrEqual(1);
    expect(summary.pulled).toBe(1);
    expect(summary.conflicts).toEqual([]);

    expect(await vfs.readText('/home/ada/Documents/from-disk.txt')).toBe('hello from disk');
    const mirroredFh = await docsDir.getFileHandle('note.md');
    expect(await (await mirroredFh.getFile()).text()).toBe('hello from vfs');

    const scanned = await scanDirectoryHandle(rootDir);
    expect(scanned.has('.nexus-sync-state.json')).toBe(false);
    expect(scanned.has('.DS_Store')).toBe(false);
    expect(scanned.has('Documents/note.md')).toBe(true);

    // Second sync without changes is a no-op
    const second = await syncer.sync();
    expect(second.pushed).toBe(0);
    expect(second.pulled).toBe(0);
    expect(second.conflicts).toEqual([]);

    syncer.disconnect();
    expect(syncer.connected).toBe(false);
    expect(syncer.folderName).toBe(null);
  });

  it('detects two-way conflicts and resolves with skip, keep-local, keep-remote, and newest', async () => {
    const vfs = await setupVfs('sync-conflicts');
    await vfs.writeFile('/home/ada/Documents/clash.txt', 'v1');
    const rootDir = makeMockDir('ConflictMirror');

    const syncer = createSyncFolder({ vfs, pickDirectory: async () => rootDir });
    await syncer.chooseFolder();
    await syncer.sync();

    // Modify both sides with divergent timestamps & sizes
    await new Promise((r) => setTimeout(r, 15));
    await vfs.writeFile('/home/ada/Documents/clash.txt', 'local-longer-content');
    const docsDir = await rootDir.getDirectoryHandle('Documents');
    const fh = await docsDir.getFileHandle('clash.txt');
    fh.setData('remote-diff', 100); // older remote mtime than local Date.now()

    const skipRes = await syncer.sync({ conflictStrategy: 'skip' });
    expect(skipRes.conflicts).toHaveLength(1);
    expect(skipRes.conflicts[0].path).toBe('/home/ada/Documents/clash.txt');

    // Newest prefers VFS because local mtime > 100
    const newestRes = await syncer.sync({ conflictStrategy: 'newest' });
    expect(newestRes.pushed).toBe(1);
    expect(await (await fh.getFile()).text()).toBe('local-longer-content');

    // Diverge again and test keep-remote
    await vfs.writeFile('/home/ada/Documents/clash.txt', 'local-override');
    fh.setData('remote-wins', Date.now() + 5000);
    const keepRemoteRes = await syncer.sync({ conflictStrategy: 'keep-remote' });
    expect(keepRemoteRes.pulled).toBe(1);
    expect(await vfs.readText('/home/ada/Documents/clash.txt')).toBe('remote-wins');

    // Diverge again and test keep-local
    await vfs.writeFile('/home/ada/Documents/clash.txt', 'local-wins');
    fh.setData('remote-loses', Date.now() + 10000);
    const keepLocalRes = await syncer.sync({ conflictStrategy: 'keep-local' });
    expect(keepLocalRes.pushed).toBe(1);
    expect(await (await fh.getFile()).text()).toBe('local-wins');
  });
});
