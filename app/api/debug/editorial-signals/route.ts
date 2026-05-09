import { NextResponse } from "next/server";
import { readLaFoodTrendsDataFile } from "@/lib/laFoodTrendsData";
import { buildTrendCandidates } from "@/lib/signals/buildTrendCandidates";
import {
  getEditorialSignals,
  getLastEditorialIngestionStats,
} from "@/lib/signals/sources/editorialSignals";
import type { TrendSignal } from "@/lib/signals/types";
import { classifyTrendMaturity } from "@/lib/signals/trendMaturity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EditorialSource = "eater" | "infatuation" | "latimes";

function countByEntity(
  signals: TrendSignal[],
  entityType: "dish" | "restaurant" | "cuisine" | "ingredient",
  limit = 8,
): Array<{ entity: string; count: number }> {
  const counts = new Map<string, number>();
  for (const signal of signals) {
    if (signal.entityType !== entityType) continue;
    const key = signal.entity.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([entity, count]) => ({ entity, count }));
}

function matchScopeCounts(signals: TrendSignal[]) {
  const out = { title: 0, subhead: 0, "title+subhead": 0, unknown: 0 };
  for (const signal of signals) {
    const scope = signal.metadata?.matchScope;
    if (scope === "title" || scope === "subhead" || scope === "title+subhead") {
      out[scope] += 1;
      continue;
    }
    out.unknown += 1;
  }
  return out;
}

function feedStatus(scannedBySource: Record<EditorialSource, number>) {
  return {
    eater: scannedBySource.eater > 0 ? "green" : "red",
    infatuation: scannedBySource.infatuation > 0 ? "green" : "red",
    latimes: scannedBySource.latimes > 0 ? "green" : "red",
  };
}

function supportTypesForCandidateSignals(signals: TrendSignal[]): string[] {
  const types = new Set<string>();
  let hasGooglePlaces = false;
  let hasReddit = false;
  let hasReservation = false;
  const editorialPublications = new Set<string>();
  for (const signal of signals) {
    if (signal.source === "google_places") hasGooglePlaces = true;
    if (signal.source === "reddit") hasReddit = true;
    if (signal.source === "reservation") hasReservation = true;
    if (signal.source === "eater" || signal.source === "infatuation" || signal.source === "latimes") {
      const publication =
        typeof signal.metadata?.publication === "string" ? signal.metadata.publication : signal.source;
      editorialPublications.add(publication);
    }
  }
  if (hasGooglePlaces) types.add("google_places");
  if (hasReddit) types.add("reddit");
  if (hasReservation) types.add("reservation_or_review");
  if (editorialPublications.size >= 2) types.add("editorial_overlap");
  return [...types];
}

