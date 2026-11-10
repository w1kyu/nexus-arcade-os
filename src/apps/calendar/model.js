// @ts-check
// Calendar data model: RFC 5545 .ics import/export (VEVENT, RRULE, EXDATE, VALARM),
// recurrence expansion with single-instance / this-and-following exceptions,
// German public holidays by federal state (including Hesse / Easter-based),
// and natural-language quick event parsing.

/**
 * @typedef {object} CalendarRecurrence
 * @property {'daily' | 'weekly' | 'monthly' | 'yearly'} freq
 * @property {number} [interval]
 * @property {string[]} [byDay]  // ['MO','TU','WE','TH','FR','SA','SU']
 * @property {string} [until]    // YYYY-MM-DD
 * @property {number} [count]
 */

/**
 * @typedef {object} CalendarOverride
 * @property {string} [title]
 * @property {string} [location]
 * @property {string} [description]
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string} [startTime]
 * @property {string} [endTime]
 * @property {boolean} [allDay]
 */

/**
 * @typedef {object} CalendarEvent
 * @property {string} id
 * @property {string} calendarId
 * @property {string} title
 * @property {string} location
 * @property {string} description
 * @property {boolean} allDay
 * @property {string} startDate        // YYYY-MM-DD
 * @property {string} endDate          // YYYY-MM-DD (inclusive)
 * @property {string} startTime        // HH:MM (when !allDay)
 * @property {string} endTime          // HH:MM (when !allDay)
 * @property {string} timeZone         // e.g. 'Europe/Berlin'
 * @property {string} [color]
 * @property {CalendarRecurrence | null} recurrence
 * @property {string[]} exdates        // YYYY-MM-DD dates excluded from recurrence
 * @property {Record<string, CalendarOverride>} overrides // keyed by original occurrence YYYY-MM-DD
 * @property {number[]} reminders      // minutes before start (e.g. [15, 60])
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {object} CalendarSource
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {boolean} visible
 */

/**
 * @typedef {object} ExpandedOccurrence
 * @property {string} occurrenceId     // `${event.id}@${occurrenceDate}`
 * @property {string} eventId
 * @property {string} occurrenceDate   // original recurrence date YYYY-MM-DD
 * @property {string} calendarId
 * @property {string} title
 * @property {string} location
 * @property {string} description
 * @property {boolean} allDay
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} startTime
 * @property {string} endTime
 * @property {string} color
 * @property {boolean} isRecurring
 * @property {'event' | 'task' | 'holiday' | 'timetable'} kind
 * @property {CalendarEvent} [rawEvent]
 */

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

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
 * Parses `YYYY-MM-DD` into a local Date at noon.
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/**
 * Adds `days` to a Date.
 * @param {Date} d
 * @param {number} days
 * @returns {Date}
 */
