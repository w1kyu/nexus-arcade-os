import { describe, expect, it } from 'vitest';
import { computeTaskStats, nextTaskDueDate, parseQuickAdd } from '../../src/apps/tasks/model.js';

describe('Nexus Tasks natural-language quick add (EN + DE)', () => {
  const fixedNow = new Date(2026, 10, 10, 9, 0, 0); // Tue 2026-11-10 09:00 local

  it('parses English quick add with tomorrow, time, tag, priority and estimate', () => {
    const res = parseQuickAdd('Prepare presentation tomorrow 14:00 #uni !high ~45m', fixedNow);
    expect(res.title).toBe('Prepare presentation');
    expect(res.dueDate).toBe('2026-11-11');
    expect(res.dueTime).toBe('14:00');
    expect(res.tags).toEqual(['uni']);
    expect(res.priority).toBe(2);
    expect(res.estimateMinutes).toBe(45);
  });

  it('parses German quick add with morgen, 14 Uhr, tag and priority', () => {
    const res = parseQuickAdd('Präsentation vorbereiten morgen 14 Uhr #uni !hoch', fixedNow);
    expect(res.title).toBe('Präsentation vorbereiten');
    expect(res.dueDate).toBe('2026-11-11');
    expect(res.dueTime).toBe('14:00');
    expect(res.tags).toEqual(['uni']);
    expect(res.priority).toBe(2);
  });

  it('parses recurrence rules and weekday names in English and German', () => {
    const en = parseQuickAdd('Weekly review friday at 5pm every week !p1 @Work', fixedNow);
    expect(en.title).toBe('Weekly review');
    expect(en.dueDate).toBe('2026-11-13');
    expect(en.dueTime).toBe('17:00');
    expect(en.priority).toBe(1);
    expect(en.projectHint).toBe('Work');
    expect(en.recurrence).toEqual({ freq: 'weekly', interval: 1 });

    const de = parseQuickAdd('Müll rausbringen jeden Tag um 8:30 Uhr !dringend', fixedNow);
    expect(de.title).toBe('Müll rausbringen');
    expect(de.dueTime).toBe('08:30');
    expect(de.priority).toBe(1);
    expect(de.recurrence).toEqual({ freq: 'daily', interval: 1 });
  });

  it('advances recurring task due dates and computes productivity statistics', () => {
    expect(nextTaskDueDate('2026-11-10', { freq: 'weekly', interval: 1 })).toBe('2026-11-17');

    const stats = computeTaskStats(
      [
        {
          id: '1',
          title: 'Done today',
          description: '',
          projectId: 'uni',
          sectionId: '',
          status: 'done',
          priority: 2,
          dueDate: '2026-11-10',
          dueTime: null,
          startDate: null,
          tags: [],
          subtasks: [],
          estimateMinutes: 30,
          trackedMinutes: 25,
          attachments: [],
          noteLinks: [],
          recurrence: null,
          reminderMinutesBefore: null,
          schedulerJobId: null,
          completed: true,
          completedAt: fixedNow.getTime(),
          createdAt: fixedNow.getTime() - 2 * 3_600_000,
          updatedAt: fixedNow.getTime(),
          order: 0,
        },
        {
          id: '2',
          title: 'Overdue open',
          description: '',
          projectId: 'uni',
          sectionId: '',
          status: 'todo',
          priority: 1,
          dueDate: '2026-11-08',
          dueTime: null,
          startDate: null,
          tags: [],
          subtasks: [],
          estimateMinutes: 0,
          trackedMinutes: 15,
          attachments: [],
          noteLinks: [],
          recurrence: null,
          reminderMinutesBefore: null,
          schedulerJobId: null,
          completed: false,
          completedAt: null,
          createdAt: fixedNow.getTime() - 48 * 3_600_000,
          updatedAt: fixedNow.getTime(),
          order: 1,
        },
      ],
      fixedNow,
    );
    expect(stats.streak).toBe(1);
    expect(stats.avgCompletionHours).toBe(2);
    expect(stats.overdueCount).toBe(1);
    expect(stats.overdueRate).toBe(100);
    expect(stats.timeByProject).toEqual({ uni: 40 });
  });
});