export async function GET() {
  try {
    const data = await readLaFoodTrendsDataFile();
    const nowIso = new Date().toISOString();
    const allSignals = await getEditorialSignals(data, nowIso);
    const editorialSignals = allSignals.filter(
      (signal) =>
        signal.source === "eater" || signal.source === "infatuation" || signal.source === "latimes",
    );
    const editorialCandidates = buildTrendCandidates(editorialSignals, {
      minScore: 8,
      limit: 20,
      nowIso,
      includeIneligibleCandidateOnly: true,
    });
    const stats = getLastEditorialIngestionStats();
    const byType = {
      dish: editorialSignals.filter((s) => s.entityType === "dish").length,
      restaurant: editorialSignals.filter((s) => s.entityType === "restaurant").length,
      cuisine: editorialSignals.filter((s) => s.entityType === "cuisine").length,
      ingredient: editorialSignals.filter((s) => s.entityType === "ingredient").length,
    };
    const candidateOnlySignals = editorialSignals.filter((s) => Boolean(s.metadata?.candidateOnly));

    return NextResponse.json({
      now: nowIso,
      lastFetchTimestamp: nowIso,
      feedStatus: feedStatus(stats.scannedBySource),
      articleCountPerPublication: stats.scannedBySource,
      extractedEntityCounts: {
        total: editorialSignals.length,
        byType,
        byMatchScope: matchScopeCounts(editorialSignals),
      },
      topMatchedDishes: countByEntity(editorialSignals, "dish"),
      topMatchedRestaurants: countByEntity(editorialSignals, "restaurant"),
      topMatchedCuisines: countByEntity(editorialSignals, "cuisine"),
      topMatchedIngredients: countByEntity(editorialSignals, "ingredient"),
      topCandidateOnlyEntities: stats.candidateOnlyTopEntities,
      candidateOnlyEntitiesExcludingNeighborhoods: stats.candidateOnlyTopEntities,
      topDishCandidates: stats.topDishCandidates,
      topFormatCandidates: stats.topFormatCandidates,
      topIngredientCandidates: stats.topIngredientCandidates,
      neighborhoodMentionsAttached: stats.neighborhoodMentionsAttached,
      suppressedNeighborhoodCandidates: stats.suppressedNeighborhoodCandidates,
      ignoredGenericMatches: stats.ignoredGenericMatches,
      failedSources: stats.failedSources,
      publicationOverlap: stats.overlapEntities,
      candidateOnlyCount: candidateOnlySignals.length,
      convergenceCandidateDebug: editorialCandidates.map((candidate) => ({
        ...(function () {
          const maturity = classifyTrendMaturity({
            entity: candidate.entity,
            score: candidate.score,
            stage: candidate.candidateOnly
              ? candidate.aboutToHitEligible
                ? "about_to_hit"
                : "blocked"
              : "top5",
            candidateOnly: Boolean(candidate.candidateOnly),
            primaryEligible: candidate.primaryEligible ?? true,
            aboutToHitEligible: candidate.aboutToHitEligible ?? true,
            supportingPublicationCount: candidate.supportingPublicationCount ?? 0,
            sourceMix: candidate.sourceMix ?? {},
            supportTypes: supportTypesForCandidateSignals(candidate.supportingSignals),
            editorialContributionPct: candidate.editorialContributionPct ?? 0,
            replacementBlocked: false,
            eligibilityReason: candidate.eligibilityReason ?? null,
            previousHistory: [],
          });
          return {
            maturityState: maturity.state,
            maturityConfidence: Number(maturity.confidence.toFixed(2)),
            maturityReason: maturity.maturityReason,
            velocityHint: maturity.velocityHint,
            riskFlags: maturity.riskFlags,
          };
        })(),
        entity: candidate.entity,
        score: candidate.score,
        editorialContributionPct: candidate.editorialContributionPct ?? 0,
        candidateOnly: Boolean(candidate.candidateOnly),
        sourceMix: candidate.sourceMix ?? {},
        supportingPublicationCount: candidate.supportingPublicationCount ?? 0,
        primaryEligible: candidate.primaryEligible ?? true,
        aboutToHitEligible: candidate.aboutToHitEligible ?? true,
        eligibilityReason: candidate.eligibilityReason ?? "eligible",
      })),
      sampleSignals: editorialSignals.slice(0, 12).map((signal) => ({
        source: signal.source,
        entity: signal.entity,
        entityType: signal.entityType,
        confidence: signal.confidence,
        sourceWeight:
          typeof signal.metadata?.sourceWeight === "number" ? signal.metadata.sourceWeight : null,
        reason:
          typeof signal.metadata?.matchScope === "string" ? signal.metadata.matchScope : "unknown",
        matchedCategory:
          typeof signal.metadata?.matchedCategory === "string" ? signal.metadata.matchedCategory : null,
        articleTitle:
          typeof signal.metadata?.articleTitle === "string" ? signal.metadata.articleTitle : null,
        matchedPhrase:
          typeof signal.metadata?.matchedPhrase === "string" ? signal.metadata.matchedPhrase : null,
        candidateOnly: Boolean(signal.metadata?.candidateOnly),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        now: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
