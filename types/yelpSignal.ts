/** Neighborhood concentration within one Fusion search slice (open listings only). */
export type YelpNeighborhoodCluster = {
  neighborhood: string;
  business_count: number;
};

/**
 * Structured Yelp supply signal per search term — aggregates only (no raw businesses).
 * Attached to trends after relevance scoring in the weekend pipeline.
 */
export type YelpSignal = {
  source: "yelp";
  term_searched: string;
  /** Open listings counted after dedupe by Yelp business id. */
  business_count: number;
  avg_rating: number | null;
  total_review_volume: number;
  neighborhood_clusters: YelpNeighborhoodCluster[];
  /**
   * Intrinsic supply strength for this term slice, or trend-weighted score after
   * `selectYelpSignalsForTrend` attaches signals to a row.
   */
  yelp_signal_score: number;
};
