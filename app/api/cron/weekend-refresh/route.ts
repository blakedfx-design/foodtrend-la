import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { writeBackLaFoodTrendsJson } from "@/lib/github-writeback";
import { requireGooglePlacesApiKey } from "@/lib/places";
import { applyWeekendGooglePlacesSignalsToParsed } from "@/lib/weekendPlacesCron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireGooglePlacesApiKey();

    const { updatedAt, commitSha } = await writeBackLaFoodTrendsJson(
      async (parsed) => {
        await applyWeekendGooglePlacesSignalsToParsed(parsed);
      },
      "chore(cron): weekend FoodTrend LA — Places + Reddit LA signals",
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
    const missingPlacesKey = msg.includes("GOOGLE_PLACES_API_KEY");
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
