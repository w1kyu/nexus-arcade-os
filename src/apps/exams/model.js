// @ts-check
// Exam Planner model: countdown calculation, readiness scoring,
// study plan distribution over remaining days, and Tasks generation.

/**
 * @typedef {'written' | 'oral' | 'project' | 'practical'} ExamType
 */

/**
 * @typedef {object} ExamTopic
 * @property {string} id
 * @property {string} title
 * @property {boolean} done
 * @property {number} [estimatedHours]
 */

/**
 * @typedef {object} ExamItem
 * @property {string} id
 * @property {string} moduleName
 * @property {string} [moduleCode]
 * @property {string} date              'YYYY-MM-DD'
 * @property {string} time              'HH:MM'
 * @property {string} room
 * @property {ExamType} type
 * @property {ExamTopic[]} topics
 * @property {string} [linkedDeckId]    optional linked Flashcards deck
 * @property {string} [notes]
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * Computes days remaining until the exam.
 * @param {string} examDateStr 'YYYY-MM-DD'
 * @param {Date} [now]
 * @returns {number} positive = in future, 0 = today, negative = past
 */
export function computeDaysRemaining(examDateStr, now = new Date()) {
  const [y, m, d] = examDateStr.split('-').map((n) => Number.parseInt(n, 10));
  const examDate = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  return Math.round((examDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Computes readiness score (0..100%) based on topic checklist progress and time remaining.
 * @param {ExamItem} exam
 * @param {number} [flashcardRetention] 0.0 .. 1.0 (optional)
 * @returns {{ score: number, status: 'ready' | 'on_track' | 'needs_work' | 'critical' }}
 */
export function computeReadinessScore(exam, flashcardRetention = 1.0) {
  if (!exam.topics || exam.topics.length === 0) {
    return { score: 50, status: 'on_track' };
  }

  const doneCount = exam.topics.filter((t) => t.done).length;
  const topicRatio = doneCount / exam.topics.length;
  const days = computeDaysRemaining(exam.date);

  // Blend topic completion (70%) and retention (30%)
  let baseScore = topicRatio * 70 + (flashcardRetention || 0.8) * 30;

  // Penalty if exam is in < 3 days and topics are incomplete
  if (days <= 3 && topicRatio < 0.5) {
    baseScore = Math.max(10, baseScore - 25);
  }

  const score = Math.round(Math.min(100, Math.max(0, baseScore)));
  let status = /** @type {'ready' | 'on_track' | 'needs_work' | 'critical'} */ ('ready');
  if (score < 40) status = 'critical';
  else if (score < 70) status = 'needs_work';
  else if (score < 90) status = 'on_track';

  return { score, status };
}

/**
 * Distributes open topics across remaining days into daily study sessions.
 * @param {ExamItem} exam
 * @param {Date} [now]
 * @returns {Array<{ date: string, topics: ExamTopic[] }>}
 */
export function generateStudyPlan(exam, now = new Date()) {
  const openTopics = exam.topics.filter((t) => !t.done);
  if (!openTopics.length) return [];

  const daysLeft = Math.max(1, computeDaysRemaining(exam.date, now));
  // Leave the last day before exam for general revision
  const studyDaysCount = Math.max(1, daysLeft > 1 ? daysLeft - 1 : 1);

  const plan = [];
  const topicsPerDay = Math.ceil(openTopics.length / studyDaysCount);

  let topicIndex = 0;
  for (let d = 0; d < studyDaysCount && topicIndex < openTopics.length; d++) {
    const curDate = new Date(now.getTime() + d * 86400000);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayTopics = openTopics.slice(topicIndex, topicIndex + topicsPerDay);
    topicIndex += topicsPerDay;
    plan.push({ date: dateStr, topics: dayTopics });
  }

  return plan;
}
