import type { FoodTrendsPayload } from "@/types/trend";
import type { LaFoodTrendsDataFile, Trend, TrendConfidence } from "@/types/laFoodTrend";
import { normalizeTrendRow } from "@/lib/normalizeTrend";

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

/** When the engine only supplies names, Maps search is a neutral outbound fallback (no Instagram handle). */
function venueFallbackMaps(name: string, neighborhood: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${neighborhood}, Los Angeles, CA`)}`;
}

/**
 * Converts legacy engine output into the MVP trend file shape (for `scout-la-food` and migrations).
 */
export function foodTrendsPayloadToLaFoodTrendsFile(
  payload: FoodTrendsPayload,
  lastUpdated: string,
): LaFoodTrendsDataFile {
  const trends: Trend[] = payload.right_now.map((row, i) =>
    normalizeTrendRow({
      id: slugId(row.trend_name, i),
      name: row.trend_name,
      description: row.definition,
      whyItsEverywhere: row.why_hot,
      signalScore: normalizeScore(row.trend_score),
      lastUpdated,
      sources: [...row.sources],
      neighborhoods: [],
      restaurants: row.representative_restaurants.map((name) => {
        const neighborhood = "Los Angeles";
        return {
          name,
          neighborhood,
          googleMapsUrl: venueFallbackMaps(name, neighborhood),
        };
      }),
      menuItems: row.representative_restaurants.map(() => row.trend_name),
      confidence: stageToConfidence(row.trend_stage),
    }),
  );

  const aboutToHit: Trend[] = payload.about_to_hit.map((row, j) =>
    normalizeTrendRow({
      id: slugId(row.trend_name, trends.length + j),
      name: row.trend_name,
      description: row.emerging_dish_or_item,
      whyItsEverywhere: row.why_it_could_pop,
      signalScore: normalizeScore(row.trend_score),
      lastUpdated,
      sources: [...row.sources],
      neighborhoods: [],
      restaurants: row.early_places_to_watch.map((name) => {
        const neighborhood = "Los Angeles";
        return {
          name,
          neighborhood,
          googleMapsUrl: venueFallbackMaps(name, neighborhood),
        };
      }),
      menuItems: [row.emerging_dish_or_item],
      confidence: "low",
    }),
  );

  return { lastUpdated, trends, aboutToHit };
}
