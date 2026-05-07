/** Neighborhood concentration within one open-listings search slice. */
export type ListingsNeighborhoodCluster = {
  neighborhood: string;
  business_count: number;
};

/**
 * Structured open-listings supply signal per search term (aggregates only).
 * Attached to trends after relevance scoring in the weekend pipeline.
 */
export type ListingsSignal = {
  source: "listings";
  term_searched: string;
  /** Open listings counted after dedupe by provider business id. */
  business_count: number;
  avg_rating: number | null;
  total_review_volume: number;
  neighborhood_clusters: ListingsNeighborhoodCluster[];
  /**
   * Intrinsic supply strength for this term slice, or trend-weighted score after
   * `selectListingsSignalsForTrend` attaches signals to a row.
   */
  listings_signal_score: number;
};
