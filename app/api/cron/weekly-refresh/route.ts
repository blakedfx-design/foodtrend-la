import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { buildSimulatedTrendsFile } from "@/lib/updateTrendsSimulation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handle(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    buildSimulatedTrendsFile(now);
    return NextResponse.json({ success: true, type: "weekly" });
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
