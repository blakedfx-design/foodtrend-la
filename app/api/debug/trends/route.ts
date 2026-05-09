import { NextResponse } from "next/server";
import {
  DISPLAY_ABOUT_TO_HIT_COUNT,
  DISPLAY_PRIMARY_TREND_COUNT,
  getDisplayAboutToHit,
  getDisplayPrimaryTrends,
  readLaFoodTrendsDataFile,
} from "@/lib/laFoodTrendsData";
import {
  dataSourceModeSummary,
  envPresenceFlags,
  envVarUsageInventory,
  readinessFlags,
  sourceInventory,
} from "@/lib/pipelineAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await readLaFoodTrendsDataFile();
    const flags = envPresenceFlags();
    const readiness = readinessFlags();
    const mode = dataSourceModeSummary();
    const primary = getDisplayPrimaryTrends(data, DISPLAY_PRIMARY_TREND_COUNT).map((t) => t.name);
    const about = getDisplayAboutToHit(data, DISPLAY_ABOUT_TO_HIT_COUNT).map((t) => t.name);

    return NextResponse.json({
      now: new Date().toISOString(),
      lastUpdated: data.lastUpdated,
      refreshType: data.refreshType ?? null,
      dataSourceMode: mode,
      trendCounts: {
        totalPrimary: data.trends.length,
        totalAboutToHit: data.aboutToHit.length,
        primaryShown: primary.length,
        aboutToHitShown: about.length,
      },
      trendTitlesServed: {
        primary,
        aboutToHit: about,
      },
      sourceList: sourceInventory(),
      environmentFlags: {
        nodeEnv: flags.nodeEnv,
        onVercel: flags.onVercel,
        hasCronSecret: flags.hasCronSecret,
        hasGooglePlacesKey: flags.hasGooglePlacesKey,
        hasRedditCredentials: flags.hasRedditClient,
        hasRedditPasswordGrant: flags.hasRedditPasswordGrant,
        hasListingsSupplyKey: flags.hasListingsSupplyKey,
        hasGitHubWriteback: flags.hasGitHubWriteback,
      },
      readiness,
      envVarUsage: envVarUsageInventory(),
      pipelineChecks: {
        weeklyRefreshWritesViaGitHub: flags.hasGitHubWriteback,
        weekendRefreshConnectedToLiveData: true,
        redditRouteWritesDataFile: false,
        pageReadsRuntimeJson: true,
        laFoodPageForceDynamic: true,
        homePageForceDynamic: true,
        frontendSWRLayerDetected: false,
        likelyStaticBuildOnly: false,
      },
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
