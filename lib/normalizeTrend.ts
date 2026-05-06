import type {
  LaFoodTrendsDataFile,
  Trend,
  TrendConfidence,
  TrendRestaurant,
} from "@/types/laFoodTrend";
import type {
  YelpNeighborhoodCluster,
  YelpSignal,
} from "@/types/yelpSignal";
import type { WherePick } from "@/components/foodtrend/wherePick";
import {
  WHERE_SHOWING_PICKS,
  getEntryRestLine,
  getMostSpottedRestLine,
  getSplurgeRestLine,
} from "@/lib/whereShowing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNeighborhoodClusters(raw: unknown): YelpNeighborhoodCluster[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: YelpNeighborhoodCluster[] = [];
  for (const el of raw) {
    if (!isRecord(el)) {
      continue;
    }
    const neighborhood =
      typeof el.neighborhood === "string" ? el.neighborhood.trim() : "";
    const bc =
      typeof el.business_count === "number" && Number.isFinite(el.business_count)
        ? Math.max(0, Math.floor(el.business_count))
        : 0;
    if (!neighborhood || bc <= 0) {
      continue;
    }
    out.push({ neighborhood, business_count: bc });
  }
  return out;
}

function parseTrendYelpSignals(raw: unknown): YelpSignal[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: YelpSignal[] = [];
  for (const el of raw) {
    if (!isRecord(el) || el.source !== "yelp") {
      continue;
    }
    const term_searched =
      typeof el.term_searched === "string" ? el.term_searched.trim() : "";
    const bc =
      typeof el.business_count === "number" && Number.isFinite(el.business_count)
        ? Math.max(0, Math.floor(el.business_count))
        : null;
    if (!term_searched || bc == null) {
      continue;
    }
    const scoreRaw = el.yelp_signal_score;
    const yelp_signal_score =
      typeof scoreRaw === "number" && Number.isFinite(scoreRaw)
        ? Math.round(scoreRaw)
        : 0;
    const tr =
      typeof el.total_review_volume === "number" && Number.isFinite(el.total_review_volume)
        ? Math.max(0, Math.floor(el.total_review_volume))
        : 0;
    out.push({
      source: "yelp",
      term_searched,
      business_count: bc,
      avg_rating:
        typeof el.avg_rating === "number" && Number.isFinite(el.avg_rating)
          ? el.avg_rating
          : null,
      total_review_volume: tr,
      neighborhood_clusters: parseNeighborhoodClusters(el.neighborhood_clusters),
      yelp_signal_score,
    });
  }
  return out.length > 0 ? out : undefined;
}

function readOptionalTrimmedString(
  r: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

function readOptionalFiniteNumber(
  r: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  }
  return undefined;
}

function deriveMomentumScore(signalScore: number): number {
  return Math.min(98, Math.max(42, Math.round(signalScore * 0.92)));
}

function derivePopularityScore(signalScore: number): number {
  return Math.min(96, Math.max(36, Math.round(signalScore * 0.68 + 11)));
}

function optionalHttpsUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const t = raw.trim();
  if (!t || !/^https?:\/\//i.test(t)) {
    return undefined;
  }
  return t;
}

export function normalizeRestaurant(raw: unknown): TrendRestaurant | null {
  if (!isRecord(raw)) {
    return null;
  }
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    return null;
  }
  const neighborhood =
    typeof raw.neighborhood === "string" ? raw.neighborhood.trim() : "";
  const dishRaw = typeof raw.dish === "string" ? raw.dish.trim() : "";
  const dish = dishRaw || undefined;

  const url = optionalHttpsUrl(raw.url);
  const yelp_url = optionalHttpsUrl(raw.yelp_url);
  const source_url = optionalHttpsUrl(raw.source_url);
  const link = optionalHttpsUrl(raw.link);

  const sourceRaw = typeof raw.source === "string" ? raw.source.trim() : "";
  const source = sourceRaw || undefined;

  let rating: number | undefined;
  if (typeof raw.rating === "number" && Number.isFinite(raw.rating)) {
    rating = raw.rating;
  }

  let review_count: number | undefined;
  const rc =
    typeof raw.review_count === "number" && Number.isFinite(raw.review_count)
      ? Math.max(0, Math.floor(raw.review_count))
      : typeof raw.reviewCount === "number" && Number.isFinite(raw.reviewCount)
        ? Math.max(0, Math.floor(raw.reviewCount))
        : undefined;
  if (rc !== undefined) {
    review_count = rc;
  }

  const base: TrendRestaurant = {
    name,
    neighborhood,
    ...(dish ? { dish } : {}),
    ...(url ? { url } : {}),
    ...(yelp_url ? { yelp_url } : {}),
    ...(source_url ? { source_url } : {}),
    ...(link ? { link } : {}),
    ...(source ? { source } : {}),
    ...(rating != null ? { rating } : {}),
    ...(review_count != null ? { review_count } : {}),
  };
  return base;
}

