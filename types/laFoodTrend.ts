import type { YelpSignal } from "@/types/yelpSignal";

export type TrendConfidence = "low" | "medium" | "high";

export type TrendRestaurant = {
  name: string;
  neighborhood: string;
  /** Plate or menu line when known for this venue */
  dish?: string;
  url?: string;
  yelp_url?: string;
  source_url?: string;
  /** Legacy / ingest alias for outbound URL (same precedence as picks after normalize). */
  link?: string;
  /** Provenance label for UI (e.g. Yelp, Google Maps) */
  source?: string;
  rating?: number;
  review_count?: number;
};

/** Editorial keys stored in `data/la-food-trends.json` (normalized in-memory copy mirrors legacy fields). */
export type TrendEditorialFields = {
  "short descriptor": string;
  "WHY IT'S EVERYWHERE": string;
  "MOST SPOTTED": string;
  "WHAT TO ORDER": string[];
  "WORTH THE SPLURGE": string;
  "EASY ENTRY": string;
  /** Empty string when no closer — key is always present after normalize. */
  "WHY IT WORKS": string;
};

/** Canonical ML/editorial trend record for `data/la-food-trends.json`. */
export type Trend = {
  id: string;
  name: string;
  /** Mirrors `short descriptor` after load. */
  description: string;
  /** Mirrors `WHY IT'S EVERYWHERE` after load. */
  whyItsEverywhere: string;
  signalScore: number;
  lastUpdated: string;
  /** Channel labels (e.g. menus, maps, forums) — not necessarily URLs yet */
  sources: string[];
  neighborhoods: string[];
  restaurants: TrendRestaurant[];
  /** Mirrors `WHAT TO ORDER` after load. */
  menuItems: string[];
  confidence: TrendConfidence;
  /** Optional punchy closer (editorial); set when `WHY IT WORKS` is non-empty. */
  whyItWorks?: string;
  /** One-line summary from automated signal passes (e.g. Google Places). */
  evidenceSummary?: string;
  /** Distinct source labels for this trend after refresh. */
  sourceCount?: number;
  /** Yelp Fusion term aggregates (supply map / validation; not UI-facing yet). */
  yelpSignals?: YelpSignal[];
  /** Insight rail — editorial cuisine label */
  cuisineOrigin?: string;
  mealType?: string;
  mealMoment?: string;
  /** Scores 0–100; derived from signal when absent in JSON */
  momentumScore: number;
  popularityScore: number;
  /** Bottom insight CTA copy */
  moveCopy?: string;
} & TrendEditorialFields;

export type TrendRefreshType = "weekly" | "weekend";

/** Root document written by ingestion / `scripts/update-trends.ts`. */
export type LaFoodTrendsDataFile = {
  lastUpdated: string;
  /** Set by cron simulators / future deploy automation. */
  refreshType?: TrendRefreshType;
  /** Optional short note from weekend (simulated or live) signal pass. */
  weekendNote?: string;
  /** Denormalized distinct source label count across all trends (optional). */
  sourceCount?: number;
  /** Top trends on menus now (editorial “right now” list). */
  trends: Trend[];
  /** Emerging patterns — “about to hit” watchlist (same `Trend` fields). */
  aboutToHit: Trend[];
};
