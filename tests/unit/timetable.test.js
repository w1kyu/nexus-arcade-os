import { describe, expect, it } from 'vitest';
import {
  computeNowAndNext,
  exportTimetableToICS,
  exportTimetableToJSON,
  getBiweeklyWeekType,
  isCourseActiveThisWeek,
  parseTimetableJSON,
  timeToMinutes,
} from '../../src/apps/timetable/model.js';

describe('Timetable Model', () => {
  it('calculates biweekly A/B weeks correctly', () => {
    const refDate = '2026-10-01'; // Week A
    const weekA = new Date('2026-10-02T12:00:00');
    const weekB = new Date('2026-10-09T12:00:00');
    expect(getBiweeklyWeekType(weekA, refDate, 'A')).toBe('A');
    expect(getBiweeklyWeekType(weekB, refDate, 'A')).toBe('B');
  });

  it('checks course activity based on week type', () => {
    /** @type {any} */
    const courseAll = { weekType: 'all' };
    /** @type {any} */
    const courseA = { weekType: 'A' };
    /** @type {any} */
    const courseB = { weekType: 'B' };

    expect(isCourseActiveThisWeek(courseAll, 'A')).toBe(true);
    expect(isCourseActiveThisWeek(courseAll, 'B')).toBe(true);
    expect(isCourseActiveThisWeek(courseA, 'A')).toBe(true);
    expect(isCourseActiveThisWeek(courseA, 'B')).toBe(false);
    expect(isCourseActiveThisWeek(courseB, 'B')).toBe(true);
    expect(isCourseActiveThisWeek(courseB, 'A')).toBe(false);
  });

  it('computes time in minutes', () => {
    expect(timeToMinutes('08:15')).toBe(8 * 60 + 15);
    expect(timeToMinutes('14:30')).toBe(14 * 60 + 30);
  });

  it('computes Now & Next courses accurately', () => {
    /** @type {import('../../src/apps/timetable/model.js').Course[]} */
    const courses = [
      {
        id: '1',
        semesterId: 's1',
        name: 'Math',
        type: 'lecture',
        lecturer: 'Prof A',
        room: 'H1',
        color: 'cyan',
        dayOfWeek: 1, // Mon
        startTime: '08:00',
        endTime: '10:00',
        weekType: 'all',
      },
      {
        id: '2',
        semesterId: 's1',
        name: 'CS',
        type: 'lecture',
        lecturer: 'Prof B',
        room: 'H2',
        color: 'emerald',
        dayOfWeek: 1, // Mon
        startTime: '10:15',
        endTime: '12:00',
        weekType: 'all',
      },
    ];

    // During Math on Monday
    const dateDuringMath = new Date(2026, 9, 5, 8, 30); // 2026-10-05 is Monday
    const res1 = computeNowAndNext(courses, dateDuringMath, 'A');
    expect(res1.current?.name).toBe('Math');
    expect(res1.next?.name).toBe('CS');
    expect(res1.minutesToNext).toBe(10 * 60 + 15 - (8 * 60 + 30));

    // Before any class on Monday
    const dateBefore = new Date(2026, 9, 5, 7, 0);
    const res2 = computeNowAndNext(courses, dateBefore, 'A');
    expect(res2.current).toBeNull();
    expect(res2.next?.name).toBe('Math');
    expect(res2.minutesToNext).toBe(60);
  });

  it('exports and parses JSON and ICS', () => {
    /** @type {import('../../src/apps/timetable/model.js').Semester} */
    const sem = {
      id: 's1',
      name: 'WS 2026/27',
      startDate: '2026-10-01',
      endDate: '2027-03-31',
      active: true,
      archived: false,
    };
    /** @type {import('../../src/apps/timetable/model.js').Course[]} */
    const courses = [
      {
        id: 'c1',
        semesterId: 's1',
        name: 'Databases',
        type: 'lecture',
        lecturer: 'Dr. Data',
        room: 'Lab 1',
        color: 'blue',
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '11:30',
        weekType: 'all',
      },
    ];

    const json = exportTimetableToJSON(sem, courses);
    const parsed = parseTimetableJSON(json);
    expect(parsed.semester?.name).toBe('WS 2026/27');
    expect(parsed.courses.length).toBe(1);
    expect(parsed.courses[0].name).toBe('Databases');

    const ics = exportTimetableToICS(courses, sem);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Databases');
    expect(ics).toContain('LOCATION:Lab 1');
  });
});
