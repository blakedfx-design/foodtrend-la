import type { FoodTrendsPayload } from "@/types/trend";
import type { LaFoodTrendsDataFile, Trend, TrendConfidence } from "@/types/laFoodTrend";

function slugId(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "trend"}-${index}`;
}

function stageToConfidence(stage: string): TrendConfidence {
  const s = stage.trim().toLowerCase();
  if (s === "peak") return "high";
  if (s === "rising") return "medium";
  if (s === "emerging") return "low";
  return "medium";
}

function normalizeScore(n: number): number {
  if (n >= 0 && n <= 10) {
    return Math.min(100, Math.round(n * 10));
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Converts legacy engine output into the MVP trend file shape (for `scout-la-food` and migrations).
 */
export function foodTrendsPayloadToLaFoodTrendsFile(
  payload: FoodTrendsPayload,
  lastUpdated: string,
): LaFoodTrendsDataFile {
  const trends: Trend[] = [];

  payload.right_now.forEach((row, i) => {
    trends.push({
      id: slugId(row.trend_name, i),
      name: row.trend_name,
      description: row.definition,
      whyItsEverywhere: row.why_hot,
      signalScore: normalizeScore(row.trend_score),
      lastUpdated,
      sources: [...row.sources],
      neighborhoods: [],
      restaurants: row.representative_restaurants.map((name) => ({
        name,
        neighborhood: "Los Angeles",
      })),
      menuItems: row.representative_restaurants.map(() => row.trend_name),
      confidence: stageToConfidence(row.trend_stage),
    });
  });

  const aboutToHit: Trend[] = payload.about_to_hit.map((row, j) => ({
    id: slugId(row.trend_name, trends.length + j),
    name: row.trend_name,
    description: row.emerging_dish_or_item,
    whyItsEverywhere: row.why_it_could_pop,
    signalScore: normalizeScore(row.trend_score),
    lastUpdated,
    sources: [...row.sources],
    neighborhoods: [],
    restaurants: row.early_places_to_watch.map((name) => ({
      name,
      neighborhood: "Los Angeles",
    })),
    menuItems: [row.emerging_dish_or_item],
    confidence: "low",
  }));

  return { lastUpdated, trends, aboutToHit };
}
