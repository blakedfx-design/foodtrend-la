import type { FtTrendRowProps } from "@/components/foodtrend/TrendRow";
import { TrendIconForName } from "@/components/foodtrend/TrendIconForName";
import { mapTrendToWherePicks } from "@/lib/laFoodTrendsData";
import { getCuisineAndMeal } from "@/lib/getCuisineAndMeal";
import { editorialMealScanLabel } from "@/lib/mealScanLabel";
import { editorialMoveCopy } from "@/lib/moveCopy";
import { batchDisplayMomentumPopularity } from "@/lib/trendCardScores";
import { whyLinesForEditorialCard } from "@/lib/trendText";
import type { Trend } from "@/types/laFoodTrend";

function editorialWhyLines(trend: Trend, max = 3): string[] {
  return whyLinesForEditorialCard(trend.whyItsEverywhere, trend.whyItWorks, max);
}

export function trendToEditorialCardProps(
  trend: Trend,
  rank: number,
  allInBatch: Trend[],
): FtTrendRowProps {
  const rankNum = String(rank).padStart(2, "0");
  const picks = mapTrendToWherePicks(trend);
  const mealScan = editorialMealScanLabel(trend);
  const { cuisineOrigin, mealType, mealMoment } = getCuisineAndMeal(trend, mealScan);
  const scores = batchDisplayMomentumPopularity(trend.id, allInBatch);

  return {
    trendId: trend.id,
    rankKicker: `NO. ${rankNum}`,
    rankNum,
    icon: <TrendIconForName name={trend.name} />,
    title: trend.name,
    description: trend.description.trim(),
    picks,
    why: editorialWhyLines(trend),
    cuisineOrigin,
    mealType,
    mealMoment,
    mealScanLabel: mealScan,
    momentumScore: scores.momentumScore,
    popularityScore: scores.popularityScore,
    moveCopy: editorialMoveCopy(trend.id, mealScan, trend.moveCopy),
  };
}
