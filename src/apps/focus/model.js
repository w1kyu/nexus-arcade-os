// @ts-check
// Focus / Pomodoro state machine and session statistics model.

/**
 * @typedef {'work' | 'shortBreak' | 'longBreak'} FocusPhase
 */

/**
 * @typedef {object} PomodoroConfig
 * @property {number} workMinutes
 * @property {number} shortBreakMinutes
 * @property {number} longBreakMinutes
 * @property {number} roundsBeforeLongBreak
 * @property {boolean} autoStartNext
 * @property {number} dailyGoalMinutes
 */

/**
 * @typedef {object} FocusSessionRecord
 * @property {string} id
 * @property {FocusPhase} phase
 * @property {'pomodoro' | 'flow'} mode
 * @property {number} durationMinutes
 * @property {string | null} taskId
 * @property {string} taskTitle
 * @property {string} projectId
 * @property {string} note           // session journal entry
 * @property {number} overrides      // number of distraction overrides during session
 * @property {number} startedAt      // epoch ms
 * @property {number} completedAt    // epoch ms
 * @property {string} date           // local YYYY-MM-DD
 */

/**
 * Formats a Date as local `YYYY-MM-DD`.
 * @param {Date} d
 * @returns {string}
 */
export function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formats seconds as `MM:SS`.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTimerMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Returns the duration in seconds for a given phase and config.
 * @param {FocusPhase} phase
 * @param {PomodoroConfig} config
 * @returns {number}
 */
export function getPhaseDurationSeconds(phase, config) {
  if (phase === 'shortBreak') return Math.max(1, config.shortBreakMinutes) * 60;
  if (phase === 'longBreak') return Math.max(1, config.longBreakMinutes) * 60;
  return Math.max(1, config.workMinutes) * 60;
}

/**
 * Computes the next Pomodoro phase and round number after finishing `currentPhase`.
 * @param {FocusPhase} currentPhase
 * @param {number} currentRound  1-indexed
 * @param {PomodoroConfig} config
 * @returns {{ nextPhase: FocusPhase, nextRound: number, durationSeconds: number }}
 */
export function nextPomodoroPhase(currentPhase, currentRound, config) {
  const maxRounds = Math.max(1, config.roundsBeforeLongBreak || 4);
  if (currentPhase === 'work') {
    if (currentRound >= maxRounds) {
      return {
        nextPhase: 'longBreak',
        nextRound: currentRound,
        durationSeconds: getPhaseDurationSeconds('longBreak', config),
      };
    }
    return {
      nextPhase: 'shortBreak',
      nextRound: currentRound,
      durationSeconds: getPhaseDurationSeconds('shortBreak', config),
    };
  }

  // Transitioning from break back to work
  const nextRound = currentPhase === 'longBreak' ? 1 : currentRound + 1;
  return {
    nextPhase: 'work',
    nextRound,
    durationSeconds: getPhaseDurationSeconds('work', config),
  };
}

/**
 * Computes Focus statistics from completed session records.
 * @param {FocusSessionRecord[]} sessions
 * @param {number} [dailyGoalMinutes=240]
 * @param {Date} [now]
 */
export function computeFocusStats(sessions, dailyGoalMinutes = 240, now = new Date()) {
  const workSessions = sessions.filter((s) => s.phase === 'work' && s.durationMinutes > 0);
  const todayStr = formatLocalDate(now);

  let todayMinutes = 0;
  let totalMinutes = 0;
  let overridesCount = 0;

  /** @type {Set<string>} */
  const activeDates = new Set();
  /** @type {Map<string, { taskId: string, taskTitle: string, minutes: number, sessions: number }>} */
  const byTaskMap = new Map();

  // Time-of-day buckets: morning (5..11), afternoon (12..16), evening (17..21), night (22..4)
  const todBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  for (const s of workSessions) {
    const mins = s.durationMinutes || 0;
    totalMinutes += mins;
    overridesCount += s.overrides || 0;
    const dStr = s.date || formatLocalDate(new Date(s.completedAt));
    activeDates.add(dStr);
    if (dStr === todayStr) todayMinutes += mins;

    const hr = new Date(s.completedAt).getHours();
    if (hr >= 5 && hr < 12) todBuckets.morning += mins;
    else if (hr >= 12 && hr < 17) todBuckets.afternoon += mins;
    else if (hr >= 17 && hr < 22) todBuckets.evening += mins;
    else todBuckets.night += mins;

    const key = s.taskId || '__unlinked__';
    const prev = byTaskMap.get(key) ?? {
      taskId: key,
      taskTitle: s.taskTitle || 'General Focus',
      minutes: 0,
      sessions: 0,
    };
    prev.minutes += mins;
    prev.sessions += 1;
    byTaskMap.set(key, prev);
  }

  // Last 7 days chart
  /** @type {Array<{ date: string, minutes: number, sessions: number }>} */
  const weekByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() - i);
    const dStr = formatLocalDate(d);
    const daySessions = workSessions.filter((s) => (s.date || formatLocalDate(new Date(s.completedAt))) === dStr);
    const minutes = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    weekByDay.push({ date: dStr, minutes, sessions: daySessions.length });
  }

  // Current streak
  let currentStreakDays = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  if (!activeDates.has(formatLocalDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDates.has(formatLocalDate(cursor))) {
    currentStreakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak
  const sortedDates = [...activeDates].sort();
  let longestStreakDays = 0;
  let run = 0;
  /** @type {Date | null} */
  let prevDate = null;
  for (const ds of sortedDates) {
    const [y, m, d] = ds.split('-').map((n) => Number.parseInt(n, 10));
    const curD = new Date(y, m - 1, d, 12, 0, 0);
    if (prevDate && Math.round((curD.getTime() - prevDate.getTime()) / 86400000) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreakDays) longestStreakDays = run;
    prevDate = curD;
  }

  // Best time of day
  let bestTimeOfDay = /** @type {'morning' | 'afternoon' | 'evening' | 'night'} */ ('morning');
  let bestVal = -1;
  for (const [k, v] of Object.entries(todBuckets)) {
    if (v > bestVal) {
      bestVal = v;
      bestTimeOfDay = /** @type {any} */ (k);
    }
  }

  return {
    todayMinutes,
    dailyGoalMinutes,
    dailyGoalProgress: Math.min(1, dailyGoalMinutes > 0 ? todayMinutes / dailyGoalMinutes : 0),
    totalSessions: workSessions.length,
    totalMinutes,
    overridesCount,
    currentStreakDays,
    longestStreakDays: Math.max(longestStreakDays, currentStreakDays),
    bestTimeOfDay,
    weekByDay,
    byTask: [...byTaskMap.values()].sort((a, b) => b.minutes - a.minutes),
  };
}
