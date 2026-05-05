import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { simulateWeekendSignalOnly } from "@/lib/cronRefresh";
import { readLaFoodTrendsDataFile } from "@/lib/laFoodTrendsData";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await readLaFoodTrendsDataFile();
    simulateWeekendSignalOnly(data);
    return NextResponse.json({ success: true, type: "weekend" });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
