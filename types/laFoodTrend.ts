export type TrendConfidence = "low" | "medium" | "high";

export type TrendRestaurant = {
  name: string;
  neighborhood: string;
};

/** Canonical ML/editorial trend record for `data/la-food-trends.json`. */
export type Trend = {
  id: string;
  name: string;
  description: string;
  whyItsEverywhere: string;
  signalScore: number;
  lastUpdated: string;
  /** Channel labels (e.g. menus, maps, forums) — not necessarily URLs yet */
  sources: string[];
  neighborhoods: string[];
  restaurants: TrendRestaurant[];
  menuItems: string[];
  confidence: TrendConfidence;
};

/** Root document written by ingestion / `scripts/update-trends.ts`. */
export type LaFoodTrendsDataFile = {
  lastUpdated: string;
  /** Top trends on menus now (editorial “right now” list). */
  trends: Trend[];
  /** Emerging patterns — “about to hit” watchlist (same `Trend` fields). */
  aboutToHit: Trend[];
};
