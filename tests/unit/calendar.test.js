// @ts-check
import { describe, expect, it } from 'vitest';
import {
  applyRecurringEdit,
  computeEasterSunday,
  computeGermanHolidays,
  deleteRecurringOccurrence,
  expandEventsInRange,
  formatLocalDate,
  parseEventQuickAdd,
  parseICS,
  serializeICS,
} from '../../src/apps/calendar/model.js';

describe('Calendar model', () => {
  it('computes Easter Sunday and German / Hesse public holidays accurately', () => {
    const easter2026 = computeEasterSunday(2026);
    expect(formatLocalDate(easter2026)).toBe('2026-04-05');

    const heHolidays = computeGermanHolidays(2026, 'HE');
    const byDate = Object.fromEntries(heHolidays.map((h) => [h.date, h]));
    expect(byDate['2026-01-01']?.titleDe).toBe('Neujahr');
    expect(byDate['2026-04-03']?.titleDe).toBe('Karfreitag');
    expect(byDate['2026-04-06']?.titleDe).toBe('Ostermontag');
    expect(byDate['2026-05-14']?.titleDe).toBe('Christi Himmelfahrt');
    expect(byDate['2026-05-25']?.titleDe).toBe('Pfingstmontag');
    // Hesse includes Corpus Christi (Fronleichnam = Easter + 60 days = 2026-06-04)
    expect(byDate['2026-06-04']?.titleDe).toBe('Fronleichnam');
    expect(byDate['2026-10-03']?.titleDe).toBe('Tag der Deutschen Einheit');
  });

  it('round-trips RFC 5545 .ics with VEVENT, RRULE, EXDATE, and VALARM', () => {
    const icsInput = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:lecture-101',
      'SUMMARY:Operating Systems Lecture\\, Room B',
      'LOCATION:Hörsaal H1',
      'DESCRIPTION:Processes & Threads\\nBring laptop',
      'DTSTART:20260406T100000',
      'DTEND:20260406T113000',
      'RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=4',
      'EXDATE:20260413T100000',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const parsed = parseICS(icsInput, 'uni');
    expect(parsed).toHaveLength(1);
    const ev = parsed[0];
    expect(ev.id).toBe('lecture-101');
    expect(ev.title).toBe('Operating Systems Lecture, Room B');
    expect(ev.location).toBe('Hörsaal H1');
    expect(ev.description).toBe('Processes & Threads\nBring laptop');
    expect(ev.startDate).toBe('2026-04-06');
    expect(ev.startTime).toBe('10:00');
    expect(ev.endTime).toBe('11:30');
    expect(ev.recurrence).toEqual({ freq: 'weekly', interval: 1, count: 4 });
    expect(ev.exdates).toEqual(['2026-04-13']);
    expect(ev.reminders).toEqual([15, 60]);

    // Expand occurrences across April 2026: 4 weekly occurrences minus 2026-04-13 = 3
    const occurrences = expandEventsInRange(parsed, '2026-04-01', '2026-04-30');
    expect(occurrences.map((o) => o.startDate)).toEqual(['2026-04-06', '2026-04-20', '2026-04-27']);

    // Serialize back to ICS and re-parse
    const serialized = serializeICS(parsed);
    expect(serialized).toContain('RRULE:FREQ=WEEKLY;COUNT=4');
    expect(serialized).toContain('EXDATE:20260413T100000');
    expect(serialized).toContain('TRIGGER:-PT15M');
    const reparsed = parseICS(serialized, 'uni');
    expect(reparsed[0].title).toBe('Operating Systems Lecture, Room B');
    expect(reparsed[0].exdates).toEqual(['2026-04-13']);
  });

  it('supports single-instance overrides ("this") and splitting series ("following")', () => {
    /** @type {import('../../src/apps/calendar/model.js').CalendarEvent} */
    const baseEvent = {
      id: 'standup-1',
      calendarId: 'work',
      title: 'Team Standup',
      location: 'Room 1',
      description: '',
      allDay: false,
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      startTime: '09:00',
      endTime: '09:30',
      timeZone: 'Europe/Berlin',
      recurrence: { freq: 'daily', interval: 1, count: 4 },
      exdates: [],
      overrides: {},
      reminders: [10],
      createdAt: 1,
      updatedAt: 1,
    };

    // Edit only 2026-05-02
    const { updated: afterThis } = applyRecurringEdit(
      baseEvent,
      '2026-05-02',
      { title: 'Special Standup', startTime: '10:00' },
      'this',
    );
    const expanded1 = expandEventsInRange([afterThis], '2026-05-01', '2026-05-04');
    expect(expanded1.map((o) => `${o.startDate}:${o.title}@${o.startTime}`)).toEqual([
      '2026-05-01:Team Standup@09:00',
      '2026-05-02:Special Standup@10:00',
      '2026-05-03:Team Standup@09:00',
      '2026-05-04:Team Standup@09:00',
    ]);

    // Edit "this and following" from 2026-05-03
    const { updated: firstHalf, created: secondHalf } = applyRecurringEdit(
      afterThis,
      '2026-05-03',
      { title: 'Moved Standup', startTime: '11:00' },
      'following',
    );
    expect(secondHalf).not.toBeNull();
    const expanded2 = expandEventsInRange([firstHalf, /** @type {any} */ (secondHalf)], '2026-05-01', '2026-05-04');
    expect(expanded2.map((o) => `${o.startDate}:${o.title}@${o.startTime}`)).toEqual([
      '2026-05-01:Team Standup@09:00',
      '2026-05-02:Special Standup@10:00',
      '2026-05-03:Moved Standup@11:00',
      '2026-05-04:Moved Standup@11:00',
    ]);

    // Delete single occurrence
    const afterDelete = deleteRecurringOccurrence(firstHalf, '2026-05-01', 'this');
    const expanded3 = expandEventsInRange([afterDelete], '2026-05-01', '2026-05-04');
    expect(expanded3.map((o) => o.startDate)).toEqual(['2026-05-02']);
  });

  it('parses natural-language quick add in EN and DE', () => {
    const ref = new Date(2026, 4, 11, 9, 0, 0); // Mon 2026-05-11
    const en = parseEventQuickAdd('Lunch with Max Friday 12:30-13:30 @Mensa', ref);
    expect(en.title).toBe('Lunch with Max');
    expect(en.startDate).toBe('2026-05-15');
    expect(en.startTime).toBe('12:30');
    expect(en.endTime).toBe('13:30');
    expect(en.location).toBe('Mensa');

    const de = parseEventQuickAdd('Zahnarzt morgen 15 Uhr @Praxis Mitte', ref);
    expect(de.title).toBe('Zahnarzt');
    expect(de.startDate).toBe('2026-05-12');
    expect(de.startTime).toBe('15:00');
    expect(de.location).toBe('Praxis Mitte');
  });
});
