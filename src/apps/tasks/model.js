// @ts-check
// Pure logic for Nexus Tasks (4.2): bilingual (EN + DE) natural-language quick-add parser,
// recurrence helpers, task filtering/grouping, and productivity statistics.

/**
 * @typedef {1 | 2 | 3 | 4} TaskPriority  1 = Urgent/Highest, 2 = High, 3 = Medium, 4 = Low/None
 */

/**
 * @typedef {object} Subtask
 * @property {string} id
 * @property {string} title
 * @property {boolean} done
 */

/**
 * @typedef {object} TaskItem
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} projectId          'inbox' or a Project.id
 * @property {string} sectionId          '' or a Section.id
 * @property {string} status             Kanban column id ('todo' | 'doing' | 'done' or custom)
 * @property {TaskPriority} priority     1 (highest) .. 4 (low)
 * @property {string | null} dueDate     'YYYY-MM-DD' or null
 * @property {string | null} dueTime     'HH:MM' or null
 * @property {string | null} startDate   'YYYY-MM-DD' or null
 * @property {string[]} tags
 * @property {Subtask[]} subtasks
 * @property {number} estimateMinutes    estimated duration in minutes (0 = none)
 * @property {number} trackedMinutes     logged focus/work time in minutes
 * @property {string[]} attachments      VFS file paths
 * @property {string[]} noteLinks        VFS note paths or note titles
 * @property {{ freq: 'daily' | 'weekly' | 'monthly' | 'yearly', interval?: number, byWeekday?: number[] } | null} recurrence
 * @property {number | null} reminderMinutesBefore  e.g. 0 (at due time), 15, 60
 * @property {string | null} schedulerJobId
 * @property {boolean} completed
 * @property {number | null} completedAt timestamp
 * @property {number} createdAt          timestamp
 * @property {number} updatedAt          timestamp
 * @property {number} order
 */

/**
 * @typedef {object} TaskProject
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {string} icon
 * @property {{ id: string, name: string }[]} sections
 * @property {{ id: string, title: string, wipLimit: number }[]} columns
 * @property {number} createdAt
 */

/**
 * @typedef {object} QuickAddParseResult
 * @property {string} title
 * @property {string | null} dueDate
 * @property {string | null} dueTime
 * @property {TaskPriority} priority
 * @property {string[]} tags
 * @property {string | null} projectHint
 * @property { number } estimateMinutes
 * @property {{ freq: 'daily' | 'weekly' | 'monthly' | 'yearly', interval: number } | null} recurrence
 */

const WEEKDAYS_EN = /** @type {Record<string, number>} */ ({
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
});

const WEEKDAYS_DE = /** @type {Record<string, number>} */ ({
  sonntag: 0,
  so: 0,
  montag: 1,
  mo: 1,
  dienstag: 2,
  di: 2,
  mittwoch: 3,
  mi: 3,
  donnerstag: 4,
  do: 4,
  freitag: 5,
  fr: 5,
  samstag: 6,
  sa: 6,
  sonnabend: 6,
});

/**
 * Formats a local `Date` as `YYYY-MM-DD`.
 * @param {Date} d
 */
export function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Adds `days` to a local date.
 * @param {Date} base
 * @param {number} days
 */
export function addDays(base, days) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

/**
 * Parses a natural-language task input in English or German.
 * Examples:
 * - `"Prepare presentation tomorrow 14:00 #uni !high ~45m"`
 * - `"Präsentation vorbereiten morgen 14 Uhr #uni !hoch"`
 * - `"Submit report next monday at 9:30am @Work !p1 every week"`
 * @param {string} raw
 * @param {Date} [now]
 * @returns {QuickAddParseResult}
 */
