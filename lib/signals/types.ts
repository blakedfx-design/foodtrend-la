export type SignalSource =
  | "reddit"
  | "google_places"
  | "eater"
  | "infatuation"
  | "latimes"
  | "manual_editorial"
  | "reservation"
  | "instagram_reference";

export type SignalEntityType = "dish" | "restaurant" | "cuisine" | "ingredient";

export type TrendSignal = {
  id: string;
  source: SignalSource;
  entityType: SignalEntityType;
  entity: string;
  confidence: number;
  velocity?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type TrendCandidate = {
  entity: string;
  score: number;
  sources: SignalSource[];
  restaurants: string[];
  neighborhoods: string[];
  supportingSignals: TrendSignal[];
  candidateOnly?: boolean;
  editorialContributionPct?: number;
  supportingPublicationCount?: number;
  sourceMix?: Record<string, number>;
  aboutToHitEligible?: boolean;
  primaryEligible?: boolean;
  eligibilityReason?: string;
};
