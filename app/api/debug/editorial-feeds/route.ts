import { NextResponse } from "next/server";
import { readLaFoodTrendsDataFile } from "@/lib/laFoodTrendsData";
import {
  compareTitlesAgainstLexicon,
  getEditorialFeedDiagnostics,
  getEditorialLexiconPreview,
} from "@/lib/signals/sources/editorialSignals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await readLaFoodTrendsDataFile();
    const diagnostics = await getEditorialFeedDiagnostics();
    const latimes = diagnostics.find((d) => d.source === "latimes") ?? null;
    const latimesTitles = latimes?.first10Titles ?? [];
    const lexicon = getEditorialLexiconPreview(data);
    const latimesLexiconComparison = compareTitlesAgainstLexicon(data, latimesTitles.slice(0, 10));

    return NextResponse.json({
      now: new Date().toISOString(),
      sources: diagnostics.map((d) => ({
        source: d.source,
        url: d.url,
        statusCode: d.statusCode,
        contentType: d.contentType,
        responseByteLength: d.responseByteLength,
        responsePreview: d.responsePreview,
        parserMode: d.parserMode,
        rawItemCount: d.rawItemCount,
        parsedArticleCount: d.parsedArticleCount,
        sampleTitles: d.sampleTitles,
        first10Titles: d.first10Titles,
        failureReason: d.failureReason,
        parseDiagnostics: d.parseDiagnostics,
        fetchTimestamp: d.fetchedAt,
      })),
      latimesTitleLexiconCoverage: {
        first10ArticleTitles: latimesTitles.slice(0, 10),
        comparison: latimesLexiconComparison,
        lexiconSummary: lexicon,
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
