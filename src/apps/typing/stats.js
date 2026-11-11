// @ts-check
// Typing performance analytics: WPM, Raw WPM, Accuracy, Consistency, and Error Heatmap

export function calculateWpm(correctChars, elapsedSeconds) {
  if (elapsedSeconds <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  const words = correctChars / 5;
  return Math.max(0, Math.round(words / minutes));
}

export function calculateRawWpm(totalKeystrokes, elapsedSeconds) {
  if (elapsedSeconds <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  const words = totalKeystrokes / 5;
  return Math.max(0, Math.round(words / minutes));
}

export function calculateAccuracy(correctChars, totalKeystrokes) {
  if (totalKeystrokes <= 0) return 100;
  const acc = (correctChars / totalKeystrokes) * 100;
  return Math.max(0, Math.min(100, Math.round(acc * 10) / 10));
}

export function calculateConsistency(wpmHistory) {
  if (wpmHistory.length < 2) return 100;
  const avg = wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length;
  if (avg === 0) return 100;
  const variance = wpmHistory.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / wpmHistory.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / avg) * 100;
  return Math.max(0, Math.min(100, Math.round(100 - coefficientOfVariation)));
}