export function addDays(d, days) {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Returns the start of the week for `d`.
 * @param {Date} d
 * @param {0 | 1} weekStart  0 = Sunday, 1 = Monday
 * @returns {Date}
 */
export function startOfWeek(d, weekStart = 1) {
  const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  const dow = cur.getDay();
  const diff = (dow - weekStart + 7) % 7;
  cur.setDate(cur.getDate() - diff);
  return cur;
}

/**
 * Computes the ISO 8601 week number for a Date.
 * @param {Date} d
 * @returns {number}
 */
export function getISOWeekNumber(d) {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Computes Easter Sunday for a given year using the Anonymous Gregorian (Meeus/Jones/Butcher) algorithm.
 * @param {number} year
 * @returns {Date}
 */
export function computeEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Computes German public holidays for `year` and federal state (`stateCode`, default `'HE'` Hesse).
 * @param {number} year
 * @param {string} [stateCode='HE']
 * @returns {Array<{ date: string, titleDe: string, titleEn: string, stateCode: string }>}
 */
export function computeGermanHolidays(year, stateCode = 'HE') {
  const st = stateCode.toUpperCase();
  const easter = computeEasterSunday(year);
  /** @type {Array<{ date: string, titleDe: string, titleEn: string, stateCode: string }>} */
  const list = [];

  const push = (/** @type {string} */ date, /** @type {string} */ titleDe, /** @type {string} */ titleEn) => {
    list.push({ date, titleDe, titleEn, stateCode: st });
  };

  // Nationwide holidays (all 16 states)
  push(`${year}-01-01`, 'Neujahr', "New Year's Day");
  push(formatLocalDate(addDays(easter, -2)), 'Karfreitag', 'Good Friday');
  push(formatLocalDate(addDays(easter, 1)), 'Ostermontag', 'Easter Monday');
  push(`${year}-05-01`, 'Tag der Arbeit', 'Labour Day');
  push(formatLocalDate(addDays(easter, 39)), 'Christi Himmelfahrt', 'Ascension Day');
  push(formatLocalDate(addDays(easter, 50)), 'Pfingstmontag', 'Whit Monday');
  push(`${year}-10-03`, 'Tag der Deutschen Einheit', 'German Unity Day');
  push(`${year}-12-25`, '1. Weihnachtstag', 'Christmas Day');
  push(`${year}-12-26`, '2. Weihnachtstag', "St. Stephen's Day");

  // State-specific holidays
  if (['BW', 'BY', 'ST'].includes(st)) {
    push(`${year}-01-06`, 'Heilige Drei Könige', 'Epiphany');
  }
  if (['BE', 'MV'].includes(st)) {
    push(`${year}-03-08`, 'Internationaler Frauentag', "International Women's Day");
  }
  if (st === 'BB') {
    push(formatLocalDate(easter), 'Ostersonntag', 'Easter Sunday');
    push(formatLocalDate(addDays(easter, 49)), 'Pfingstsonntag', 'Whit Sunday');
  }
  if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(st)) {
    push(formatLocalDate(addDays(easter, 60)), 'Fronleichnam', 'Corpus Christi');
  }
  if (['BY', 'SL'].includes(st)) {
    push(`${year}-08-15`, 'Mariä Himmelfahrt', 'Assumption Day');
  }
  if (st === 'TH') {
    push(`${year}-09-20`, 'Weltkindertag', "World Children's Day");
  }
  if (['BB', 'HB', 'HH', 'MV', 'NI', 'SH', 'SN', 'ST', 'TH'].includes(st)) {
    push(`${year}-10-31`, 'Reformationstag', 'Reformation Day');
  }
  if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(st)) {
    push(`${year}-11-01`, 'Allerheiligen', "All Saints' Day");
  }
  if (st === 'SN') {
    // Buß- und Bettag: Wednesday before Nov 23
    const nov22 = new Date(year, 10, 22, 12, 0, 0, 0);
    const dow = nov22.getDay();
    const diff = (dow - 3 + 7) % 7;
    push(formatLocalDate(addDays(nov22, -diff)), 'Buß- und Bettag', 'Repentance and Prayer Day');
  }

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Expands calendar events (including recurring rules, `exdates`, and `overrides`) within `[rangeStartStr, rangeEndStr]`.
 * @param {CalendarEvent[]} events
 * @param {string} rangeStartStr  YYYY-MM-DD
 * @param {string} rangeEndStr    YYYY-MM-DD
 * @param {Record<string, { color: string, visible: boolean }>} [calendarMap]
 * @returns {ExpandedOccurrence[]}
 */
export function expandEventsInRange(events, rangeStartStr, rangeEndStr, calendarMap = {}) {
  /** @type {ExpandedOccurrence[]} */
  const out = [];

  for (const ev of events) {
    const calMeta = calendarMap[ev.calendarId];
    if (calMeta && !calMeta.visible) continue;
    const color = ev.color || calMeta?.color || 'cyan';
    const exdateSet = new Set(ev.exdates ?? []);
    const overrides = ev.overrides ?? {};

    const startD = parseLocalDate(ev.startDate);
    const endD = parseLocalDate(ev.endDate || ev.startDate);
    const durationDays = Math.max(0, Math.round((endD.getTime() - startD.getTime()) / 86400000));

    if (!ev.recurrence) {
      if (ev.endDate >= rangeStartStr && ev.startDate <= rangeEndStr && !exdateSet.has(ev.startDate)) {
        out.push({
          occurrenceId: `${ev.id}@${ev.startDate}`,
          eventId: ev.id,
          occurrenceDate: ev.startDate,
          calendarId: ev.calendarId,
          title: ev.title,
          location: ev.location,
          description: ev.description,
          allDay: ev.allDay,
          startDate: ev.startDate,
          endDate: ev.endDate || ev.startDate,
          startTime: ev.startTime || '09:00',
          endTime: ev.endTime || '10:00',
          color,
          isRecurring: false,
          kind: 'event',
          rawEvent: ev,
        });
      }
      continue;
    }

    const rec = ev.recurrence;
    const interval = Math.max(1, rec.interval ?? 1);
    const maxCount = rec.count ?? 730;
    const untilStr = rec.until && rec.until < rangeEndStr ? rec.until : rangeEndStr;
    const byDaySet = rec.byDay && rec.byDay.length ? new Set(rec.byDay) : null;

    let count = 0;
    let cursor = new Date(startD.getTime());
    let safety = 0;

    while (safety++ < 1500 && count < maxCount) {
      const occDateStr = formatLocalDate(cursor);
      if (occDateStr > untilStr) break;

      let matches = true;
      if (rec.freq === 'weekly' && byDaySet) {
        const dayCode = DAY_CODES[cursor.getDay()];
        matches = byDaySet.has(dayCode);
      }

      if (matches) {
        count++;
        if (!exdateSet.has(occDateStr)) {
          const ov = overrides[occDateStr] ?? {};
          const effStart = ov.startDate ?? occDateStr;
          const effEnd = ov.endDate ?? formatLocalDate(addDays(parseLocalDate(effStart), durationDays));
          if (effEnd >= rangeStartStr && effStart <= rangeEndStr) {
            out.push({
              occurrenceId: `${ev.id}@${occDateStr}`,
              eventId: ev.id,
              occurrenceDate: occDateStr,
              calendarId: ev.calendarId,
              title: ov.title ?? ev.title,
              location: ov.location ?? ev.location,
              description: ov.description ?? ev.description,
              allDay: ov.allDay ?? ev.allDay,
              startDate: effStart,
              endDate: effEnd,
              startTime: ov.startTime ?? ev.startTime ?? '09:00',
              endTime: ov.endTime ?? ev.endTime ?? '10:00',
              color,
              isRecurring: true,
              kind: 'event',
              rawEvent: ev,
            });
          }
        }
      }

      // Advance cursor
      if (rec.freq === 'daily') {
        cursor = addDays(cursor, interval);
      } else if (rec.freq === 'weekly') {
        if (byDaySet) {
          const nextDay = addDays(cursor, 1);
          // When wrapping past week boundary, jump by (interval - 1) weeks
          if (nextDay.getDay() === 1 && interval > 1) {
            cursor = addDays(nextDay, (interval - 1) * 7);
          } else {
            cursor = nextDay;
          }
        } else {
          cursor = addDays(cursor, interval * 7);
        }
      } else if (rec.freq === 'monthly') {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + interval, cursor.getDate(), 12, 0, 0, 0);
      } else if (rec.freq === 'yearly') {
        cursor = new Date(cursor.getFullYear() + interval, cursor.getMonth(), cursor.getDate(), 12, 0, 0, 0);
      } else {
        break;
      }
    }
  }

  return out.sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Applies a scoped edit to a recurring event:
 * - `'this'`: stores an override for `occurrenceDate` on `event.overrides[occurrenceDate]`
 * - `'following'`: truncates `event.recurrence.until` to the day before `occurrenceDate` and returns a new event starting at `occurrenceDate`
 * - `'all'`: updates `event` in-place
 *
 * @param {CalendarEvent} event
 * @param {string} occurrenceDate
 * @param {Partial<CalendarEvent>} patch
 * @param {'this' | 'following' | 'all'} scope
 * @returns {{ updated: CalendarEvent, created: CalendarEvent | null }}
 */
export function applyRecurringEdit(event, occurrenceDate, patch, scope) {
  const now = Date.now();
  if (!event.recurrence || scope === 'all') {
    return {
      updated: {
        ...event,
        ...patch,
        updatedAt: now,
      },
      created: null,
    };
  }

  if (scope === 'this') {
    const overrides = { ...(event.overrides ?? {}) };
    overrides[occurrenceDate] = {
      ...(overrides[occurrenceDate] ?? {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
      ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
      ...(patch.startTime !== undefined ? { startTime: patch.startTime } : {}),
      ...(patch.endTime !== undefined ? { endTime: patch.endTime } : {}),
      ...(patch.allDay !== undefined ? { allDay: patch.allDay } : {}),
    };
    return {
      updated: { ...event, overrides, updatedAt: now },
      created: null,
    };
  }

  // scope === 'following'
  const prevDay = formatLocalDate(addDays(parseLocalDate(occurrenceDate), -1));
  const updated = {
    ...event,
    recurrence: {
      ...event.recurrence,
      until: prevDay,
    },
    updatedAt: now,
  };
  /** @type {CalendarEvent} */
  const created = {
    ...event,
    ...patch,
    id: crypto.randomUUID(),
    startDate: patch.startDate ?? occurrenceDate,
    endDate: patch.endDate ?? occurrenceDate,
    exdates: [],
    overrides: {},
    createdAt: now,
    updatedAt: now,
  };
  return { updated, created };
}

/**
 * Deletes a single occurrence or following occurrences of a recurring event.
 * @param {CalendarEvent} event
 * @param {string} occurrenceDate
 * @param {'this' | 'following'} scope
 * @returns {CalendarEvent}
 */
export function deleteRecurringOccurrence(event, occurrenceDate, scope) {
  const now = Date.now();
  if (scope === 'this' || !event.recurrence) {
    const exdates = Array.from(new Set([...(event.exdates ?? []), occurrenceDate]));
    return { ...event, exdates, updatedAt: now };
  }
  const prevDay = formatLocalDate(addDays(parseLocalDate(occurrenceDate), -1));
  return {
    ...event,
    recurrence: {
      ...event.recurrence,
      until: prevDay,
    },
    updatedAt: now,
  };
}

/**
 * Unescapes RFC 5545 text values.
 * @param {string} val
 * @returns {string}
 */
function unescapeICSText(val) {
  return val.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/**
 * Escapes RFC 5545 text values.
 * @param {string} val
 * @returns {string}
 */
function escapeICSText(val) {
  return String(val ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Parses an RFC 5545 date or date-time token (`20260515` or `20260515T143000` or `20260515T143000Z`).
 * @param {string} raw
 * @returns {{ date: string, time: string, allDay: boolean }}
 */
function parseICSDateTime(raw) {
  const clean = raw.trim();
  if (/^\d{8}$/.test(clean)) {
    const date = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    return { date, time: '09:00', allDay: true };
  }
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (m) {
    if (m[7] === 'Z') {
      const utc = new Date(
        Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || '0')),
      );
      return {
        date: formatLocalDate(utc),
        time: `${String(utc.getHours()).padStart(2, '0')}:${String(utc.getMinutes()).padStart(2, '0')}`,
        allDay: false,
      };
    }
    return {
      date: `${m[1]}-${m[2]}-${m[3]}`,
      time: `${m[4]}:${m[5]}`,
      allDay: false,
    };
  }
  return { date: formatLocalDate(new Date()), time: '09:00', allDay: false };
}

/**
 * Parses an RFC 5545 `.ics` string into `CalendarEvent` objects (VEVENT, RRULE, EXDATE, VALARM).
 * @param {string} icsText
 * @param {string} [defaultCalendarId='personal']
 * @returns {CalendarEvent[]}
 */
export function parseICS(icsText, defaultCalendarId = 'personal') {
  // Unfold lines per RFC 5545 §3.1
  const unfolded = String(icsText ?? '').replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  /** @type {CalendarEvent[]} */
  const events = [];
  /** @type {Partial<CalendarEvent> | null} */
  let cur = null;
  let inAlarm = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      const today = formatLocalDate(new Date());
      cur = {
        id: crypto.randomUUID(),
        calendarId: defaultCalendarId,
        title: 'Untitled Event',
        location: '',
        description: '',
        allDay: false,
        startDate: today,
        endDate: today,
        startTime: '09:00',
        endTime: '10:00',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
        recurrence: null,
        exdates: [],
        overrides: {},
        reminders: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      inAlarm = false;
      continue;
    }

    if (line.toUpperCase() === 'END:VEVENT') {
      if (cur) {
        events.push(/** @type {CalendarEvent} */ (cur));
      }
      cur = null;
      inAlarm = false;
      continue;
    }

    if (!cur) continue;

    if (line.toUpperCase() === 'BEGIN:VALARM') {
      inAlarm = true;
      continue;
    }
    if (line.toUpperCase() === 'END:VALARM') {
      inAlarm = false;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const propPart = line.slice(0, colonIdx);
    const valPart = line.slice(colonIdx + 1);
    const [propName, ...params] = propPart.split(';');
    const upperName = propName.toUpperCase();

    if (inAlarm) {
      if (upperName === 'TRIGGER') {
        const trig = valPart.trim().toUpperCase();
        const mMin = trig.match(/-PT(\d+)M/);
        const mHour = trig.match(/-PT(\d+)H/);
        const mDay = trig.match(/-P(\d+)D/);
        if (mMin) cur.reminders?.push(Number.parseInt(mMin[1], 10));
        else if (mHour) cur.reminders?.push(Number.parseInt(mHour[1], 10) * 60);
        else if (mDay) cur.reminders?.push(Number.parseInt(mDay[1], 10) * 1440);
      }
      continue;
    }

    if (upperName === 'UID' && valPart.trim()) {
      cur.id = valPart.trim();
    } else if (upperName === 'SUMMARY') {
      cur.title = unescapeICSText(valPart);
    } else if (upperName === 'DESCRIPTION') {
      cur.description = unescapeICSText(valPart);
    } else if (upperName === 'LOCATION') {
      cur.location = unescapeICSText(valPart);
    } else if (upperName === 'DTSTART') {
      const parsed = parseICSDateTime(valPart);
      const isDateParam = params.some((p) => p.toUpperCase() === 'VALUE=DATE');
      cur.startDate = parsed.date;
      cur.startTime = parsed.time;
      cur.allDay = parsed.allDay || isDateParam;
      const tzParam = params.find((p) => p.toUpperCase().startsWith('TZID='));
      if (tzParam) cur.timeZone = tzParam.slice(5);
    } else if (upperName === 'DTEND') {
      const parsed = parseICSDateTime(valPart);
      const isDateParam = params.some((p) => p.toUpperCase() === 'VALUE=DATE');
      if (parsed.allDay || isDateParam) {
        // RFC 5545 all-day DTEND is exclusive; subtract 1 day for inclusive endDate
        const endExclusive = parseLocalDate(parsed.date);
        const inclusive = formatLocalDate(addDays(endExclusive, -1));
        cur.endDate = inclusive >= (cur.startDate ?? inclusive) ? inclusive : cur.startDate;
      } else {
        cur.endDate = parsed.date;
        cur.endTime = parsed.time;
      }
    } else if (upperName === 'RRULE') {
      /** @type {Record<string, string>} */
      const parts = {};
      for (const kv of valPart.split(';')) {
        const [k, v] = kv.split('=');
        if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
      }
      const freqMap = /** @type {const} */ ({
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        YEARLY: 'yearly',
      });
      const freq = freqMap[/** @type {keyof typeof freqMap} */ (parts.FREQ)];
      if (freq) {
        /** @type {CalendarRecurrence} */
        const rec = { freq };
        if (parts.INTERVAL) rec.interval = Math.max(1, Number.parseInt(parts.INTERVAL, 10) || 1);
        if (parts.BYDAY) rec.byDay = parts.BYDAY.split(',').map((s) => s.trim());
        if (parts.COUNT) rec.count = Number.parseInt(parts.COUNT, 10);
        if (parts.UNTIL) {
          const u = parseICSDateTime(parts.UNTIL);
          rec.until = u.date;
        }
        cur.recurrence = rec;
      }
    } else if (upperName === 'EXDATE') {
      for (const token of valPart.split(',')) {
        const p = parseICSDateTime(token);
        cur.exdates?.push(p.date);
      }
    }
  }

  return events;
}

/**
 * Formats a local date (`YYYY-MM-DD`) and time (`HH:MM`) as RFC 5545 token.
 * @param {string} dateStr
 * @param {string} [timeStr]
 * @param {boolean} [allDay]
 * @returns {string}
 */
function formatICSDateTime(dateStr, timeStr = '09:00', allDay = false) {
  const ymd = dateStr.replace(/-/g, '');
  if (allDay) return ymd;
  const hm = (timeStr || '09:00').replace(/:/g, '').padEnd(4, '0').slice(0, 4);
  return `${ymd}T${hm}00`;
}

/**
 * Serializes `CalendarEvent[]` into an RFC 5545 `.ics` calendar string.
 * @param {CalendarEvent[]} events
 * @returns {string}
 */
export function serializeICS(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nexus Arcade OS//Nexus Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}`);
    lines.push(`SUMMARY:${escapeICSText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICSText(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICSText(ev.location)}`);

    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatICSDateTime(ev.startDate, '00:00', true)}`);
      const exclusiveEnd = formatLocalDate(addDays(parseLocalDate(ev.endDate || ev.startDate), 1));
      lines.push(`DTEND;VALUE=DATE:${formatICSDateTime(exclusiveEnd, '00:00', true)}`);
    } else {
      lines.push(`DTSTART:${formatICSDateTime(ev.startDate, ev.startTime, false)}`);
      lines.push(`DTEND:${formatICSDateTime(ev.endDate || ev.startDate, ev.endTime, false)}`);
    }

    if (ev.recurrence) {
      const rparts = [`FREQ=${ev.recurrence.freq.toUpperCase()}`];
      if (ev.recurrence.interval && ev.recurrence.interval > 1) {
        rparts.push(`INTERVAL=${ev.recurrence.interval}`);
      }
      if (ev.recurrence.byDay && ev.recurrence.byDay.length) {
        rparts.push(`BYDAY=${ev.recurrence.byDay.join(',')}`);
      }
      if (ev.recurrence.until) {
        rparts.push(`UNTIL=${formatICSDateTime(ev.recurrence.until, '23:59', false)}`);
      }
      if (ev.recurrence.count) {
        rparts.push(`COUNT=${ev.recurrence.count}`);
      }
      lines.push(`RRULE:${rparts.join(';')}`);
    }

    if (ev.exdates && ev.exdates.length) {
      const formattedEx = ev.exdates.map((d) =>
        ev.allDay ? formatICSDateTime(d, '00:00', true) : formatICSDateTime(d, ev.startTime, false),
      );
      lines.push(`EXDATE${ev.allDay ? ';VALUE=DATE' : ''}:${formattedEx.join(',')}`);
    }

    for (const remMin of ev.reminders ?? []) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeICSText(ev.title)}`);
      lines.push(`TRIGGER:-PT${Math.max(1, remMin)}M`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Natural-language quick add parser for calendar events in EN & DE.
 * Example: `"Lunch with Max tomorrow 12:30-13:30 @Mensa"` or `"Vorlesung morgen 14:00"`
 * @param {string} rawInput
 * @param {Date} [now]
 */
export function parseEventQuickAdd(rawInput, now = new Date()) {
  let working = String(rawInput ?? '').trim();
  let startDate = formatLocalDate(now);
  let startTime = '09:00';
  let endTime = '10:00';
  let allDay = false;
  let location = '';

  // Extract `@location` at end
  const locMatch = working.match(/\s+@([^@#]+)$/);
  if (locMatch) {
    location = locMatch[1].trim();
    working = working.slice(0, locMatch.index).trim();
  }

  // Time range `12:30-14:00` or single time `14:00` / `14 Uhr`
  const rangeMatch = working.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/);
  if (rangeMatch) {
    startTime = `${rangeMatch[1].padStart(2, '0')}:${rangeMatch[2]}`;
    endTime = `${rangeMatch[3].padStart(2, '0')}:${rangeMatch[4]}`;
    working = working.replace(rangeMatch[0], ' ');
  } else {
    const timeMatch = working.match(/(?:^|\s)([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:uhr|h|am|pm)?(?=\s|$)/i);
    if (timeMatch && (timeMatch[2] !== undefined || /uhr|am|pm/i.test(timeMatch[0]))) {
      let hr = Number.parseInt(timeMatch[1], 10);
      const min = timeMatch[2] ? Number.parseInt(timeMatch[2], 10) : 0;
      if (/pm/i.test(timeMatch[0]) && hr < 12) hr += 12;
      startTime = `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const endHr = Math.min(23, hr + 1);
      endTime = `${String(endHr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      working = working.replace(timeMatch[0], ' ');
    }
  }

  // Relative date tokens
  const datePatterns = [
    { re: /(?:^|\s)(today|heute)(?=\s|$)/i, offset: 0 },
    { re: /(?:^|\s)(tomorrow|morgen)(?=\s|$)/i, offset: 1 },
    { re: /(?:^|\s)(übermorgen|day after tomorrow)(?=\s|$)/i, offset: 2 },
  ];
  for (const dp of datePatterns) {
    const m = working.match(dp.re);
    if (m) {
      startDate = formatLocalDate(addDays(now, dp.offset));
      working = working.replace(m[0], ' ');
      break;
    }
  }

  const weekdayMap = /** @type {Record<string, number>} */ ({
    sunday: 0,
    sonntag: 0,
    monday: 1,
    montag: 1,
    tuesday: 2,
    dienstag: 2,
    wednesday: 3,
    mittwoch: 3,
    thursday: 4,
    donnerstag: 4,
    friday: 5,
    freitag: 5,
    saturday: 6,
    samstag: 6,
  });
  const wdRe =
    /(?:^|\s)(sunday|sonntag|monday|montag|tuesday|dienstag|wednesday|mittwoch|thursday|donnerstag|friday|freitag|saturday|samstag)(?=\s|$)/i;
  const wdMatch = working.match(wdRe);
  if (wdMatch) {
    const targetDow = weekdayMap[wdMatch[1].toLowerCase()];
    const curDow = now.getDay();
    let delta = (targetDow - curDow + 7) % 7;
    if (delta === 0) delta = 7;
    startDate = formatLocalDate(addDays(now, delta));
    working = working.replace(wdMatch[0], ' ');
  }

  const isoMatch = working.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/);
  if (isoMatch) {
    startDate = isoMatch[1];
    working = working.replace(isoMatch[0], ' ');
  }

  const title = working.replace(/\s+/g, ' ').trim() || 'New Event';
  return {
    title,
    startDate,
    endDate: startDate,
    startTime,
    endTime,
    allDay,
    location,
  };
}
