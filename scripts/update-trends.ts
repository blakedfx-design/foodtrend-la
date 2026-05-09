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
import type { TrendCandidate } from "@/lib/signals/types";

const TREND_HISTORY_FILE = "data/trend-history.json";

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

type ReplacementDecision = {
  replacementCandidate: string;
  replacedTrend: string;
  replacementAllowed: boolean;
  replacementReason: string;
  supportTypes: string[];
};

type TrendHistoryStage = "about_to_hit" | "top5" | "fading" | "blocked";

type TrendHistoryEntry = {
  entity: string;
  timestamp: string;
  week: string;
  stage: TrendHistoryStage;
  score: number;
  sourceMix: Record<string, number>;
  supportTypes: string[];
  editorialContributionPct: number;
  candidateOnly: boolean;
  replacementBlocked: boolean;
  replacementReason: string | null;
};

function supportTypesForCandidate(candidate: TrendCandidate): string[] {
  const types = new Set<string>();
  let hasGooglePlaces = false;
  let hasReddit = false;
  let hasReservation = false;
  const editorialPublications = new Set<string>();

  for (const signal of candidate.supportingSignals) {
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

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseTrendHistory(raw: string): TrendHistoryEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => isRecord(row) && typeof row.entity === "string") as TrendHistoryEntry[];
  } catch {
    return [];
  }
}

function toHistoryEntry(
  candidate: TrendCandidate,
  stage: TrendHistoryStage,
  timestamp: string,
  week: string,
  replacementBlocked: boolean,
  replacementReason: string | null,
): TrendHistoryEntry {
  return {
    entity: candidate.entity,
    timestamp,
    week,
    stage,
    score: candidate.score,
    sourceMix: candidate.sourceMix ?? {},
    supportTypes: supportTypesForCandidate(candidate),
    editorialContributionPct: candidate.editorialContributionPct ?? 0,
    candidateOnly: Boolean(candidate.candidateOnly),
    replacementBlocked,
    replacementReason,
  };
}

function buildTrendHistorySnapshot(args: {
  timestamp: string;
  week: string;
  currentTop5: string[];
  guardedTop5: TrendCandidate[];
  candidatePool: TrendCandidate[];
  replacementDecisions: ReplacementDecision[];
}): TrendHistoryEntry[] {
  const {
    timestamp,
    week,
    currentTop5,
    guardedTop5,
    candidatePool,
    replacementDecisions,
  } = args;
  const out: TrendHistoryEntry[] = [];
  const currentTop5Set = new Set(currentTop5);
  const guardedTop5Set = new Set(guardedTop5.map((c) => c.entity));
  const byEntity = new Map(candidatePool.map((c) => [c.entity, c]));
  const blockedByEntity = new Map(
    replacementDecisions
      .filter((d) => !d.replacementAllowed)
      .map((d) => [d.replacementCandidate, d]),
  );

  for (const candidate of guardedTop5) {
    out.push(toHistoryEntry(candidate, "top5", timestamp, week, false, null));
  }

  for (const name of currentTop5Set) {
    if (guardedTop5Set.has(name)) continue;
    const candidate = byEntity.get(name);
    if (!candidate) continue;
    out.push(toHistoryEntry(candidate, "fading", timestamp, week, false, null));
  }

  for (const candidate of candidatePool) {
    if (!candidate.candidateOnly || !candidate.aboutToHitEligible) continue;
    out.push(toHistoryEntry(candidate, "about_to_hit", timestamp, week, false, null));
  }

  for (const candidate of candidatePool) {
    if (candidate.candidateOnly && !candidate.aboutToHitEligible && (candidate.supportingPublicationCount ?? 0) >= 1) {
      out.push(
        toHistoryEntry(
          candidate,
          "blocked",
          timestamp,
          week,
          true,
          candidate.eligibilityReason ?? "blocked",
        ),
      );
      continue;
    }
    const blocked = blockedByEntity.get(candidate.entity);
    if (!blocked) continue;
    const hasPublicationSupport = (candidate.supportingPublicationCount ?? 0) >= 1;
    if (!hasPublicationSupport) continue;
    out.push(
      toHistoryEntry(
        candidate,
        "blocked",
        timestamp,
        week,
        true,
        blocked.replacementReason,
      ),
    );
  }

  const dedup = new Map<string, TrendHistoryEntry>();
  for (const entry of out) {
    const key = `${entry.entity}::${entry.week}`;
    if (!dedup.has(key)) dedup.set(key, entry);
  }
  return [...dedup.values()];
}

