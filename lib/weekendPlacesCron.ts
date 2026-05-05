import { searchPlaces } from "@/lib/places";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function mergeSources(existing: unknown, label: string): string[] {
  const base: string[] = [];
  if (Array.isArray(existing)) {
    for (const s of existing) {
      if (typeof s === "string" && s.trim()) {
        base.push(s.trim());
      }
    }
  }
  const set = new Set(base);
  set.add(label);
  return [...set];
}

function scoreFromHits(hits: Awaited<ReturnType<typeof searchPlaces>>): number {
  const n = hits.length;
  const totalReviews = hits.reduce((sum, h) => sum + (h.userRatingCount ?? 0), 0);
  return clampScore(28 + n * 7 + Math.min(34, Math.floor(totalReviews / 80)));
}

function evidenceLine(
  trendName: string,
  query: string,
  hits: Awaited<ReturnType<typeof searchPlaces>>,
): string {
  const n = hits.length;
  const ratings = hits.map((h) => h.rating).filter((r): r is number => r != null);
  const avg =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;
  const reviews = hits.reduce((s, h) => s + (h.userRatingCount ?? 0), 0);
  const avgPart = avg != null ? ` · avg rating ${avg.toFixed(1)}` : "";
  const revPart = reviews > 0 ? ` · ~${reviews} review rollups` : "";
  return `Google Places (weekend): ${n} result(s) for “${trendName}” (query “${query}”)${avgPart}${revPart}.`;
}

function rootSourceCount(parsed: Record<string, unknown>): number {
  const all = new Set<string>();
  for (const key of ["trends", "aboutToHit"] as const) {
    const arr = parsed[key];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const el of arr) {
      if (!isRecord(el)) {
        continue;
      }
      const src = el.sources;
      if (!Array.isArray(src)) {
        continue;
      }
      for (const s of src) {
        if (typeof s === "string" && s.trim()) {
          all.add(s.trim());
        }
      }
    }
  }
  return all.size;
}

/**
 * Weekend cron: for each row in `trends` and `aboutToHit`, run one Places text
 * search (trend name + " Los Angeles"). Updates only signal fields on each row
 * and root `lastUpdated` / `refreshType` / `sourceCount`.
 */
export async function applyWeekendGooglePlacesSignalsToParsed(
  parsed: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  parsed.lastUpdated = now;
  parsed.refreshType = "weekend";

  for (const arrKey of ["trends", "aboutToHit"] as const) {
    const arr = parsed[arrKey];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const el of arr) {
      if (!isRecord(el)) {
        continue;
      }
      const name = typeof el.name === "string" ? el.name.trim() : "";
      if (!name) {
        continue;
      }
      const query = `${name} Los Angeles`;
      const hits = await searchPlaces(query);
      el.signalScore = scoreFromHits(hits);
      el.sources = mergeSources(el.sources, "Google Places");
      el.sourceCount = Array.isArray(el.sources) ? el.sources.length : 0;
      el.lastUpdated = now;
      el.evidenceSummary = evidenceLine(name, query, hits);
    }
  }

  parsed.sourceCount = rootSourceCount(parsed);
}
