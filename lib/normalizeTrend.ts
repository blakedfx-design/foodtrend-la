import type {
  LaFoodTrendsDataFile,
  Trend,
  TrendConfidence,
  TrendConvergencePersisted,
  TrendConvergenceState,
  TrendRestaurant,
} from "@/types/laFoodTrend";
import type {
  ManualSocialSignals,
  TrendSocialSignal,
  TrendSocialSignalLabel,
} from "@/types/socialSignal";
import type {
  ListingsNeighborhoodCluster,
  ListingsSignal,
} from "@/types/listingsSignal";
import type {
  ReservationSignalSource,
  ReservationSignalStatus,
  TrendReservationSignal,
} from "@/types/reservationSignal";
import { isLikelyGoogleMapsUrl, type WherePick } from "@/components/foodtrend/wherePick";
import {
  WHERE_SHOWING_PICKS,
  getEntryRestLine,
  getMostSpottedRestLine,
  getSplurgeRestLine,
} from "@/lib/whereShowing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CONVERGENCE_STATES: readonly TrendConvergenceState[] = [
  "weak_signal",
  "emerging",
  "rising",
  "stabilizing",
  "mainstream",
  "cooling",
] as const;

function parseTrendConvergencePersisted(r: Record<string, unknown>): TrendConvergencePersisted | undefined {
  const raw = r.convergence;
  if (!isRecord(raw)) return undefined;
  const convergenceScore =
    typeof raw.convergenceScore === "number" && Number.isFinite(raw.convergenceScore)
      ? Math.round(raw.convergenceScore)
      : NaN;
  if (!Number.isFinite(convergenceScore)) return undefined;
  const conf = raw.confidence;
  if (conf !== "low" && conf !== "medium" && conf !== "high") return undefined;
  const trendStateRaw = raw.trendState;
  if (typeof trendStateRaw !== "string" || !CONVERGENCE_STATES.includes(trendStateRaw as TrendConvergenceState))
    return undefined;
  const strongestSources = Array.isArray(raw.strongestSources)
    ? raw.strongestSources.filter((x): x is string => typeof x === "string")
    : [];
  const sourceDiversity =
    typeof raw.sourceDiversity === "number" && Number.isFinite(raw.sourceDiversity) ? Math.round(raw.sourceDiversity) : 0;
  const geoSpreadScore =
    typeof raw.geoSpreadScore === "number" && Number.isFinite(raw.geoSpreadScore) ? Math.round(raw.geoSpreadScore) : 0;
  const persistenceScore =
    typeof raw.persistenceScore === "number" && Number.isFinite(raw.persistenceScore) ? Math.round(raw.persistenceScore) : 0;
  const reasons = Array.isArray(raw.reasons) ? raw.reasons.filter((x): x is string => typeof x === "string") : [];
  const nar = raw.whyItsEverywhereNarrative;
  if (!isRecord(nar)) return undefined;
  const headlineReason = typeof nar.headlineReason === "string" ? nar.headlineReason : "";
  const supportReasons = Array.isArray(nar.supportReasons)
    ? nar.supportReasons.filter((x): x is string => typeof x === "string")
    : [];
  const pub = raw.publicNarrative;
  if (!isRecord(pub)) return undefined;
  const primaryLine = typeof pub.primaryLine === "string" ? pub.primaryLine : "";
  const supportingLines = Array.isArray(pub.supportingLines)
    ? pub.supportingLines.filter((x): x is string => typeof x === "string")
    : [];
  const computedAt = typeof raw.computedAt === "string" ? raw.computedAt.trim() : "";
  if (!computedAt) return undefined;
  return {
    convergenceScore,
    confidence: conf,
    trendState: trendStateRaw as TrendConvergenceState,
    strongestSources,
    sourceDiversity,
    geoSpreadScore,
    persistenceScore,
    reasons,
    whyItsEverywhereNarrative: { headlineReason, supportReasons },
    publicNarrative: { primaryLine, supportingLines },
    computedAt,
  };
}

