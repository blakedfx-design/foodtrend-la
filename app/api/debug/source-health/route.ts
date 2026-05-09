import { NextResponse } from "next/server";
import { readLaFoodTrendsDataFile } from "@/lib/laFoodTrendsData";
import {
  connectorHealthSummary,
  dataSourceModeSummary,
  envPresenceFlags,
  envVarUsageInventory,
} from "@/lib/pipelineAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await readLaFoodTrendsDataFile();
    const lastUpdated = data.lastUpdated?.trim() || null;
    const refreshType = data.refreshType ?? null;
    const flags = envPresenceFlags();
    const connectors = connectorHealthSummary(lastUpdated, refreshType);
    const missingByConnector: Record<string, string[]> = {};
    for (const c of connectors) {
      if (c.missingEnvVars.length > 0) {
        missingByConnector[c.connector] = c.missingEnvVars;
      }
    }

    return NextResponse.json({
      now: new Date().toISOString(),
      dataSourceMode: dataSourceModeSummary(),
      overallStatus: connectors.every((c) => c.status === "green")
        ? "green"
        : connectors.some((c) => c.status === "yellow")
          ? "yellow"
          : "red",
      connectors,
      missingEnvVarsByConnector: missingByConnector,
      lastKnownDataUpdate: {
        lastUpdated,
        refreshType,
      },
      environmentFlags: {
        onVercel: flags.onVercel,
        nodeEnv: flags.nodeEnv,
        hasCronSecret: flags.hasCronSecret,
        hasGooglePlacesKey: flags.hasGooglePlacesKey,
        hasRedditCredentials: flags.hasRedditClient,
        hasListingsSupplyKey: flags.hasListingsSupplyKey,
        hasGitHubWriteback: flags.hasGitHubWriteback,
      },
      envVarUsage: envVarUsageInventory(),
      notes: [
        "No secret values are exposed; only readiness booleans and missing variable names.",
        "GitHub writeback path is currently hardcoded to data/la-food-trends.json.",
      ],
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
