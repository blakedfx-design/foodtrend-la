import { searchPlaces } from "@/lib/places";
import { searchReddit } from "@/lib/sources/reddit";
import type { RedditSearchSignal } from "@/lib/sources/reddit";
import {
  fetchListingsPipelineTermSignals,
  listingsEvidenceLine,
  listingsSupplyBoostFromSignals,
  selectListingsSignalsForTrend,
} from "@/lib/sources/listingsSupply";

const SHORT_DESCRIPTOR_KEY = "short descriptor";
const WHAT_TO_ORDER_KEY = "WHAT TO ORDER";

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

function redditBoostFromMomentum(momentumScore: number, postCount: number): number {
  if (postCount <= 0 || momentumScore <= 0) {
    return 0;
  }
  return Math.min(24, Math.round(5.5 * Math.log1p(momentumScore)));
}

function redditEvidenceLine(signal: RedditSearchSignal): string {
  if (signal.postCount <= 0) {
    return "";
  }
  const phrasePart =
    signal.topPhrases.length > 0
      ? `, with repeat mentions of ${signal.topPhrases.slice(0, 4).join(", ")}`
      : "";
  return `Picked up across r/FoodLosAngeles, r/LosAngeles, and r/AskLosAngeles (${signal.postCount} post${signal.postCount === 1 ? "" : "s"} in the last 14 days)${phrasePart}.`;
}

function combinedEvidence(
  placesLine: string,
  redditLine: string,
  listingsLine: string,
): string {
  return [placesLine, redditLine, listingsLine].filter(Boolean).join(" ");
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

function editorialTrendNamesFromParsed(parsed: Record<string, unknown>): string[] {
  const names: string[] = [];
  for (const key of ["trends", "aboutToHit"] as const) {
    const arr = parsed[key];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const el of arr) {
      if (!isRecord(el)) {
        continue;
      }
      const name = typeof el.name === "string" ? el.name.trim() : "";
      if (name) {
        names.push(name);
      }
    }
  }
  return names;
}

function trendSupplyContext(el: Record<string, unknown>): {
  blobLower: string;
  neighborhoods: string[];
} {
  const name = typeof el.name === "string" ? el.name.trim() : "";
  const shortDesc =
    typeof el[SHORT_DESCRIPTOR_KEY] === "string" ? el[SHORT_DESCRIPTOR_KEY].trim() : "";
  const dishLine = Array.isArray(el[WHAT_TO_ORDER_KEY])
    ? (el[WHAT_TO_ORDER_KEY] as unknown[])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .join(" ")
    : "";
  const blobLower = `${name} ${shortDesc} ${dishLine}`.trim().toLowerCase();
  const neighborhoods = Array.isArray(el.neighborhoods)
    ? (el.neighborhoods as unknown[])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : [];
  return { blobLower, neighborhoods };
}

/**
 * Weekend cron: for each row in `trends` and `aboutToHit`, run Places
 * (`name` + " Los Angeles"), Reddit (`name` in LA subs, 14d), and optional
 * open-listings mapped searches (LA supply validation — not a freshness source). Updates
 * signal fields, `listingsSignals` (term aggregates only), `evidenceSummary`, sources,
 * and root `sourceCount`.
 */
export async function applyWeekendGooglePlacesSignalsToParsed(
  parsed: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  parsed.lastUpdated = now;
  parsed.refreshType = "weekend";

  const hasListingsKey = Boolean(
    process.env.LISTINGS_SUPPLY_API_KEY?.trim() ?? process.env.YELP_API_KEY?.trim(),
  );
  if (!hasListingsKey) {
    console.log("Listings supply API disabled: credentials not configured.");
  }

  let listingsTermSignals: Awaited<ReturnType<typeof fetchListingsPipelineTermSignals>> = [];
  if (hasListingsKey) {
    try {
      const editorialTrendNames = editorialTrendNamesFromParsed(parsed);
      listingsTermSignals = await fetchListingsPipelineTermSignals({ editorialTrendNames });
    } catch {
      listingsTermSignals = [];
    }
  }

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
      const placesScore = scoreFromHits(hits);
      const placesLine = evidenceLine(name, query, hits);

      const redditSig = await searchReddit(name);
      let nextSources = mergeSources(el.sources, "Google Places");
      if (redditSig.postCount > 0) {
        nextSources = mergeSources(nextSources, "Reddit chatter");
      }

      const { blobLower, neighborhoods } = trendSupplyContext(el);
      const listingsForTrend =
        listingsTermSignals.length > 0
          ? selectListingsSignalsForTrend(listingsTermSignals, {
              trendBlobLower: blobLower,
              trendNeighborhoods: neighborhoods,
              minScore: 30,
              limit: 8,
            })
          : [];
      if (listingsForTrend.length > 0) {
        nextSources = mergeSources(nextSources, "Open listings");
      }
      const listingsLine = listingsEvidenceLine(listingsForTrend);
      const listingsBoost = listingsSupplyBoostFromSignals(listingsForTrend);

      el.signalScore = clampScore(
        placesScore +
          redditBoostFromMomentum(redditSig.momentumScore, redditSig.postCount) +
          listingsBoost,
      );
      el.sources = nextSources;
      el.sourceCount = nextSources.length;
      el.lastUpdated = now;
      el.evidenceSummary = combinedEvidence(
        placesLine,
        redditEvidenceLine(redditSig),
        listingsLine,
      );
      if (listingsForTrend.length > 0) {
        el.listingsSignals = listingsForTrend;
      } else {
        delete el.listingsSignals;
      }
      delete el.yelpSignals;
    }
  }

  parsed.sourceCount = rootSourceCount(parsed);
}
