// @ts-check
// Grade Tracker model: ECTS-weighted GPA, multi-scale conversions (German 1.0-5.0,
// US GPA 4.0, Percentage 0-100%, Swiss 6-1, Austrian 1-5, UK Honours), partial module
// grades, exam attempts history, and What-If scenario forecasting.

/**
 * @typedef {'german' | 'us_gpa' | 'percentage' | 'swiss' | 'austrian' | 'uk'} GradingScale
 */

/**
 * @typedef {'planned' | 'in_progress' | 'passed' | 'failed'} ModuleStatus
 */

/**
 * @typedef {object} PartialGrade
 * @property {string} id
 * @property {string} name        e.g. 'Klausur (60%)', 'Projekt (40%)'
 * @property {number} weight      e.g. 0.6
 * @property {number} grade       grade value in current scale
 */

/**
 * @typedef {object} ModuleItem
 * @property {string} id
 * @property {string} profileId
 * @property {string} name
 * @property {string} [code]      e.g. 'CS101'
 * @property {number} ects        Credit points (e.g. 5, 6, 10)
 * @property {number | null} grade
 * @property {number} semester    e.g. 1, 2, 3...
 * @property {ModuleStatus} status
 * @property {boolean} countsTowardsFinal
 * @property {number} attempt
 * @property {PartialGrade[]} [partialGrades]
 * @property {number} [updatedAt]
 */

/**
 * @typedef {object} DegreeProfile
 * @property {string} id
 * @property {string} name               e.g. 'B.Sc. Informatik'
 * @property {number} requiredEcts       e.g. 180 (Bachelor) or 120 (Master)
 * @property {GradingScale} scale
 * @property {number} targetGrade        e.g. 2.0 (German) or 3.5 (US)
 */

export const GERMAN_GRADES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0];

/**
 * Computes the module grade from weighted partial components.
 * @param {PartialGrade[]} partials
 * @returns {number | null}
 */
export function computeModuleGradeFromPartials(partials) {
  if (!partials || partials.length === 0) return null;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const p of partials) {
    if (Number.isFinite(p.grade) && Number.isFinite(p.weight) && p.weight > 0) {
      weightedSum += p.grade * p.weight;
      totalWeight += p.weight;
    }
  }
  if (totalWeight <= 0) return null;
  const raw = weightedSum / totalWeight;
  return Number(raw.toFixed(2));
}

/**
 * Computes ECTS-weighted average for graded modules that count towards final degree.
 * @param {ModuleItem[]} modules
 * @returns {{ average: number | null, gradedEcts: number, totalEcts: number, passedEcts: number }}
 */
export function computeDegreeStats(modules) {
  let gradedEcts = 0;
  let weightedSum = 0;
  let totalEcts = 0;
  let passedEcts = 0;

  for (const m of modules) {
    totalEcts += m.ects || 0;
    if (m.status === 'passed') {
      passedEcts += m.ects || 0;
    }
    if (m.countsTowardsFinal && m.grade !== null && Number.isFinite(m.grade)) {
      weightedSum += m.grade * (m.ects || 0);
      gradedEcts += m.ects || 0;
    }
  }

  const average = gradedEcts > 0 ? Number((weightedSum / gradedEcts).toFixed(2)) : null;

  return { average, gradedEcts, totalEcts, passedEcts };
}

/**
 * Computes What-If required average to hit a target overall grade.
 * @param {ModuleItem[]} modules
 * @param {number} targetGrade
 * @param {number} requiredTotalEcts
 * @param {GradingScale} [scale]
 * @returns {{ neededAverage: number | null, remainingEcts: number, possible: boolean }}
 */
export function computeWhatIfTarget(modules, targetGrade, requiredTotalEcts, scale = 'german') {
  const { average, gradedEcts } = computeDegreeStats(modules);
  const remainingEcts = Math.max(0, requiredTotalEcts - gradedEcts);

  if (remainingEcts === 0) {
    return {
      neededAverage: null,
      remainingEcts: 0,
      possible:
        average !== null &&
        (scale === 'german' || scale === 'austrian' ? average <= targetGrade : average >= targetGrade),
    };
  }

  const currentPoints = (average || 0) * gradedEcts;
  const targetTotalPoints = targetGrade * requiredTotalEcts;
  const neededPoints = targetTotalPoints - currentPoints;
  const neededAverage = Number((neededPoints / remainingEcts).toFixed(2));

  // Determine if physically possible within grading scale limits
  let minGrade = 1.0;
  let maxGrade = 5.0;
  if (scale === 'us_gpa') {
    minGrade = 0.0;
    maxGrade = 4.0;
  } else if (scale === 'percentage') {
    minGrade = 0;
    maxGrade = 100;
  } else if (scale === 'swiss') {
    minGrade = 1.0;
    maxGrade = 6.0;
  }

  let possible;
  if (scale === 'german' || scale === 'austrian') {
    // 1.0 is best, 4.0 is pass limit
    possible = neededAverage >= 1.0 && neededAverage <= 4.0;
  } else {
    // Higher is better
    possible = neededAverage >= minGrade && neededAverage <= maxGrade;
  }

  return { neededAverage, remainingEcts, possible };
}

/**
 * Computes hypothetical average if a specific module gets a hypothetical grade.
 * @param {ModuleItem[]} modules
 * @param {string} moduleId
 * @param {number} hypotheticalGrade
 * @returns {number | null}
 */
export function simulateGradeForModule(modules, moduleId, hypotheticalGrade) {
  const cloned = modules.map((m) =>
    m.id === moduleId ? { ...m, grade: hypotheticalGrade, countsTowardsFinal: true } : { ...m },
  );
  return computeDegreeStats(cloned).average;
}

/**
 * Aggregates statistics per semester for trend charts.
 * @param {ModuleItem[]} modules
 * @returns {Array<{ semester: number, average: number | null, ects: number }>}
 */
export function computeSemesterBreakdown(modules) {
  /** @type {Map<number, ModuleItem[]>} */
  const groups = new Map();
  for (const m of modules) {
    const sem = m.semester || 1;
    if (!groups.has(sem)) groups.set(sem, []);
    groups.get(sem)?.push(m);
  }

  const semesters = Array.from(groups.keys()).sort((a, b) => a - b);
  return semesters.map((sem) => {
    const list = groups.get(sem) || [];
    const stats = computeDegreeStats(list);
    return {
      semester: sem,
      average: stats.average,
      ects: stats.passedEcts,
    };
  });
}
