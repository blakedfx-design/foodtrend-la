import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { LA_FOOD_TRENDS_DATA_FILE, readLaFoodTrendsDataFile } from "@/lib/laFoodTrendsData";
import { envPresenceFlags } from "@/lib/pipelineAudit";
import {
  getEditorialFeedDiagnostics,
  getEditorialSignals,
  getLastEditorialIngestionStats,
} from "@/lib/signals/sources/editorialSignals";
import { getGooglePlacesSignals } from "@/lib/signals/sources/googlePlacesSignals";
import { getRedditSignals } from "@/lib/signals/sources/redditSignals";
import { getReservationSignals } from "@/lib/signals/sources/reservationSignals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthStatus = "green" | "yellow" | "red";

type SourceHealth = {
  status: HealthStatus;
  enabled: boolean;
  lastSuccessAt: string | null;
  freshnessMinutes: number | null;
  signalCount: number;
  parseCount: number;
  failureCount: number;
  stale: boolean;
  notes: string[];
};

type JobHealth = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  durationMs: number | null;
  status: HealthStatus;
  errorMessage: string | null;
};

type StorageHealth = {
  exists: boolean;
  readable: boolean;
  lastModified: string | null;
  entryCount: number;
  stale: boolean;
  status: HealthStatus;
  notes: string[];
};

function minutesSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((nowMs - t) / 60000));
}

function staleByMinutes(minutes: number | null, threshold: number): boolean {
  return minutes != null && minutes > threshold;
}

function sourceStatus(args: {
  enabled: boolean;
  stale: boolean;
  failureCount: number;
  signalCount: number;
  parseCount: number;
}): HealthStatus {
  if (!args.enabled) return "yellow";
  if (args.failureCount > 0) return "red";
  if (args.stale) return "red";
  if (args.parseCount === 0 && args.signalCount === 0) return "yellow";
  return "green";
}

function storageStatus(args: {
  exists: boolean;
  readable: boolean;
  stale: boolean;
}): HealthStatus {
  if (!args.exists || !args.readable) return "red";
  if (args.stale) return "yellow";
  return "green";
}

