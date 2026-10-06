export const formatMatchScoreValue = (score: number | null | undefined) => {
  if (score === null || score === undefined) return '-';
  return score < 0 ? 'DQ' : String(score);
};
