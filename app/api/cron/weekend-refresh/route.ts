import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import {
  applyWeekendRefreshToParsed,
  writeBackLaFoodTrendsJson,
} from "@/lib/github-writeback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { updatedAt, commitSha } = await writeBackLaFoodTrendsJson(
      applyWeekendRefreshToParsed,
      "chore(cron): weekend FoodTrend LA signal refresh",
    );

    return NextResponse.json({
      success: true,
      type: "weekend",
      updatedAt,
      committed: commitSha != null,
      commitSha,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        success: false,
        type: "weekend",
        updatedAt: new Date().toISOString(),
        committed: false,
        commitSha: null,
        error: msg,
      },
      { status: 500 },
    );
  }
}
