import type { DishTrendCandidate } from "../types/trend";

export const MIN_RESTAURANTS_FOR_TREND = 2;
export const DEFAULT_SOURCE = "https://la.eater.com/";

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "style",
  "la",
  "los",
  "angeles",
  "new",
  "mini",
]);

const BANNED_TREND_NAMES_EXACT = new Set([
  "thick burgers",
  "izakayas everywhere",
  "reimagined bagels",
  "burgers",
  "best burgers",
  "fancy burgers",
]);

export function normalizeVenue(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function distinctRestaurantCount(venues: string[]): number {
  return new Set(venues.map(normalizeVenue).filter(Boolean)).size;
}

export function dedupeVenues(venues: string[]): string[] {
  const map = new Map<string, string>();
  for (const v of venues) {
    const key = normalizeVenue(v);
    if (key && !map.has(key)) {
      map.set(key, v.trim());
    }
  }
  return [...map.values()];
}

export function isDishHeadlineTrendName(name: string): boolean {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 10) {
    return false;
  }
  return words.every((word) => /^[A-Z]/.test(word));
}

export function readsLikeVenueReview(text: string): boolean {
  const t = text.trim();
  const lower = t.toLowerCase();
  if (
    /\b(ambiance|ambience|service was|our server|reservation|vibe was|interior|decor)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(we went|my favorite spot|highly recommend visiting|worth the hype for the room)/i.test(
    t,
  )) {
    return true;
  }
  if (
    /\b(cozy|elegant|instagrammable)\s+(space|room|dining room)\b/i.test(lower) &&
    !/\b(menu|dish|bowl|sandwich|burrito|pastry)\b/i.test(lower)
  ) {
    return true;
  }
  return false;
}

export function isDishLedTrendCopy(text: string, minLen: number, maxLen: number): boolean {
  const t = text.trim();
  if (t.length < minLen || t.length > maxLen) {
    return false;
  }
  if (/^(at\s|visit\s|check out\s|located\s|opened\s|chef\s|named\s)/i.test(t)) {
    return false;
  }
  if (readsLikeVenueReview(t)) {
    return false;
  }
  return true;
}

export function evidenceMentionsMultiVenueSpread(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(multiple|several|many|various|across|spreading|two|three|popping up|showing up|on menus at)\b/.test(
      lower,
    ) || /\d+\s*(venues|spots|places|restaurants|menus)/.test(lower)
  );
}

export function autoEvidenceFromRestaurants(venues: string[]): string {
  const list = venues.join(", ");
  return `Seen across multiple LA spots: ${list}`;
}

export function coerceHttpsSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [DEFAULT_SOURCE];
  }
  const urls = raw.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim()));
  if (urls.length === 0) {
    return [DEFAULT_SOURCE];
  }
  return urls.slice(0, 2);
}

function trendNameIsVenueName(trendName: string, venues: string[]): boolean {
  const t = normalizeVenue(trendName);
  return venues.some((v) => {
    const nv = normalizeVenue(v);
    return nv.length > 0 && (t === nv || t.startsWith(`${nv} `) || t.endsWith(` ${nv}`));
  });
}

/** Reject venue-category headlines and lazy generic dish labels */
export function isGenericOrCategoryTrendName(name: string): boolean {
  const trimmed = name.trim();
  const lower = normalizeVenue(trimmed);

  if (BANNED_TREND_NAMES_EXACT.has(lower)) {
    return true;
  }

  if (/\beverywhere\b/i.test(trimmed)) {
    return true;
  }

  if (/reimagined\s+bagels?/i.test(lower)) {
    return true;
  }

  if (/thick\s+burgers?/i.test(lower)) {
    return true;
  }

  if (/^(thick|juicy|smash|double|fancy|best|ultimate|gourmet)\s+burgers?$/i.test(trimmed)) {
    return true;
  }

  if (/^izakayas?\b/i.test(lower)) {
    return true;
  }

  if (/\bizakayas?\s+(everywhere|boom|wave|rise)/i.test(trimmed)) {
    return true;
  }

  if (/^(steakhouses?|taquerias?|brewpubs?|wine\s+bars?)\b/i.test(lower)) {
    return true;
  }

  if (/\b(neighborhood|premium)\s+(joints?|spots?|scene)\b/i.test(lower)) {
    return true;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 2) {
    const w = words[1].toLowerCase();
    const genericSecond = ["burgers", "pizza", "ramen", "sushi", "tacos", "bowls", "steaks"];
    const vagueFirst = /^(best|great|better|fancy|loaded|street|classic|modern)$/i.test(words[0]);
    if (genericSecond.includes(w) && vagueFirst) {
      return true;
    }
  }

  return false;
}

