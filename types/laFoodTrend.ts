import type { ListingsSignal } from "@/types/listingsSignal";
import type { TrendSocialSignal } from "@/types/socialSignal";

export type TrendConfidence = "low" | "medium" | "high";

/**
 * Venue row in `data/la-food-trends.json` — always an object (not a bare string).
 * Name links use the first available URL in priority order (see `resolveRestaurantLink`).
 */
export type TrendRestaurant = {
  name: string;
  neighborhood: string;
  /** Plate or menu line when known for this venue */
  dish?: string;
  /** Official Instagram profile (`https://www.instagram.com/...`). */
  instagramUrl?: string;
  /** TikTok profile or post URL (`https://www.tiktok.com/...`). */
  tiktokUrl?: string;
  /** Restaurant website when not social-first. */
  websiteUrl?: string;
  /** Google Maps place / search URL. */
  googleMapsUrl?: string;
  /** Any other outbound fallback (tertiary listings, etc.). */
  fallbackUrl?: string;
  /** Provenance label for UI (e.g. Google Maps) */
  source?: string;
  rating?: number;
  review_count?: number;
};

/** Editorial keys stored in `data/la-food-trends.json` (normalized in-memory copy mirrors legacy fields). */
export type TrendEditorialFields = {
  "short descriptor": string;
  "WHY IT'S HITTING": string;
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
  /** Mirrors `WHY IT'S HITTING` after load. */
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
  /** Open-listings term aggregates (supply map / validation; not UI-facing yet). */
  listingsSignals?: ListingsSignal[];
  /** Curated social cues for the trend (reels, posts, threads). */
  socialSignals?: TrendSocialSignal[];
  /** Insight rail — editorial cuisine label */
  cuisineOrigin?: string;
  mealType?: string;
  mealMoment?: string;
  /** Scores 0–100; derived from signal when absent in JSON */
  momentumScore: number;
  popularityScore: number;
  /** Bottom insight CTA copy */
  moveCopy?: string;
  /**
   * Manually curated dish photo only: URL path under `public/`, e.g.
   * `/editorial/food/aguachile-holbox.jpg`. Remote URLs are ignored by the card UI.
   */
  heroImageUrl?: string;
  /** Shown in “Photo via …” when `heroImageUrl` resolves to a valid local food asset. */
  heroImageSource?: string;
  /** Optional link on the credit line (e.g. restaurant site). */
  heroImageSourceUrl?: string;
  /** Optional explicit caption; if omitted, UI uses “Photo via {heroImageSource}”. */
  heroImageCredit?: string;
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