async function storageHealthForTrends(nowMs: number): Promise<StorageHealth> {
  const notes: string[] = [];
  try {
    const stat = await fs.stat(LA_FOOD_TRENDS_DATA_FILE);
    const raw = await fs.readFile(LA_FOOD_TRENDS_DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const trends = Array.isArray((parsed as Record<string, unknown>)?.trends)
      ? (((parsed as Record<string, unknown>).trends as unknown[]) ?? [])
      : [];
    const about = Array.isArray((parsed as Record<string, unknown>)?.aboutToHit)
      ? (((parsed as Record<string, unknown>).aboutToHit as unknown[]) ?? [])
      : [];
    const entryCount = trends.length + about.length;
    const lastModified = stat.mtime.toISOString();
    const stale = staleByMinutes(minutesSince(lastModified, nowMs), 7 * 24 * 60);
    if (entryCount === 0) notes.push("trend data file contains zero trend entries");
    return {
      exists: true,
      readable: true,
      lastModified,
      entryCount,
      stale,
      status: storageStatus({ exists: true, readable: true, stale }),
      notes,
    };
  } catch (e) {
    notes.push(`unable to read trend data: ${e instanceof Error ? e.message : String(e)}`);
    return {
      exists: false,
      readable: false,
      lastModified: null,
      entryCount: 0,
      stale: true,
      status: "red",
      notes,
    };
  }
}

const TREND_HISTORY_FILE = path.join(process.cwd(), "data", "trend-history.json");

async function storageHealthForHistory(nowMs: number): Promise<StorageHealth> {
  const notes: string[] = [];
  try {
    const stat = await fs.stat(TREND_HISTORY_FILE);
    const raw = await fs.readFile(TREND_HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [];
    const entryCount = entries.length;
    const lastModified = stat.mtime.toISOString();
    const stale = staleByMinutes(minutesSince(lastModified, nowMs), 14 * 24 * 60);
    if (!Array.isArray(parsed)) notes.push("trend history file is not an array");
    return {
      exists: true,
      readable: true,
      lastModified,
      entryCount,
      stale,
      status: storageStatus({ exists: true, readable: true, stale }),
      notes,
    };
  } catch (e) {
    notes.push(`trend history missing or unreadable: ${e instanceof Error ? e.message : String(e)}`);
    return {
      exists: false,
      readable: false,
      lastModified: null,
      entryCount: 0,
      stale: true,
      status: "red",
      notes,
    };
  }
}

function jobStatus(lastSuccessAt: string | null, thresholdMinutes: number): HealthStatus {
  if (!lastSuccessAt) return "yellow";
  const freshness = minutesSince(lastSuccessAt, Date.now());
  if (staleByMinutes(freshness, thresholdMinutes)) return "yellow";
  return "green";
}

export async function GET() {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  try {
    const env = envPresenceFlags();
    const data = await readLaFoodTrendsDataFile();
    const editorialAll = await getEditorialSignals(data, nowIso);
    const editorialStats = getLastEditorialIngestionStats();
    const editorialDiagnostics = await getEditorialFeedDiagnostics();
    const redditSignals = await getRedditSignals();
    const placesSignals = await getGooglePlacesSignals();
    const reservationSignals = await getReservationSignals();

    const editorialSignals = editorialAll.filter(
      (s) => s.source === "eater" || s.source === "infatuation" || s.source === "latimes",
    );
    const manualEditorialSignals = editorialAll.filter((s) => s.source === "manual_editorial");
    const editorialSuccessAt = editorialDiagnostics
      .map((d) => d.fetchedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    const redditFreshness = minutesSince(data.lastUpdated || null, nowMs);
    const placesFreshness = minutesSince(data.lastUpdated || null, nowMs);
    const reservationFreshness = minutesSince(data.lastUpdated || null, nowMs);
    const editorialFreshness = minutesSince(editorialSuccessAt, nowMs);
    const manualFreshness = minutesSince(data.lastUpdated || null, nowMs);

    const sources: Record<string, SourceHealth> = {
      reddit: {
        enabled: env.hasRedditClient,
        lastSuccessAt: redditSignals.length > 0 ? data.lastUpdated || null : null,
        freshnessMinutes: redditSignals.length > 0 ? redditFreshness : null,
        signalCount: redditSignals.length,
        parseCount: redditSignals.length,
        failureCount: 0,
        stale: env.hasRedditClient ? staleByMinutes(redditFreshness, 24 * 60) : false,
        notes: env.hasRedditClient
          ? redditSignals.length === 0
            ? ["connector enabled but returned zero signals (adapter currently lightweight)"]
            : []
          : ["missing Reddit credentials or connector intentionally disabled"],
        status: "yellow",
      },
      editorial: {
        enabled: true,
        lastSuccessAt: editorialSuccessAt,
        freshnessMinutes: editorialFreshness,
        signalCount: editorialSignals.length,
        parseCount: editorialStats.scannedTotal,
        failureCount: editorialDiagnostics.filter((d) => d.failureReason != null).length,
        stale: staleByMinutes(editorialFreshness, 12 * 60),
        notes: editorialDiagnostics
          .filter((d) => d.failureReason != null)
          .map((d) => `${d.source}: ${d.failureReason}`),
        status: "green",
      },
      google_places: {
        enabled: env.hasGooglePlacesKey,
        lastSuccessAt: placesSignals.length > 0 ? data.lastUpdated || null : null,
        freshnessMinutes: placesSignals.length > 0 ? placesFreshness : null,
        signalCount: placesSignals.length,
        parseCount: placesSignals.length,
        failureCount: 0,
        stale: env.hasGooglePlacesKey ? staleByMinutes(placesFreshness, 24 * 60) : false,
        notes: env.hasGooglePlacesKey
          ? placesSignals.length === 0
            ? ["connector enabled but signal adapter currently returns no normalized rows"]
            : []
          : ["GOOGLE_PLACES_API_KEY missing"],
        status: "yellow",
      },
      reservations: {
        enabled: false,
        lastSuccessAt: reservationSignals.length > 0 ? data.lastUpdated || null : null,
        freshnessMinutes: reservationSignals.length > 0 ? reservationFreshness : null,
        signalCount: reservationSignals.length,
        parseCount: reservationSignals.length,
        failureCount: 0,
        stale: false,
        notes: ["reservation connector placeholder (no active API ingestion)"],
        status: "yellow",
      },
      manual_editorial: {
        enabled: true,
        lastSuccessAt: data.lastUpdated || null,
        freshnessMinutes: manualFreshness,
        signalCount: manualEditorialSignals.length,
        parseCount: manualEditorialSignals.length,
        failureCount: 0,
        stale: staleByMinutes(manualFreshness, 14 * 24 * 60),
        notes: [],
        status: "green",
      },
    };

    for (const key of Object.keys(sources)) {
      const s = sources[key];
      s.status = sourceStatus({
        enabled: s.enabled,
        stale: s.stale,
        failureCount: s.failureCount,
        signalCount: s.signalCount,
        parseCount: s.parseCount,
      });
    }

    const storage = {
      foodTrendData: await storageHealthForTrends(nowMs),
      trendHistory: await storageHealthForHistory(nowMs),
    };

    const weeklyRefresh: JobHealth = {
      lastRunAt: data.refreshType === "weekly" ? data.lastUpdated || null : null,
      lastSuccessAt: data.refreshType === "weekly" ? data.lastUpdated || null : null,
      durationMs: null,
      status: jobStatus(data.refreshType === "weekly" ? data.lastUpdated || null : null, 9 * 24 * 60),
      errorMessage: null,
    };
    const weekendRefresh: JobHealth = {
      lastRunAt: data.refreshType === "weekend" ? data.lastUpdated || null : null,
      lastSuccessAt: data.refreshType === "weekend" ? data.lastUpdated || null : null,
      durationMs: null,
      status: jobStatus(data.refreshType === "weekend" ? data.lastUpdated || null : null, 4 * 24 * 60),
      errorMessage: null,
    };
    const redditPull: JobHealth = {
      lastRunAt: sources.reddit.lastSuccessAt,
      lastSuccessAt: sources.reddit.lastSuccessAt,
      durationMs: null,
      status: sources.reddit.enabled ? (sources.reddit.signalCount > 0 ? "green" : "yellow") : "yellow",
      errorMessage: sources.reddit.enabled && sources.reddit.signalCount === 0 ? "no normalized reddit signals" : null,
    };
    const trendUpdate: JobHealth = {
      lastRunAt: data.lastUpdated || null,
      lastSuccessAt: data.lastUpdated || null,
      durationMs: null,
      status: jobStatus(data.lastUpdated || null, 3 * 24 * 60),
      errorMessage: null,
    };

    const jobs = { weeklyRefresh, weekendRefresh, redditPull, trendUpdate };
    const sourceValues = Object.values(sources);
    const sourceRed = sourceValues.filter((s) => s.status === "red").length;
    const anyStorageRed = Object.values(storage).some((s) => s.status === "red");
    const anyYellow =
      Object.values(jobs).some((j) => j.status === "yellow") ||
      sourceValues.some((s) => s.status === "yellow") ||
      Object.values(storage).some((s) => s.status === "yellow");

    const overallStatus: HealthStatus = anyStorageRed || sourceRed >= 2 || trendUpdate.status === "red"
      ? "red"
      : anyYellow || sourceRed === 1
        ? "yellow"
        : "green";

    return NextResponse.json({
      generatedAt: nowIso,
      overallStatus,
      jobs,
      sources,
      storage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        generatedAt: nowIso,
        overallStatus: "red",
        error: msg,
      },
      { status: 500 },
    );
  }
}