async function appendTrendHistory(
  entries: TrendHistoryEntry[],
  dryRun: boolean,
): Promise<{ wouldWrite: number; appended: number }> {
  let existing: TrendHistoryEntry[] = [];
  try {
    const raw = await fs.readFile(TREND_HISTORY_FILE, "utf-8");
    existing = parseTrendHistory(raw);
  } catch {
    existing = [];
  }

  const existingKeys = new Set(existing.map((row) => `${row.entity}::${row.week}`));
  const toAppend = entries.filter((row) => !existingKeys.has(`${row.entity}::${row.week}`));
  if (dryRun) return { wouldWrite: toAppend.length, appended: 0 };

  const next = [...existing, ...toAppend];
  await fs.writeFile(TREND_HISTORY_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  return { wouldWrite: toAppend.length, appended: toAppend.length };
}

function applyTop5PreservationGuard(
  currentTop5: string[],
  proposedTop5Candidates: TrendCandidate[],
): {
  guardedTop5: TrendCandidate[];
  decisions: ReplacementDecision[];
} {
  const proposedTop5 = proposedTop5Candidates.slice(0, 5);
  const proposedNames = proposedTop5.map((c) => c.entity);
  const incoming = proposedTop5.filter((c) => !currentTop5.includes(c.entity));
  const outgoing = currentTop5.filter((name) => !proposedNames.includes(name));
  const guarded = [...proposedTop5];
  const decisions: ReplacementDecision[] = [];

  for (let i = 0; i < incoming.length; i += 1) {
    const candidate = incoming[i];
    const replacedTrend = outgoing[i] ?? "(none)";
    const supportTypes = supportTypesForCandidate(candidate);
    const manualOnly = candidate.supportingSignals.every((s) => s.source === "manual_editorial");
    const hasEnoughNonEditorialSupport = supportTypes.length >= 2;
    const replacementAllowed = hasEnoughNonEditorialSupport && !manualOnly;
    let replacementReason = "allowed: >=2 support types";
    if (manualOnly) replacementReason = "blocked: manual_editorial-only candidate";
    else if (!hasEnoughNonEditorialSupport)
      replacementReason = "blocked: requires >=2 support types (editorial overlap counts as one)";

    decisions.push({
      replacementCandidate: candidate.entity,
      replacedTrend,
      replacementAllowed,
      replacementReason,
      supportTypes,
    });

    if (!replacementAllowed && replacedTrend !== "(none)") {
      const idx = guarded.findIndex((c) => c.entity === candidate.entity);
      const outgoingInCandidates = proposedTop5Candidates.find((c) => c.entity === replacedTrend);
      if (idx >= 0 && outgoingInCandidates) guarded[idx] = outgoingInCandidates;
      else if (idx >= 0) {
        guarded[idx] = {
          ...candidate,
          entity: replacedTrend,
          score: candidate.score,
        };
      }
    }
  }

  return { guardedTop5: guarded.slice(0, 5), decisions };
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
  const editorialCandidatesForHistory = buildTrendCandidates(editorialSignals, {
    minScore: 0,
    limit: 30,
    nowIso: lastUpdated,
    includeIneligibleCandidateOnly: true,
  });
  const editorialStats = getLastEditorialIngestionStats();
  const currentTop5 = data.trends.slice(0, 5).map((t) => t.name);
  const proposedTop5 = candidates.filter((c) => c.primaryEligible !== false).slice(0, 5);
  const guard = applyTop5PreservationGuard(currentTop5, candidates.filter((c) => c.primaryEligible !== false));
  const weekKey = isoWeekKey(new Date(lastUpdated));
  const historySnapshot = buildTrendHistorySnapshot({
    timestamp: lastUpdated,
    week: weekKey,
    currentTop5,
    guardedTop5: guard.guardedTop5,
    candidatePool: [
      ...new Map(
        [...allCandidatesWithEligibility, ...editorialCandidatesForHistory].map((c) => [c.entity, c]),
      ).values(),
    ],
    replacementDecisions: guard.decisions,
  });
  const historyWrite = await appendTrendHistory(historySnapshot, dryRun);
  console.log(formatTopSignalCandidatesForConsole(candidates, 6));
  console.log(
    JSON.stringify({
      event: "top5-preservation-guard",
      currentTop5,
      proposedTop5: proposedTop5.map((c) => c.entity),
      guardedTop5: guard.guardedTop5.map((c) => c.entity),
      decisions: guard.decisions,
    }),
  );
  console.log(
    JSON.stringify({
      event: "trend-history-preview",
      jobType: "simulation",
      week: weekKey,
      entriesWouldWrite: historyWrite.wouldWrite,
      dryRun,
      sampleEntries: historySnapshot.slice(0, 8),
    }),
  );
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
      blockedTop5Replacements: guard.decisions.filter((d) => !d.replacementAllowed),
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
      wroteTrendHistory: !dryRun && historyWrite.appended > 0,
      trendHistoryEntriesWouldWrite: historyWrite.wouldWrite,
      trendHistoryEntriesAppended: historyWrite.appended,
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
