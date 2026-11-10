// @ts-check
// Free Spaced Repetition Scheduler (FSRS) implementation.
// Ratings: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy.
// States: 'new' (0), 'learning' (1), 'review' (2), 'relearning' (3).

/**
 * @typedef {'new' | 'learning' | 'review' | 'relearning'} CardState
 */

/**
 * @typedef {1 | 2 | 3 | 4} Rating
 */

/**
 * @typedef {object} FSRSCardData
 * @property {number} stability     days of stability S
 * @property {number} difficulty    difficulty D (1..10)
 * @property {number} reps          total review count
 * @property {number} lapses        total forgotten count
 * @property {CardState} state
 * @property {number} lastReviewed  timestamp in ms
 * @property {number} due           timestamp in ms
 */

export const FSRS_DEFAULT = {
  requestRetention: 0.9,
  learningSteps: [1, 10], // in minutes (1m, 10m)
};

/**
 * Calculates retrievability R given elapsed days and stability S.
 * @param {number} elapsedDays
 * @param {number} stability
 * @returns {number} 0.0 .. 1.0
 */
export function calculateRetrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * Calculates next review interval in days for a target retention rate.
 * @param {number} stability
 * @param {number} [requestRetention]
 * @returns {number} interval in days (minimum 1 day for review cards)
 */
export function nextIntervalDays(stability, requestRetention = 0.9) {
  const ivl = 9 * stability * (1 / requestRetention - 1);
  return Math.max(1, Math.round(ivl));
}

/**
 * Creates initial FSRS card data for a new card.
 * @returns {FSRSCardData}
 */
export function createNewCardFSRS() {
  return {
    stability: 0,
    difficulty: 5.0,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReviewed: 0,
    due: Date.now(),
  };
}

/**
 * Schedules the card according to FSRS rules given a user rating (1..4).
 * @param {FSRSCardData} card
 * @param {Rating} rating
 * @param {number} [now]
 * @returns {FSRSCardData} updated card
 */
export function scheduleCard(card, rating, now = Date.now()) {
  const updated = { ...card, reps: card.reps + 1, lastReviewed: now };

  // 1. Initial review of a new card
  if (card.state === 'new') {
    const initStabilities = { 1: 0.4, 2: 0.6, 3: 2.4, 4: 5.8 };
    const initDifficulties = { 1: 7.2, 2: 6.0, 3: 5.0, 4: 3.5 };

    updated.stability = initStabilities[rating];
    updated.difficulty = initDifficulties[rating];

    if (rating === 1) {
      updated.state = 'learning';
      updated.due = now + FSRS_DEFAULT.learningSteps[0] * 60 * 1000;
    } else if (rating === 2) {
      updated.state = 'learning';
      updated.due = now + FSRS_DEFAULT.learningSteps[1] * 60 * 1000;
    } else {
      updated.state = 'review';
      const days = nextIntervalDays(updated.stability);
      updated.due = now + days * 24 * 60 * 60 * 1000;
    }
    return updated;
  }

  // 2. Learning / Relearning state
  if (card.state === 'learning' || card.state === 'relearning') {
    if (rating === 1) {
      updated.due = now + FSRS_DEFAULT.learningSteps[0] * 60 * 1000;
      return updated;
    }
    if (rating === 2) {
      updated.due = now + FSRS_DEFAULT.learningSteps[1] * 60 * 1000;
      return updated;
    }
    // Good or Easy graduates to Review
    updated.state = 'review';
    const bonus = rating === 4 ? 1.5 : 1.0;
    updated.stability = Math.max(1.0, card.stability * bonus);
    const days = nextIntervalDays(updated.stability);
    updated.due = now + days * 24 * 60 * 60 * 1000;
    return updated;
  }

  // 3. Review state
  const elapsedDays = Math.max(0, (now - card.lastReviewed) / (24 * 60 * 60 * 1000));
  const R = calculateRetrievability(elapsedDays, card.stability);

  if (rating === 1) {
    // Lapse
    updated.lapses = card.lapses + 1;
    updated.state = 'relearning';
    updated.difficulty = Math.min(10.0, card.difficulty + 1.2);
    updated.stability = Math.max(0.2, card.stability * 0.25);
    updated.due = now + FSRS_DEFAULT.learningSteps[0] * 60 * 1000;
    return updated;
  }

  // Recall (Hard, Good, Easy)
  const diffDelta = rating === 2 ? 0.6 : rating === 3 ? -0.2 : -0.8;
  updated.difficulty = Math.min(10.0, Math.max(1.0, card.difficulty + diffDelta));

  // Stability increase formula: S' = S * (1 + factor * (11 - D) * S^-0.5 * (e^(1-R) - 1))
  const gradeFactor = rating === 2 ? 0.8 : rating === 3 ? 1.0 : 1.35;
  const growth =
    gradeFactor * (11 - updated.difficulty) * Math.pow(Math.max(0.1, card.stability), -0.5) * (Math.exp(1 - R) - 1);
  const newStability = card.stability * (1 + Math.max(0.1, growth));
  updated.stability = Math.max(card.stability * 1.05, Number(newStability.toFixed(2)));

  const days = nextIntervalDays(updated.stability);
  updated.due = now + days * 24 * 60 * 60 * 1000;
  return updated;
}
