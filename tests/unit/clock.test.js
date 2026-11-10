import { describe, expect, it } from 'vitest';
import { exportLapsText, formatStopwatchTime, getCityTime, planMeetingOverlap } from '../../src/apps/clock/model.js';

describe('Clock Model', () => {
  it('formats city times accurately according to time zones', () => {
    // 2026-11-10 12:00:00 UTC
    const date = new Date(Date.UTC(2026, 10, 10, 12, 0, 0));

    // Berlin is UTC+1 in winter
    const berlin = getCityTime(date, 'Europe/Berlin');
    expect(berlin.hour).toBe(13);
    expect(berlin.minute).toBe(0);

    // New York is UTC-5 in winter (EST)
    const ny = getCityTime(date, 'America/New_York');
    expect(ny.hour).toBe(7);

    // Tokyo is UTC+9
    const tokyo = getCityTime(date, 'Asia/Tokyo');
    expect(tokyo.hour).toBe(21);
  });

  it('plans meeting overlap across time zones', () => {
    const baseDate = new Date('2026-11-10T00:00:00Z');
    // London (UTC) and Berlin (UTC+1)
    const overlap = planMeetingOverlap(['Europe/London', 'Europe/Berlin'], baseDate, {
      workStart: 9,
      workEnd: 17,
    });
    expect(overlap.length).toBe(24);

    // Overlap should identify ideal common working hours
    const ideal = overlap.filter((o) => o.isIdeal);
    expect(ideal.length).toBeGreaterThan(0);
    for (const slot of ideal) {
      expect(slot.cityHours['Europe/London']).toBeGreaterThanOrEqual(9);
      expect(slot.cityHours['Europe/London']).toBeLessThan(17);
      expect(slot.cityHours['Europe/Berlin']).toBeGreaterThanOrEqual(9);
      expect(slot.cityHours['Europe/Berlin']).toBeLessThan(17);
    }
  });

  it('formats stopwatch milliseconds and exports lap text', () => {
    expect(formatStopwatchTime(0)).toBe('00:00.00');
    expect(formatStopwatchTime(65430)).toBe('01:05.43');

    const laps = [
      { lapIndex: 1, lapTimeMs: 12000, overallTimeMs: 12000 },
      { lapIndex: 2, lapTimeMs: 15500, overallTimeMs: 27500 },
    ];
    const text = exportLapsText(laps);
    expect(text).toContain('Lap 1,00:12.00,00:12.00');
    expect(text).toContain('Lap 2,00:15.50,00:27.50');
  });
});
