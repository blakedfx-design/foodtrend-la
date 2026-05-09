import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { writeBackLaFoodTrendsJson } from "@/lib/github-writeback";
import { requireGooglePlacesApiKey } from "@/lib/places";
import { applyWeekendGooglePlacesSignalsToParsed } from "@/lib/weekendPlacesCron";
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
      jobType: "weekend",
      startedAt,
      ...dataSourceModeSummary(),
    }),
  );
  console.log(
    JSON.stringify({
      event: "cron-source-inventory",
      jobType: "weekend",
      sources: sourceInventory(),
      envFlags: envPresenceFlags(),
    }),
  );

  try {
    requireGooglePlacesApiKey();

    const result = await writeBackLaFoodTrendsJson(
      async (parsed) => {
        await applyWeekendGooglePlacesSignalsToParsed(parsed);
      },
      "chore(cron): weekend FoodTrend LA — Places + Reddit LA + open listings signals",
    );
    console.log(
      JSON.stringify({
        event: "cron-job-finished",
        jobType: "weekend",
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
      type: "weekend",
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
    const missingPlacesKey = msg.includes("GOOGLE_PLACES_API_KEY");
    console.log(
      JSON.stringify({
        event: "cron-job-failed",
        jobType: "weekend",
        startedAt,
        failedAt: new Date().toISOString(),
        error: msg,
      }),
    );
    return NextResponse.json(
      {
        success: false,
        type: "weekend",
        updatedAt: new Date().toISOString(),
        committed: false,
        commitSha: null,
        error: msg,
      },
      { status: missingPlacesKey ? 503 : 500 },
    );
  }
}
