import { describe, expect, it } from 'vitest';
import { computeDaysRemaining, computeReadinessScore, generateStudyPlan } from '../../src/apps/exams/model.js';

describe('Exam Planner Model', () => {
  it('computes days remaining correctly', () => {
    const today = new Date('2026-11-10T12:00:00');
    expect(computeDaysRemaining('2026-11-10', today)).toBe(0);
    expect(computeDaysRemaining('2026-11-15', today)).toBe(5);
    expect(computeDaysRemaining('2026-11-05', today)).toBe(-5);
  });

  it('computes readiness score accurately', () => {
    /** @type {import('../../src/apps/exams/model.js').ExamItem} */
    const examAllDone = {
      id: '1',
      moduleName: 'OS',
      date: '2026-11-20',
      time: '09:00',
      room: 'H1',
      type: 'written',
      topics: [
        { id: '1', title: 'T1', done: true },
        { id: '2', title: 'T2', done: true },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const scoreAll = computeReadinessScore(examAllDone, 1.0);
    expect(scoreAll.score).toBe(100);
    expect(scoreAll.status).toBe('ready');

    /** @type {import('../../src/apps/exams/model.js').ExamItem} */
    const examCritical = {
      ...examAllDone,
      date: '2026-11-11', // tomorrow
      topics: [
        { id: '1', title: 'T1', done: false },
        { id: '2', title: 'T2', done: false },
      ],
    };
    const scoreCrit = computeReadinessScore(examCritical, 0.5);
    expect(scoreCrit.score).toBeLessThanOrEqual(40);
    expect(scoreCrit.status).toBe('critical');
  });

  it('generates a distributed study plan', () => {
    const now = new Date('2026-11-10T10:00:00');
    /** @type {import('../../src/apps/exams/model.js').ExamItem} */
    const exam = {
      id: '1',
      moduleName: 'Algo',
      date: '2026-11-14', // 4 days left
      time: '09:00',
      room: 'H2',
      type: 'written',
      topics: [
        { id: '1', title: 'Sorting', done: false },
        { id: '2', title: 'Trees', done: false },
        { id: '3', title: 'Graphs', done: false },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const plan = generateStudyPlan(exam, now);
    expect(plan.length).toBeGreaterThan(0);
    const scheduledTopics = plan.flatMap((p) => p.topics);
    expect(scheduledTopics.length).toBe(3);
  });
});
