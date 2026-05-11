import {
  getDisplayPrimaryTrends,
  readLaFoodTrendsDataFile,
} from "@/lib/laFoodTrendsData";
import type { LaFoodTrendsDataFile, Trend } from "@/types/laFoodTrend";
import {
  getPipelineHealthPayload,
  type PipelineHealthPayload,
  type SourceHealth,
} from "@/lib/debug/getPipelineHealth";
import {
  getEditorialSignalsDebugPayload,
  type EditorialSignalsDebugPayload,
} from "@/lib/debug/getEditorialSignals";
import {
  getTrendTransitionTimelinePayload,
  type TrendTransitionTimelinePayload,
} from "@/lib/debug/getTrendTransitions";

export type AdminDataBundle = {
  pipeline: PipelineHealthPayload | null;
  pipelineError: string | null;
  editorial: EditorialSignalsDebugPayload | null;
  editorialError: string | null;
  transitions: TrendTransitionTimelinePayload | null;
  transitionError: string | null;
  trendData: LaFoodTrendsDataFile | null;
  trendDataError: string | null;
};

export async function loadAdminDataBundle(): Promise<AdminDataBundle> {
  const [pipelineResult, editorialResult, transitionResult, trendDataResult] = await Promise.allSettled([
    getPipelineHealthPayload(),
    getEditorialSignalsDebugPayload(),
    getTrendTransitionTimelinePayload(),
    readLaFoodTrendsDataFile(),
  ]);

  return {
    pipeline: pipelineResult.status === "fulfilled" ? pipelineResult.value : null,
    pipelineError:
      pipelineResult.status === "rejected"
        ? pipelineResult.reason instanceof Error
          ? pipelineResult.reason.message
          : String(pipelineResult.reason)
        : null,
    editorial: editorialResult.status === "fulfilled" ? editorialResult.value : null,
    editorialError:
      editorialResult.status === "rejected"
        ? editorialResult.reason instanceof Error
          ? editorialResult.reason.message
          : String(editorialResult.reason)
        : null,
    transitions: transitionResult.status === "fulfilled" ? transitionResult.value : null,
    transitionError:
      transitionResult.status === "rejected"
        ? transitionResult.reason instanceof Error
          ? transitionResult.reason.message
          : String(transitionResult.reason)
        : null,
    trendData: trendDataResult.status === "fulfilled" ? trendDataResult.value : null,
    trendDataError:
      trendDataResult.status === "rejected"
        ? trendDataResult.reason instanceof Error
          ? trendDataResult.reason.message
          : String(trendDataResult.reason)
        : null,
  };
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

export function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

export function sourceMixLabel(sourceMix: Record<string, number>): string {
  const parts = Object.entries(sourceMix).map(([k, v]) => `${k}: ${v}`);
  return parts.length > 0 ? parts.join(" · ") : "-";
}

export function computeReadiness(
  pipeline: PipelineHealthPayload | null,
  editorial: EditorialSignalsDebugPayload | null,
): { verdict: "Ready" | "Caution" | "Not Ready"; reasons: string[] } {
  const reasons: string[] = [];
  if (!pipeline) return { verdict: "Not Ready", reasons: ["pipeline health unavailable"] };
  const foodTrendData = pipeline.storage?.foodTrendData;
  const trendUpdate = pipeline.jobs?.trendUpdate;
  const sourceList = Object.values(pipeline.sources ?? {});
  const redSources = sourceList.filter((s) => s.status === "red");
  const yellowSources = sourceList.filter((s) => s.status === "yellow");
  const optionalDisabled = sourceList.filter((s) => !s.enabled).length;
  const staleWarnings = sourceList.filter((s) => s.stale).length;
  const failedEditorialCount = editorial?.failedSources?.length ?? 0;

  if (!foodTrendData?.readable) reasons.push("food trend data unreadable");
  if (trendUpdate?.status === "red") reasons.push("trend update job failed");
  if (redSources.length >= 2) reasons.push("multiple red sources");
  if (failedEditorialCount > 0) reasons.push("editorial feed failures present");
  if (reasons.length > 0) return { verdict: "Not Ready", reasons };

  const cautionReasons: string[] = [];
  if (yellowSources.length > 0) cautionReasons.push("yellow source statuses present");
  if (optionalDisabled > 0) cautionReasons.push("optional sources disabled");
  if (staleWarnings > 0) cautionReasons.push("stale source warnings present");
  if (pipeline.overallStatus === "yellow") cautionReasons.push("pipeline overall status is yellow");

  if (cautionReasons.length > 0) return { verdict: "Caution", reasons: cautionReasons };
  return { verdict: "Ready", reasons: ["all readiness checks passed"] };
}

export function topTrendCards(trendData: LaFoodTrendsDataFile | null): Trend[] {
  if (!trendData) return [];
  return getDisplayPrimaryTrends(trendData, 5);
}

export function healthySourceCount(sources: Record<string, SourceHealth> | null | undefined): number {
  if (!sources) return 0;
  return Object.values(sources).filter((s) => s.status === "green").length;
}
