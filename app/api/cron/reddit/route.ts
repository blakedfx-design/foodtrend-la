import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { ingestRedditChatter } from "@/lib/sources/reddit";
import {
  dataSourceModeSummary,
  envPresenceFlags,
  readParsedTrendsJsonFromDisk,
  snapshotFromParsed,
  sourceInventory,
} from "@/lib/pipelineAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESPONSE_SIGNAL_CAP = 400;

/**
 * Reddit LA ingestion (official OAuth API). Returns normalized signals + health;
 * does not mutate `la-food-trends.json` (merge downstream or in weekly pipeline).
 */
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const beforeParsed = await readParsedTrendsJsonFromDisk();
  const beforeSnapshot = beforeParsed ? snapshotFromParsed(beforeParsed) : null;
  console.log(
    JSON.stringify({
      event: "cron-job-started",
      jobType: "reddit",
      startedAt,
      trendsBefore: beforeSnapshot?.totalCount ?? null,
      ...dataSourceModeSummary(),
    }),
  );
  console.log(
    JSON.stringify({
      event: "cron-source-inventory",
      jobType: "reddit",
      sources: sourceInventory(),
      envFlags: envPresenceFlags(),
    }),
  );

  try {
    const { signals, health } = await ingestRedditChatter();
    const afterParsed = await readParsedTrendsJsonFromDisk();
    const afterSnapshot = afterParsed ? snapshotFromParsed(afterParsed) : null;

    console.log(
      JSON.stringify({
        source: "reddit-ingest",
        jobType: "reddit",
        startedAt,
        finishedAt: new Date().toISOString(),
        trendsBefore: beforeSnapshot?.totalCount ?? null,
        trendsAfter: afterSnapshot?.totalCount ?? null,
        changedTrendTitles: [],
        changedRestaurants: [],
        changedScores: [],
        wroteDataJson: false,
        committed: false,
        fetchedCount: health.fetchedCount,
        uniqueFetched: health.uniqueFetched,
        keptCount: health.keptCount,
        rejectedCount: health.rejectedCount,
        topDishTerms: health.topDishTerms.slice(0, 8),
        topNeighborhoodTerms: health.topNeighborhoodTerms.slice(0, 8),
        searchQueriesRun: health.searchQueriesRun,
        cacheHits: health.cacheHits,
        rateLimitRemaining: health.rateLimitRemaining,
      }),
    );

    return NextResponse.json({
      success: true,
      type: "reddit",
      startedAt,
      finishedAt: new Date().toISOString(),
      signalCount: signals.length,
      wroteDataJson: false,
      audit: {
        trendsBefore: beforeSnapshot?.totalCount ?? null,
        trendsAfter: afterSnapshot?.totalCount ?? null,
        changedTrendTitles: [],
        changedRestaurants: [],
        changedScores: [],
      },
      health,
      signals: signals.slice(0, RESPONSE_SIGNAL_CAP),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(
      JSON.stringify({
        event: "cron-job-failed",
        jobType: "reddit",
        startedAt,
        failedAt: new Date().toISOString(),
        error: msg,
      }),
    );
    return NextResponse.json(
      {
        success: false,
        type: "reddit",
        error: msg,
        signals: [],
      },
      { status: 500 },
    );
  }
}
