// @ts-check
// Habits model: streak calculations, rest days, GitHub-style 365-day heatmap generation,
// check-in logic (boolean, count, duration), and completion rate analytics.

/**
 * @typedef {'daily' | 'weekdays' | 'n_per_week'} HabitFrequency
 */

/**
 * @typedef {'boolean' | 'count' | 'duration'} HabitTargetType
 */

/**
 * @typedef {object} HabitItem
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} color           e.g. 'cyan', 'emerald', 'amber', 'purple', 'rose', 'flame'
 * @property {string} icon            e.g. 'flame', 'heart', 'book', 'zap', 'target'
 * @property {HabitFrequency} freq
 * @property {number[]} [weekdays]     0 = Sun, 1 = Mon ... 6 = Sat
 * @property {number} [targetPerWeek]  for n_per_week (e.g. 3)
 * @property {HabitTargetType} targetType
 * @property {number} targetValue      e.g. 1 (boolean), 8 (glasses), 30 (minutes)
 * @property {string} [unit]           e.g. 'glasses', 'min', 'km'
 * @property {string} [reminderTime]   'HH:MM'
 * @property {string | null} [schedulerJobId]
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {object} HabitLog
 * @property {string} id              `${habitId}:${date}`
 * @property {string} habitId
 * @property {string} date            'YYYY-MM-DD'
 * @property {number} value           current progress (e.g. 8)
 * @property {boolean} completed
 * @property {boolean} isRestDay      if true, maintains streak without completion
 */

/**
 * Checks if a habit is scheduled for a given date.
 * @param {HabitItem} habit
 * @param {Date} date
 * @returns {boolean}
 */
export function isHabitScheduledForDate(habit, date) {
  if (habit.freq === 'daily') return true;
  if (habit.freq === 'weekdays') {
    const dow = date.getDay();
    return Array.isArray(habit.weekdays) ? habit.weekdays.includes(dow) : dow >= 1 && dow <= 5;
  }
  return true; // n_per_week is tracked across week
}

/**
 * Calculates current streak, best streak, and completion rate for a habit.
 * @param {HabitItem} habit
 * @param {HabitLog[]} logs
 * @param {Date} [now]
 * @returns {{ currentStreak: number, bestStreak: number, completionRate: number, totalCompletions: number }}
 */
export function computeHabitStreaks(habit, logs, now = new Date()) {
  /** @type {Map<string, HabitLog>} */
  const logMap = new Map();
  for (const l of logs) {
    if (l.habitId === habit.id) logMap.set(l.date, l);
  }

  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;
  let totalCompletions = 0;
  let scheduledDaysCount = 0;

  // Walk backwards from today up to 365 days
  const todayStr = now.toISOString().split('T')[0];
  const todayLog = logMap.get(todayStr);

  let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  // If today isn't completed yet, start streak check from yesterday so streak doesn't reset early in the day
  if (!todayLog || (!todayLog.completed && !todayLog.isRestDay)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streakActive = true;
  for (let i = 0; i < 365; i++) {
    const dStr = checkDate.toISOString().split('T')[0];
    const isScheduled = isHabitScheduledForDate(habit, checkDate);
    const entry = logMap.get(dStr);

    if (isScheduled) {
      if (entry && (entry.completed || entry.isRestDay)) {
        if (streakActive) currentStreak++;
      } else {
        streakActive = false;
      }
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Calculate best streak and completion rate walking forward across past year
  let startCalc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  startCalc.setDate(startCalc.getDate() - 365);

  for (let i = 0; i <= 365; i++) {
    const dStr = startCalc.toISOString().split('T')[0];
    const isScheduled = isHabitScheduledForDate(habit, startCalc);
    const entry = logMap.get(dStr);

    if (isScheduled) {
      scheduledDaysCount++;
      if (entry?.completed) {
        totalCompletions++;
        runningStreak++;
        if (runningStreak > bestStreak) bestStreak = runningStreak;
      } else if (entry?.isRestDay) {
        // Rest day keeps running streak unchanged
      } else {
        runningStreak = 0;
      }
    }
    startCalc.setDate(startCalc.getDate() + 1);
  }

  if (currentStreak > bestStreak) bestStreak = currentStreak;
  const completionRate = scheduledDaysCount > 0 ? Math.round((totalCompletions / scheduledDaysCount) * 100) : 0;

  return { currentStreak, bestStreak, completionRate, totalCompletions };
}

/**
 * Builds a GitHub-style 52-week activity heatmap dataset.
 * @param {string} habitId
 * @param {HabitLog[]} logs
 * @param {Date} [now]
 * @returns {Array<{ date: string, count: number, level: 0 | 1 | 2 | 3 | 4 }>}
 */
export function generateHabitHeatmap(habitId, logs, now = new Date()) {
  /** @type {Map<string, HabitLog>} */
  const logMap = new Map();
  for (const l of logs) {
    if (l.habitId === habitId) logMap.set(l.date, l);
  }

  const result = [];
  const daysTotal = 52 * 7;
  let cur = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  cur.setDate(cur.getDate() - daysTotal + 1);

  for (let i = 0; i < daysTotal; i++) {
    const dStr = cur.toISOString().split('T')[0];
    const entry = logMap.get(dStr);
    let level = /** @type {0 | 1 | 2 | 3 | 4} */ (0);
    let count = 0;

    if (entry?.completed) {
      level = 4;
      count = entry.value || 1;
    } else if (entry?.isRestDay) {
      level = 1;
      count = 0;
    } else if (entry && entry.value > 0) {
      level = 2;
      count = entry.value;
    }

    result.push({ date: dStr, count, level });
    cur.setDate(cur.getDate() + 1);
  }

  return result;
}
