// @ts-check
// Human benchmark percentile benchmarks and statistical distributions

/**
 * Computes human population percentile (0 to 100) based on typical human cognitive data.
 * @param {'classic' | 'aim' | 'sequence' | 'number' | 'visual' | 'choice'} testType
 * @param {number} score Lower is better for time tests (classic, aim, choice), higher is better for memory tests
 * @returns {{ percentile: number, tier: string }}
 */
export function getBenchmarkPercentile(testType, score) {
  let percentile = 50;
  let tier = 'Average';

  if (testType === 'classic' || testType === 'choice') {
    // Score in milliseconds (median ~250ms for classic, ~350ms for choice)
    const median = testType === 'classic' ? 250 : 350;
    const stdDev = testType === 'classic' ? 40 : 55;

    // Z-score where lower is better
    const z = (median - score) / stdDev;
    percentile = Math.max(1, Math.min(99, Math.round(50 + 50 * Math.tanh(z * 0.8))));

    if (score < median - 1.8 * stdDev) tier = 'Godlike (Top 1%)';
    else if (score < median - stdDev) tier = 'Master (Top 15%)';
    else if (score < median) tier = 'Above Average';
    else if (score < median + stdDev) tier = 'Typical';
    else tier = 'Developing';
  } else if (testType === 'aim') {
    // Score in ms per target (median ~450ms)
    const median = 450;
    const z = (median - score) / 70;
    percentile = Math.max(1, Math.min(99, Math.round(50 + 50 * Math.tanh(z * 0.8))));

    if (score < 340) tier = 'Sharpshooter (Top 5%)';
    else if (score < 400) tier = 'Marksman (Top 20%)';
    else if (score < 480) tier = 'Average';
    else tier = 'Developing';
  } else if (testType === 'sequence' || testType === 'visual') {
    // Score is level reached (median ~7-8)
    const median = 8;
    const z = (score - median) / 2.5;
    percentile = Math.max(1, Math.min(99, Math.round(50 + 50 * Math.tanh(z * 0.8))));

    if (score >= 14) tier = 'Grandmaster (Top 1%)';
    else if (score >= 11) tier = 'Superior (Top 10%)';
    else if (score >= 8) tier = 'Average';
    else tier = 'Developing';
  } else if (testType === 'number') {
    // Score is digits remembered (median ~7, Miller's Law 7±2)
    const median = 7;
    const z = (score - median) / 1.8;
    percentile = Math.max(1, Math.min(99, Math.round(50 + 50 * Math.tanh(z * 0.8))));

    if (score >= 11) tier = 'Eidetic (Top 1%)';
    else if (score >= 9) tier = 'Excellent (Top 15%)';
    else if (score >= 7) tier = 'Average';
    else tier = 'Developing';
  }

  return { percentile, tier };
}
