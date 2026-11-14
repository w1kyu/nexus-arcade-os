// @ts-check
// File System Access API Sync Folder mirror (Chromium) with honest fallback on Firefox/Safari.
// Mirrors the user's VFS home directory with a chosen local folder and detects two-way conflicts.

const SYNC_STATE_FILE = '.nexus-sync-state.json';

/**
 * Checks whether File System Access API directory picking is available.
 * @param {any} [win]
 */
export function isSyncFolderSupported(win = globalThis.window) {
  return Boolean(win && typeof win.showDirectoryPicker === 'function');
}

/**
 * @param {any} rootDirHandle
 * @param {string} relPath
 * @param {boolean} [create]
 */
async function resolveFileHandle(rootDirHandle, relPath, create = false) {
  const parts = relPath.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error('Invalid relative path');
  let dir = rootDirHandle;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir.getFileHandle(name, { create });
}

/**
 * Recursively lists files in a FileSystemDirectoryHandle (skipping hidden .nexus-* sync metadata).
 * @param {any} dirHandle
 * @param {string} [prefix]
 * @returns {Promise<Map<string, { handle: any, lastModified: number, size: number }>>}
 */
export async function scanDirectoryHandle(dirHandle, prefix = '') {
  /** @type {Map<string, { handle: any, lastModified: number, size: number }>} */
  const out = new Map();
  for await (const [name, entry] of dirHandle.entries()) {
    if (name === SYNC_STATE_FILE || name === '.DS_Store') continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'directory') {
      const sub = await scanDirectoryHandle(entry, rel);
      for (const [k, v] of sub) out.set(k, v);
    } else if (entry.kind === 'file') {
      const file = await entry.getFile();
      out.set(rel, { handle: entry, lastModified: file.lastModified ?? 0, size: file.size ?? 0 });
    }
  }
  return out;
}

