import { describe, expect, it } from 'vitest';
import {
  computeDegreeStats,
  computeModuleGradeFromPartials,
  computeSemesterBreakdown,
  computeWhatIfTarget,
  simulateGradeForModule,
} from '../../src/apps/grades/model.js';

describe('Grade Tracker Model', () => {
  it('computes weighted GPA accurately', () => {
    /** @type {import('../../src/apps/grades/model.js').ModuleItem[]} */
    const modules = [
      {
        id: '1',
        profileId: 'p1',
        name: 'Math',
        ects: 10,
        grade: 1.0,
        semester: 1,
        status: 'passed',
        countsTowardsFinal: true,
        attempt: 1,
      },
      {
        id: '2',
        profileId: 'p1',
        name: 'Physics',
        ects: 5,
        grade: 2.0,
        semester: 1,
        status: 'passed',
        countsTowardsFinal: true,
        attempt: 1,
      },
      {
        id: '3',
        profileId: 'p1',
        name: 'Orientation',
        ects: 3,
        grade: 1.0,
        semester: 1,
        status: 'passed',
        countsTowardsFinal: false, // does not count towards final grade
        attempt: 1,
      },
    ];

    const stats = computeDegreeStats(modules);
    // Weighted sum = 10 * 1.0 + 5 * 2.0 = 20. Total counted ects = 15. Avg = 20/15 = 1.33
    expect(stats.average).toBeCloseTo(1.33, 2);
    expect(stats.gradedEcts).toBe(15);
    expect(stats.passedEcts).toBe(18);
  });

  it('computes module grade from partial components', () => {
    /** @type {import('../../src/apps/grades/model.js').PartialGrade[]} */
    const partials = [
      { id: '1', name: 'Exam', weight: 0.7, grade: 2.0 },
      { id: '2', name: 'Project', weight: 0.3, grade: 1.0 },
    ];
    // 0.7 * 2.0 + 0.3 * 1.0 = 1.4 + 0.3 = 1.7
    const result = computeModuleGradeFromPartials(partials);
    expect(result).toBe(1.7);
  });

  it('computes What-If required average correctly', () => {
    /** @type {import('../../src/apps/grades/model.js').ModuleItem[]} */
    const modules = [
      {
        id: '1',
        profileId: 'p1',
        name: 'Mod A',
        ects: 30,
        grade: 2.0,
        semester: 1,
        status: 'passed',
        countsTowardsFinal: true,
        attempt: 1,
      },
    ];
    // Current points: 30 * 2.0 = 60.
    // Total required ECTS: 60 (remaining: 30 ECTS).
    // Target grade: 1.5. Total target points = 1.5 * 60 = 90.
    // Needed remaining points = 90 - 60 = 30.
    // Needed remaining average = 30 / 30 = 1.0.
    const res = computeWhatIfTarget(modules, 1.5, 60, 'german');
    expect(res.neededAverage).toBe(1.0);
    expect(res.remainingEcts).toBe(30);
    expect(res.possible).toBe(true);

    // If target is impossible (e.g. 0.8 on a 1.0-5.0 scale)
    const impossible = computeWhatIfTarget(modules, 0.8, 60, 'german');
    expect(impossible.possible).toBe(false);
  });

  it('simulates hypothetical grade changes', () => {
    /** @type {import('../../src/apps/grades/model.js').ModuleItem[]} */
    const modules = [
      {
        id: '1',
        profileId: 'p1',
        name: 'Mod A',
        ects: 10,
        grade: 2.0,
        semester: 1,
        status: 'passed',
        countsTowardsFinal: true,
        attempt: 1,
      },
      {
        id: '2',
        profileId: 'p1',
        name: 'Mod B',
        ects: 10,
        grade: null,
        semester: 2,
        status: 'in_progress',
        countsTowardsFinal: true,
        attempt: 1,
      },
    ];
    const avgWith1 = simulateGradeForModule(modules, '2', 1.0);
    expect(avgWith1).toBe(1.5);
    const avgWith3 = simulateGradeForModule(modules, '2', 3.0);
    expect(avgWith3).toBe(2.5);
  });

  it('breaks down stats per semester', () => {
    /** @type {import('../../src/apps/grades/model.js').ModuleItem[]} */
    const modules = [
      {
        id: '1',
        profileId: 'p1',
        name: 'A',
        ects: 5,
        grade: 1.0,
        semester: 1,
        status: 'passed',
        countsTowardsFinal: true,
        attempt: 1,
      },
      {
        id: '2',
        profileId: 'p1',
        name: 'B',
        ects: 5,
        grade: 2.0,
        semester: 2,
        status: 'passed',
        countsTowardsFinal: true,
        attempt: 1,
      },
    ];
    const breakdown = computeSemesterBreakdown(modules);
    expect(breakdown.length).toBe(2);
    expect(breakdown[0].semester).toBe(1);
    expect(breakdown[0].average).toBe(1.0);
    expect(breakdown[1].semester).toBe(2);
    expect(breakdown[1].average).toBe(2.0);
  });
});
