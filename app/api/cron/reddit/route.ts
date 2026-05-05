import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { ingestRedditChatter } from "@/lib/sources/reddit";

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

  try {
    const { signals, health } = await ingestRedditChatter();

    console.log(
      JSON.stringify({
        source: "reddit-ingest",
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
      signalCount: signals.length,
      health,
      signals: signals.slice(0, RESPONSE_SIGNAL_CAP),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
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