/** @param {any} dirHandle */
async function readSyncState(dirHandle) {
  try {
    const fh = await dirHandle.getFileHandle(SYNC_STATE_FILE);
    const file = await fh.getFile();
    const parsed = JSON.parse(await file.text());
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {any} dirHandle @param {Record<string, unknown>} state */
async function writeSyncState(dirHandle, state) {
  try {
    const fh = await dirHandle.getFileHandle(SYNC_STATE_FILE, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(state, null, 2));
    await w.close();
  } catch {
    // Ignore if folder became read-only
  }
}

/**
 * Creates a Sync Folder service mirroring `vfs.home` to a chosen local directory.
 * @param {object} deps
 * @param {import('../vfs/vfs.js').Vfs} deps.vfs
 * @param {() => Promise<any>} [deps.pickDirectory]
 */
export function createSyncFolder({ vfs, pickDirectory }) {
  /** @type {any} */
  let currentHandle = null;
  /** @type {{ at: number, folderName: string, pushed: number, pulled: number, conflicts: { path: string, vfsModified: number, diskModified: number }[] } | null} */
  let lastSummary = null;

  const pick =
    pickDirectory ??
    (async () => {
      if (!isSyncFolderSupported()) {
        throw new Error('File System Access API is not supported in this browser.');
      }
      return /** @type {any} */ (window).showDirectoryPicker({ mode: 'readwrite' });
    });

  return {
    get supported() {
      return isSyncFolderSupported() || typeof pickDirectory === 'function';
    },
    get connected() {
      return currentHandle !== null;
    },
    get folderName() {
      return currentHandle?.name ?? null;
    },
    get lastSummary() {
      return lastSummary;
    },

    async chooseFolder() {
      currentHandle = await pick();
      return { name: String(currentHandle?.name ?? 'Sync Folder') };
    },

    disconnect() {
      currentHandle = null;
      lastSummary = null;
    },

    /**
     * Synchronizes VFS `vfs.home` with the connected folder.
     * @param {{ conflictStrategy?: 'skip' | 'keep-local' | 'keep-remote' | 'newest', dirHandle?: any }} [options]
     */
    async sync({ conflictStrategy = 'skip', dirHandle } = {}) {
      const target = dirHandle ?? currentHandle;
      if (!target) throw new Error('No sync folder selected.');
      currentHandle = target;

      const base = vfs.home.endsWith('/') ? vfs.home : `${vfs.home}/`;
      const prevState = await readSyncState(target);
      const nextState = /** @type {Record<string, { vfsModified: number, diskModified: number, size: number }>} */ ({});

      const diskFiles = await scanDirectoryHandle(target);
      /** @type {Map<string, { path: string, modifiedAt: number, size: number }>} */
      const vfsFiles = new Map();
      const nodes = await vfs.walk(vfs.home);
      for (const n of nodes) {
        if (n.type !== 'file') continue;
        if (!n.path.startsWith(base)) continue;
        const rel = n.path.slice(base.length);
        if (!rel || rel.startsWith('.')) continue;
        vfsFiles.set(rel, { path: n.path, modifiedAt: n.modified ?? n.created ?? 0, size: n.size ?? 0 });
      }

      const allRel = new Set([...vfsFiles.keys(), ...diskFiles.keys()]);
      let pushed = 0;
      let pulled = 0;
      /** @type {{ path: string, vfsModified: number, diskModified: number }[]} */
      const conflicts = [];

      /** @param {string} rel @param {{ path: string, modifiedAt: number, size: number }} vf */
      async function pushFile(rel, vf) {
        const blob = /** @type {Blob} */ (await vfs.readFile(vf.path, { as: 'blob' }));
        const fh = await resolveFileHandle(target, rel, true);
        const w = await fh.createWritable();
        await w.write(await blob.arrayBuffer());
        await w.close();
        const fresh = await fh.getFile();
        nextState[rel] = {
          vfsModified: vf.modifiedAt,
          diskModified: fresh.lastModified ?? Date.now(),
          size: fresh.size ?? vf.size,
        };
        pushed++;
      }

      /** @param {string} rel @param {{ handle: any, lastModified: number, size: number }} df */
      async function pullFile(rel, df) {
        const file = await df.handle.getFile();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const targetPath = `${base}${rel}`;
        const parent = targetPath.slice(0, targetPath.lastIndexOf('/'));
        if (parent && !(await vfs.exists(parent))) await vfs.mkdir(parent, { recursive: true });
        await vfs.writeFile(targetPath, bytes);
        const st = await vfs.stat(targetPath);
        nextState[rel] = {
          vfsModified: st?.modified ?? Date.now(),
          diskModified: df.lastModified,
          size: bytes.byteLength,
        };
        pulled++;
      }

      for (const rel of allRel) {
        const vf = vfsFiles.get(rel);
        const df = diskFiles.get(rel);
        const prev = prevState[rel];

        if (vf && !df) {
          await pushFile(rel, vf);
          continue;
        }
        if (!vf && df) {
          await pullFile(rel, df);
          continue;
        }
        if (!vf || !df) continue;

        const vfsChanged = !prev || vf.modifiedAt !== prev.vfsModified || vf.size !== prev.size;
        const diskChanged = !prev || df.lastModified !== prev.diskModified || df.size !== prev.size;

        if (!vfsChanged && !diskChanged) {
          nextState[rel] = prev;
          continue;
        }
        if (vfsChanged && !diskChanged) {
          await pushFile(rel, vf);
          continue;
        }
        if (!vfsChanged && diskChanged) {
          await pullFile(rel, df);
          continue;
        }

        // Both sides changed (or initial sync with different files on both sides)
        if (vf.size === df.size && Math.abs(vf.modifiedAt - df.lastModified) < 2000) {
          nextState[rel] = { vfsModified: vf.modifiedAt, diskModified: df.lastModified, size: vf.size };
          continue;
        }

        if (conflictStrategy === 'keep-local' || (conflictStrategy === 'newest' && vf.modifiedAt >= df.lastModified)) {
          await pushFile(rel, vf);
        } else if (
          conflictStrategy === 'keep-remote' ||
          (conflictStrategy === 'newest' && df.lastModified > vf.modifiedAt)
        ) {
          await pullFile(rel, df);
        } else {
          conflicts.push({ path: `${base}${rel}`, vfsModified: vf.modifiedAt, diskModified: df.lastModified });
          if (prev) nextState[rel] = prev;
        }
      }

      await writeSyncState(target, nextState);
      lastSummary = {
        at: Date.now(),
        folderName: String(target.name ?? 'Sync Folder'),
        pushed,
        pulled,
        conflicts,
      };
      return lastSummary;
    },
  };
}