function normalizeRestaurantsFromJson(raw: unknown): TrendRestaurant[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: TrendRestaurant[] = [];
  for (const item of raw) {
    const r = normalizeRestaurant(item);
    if (r) {
      out.push(r);
    }
  }
  return out;
}

function restaurantToDiskJson(r: TrendRestaurant): Record<string, unknown> {
  const o: Record<string, unknown> = {
    name: r.name,
    neighborhood: r.neighborhood,
  };
  if (r.dish != null && r.dish !== "") {
    o.dish = r.dish;
  }
  if (r.url != null) {
    o.url = r.url;
  }
  if (r.yelp_url != null) {
    o.yelp_url = r.yelp_url;
  }
  if (r.source_url != null) {
    o.source_url = r.source_url;
  }
  if (r.link != null) {
    o.link = r.link;
  }
  if (r.source != null) {
    o.source = r.source;
  }
  if (r.rating != null) {
    o.rating = r.rating;
  }
  if (r.review_count != null) {
    o.review_count = r.review_count;
  }
  return o;
}

export const TREND_SHORT_DESCRIPTOR = "short descriptor";
export const TREND_WHY_EVERYWHERE = "WHY IT'S EVERYWHERE";
export const TREND_MOST_SPOTTED = "MOST SPOTTED";
export const TREND_WHAT_TO_ORDER = "WHAT TO ORDER";
export const TREND_WORTH_SPLURGE = "WORTH THE SPLURGE";
export const TREND_EASY_ENTRY = "EASY ENTRY";
export const TREND_WHY_WORKS = "WHY IT WORKS";

function picksFromRestaurantsAndMenu(
  name: string,
  restaurants: TrendRestaurant[],
  menuItems: string[],
): WherePick[] {
  const curated = WHERE_SHOWING_PICKS[name];
  if (curated?.length) {
    return [...curated];
  }
  if (!restaurants.length) {
    return [
      {
        restaurant: "—",
        neighborhood: "LA",
        dish: menuItems[0] ?? name,
      },
    ];
  }
  return restaurants.map((r, i) => {
    const dish = r.dish ?? menuItems[i] ?? menuItems[0] ?? name;
    const pick: WherePick = {
      restaurant: r.name,
      neighborhood: r.neighborhood || "Los Angeles",
      dish,
    };
    if (r.url != null) {
      pick.url = r.url;
    }
    if (r.yelp_url != null) {
      pick.yelp_url = r.yelp_url;
    }
    if (r.source_url != null) {
      pick.source_url = r.source_url;
    }
    if (r.link != null) {
      pick.link = r.link;
    }
    if (r.source != null) {
      pick.source = r.source;
    }
    if (r.rating != null) {
      pick.rating = r.rating;
    }
    if (r.review_count != null) {
      pick.review_count = r.review_count;
    }
    return pick;
  });
}

/**
 * Ensures every trend has `Trend` app fields plus the seven editorial JSON keys.
 * Editorial strings in the file win; missing callouts are filled from existing rules.
 */
