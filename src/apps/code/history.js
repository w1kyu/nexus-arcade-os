// @ts-check
// Local history snapshot management for Nexus Code.

const MAX_SNAPSHOTS = 25;

/**
 * @typedef {object} FileSnapshot
 * @property {string} path
 * @property {string} content
 */

/**
 * @typedef {object} ProjectSnapshot
 * @property {string} id
 * @property {number} timestamp
 * @property {string} projectPath
 * @property {FileSnapshot[]} files
 */

/**
 * Takes a snapshot of open project files.
 * @param {any} storage
 * @param {string} projectPath
 * @param {FileSnapshot[]} files
 * @returns {Promise<ProjectSnapshot>}
 */
export async function takeSnapshot(storage, projectPath, files) {
  const key = `code_history_${encodeURIComponent(projectPath)}`;
  /** @type {ProjectSnapshot[]} */
  const history = (await storage.kv.get(key)) || [];

  const snapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    projectPath,
    files: files.map((f) => ({ path: f.path, content: f.content })),
  };

  history.unshift(snapshot);
  if (history.length > MAX_SNAPSHOTS) {
    history.length = MAX_SNAPSHOTS;
  }

  await storage.kv.set(key, history);
  return snapshot;
}

/**
 * Loads project snapshots.
 * @param {any} storage
 * @param {string} projectPath
 * @returns {Promise<ProjectSnapshot[]>}
 */
export async function loadSnapshots(storage, projectPath) {
  const key = `code_history_${encodeURIComponent(projectPath)}`;
  return (await storage.kv.get(key)) || [];
}
