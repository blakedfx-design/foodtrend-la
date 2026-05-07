/**
 * Open-listings supply fetch (HTTP). Set `LISTINGS_SUPPLY_API_KEY`, or `YELP_API_KEY`
 * for backward compatibility with existing deployments.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ListingsNeighborhoodCluster,
  ListingsSignal,
} from "@/types/listingsSignal";

const OPEN_LISTINGS_API_ENDPOINT = "https://api.yelp.com/v3/businesses/search";
const OPEN_LISTINGS_SEARCH_LOCATION = "Los Angeles, CA";

/**
 * Canonical dish-trend search `term` queries (aligned with Reddit ingest vocabulary).
 */
export const LISTINGS_SUPPLY_TERMS = [
  "tacos",
  "bagels",
  "matcha",
  "sandwiches",
  "burgers",
  "coffee",
  "cocktails",
  "dessert",
  "Korean food",
  "Thai food",
  "Japanese food",
  "Mexican food",
  "Filipino food",
  "Vietnamese food",
  "pop-up",
  "new restaurant",
] as const;

const SEARCH_LIMIT = 50;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 180;
const MAX_EXTRA_TREND_TERMS = 24;

let lastRateLimitRemaining: number | null = null;

const LA_NEIGHBORHOOD_HINTS: { needle: string; label: string }[] = [
  { needle: "koreatown", label: "Koreatown" },
  { needle: "little tokyo", label: "Little Tokyo" },
  { needle: "sawtelle", label: "Sawtelle" },
  { needle: "westwood", label: "Westwood" },
  { needle: "arts district", label: "Arts District" },
  { needle: "silver lake", label: "Silver Lake" },
  { needle: "echo park", label: "Echo Park" },
  { needle: "west hollywood", label: "West Hollywood" },
  { needle: "weho", label: "West Hollywood" },
  { needle: "santa monica", label: "Santa Monica" },
  { needle: "venice", label: "Venice" },
  { needle: "mar vista", label: "Mar Vista" },
  { needle: "dtla", label: "Downtown LA" },
  { needle: "downtown la", label: "Downtown LA" },
  { needle: "pasadena", label: "Pasadena" },
  { needle: "glendale", label: "Glendale" },
  { needle: "culver city", label: "Culver City" },
  { needle: "hollywood", label: "Hollywood" },
  { needle: "highland park", label: "Highland Park" },
  { needle: "boyle heights", label: "Boyle Heights" },
  { needle: "westlake", label: "Westlake" },
  { needle: "alhambra", label: "Alhambra" },
  { needle: "monterey park", label: "Monterey Park" },
  { needle: "arcadia", label: "Arcadia" },
  { needle: "long beach", label: "Long Beach" },
  { needle: "manhattan beach", label: "Manhattan Beach" },
  { needle: "thai town", label: "Thai Town" },
  { needle: "chinatown", label: "Chinatown" },
  { needle: "filipino town", label: "Historic Filipino Town" },
];

type ProviderBusinessJson = {
  id?: string;
  name?: string;
  is_closed?: boolean;
  rating?: number;
  review_count?: number;
  location?: {
    display_address?: string[];
    neighborhood?: string[];
    city?: string;
  };
};

type ProviderSearchJson = {
  businesses?: ProviderBusinessJson[];
};

type DiskCacheEntry = { fetchedAt: number; businesses: ProviderBusinessJson[] };
type DiskCacheFile = { entries: Record<string, DiskCacheEntry> };

const memoryTermCache = new Map<string, { expires: number; businesses: ProviderBusinessJson[] }>();

let lastListingsRequestAt = 0;

const rateState = {
  remaining: null as number | null,
  resetUtc: null as number | null,
};

