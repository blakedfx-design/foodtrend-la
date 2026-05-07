import type { Trend } from "@/types/laFoodTrend";

/**
 * Resolved cuisine + meal labels for editorial cards.
 * Central place for defaults and scan-label fallbacks; later can extend with
 * keyword / open-web / Reddit tagging without touching UI components.
 */
export type CuisineAndMealResolved = {
  cuisineOrigin: string;
  mealType: string;
  mealMoment?: string;
};

/** Meal cue above the title (e.g. TABLE STARTER) → primary meal line when JSON omits mealType. */
const MEAL_SCAN_CUE_TO_TYPE: Record<string, string> = {
  "TABLE STARTER": "Small plates",
  "LUNCH TREND": "Lunch",
  LUNCH: "Lunch",
  BREAKFAST: "Breakfast",
  MORNING: "Breakfast",
  APERITIVO: "Drinks",
  "DINNER SNACK": "Shared plates",
  "DINNER / LATE NIGHT": "Shared plates",
  DINNER: "Dinner",
  DESSERT: "Dessert",
  AFTERNOON: "Pastry / Dessert",
  "AFTERNOON / EVENING": "Dessert",
};

export function getCuisineAndMeal(trend: Trend, mealScanLabel?: string | null): CuisineAndMealResolved {
  const cuisine = trend.cuisineOrigin?.trim();
  const mealTypeRaw = trend.mealType?.trim();
  const mealMomentRaw = trend.mealMoment?.trim();

  const cue = mealScanLabel?.trim();
  const inferredType = cue ? MEAL_SCAN_CUE_TO_TYPE[cue] : undefined;

  const out: CuisineAndMealResolved = {
    cuisineOrigin: cuisine || "—",
    mealType: mealTypeRaw || inferredType || "General",
  };

  if (mealMomentRaw) {
    out.mealMoment = mealMomentRaw;
  }

  return out;
}
