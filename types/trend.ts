/** Raw dish signal from scout — no ranks or scores (engine assigns those). */
export type DishTrendCandidate = {
  trend_name: string;
  definition: string;
  representative_restaurants: string[];
  evidence_of_spread: string;
  why_hot: string;
  sources: string[];
};

export type RightNowTrend = {
  rank: number;
  trend_name: string;
  definition: string;
  representative_restaurants: string[];
  evidence_of_spread: string;
  why_hot: string;
  trend_score: number;
  trend_stage: "Rising" | "Peak";
  go_now_recommendation: string;
  sources: string[];
};

export type AboutToHitTrend = {
  rank: number;
  trend_name: string;
  emerging_dish_or_item: string;
  why_it_could_pop: string;
  early_places_to_watch: string[];
  watch_signal: string;
  trend_score: number;
  trend_stage: "Emerging";
  sources: string[];
};

export type FoodTrendsPayload = {
  right_now_section_title: "Top 5 LA Food Trends Right Now";
  about_to_hit_section_title: "Top 3 About to Hit";
  right_now: RightNowTrend[];
  about_to_hit: AboutToHitTrend[];
};
