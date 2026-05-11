import type { FtTrendRowProps } from "@/components/foodtrend/TrendRow";
import { TrendIconForName } from "@/components/foodtrend/TrendIconForName";
import { mapTrendToWherePicks } from "@/lib/laFoodTrendsData";
import { getCuisineAndMeal } from "@/lib/getCuisineAndMeal";
import { editorialMealScanLabel } from "@/lib/mealScanLabel";
import { editorialMoveCopy } from "@/lib/moveCopy";
import { batchDisplayMomentumPopularity } from "@/lib/trendCardScores";
import { sanitizePublicConvergenceCopy } from "@/lib/signals/convergence";
import { whyLinesForEditorialCard } from "@/lib/trendText";
import type { Trend } from "@/types/laFoodTrend";

function editorialSignalCue(trend: Trend): string | undefined {
  const c = trend.convergence;
  if (!c) return undefined;
  if (c.confidence === "low") return "Quiet momentum";
  if (c.trendState === "cooling") return "Cooling off";
  if (c.trendState === "mainstream") return "Across the city";
  if (c.trendState === "rising") return "On the upswing";
  if (c.trendState === "stabilizing") return "Finding its rhythm";
  if (c.trendState === "emerging") return "Gathering steam";
  if (c.trendState === "weak_signal") return "Small echoes";
  return undefined;
}

const PUBLIC_SCRUB_OPTS = { redditApprovedForPublicCopy: false };

function scrubEditorialWhyLines(lines: string[]): string[] {
  return lines.map((line) => sanitizePublicConvergenceCopy(line, PUBLIC_SCRUB_OPTS));
}

/** Apply public-facing label scrub to any prose shown on snapshot/report cards (fallback “why” lines, etc.). */
export function scrubPublicEditorialCardLines(lines: string[]): string[] {
  return scrubEditorialWhyLines(lines);
}

function editorialWhyLines(trend: Trend, max = 3): string[] {
  const pub = trend.convergence?.publicNarrative;
  if (pub?.primaryLine?.trim()) {
    const lines = [pub.primaryLine.trim(), ...pub.supportingLines.map((s) => s.trim()).filter(Boolean)];
    if (lines.length < max && trend.whyItWorks?.trim()) {
      lines.push(trend.whyItWorks.trim());
    }
    return scrubEditorialWhyLines(lines).slice(0, max);
  }
  return scrubEditorialWhyLines(whyLinesForEditorialCard(trend.whyItsEverywhere, trend.whyItWorks, max));
}

export function trendToEditorialCardProps(trend: Trend, rank: number, allInBatch: Trend[]): FtTrendRowProps {
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
    ...(trend.convergence
      ? { whyEyebrow: "Why it's everywhere", signalCue: editorialSignalCue(trend) }
      : {}),
    cuisineOrigin,
    mealType,
    mealMoment,
    mealScanLabel: mealScan,
    momentumScore: scores.momentumScore,
    popularityScore: scores.popularityScore,
    moveCopy: editorialMoveCopy(trend.id, mealScan, trend.moveCopy),
    ...(trend.heroImageUrl ? { heroImageUrl: trend.heroImageUrl } : {}),
    ...(trend.heroImageSource ? { heroImageSource: trend.heroImageSource } : {}),
    ...(trend.heroImageSourceUrl ? { heroImageSourceUrl: trend.heroImageSourceUrl } : {}),
    ...(trend.heroImageCredit ? { heroImageCredit: trend.heroImageCredit } : {}),
  };
}