export function parseQuickAdd(raw, now = new Date()) {
  let working = String(raw ?? '').trim();
  /** @type {string[]} */
  const tags = [];
  /** @type {TaskPriority} */
  let priority = 4;
  /** @type {string | null} */
  let dueDate = null;
  /** @type {string | null} */
  let dueTime = null;
  /** @type {string | null} */
  let projectHint = null;
  let estimateMinutes = 0;
  /** @type {{ freq: 'daily' | 'weekly' | 'monthly' | 'yearly', interval: number } | null} */
  let recurrence = null;

  // 1. Extract #tags
  working = working.replace(/(?:^|\s)#([a-zA-Z0-9_\u00C0-\u024F/-]+)/g, (_, tag) => {
    const clean = tag.toLowerCase();
    if (!tags.includes(clean)) tags.push(clean);
    return ' ';
  });

  // 2. Extract @projectHint
  working = working.replace(/(?:^|\s)@([a-zA-Z0-9_\u00C0-\u024F-]+)/g, (_, proj) => {
    projectHint = proj;
    return ' ';
  });

  // 3. Extract estimate `~30m`, `~2h`
  working = working.replace(/(?:^|\s)~(\d+)\s*(h|hr|hrs|std|m|min|mins)\b/i, (_, num, unit) => {
    const n = Number(num);
    estimateMinutes = /^h|std/i.test(unit) ? n * 60 : n;
    return ' ';
  });

  // 4. Extract !priority (EN + DE: !urgent, !dringend, !p1, !1, !high, !hoch, !p2, !2, !medium, !mittel, !p3, !3, !low, !niedrig, !p4, !4)
  working = working.replace(
    /(?:^|\s)!(urgent|dringend|kritisch|p1|1|high|hoch|wichtig|p2|2|medium|med|mittel|normal|p3|3|low|niedrig|p4|4)\b/gi,
    (_, p) => {
      const k = p.toLowerCase();
      if (['urgent', 'dringend', 'kritisch', 'p1', '1'].includes(k)) priority = 1;
      else if (['high', 'hoch', 'wichtig', 'p2', '2'].includes(k)) priority = 2;
      else if (['medium', 'med', 'mittel', 'normal', 'p3', '3'].includes(k)) priority = 3;
      else priority = 4;
      return ' ';
    },
  );

  // 5. Extract recurrence (EN + DE: "every day/week/month/year", "daily", "weekly", "täglich", "wöchentlich", "monatlich", "jährlich", "jeden tag/montag...")
  const explicitRecurrenceRe =
    /\b(every\s+(?:(\d+)\s+)?(day|days|week|weeks|month|months|year|years)|alle\s+(\d+)\s+(tage|wochen|monate|jahre)|jeden\s+(tag|woche|monat|jahr))\b/i;
  const wordRecurrenceRe =
    /(?:^|\s)(daily|weekly|monthly|yearly|täglich|taeglich|wöchentlich|woechentlich|monatlich|jährlich|jaehrlich)(?=\s|$)/i;
  working = working.replace(
    explicitRecurrenceRe.test(working) ? explicitRecurrenceRe : wordRecurrenceRe,
    (m, full, enInt, enUnit, deInt, deUnit, deSingle) => {
      const low = full.toLowerCase();
      if (low === 'daily' || low === 'täglich' || low === 'taeglich' || deSingle?.toLowerCase() === 'tag') {
        recurrence = { freq: 'daily', interval: 1 };
      } else if (
        low === 'weekly' ||
        low === 'wöchentlich' ||
        low === 'woechentlich' ||
        deSingle?.toLowerCase() === 'woche'
      ) {
        recurrence = { freq: 'weekly', interval: 1 };
      } else if (low === 'monthly' || low === 'monatlich' || deSingle?.toLowerCase() === 'monat') {
        recurrence = { freq: 'monthly', interval: 1 };
      } else if (low === 'yearly' || low === 'jährlich' || low === 'jaehrlich' || deSingle?.toLowerCase() === 'jahr') {
        recurrence = { freq: 'yearly', interval: 1 };
      } else if (enUnit) {
        const interval = enInt ? Number(enInt) : 1;
        const u = enUnit.toLowerCase();
        recurrence = {
          freq: u.startsWith('day')
            ? 'daily'
            : u.startsWith('week')
              ? 'weekly'
              : u.startsWith('month')
                ? 'monthly'
                : 'yearly',
          interval,
        };
      } else if (deUnit) {
        const interval = deInt ? Number(deInt) : 1;
        const u = deUnit.toLowerCase();
        recurrence = {
          freq: u.startsWith('tag')
            ? 'daily'
            : u.startsWith('woch')
              ? 'weekly'
              : u.startsWith('monat')
                ? 'monthly'
                : 'yearly',
          interval,
        };
      }
      return ' ';
    },
  );

  // 6. Extract explicit ISO date `YYYY-MM-DD` or German `DD.MM.YYYY` / `DD.MM.`
  working = working.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/, (m, y, mo, d) => {
    dueDate = `${y}-${mo}-${d}`;
    return ' ';
  });
  if (!dueDate) {
    working = working.replace(/\b(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2}))?(?=\s|$)/, (m, d, mo, y) => {
      const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : now.getFullYear();
      dueDate = `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return ' ';
    });
  }

  // 7. Extract relative dates (EN + DE: today/heute, tomorrow/morgen, day after tomorrow/übermorgen, in N days/in N tagen, next <weekday>/nächsten <weekday> or standalone weekday)
  if (!dueDate) {
    working = working.replace(
      /\b(day after tomorrow|übermorgen|uebermorgen|tomorrow|morgen|today|heute|in\s+(\d+)\s+(?:days?|tagen?))\b/i,
      (m, kw, inDays) => {
        const low = kw.toLowerCase();
        if (inDays) {
          dueDate = formatLocalDate(addDays(now, Number(inDays)));
        } else if (low === 'today' || low === 'heute') {
          dueDate = formatLocalDate(now);
        } else if (low === 'tomorrow' || low === 'morgen') {
          dueDate = formatLocalDate(addDays(now, 1));
        } else {
          dueDate = formatLocalDate(addDays(now, 2));
        }
        return ' ';
      },
    );
  }

  if (!dueDate) {
    working = working.replace(
      /\b(?:(next|nächsten|naechsten|nächster|naechster|am)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend)\b/i,
      (m, prefix, dayName) => {
        const low = dayName.toLowerCase();
        const targetDow = WEEKDAYS_EN[low] ?? WEEKDAYS_DE[low];
        if (targetDow === undefined) return m;
        let diff = (targetDow - now.getDay() + 7) % 7;
        if (diff === 0 || (prefix && /^(next|näch|naech)/i.test(prefix) && diff === 0)) diff = 7;
        dueDate = formatLocalDate(addDays(now, diff));
        return ' ';
      },
    );
  }

  // 8. Extract time (EN + DE):
  //    - `at 14:30`, `um 14:30 Uhr`, `14:00 Uhr`, `14:00`, `14 Uhr`, `2pm`, `2:30pm`
  working = working.replace(/\b(?:(?:at|um)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|uhr)\b/i, (m, rawH, rawM, suffix) => {
    let h = Number(rawH);
    const min = rawM ? Number(rawM) : 0;
    const suf = suffix.toLowerCase();
    if (suf === 'pm' && h < 12) h += 12;
    if (suf === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      dueTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      return ' ';
    }
    return m;
  });
  if (!dueTime) {
    working = working.replace(/\b(?:(?:at|um)\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m, rawH, rawM) => {
      dueTime = `${String(rawH).padStart(2, '0')}:${rawM}`;
      return ' ';
    });
  }

  // If a time was specified without a date, default dueDate to today.
  if (dueTime && !dueDate) {
    dueDate = formatLocalDate(now);
  }

  const title = working.replace(/\s+/g, ' ').trim();
  return {
    title: title || String(raw ?? '').trim(),
    dueDate,
    dueTime,
    priority,
    tags,
    projectHint,
    estimateMinutes,
    recurrence,
  };
}

/**
 * Computes the next due date (`YYYY-MM-DD`) when a recurring task is completed.
 * @param {string | null} currentDueDate
 * @param {{ freq: 'daily' | 'weekly' | 'monthly' | 'yearly', interval?: number }} rule
 * @param {Date} [now]
 * @returns {string}
 */
export function nextTaskDueDate(currentDueDate, rule, now = new Date()) {
  const base = currentDueDate ? new Date(`${currentDueDate}T12:00:00`) : now;
  const interval = Math.max(1, rule.interval ?? 1);
  const next = new Date(base.getTime());
  if (rule.freq === 'daily') next.setDate(next.getDate() + interval);
  else if (rule.freq === 'weekly') next.setDate(next.getDate() + interval * 7);
  else if (rule.freq === 'monthly') next.setMonth(next.getMonth() + interval);
  else if (rule.freq === 'yearly') next.setFullYear(next.getFullYear() + interval);
  return formatLocalDate(next);
}

/**
 * Computes task statistics: completed per day (last 7 days), streak, average completion time (hours),
 * overdue rate, and tracked minutes per project.
 * @param {TaskItem[]} tasks
 * @param {Date} [now]
 */
export function computeTaskStats(tasks, now = new Date()) {
  const todayStr = formatLocalDate(now);
  /** @type {{ date: string, count: number }[]} */
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const dStr = formatLocalDate(addDays(now, -i));
    const count = tasks.filter(
      (t) => t.completed && t.completedAt && formatLocalDate(new Date(t.completedAt)) === dStr,
    ).length;
    last7Days.push({ date: dStr, count });
  }

  // Streak: consecutive days ending today (or yesterday) with at least 1 completed task
  const completedDays = new Set(
    tasks
      .filter((t) => t.completed && t.completedAt)
      .map((t) => formatLocalDate(new Date(/** @type {number} */ (t.completedAt)))),
  );
  let streak = 0;
  let cursor = completedDays.has(todayStr) ? now : addDays(now, -1);
  while (completedDays.has(formatLocalDate(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const completedWithTimes = tasks.filter(
    (t) => t.completed && t.completedAt && t.createdAt && t.completedAt >= t.createdAt,
  );
  const avgCompletionHours = completedWithTimes.length
    ? Math.round(
        (completedWithTimes.reduce((acc, t) => acc + ((t.completedAt ?? 0) - t.createdAt) / 3_600_000, 0) /
          completedWithTimes.length) *
          10,
      ) / 10
    : 0;

  const openWithDue = tasks.filter((t) => !t.completed && t.dueDate);
  const overdueCount = openWithDue.filter((t) => /** @type {string} */ (t.dueDate) < todayStr).length;
  const overdueRate = openWithDue.length ? Math.round((overdueCount / openWithDue.length) * 100) : 0;

  /** @type {Map<string, number>} */
  const timeByProject = new Map();
  for (const t of tasks) {
    if (t.trackedMinutes > 0) {
      timeByProject.set(t.projectId, (timeByProject.get(t.projectId) ?? 0) + t.trackedMinutes);
    }
  }

  return {
    last7Days,
    streak,
    avgCompletionHours,
    overdueCount,
    overdueRate,
    totalCompleted: tasks.filter((t) => t.completed).length,
    totalOpen: tasks.filter((t) => !t.completed).length,
    timeByProject: Object.fromEntries(timeByProject),
  };
}
