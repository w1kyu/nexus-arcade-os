import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../src/kernel/bus.js';
import { createBackup } from '../../src/services/backup/backup.js';
import { JOBS_STORE_SCHEMA } from '../../src/services/scheduler/scheduler.js';
import { SETTINGS_STORE_SCHEMA } from '../../src/services/settings/settings.js';
import { appStoreSchema, createAppStorage } from '../../src/services/storage/app-storage.js';
import { KV_STORE_SCHEMA } from '../../src/services/storage/collections.js';
import { createIdbEngine } from '../../src/services/storage/engine-idb.js';
import { META_STORE_SCHEMA } from '../../src/services/storage/migrations.js';
import { QUARANTINE_STORE_SCHEMA } from '../../src/services/storage/quarantine.js';
import { createVfs, VFS_STORE_SCHEMA } from '../../src/services/vfs/vfs.js';

const notesManifest = {
  id: 'nexus.notes',
  storage: { version: 1, collections: { notes: {} } },
};
const schema = {
  ...META_STORE_SCHEMA,
  ...KV_STORE_SCHEMA,
  ...QUARANTINE_STORE_SCHEMA,
  ...SETTINGS_STORE_SCHEMA,
  ...VFS_STORE_SCHEMA,
  ...JOBS_STORE_SCHEMA,
  ...appStoreSchema(notesManifest),
};

async function makeProfile(engine, name) {
  const db = await engine.open(name, schema);
  const bus = createEventBus();
  const vfs = createVfs({ db, bus, user: 'ada' });
  await vfs.init();
  const storage = createAppStorage({ db, bus, manifest: notesManifest });
  const backup = createBackup({
    db,
    profile: () => ({ name: 'Ada', username: 'ada', accent: '#3ef0ff' }),
    nexusVersion: '1.0.0',
  });
  return { db, vfs, storage, backup };
}

describe('backup merge conflict detection & resolution', () => {
  it('inspectMerge identifies VFS path conflicts and record conflicts before restore', async () => {
    const engine = createIdbEngine();
    const src = await makeProfile(engine, 'src-db');
    await src.vfs.writeFile('/home/ada/Documents/shared.md', 'incoming version');
    await src.vfs.writeFile('/home/ada/Documents/only-src.md', 'new file');
    await src.storage.collection('notes').put({ id: 'n1', title: 'Incoming' });
    const { blob } = await src.backup.export();

    const dst = await makeProfile(engine, 'dst-db');
    await dst.vfs.writeFile('/home/ada/Documents/shared.md', 'local version');
    await dst.storage.collection('notes').put({ id: 'n1', title: 'Local' });

    const report = await dst.backup.inspectMerge(blob);
    expect(report.totalConflicts).toBeGreaterThan(0);
    expect(report.vfsConflicts.some((c) => c.path === '/home/ada/Documents/shared.md')).toBe(true);
    expect(report.recordConflicts).toBeGreaterThan(0);

    // Merge keeping existing
    await dst.backup.restore(blob, { mode: 'merge', conflictStrategy: 'keep' });
    expect(await dst.vfs.readText('/home/ada/Documents/shared.md')).toBe('local version');
    expect(await dst.vfs.readText('/home/ada/Documents/only-src.md')).toBe('new file');
    expect((await dst.storage.collection('notes').get('n1'))?.title).toBe('Local');

    // Merge overwriting conflicts
    await dst.backup.restore(blob, { mode: 'merge', conflictStrategy: 'overwrite' });
    expect(await dst.vfs.readText('/home/ada/Documents/shared.md')).toBe('incoming version');
    expect((await dst.storage.collection('notes').get('n1'))?.title).toBe('Incoming');
  });
});
