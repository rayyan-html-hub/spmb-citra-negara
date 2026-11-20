export function averageTkaScore(subjectScores: readonly number[]) {
  if (
    subjectScores.length !== 4 ||
    subjectScores.some((score) => !Number.isFinite(score) || score < 0 || score > 100)
  ) {
    throw new Error("Nilai TKA harus berisi 4 mata uji pada skala 0–100.");
  }
  return Math.round(
    (subjectScores.reduce((total, score) => total + score, 0) /
      subjectScores.length) *
      1000,
  ) / 1000;
}
