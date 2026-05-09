export type TrendMaturityState =
  | "weak_signal"
  | "emerging"
  | "accelerating"
  | "peak"
  | "stabilizing"
  | "fading"
  | "blocked";

export type TrendMaturityInput = {
  entity: string;
  score: number;
  stage: "about_to_hit" | "top5" | "fading" | "blocked";
  candidateOnly: boolean;
  primaryEligible: boolean;
  aboutToHitEligible: boolean;
  supportingPublicationCount: number;
  sourceMix: Record<string, number>;
  supportTypes: string[];
  editorialContributionPct: number;
  replacementBlocked: boolean;
  eligibilityReason: string | null;
  previousHistory: Array<{
    stage: "about_to_hit" | "top5" | "fading" | "blocked";
    score: number;
    timestamp: string;
  }>;
};

export type TrendMaturityResult = {
  state: TrendMaturityState;
  confidence: number;
  maturityReason: string;
  velocityHint: "rising" | "flat" | "falling";
  riskFlags: string[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function latestPreviousScore(input: TrendMaturityInput): number | null {
  if (!input.previousHistory.length) return null;
  const sorted = [...input.previousHistory].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const score = sorted[0]?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function classifyTrendMaturity(input: TrendMaturityInput): TrendMaturityResult {
  const riskFlags: string[] = [];
  const previousScore = latestPreviousScore(input);
  const scoreDelta = previousScore == null ? 0 : input.score - previousScore;
  const hasStrongNonEditorialSupport = input.supportTypes.filter((x) => x !== "editorial_overlap").length >= 1;
  const multiSupport = input.supportTypes.length >= 2;
  const editorialHeavy = input.editorialContributionPct >= 20;
  const publicationOverlap = input.supportingPublicationCount >= 2;
  const velocityHint: "rising" | "flat" | "falling" =
    scoreDelta > 2 ? "rising" : scoreDelta < -2 ? "falling" : "flat";

  if (input.replacementBlocked || input.stage === "blocked") {
    riskFlags.push("blocked_by_guard");
    return {
      state: "blocked",
      confidence: 0.96,
      maturityReason: input.eligibilityReason ?? "candidate blocked by safeguards",
      velocityHint,
      riskFlags,
    };
  }

  if (
    (input.stage === "fading" || velocityHint === "falling") &&
    (input.previousHistory.some((h) => h.stage === "top5" || h.stage === "about_to_hit") || previousScore != null)
  ) {
    riskFlags.push("losing_momentum");
    return {
      state: "fading",
      confidence: 0.72,
      maturityReason: "score/support trend is declining from prior tracked state",
      velocityHint,
      riskFlags,
    };
  }

  if (input.stage === "top5" && input.primaryEligible) {
    if ((multiSupport || hasStrongNonEditorialSupport) && input.score >= 60) {
      return {
        state: "peak",
        confidence: 0.9,
        maturityReason: "top5 with high score and strong support footprint",
        velocityHint,
        riskFlags,
      };
    }
    riskFlags.push("top5_with_limited_support_types");
    return {
      state: "stabilizing",
      confidence: 0.76,
      maturityReason: "top5 but support breadth is flat or limited",
      velocityHint,
      riskFlags,
    };
  }

  if (input.candidateOnly) {
    if (input.score < 8 && !publicationOverlap && input.supportTypes.length <= 1) {
      riskFlags.push("low_support");
      return {
        state: "weak_signal",
        confidence: 0.78,
        maturityReason: "early candidate-only signal with limited support",
        velocityHint,
        riskFlags,
      };
    }

    if (input.aboutToHitEligible && (multiSupport || publicationOverlap) && input.score >= 10) {
      if (!hasStrongNonEditorialSupport) riskFlags.push("editorial_led");
      if (editorialHeavy) riskFlags.push("editorial_heavy");
      return {
        state: "accelerating",
        confidence: clamp01(0.68 + input.supportTypes.length * 0.08),
        maturityReason: "candidate-only term with growing multi-source support",
        velocityHint: velocityHint === "falling" ? "flat" : velocityHint,
        riskFlags,
      };
    }

    if (publicationOverlap || input.supportTypes.length >= 1) {
      if (editorialHeavy) riskFlags.push("editorial_heavy");
      return {
        state: "emerging",
        confidence: clamp01(0.6 + input.supportTypes.length * 0.05),
        maturityReason: "candidate has initial cross-source support but not top-tier strength yet",
        velocityHint,
        riskFlags,
      };
    }
  }

  if (input.supportTypes.length <= 1 && input.score < 12) {
    riskFlags.push("low_support");
    return {
      state: "weak_signal",
      confidence: 0.62,
      maturityReason: "single-support low-score signal",
      velocityHint,
      riskFlags,
    };
  }

  return {
    state: "emerging",
    confidence: 0.58,
    maturityReason: "baseline maturity default with limited longitudinal evidence",
    velocityHint,
    riskFlags,
  };
}
