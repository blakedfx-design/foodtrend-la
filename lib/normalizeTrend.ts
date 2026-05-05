import type {
  LaFoodTrendsDataFile,
  Trend,
  TrendConfidence,
  TrendRestaurant,
} from "@/types/laFoodTrend";
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
  return restaurants.map((r, i) => ({
    restaurant: r.name,
    neighborhood: r.neighborhood,
    dish: menuItems[i] ?? menuItems[0] ?? name,
  }));
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
  const restaurants = (Array.isArray(r.restaurants) ? r.restaurants : []) as TrendRestaurant[];
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

  return {
    id,
    name,
    signalScore: Number(r.signalScore ?? 0),
    lastUpdated: String(r.lastUpdated ?? ""),
    sources: (Array.isArray(r.sources) ? r.sources : []) as string[],
    confidence: r.confidence as TrendConfidence,
    neighborhoods,
    restaurants,
    menuItems: whatToOrder,
    description: shortDesc,
    whyItsEverywhere: whyAll,
    whyItWorks: worksRaw || undefined,
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
    restaurants: t.restaurants,
    [TREND_WHAT_TO_ORDER]: t[TREND_WHAT_TO_ORDER],
    [TREND_MOST_SPOTTED]: t[TREND_MOST_SPOTTED],
    [TREND_WORTH_SPLURGE]: t[TREND_WORTH_SPLURGE],
    [TREND_EASY_ENTRY]: t[TREND_EASY_ENTRY],
    [TREND_WHY_WORKS]: t[TREND_WHY_WORKS],
    confidence: t.confidence,
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
