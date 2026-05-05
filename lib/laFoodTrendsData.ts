import fs from "node:fs/promises";
import path from "node:path";
import type { LaFoodTrendsDataFile, Trend } from "@/types/laFoodTrend";
import { laFoodTrendsFileToDiskJson, normalizeTrendRow } from "@/lib/normalizeTrend";
import type { WherePick } from "@/components/foodtrend/wherePick";
import { WHERE_SHOWING_PICKS } from "@/lib/whereShowing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const LA_FOOD_TRENDS_DATA_FILE = path.join(process.cwd(), "data", "la-food-trends.json");

/** Editorial cap for “right now” lists (homepage snapshot + report main column). */
export const DISPLAY_PRIMARY_TREND_COUNT = 5;

/** Cap for the About to Hit / early-signals strip. */
export const DISPLAY_ABOUT_TO_HIT_COUNT = 3;

export function sortTrendsBySignalDesc(trends: readonly Trend[]): Trend[] {
  return [...trends].sort((a, b) => {
    const da = Number(a.signalScore) || 0;
    const db = Number(b.signalScore) || 0;
    if (db !== da) {
      return db - da;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Top N primary trends for UI (signal strength, stable tie-break). */
export function getDisplayPrimaryTrends(
  data: LaFoodTrendsDataFile,
  limit: number = DISPLAY_PRIMARY_TREND_COUNT,
): Trend[] {
  return sortTrendsBySignalDesc(data.trends ?? []).slice(0, limit);
}

/** Top N about-to-hit trends for UI. */
export function getDisplayAboutToHit(
  data: LaFoodTrendsDataFile,
  limit: number = DISPLAY_ABOUT_TO_HIT_COUNT,
): Trend[] {
  return sortTrendsBySignalDesc(data.aboutToHit ?? []).slice(0, limit);
}

export function parseLaFoodTrendsDataFile(raw: unknown): LaFoodTrendsDataFile {
  if (!isRecord(raw)) {
    throw new Error("LA food trends JSON must be an object");
  }
  const trends = raw.trends;
  if (!Array.isArray(trends)) {
    throw new Error("LA food trends JSON must include a trends array");
  }
  const aboutRaw = raw.aboutToHit;
  const aboutToHitArr = Array.isArray(aboutRaw) ? aboutRaw : [];
  const normalizedTrends = (trends as unknown[]).map((t) => normalizeTrendRow(t));
  const normalizedAbout = (aboutToHitArr as unknown[]).map((t) => normalizeTrendRow(t));

  let lastUpdated =
    typeof raw.lastUpdated === "string" ? raw.lastUpdated.trim() : "";
  if (!lastUpdated) {
    const fromRows = [...normalizedTrends, ...normalizedAbout]
      .map((t) => t.lastUpdated.trim())
      .filter(Boolean);
    if (fromRows.length > 0) {
      fromRows.sort();
      lastUpdated = fromRows[fromRows.length - 1] ?? "";
    }
  }

  const refreshType =
    raw.refreshType === "weekly" || raw.refreshType === "weekend"
      ? raw.refreshType
      : undefined;
  const weekendNoteRaw = raw.weekendNote;
  const weekendNote =
    typeof weekendNoteRaw === "string" && weekendNoteRaw.trim()
      ? weekendNoteRaw.trim()
      : undefined;
  const sourceCountRaw = raw.sourceCount;
  const sourceCount =
    typeof sourceCountRaw === "number" && Number.isFinite(sourceCountRaw)
      ? sourceCountRaw
      : undefined;

  return {
    lastUpdated,
    refreshType,
    weekendNote,
    sourceCount,
    trends: normalizedTrends,
    aboutToHit: normalizedAbout,
  };
}

export async function writeLaFoodTrendsDataFile(data: LaFoodTrendsDataFile): Promise<void> {
  const json = `${JSON.stringify(laFoodTrendsFileToDiskJson(data), null, 2)}\n`;
  await fs.writeFile(LA_FOOD_TRENDS_DATA_FILE, json, "utf-8");
}

export async function readLaFoodTrendsDataFile(): Promise<LaFoodTrendsDataFile> {
  const raw = await fs.readFile(LA_FOOD_TRENDS_DATA_FILE, "utf-8");
  return parseLaFoodTrendsDataFile(JSON.parse(raw));
}

export function formatSnapshotDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "America/Los_Angeles",
  }).format(d);
}

/** Distinct source labels across all trends (MVP provenance roll-up). */
export function countUniqueSourcesInFile(data: LaFoodTrendsDataFile): number {
  const set = new Set<string>();
  for (const t of data.trends) {
    for (const s of t.sources) {
      const x = s.trim();
      if (x) set.add(x);
    }
  }
  for (const t of data.aboutToHit) {
    for (const s of t.sources) {
      const x = s.trim();
      if (x) set.add(x);
    }
  }
  return set.size;
}

/** Subtle one-line label for the snapshot date (Pacific). */
export function formatUpdatedLabel(data: LaFoodTrendsDataFile): string | null {
  const lu = data.lastUpdated?.trim();
  if (!lu) {
    return null;
  }
  return `Updated ${formatSnapshotDate(lu)}`;
}

export function getDataFreshnessSummary(
  data: LaFoodTrendsDataFile,
  opts?: { includeDate?: boolean },
): string | null {
  const includeDate = opts?.includeDate !== false;
  const parts: string[] = [];
  const lu = data.lastUpdated?.trim();
  if (includeDate && lu) {
    parts.push(`Last updated ${formatSnapshotDate(lu)}`);
  }
  const n = countUniqueSourcesInFile(data);
  if (n > 0) {
    parts.push(`${n} sources`);
  }
  if (!parts.length) {
    return null;
  }
  return parts.join(" · ");
}

export function mapTrendToWherePicks(trend: Trend): WherePick[] {
  const curated = WHERE_SHOWING_PICKS[trend.name];
  if (curated?.length) {
    return [...curated];
  }
  if (!trend.restaurants.length) {
    return [
      {
        restaurant: "—",
        neighborhood: trend.neighborhoods[0] ?? "LA",
        dish: trend.menuItems[0] ?? trend.name,
      },
    ];
  }
  return trend.restaurants.map((r, i) => ({
    restaurant: r.name,
    neighborhood: r.neighborhood,
    dish: trend.menuItems[i] ?? trend.menuItems[0] ?? trend.name,
  }));
}

export function barsFromSignalScore(signalScore: number): {
  menu: number;
  search: number;
  social: number;
} {
  const s = Math.min(10, Math.max(0, Math.round(signalScore / 10)));
  return {
    menu: s,
    search: Math.min(10, Math.max(0, s - 1)),
    social: Math.min(10, Math.max(0, s - 2)),
  };
}

export function stageArrowFromConfidence(
  confidence: Trend["confidence"],
): string {
  if (confidence === "high") return "↑ PEAK";
  if (confidence === "medium") return "↑ HIGH";
  return "↑ RISING";
}
