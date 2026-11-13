// @ts-check
// RAG (Retrieval-Augmented Generation) knowledge service: chunking, embedding, vector store, and search.

/**
 * @typedef {object} RagChunk
 * @property {string} id
 * @property {string} docPath
 * @property {string} title
 * @property {number} chunkIndex
 * @property {string} text
 * @property {number[]} vector
 * @property {number} updatedAt
 */

/**
 * Splits text into overlapping chunks.
 * @param {string} text
 * @param {number} [chunkSize] default 400 characters
 * @param {number} [overlap] default 80 characters
 * @returns {string[]}
 */
export function chunkText(text, chunkSize = 400, overlap = 80) {
  if (!text) return [];
  const clean = text.trim();
  if (clean.length <= chunkSize) return [clean];

  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) {
    const chunks = [];
    let start = 0;
    while (start < clean.length) {
      const end = start + chunkSize;
      const chunk = clean.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
      if (end >= clean.length) break;
      start = Math.max(start + 1, end - overlap);
    }
    return chunks;
  }

  const chunks = [];
  let current = '';
  for (const para of paragraphs) {
    if (!current) {
      current = para;
    } else if (current.length + para.length + 2 <= chunkSize) {
      current += `\n\n${para}`;
    } else {
      chunks.push(current);
      current = para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Computes cosine similarity between two numeric vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} 0.0 to 1.0 (or -1.0 to 1.0)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * @param {object} options
 * @param {{ get(key: string): Promise<unknown>, set(key: string, value: unknown): Promise<void> }} options.store
 * @param {() => any} options.getEmbedder  returns active provider with .embed()
 */
export function createRagService({ store, getEmbedder }) {
  /** @type {RagChunk[]} */
  let chunks = [];
  let isLoaded = false;
  let lastIndexedAt = 0;

  async function load() {
    if (isLoaded) return;
    const saved = /** @type {{ chunks?: RagChunk[], lastIndexedAt?: number } | undefined} */ (
      await store.get('rag_store')
    );
    if (saved && Array.isArray(saved.chunks)) {
      chunks = saved.chunks;
      lastIndexedAt = saved.lastIndexedAt || 0;
    }
    isLoaded = true;
  }

  async function save() {
    await store.set('rag_store', { chunks, lastIndexedAt });
  }

  return {
    async getStatus() {
      await load();
      return {
        chunkCount: chunks.length,
        documentCount: new Set(chunks.map((c) => c.docPath)).size,
        lastIndexedAt,
      };
    },

    async clearIndex() {
      chunks = [];
      lastIndexedAt = 0;
      await save();
    },

    /**
     * Indexes a folder from VFS (e.g. `/Notes`).
     * @param {any} fs
     * @param {string} [folderPath]
     * @param {object} [options]
     * @param {string} [options.embeddingModel]
     * @param {(status: { current: number, total: number, file: string }) => void} [options.onProgress]
     */
    async indexFolder(fs, folderPath = '/Notes', options = {}) {
      await load();
      const embedder = getEmbedder();
      if (!embedder || typeof embedder.embed !== 'function') {
        throw new Error(
          'Active AI provider does not support embeddings. Please configure Ollama or an OpenAI-compatible endpoint with an embedding model.',
        );
      }

      if (!fs || !(await fs.exists(folderPath))) {
        throw new Error(`Folder "${folderPath}" does not exist in VFS.`);
      }

      const nodes = /** @type {any[]} */ (await fs.walk(folderPath));
      const files = nodes.filter((n) => n.type === 'file' && (n.name.endsWith('.md') || n.name.endsWith('.txt')));

      if (files.length === 0) {
        return { indexedDocs: 0, indexedChunks: 0 };
      }

      // Remove previous chunks for this folder
      chunks = chunks.filter((c) => !c.docPath.startsWith(folderPath));

      /** @type {Array<{ docPath: string, title: string, text: string, chunkIndex: number }>} */
      const itemsToEmbed = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        options.onProgress?.({ current: i + 1, total: files.length, file: file.name });
        const content = /** @type {string} */ (await fs.readFile(file.path, { as: 'text' }));
        const textChunks = chunkText(content);
        const title = file.name.replace(/\.[^/.]+$/, '');

        textChunks.forEach((text, chunkIndex) => {
          itemsToEmbed.push({
            docPath: file.path,
            title,
            text,
            chunkIndex,
          });
        });
      }

      if (itemsToEmbed.length > 0) {
        // Embed in batches of 16
        const batchSize = 16;
        for (let i = 0; i < itemsToEmbed.length; i += batchSize) {
          const slice = itemsToEmbed.slice(i, i + batchSize);
          const vectors = await embedder.embed(
            slice.map((s) => s.text),
            { model: options.embeddingModel },
          );

          for (let j = 0; j < slice.length; j++) {
            const item = slice[j];
            const vector = vectors[j] || [];
            chunks.push({
              id: `${item.docPath}#${item.chunkIndex}`,
              docPath: item.docPath,
              title: item.title,
              chunkIndex: item.chunkIndex,
              text: item.text,
              vector,
              updatedAt: Date.now(),
            });
          }
        }
      }

      lastIndexedAt = Date.now();
      await save();

      return {
        indexedDocs: files.length,
        indexedChunks: itemsToEmbed.length,
      };
    },

    /**
     * Searches indexed notes using cosine similarity.
     * @param {string} query
     * @param {object} [options]
     * @param {number} [options.topK] default 4
     * @param {number} [options.minScore] default 0.35
     * @param {string} [options.embeddingModel]
     * @returns {Promise<Array<{ chunk: RagChunk, score: number }>>}
     */
    async search(query, options = {}) {
      await load();
      if (chunks.length === 0) return [];

      const embedder = getEmbedder();
      if (!embedder || typeof embedder.embed !== 'function') {
        // Keyword fallback search if provider cannot embed
        const q = query.toLowerCase();
        const matches = chunks
          .filter((c) => c.text.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
          .slice(0, options.topK || 4)
          .map((c) => ({ chunk: c, score: 0.8 }));
        return matches;
      }

      const [queryVector] = await embedder.embed([query], { model: options.embeddingModel });
      if (!queryVector || queryVector.length === 0) return [];

      const topK = options.topK || 4;
      const minScore = options.minScore !== undefined ? options.minScore : 0.35;

      const scored = chunks
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(queryVector, chunk.vector),
        }))
        .filter((item) => item.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return scored;
    },
  };
}
