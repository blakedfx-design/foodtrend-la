import type { Trend } from "@/types/laFoodTrend";

/** Display-only scores so cards in a batch don’t look identical (ranges ~60–95 / ~40–85). */
export function batchDisplayMomentumPopularity(
  trendId: string,
  batch: Trend[],
): { momentumScore: number; popularityScore: number } {
  if (batch.length === 0) {
    return { momentumScore: 78, popularityScore: 58 };
  }

  const sorted = [...batch].sort((a, b) => {
    if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore;
    return a.name.localeCompare(b.name);
  });

  const idx = sorted.findIndex((t) => t.id === trendId);
  const pos = idx >= 0 ? idx : Math.max(0, sorted.length - 1);
  const n = sorted.length;
  const scores = sorted.map((t) => t.signalScore);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const span = Math.max(1, maxS - minS);

  const rankNorm = n <= 1 ? 1 : (n - 1 - pos) / (n - 1);
  const t = sorted[pos];
  const signalNorm = span > 0 ? (t.signalScore - minS) / span : rankNorm;

  const momentum = Math.round(60 + (0.62 * signalNorm + 0.38 * rankNorm) * 35);
  const popularity = Math.round(40 + (0.38 * signalNorm + 0.62 * rankNorm) * 45);

  return {
    momentumScore: Math.min(95, Math.max(60, momentum)),
    popularityScore: Math.min(85, Math.max(40, popularity)),
  };
}
