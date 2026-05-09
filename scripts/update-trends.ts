/**
 * MVP ingestion entry: simulates pulling real-world signals (no APIs yet),
 * writes `data/la-food-trends.json` in the canonical `LaFoodTrendsDataFile` shape.
 */

import fs from "node:fs/promises";
import { laFoodTrendsFileToDiskJson } from "@/lib/normalizeTrend";
import { buildSimulatedTrendsFile } from "@/lib/updateTrendsSimulation";
import { LA_FOOD_TRENDS_DATA_FILE } from "@/lib/laFoodTrendsData";
import { gatherSignals } from "@/lib/signals/sources";
import { getLastEditorialIngestionStats } from "@/lib/signals/sources/editorialSignals";
import {
  buildTrendCandidates,
  formatTopSignalCandidatesForConsole,
} from "@/lib/signals/buildTrendCandidates";
import {
  dataSourceModeSummary,
  diffTrendSnapshots,
  readParsedTrendsJsonFromDisk,
  snapshotFromParsed,
  sourceInventory,
} from "@/lib/pipelineAudit";

function formatEditorialSignalsLog(signals: ReturnType<typeof buildTrendCandidates>, topN = 5): string {
  const lines: string[] = [];
  lines.push("EDITORIAL SIGNALS");
  if (signals.length === 0) {
    lines.push("- top editorial convergence candidates: none");
    return lines.join("\n");
  }
  lines.push("- top editorial convergence candidates:");
  signals.slice(0, topN).forEach((candidate, i) => {
    lines.push(
      `  ${i + 1}. ${candidate.entity} | score=${candidate.score} | sources=${candidate.sources.join(", ")}`,
    );
  });
  return lines.join("\n");
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const startedAt = new Date().toISOString();
  const beforeParsed = await readParsedTrendsJsonFromDisk();
  const before = beforeParsed ? snapshotFromParsed(beforeParsed) : null;
  console.log(
    JSON.stringify({
      event: "cron-job-started",
      jobType: "simulation",
      startedAt,
      trendsBefore: before?.totalCount ?? null,
      ...dataSourceModeSummary(),
    }),
  );
  console.log(
    JSON.stringify({
      event: "cron-source-inventory",
      jobType: "simulation",
      sources: sourceInventory(),
    }),
  );

  const lastUpdated = new Date().toISOString();
  const data = buildSimulatedTrendsFile(lastUpdated);
  const signals = await gatherSignals(data, lastUpdated);
  const candidates = buildTrendCandidates(signals, {
    minScore: 22,
    limit: 12,
    nowIso: lastUpdated,
  });
  const allCandidatesWithEligibility = buildTrendCandidates(signals, {
    minScore: 8,
    limit: 24,
    nowIso: lastUpdated,
    includeIneligibleCandidateOnly: true,
  });
  const editorialSources = new Set(["eater", "infatuation", "latimes"]);
  const editorialSignals = signals.filter((signal) => editorialSources.has(signal.source));
  const matchScopeCounts = editorialSignals.reduce(
    (acc, signal) => {
      const rawScope = signal.metadata?.matchScope;
      const scope =
        rawScope === "title" || rawScope === "subhead" || rawScope === "title+subhead"
          ? rawScope
          : "unknown";
      acc[scope] = (acc[scope] ?? 0) + 1;
      return acc;
    },
    { title: 0, subhead: 0, "title+subhead": 0, unknown: 0 } as Record<string, number>,
  );
  const editorialCandidates = buildTrendCandidates(editorialSignals, {
    minScore: 8,
    limit: 8,
    nowIso: lastUpdated,
  });
  const editorialStats = getLastEditorialIngestionStats();
  console.log(formatTopSignalCandidatesForConsole(candidates, 6));
  console.log(
    JSON.stringify({
      event: "convergence-candidate-eligibility",
      jobType: "simulation",
      candidates: allCandidatesWithEligibility.slice(0, 16).map((candidate) => ({
        entity: candidate.entity,
        score: candidate.score,
        candidateOnly: Boolean(candidate.candidateOnly),
        editorialContributionPct: candidate.editorialContributionPct ?? 0,
        supportingPublicationCount: candidate.supportingPublicationCount ?? 0,
        sourceMix: candidate.sourceMix ?? {},
        primaryEligible: candidate.primaryEligible ?? true,
        aboutToHitEligible: candidate.aboutToHitEligible ?? true,
        eligibilityReason: candidate.eligibilityReason ?? "eligible",
      })),
      blockedBySafeguards: allCandidatesWithEligibility
        .filter((candidate) => candidate.candidateOnly && !candidate.aboutToHitEligible)
        .map((candidate) => ({
          entity: candidate.entity,
          reason: candidate.eligibilityReason ?? "blocked",
          supportingSignals: candidate.supportingSignals.length,
        })),
    }),
  );
  console.log(
    JSON.stringify({
      event: "editorial-signals-summary",
      jobType: "simulation",
      articlesScanned: editorialStats.scannedTotal,
      articlesByPublication: editorialStats.scannedBySource,
      entitiesExtracted: editorialStats.entitiesExtracted,
      publicationOverlap: editorialStats.overlapEntities,
      topCandidateOnlyEntities: editorialStats.candidateOnlyTopEntities,
      topDishCandidates: editorialStats.topDishCandidates,
      topFormatCandidates: editorialStats.topFormatCandidates,
      topIngredientCandidates: editorialStats.topIngredientCandidates,
      neighborhoodMentionsAttached: editorialStats.neighborhoodMentionsAttached,
      suppressedNeighborhoodCandidates: editorialStats.suppressedNeighborhoodCandidates,
      ignoredGenericMatches: editorialStats.ignoredGenericMatches,
      failedPublications: editorialStats.failedSources,
      matchScopeCounts,
      sampleEditorialSignals: editorialSignals.slice(0, 8).map((signal) => ({
        entity: signal.entity,
        entityType: signal.entityType,
        publication: signal.source,
        articleTitle:
          typeof signal.metadata?.articleTitle === "string" ? signal.metadata.articleTitle : null,
        confidence: signal.confidence,
        sourceWeight:
          typeof signal.metadata?.sourceWeight === "number" ? signal.metadata.sourceWeight : null,
        reason:
          typeof signal.metadata?.matchScope === "string" ? signal.metadata.matchScope : "unknown",
        matchedCategory:
          typeof signal.metadata?.matchedCategory === "string" ? signal.metadata.matchedCategory : null,
        candidateOnly: Boolean(signal.metadata?.candidateOnly),
      })),
    }),
  );
  console.log(formatEditorialSignalsLog(editorialCandidates, 5));

  const forDisk = laFoodTrendsFileToDiskJson(data);
  const nextText = `${JSON.stringify(forDisk, null, 2)}\n`;
  let prevText = "";
  try {
    prevText = await fs.readFile(LA_FOOD_TRENDS_DATA_FILE, "utf-8");
  } catch {
    prevText = "";
  }
  const wroteDataJson = prevText !== nextText;
  if (!dryRun) {
    await fs.writeFile(LA_FOOD_TRENDS_DATA_FILE, nextText, "utf-8");
  }

  const afterParsed = await readParsedTrendsJsonFromDisk();
  const after = afterParsed ? snapshotFromParsed(afterParsed) : null;
  const changed = before && after ? diffTrendSnapshots(before, after) : null;
  console.log(
    JSON.stringify({
      event: "cron-job-finished",
      jobType: "simulation",
      startedAt,
      finishedAt: new Date().toISOString(),
      trendsBefore: before?.totalCount ?? null,
      trendsAfter: after?.totalCount ?? data.trends.length + data.aboutToHit.length,
      primaryBefore: before?.primaryCount ?? null,
      primaryAfter: after?.primaryCount ?? data.trends.length,
      aboutToHitBefore: before?.aboutToHitCount ?? null,
      aboutToHitAfter: after?.aboutToHitCount ?? data.aboutToHit.length,
      changedTrendTitles: changed?.changedTitles ?? [],
      changedRestaurants: changed?.changedRestaurants ?? [],
      changedScores: changed?.changedScores ?? [],
      addedTrends: changed?.addedTrends ?? [],
      removedTrends: changed?.removedTrends ?? [],
      wroteDataJson,
      dryRun,
      committed: false,
      commitSha: null,
      outputPath: LA_FOOD_TRENDS_DATA_FILE,
    }),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
