import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import {
  applyWeeklyRefreshToParsed,
  writeBackLaFoodTrendsJson,
} from "@/lib/github-writeback";
import { dataSourceModeSummary, envPresenceFlags, sourceInventory } from "@/lib/pipelineAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  console.log(
    JSON.stringify({
      event: "cron-job-started",
      jobType: "weekly",
      startedAt,
      ...dataSourceModeSummary(),
    }),
  );
  console.log(
    JSON.stringify({
      event: "cron-source-inventory",
      jobType: "weekly",
      sources: sourceInventory(),
      envFlags: envPresenceFlags(),
    }),
  );

  try {
    const result = await writeBackLaFoodTrendsJson(
      applyWeeklyRefreshToParsed,
      "chore(cron): weekly FoodTrend LA refresh",
    );
    console.log(
      JSON.stringify({
        event: "cron-job-finished",
        jobType: "weekly",
        startedAt,
        finishedAt: new Date().toISOString(),
        trendsBefore: result.before.totalCount,
        trendsAfter: result.after.totalCount,
        primaryBefore: result.before.primaryCount,
        primaryAfter: result.after.primaryCount,
        aboutToHitBefore: result.before.aboutToHitCount,
        aboutToHitAfter: result.after.aboutToHitCount,
        changedTrendTitles: result.changed.changedTitles,
        changedRestaurants: result.changed.changedRestaurants,
        changedScores: result.changed.changedScores,
        addedTrends: result.changed.addedTrends,
        removedTrends: result.changed.removedTrends,
        wroteDataJson: result.wroteJson,
        committed: result.commitSha != null,
        commitSha: result.commitSha,
        updatedAt: result.updatedAt,
        ...dataSourceModeSummary(),
      }),
    );

    return NextResponse.json({
      success: true,
      type: "weekly",
      updatedAt: result.updatedAt,
      committed: result.commitSha != null,
      commitSha: result.commitSha,
      wroteDataJson: result.wroteJson,
      audit: {
        trendsBefore: result.before.totalCount,
        trendsAfter: result.after.totalCount,
        changedTrendTitles: result.changed.changedTitles,
        changedRestaurants: result.changed.changedRestaurants,
        changedScores: result.changed.changedScores,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(
      JSON.stringify({
        event: "cron-job-failed",
        jobType: "weekly",
        startedAt,
        failedAt: new Date().toISOString(),
        error: msg,
      }),
    );
    return NextResponse.json(
      {
        success: false,
        type: "weekly",
        updatedAt: new Date().toISOString(),
        committed: false,
        commitSha: null,
        error: msg,
      },
      { status: 500 },
    );
  }
}