function listingsSupplyApiKey(): string | null {
  const k =
    process.env.LISTINGS_SUPPLY_API_KEY?.trim() ?? process.env.YELP_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

function diskCachePath(): string {
  return path.join(os.tmpdir(), "foodtrend-la-listings-search.json");
}

function parseListingsRateHeaders(res: Response): void {
  const rem = res.headers.get("ratelimit-remaining");
  const reset = res.headers.get("ratelimit-reset");
  if (rem != null) {
    const r = Number.parseInt(rem, 10);
    rateState.remaining = Number.isFinite(r) ? r : null;
    lastRateLimitRemaining = rateState.remaining;
  }
  if (reset != null) {
    const u = Number.parseInt(reset, 10);
    rateState.resetUtc = Number.isFinite(u) ? u : null;
  }
}

async function respectListingsRateLimit(): Promise<void> {
  if (
    rateState.remaining != null &&
    rateState.remaining < 3 &&
    rateState.resetUtc != null
  ) {
    const waitMs = Math.max(0, rateState.resetUtc * 1000 - Date.now()) + 400;
    if (waitMs > 0 && waitMs < 86_400_000) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  const gap = lastListingsRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (gap > 0) {
    await new Promise((r) => setTimeout(r, gap));
  }
}

async function loadDiskCache(): Promise<DiskCacheFile> {
  try {
    const raw = await fs.readFile(diskCachePath(), "utf-8");
    const j = JSON.parse(raw) as DiskCacheFile;
    if (j && typeof j === "object" && j.entries && typeof j.entries === "object") {
      return j;
    }
  } catch {
    /* empty */
  }
  return { entries: {} };
}

async function saveDiskCache(cache: DiskCacheFile): Promise<void> {
  try {
    await fs.writeFile(diskCachePath(), JSON.stringify(cache), "utf-8");
  } catch {
    /* cron must not fail */
  }
}

function neighborhoodFromBusiness(b: ProviderBusinessJson): string | null {
  const n = b.location?.neighborhood;
  if (Array.isArray(n) && n.length > 0 && typeof n[0] === "string" && n[0].trim()) {
    return n[0].trim();
  }
  const addr = (b.location?.display_address ?? []).join(", ").toLowerCase();
  if (!addr) {
    return null;
  }
  for (const { needle, label } of LA_NEIGHBORHOOD_HINTS) {
    if (addr.includes(needle)) {
      return label;
    }
  }
  const city = typeof b.location?.city === "string" ? b.location.city.trim() : "";
  return city || null;
}

function dedupeOpenBusinesses(rows: ProviderBusinessJson[]): ProviderBusinessJson[] {
  const seen = new Set<string>();
  const out: ProviderBusinessJson[] = [];
  for (const b of rows) {
    if (b.is_closed === true) {
      continue;
    }
    const id = typeof b.id === "string" ? b.id.trim() : "";
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(b);
  }
  return out;
}

function aggregateNeighborhoodClusters(openRows: ProviderBusinessJson[]): ListingsNeighborhoodCluster[] {
  const hoodCounts = new Map<string, number>();
  for (const b of openRows) {
    const label = neighborhoodFromBusiness(b) ?? "Los Angeles metro";
    hoodCounts.set(label, (hoodCounts.get(label) ?? 0) + 1);
  }
  return [...hoodCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([neighborhood, business_count]) => ({ neighborhood, business_count }));
}

/** Intrinsic supply strength from listing depth + ratings volume (no editorial trend fit). */
function intrinsicSupplyScore(sig: Omit<ListingsSignal, "source">): number {
  const avg = sig.avg_rating ?? 3.5;
  const n = sig.business_count;
  const vol = sig.total_review_volume;
  let s =
    Math.min(36, n * 1.4) +
    Math.min(34, 7 * Math.log1p(vol)) +
    Math.max(0, (avg - 3.4) * 14);
  return Math.min(100, Math.max(0, Math.round(s)));
}

/**
 * Build one structured `ListingsSignal` from Fusion hits for a single `term` query.
 */
export function normalizeTermResultsToListingsSignal(
  term_searched: string,
  rawBusinesses: ProviderBusinessJson[],
): ListingsSignal {
  const openRows = dedupeOpenBusinesses(rawBusinesses);
  const ratings = openRows
    .map((b) => b.rating)
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const avg_rating =
    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const total_review_volume = openRows.reduce((sum, b) => {
    const rc =
      typeof b.review_count === "number" && Number.isFinite(b.review_count)
        ? Math.max(0, Math.floor(b.review_count))
        : 0;
    return sum + rc;
  }, 0);
  const neighborhood_clusters = aggregateNeighborhoodClusters(openRows);

  const base = {
    term_searched,
    business_count: openRows.length,
    avg_rating,
    total_review_volume,
    neighborhood_clusters,
    listings_signal_score: 0,
  };
  const listings_signal_score = intrinsicSupplyScore(base);

  return {
    source: "listings",
    ...base,
    listings_signal_score,
  };
}

async function fetchTermFromNetwork(
  term: string,
  apiKey: string,
): Promise<ProviderBusinessJson[]> {
  await respectListingsRateLimit();
  const url = new URL(OPEN_LISTINGS_API_ENDPOINT);
  url.searchParams.set("term", term);
  url.searchParams.set("location", OPEN_LISTINGS_SEARCH_LOCATION);
  url.searchParams.set("limit", String(SEARCH_LIMIT));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  lastListingsRequestAt = Date.now();
  parseListingsRateHeaders(res);

  if (!res.ok) {
    await res.text().catch(() => "");
    return [];
  }

  const json = (await res.json()) as ProviderSearchJson;
  return json.businesses ?? [];
}

async function businessesForTerm(term: string, apiKey: string): Promise<ProviderBusinessJson[]> {
  const now = Date.now();
  const mem = memoryTermCache.get(term);
  if (mem && mem.expires > now) {
    return mem.businesses;
  }

  const disk = await loadDiskCache();
  const diskEntry = disk.entries[term];
  if (diskEntry && now - diskEntry.fetchedAt < CACHE_TTL_MS) {
    memoryTermCache.set(term, {
      expires: diskEntry.fetchedAt + CACHE_TTL_MS,
      businesses: diskEntry.businesses,
    });
    return diskEntry.businesses;
  }

  let businesses: ProviderBusinessJson[];
  try {
    businesses = await fetchTermFromNetwork(term, apiKey);
  } catch {
    businesses = [];
  }

  memoryTermCache.set(term, { expires: now + CACHE_TTL_MS, businesses });
  disk.entries[term] = { fetchedAt: now, businesses };
  await saveDiskCache(disk);

  return businesses;
}

function termRegistryFromPipeline(opts: { editorialTrendNames: string[] }): string[] {
  const byKey = new Map<string, string>();
  for (const t of LISTINGS_SUPPLY_TERMS) {
    const k = t.toLowerCase().trim();
    if (k) {
      byKey.set(k, t);
    }
  }
  let extras = 0;
  for (const name of opts.editorialTrendNames) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    const k = trimmed.toLowerCase();
    if (!byKey.has(k)) {
      byKey.set(k, trimmed);
      extras += 1;
      if (extras >= MAX_EXTRA_TREND_TERMS) {
        break;
      }
    }
  }
  return [...byKey.values()];
}

/**
 * Targeted open-listings searches: canonical dish terms plus deduped editorial trend names.
 * Returns **one aggregate ListingsSignal per query term** (no raw businesses).
 */
export async function fetchListingsPipelineTermSignals(opts: {
  editorialTrendNames: string[];
}): Promise<ListingsSignal[]> {
  const apiKey = listingsSupplyApiKey();
  if (!apiKey) {
    return [];
  }

  const terms = termRegistryFromPipeline(opts);
  const signals: ListingsSignal[] = [];

  for (const term of terms) {
    let raw: ProviderBusinessJson[];
    try {
      raw = await businessesForTerm(term, apiKey);
    } catch {
      raw = [];
    }
    signals.push(normalizeTermResultsToListingsSignal(term, raw));
  }

  return signals;
}

function tokenOverlapScore(term: string, blob: string): number {
  const b = blob.toLowerCase();
  const t = term.toLowerCase().trim();
  if (!t) {
    return 0;
  }
  if (b.includes(t)) {
    return 22;
  }
  const parts = t.split(/\s+/).filter((w) => w.length > 2);
  let hits = 0;
  for (const w of parts) {
    if (b.includes(w)) {
      hits += 1;
    }
  }
  return Math.min(18, hits * 6);
}

function clusterOverlapPoints(
  clusters: ListingsNeighborhoodCluster[],
  trendHoods: string[],
): number {
  if (!trendHoods.length || !clusters.length) {
    return 0;
  }
  const want = new Set(trendHoods.map((h) => h.toLowerCase().trim()).filter(Boolean));
  let pts = 0;
  for (const c of clusters) {
    if (want.has(c.neighborhood.toLowerCase())) {
      pts += Math.min(16, 5 + c.business_count);
    }
  }
  return Math.min(24, pts);
}

function trendWeightedScore(
  sig: ListingsSignal,
  trendBlobLower: string,
  trendNeighborhoods: string[],
): number {
  const overlap = tokenOverlapScore(sig.term_searched, trendBlobLower);
  const hoodPts = clusterOverlapPoints(sig.neighborhood_clusters, trendNeighborhoods);
  const combined =
    sig.listings_signal_score * 0.35 + overlap * 1.15 + hoodPts * 1.1 + sig.business_count * 0.08;
  return Math.min(100, Math.max(0, Math.round(combined)));
}

/**
 * Pick aggregate signals relevant to one editorial trend (structured rows only).
 */
export function selectListingsSignalsForTrend(
  termSignals: ListingsSignal[],
  opts: {
    trendBlobLower: string;
    trendNeighborhoods: string[];
    minScore?: number;
    limit?: number;
  },
): ListingsSignal[] {
  const minScore = opts.minScore ?? 30;
  const limit = opts.limit ?? 8;

  const scored = termSignals
    .map((sig) => ({
      ...sig,
      listings_signal_score: trendWeightedScore(sig, opts.trendBlobLower, opts.trendNeighborhoods),
    }))
    .filter((s) => s.listings_signal_score >= minScore && s.business_count > 0)
    .sort((a, b) => b.listings_signal_score - a.listings_signal_score);

  return scored.slice(0, limit);
}

export function listingsSupplyBoostFromSignals(signals: ListingsSignal[]): number {
  if (!signals.length) {
    return 0;
  }
  let listings = 0;
  let ratingWeighted = 0;
  for (const s of signals) {
    listings += s.business_count;
    const avg = s.avg_rating ?? 4;
    ratingWeighted += avg * s.business_count;
  }
  const avgRat = listings > 0 ? ratingWeighted / listings : 4;
  return Math.min(
    14,
    Math.round(6 * Math.log1p(listings) + Math.max(0, (avgRat - 3.6) * 2.5)),
  );
}

export function listingsEvidenceLine(signals: ListingsSignal[]): string {
  if (!signals.length) {
    return "";
  }
  let listings = 0;
  let reviews = 0;
  let ratingWeighted = 0;
  let ratedListings = 0;
  for (const s of signals) {
    listings += s.business_count;
    reviews += s.total_review_volume;
    if (s.avg_rating != null) {
      ratingWeighted += s.avg_rating * s.business_count;
      ratedListings += s.business_count;
    }
  }
  const avgR =
    ratedListings > 0 ? ratingWeighted / ratedListings : null;
  const topTerms = signals.slice(0, 4).map((s) => {
    const a = s.avg_rating != null ? `★${s.avg_rating.toFixed(1)}` : "—";
    return `“${s.term_searched}”: ${s.business_count} open (${a})`;
  });
  const avgPart = avgR != null ? ` blended avg ★${avgR.toFixed(1)}` : "";
  const revPart = reviews > 0 ? ` · ~${reviews} review volume indexed` : "";
  return `Open listings (aggregated): ${listings} open listings across ${signals.length} mapped search slice${signals.length === 1 ? "" : "s"}${avgPart}${revPart}. ${topTerms.join("; ")}.`;
}

export function listingsRateLimitRemainingSnapshot(): number | null {
  return lastRateLimitRemaining;
}
