// @ts-check
import { describe, expect, it } from 'vitest';
import { computeFocusStats, formatTimerMMSS, nextPomodoroPhase } from '../../src/apps/focus/model.js';

describe('Focus model', () => {
  it('transitions through work, short break, and long break after N rounds', () => {
    const cfg = {
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      roundsBeforeLongBreak: 4,
      autoStartNext: false,
      dailyGoalMinutes: 120,
    };

    // Round 1 work -> shortBreak
    const step1 = nextPomodoroPhase('work', 1, cfg);
    expect(step1).toEqual({ nextPhase: 'shortBreak', nextRound: 1, durationSeconds: 300 });

    // Round 1 shortBreak -> Round 2 work
    const step2 = nextPomodoroPhase('shortBreak', 1, cfg);
    expect(step2).toEqual({ nextPhase: 'work', nextRound: 2, durationSeconds: 1500 });

    // Round 4 work -> longBreak
    const step3 = nextPomodoroPhase('work', 4, cfg);
    expect(step3).toEqual({ nextPhase: 'longBreak', nextRound: 4, durationSeconds: 900 });

    // longBreak -> resets to Round 1 work
    const step4 = nextPomodoroPhase('longBreak', 4, cfg);
    expect(step4).toEqual({ nextPhase: 'work', nextRound: 1, durationSeconds: 1500 });
  });

  it('formats timer seconds and computes streaks, best time of day, and task totals', () => {
    expect(formatTimerMMSS(1500)).toBe('25:00');
    expect(formatTimerMMSS(65)).toBe('01:05');

    const now = new Date(2026, 4, 10, 15, 0, 0); // 2026-05-10
    /** @type {import('../../src/apps/focus/model.js').FocusSessionRecord[]} */
    const sessions = [
      {
        id: '1',
        phase: 'work',
        mode: 'pomodoro',
        durationMinutes: 25,
        taskId: 't1',
        taskTitle: 'Write kernel tests',
        projectId: 'uni',
        note: 'Finished unit tests',
        overrides: 0,
        startedAt: new Date(2026, 4, 8, 9, 0).getTime(),
        completedAt: new Date(2026, 4, 8, 9, 25).getTime(),
        date: '2026-05-08',
      },
      {
        id: '2',
        phase: 'work',
        mode: 'pomodoro',
        durationMinutes: 50,
        taskId: 't1',
        taskTitle: 'Write kernel tests',
        projectId: 'uni',
        note: 'E2E suite',
        overrides: 1,
        startedAt: new Date(2026, 4, 9, 10, 0).getTime(),
        completedAt: new Date(2026, 4, 9, 10, 50).getTime(),
        date: '2026-05-09',
      },
      {
        id: '3',
        phase: 'work',
        mode: 'pomodoro',
        durationMinutes: 45,
        taskId: 't2',
        taskTitle: 'Read paper',
        projectId: 'uni',
        note: '',
        overrides: 0,
        startedAt: new Date(2026, 4, 10, 14, 0).getTime(),
        completedAt: new Date(2026, 4, 10, 14, 45).getTime(),
        date: '2026-05-10',
      },
    ];

    const stats = computeFocusStats(sessions, 90, now);
    expect(stats.todayMinutes).toBe(45);
    expect(stats.dailyGoalProgress).toBe(0.5);
    expect(stats.totalSessions).toBe(3);
    expect(stats.totalMinutes).toBe(120);
    expect(stats.currentStreakDays).toBe(3);
    expect(stats.longestStreakDays).toBe(3);
    expect(stats.bestTimeOfDay).toBe('morning'); // 75m morning vs 45m afternoon
    expect(stats.byTask[0]).toEqual({
      taskId: 't1',
      taskTitle: 'Write kernel tests',
      minutes: 75,
      sessions: 2,
    });
  });
});
