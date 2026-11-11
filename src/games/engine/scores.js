// @ts-check
// High scores leaderboard, statistics, and achievement integration services

/**
 * @typedef {object} HighScoreEntry
 * @property {number} score
 * @property {string} name
 * @property {number} timestamp
 * @property {string} [mode]
 * @property {Record<string, any>} [details]
 */

export class GameScoreService {
  /**
   * @param {string} appId e.g. 'nexus.snake'
   * @param {import('../../kernel/types').AppContext} [ctx]
   */
  constructor(appId, ctx) {
    this.appId = appId;
    this.ctx = ctx;
  }

  /**
   * Returns storage key for mode
   * @param {string} [mode]
   */
  _key(mode = 'classic') {
    return `highscores_${mode}`;
  }

  /**
   * Gets top 10 scores for a given mode
   * @param {string} [mode]
   * @returns {Promise<HighScoreEntry[]>}
   */
  async getLeaderboard(mode = 'classic') {
    const key = this._key(mode);
    let scores = null;
    if (this.ctx?.storage?.kv) {
      scores = await this.ctx.storage.kv.get(key);
    } else if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(`${this.appId}:${key}`);
        scores = item ? JSON.parse(item) : null;
      } catch {
        scores = null;
      }
    }
    return Array.isArray(scores) ? scores : [];
  }

  /**
   * Adds a new score entry, keeps top 10 sorted descending.
   * Returns { rank: number, isNewHigh: boolean } (rank is 1-indexed, or 0 if not in top 10).
   * @param {number} score
   * @param {string} [mode]
   * @param {object} [options]
   * @param {string} [options.name]
   * @param {Record<string, any>} [options.details]
   */
  async submitScore(score, mode = 'classic', { name = 'Player', details } = {}) {
    const list = await this.getLeaderboard(mode);
    const prevBest = list.length > 0 ? list[0].score : 0;
    const isNewHigh = score > prevBest;

    const entry = {
      score,
      name,
      timestamp: Date.now(),
      mode,
      details,
    };

    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const top10 = list.slice(0, 10);
    const rank = top10.indexOf(entry) + 1;

    const key = this._key(mode);
    if (this.ctx?.storage?.kv) {
      await this.ctx.storage.kv.set(key, top10);
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`${this.appId}:${key}`, JSON.stringify(top10));
      } catch {
        // Ignore quota
      }
    }

    // Award XP based on score (capped at 50 XP per run)
    if (this.ctx?.achievements?.award) {
      const xpEarned = Math.min(50, Math.max(5, Math.floor(score / 50)));
      await this.ctx.achievements.award(xpEarned);
    }

    // Update games played and best score stats
    if (this.ctx?.achievements?.stat) {
      await this.ctx.achievements.stat('gamesPlayed', 1);
      if (isNewHigh) {
        await this.ctx.achievements.stat('bestScore', score);
      }
    }

    return { rank, isNewHigh, top10 };
  }

  /**
   * Records session time
   * @param {number} seconds
   */
  async recordTime(seconds) {
    if (this.ctx?.achievements?.stat) {
      await this.ctx.achievements.stat('totalPlaySeconds', Math.floor(seconds));
    }
  }

  /**
   * Unlocks an achievement
   * @param {string} id
   */
  async unlockAchievement(id) {
    if (this.ctx?.achievements?.unlock) {
      await this.ctx.achievements.unlock(id);
    }
  }

  /**
   * Updates progress on an achievement
   * @param {string} id
   * @param {number} value
   */
  async progressAchievement(id, value) {
    if (this.ctx?.achievements?.progress) {
      await this.ctx.achievements.progress(id, value);
    }
  }
}