function tokenSetForOverlap(s: string): Set<string> {
  const cleaned = normalizeVenue(s).replace(/[^a-z0-9\s]/g, " ");
  const parts = cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(parts);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) {
      inter += 1;
    }
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** True if two trend headlines are the same story for dedupe across sections */
export function trendsOverlapAcrossSections(a: string, b: string): boolean {
  const na = normalizeVenue(a);
  const nb = normalizeVenue(b);
  if (!na || !nb) {
    return false;
  }
  if (na === nb) {
    return true;
  }

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  if (shorter.length >= 10 && longer.includes(shorter)) {
    return true;
  }

  return jaccardSimilarity(tokenSetForOverlap(a), tokenSetForOverlap(b)) >= 0.55;
}

/**
 * Normalize and validate a scout row into a dish candidate.
 * Drops model-supplied ranks/scores if present.
 */
export function normalizeDishCandidate(raw: unknown): DishTrendCandidate | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const o = raw as Record<string, unknown>;

  const trend_name = typeof o.trend_name === "string" ? o.trend_name.trim() : "";
  if (
    trend_name.length < 8 ||
    trend_name.length > 72 ||
    !isDishHeadlineTrendName(trend_name) ||
    isGenericOrCategoryTrendName(trend_name)
  ) {
    return null;
  }

  let representative_restaurants = Array.isArray(o.representative_restaurants)
    ? o.representative_restaurants
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter(Boolean)
    : [];
  representative_restaurants = dedupeVenues(representative_restaurants);
  if (distinctRestaurantCount(representative_restaurants) < MIN_RESTAURANTS_FOR_TREND) {
    return null;
  }
  if (representative_restaurants.length > 8) {
    representative_restaurants = representative_restaurants.slice(0, 8);
  }

  if (trendNameIsVenueName(trend_name, representative_restaurants)) {
    return null;
  }

  let definition =
    typeof o.definition === "string" ? o.definition.trim() : "";
  if (
    definition.length < 24 ||
    definition.length > 220 ||
    definition.toLowerCase() === trend_name.toLowerCase() ||
    readsLikeVenueReview(definition)
  ) {
    definition = `${trend_name} — a repeatable dish pattern showing up on multiple LA menus (format + flavor hook).`;
    if (definition.length > 220) {
      definition = definition.slice(0, 217) + "...";
    }
  }

  let evidence_of_spread =
    typeof o.evidence_of_spread === "string" ? o.evidence_of_spread.trim() : "";

  const evidenceOk =
    evidence_of_spread.length >= 24 &&
    !readsLikeVenueReview(evidence_of_spread) &&
    (evidenceMentionsMultiVenueSpread(evidence_of_spread) ||
      isDishLedTrendCopy(evidence_of_spread, 24, 320));

  if (!evidenceOk) {
    evidence_of_spread = autoEvidenceFromRestaurants(representative_restaurants);
  }

  let why_hot = typeof o.why_hot === "string" ? o.why_hot.trim() : "";
  if (!isDishLedTrendCopy(why_hot, 24, 220)) {
    why_hot =
      "Growing visibility on LA menus and social feeds as diners chase this format.";
    if (why_hot.length > 220) {
      why_hot = why_hot.slice(0, 217) + "...";
    }
  }

  return {
    trend_name,
    definition,
    representative_restaurants,
    evidence_of_spread,
    why_hot,
    sources: coerceHttpsSources(o.sources),
  };
}
