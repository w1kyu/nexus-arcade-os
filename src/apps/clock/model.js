// @ts-check
// Clock model: World clock with Intl time zones, meeting overlap planner,
// stopwatch lap calculations, and multi-timer state.

/**
 * @typedef {object} WorldCity
 * @property {string} id
 * @property {string} name
 * @property {string} country
 * @property {string} timeZone
 */

export const DEFAULT_CITIES = /** @type {WorldCity[]} */ ([
  { id: 'berlin', name: 'Berlin', country: 'Germany', timeZone: 'Europe/Berlin' },
  { id: 'london', name: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
  { id: 'new_york', name: 'New York', country: 'United States', timeZone: 'America/New_York' },
  { id: 'san_francisco', name: 'San Francisco', country: 'United States', timeZone: 'America/Los_Angeles' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo' },
  { id: 'sydney', name: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney' },
  { id: 'dubai', name: 'Dubai', country: 'UAE', timeZone: 'Asia/Dubai' },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', timeZone: 'Asia/Singapore' },
]);

/**
 * Formats time for a given time zone.
 * @param {Date} date
 * @param {string} timeZone
 * @param {string} [locale]
 * @returns {{ timeStr: string, dateStr: string, hour: number, minute: number, second: number }}
 */
export function getCityTime(date, timeZone, locale = 'en-US') {
  try {
    const timeFmt = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const dateFmt = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const parts = timeFmt.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);

    return {
      timeStr: timeFmt.format(date),
      dateStr: dateFmt.format(date),
      hour,
      minute,
      second,
    };
  } catch {
    return {
      timeStr: date.toISOString().slice(11, 19),
      dateStr: date.toISOString().slice(0, 10),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }
}

/**
 * Multi-city time zone meeting planner.
 * Calculates for each of the 24 hours of a reference date the local hour in each selected city,
 * and identifies hours where all participants are within acceptable hours (e.g. 08:00 - 20:00).
 * @param {string[]} timeZones
 * @param {Date} [baseDate]
 * @param {{ workStart?: number, workEnd?: number }} [options]
 * @returns {Array<{ utcHour: number, cityHours: Record<string, number>, isIdeal: boolean }>}
 */
export function planMeetingOverlap(timeZones, baseDate = new Date(), { workStart = 9, workEnd = 18 } = {}) {
  const result = [];
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  for (let h = 0; h < 24; h++) {
    const testDate = new Date(Date.UTC(year, month, day, h, 0, 0));
    /** @type {Record<string, number>} */
    const cityHours = {};
    let allInWorkHours = true;

    for (const tz of timeZones) {
      const { hour } = getCityTime(testDate, tz);
      cityHours[tz] = hour;
      if (hour < workStart || hour >= workEnd) {
        allInWorkHours = false;
      }
    }

    result.push({
      utcHour: h,
      cityHours,
      isIdeal: allInWorkHours,
    });
  }

  return result;
}

/**
 * Formats stopwatch milliseconds into MM:SS.cc.
 * @param {number} ms
 * @returns {string}
 */
export function formatStopwatchTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/**
 * Exports stopwatch laps to formatted text.
 * @param {Array<{ lapIndex: number, lapTimeMs: number, overallTimeMs: number }>} laps
 * @returns {string}
 */
export function exportLapsText(laps) {
  const lines = ['# Lap,Lap Time,Total Time'];
  for (const lap of laps) {
    lines.push(`Lap ${lap.lapIndex},${formatStopwatchTime(lap.lapTimeMs)},${formatStopwatchTime(lap.overallTimeMs)}`);
  }
  return lines.join('\n');
}
