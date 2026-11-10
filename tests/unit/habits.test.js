import { describe, expect, it } from 'vitest';
import { computeHabitStreaks, generateHabitHeatmap, isHabitScheduledForDate } from '../../src/apps/habits/model.js';

describe('Habits Model', () => {
  /** @type {import('../../src/apps/habits/model.js').HabitItem} */
  const dailyHabit = {
    id: 'h1',
    name: 'Reading',
    color: 'flame',
    icon: 'flame',
    freq: 'daily',
    targetType: 'boolean',
    targetValue: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  /** @type {import('../../src/apps/habits/model.js').HabitItem} */
  const weekdayHabit = {
    id: 'h2',
    name: 'Work Gym',
    color: 'emerald',
    icon: 'heart',
    freq: 'weekdays',
    weekdays: [1, 2, 3, 4, 5],
    targetType: 'count',
    targetValue: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('checks if habit is scheduled for date correctly', () => {
    // 2026-11-09 is Monday, 2026-11-15 is Sunday
    const mon = new Date('2026-11-09T12:00:00');
    const sun = new Date('2026-11-15T12:00:00');

    expect(isHabitScheduledForDate(dailyHabit, mon)).toBe(true);
    expect(isHabitScheduledForDate(dailyHabit, sun)).toBe(true);

    expect(isHabitScheduledForDate(weekdayHabit, mon)).toBe(true);
    expect(isHabitScheduledForDate(weekdayHabit, sun)).toBe(false);
  });

  it('calculates streaks and rest days', () => {
    const now = new Date('2026-11-10T12:00:00');
    /** @type {import('../../src/apps/habits/model.js').HabitLog[]} */
    const logs = [
      { id: '1', habitId: 'h1', date: '2026-11-10', value: 1, completed: true, isRestDay: false },
      { id: '2', habitId: 'h1', date: '2026-11-09', value: 0, completed: false, isRestDay: true }, // rest day preserves streak!
      { id: '3', habitId: 'h1', date: '2026-11-08', value: 1, completed: true, isRestDay: false },
    ];

    const stats = computeHabitStreaks(dailyHabit, logs, now);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBeGreaterThanOrEqual(2);
    expect(stats.totalCompletions).toBe(2);
  });

  it('preserves active streak when today is not yet checked in', () => {
    const now = new Date('2026-11-10T12:00:00');
    /** @type {import('../../src/apps/habits/model.js').HabitLog[]} */
    const logs = [
      { id: '1', habitId: 'h1', date: '2026-11-09', value: 1, completed: true, isRestDay: false },
      { id: '2', habitId: 'h1', date: '2026-11-08', value: 1, completed: true, isRestDay: false },
    ];

    const stats = computeHabitStreaks(dailyHabit, logs, now);
    expect(stats.currentStreak).toBe(2);
  });

  it('generates 52-week activity heatmap dataset', () => {
    const now = new Date('2026-11-10T12:00:00');
    /** @type {import('../../src/apps/habits/model.js').HabitLog[]} */
    const logs = [
      { id: '1', habitId: 'h1', date: '2026-11-10', value: 1, completed: true, isRestDay: false },
      { id: '2', habitId: 'h1', date: '2026-11-09', value: 0, completed: false, isRestDay: true },
    ];

    const heatmap = generateHabitHeatmap('h1', logs, now);
    expect(heatmap.length).toBe(52 * 7);

    const todayEntry = heatmap.find((h) => h.date === '2026-11-10');
    expect(todayEntry).toBeDefined();
    expect(todayEntry?.level).toBe(4);

    const restEntry = heatmap.find((h) => h.date === '2026-11-09');
    expect(restEntry?.level).toBe(1);
  });
});