function parseListingsNeighborhoodClusters(raw: unknown): ListingsNeighborhoodCluster[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ListingsNeighborhoodCluster[] = [];
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

function parseTrendListingsSignals(r: Record<string, unknown>): ListingsSignal[] | undefined {
  const rawSignals = r.listingsSignals ?? r.yelpSignals;
  if (!Array.isArray(rawSignals) || rawSignals.length === 0) {
    return undefined;
  }
  const out: ListingsSignal[] = [];
  for (const el of rawSignals) {
    if (!isRecord(el)) {
      continue;
    }
    const src = el.source;
    if (src !== "listings" && src !== "yelp") {
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
    const scoreRaw = el.listings_signal_score ?? el.yelp_signal_score;
    const listings_signal_score =
      typeof scoreRaw === "number" && Number.isFinite(scoreRaw)
        ? Math.round(scoreRaw)
        : 0;
    const tr =
      typeof el.total_review_volume === "number" && Number.isFinite(el.total_review_volume)
        ? Math.max(0, Math.floor(el.total_review_volume))
        : 0;
    out.push({
      source: "listings",
      term_searched,
      business_count: bc,
      avg_rating:
        typeof el.avg_rating === "number" && Number.isFinite(el.avg_rating)
          ? el.avg_rating
          : null,
      total_review_volume: tr,
      neighborhood_clusters: parseListingsNeighborhoodClusters(el.neighborhood_clusters),
      listings_signal_score,
    });
  }
  return out.length > 0 ? out : undefined;
}

const SOCIAL_LABELS = new Set<TrendSocialSignalLabel>([
  "Creator Reel",
  "TikTok post",
  "Reddit mention",
]);

const RESERVATION_SIGNAL_SOURCES = new Set<ReservationSignalSource>([
  "resy",
  "opentable",
  "tock",
  "manual",
]);

const RESERVATION_SIGNAL_STATUSES = new Set<ReservationSignalStatus>([
  "hard_to_book",
  "sold_out",
  "limited_availability",
  "new_drop",
  "event",
]);

function defaultSocialLabel(platform: "instagram" | "tiktok" | "reddit"): TrendSocialSignalLabel {
  if (platform === "instagram") {
    return "Creator Reel";
  }
  if (platform === "tiktok") {
    return "TikTok post";
  }
  return "Reddit mention";
}

function parseTrendSocialSignals(r: Record<string, unknown>): TrendSocialSignal[] | undefined {
  const rawSignals = r.socialSignals ?? r.social_signals;
  if (!Array.isArray(rawSignals) || rawSignals.length === 0) {
    return undefined;
  }
  const out: TrendSocialSignal[] = [];
  for (const el of rawSignals) {
    if (!isRecord(el)) {
      continue;
    }
    const platform = el.platform;
    if (platform !== "instagram" && platform !== "tiktok" && platform !== "reddit") {
      continue;
    }
    const rawLabel = typeof el.label === "string" ? el.label.trim() : "";
    const label: TrendSocialSignalLabel = SOCIAL_LABELS.has(rawLabel as TrendSocialSignalLabel)
      ? (rawLabel as TrendSocialSignalLabel)
      : defaultSocialLabel(platform);
    const url = optionalHttpsUrl(el.url);
    if (!url) {
      continue;
    }
    const strength = el.strength;
    if (strength !== "high" && strength !== "medium" && strength !== "low") {
      continue;
    }
    out.push({ platform, label, url, strength });
  }
  return out.length > 0 ? out : undefined;
}

function parseManualSocialSignals(r: Record<string, unknown>): ManualSocialSignals | undefined {
  const rawSignals =
    r.socialSignals ?? r.social_signals ?? r.manualSocialSignals ?? r.manual_social_signals;
  if (!isRecord(rawSignals) || Array.isArray(rawSignals)) {
    return undefined;
  }
  const tiktokSpotted = rawSignals.tiktokSpotted === true || rawSignals.tiktok_spotted === true;
  const instagramSpotted =
    rawSignals.instagramSpotted === true || rawSignals.instagram_spotted === true;
  if (!tiktokSpotted && !instagramSpotted) {
    return undefined;
  }
  const sourceNotesRaw =
    typeof rawSignals.sourceNotes === "string"
      ? rawSignals.sourceNotes.trim()
      : typeof rawSignals.source_notes === "string"
        ? rawSignals.source_notes.trim()
        : "";
  const observedAtRaw =
    typeof rawSignals.observedAt === "string"
      ? rawSignals.observedAt.trim()
      : typeof rawSignals.observed_at === "string"
        ? rawSignals.observed_at.trim()
        : "";
  return {
    tiktokSpotted,
    instagramSpotted,
    ...(sourceNotesRaw ? { sourceNotes: sourceNotesRaw } : {}),
    ...(observedAtRaw ? { observedAt: observedAtRaw } : {}),
  };
}

function parseTrendReservationSignals(
  r: Record<string, unknown>,
): TrendReservationSignal[] | undefined {
  const rawSignals = r.reservationSignals ?? r.reservation_signals;
  if (!Array.isArray(rawSignals) || rawSignals.length === 0) {
    return undefined;
  }
  const out: TrendReservationSignal[] = [];
  for (const el of rawSignals) {
    if (!isRecord(el)) continue;
    const source = typeof el.source === "string" ? el.source.trim().toLowerCase() : "";
    if (!RESERVATION_SIGNAL_SOURCES.has(source as ReservationSignalSource)) continue;
    const statusRaw = typeof el.status === "string" ? el.status.trim().toLowerCase() : "";
    const status = RESERVATION_SIGNAL_STATUSES.has(statusRaw as ReservationSignalStatus)
      ? (statusRaw as ReservationSignalStatus)
      : undefined;
    const sourceUrl = optionalHttpsUrl(el.sourceUrl ?? el.source_url);
    const sourceNotes =
      typeof el.sourceNotes === "string"
        ? el.sourceNotes.trim()
        : typeof el.source_notes === "string"
          ? el.source_notes.trim()
          : "";
    const observedAt =
      typeof el.observedAt === "string"
        ? el.observedAt.trim()
        : typeof el.observed_at === "string"
          ? el.observed_at.trim()
          : "";
    out.push({
      source: source as ReservationSignalSource,
      ...(status ? { status } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(sourceNotes ? { sourceNotes } : {}),
      ...(observedAt ? { observedAt } : {}),
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

  const venueHeroImageUrl = readOptionalTrimmedString(raw, "heroImageUrl", "hero_image_url");

  const instagramRaw = readOptionalTrimmedString(raw, "instagramUrl", "instagram_url");
  const instagramUrl = instagramRaw ? optionalHttpsUrl(instagramRaw) : undefined;
  const tiktokRaw = readOptionalTrimmedString(raw, "tiktokUrl", "tiktok_url");
  const tiktokUrl = tiktokRaw ? optionalHttpsUrl(tiktokRaw) : undefined;

  let websiteUrl =
    readOptionalTrimmedString(raw, "websiteUrl", "website_url") ?? undefined;
  websiteUrl = websiteUrl ? optionalHttpsUrl(websiteUrl) : undefined;

  let googleMapsUrl =
    readOptionalTrimmedString(raw, "googleMapsUrl", "google_maps_url") ?? undefined;
  googleMapsUrl = googleMapsUrl ? optionalHttpsUrl(googleMapsUrl) : undefined;

  let fallbackUrl =
    readOptionalTrimmedString(raw, "fallbackUrl", "fallback_url") ?? undefined;
  fallbackUrl = fallbackUrl ? optionalHttpsUrl(fallbackUrl) : undefined;

  if (fallbackUrl && isLikelyGoogleMapsUrl(fallbackUrl) && !googleMapsUrl) {
    googleMapsUrl = fallbackUrl;
    fallbackUrl = undefined;
  }

  const legacySite = optionalHttpsUrl(raw.url);
  if (legacySite) {
    if (isLikelyGoogleMapsUrl(legacySite) && !googleMapsUrl) {
      googleMapsUrl = legacySite;
    } else if (!websiteUrl) {
      websiteUrl = legacySite;
    }
  }

  const legacyVendorUrl = optionalHttpsUrl((raw as Record<string, unknown>).yelp_url);
  if (legacyVendorUrl && !websiteUrl) {
    websiteUrl = legacyVendorUrl;
  }

  const legacySource = optionalHttpsUrl(raw.source_url);
  if (legacySource) {
    if (isLikelyGoogleMapsUrl(legacySource) && !googleMapsUrl) {
      googleMapsUrl = legacySource;
    } else if (!websiteUrl) {
      websiteUrl = legacySource;
    }
  }

  const legacyLink = optionalHttpsUrl(raw.link);
  if (legacyLink) {
    if (isLikelyGoogleMapsUrl(legacyLink) && !googleMapsUrl) {
      googleMapsUrl = legacyLink;
    } else if (!websiteUrl) {
      websiteUrl = legacyLink;
    }
  }

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
    ...(venueHeroImageUrl ? { heroImageUrl: venueHeroImageUrl } : {}),
    ...(instagramUrl ? { instagramUrl } : {}),
    ...(tiktokUrl ? { tiktokUrl } : {}),
    ...(websiteUrl ? { websiteUrl } : {}),
    ...(googleMapsUrl ? { googleMapsUrl } : {}),
    ...(fallbackUrl ? { fallbackUrl } : {}),
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
  if (r.heroImageUrl != null && r.heroImageUrl !== "") {
    o.heroImageUrl = r.heroImageUrl;
  }
  if (r.instagramUrl != null && r.instagramUrl !== "") {
    o.instagramUrl = r.instagramUrl;
  }
  if (r.tiktokUrl != null && r.tiktokUrl !== "") {
    o.tiktokUrl = r.tiktokUrl;
  }
  if (r.websiteUrl != null && r.websiteUrl !== "") {
    o.websiteUrl = r.websiteUrl;
  }
  if (r.googleMapsUrl != null && r.googleMapsUrl !== "") {
    o.googleMapsUrl = r.googleMapsUrl;
  }
  if (r.fallbackUrl != null && r.fallbackUrl !== "") {
    o.fallbackUrl = r.fallbackUrl;
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
/** Canonical on-disk key; `WHY IT'S EVERYWHERE` still read for older files. */
export const TREND_WHY_HITTING = "WHY IT'S HITTING";
const TREND_WHY_EVERYWHERE_LEGACY = "WHY IT'S EVERYWHERE";
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
    if (r.instagramUrl != null) {
      pick.instagramUrl = r.instagramUrl;
    }
    if (r.tiktokUrl != null) {
      pick.tiktokUrl = r.tiktokUrl;
    }
    if (r.websiteUrl != null) {
      pick.websiteUrl = r.websiteUrl;
    }
    if (r.googleMapsUrl != null) {
      pick.googleMapsUrl = r.googleMapsUrl;
    }
    if (r.fallbackUrl != null) {
      pick.fallbackUrl = r.fallbackUrl;
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
  const whyAll = String(
    r[TREND_WHY_HITTING] ??
      r[TREND_WHY_EVERYWHERE_LEGACY] ??
      r.whyItsEverywhere ??
      "",
  );
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

  const listingsSignals = parseTrendListingsSignals(r);
  const socialSignals = parseTrendSocialSignals(r);
  const manualSocialSignals = parseManualSocialSignals(r);
  const reservationSignals = parseTrendReservationSignals(r);

  const signalScore = Number(r.signalScore ?? 0);
  const cuisineOrigin = readOptionalTrimmedString(r, "cuisineOrigin", "cuisine_origin");
  const mealType = readOptionalTrimmedString(r, "mealType", "meal_type");
  const mealMoment = readOptionalTrimmedString(r, "mealMoment", "meal_moment");
  const moveCopy = readOptionalTrimmedString(r, "moveCopy", "move_copy");
  const heroImageUrl = readOptionalTrimmedString(r, "heroImageUrl", "hero_image_url");
  const heroImageSource = readOptionalTrimmedString(r, "heroImageSource", "hero_image_source");
  const heroImageSourceUrl = readOptionalTrimmedString(
    r,
    "heroImageSourceUrl",
    "hero_image_source_url",
  );
  const heroImageCredit = readOptionalTrimmedString(r, "heroImageCredit", "hero_image_credit");
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

  const convergence = parseTrendConvergencePersisted(r);

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
    ...(listingsSignals != null ? { listingsSignals } : {}),
    ...(socialSignals != null ? { socialSignals } : {}),
    ...(manualSocialSignals != null ? { manualSocialSignals } : {}),
    ...(reservationSignals != null ? { reservationSignals } : {}),
    ...(cuisineOrigin ? { cuisineOrigin } : {}),
    ...(mealType ? { mealType } : {}),
    ...(mealMoment ? { mealMoment } : {}),
    ...(moveCopy ? { moveCopy } : {}),
    ...(heroImageUrl ? { heroImageUrl } : {}),
    ...(heroImageSource ? { heroImageSource } : {}),
    ...(heroImageSourceUrl ? { heroImageSourceUrl } : {}),
    ...(heroImageCredit ? { heroImageCredit } : {}),
    momentumScore,
    popularityScore,
    [TREND_SHORT_DESCRIPTOR]: shortDesc,
    [TREND_WHY_HITTING]: whyAll,
    [TREND_MOST_SPOTTED]: most,
    [TREND_WHAT_TO_ORDER]: [...whatToOrder],
    [TREND_WORTH_SPLURGE]: worth,
    [TREND_EASY_ENTRY]: easy,
    [TREND_WHY_WORKS]: worksRaw,
    ...(convergence ? { convergence } : {}),
  };
}

/** Disk shape for `data/la-food-trends.json` — editorial keys only (no duplicate `description` / `menuItems`). */
export function trendToJsonObject(t: Trend): Record<string, unknown> {
  return {
    id: t.id,
    name: t.name,
    [TREND_SHORT_DESCRIPTOR]: t[TREND_SHORT_DESCRIPTOR],
    [TREND_WHY_HITTING]: t[TREND_WHY_HITTING],
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
    ...(t.listingsSignals != null && t.listingsSignals.length > 0
      ? { listingsSignals: t.listingsSignals }
      : {}),
    ...(t.socialSignals != null && t.socialSignals.length > 0
      ? { socialSignals: t.socialSignals }
      : t.manualSocialSignals != null
        ? {
            socialSignals: {
              tiktokSpotted: t.manualSocialSignals.tiktokSpotted,
              instagramSpotted: t.manualSocialSignals.instagramSpotted,
              ...(t.manualSocialSignals.sourceNotes
                ? { sourceNotes: t.manualSocialSignals.sourceNotes }
                : {}),
              ...(t.manualSocialSignals.observedAt
                ? { observedAt: t.manualSocialSignals.observedAt }
                : {}),
            },
          }
        : {}),
    ...(t.reservationSignals != null && t.reservationSignals.length > 0
      ? { reservationSignals: t.reservationSignals }
      : {}),
    ...(t.cuisineOrigin ? { cuisineOrigin: t.cuisineOrigin } : {}),
    ...(t.mealType ? { mealType: t.mealType } : {}),
    ...(t.mealMoment ? { mealMoment: t.mealMoment } : {}),
    ...(t.moveCopy ? { moveCopy: t.moveCopy } : {}),
    momentumScore: t.momentumScore,
    popularityScore: t.popularityScore,
    ...(t.heroImageUrl ? { heroImageUrl: t.heroImageUrl } : {}),
    ...(t.heroImageSource ? { heroImageSource: t.heroImageSource } : {}),
    ...(t.heroImageSourceUrl ? { heroImageSourceUrl: t.heroImageSourceUrl } : {}),
    ...(t.heroImageCredit ? { heroImageCredit: t.heroImageCredit } : {}),
    ...(t.convergence
      ? {
          convergence: {
            convergenceScore: t.convergence.convergenceScore,
            confidence: t.convergence.confidence,
            trendState: t.convergence.trendState,
            strongestSources: t.convergence.strongestSources,
            sourceDiversity: t.convergence.sourceDiversity,
            geoSpreadScore: t.convergence.geoSpreadScore,
            persistenceScore: t.convergence.persistenceScore,
            reasons: t.convergence.reasons,
            whyItsEverywhereNarrative: t.convergence.whyItsEverywhereNarrative,
            publicNarrative: t.convergence.publicNarrative,
            computedAt: t.convergence.computedAt,
          },
        }
      : {}),
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