export function normalizeTrendRow(row: unknown): Trend {
  if (!isRecord(row)) {
    throw new Error("Each trend must be an object");
  }
  const r = row;

  const id = String(r.id ?? "");
  const name = String(r.name ?? "");
  const restaurants = normalizeRestaurantsFromJson(r.restaurants);
  const fromWhatToOrder = Array.isArray(r[TREND_WHAT_TO_ORDER])
    ? (r[TREND_WHAT_TO_ORDER] as string[]).map((s) => String(s))
    : [];
  const fromMenuItems = Array.isArray(r.menuItems)
    ? (r.menuItems as string[]).map((s) => String(s))
    : [];
  const menuItems = fromWhatToOrder.length > 0 ? fromWhatToOrder : fromMenuItems;
  const neighborhoods = (Array.isArray(r.neighborhoods) ? r.neighborhoods : []) as string[];

  const shortDesc = String(r[TREND_SHORT_DESCRIPTOR] ?? r.description ?? "");
  const whyAll = String(r[TREND_WHY_EVERYWHERE] ?? r.whyItsEverywhere ?? "");
  const worksRaw = String(r[TREND_WHY_WORKS] ?? r.whyItWorks ?? "").trim();

  const picks = picksFromRestaurantsAndMenu(name, restaurants, menuItems);
  const most =
    String(r[TREND_MOST_SPOTTED] ?? "").trim() ||
    getMostSpottedRestLine(name, picks[0]);
  const worth =
    String(r[TREND_WORTH_SPLURGE] ?? "").trim() || getSplurgeRestLine(name, picks);
  const easy = String(r[TREND_EASY_ENTRY] ?? "").trim() || getEntryRestLine(name, picks);
  const whatToOrder = menuItems;

  const evidenceSummary =
    typeof r.evidenceSummary === "string" && r.evidenceSummary.trim() !== ""
      ? r.evidenceSummary.trim()
      : undefined;

  const sourceCount =
    typeof r.sourceCount === "number" && Number.isFinite(r.sourceCount)
      ? r.sourceCount
      : undefined;

  const yelpSignals = parseTrendYelpSignals(r.yelpSignals);

  const signalScore = Number(r.signalScore ?? 0);
  const cuisineOrigin = readOptionalTrimmedString(r, "cuisineOrigin", "cuisine_origin");
  const mealType = readOptionalTrimmedString(r, "mealType", "meal_type");
  const mealMoment = readOptionalTrimmedString(r, "mealMoment", "meal_moment");
  const moveCopy = readOptionalTrimmedString(r, "moveCopy", "move_copy");
  const rawMom = readOptionalFiniteNumber(r, "momentumScore", "momentum_score");
  const rawPop = readOptionalFiniteNumber(r, "popularityScore", "popularity_score");
  const momentumScore =
    rawMom != null
      ? Math.min(100, Math.max(0, Math.round(rawMom)))
      : deriveMomentumScore(signalScore);
  const popularityScore =
    rawPop != null
      ? Math.min(100, Math.max(0, Math.round(rawPop)))
      : derivePopularityScore(signalScore);

  return {
    id,
    name,
    signalScore,
    lastUpdated: String(r.lastUpdated ?? ""),
    sources: (Array.isArray(r.sources) ? r.sources : []) as string[],
    confidence: r.confidence as TrendConfidence,
    neighborhoods,
    restaurants,
    menuItems: whatToOrder,
    description: shortDesc,
    whyItsEverywhere: whyAll,
    whyItWorks: worksRaw || undefined,
    evidenceSummary,
    sourceCount,
    ...(yelpSignals != null ? { yelpSignals } : {}),
    ...(cuisineOrigin ? { cuisineOrigin } : {}),
    ...(mealType ? { mealType } : {}),
    ...(mealMoment ? { mealMoment } : {}),
    ...(moveCopy ? { moveCopy } : {}),
    momentumScore,
    popularityScore,
    [TREND_SHORT_DESCRIPTOR]: shortDesc,
    [TREND_WHY_EVERYWHERE]: whyAll,
    [TREND_MOST_SPOTTED]: most,
    [TREND_WHAT_TO_ORDER]: [...whatToOrder],
    [TREND_WORTH_SPLURGE]: worth,
    [TREND_EASY_ENTRY]: easy,
    [TREND_WHY_WORKS]: worksRaw,
  };
}

/** Disk shape for `data/la-food-trends.json` — editorial keys only (no duplicate `description` / `menuItems`). */
export function trendToJsonObject(t: Trend): Record<string, unknown> {
  return {
    id: t.id,
    name: t.name,
    [TREND_SHORT_DESCRIPTOR]: t[TREND_SHORT_DESCRIPTOR],
    [TREND_WHY_EVERYWHERE]: t[TREND_WHY_EVERYWHERE],
    signalScore: t.signalScore,
    lastUpdated: t.lastUpdated,
    sources: t.sources,
    neighborhoods: t.neighborhoods,
    restaurants: t.restaurants.map(restaurantToDiskJson),
    [TREND_WHAT_TO_ORDER]: t[TREND_WHAT_TO_ORDER],
    [TREND_MOST_SPOTTED]: t[TREND_MOST_SPOTTED],
    [TREND_WORTH_SPLURGE]: t[TREND_WORTH_SPLURGE],
    [TREND_EASY_ENTRY]: t[TREND_EASY_ENTRY],
    [TREND_WHY_WORKS]: t[TREND_WHY_WORKS],
    confidence: t.confidence,
    ...(t.evidenceSummary != null && t.evidenceSummary !== ""
      ? { evidenceSummary: t.evidenceSummary }
      : {}),
    ...(t.sourceCount != null ? { sourceCount: t.sourceCount } : {}),
    ...(t.yelpSignals != null && t.yelpSignals.length > 0 ? { yelpSignals: t.yelpSignals } : {}),
    ...(t.cuisineOrigin ? { cuisineOrigin: t.cuisineOrigin } : {}),
    ...(t.mealType ? { mealType: t.mealType } : {}),
    ...(t.mealMoment ? { mealMoment: t.mealMoment } : {}),
    ...(t.moveCopy ? { moveCopy: t.moveCopy } : {}),
    momentumScore: t.momentumScore,
    popularityScore: t.popularityScore,
  };
}

export function laFoodTrendsFileToDiskJson(data: LaFoodTrendsDataFile): Record<string, unknown> {
  const out: Record<string, unknown> = {
    lastUpdated: data.lastUpdated,
    trends: data.trends.map(trendToJsonObject),
    aboutToHit: data.aboutToHit.map(trendToJsonObject),
  };
  if (data.refreshType != null) {
    out.refreshType = data.refreshType;
  }
  if (data.weekendNote != null && data.weekendNote !== "") {
    out.weekendNote = data.weekendNote;
  }
  if (data.sourceCount != null) {
    out.sourceCount = data.sourceCount;
  }
  return out;
}
