/** One Reddit post normalized for merging with Places / TikTok / manual seed pipelines. */
export type RedditSignal = {
  source: "reddit";
  subreddit: string;
  title: string;
  body: string;
  url: string;
  score: number;
  num_comments: number;
  created_utc: number;
  matched_terms: string[];
  extracted_neighborhoods: string[];
  extracted_dishes: string[];
  extracted_restaurants: string[];
  reddit_signal_score: number;
  /** Reddit `t3_` id, without prefix optional */
  post_id: string;
};

export type RedditIngestHealth = {
  fetchedCount: number;
  /** Distinct posts after dedupe, before content filters */
  uniqueFetched: number;
  keptCount: number;
  rejectedCount: number;
  topDishTerms: { term: string; count: number }[];
  topNeighborhoodTerms: { term: string; count: number }[];
  searchQueriesRun: number;
  cacheHits: number;
  rateLimitRemaining: number | null;
};

export type RedditIngestResult = {
  signals: RedditSignal[];
  health: RedditIngestHealth;
};

/** Weekend trend-row enrichment: compact aggregate from a name-only search. */
export type RedditSearchSignal = {
  postCount: number;
  momentumScore: number;
  topPhrases: string[];
};
