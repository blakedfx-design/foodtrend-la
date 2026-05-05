import type { LaFoodTrendsDataFile, Trend } from "@/types/laFoodTrend";

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function jitterScore(score: number, maxDelta: number): number {
  const delta = Math.floor(Math.random() * (2 * maxDelta + 1)) - maxDelta;
  return clampScore(score + delta);
}

/**
 * Weekend cron (in-memory): only `signalScore` and `lastUpdated` on each trend
 * and the file root. Does not touch editorial strings, names, sources, or venues.
 */
export function simulateWeekendSignalOnly(data: LaFoodTrendsDataFile): LaFoodTrendsDataFile {
  const now = new Date().toISOString();
  const bump = (t: Trend): Trend => ({
    ...t,
    signalScore: jitterScore(t.signalScore, 2),
    lastUpdated: now,
  });
  return {
    ...data,
    lastUpdated: now,
    trends: data.trends.map(bump),
    aboutToHit: data.aboutToHit.map(bump),
  };
}
