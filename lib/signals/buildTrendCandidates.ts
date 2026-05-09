import { aggregateSignals } from "@/lib/signals/aggregateSignals";
import type { SignalSource, TrendCandidate, TrendSignal } from "@/lib/signals/types";

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function collectFromMetadata(signal: TrendSignal, key: string): string[] {
  const meta = signal.metadata ?? {};
  const value = meta[key];
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
}

const EDITORIAL_SOURCES = new Set<SignalSource>(["eater", "infatuation", "latimes"]);

function sourceWeight(signal: TrendSignal): number {
  const fromMeta = signal.metadata?.sourceWeight;
  if (typeof fromMeta === "number" && Number.isFinite(fromMeta)) return Math.max(0.01, fromMeta);
  if (signal.source === "eater") return 0.25;
  if (signal.source === "infatuation") return 0.22;
  if (signal.source === "latimes") return 0.3;
  if (signal.source === "google_places") return 0.24;
  if (signal.source === "manual_editorial") return 0.18;
  return 0.2;
}

function candidateCategoryMultiplier(signal: TrendSignal, supportingPublicationCount: number): number {
  if (!signal.metadata?.candidateOnly) return 1;
  const category = signal.metadata?.matchedCategory;
  if (category === "dish") return 1;
  if (category === "restaurant_format") return 0.7;
  if (category === "ingredient") return 0.55;
  if (category === "cuisine") return supportingPublicationCount >= 2 ? 0.45 : 0.25;
  if (category === "dining_behavior") return 0.3;
  if (category === "neighborhood") return 0;
  return 0.45;
}

function buildSourceMix(signals: TrendSignal[]): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const signal of signals) {
    mix[signal.source] = (mix[signal.source] ?? 0) + 1;
  }
  return mix;
}

function computeEditorialContribution(
  signals: TrendSignal[],
): {
  editorialContributionPct: number;
  supportingPublicationCount: number;
  adjustedScoreFactor: number;
} {
  const publications = new Set<string>();
  for (const signal of signals) {
    if (!EDITORIAL_SOURCES.has(signal.source)) continue;
    const publication = typeof signal.metadata?.publication === "string" ? signal.metadata.publication : signal.source;
    publications.add(publication);
  }
  const supportingPublicationCount = publications.size;

  let editorialWeight = 0;
  let totalWeight = 0;
  for (const signal of signals) {
    const base = sourceWeight(signal) * Math.max(0.1, Math.min(1, signal.confidence));
    const adjusted = base * candidateCategoryMultiplier(signal, supportingPublicationCount);
    totalWeight += Math.max(0, adjusted);
    if (EDITORIAL_SOURCES.has(signal.source)) editorialWeight += Math.max(0, adjusted);
  }
  if (totalWeight <= 0) {
    return { editorialContributionPct: 0, supportingPublicationCount, adjustedScoreFactor: 1 };
  }
  const rawPct = editorialWeight / totalWeight;
  const cappedPct = Math.min(rawPct, 0.25);
  const adjustedScoreFactor = 1 - rawPct + cappedPct;
  return {
    editorialContributionPct: Math.round(cappedPct * 100),
    supportingPublicationCount,
    adjustedScoreFactor,
  };
}

