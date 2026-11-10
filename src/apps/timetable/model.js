// @ts-check
// Timetable model: course scheduling, semester periods, biweekly A/B calculations,
// Now & Next detection, attendance stats, and RFC 5545 .ics / JSON import & export.

/**
 * @typedef {'lecture' | 'tutorial' | 'lab' | 'seminar' | 'other'} CourseType
 */

/**
 * @typedef {'all' | 'A' | 'B'} WeekRecurrence
 */

/**
 * @typedef {object} Semester
 * @property {string} id
 * @property {string} name               e.g. 'Wintersemester 2026/27'
 * @property {string} startDate          'YYYY-MM-DD'
 * @property {string} endDate            'YYYY-MM-DD'
 * @property {string} [lectureStartDate] 'YYYY-MM-DD'
 * @property {string} [lectureEndDate]   'YYYY-MM-DD'
 * @property {boolean} active
 * @property {boolean} archived
 */

/**
 * @typedef {object} Course
 * @property {string} id
 * @property {string} semesterId
 * @property {string} name
 * @property {string} [code]             e.g. 'IN101'
 * @property {CourseType} type
 * @property {string} lecturer
 * @property {string} room
 * @property {string} color              e.g. 'cyan', 'emerald', 'amber', 'purple', 'rose', 'blue'
 * @property {number} dayOfWeek          1 = Monday, 2 = Tuesday, ..., 5 = Friday, 6 = Saturday, 0 = Sunday
 * @property {string} startTime          'HH:MM'
 * @property {string} endTime            'HH:MM'
 * @property {WeekRecurrence} weekType   'all' | 'A' | 'B'
 * @property {string} [notesFolder]      VFS path
 * @property {string} [tasksProjectId]
 * @property {string} [flashcardDeckId]
 */

/**
 * @typedef {object} AttendanceRecord
 * @property {string} id
 * @property {string} courseId
 * @property {string} date               'YYYY-MM-DD'
 * @property {'attended' | 'cancelled' | 'absent'} status
 * @property {string} [note]             e.g. 'Moved to Room C 104'
 */

export const COURSE_TYPES = /** @type {const} */ (['lecture', 'tutorial', 'lab', 'seminar', 'other']);
export const COURSE_COLORS = /** @type {const} */ (['cyan', 'emerald', 'amber', 'purple', 'rose', 'blue', 'orange']);

/**
 * Computes whether a given date is in Week 'A' or Week 'B' relative to reference start date.
 * @param {Date} date
 * @param {string} [referenceDateStr]
 * @param {'A' | 'B'} [referenceWeek]
 * @returns {'A' | 'B'}
 */
export function getBiweeklyWeekType(date, referenceDateStr = '2026-10-01', referenceWeek = 'A') {
  const [ry, rm, rd] = referenceDateStr.split('-').map((n) => Number.parseInt(n, 10));
  const ref = new Date(ry, (rm || 1) - 1, rd || 1, 12, 0, 0);
  const diffDays = Math.floor((date.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000));
  const diffWeeks = Math.floor(diffDays / 7);
  const isAlt = Math.abs(diffWeeks) % 2 === 1;
  if (!isAlt) return referenceWeek;
  return referenceWeek === 'A' ? 'B' : 'A';
}

/**
 * Checks if a course is active during the current week type ('A' or 'B').
 * @param {Course} course
 * @param {'A' | 'B'} currentWeekType
 * @returns {boolean}
 */
export function isCourseActiveThisWeek(course, currentWeekType) {
  if (!course.weekType || course.weekType === 'all') return true;
  return course.weekType === currentWeekType;
}

/**
 * Formats time in minutes from midnight for sorting/comparison.
 * @param {string} timeStr 'HH:MM'
 * @returns {number}
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((n) => Number.parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * Computes Now & Next courses for a list of courses and current timestamp.
 * @param {Course[]} courses
 * @param {Date} [now]
 * @param {'A' | 'B'} [currentWeekType]
 * @returns {{ current: Course | null, next: Course | null, minutesToNext: number | null }}
 */
export function computeNowAndNext(courses, now = new Date(), currentWeekType = 'A') {
  const currentDow = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const activeToday = courses.filter((c) => c.dayOfWeek === currentDow && isCourseActiveThisWeek(c, currentWeekType));

  activeToday.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  let current = null;
  let next = null;
  let minutesToNext = null;

  for (const c of activeToday) {
    const startM = timeToMinutes(c.startTime);
    const endM = timeToMinutes(c.endTime);
    if (currentMinutes >= startM && currentMinutes < endM) {
      current = c;
    } else if (startM > currentMinutes && !next) {
      next = c;
      minutesToNext = startM - currentMinutes;
    }
  }

  // If no next today, check upcoming days
  if (!next) {
    for (let offset = 1; offset <= 7; offset++) {
      const targetDow = (currentDow + offset) % 7;
      const targetWeek = getBiweeklyWeekType(new Date(now.getTime() + offset * 86400000));
      const candidates = courses
        .filter((c) => c.dayOfWeek === targetDow && isCourseActiveThisWeek(c, targetWeek))
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      if (candidates.length > 0) {
        next = candidates[0];
        minutesToNext = offset * 24 * 60 - currentMinutes + timeToMinutes(next.startTime);
        break;
      }
    }
  }

  return { current, next, minutesToNext };
}

/**
 * Generates an iCalendar (RFC 5545) representation of courses.
 * @param {Course[]} courses
 * @param {Semester} [semester]
 * @returns {string}
 */
export function exportTimetableToICS(courses, semester) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nexus Arcade OS//Nexus Timetable 1.0//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${semester?.name || 'Nexus Timetable'}`,
  ];

  const DOW_MAP = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const semStart = semester?.startDate || new Date().toISOString().split('T')[0];
  const semEnd = semester?.endDate || '2027-04-01';

  for (const c of courses) {
    const startClean = (c.startTime || '08:00').replace(':', '') + '00';
    const endClean = (c.endTime || '09:30').replace(':', '') + '00';
    const untilClean = semEnd.replace(/-/g, '') + 'T235959Z';
    const interval = c.weekType && c.weekType !== 'all' ? ';INTERVAL=2' : '';
    const byDay = DOW_MAP[c.dayOfWeek];

    lines.push(
      'BEGIN:VEVENT',
      `UID:nexus-tt-${c.id}@nexus-os`,
      `DTSTAMP:${nowStamp}`,
      `SUMMARY:${c.name}${c.code ? ` (${c.code})` : ''}`,
      `DESCRIPTION:${c.type.toUpperCase()} - ${c.lecturer || 'Lecturer'}`,
      `LOCATION:${c.room || ''}`,
      `DTSTART;TZID=Europe/Berlin:${semStart.replace(/-/g, '')}T${startClean}`,
      `DTEND;TZID=Europe/Berlin:${semStart.replace(/-/g, '')}T${endClean}`,
      `RRULE:FREQ=WEEKLY${interval};BYDAY=${byDay};UNTIL=${untilClean}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Creates JSON export of semester and courses.
 * @param {Semester} semester
 * @param {Course[]} courses
 * @returns {string}
 */
export function exportTimetableToJSON(semester, courses) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: Date.now(),
      semester,
      courses,
    },
    null,
    2,
  );
}

/**
 * Parses a JSON export of timetable.
 * @param {string} jsonStr
 * @returns {{ semester: Semester | null, courses: Course[] }}
 */
export function parseTimetableJSON(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    const semester = parsed.semester || null;
    const courses = Array.isArray(parsed.courses) ? parsed.courses : [];
    return { semester, courses };
  } catch {
    return { semester: null, courses: [] };
  }
}