export function buildTrendCandidates(
  signals: TrendSignal[],
  opts?: { minScore?: number; limit?: number; nowIso?: string; includeIneligibleCandidateOnly?: boolean },
): TrendCandidate[] {
  const minScore = opts?.minScore ?? 24;
  const limit = opts?.limit ?? 20;
  const includeIneligibleCandidateOnly = opts?.includeIneligibleCandidateOnly ?? false;
  const aggregated = aggregateSignals(signals, { nowIso: opts?.nowIso });

  const out: TrendCandidate[] = aggregated
    .filter((item) => item.score >= minScore)
    .map((item) => {
      const restaurants = uniqSorted(
        item.supportingSignals.flatMap((s) => [
          ...collectFromMetadata(s, "restaurant"),
          ...collectFromMetadata(s, "restaurants"),
        ]),
      );
      const neighborhoods = uniqSorted(
        item.supportingSignals.flatMap((s) => [
          ...collectFromMetadata(s, "neighborhood"),
          ...collectFromMetadata(s, "neighborhoods"),
        ]),
      );
      const sources = uniqSorted(item.sources).filter(Boolean) as SignalSource[];
      const candidateOnly = item.supportingSignals.length > 0
        ? item.supportingSignals.every((s) => Boolean(s.metadata?.candidateOnly))
        : false;
      const sourceMix = buildSourceMix(item.supportingSignals);
      const {
        editorialContributionPct,
        supportingPublicationCount,
        adjustedScoreFactor,
      } = computeEditorialContribution(item.supportingSignals);
      const adjustedScore = Math.max(0, Math.round(item.score * adjustedScoreFactor));
      const hasMinSupport = item.supportingSignals.length >= 2;
      const aboutToHitEligible = !candidateOnly || hasMinSupport;
      const primaryEligible = !candidateOnly;
      let eligibilityReason = "eligible";
      if (candidateOnly && !hasMinSupport) eligibilityReason = "blocked: requires >=2 supporting signals";
      else if (candidateOnly && hasMinSupport) eligibilityReason = "eligible: about-to-hit-only";
      return {
        entity: item.entity,
        score: adjustedScore,
        sources,
        restaurants,
        neighborhoods,
        supportingSignals: item.supportingSignals,
        candidateOnly,
        editorialContributionPct,
        supportingPublicationCount,
        sourceMix,
        aboutToHitEligible,
        primaryEligible,
        eligibilityReason,
      };
    })
    .filter(
      (candidate) =>
        includeIneligibleCandidateOnly || !candidate.candidateOnly || candidate.aboutToHitEligible,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return out;
}

export function formatTopSignalCandidatesForConsole(
  candidates: TrendCandidate[],
  topN = 5,
): string {
  const primaryTop = candidates.filter((c) => c.primaryEligible !== false).slice(0, topN);
  const aboutToHitTop = candidates.filter((c) => c.candidateOnly && c.aboutToHitEligible).slice(0, topN);
  const lines: string[] = [];
  lines.push("TOP SIGNAL CONVERGENCE CANDIDATES");
  if (primaryTop.length === 0 && aboutToHitTop.length === 0) {
    lines.push("No candidates met the current threshold.");
    return lines.join("\n");
  }
  if (primaryTop.length > 0) {
    lines.push("PRIMARY-ELIGIBLE");
    primaryTop.forEach((candidate, index) => {
      lines.push(`${index + 1}. ${candidate.entity}`);
      lines.push(`   score: ${candidate.score}`);
      lines.push(`   editorialContributionPct: ${candidate.editorialContributionPct ?? 0}%`);
      lines.push(`   candidateOnly: ${candidate.candidateOnly ? "true" : "false"}`);
      lines.push(`   supportingPublicationCount: ${candidate.supportingPublicationCount ?? 0}`);
      lines.push(`   eligibility: ${candidate.eligibilityReason ?? "n/a"}`);
      lines.push(`   sources: ${candidate.sources.join(", ") || "none"}`);
      lines.push(
        `   sourceMix: ${
          candidate.sourceMix
            ? Object.entries(candidate.sourceMix)
                .map(([k, v]) => `${k}:${v}`)
                .join(", ")
            : "none"
        }`,
      );
      lines.push(`   restaurants: ${candidate.restaurants.join(", ") || "none"}`);
      lines.push(`   neighborhoods: ${candidate.neighborhoods.join(", ") || "none"}`);
    });
  }
  if (aboutToHitTop.length > 0) {
    lines.push("ABOUT-TO-HIT ELIGIBLE (CANDIDATE-ONLY)");
    aboutToHitTop.forEach((candidate, index) => {
      lines.push(`${index + 1}. ${candidate.entity}`);
      lines.push(`   score: ${candidate.score}`);
      lines.push(`   editorialContributionPct: ${candidate.editorialContributionPct ?? 0}%`);
      lines.push(`   candidateOnly: true`);
      lines.push(`   supportingPublicationCount: ${candidate.supportingPublicationCount ?? 0}`);
      lines.push(`   eligibility: ${candidate.eligibilityReason ?? "n/a"}`);
      lines.push(`   sources: ${candidate.sources.join(", ") || "none"}`);
    });
  }
  return lines.join("\n");
}
