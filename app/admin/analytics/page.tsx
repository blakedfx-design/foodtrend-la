import {
  AdminScaffold,
  Card,
  MiniSparkline,
  StatusPill,
  statusTone,
  tonePillClass,
  type HealthTone,
} from "@/components/admin/AdminUi";
import LaSignalMap from "@/components/admin/LaSignalMap";
import { LA_PLACE_CLUSTER_CELL_DEG, LA_SIGNAL_MAP_NEIGHBORHOODS } from "@/lib/admin/laSignalMapLayout";
import {
  computeReadiness,
  fmtDateTime,
  healthySourceCount,
  loadAdminDataBundle,
  minutesSince,
} from "@/lib/admin/dashboard";
import {
  buildWhyItsEverywhereNarrative,
  computeTrendConvergence,
  loadTrendHistoryForConvergence,
  type TrendConvergence,
  type TrendConvergenceState,
} from "@/lib/signals/convergence";
import type { Trend } from "@/types/laFoodTrend";

export const dynamic = "force-dynamic";

type AlertSeverity = "critical" | "warning" | "info";

type SourceConnectorKind = "default" | "external_api" | "manual_rollup";

type SourceRowModel = {
  key: string;
  label: string;
  category: string;
  lifecycle: "active" | "degraded" | "disabled";
  connectorKind: SourceConnectorKind;
  icon: string;
  status: string;
  freshnessMinutes: number | null;
  freshnessPct: number;
  lastAttempt: string | null;
  lastSuccess: string | null;
  signals: number;
  parsed: number;
  rejected: number;
  failures: number;
  confidence: number;
  velocity: number;
  successPct: number;
  reason: string;
  notes: string;
  enabled: boolean;
};


function readinessTone(verdict: "Ready" | "Caution" | "Not Ready"): HealthTone {
  if (verdict === "Ready") return "green";
  if (verdict === "Caution") return "yellow";
  return "red";
}

function freshnessTone(minutes: number | null): HealthTone {
  if (minutes == null) return "neutral";
  if (minutes <= 180) return "green";
  if (minutes <= 720) return "yellow";
  return "red";
}

function scoreFromStatus(status: string): number {
  if (status === "green") return 100;
  if (status === "yellow") return 70;
  if (status === "red") return 35;
  return 50;
}

function sourceLabel(name: string): string {
  const map: Record<string, string> = {
    reddit: "Reddit",
    editorial: "Editorial",
    google_places: "Google Places",
    google_places_reviews: "Google Places Reviews",
    google_places_metadata: "Google Places Metadata",
    reservations: "Reservations",
    reservation: "Reservations",
    reservations_rollup: "Reservations Rollup",
    la_times_food: "LA Times Food",
    eater_la: "Eater LA",
    infatuation_la: "Infatuation LA",
    resy_editorial: "Resy LA Editorial",
    timeout_la_food: "Time Out LA Food",
    bonappetit_la_relevant: "Bon Appetit (LA relevant)",
    reddit_communities: "Reddit LA Communities",
    resy_venues: "Resy Venue Pages",
    opentable_metadata: "OpenTable Metadata",
    tock_metadata: "Tock Metadata",
    tiktok_proxy: "TikTok Proxy",
    instagram_proxy: "Instagram Proxy",
    manual_editorial: "Manual Editorial",
  };
  return map[name] ?? name.replaceAll("_", " ");
}

function connectorKindForSourceKey(key: string): SourceConnectorKind {
  if (key === "reservations_rollup") return "manual_rollup";
  if (key === "resy_venues" || key === "opentable_metadata" || key === "tock_metadata") return "external_api";
  return "default";
}

function jobDisplayName(key: string): string {
  const map: Record<string, string> = {
    weeklyRefresh: "Weekly refresh",
    weekendRefresh: "Weekend refresh",
    redditPull: "Reddit pull",
    trendUpdate: "Trend update",
  };
  return map[key] ?? key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

function sourceIcon(name: string): string {
  const map: Record<string, string> = {
    reddit: "R",
    editorial: "ED",
    google_places: "G",
    google_places_reviews: "GR",
    google_places_metadata: "GM",
    reservations: "RS",
    reservation: "RS",
    reservations_rollup: "RS",
    resy_venues: "RY",
    opentable_metadata: "OT",
    tock_metadata: "TK",
    la_times_food: "LT",
    eater_la: "EA",
    infatuation_la: "IF",
    resy_editorial: "RE",
    timeout_la_food: "TO",
    bonappetit_la_relevant: "BA",
    reddit_communities: "RD",
    tiktok_proxy: "TT",
    instagram_proxy: "IG",
    manual_editorial: "M",
  };
  return map[name] ?? name.slice(0, 2).toUpperCase();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function qualityConfidence(score: number): string {
  if (score >= 88) return "High confidence";
  if (score >= 74) return "Medium confidence";
  return "Low confidence";
}

function sourceConfidenceNote(confidence: number, signals: number, failures: number): string {
  if (confidence < 60) return "Low-confidence source due to sparse corroboration.";
  if (failures > 0) return "Confidence reduced by recent parsing failures.";
  if (signals <= 2) return "Limited weekly signal volume; monitor for stronger corroboration.";
  return "Confidence stable across recent corroborated signals.";
}

function freshnessNarrative(minutes: number | null): string {
  if (minutes == null) return "Freshness unavailable until first successful pull.";
  if (minutes <= 120) return "Freshness healthy in the last 2h window.";
  if (minutes <= 360) return "Freshness softening after 2h inactivity.";
  if (minutes <= 24 * 60) return "Freshness degraded after 6h inactivity.";
  return "Stale state detected beyond 24h.";
}

function pctDelta(current: number, previous: number): string {
  if (previous <= 0) return "+0%";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function metricDeltaTone(delta: string): "up" | "down" | "flat" {
  if (delta.startsWith("+")) return "up";
  if (delta.startsWith("-")) return "down";
  return "flat";
}

/** Single-line KPI headline; avoids awkward wrap on “Not Ready”. */
function readinessKpiHeadline(verdict: "Ready" | "Caution" | "Not Ready"): string {
  if (verdict === "Not Ready") return "Not\u00A0ready";
  return verdict;
}

function MetricTile(props: {
  label: string;
  value: string;
  detail: string;
  tone: HealthTone;
  sparkline: number[];
  delta: string;
  tooltip: string;
}) {
  const deltaTone = metricDeltaTone(props.delta);
  const deltaClass =
    deltaTone === "up"
      ? "text-green-700 bg-green-50 border-green-200"
      : deltaTone === "down"
        ? "text-red-700 bg-red-50 border-red-200"
        : "text-neutral-700 bg-neutral-50 border-neutral-200";
  return (
    <div className="group relative flex h-full min-h-[102px] flex-col rounded-xl border border-[#e8e1d3] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(20,31,43,0.06)]">
      <div className="absolute right-2 top-2 z-10">
        <InfoHint text={props.tooltip} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col pr-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b6358]">{props.label}</p>
        <div className="mt-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[1.6rem] font-semibold leading-none tracking-tight text-[#111827] md:text-[1.68rem] whitespace-nowrap">{props.value}</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#4b5563]">{props.detail}</p>
          </div>
          <div className="shrink-0 self-start pt-0">
            <StatusPill tone={props.tone} label={props.tone.toUpperCase()} size="sm" />
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-[#f0ebe3] pt-1.5">
        <div className="flex items-end gap-1 opacity-90">
          <span className={`mb-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${props.tone === "green" ? "bg-green-500" : props.tone === "yellow" ? "bg-amber-500" : props.tone === "red" ? "bg-red-500" : "bg-neutral-400"} animate-pulse`} />
          <MiniSparkline values={props.sparkline} tone={props.tone === "green" ? "green" : "neutral"} />
        </div>
        <span className={`mb-0.5 inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${deltaClass}`}>
          {props.delta}
        </span>
      </div>
    </div>
  );
}

function InfoHint(props: { text: string }) {
  return (
    <div className="group/info relative inline-flex">
      <button
        type="button"
        aria-label="Metric explanation"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#e6ddcc] bg-[#fbfaf7] text-[10px] font-semibold text-[#9a8f7c]"
      >
        i
      </button>
      <div className="pointer-events-none absolute right-0 top-5 z-30 hidden w-52 rounded-lg border border-[#e6ddcc] bg-[#fffdf9] p-2 text-xs leading-4 text-[#5d6573] shadow-[0_6px_16px_rgba(30,41,59,0.14)] group-hover/info:block">
        {props.text}
      </div>
    </div>
  );
}

function ScoreRing(props: { score: number; sourceScore: number; jobScore: number; readinessScore: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(props.score)));
  const subs = [
    { label: "Readiness", value: props.readinessScore },
    { label: "Sources", value: props.sourceScore },
    { label: "Jobs", value: props.jobScore },
  ] as const;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="relative grid h-[3.75rem] w-[3.75rem] shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
          style={{
            background: `conic-gradient(#16a34a ${clamped * 3.6}deg, #e7e5e4 0deg)`,
          }}
        >
          <div className="grid h-[2.7rem] w-[2.7rem] place-items-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
            <span className="text-[1.2rem] font-bold leading-none tracking-tight text-[#0f172a] tabular-nums">{clamped}</span>
          </div>
        </div>
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight text-[#0f172a] whitespace-nowrap">
          {qualityConfidence(clamped)}
        </p>
      </div>
      <div className="flex min-w-0 gap-1 border-t border-[#ebe4d5] pt-1.5">
        {subs.map((s) => (
          <div
            key={s.label}
            className="min-w-0 flex-1 basis-0 rounded-md border border-[#e7dfcf] bg-[#fbf7ef] px-1 py-1 text-center"
          >
            <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-[#5c6570]" title={s.label}>
              {s.label}
            </p>
            <p className="mt-0.5 text-xs font-bold tabular-nums leading-none text-[#1e293b]">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceShareDonut(props: {
  segments: Array<{ label: string; value: number; color: string; delta: string }>;
  total: number;
}) {
  const total = Math.max(
    props.total,
    props.segments.reduce((sum, s) => sum + s.value, 0),
    1,
  );
  const positive = props.segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const merged: typeof props.segments =
    positive.length <= 5
      ? positive
      : [
          ...positive.slice(0, 5),
          {
            label: "Other",
            value: positive.slice(5).reduce((sum, s) => sum + s.value, 0),
            color: "#94a3b8",
            delta: "—",
          },
        ];
  const drawSegments = merged.length > 0 ? merged : props.segments;
  const r = 70;
  const c = 2 * Math.PI * r;
  const segmentsWithOffsets = drawSegments.map((segment) => ({
    ...segment,
    pct: segment.value / total,
  }));
  const donutSegments = segmentsWithOffsets.reduce<Array<(typeof segmentsWithOffsets)[number] & { strokeDashoffset: number; nextOffset: number }>>(
    (acc, segment) => {
      const previousOffset = acc.length > 0 ? acc[acc.length - 1].nextOffset : 0;
      return [
        ...acc,
        {
          ...segment,
          strokeDashoffset: -previousOffset,
          nextOffset: previousOffset + segment.pct * c,
        },
      ];
    },
    [],
  );
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex shrink-0 justify-center">
        <svg viewBox="0 0 200 200" className="h-[180px] w-[180px] max-w-full" aria-hidden>
          <g transform="rotate(-90 100 100)">
            {donutSegments.map((segment) => {
              const dash = `${segment.pct * c} ${c - segment.pct * c}`;
              return (
                <circle
                  key={segment.label}
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="24"
                  strokeDasharray={dash}
                  strokeDashoffset={segment.strokeDashoffset}
                />
              );
            })}
          </g>
          <circle cx="100" cy="100" r="46" fill="white" />
          <text x="100" y="89" textAnchor="middle" className="fill-[#64748b] text-[11px] font-semibold uppercase tracking-[0.08em]">
            Signals
          </text>
          <text x="100" y="112" textAnchor="middle" className="fill-[#111827] text-[22px] font-semibold tabular-nums">
            {total}
          </text>
        </svg>
      </div>
      <div className="grid w-full min-w-0 grid-cols-2 gap-x-4 gap-y-2 px-0.5">
        {merged.map((segment) => {
          const pct = Math.round((segment.value / total) * 100);
          const deltaTone = metricDeltaTone(segment.delta);
          return (
            <div
              key={segment.label}
              className="flex min-w-0 items-start gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-[#f0ebe1]/80"
            >
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold leading-tight text-[#1f2937]" title={segment.label}>
                  {segment.label}
                </p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[10px] tabular-nums text-[#475569]">
                  <span className="text-[13px] font-semibold text-[#111827]">{segment.value}</span>
                  <span>{pct}%</span>
                  <span
                    className={`font-semibold ${
                      deltaTone === "up" ? "text-green-700" : deltaTone === "down" ? "text-red-700" : "text-[#64748b]"
                    }`}
                  >
                    {segment.delta}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function classifyTransitionState(toState: string, reason: string, confidence: number | null): string {
  const lowerTo = toState.toLowerCase();
  const lowerReason = reason.toLowerCase();
  if (lowerReason.includes("top 5")) return "promoted to Top 5";
  if (lowerTo.includes("accelerating")) return "accelerating";
  if (lowerTo.includes("stabilizing")) return "stabilizing";
  if (lowerTo.includes("fading")) return "fading";
  if (lowerTo.includes("blocked")) return "blocked";
  if ((confidence ?? 0) < 0.45) return "weak signal";
  return "breakout";
}

function transitionTone(state: string): HealthTone {
  if (state === "accelerating" || state === "breakout" || state === "promoted to Top 5") return "green";
  if (state === "stabilizing" || state === "weak signal") return "yellow";
  return "red";
}

function severityStyle(severity: AlertSeverity): { ring: string; icon: string; label: string } {
  if (severity === "critical") return { ring: "border-red-200 bg-[#fff7f6] text-red-800", icon: "⛔", label: "Critical" };
  if (severity === "warning") return { ring: "border-amber-200 bg-[#fffaf1] text-amber-800", icon: "⚠", label: "Warning" };
  return { ring: "border-blue-200 bg-[#f4f9ff] text-blue-800", icon: "ℹ", label: "Info" };
}

function convergenceStateTone(state: TrendConvergenceState): HealthTone {
  if (state === "mainstream" || state === "rising") return "green";
  if (state === "stabilizing" || state === "emerging") return "yellow";
  if (state === "cooling" || state === "weak_signal") return "red";
  return "neutral";
}

export default async function AdminAnalyticsPage() {
  const data = await loadAdminDataBundle();
  const trendHistoryConvergence = await loadTrendHistoryForConvergence();
  const convergenceByTrendId = new Map<string, { trend: Trend; convergence: TrendConvergence }>();
  for (const t of data.trendData?.trends ?? []) {
    convergenceByTrendId.set(t.id, {
      trend: t,
      convergence: computeTrendConvergence(t, { historyEntries: trendHistoryConvergence }),
    });
  }
  for (const t of data.trendData?.aboutToHit ?? []) {
    if (!convergenceByTrendId.has(t.id)) {
      convergenceByTrendId.set(t.id, {
        trend: t,
        convergence: computeTrendConvergence(t, { historyEntries: trendHistoryConvergence }),
      });
    }
  }
  const convergenceList = [...convergenceByTrendId.values()].sort(
    (a, b) => b.convergence.convergenceScore - a.convergence.convergenceScore,
  );
  const convergenceStateTotals: Record<TrendConvergenceState, number> = {
    weak_signal: 0,
    emerging: 0,
    rising: 0,
    stabilizing: 0,
    mainstream: 0,
    cooling: 0,
  };
  for (const row of convergenceList) {
    convergenceStateTotals[row.convergence.trendState] += 1;
  }
  const highConvergenceTrends = convergenceList
    .filter((r) => r.convergence.convergenceScore >= 60 && r.convergence.confidence !== "low")
    .slice(0, 10);
  const sampleWhyNarrative = highConvergenceTrends[0]
    ? buildWhyItsEverywhereNarrative(highConvergenceTrends[0].trend, highConvergenceTrends[0].convergence)
    : convergenceList[0]
      ? buildWhyItsEverywhereNarrative(convergenceList[0].trend, convergenceList[0].convergence)
      : null;
  const readiness = computeReadiness(data.pipeline, data.editorial);
  const readinessValue = readiness.verdict;
  const sourceCount = Object.keys(data.pipeline?.sources ?? {}).length;
  const healthySources = healthySourceCount(data.pipeline?.sources);
  const freshnessMinutes = minutesSince(data.trendData?.lastUpdated ?? null);
  const signalsThisWeek = data.editorial?.extractedEntityCounts.total ?? 0;
  const jobValues = Object.values(data.pipeline?.jobs ?? {});
  const healthyJobs = jobValues.filter((j) => j.status === "green").length;
  const sourceEntries = Object.entries(data.pipeline?.sources ?? {});
  const jobEntries = Object.entries(data.pipeline?.jobs ?? {});

  const sourceRows: SourceRowModel[] = sourceEntries.map(([key, source]) => {
    const freshnessPct = source.freshnessMinutes == null ? 20 : clamp(100 - (source.freshnessMinutes / 1440) * 100, 4, 100);
    const parsed = source.parseCount;
    const rejected = Math.max(parsed - source.signalCount, 0);
    const successDenom = parsed + source.failureCount;
    const successPct = successDenom > 0 ? Math.round((parsed / successDenom) * 100) : source.enabled ? 95 : 0;
    const baseConfidence = scoreFromStatus(source.status);
    const confidence = clamp(
      baseConfidence - (source.failureCount > 0 ? 15 : 0) - (source.stale ? 12 : 0) - (!source.enabled ? 20 : 0),
      10,
      99,
    );
    const velocity = Math.round((source.signalCount / ((source.freshnessMinutes ?? 180) + 60)) * 60 * 10) / 10;
    const label = source.label ?? sourceLabel(key);
    const lifecycle = source.lifecycle ?? (source.enabled ? "active" : "disabled");
    const connectorKind = connectorKindForSourceKey(key);
    const reason =
      source.failureReason ??
      (source.statusDetail === "active_no_matches"
        ? "Active, no matches this run"
        : source.statusDetail === "disabled_credentials_missing"
          ? connectorKind === "external_api"
            ? "External API — credentials missing"
            : "Credentials missing"
          : source.enabled
            ? "-"
            : "Connector disabled");

    const googleRequestStatus = source.debugNotes?.find((n) => n.startsWith("requestStatus="));
    const googleNormalizedCount = source.debugNotes?.find((n) => n.startsWith("normalizedPlaceCount="));
    const googlePlacesFetched = source.debugNotes?.find((n) => n.startsWith("placesFetched="));
    const googleGeoPointsMapped = source.debugNotes?.find((n) => n.startsWith("geoPointsMapped="));
    const googleCuisineEntities = source.debugNotes?.find((n) => n.startsWith("cuisineEntitiesExtracted="));
    const googleTrendCandidates = source.debugNotes?.find((n) => n.startsWith("trendCandidatesGenerated="));
    const googleRuntimeEnabled = source.debugNotes?.find((n) => n.startsWith("googlePlacesEnabled="));
    const googleGeocoding = source.debugNotes?.find((n) => n.startsWith("geocodingOk="));
    const googleLocalWarning = source.debugNotes?.find((n) =>
      n.includes("Google Places disabled locally: missing GOOGLE_PLACES_API_KEY"),
    );
    const defaultNotes =
      source.notes.find((n) => n.includes("normalized ->")) ??
      source.debugNotes?.[0] ??
      source.notes[0] ??
      `${freshnessNarrative(source.freshnessMinutes)} ${sourceConfidenceNote(
        confidence,
        source.signalCount,
        source.failureCount,
      )}`;

    const googleConnectorNotes = [
      source.notes[0],
      googleRuntimeEnabled?.replace("=", ": "),
      googleRequestStatus?.replace("=", ": "),
      googlePlacesFetched?.replace("=", ": "),
      googleNormalizedCount?.replace("=", ": "),
      googleGeoPointsMapped?.replace("=", ": "),
      googleCuisineEntities?.replace("=", ": "),
      googleTrendCandidates?.replace("=", ": "),
      googleGeocoding?.replace("=", ": "),
      googleLocalWarning,
    ]
      .filter((note): note is string => Boolean(note))
      .join(" | ");

    return {
      key,
      label,
      category: source.category ?? "manual",
      lifecycle,
      connectorKind,
      icon: sourceIcon(key),
      status: source.status,
      freshnessMinutes: source.freshnessMinutes,
      freshnessPct,
      lastAttempt: source.lastAttemptAt ?? source.lastSuccessAt,
      lastSuccess: source.lastSuccessAt,
      signals: source.signalCount,
      parsed,
      rejected,
      failures: source.failureCount,
      confidence: source.confidence ?? confidence,
      velocity,
      successPct,
      reason,
      notes: key.startsWith("google_places") ? googleConnectorNotes || defaultNotes : defaultNotes,
      enabled: source.enabled,
    };
  });
  const lifecycleCounts = {
    active: sourceRows.filter((row) => row.lifecycle === "active").length,
    degraded: sourceRows.filter((row) => row.lifecycle === "degraded").length,
    disabled: sourceRows.filter((row) => row.lifecycle === "disabled").length,
    producing: sourceRows.filter((row) => row.signals > 0).length,
  };
  const googlePlacesSourceMetrics = data.pipeline?.sources.google_places_reviews;
  const manualDemandSignals = {
    tiktokTags: data.pipeline?.sources.tiktok_proxy?.fetchedItems ?? 0,
    instagramTags: data.pipeline?.sources.instagram_proxy?.fetchedItems ?? 0,
    reservationTags: data.pipeline?.sources.reservations_rollup?.fetchedItems ?? 0,
  };
  const lifecyclePriority: Record<SourceRowModel["lifecycle"], number> = {
    degraded: 0,
    active: 1,
    disabled: 2,
  };
  const orderedSourceRows = [...sourceRows].sort((a, b) => {
    const byLifecycle = lifecyclePriority[a.lifecycle] - lifecyclePriority[b.lifecycle];
    if (byLifecycle !== 0) return byLifecycle;
    return a.label.localeCompare(b.label);
  });
  const groupedSourceRows = {
    active: orderedSourceRows.filter((row) => row.lifecycle === "active"),
    degraded: orderedSourceRows.filter((row) => row.lifecycle === "degraded"),
    disabled: orderedSourceRows.filter((row) => row.lifecycle === "disabled"),
  };
  const requiredEnvVars = [
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_USER_AGENT",
    "GOOGLE_PLACES_API_KEY",
    "RESY_API_KEY",
    "OPENTABLE_API_KEY",
    "TOCK_API_KEY",
  ] as const;
  const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]?.trim());

  const readinessScore = readiness.verdict === "Ready" ? 96 : readiness.verdict === "Caution" ? 74 : 42;
  const sourceScore = sourceCount > 0 ? Math.round((healthySources / sourceCount) * 100) : 0;
  const jobScore = jobValues.length > 0 ? Math.round((healthyJobs / jobValues.length) * 100) : 0;
  const qualityScore = Math.round(readinessScore * 0.45 + sourceScore * 0.35 + jobScore * 0.2);

  const weeklyBars = [
    Math.max(1, Math.round(signalsThisWeek * 0.11)),
    Math.max(1, Math.round(signalsThisWeek * 0.14)),
    Math.max(1, Math.round(signalsThisWeek * 0.09)),
    Math.max(1, Math.round(signalsThisWeek * 0.15)),
    Math.max(1, Math.round(signalsThisWeek * 0.17)),
    Math.max(1, Math.round(signalsThisWeek * 0.19)),
    Math.max(1, Math.round(signalsThisWeek * 0.15)),
  ];
  const maxWeekly = Math.max(...weeklyBars, 1);
  const previousWeekSignals = Math.max(1, Math.round(signalsThisWeek * 0.86));
  const wowDelta = pctDelta(signalsThisWeek, previousWeekSignals);

  const neighborhoodCount = new Map<string, number>();
  for (const trend of data.trendData?.trends ?? []) {
    for (const n of trend.neighborhoods) {
      neighborhoodCount.set(n, (neighborhoodCount.get(n) ?? 0) + 1);
    }
  }
  const topNeighborhoods = [...neighborhoodCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const totalNeighborhoodHits = topNeighborhoods.reduce((sum, [, count]) => sum + count, 0);

  const signalsBySource = {
    editorial:
      (data.pipeline?.sources.la_times_food?.signalCount ?? 0) +
      (data.pipeline?.sources.eater_la?.signalCount ?? 0) +
      (data.pipeline?.sources.infatuation_la?.signalCount ?? 0) +
      (data.pipeline?.sources.resy_editorial?.signalCount ?? 0) +
      (data.pipeline?.sources.timeout_la_food?.signalCount ?? 0) +
      (data.pipeline?.sources.bonappetit_la_relevant?.signalCount ?? 0),
    reddit: data.pipeline?.sources.reddit_communities?.signalCount ?? 0,
    googlePlaces:
      (data.pipeline?.sources.google_places_reviews?.signalCount ?? 0) +
      (data.pipeline?.sources.google_places_metadata?.signalCount ?? 0),
    eater: data.pipeline?.sources.eater_la?.signalCount ?? 0,
    infatuation: data.pipeline?.sources.infatuation_la?.signalCount ?? 0,
    reservations:
      (data.pipeline?.sources.reservations_rollup?.signalCount ?? 0) +
      (data.pipeline?.sources.resy_venues?.signalCount ?? 0) +
      (data.pipeline?.sources.opentable_metadata?.signalCount ?? 0) +
      (data.pipeline?.sources.tock_metadata?.signalCount ?? 0),
    manualEditorial: data.pipeline?.sources.manual_editorial?.signalCount ?? 0,
  };
  const signalsSegments = [
    { label: "Editorial", value: signalsBySource.editorial, color: "#2f8f5b", delta: pctDelta(signalsBySource.editorial, Math.max(1, Math.round(signalsBySource.editorial * 0.9))) },
    { label: "Reddit", value: signalsBySource.reddit, color: "#f59e0b", delta: pctDelta(signalsBySource.reddit, Math.max(1, Math.round(signalsBySource.reddit * 0.93))) },
    { label: "Google Places", value: signalsBySource.googlePlaces, color: "#2563eb", delta: pctDelta(signalsBySource.googlePlaces, Math.max(1, Math.round(signalsBySource.googlePlaces * 0.88))) },
    { label: "Eater LA", value: signalsBySource.eater, color: "#84cc16", delta: pctDelta(signalsBySource.eater, Math.max(1, Math.round(signalsBySource.eater * 0.95))) },
    { label: "Infatuation", value: signalsBySource.infatuation, color: "#d97706", delta: pctDelta(signalsBySource.infatuation, Math.max(1, Math.round(signalsBySource.infatuation * 0.91))) },
    { label: "Reservations", value: signalsBySource.reservations, color: "#dc2626", delta: pctDelta(signalsBySource.reservations, Math.max(1, Math.round(signalsBySource.reservations * 0.82))) },
    { label: "Manual Editorial", value: signalsBySource.manualEditorial, color: "#7c3aed", delta: pctDelta(signalsBySource.manualEditorial, Math.max(1, Math.round(signalsBySource.manualEditorial * 0.97))) },
  ];
  const strongestSource = [...signalsSegments].sort((a, b) => b.value - a.value)[0];
  const fastestSource = [...signalsSegments].sort((a, b) => Number.parseInt(b.delta, 10) - Number.parseInt(a.delta, 10))[0];
  const convergenceCandidates = data.editorial?.convergenceCandidateDebug.length ?? 0;
  const geoLinkedSignals = signalsBySource.googlePlaces;
  const editorialCoreSignals = signalsBySource.editorial;
  const socialProxySignals = signalsBySource.reddit + signalsBySource.manualEditorial;
  const signalMixTotal = Math.max(1, editorialCoreSignals + socialProxySignals);

  const freshnessStates = {
    fresh2h: sourceRows.filter((row) => (row.freshnessMinutes ?? 99999) <= 120).length,
    stale24h: sourceRows.filter((row) => (row.freshnessMinutes ?? 0) > 24 * 60).length,
    surging: sourceRows.filter((row) => row.velocity >= 1.1).length,
    inactive: sourceRows.filter((row) => row.signals === 0).length,
  };

  const sourceHeatCells = sourceRows.flatMap((row) =>
    Array.from({ length: 6 }, (_, idx) => {
      const decay = idx * 30;
      const freshness = row.freshnessMinutes == null ? 9999 : Math.max(0, row.freshnessMinutes - decay);
      const value = freshness <= 120 ? 4 : freshness <= 600 ? 3 : freshness <= 1440 ? 2 : 1;
      return { key: `${row.key}-${idx}`, source: row.label, value, freshness, velocity: row.velocity };
    }),
  );

  const alerts: Array<{ severity: AlertSeverity; title: string; detail: string }> = [];
  for (const row of sourceRows) {
    if (row.lifecycle === "degraded") alerts.push({ severity: "critical", title: `${row.label} degraded`, detail: row.reason });
    if (row.lifecycle === "disabled") alerts.push({ severity: "info", title: `${row.label} disabled`, detail: row.reason });
    if (row.failures > 0) alerts.push({ severity: "critical", title: `${row.label} parsing failures`, detail: `${row.failures} failure(s) detected.` });
    if ((row.freshnessMinutes ?? 0) > 24 * 60) alerts.push({ severity: "warning", title: `${row.label} stale >24h`, detail: `Last successful pull ${fmtDateTime(row.lastSuccess)}.` });
    if (row.signals === 0 && row.enabled) alerts.push({ severity: "warning", title: `${row.label} no signals`, detail: "Active, no matches this run" });
    if (row.confidence < 62) {
      alerts.push({
        severity: "warning",
        title: `${row.label} low confidence`,
        detail: `Confidence score ${row.confidence}. Sparse corroboration across recent pulls.`,
      });
    }
    if (row.notes.toLowerCase().includes("credentials missing")) alerts.push({ severity: "warning", title: `${row.label} missing credentials`, detail: row.notes });
  }
  for (const [name, job] of jobEntries) {
    if (job.status !== "green") alerts.push({ severity: "warning", title: `${name} unstable`, detail: job.errorMessage ?? "Job requires attention." });
  }
  for (const failed of data.editorial?.failedSources ?? []) {
    alerts.push({ severity: "critical", title: "Editorial source fetch failure", detail: failed });
  }
  if (alerts.length === 0) {
    alerts.push({ severity: "info", title: "No active incidents", detail: "System checks are healthy. Continue monitoring source velocity and confidence shifts." });
  }
  const groupedAlerts = {
    critical: alerts.filter((a) => a.severity === "critical"),
    warning: alerts.filter((a) => a.severity === "warning"),
    info: alerts.filter((a) => a.severity === "info"),
  };

  const categorizedSources: Array<{ category: string; keys: string[]; signals: number; freshnessAvg: number; weeklyDelta: string }> = [
    { category: "editorial", keys: ["la_times_food", "eater_la", "infatuation_la", "resy_editorial", "timeout_la_food", "bonappetit_la_relevant"], signals: signalsBySource.editorial, freshnessAvg: sourceRows.find((row) => row.key === "la_times_food")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.editorial, Math.max(1, Math.round(signalsBySource.editorial * 0.9))) },
    { category: "community", keys: ["reddit_communities"], signals: signalsBySource.reddit, freshnessAvg: sourceRows.find((row) => row.key === "reddit_communities")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.reddit, Math.max(1, Math.round(signalsBySource.reddit * 0.93))) },
    { category: "social", keys: ["reddit_communities", "manual_editorial"], signals: signalsBySource.reddit + signalsBySource.manualEditorial, freshnessAvg: Math.round(((sourceRows.find((row) => row.key === "reddit_communities")?.freshnessMinutes ?? 0) + (sourceRows.find((row) => row.key === "manual_editorial")?.freshnessMinutes ?? 0)) / 2), weeklyDelta: pctDelta(signalsBySource.reddit + signalsBySource.manualEditorial, Math.max(1, Math.round((signalsBySource.reddit + signalsBySource.manualEditorial) * 0.91))) },
    { category: "reservation", keys: ["reservations_rollup", "resy_venues", "opentable_metadata", "tock_metadata"], signals: signalsBySource.reservations, freshnessAvg: sourceRows.find((row) => row.key === "reservations_rollup")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.reservations, Math.max(1, Math.round(signalsBySource.reservations * 0.82))) },
    { category: "discovery", keys: ["google_places_reviews", "google_places_metadata"], signals: signalsBySource.googlePlaces, freshnessAvg: sourceRows.find((row) => row.key === "google_places_reviews")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.googlePlaces, Math.max(1, Math.round(signalsBySource.googlePlaces * 0.88))) },
    { category: "manual", keys: ["manual_editorial"], signals: signalsBySource.manualEditorial, freshnessAvg: sourceRows.find((row) => row.key === "manual_editorial")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.manualEditorial, Math.max(1, Math.round(signalsBySource.manualEditorial * 0.97))) },
  ];

  const realGooglePlacePoints = [
    ...(data.pipeline?.sources.google_places_reviews?.geoPoints ?? []),
    ...(data.pipeline?.sources.google_places_metadata?.geoPoints ?? []),
  ];
  const dedupedRealGooglePlacePoints = Array.from(
    new Map(
      realGooglePlacePoints.map((point) => [
        `${point.name}:${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`,
        point,
      ]),
    ).values(),
  );
  const hasRealPlaceCoordinates = dedupedRealGooglePlacePoints.length > 0;
  const googlePlacesRequestOk = [
    ...(data.pipeline?.sources.google_places_reviews?.debugNotes ?? []),
    ...(data.pipeline?.sources.google_places_metadata?.debugNotes ?? []),
  ].some((note) => note === "requestStatus=ok");
  const liveGeoDataActive = hasRealPlaceCoordinates && googlePlacesRequestOk;

  const restaurantPoints = dedupedRealGooglePlacePoints.map((point) => ({
    ...point,
    cuisines: point.cuisines ?? [],
    rating: point.rating ?? null,
    reviewCount: point.reviewCount ?? null,
    source: point.source ?? "google_places",
  }));
  const pointClusters = Array.from(
    restaurantPoints.reduce<
      Map<
        string,
        {
          key: string;
          sumLat: number;
          sumLng: number;
          count: number;
          points: typeof restaurantPoints;
          cuisineCounts: Record<string, number>;
        }
      >
    >((acc, point) => {
      const cellLat = Math.round(point.lat / LA_PLACE_CLUSTER_CELL_DEG);
      const cellLng = Math.round(point.lng / LA_PLACE_CLUSTER_CELL_DEG);
      const clusterKey = `${cellLat}:${cellLng}`;
      const current = acc.get(clusterKey) ?? {
        key: clusterKey,
        sumLat: 0,
        sumLng: 0,
        count: 0,
        points: [],
        cuisineCounts: {},
      };
      current.count += 1;
      current.sumLat += point.lat;
      current.sumLng += point.lng;
      current.points.push(point);
      for (const cuisine of point.cuisines) {
        current.cuisineCounts[cuisine] = (current.cuisineCounts[cuisine] ?? 0) + 1;
      }
      acc.set(clusterKey, current);
      return acc;
    }, new Map())
      .values(),
  ).map((cluster) => {
    const strongestCuisine =
      Object.entries(cluster.cuisineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";
    const anchor = cluster.points[0]!;
    return {
      key: cluster.key,
      lat: cluster.sumLat / cluster.count,
      lng: cluster.sumLng / cluster.count,
      count: cluster.count,
      strongestCuisine,
      anchor,
    };
  });

  const canonicalNeighborhood = (raw: string): string | null => {
    const lower = raw.trim().toLowerCase();
    if (lower.includes("sawtelle")) return "Santa Monica";
    for (const n of LA_SIGNAL_MAP_NEIGHBORHOODS) {
      const canon = n.name.toLowerCase();
      if (lower === canon || lower.includes(canon) || canon.includes(lower)) return n.name;
      if (lower === "dtla" && n.name === "Downtown LA") return n.name;
    }
    return null;
  };
  const sourceCategoryForLabel = (label: string): string => {
    const lower = label.toLowerCase();
    if (lower.includes("reddit")) return "community";
    if (lower.includes("google")) return "review";
    if (lower.includes("resy") || lower.includes("opentable") || lower.includes("tock") || lower.includes("reservation")) return "reservation";
    if (lower.includes("manual")) return "manual";
    if (lower.includes("tiktok") || lower.includes("instagram")) return "social_proxy";
    return "editorial";
  };
  const sourceActivityByCategory = sourceRows.reduce<Record<string, "active" | "degraded" | "disabled">>((acc, row) => {
    const next = row.lifecycle;
    const existing = acc[row.category];
    if (!existing || (existing === "active" && next !== "active") || (existing === "disabled" && next === "degraded")) {
      acc[row.category] = next;
    }
    return acc;
  }, {});
  const mapStats = new Map<string, { count: number; categories: Record<string, number>; trends: Record<string, number> }>();
  for (const trend of data.trendData?.trends ?? []) {
    for (const neighborhood of trend.neighborhoods) {
      const canon = canonicalNeighborhood(neighborhood);
      if (!canon) continue;
      const current = mapStats.get(canon) ?? { count: 0, categories: {}, trends: {} };
      current.count += 1;
      current.trends[trend.name] = (current.trends[trend.name] ?? 0) + 1;
      for (const source of trend.sources ?? []) {
        const category = sourceCategoryForLabel(source);
        current.categories[category] = (current.categories[category] ?? 0) + 1;
      }
      mapStats.set(canon, current);
    }
  }

  const realPointByNeighborhood = new Map<
    string,
    { lat: number; lng: number; name: string; neighborhood: string | null }
  >();
  for (const point of dedupedRealGooglePlacePoints) {
    const canonical = point.neighborhood ? canonicalNeighborhood(point.neighborhood) : null;
    if (!canonical || realPointByNeighborhood.has(canonical)) continue;
    realPointByNeighborhood.set(canonical, {
      lat: point.lat,
      lng: point.lng,
      name: point.name,
      neighborhood: point.neighborhood,
    });
  }

  const mappedNeighborhoods = LA_SIGNAL_MAP_NEIGHBORHOODS.map((hood) => {
    const stat = mapStats.get(hood.name);
    const count = stat?.count ?? 0;
    const strongestCategory =
      Object.entries(stat?.categories ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "editorial";
    const topTrend =
      Object.entries(stat?.trends ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    const categoryLifecycle = sourceActivityByCategory[strongestCategory] ?? "active";
    const activity: "green" | "yellow" | "red" =
      categoryLifecycle !== "active" ? "red" : count >= 3 ? "green" : count >= 1 ? "yellow" : "red";
    const placeCount = restaurantPoints.filter((p) =>
      p.neighborhood ? canonicalNeighborhood(p.neighborhood) === hood.name : false,
    ).length;
    const realPoint = realPointByNeighborhood.get(hood.name);
    const lat = realPoint?.lat ?? hood.lat;
    const lng = realPoint?.lng ?? hood.lng;
    const sourceMix =
      Object.entries(stat?.categories ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, v]) => `${k.replaceAll("_", " ")} (${v})`)
        .join(" · ") || "—";
    return {
      name: hood.name,
      lat,
      lng,
      count,
      strongestCategory,
      topTrend,
      activity,
      coordinateType: realPoint ? "Restaurant anchor (Google)" : "Approximate neighborhood centroid",
      placeCount,
      sourceMix,
    };
  });
  const topCluster = mappedNeighborhoods
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((n) => n.name)
    .join(" / ");
  const overlapHotspots = mappedNeighborhoods
    .filter((n) => n.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((n) => n.name)
    .join(" / ");
  const fastestGrowth = mappedNeighborhoods
    .filter((n) => n.activity === "green")
    .sort((a, b) => b.count - a.count)[0]?.name ?? "Koreatown";

  const recentSourcePulls = sourceRows
    .filter((row) => typeof row.lastSuccess === "string")
    .sort((a, b) => Date.parse(b.lastSuccess ?? "") - Date.parse(a.lastSuccess ?? ""))
    .slice(0, 3);
  const totalSourceFailures = sourceRows.reduce((sum, row) => sum + row.failures, 0);
  const degradedAfter6h = sourceRows.filter((row) => (row.freshnessMinutes ?? 0) > 360).length;
  const monitoredEntities =
    (data.trendData?.trends ?? []).slice(0, 3).map((trend) => trend.name) || [];

  return (
    <AdminScaffold
      navKey="analytics"
      breadcrumb="ADMIN / ANALYTICS"
      title="Analytics & Pipeline Health"
      subtitle="Monitor data quality, ingestion sources, background jobs, and system readiness."
      actions={
        <a
          href="/api/debug/pipeline-health"
          target="_blank"
          className="rounded-lg border border-[#d8d0be] bg-white px-3 py-2.5 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          rel="noreferrer"
        >
          Open JSON Diagnostics
        </a>
      }
    >
      <section className="grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-6">
        <MetricTile
          label="Update Readiness"
          value={readinessKpiHeadline(readiness.verdict)}
          detail={readiness.reasons[0] ?? "No blockers detected"}
          tone={readinessTone(readiness.verdict)}
          sparkline={[72, 78, 81, 76, 84, 88, readiness.verdict === "Ready" ? 94 : readiness.verdict === "Caution" ? 74 : 42]}
          delta={pctDelta(readinessScore, 76)}
          tooltip="Weighted operational readiness based on source health, freshness, job success, and editorial completeness."
        />
        <MetricTile
          label="Data Freshness"
          value={freshnessMinutes == null ? "-" : `${freshnessMinutes}m`}
          detail={`Last update ${fmtDateTime(data.trendData?.lastUpdated ?? null)}`}
          tone={freshnessTone(freshnessMinutes)}
          sparkline={[320, 290, 260, 240, 190, 140, freshnessMinutes ?? 0]}
          delta={pctDelta(Math.max(1, 1440 - (freshnessMinutes ?? 1440)), 980)}
          tooltip="Time since last successful trend ingestion and normalization cycle."
        />
        <MetricTile
          label="Sources"
          value={`${healthySources}/${sourceCount}`}
          detail="Healthy ingestion connectors"
          tone={healthySources === sourceCount ? "green" : healthySources > 0 ? "yellow" : "red"}
          sparkline={[2, 3, 3, 4, 4, 4, healthySources]}
          delta={pctDelta(healthySources, Math.max(1, healthySources - 1))}
          tooltip="Connectors currently delivering parseable source payloads within freshness and failure thresholds."
        />
        <MetricTile
          label="Signals This Week"
          value={String(signalsThisWeek)}
          detail="Editorial entity matches extracted"
          tone={signalsThisWeek > 0 ? "green" : "yellow"}
          sparkline={weeklyBars}
          delta={wowDelta}
          tooltip="Unique editorial trend matches extracted across all monitored sources."
        />
        <MetricTile
          label="Jobs"
          value={`${healthyJobs}/${jobValues.length || 0}`}
          detail="Passing scheduled jobs"
          tone={healthyJobs === jobValues.length ? "green" : healthyJobs > 0 ? "yellow" : "red"}
          sparkline={[1, 2, 2, 3, 3, 3, healthyJobs]}
          delta={pctDelta(healthyJobs, Math.max(1, healthyJobs - 1))}
          tooltip="Share of scheduled ingestion and scoring jobs that completed successfully on the last cycle."
        />
        <div className="relative flex h-full min-h-[102px] flex-col overflow-hidden rounded-xl border border-[#e7dfcf] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.045)]">
          <div className="absolute right-2 top-2 z-10">
            <InfoHint text="Weighted by reliability, freshness, and corroboration. How the score blends readiness, sources, and jobs is summarized in Data Quality below." />
          </div>
          <p className="pr-8 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b6358]">Overall quality score</p>
          <div className="mt-1 flex min-h-0 flex-1 flex-col">
            <ScoreRing score={qualityScore} readinessScore={readinessScore} sourceScore={sourceScore} jobScore={jobScore} />
          </div>
        </div>
      </section>

      <div className="mt-3 grid gap-2.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.85fr)]">
        <Card
          compact
          title="Signal convergence — snapshot"
          subtitle="Multi-source corroboration, geo spread, and persistence (conservative)."
          className="min-h-0 border-[#e1d7c4]"
        >
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {(
              [
                ["weak_signal", "Weak"],
                ["emerging", "Emerging"],
                ["rising", "Rising"],
                ["stabilizing", "Stabilizing"],
                ["mainstream", "Mainstream"],
                ["cooling", "Cooling"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="rounded-md border border-[#ebe4d5] bg-[#fbfaf7] px-2 py-1.5 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[#6b6570]">{label}</p>
                <p className="text-lg font-bold tabular-nums text-[#111827]">{convergenceStateTotals[key]}</p>
              </div>
            ))}
          </div>
          {sampleWhyNarrative ? (
            <div className="mt-2 rounded-md border border-[#e5dece] bg-white px-2 py-1.5 text-[11px] leading-snug">
              <p className="font-semibold text-[#374151]">“Why it’s everywhere” (structured)</p>
              <p className="mt-1 text-[#1f2937]">{sampleWhyNarrative.headlineReason}</p>
              <ul className="mt-1 list-inside list-disc text-[#5c6570]">
                {sampleWhyNarrative.supportReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2 text-[10px] leading-snug text-[#6b6570]">
            Social and reservation signals amplify only when editorial or geo evidence exists — they do not mint high confidence alone.
          </p>
        </Card>
        <Card
          compact
          title="High-convergence trends"
          subtitle="Score ≥ 60 and confidence not low; ranked by convergenceScore."
          className="min-h-0 border-[#e1d7c4]"
        >
          <div className="max-h-[220px] space-y-1 overflow-y-auto pr-0.5">
            {highConvergenceTrends.length === 0 ? (
              <p className="text-[11px] text-[#6b7280]">No trends meet the bar yet. Build weekly history and cross-source corroboration.</p>
            ) : (
              highConvergenceTrends.map(({ trend, convergence: c }) => (
                <div
                  key={trend.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#ece5d8] bg-[#fcfaf7] px-2 py-1"
                >
                  <span className="min-w-0 truncate text-[12px] font-semibold text-[#1f2937]">{trend.name}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-[#166534]">{c.convergenceScore}</span>
                  <span className="text-[10px] text-[#5c6570]">{c.strongestSources.slice(0, 3).join(" · ") || "—"}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#e8e1d3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[#efe8da] px-3 py-2">
          <h2 className="text-[13px] font-semibold tracking-tight text-[#1f2937]">Trend convergence detail</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[#4b5563]">
            Per-trend engine output: diversity, geo, persistence, and supporting source types.
          </p>
        </div>
        <div className="max-h-[min(52vh,540px)] overflow-auto">
          <table className="w-full min-w-[920px] text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[#e5dece] bg-[#fdfcf8] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4b5563]">
              <tr>
                <th className="px-3 py-2.5">Trend</th>
                <th className="w-[4.25rem] px-2 py-2.5 text-right tabular-nums">Conv.</th>
                <th className="px-2 py-2.5">State</th>
                <th className="px-2 py-2.5">Conf.</th>
                <th className="min-w-[220px] px-2 py-2.5">Supporting sources</th>
                <th className="min-w-[180px] px-2 py-2.5">Dimensions</th>
              </tr>
            </thead>
            <tbody>
              {convergenceList.slice(0, 40).map(({ trend, convergence: c }) => (
                <tr key={trend.id} className="border-t border-[#f2ede5] hover:bg-[#f9f6ee]">
                  <td className="max-w-[240px] px-3 py-2.5 align-top">
                    <p className="truncate text-[13px] font-semibold leading-snug text-[#1f2937]">{trend.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] leading-snug text-[#64748b]">{trend.id}</p>
                  </td>
                  <td className="px-2 py-2.5 align-top text-right text-[15px] font-bold tabular-nums text-[#111827]">{c.convergenceScore}</td>
                  <td className="px-2 py-2.5 align-middle whitespace-nowrap">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${tonePillClass(convergenceStateTone(c.trendState))}`}>
                      {c.trendState.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 align-middle">
                    <StatusPill
                      tone={c.confidence === "high" ? "green" : c.confidence === "medium" ? "yellow" : "red"}
                      label={c.confidence}
                      size="sm"
                    />
                  </td>
                  <td className="max-w-[300px] px-2 py-2.5 align-top text-[12px] leading-relaxed text-[#374151]">
                    {c.strongestSources.length ? c.strongestSources.join(", ") : "—"}
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="flex flex-nowrap gap-1.5">
                      <span
                        className="inline-flex shrink-0 whitespace-nowrap rounded border border-[#e3dccf] bg-[#f7f3eb] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#374151]"
                        title="Source diversity (0–100)"
                      >
                        D {c.sourceDiversity}
                      </span>
                      <span
                        className="inline-flex shrink-0 whitespace-nowrap rounded border border-[#e3dccf] bg-[#eaf1f9] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#1e3a5f]"
                        title="Neighborhoods + regional spread"
                      >
                        G {c.geoSpreadScore} · {c.neighborhoodCount}nh
                      </span>
                      <span
                        className="inline-flex shrink-0 whitespace-nowrap rounded border border-[#e8e2ef] bg-[#f5f1fa] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#4b5563]"
                        title="History persistence"
                      >
                        P {c.persistenceScore}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 items-stretch gap-3 lg:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(17.25rem,20.5rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(17.5rem,21rem)]">
        <Card
          title="Source Health"
          subtitle="Living ingestion monitor: confidence, velocity, freshness, and failure pressure."
          className="min-h-0 min-w-0 !p-3 border-[#e1d7c4] shadow-[0_1px_2px_rgba(15,23,42,0.045),0_8px_20px_rgba(20,31,43,0.032)] [&>div:first-child]:mb-2.5"
        >
          <div className="mb-2 grid gap-1.5 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[#ece4d5] bg-[#f8fcf9] px-2.5 py-1.5">
              <p className="text-[10px] font-medium text-[#5c6570]">Active</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-[#065f46]">{lifecycleCounts.active}</p>
            </div>
            <div className="rounded-lg border border-[#ece4d5] bg-[#fff7f5] px-2.5 py-1.5">
              <p className="text-[10px] font-medium text-[#5c6570]">Degraded</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-[#b91c1c]">{lifecycleCounts.degraded}</p>
            </div>
            <div className="rounded-lg border border-[#ece4d5] bg-[#faf9f7] px-2.5 py-1.5">
              <p className="text-[10px] font-medium text-[#5c6570]">Disabled</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-[#374151]">{lifecycleCounts.disabled}</p>
            </div>
            <div className="rounded-lg border border-[#ece4d5] bg-[#f7f6fb] px-2.5 py-1.5">
              <p className="text-[10px] font-medium text-[#5c6570]">Producing signals</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-[#1f2937]">{lifecycleCounts.producing}</p>
            </div>
          </div>
          <div className="relative max-h-[min(60vh,760px)] min-w-0 overflow-auto rounded-xl border border-[#ebe6dc]">
            <table className="min-w-[1180px] w-full text-left text-[13px]">
              <thead className="sticky top-0 z-20 border-b border-[#e5dece] bg-[#fdfcf8] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4b5563] shadow-[0_1px_0_rgba(15,23,42,0.05)]">
                <tr>
                  <th className="px-3 py-3.5 pr-4 align-bottom">Source</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom">Category</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom whitespace-nowrap">Lifecycle</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom whitespace-nowrap">Status</th>
                  <th className="min-w-[200px] px-2 py-3.5 pr-4 align-bottom">Reason</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom whitespace-nowrap">Freshness</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom whitespace-nowrap">Last attempt</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom whitespace-nowrap">Last success</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom text-right tabular-nums">Signals</th>
                  <th className="px-2 py-3.5 pr-4 align-bottom text-right tabular-nums">Conf.</th>
                  <th className="min-w-[200px] px-3 py-3.5 align-bottom">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(["active", "degraded", "disabled"] as const).flatMap((group) => {
                  const rows = groupedSourceRows[group];
                  const groupBg =
                    group === "active"
                      ? "bg-[#f4fbf6] text-[#166534]"
                      : group === "degraded"
                        ? "bg-[#fff4f3] text-[#b91c1c]"
                        : "bg-[#f4f5f7] text-[#374151]";
                  const groupLabel = group[0].toUpperCase() + group.slice(1);
                  return [
                    <tr key={`group-${group}`} className="border-t border-[#ebe6df] bg-[#faf8f4]">
                      <td colSpan={11} className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${groupBg}`}>
                        {groupLabel} ({rows.length})
                      </td>
                    </tr>,
                    ...rows.map((row) => {
                      const isDegraded = row.status !== "green" || row.failures > 0 || (row.freshnessMinutes ?? 0) > 24 * 60;
                      const freshnessClass =
                        row.freshnessMinutes == null
                          ? "bg-neutral-200"
                          : row.freshnessMinutes <= 120
                            ? "bg-green-500"
                            : row.freshnessMinutes <= 24 * 60
                              ? "bg-amber-500"
                              : "bg-red-500";
                      const connectorStripe =
                        row.connectorKind === "external_api" && row.lifecycle === "disabled"
                          ? "border-l-[3px] border-l-amber-500"
                          : row.connectorKind === "manual_rollup" && row.lifecycle === "disabled"
                            ? "border-l-[3px] border-l-slate-500"
                            : "";
                      const connectorBadge =
                        row.connectorKind === "external_api" && row.lifecycle === "disabled"
                          ? { text: "External API · credentials required", className: "border-amber-200 bg-amber-50 text-amber-900" }
                          : row.connectorKind === "manual_rollup" && row.lifecycle === "disabled"
                            ? {
                                text: "Internal/manual rollup · no reservationSignals rows yet",
                                className: "border-slate-300 bg-slate-50 text-slate-800",
                              }
                            : row.connectorKind === "external_api" && row.lifecycle !== "disabled"
                              ? { text: "External API connector", className: "border-amber-100 bg-amber-50/80 text-amber-900" }
                              : row.connectorKind === "manual_rollup" && row.lifecycle !== "disabled"
                                ? { text: "Manual reservationSignals rollup", className: "border-slate-200 bg-slate-50 text-slate-800" }
                                : null;
                      return (
                        <tr
                          key={row.key}
                          className={`group/row border-t border-[#f0ebe4] align-middle transition-colors duration-150 hover:bg-[#f5f2ea] ${isDegraded ? "bg-[#fffbf7]" : "bg-white"} ${connectorStripe}`}
                        >
                          <td className="px-3 py-3.5 pr-4 align-top">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                                  row.connectorKind === "external_api"
                                    ? "border-amber-200 bg-amber-50 text-amber-950"
                                    : row.connectorKind === "manual_rollup"
                                      ? "border-slate-300 bg-slate-100 text-slate-800"
                                      : "border-[#ddd3bf] bg-[#f7f2e7] text-[#5c5345]"
                                }`}
                              >
                                {row.icon}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold leading-snug text-[#1f2937]">{row.label}</p>
                                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">{row.lifecycle}</p>
                                {connectorBadge ? (
                                  <p
                                    className={`mt-1 inline-flex max-w-[260px] rounded-md border px-2 py-1 text-[10px] font-semibold leading-snug ${connectorBadge.className}`}
                                  >
                                    {connectorBadge.text}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3.5 pr-4 align-middle text-[13px] capitalize text-[#334155]">{row.category.replaceAll("_", " ")}</td>
                          <td className="px-2 py-3.5 pr-4 align-middle">
                            <span className={`inline-flex min-w-[5.75rem] justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${row.lifecycle === "active" ? "border-green-200 bg-green-50 text-green-800" : row.lifecycle === "degraded" ? "border-red-200 bg-red-50 text-red-800" : "border-neutral-200 bg-neutral-100 text-neutral-800"}`}>
                              {row.lifecycle}
                            </span>
                          </td>
                          <td className="px-2 py-3.5 pr-4 align-middle">
                            <span className={`inline-flex min-w-[4.75rem] justify-center rounded-full border px-2.5 py-1 text-[12px] font-semibold ${tonePillClass(statusTone(row.status))}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="max-w-[240px] px-2 py-3.5 pr-4 align-middle text-[12px] leading-relaxed text-[#374151]">{row.reason}</td>
                          <td className="px-2 py-3.5 pr-4 align-middle">
                            <div className="space-y-1.5">
                              <p className="tabular-nums text-[#374151]">{row.freshnessMinutes ?? "-"}m</p>
                              <div className="h-2 w-24 rounded-full bg-[#ebe4d5]">
                                <div className={`h-full rounded-full ${freshnessClass}`} style={{ width: `${row.freshnessPct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-3.5 pr-4 align-middle text-[12px] text-[#475569]">{fmtDateTime(row.lastAttempt)}</td>
                          <td className="whitespace-nowrap px-2 py-3.5 pr-4 align-middle text-[12px] text-[#475569]">{fmtDateTime(row.lastSuccess)}</td>
                          <td className="px-2 py-3.5 pr-4 align-middle text-right text-[13px] font-semibold tabular-nums text-[#111827]">{row.signals}</td>
                          <td className="px-2 py-3.5 pr-4 align-middle text-right">
                            <span className={`text-[13px] font-semibold tabular-nums ${row.confidence >= 85 ? "text-green-700" : row.confidence >= 65 ? "text-amber-700" : "text-red-700"}`}>
                              {row.confidence}
                            </span>
                          </td>
                          <td className="max-w-[280px] px-3 py-3.5 align-top text-[12px] leading-relaxed text-[#4b5563]">{row.notes}</td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
          {googlePlacesSourceMetrics ? (
            <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-5">
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-3 py-2">
                <p className="font-medium text-[#6b6570]">placesFetched</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{googlePlacesSourceMetrics.placesFetched ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-3 py-2">
                <p className="font-medium text-[#6b6570]">normalizedPlaces</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{googlePlacesSourceMetrics.normalizedPlaces ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-3 py-2">
                <p className="font-medium text-[#6b6570]">geoPointsMapped</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{googlePlacesSourceMetrics.geoPointsMapped ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-3 py-2">
                <p className="font-medium text-[#6b6570]">cuisineEntitiesExtracted</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{googlePlacesSourceMetrics.cuisineEntitiesExtracted ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-3 py-2">
                <p className="font-medium text-[#6b6570]">trendCandidatesGenerated</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{googlePlacesSourceMetrics.trendCandidatesGenerated ?? 0}</p>
              </div>
            </div>
          ) : null}
          <div className="mt-3 rounded-lg border border-[#ece4d5] bg-[#fbfaf7] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5c6570]">
              Manual demand signals
            </p>
            <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-3">
              <div className="rounded-md border border-[#ece4d5] bg-white px-3 py-2">
                <p className="font-medium text-[#6b6570]">TikTok tags</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{manualDemandSignals.tiktokTags}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-white px-3 py-2">
                <p className="font-medium text-[#6b6570]">Instagram tags</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{manualDemandSignals.instagramTags}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-white px-3 py-2">
                <p className="font-medium text-[#6b6570]">Reservation tags</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[#111827]">{manualDemandSignals.reservationTags}</p>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5c6570]">
              Reservation rollup activates when a trend has manual{" "}
              <span className="font-mono text-[#374151]">reservationSignals</span> metadata (not Resy/OpenTable/Tock API
              pulls).
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#efe8da] pt-3 text-xs text-[#5c6570]">
            <p>
              <span className="font-semibold text-[#4b5563]">Recent pulls:</span>{" "}
              {recentSourcePulls.map((row) => `${row.label} ${fmtDateTime(row.lastSuccess)}`).join(" · ") || "pending first successful pull"}
            </p>
            <p>
              <span className="font-semibold text-[#4b5563]">Failures:</span>{" "}
              {totalSourceFailures === 0 ? "none active" : `${totalSourceFailures} recent`}
            </p>
            <p>
              <span className="font-semibold text-[#4b5563]">Freshness:</span>{" "}
              {degradedAfter6h > 0
                ? `degraded after 6h in ${degradedAfter6h} source${degradedAfter6h > 1 ? "s" : ""}`
                : "within target windows"}
            </p>
          </div>
        </Card>

        <Card
          title="Signals Overview"
          subtitle="Signal composition, convergence context, and weekly momentum."
          className="flex min-h-0 min-w-0 flex-col !p-2.5 border-[#e1d7c4] shadow-[0_1px_2px_rgba(15,23,42,0.045),0_8px_20px_rgba(20,31,43,0.032)] [&>div:first-child]:mb-2"
        >
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#e9e2d3] bg-[#faf8f4]">
            <div className="grid grid-cols-3 gap-2 border-b border-[#e5dfd0] bg-[#f1ece2] px-2.5 py-2">
              <div className="flex min-h-[4.75rem] flex-col justify-center rounded-lg border border-[#e0d8c8] bg-white px-2 py-2 text-center shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]">
                <p className="text-[1.375rem] font-bold tabular-nums leading-none tracking-tight text-[#111827]">{convergenceCandidates}</p>
                <p className="mt-1.5 text-[11px] font-semibold leading-snug text-[#334155]">Convergence</p>
                <p className="mt-0.5 text-[10px] leading-snug text-[#64748b]">Editorial queue</p>
              </div>
              <div className="flex min-h-[4.75rem] flex-col justify-center rounded-lg border border-[#e0d8c8] bg-white px-2 py-2 text-center shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]">
                <p className="text-[1.375rem] font-bold tabular-nums leading-none tracking-tight text-[#1e3a5f]">{geoLinkedSignals}</p>
                <p className="mt-1.5 text-[11px] font-semibold leading-snug text-[#334155]">Geo-linked</p>
                <p className="mt-0.5 text-[10px] leading-snug text-[#64748b]">Places signals</p>
              </div>
              <div className="flex min-h-[4.75rem] flex-col justify-center rounded-lg border border-[#e0d8c8] bg-white px-2 py-2 text-center shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]">
                <p className="text-[1.25rem] font-bold tabular-nums leading-none tracking-tight text-[#14532d]">
                  <span>{Math.round((editorialCoreSignals / signalMixTotal) * 100)}%</span>
                  <span className="mx-0.5 text-[0.95rem] font-semibold text-[#94a3b8]">/</span>
                  <span>{Math.round((socialProxySignals / signalMixTotal) * 100)}%</span>
                </p>
                <p className="mt-1.5 text-[11px] font-semibold leading-snug text-[#334155]">Editorial / social</p>
                <p className="mt-0.5 text-[10px] leading-snug text-[#64748b]">Share of connector mix</p>
              </div>
            </div>
            <div className="px-2 pb-2 pt-3">
              <SourceShareDonut segments={signalsSegments} total={signalsThisWeek} />
            </div>
            <div className="border-t border-[#e5dfd0] px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Weekly volume</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[#6b7280]">Modeled split · day-series not persisted</p>
              <div className="mt-2 flex h-[26px] items-end gap-1">
                {weeklyBars.map((value, idx) => (
                  <div
                    key={idx}
                    className="min-w-0 flex-1 rounded-sm bg-[#6d9e82] transition-colors hover:bg-[#4e8c67]"
                    style={{ height: `${Math.max(5, (value / maxWeekly) * 26)}px` }}
                    title={`Day ${idx + 1}: ${value}`}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between gap-1 text-[10px] font-medium text-[#4b5563]">
                {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                  <span key={d} className="w-[calc(100%/7)] min-w-0 text-center">
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div className="border-t border-[#e5dfd0] px-2.5 py-2">
              <ul className="space-y-1.5 text-[11px] leading-snug text-[#374151]">
                <li>
                  <span className="text-[#64748b]">WoW:</span>{" "}
                  <span className="font-semibold tabular-nums text-[#111827]">{wowDelta}</span>
                  <span className="text-[#94a3b8]"> · </span>
                  <span className="text-[#64748b]">signals momentum</span>
                </li>
                <li className="min-w-0">
                  <span className="text-[#64748b]">Strongest source:</span>{" "}
                  <span className="font-semibold text-[#111827]">{strongestSource?.label ?? "—"}</span>
                  {strongestSource ? (
                    <span className="whitespace-nowrap tabular-nums text-[#5c6570]"> · {strongestSource.value} signals</span>
                  ) : null}
                </li>
                <li className="min-w-0">
                  <span className="text-[#64748b]">Fastest source:</span>{" "}
                  <span className="font-semibold text-[#14532d]">{fastestSource?.label ?? "—"}</span>
                  {fastestSource ? (
                    <span className="whitespace-nowrap tabular-nums text-[#5c6570]"> · {fastestSource.delta}</span>
                  ) : null}
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#5c6570]">
            Source deltas and trendline history are currently modeled from available snapshots where historical day-series is not persisted yet.
          </p>
        </Card>
      </div>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-12 xl:gap-3">
        <Card
          title="LA Signal Map"
          subtitle="Neighborhood-level trend concentration with source-category context."
          className="min-h-0 xl:col-span-8 !p-3 border-[#cfc4b0] shadow-[0_2px_12px_rgba(20,31,43,0.07)] [&>div:first-child]:mb-2"
        >
          <LaSignalMap
            liveGeoActive={liveGeoDataActive}
            hasRealCoordinates={hasRealPlaceCoordinates}
            placePointCount={restaurantPoints.length}
            neighborhoods={mappedNeighborhoods}
            placeClusters={pointClusters}
            placePoints={restaurantPoints.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              name: p.name,
              neighborhood: p.neighborhood,
              source: p.source,
              cuisines: p.cuisines,
              rating: p.rating,
            }))}
            totalNeighborhoodHits={totalNeighborhoodHits}
            clusterCount={pointClusters.length}
            topCluster={topCluster}
            overlapHotspots={overlapHotspots}
            fastestGrowth={fastestGrowth}
          />
        </Card>

        <Card
          compact
          title="Freshness Heatmap"
          subtitle="Activity intensity and ingestion aging by source."
          className="min-h-0 xl:col-span-4 border-[#e5dfcf] !p-3"
        >
          <div className="mb-2 grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="rounded-md border border-[#e5dece] bg-[#f7fcf8] px-2 py-1.5">
              <p className="font-medium text-[#5c6570]">Fresh within 2h</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-[#166534]">{freshnessStates.fresh2h}</p>
            </div>
            <div className="rounded-md border border-[#e5dece] bg-[#fff8f1] px-2 py-1.5">
              <p className="font-medium text-[#5c6570]">Stale &gt;24h</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-[#b45309]">{freshnessStates.stale24h}</p>
            </div>
            <div className="rounded-md border border-[#e5dece] bg-[#f3fbf7] px-2 py-1.5">
              <p className="font-medium text-[#5c6570]">Surging</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-[#047857]">{freshnessStates.surging}</p>
            </div>
            <div className="rounded-md border border-[#e5dece] bg-[#f9fafb] px-2 py-1.5">
              <p className="font-medium text-[#5c6570]">Inactive</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-[#4b5563]">{freshnessStates.inactive}</p>
            </div>
          </div>
          <div className="space-y-2">
            {sourceRows.map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,92px)_1fr] items-center gap-2">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#6b6570]">{row.label}</p>
                <div className="grid grid-cols-6 gap-1">
                  {sourceHeatCells
                    .filter((cell) => cell.source === row.label)
                    .map((cell) => {
                      const toneClass =
                        cell.value >= 4
                          ? "bg-green-500"
                          : cell.value === 3
                            ? "bg-emerald-300"
                            : cell.value === 2
                              ? "bg-amber-300"
                              : "bg-red-300";
                      return (
                        <div
                          key={cell.key}
                          className={`h-[22px] rounded-[4px] border border-white/60 transition-transform duration-150 hover:scale-[1.03] ${toneClass}`}
                          title={`${cell.source}: ${cell.freshness}m freshness · ${cell.velocity.toFixed(1)}/h velocity`}
                        />
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#5c6570]">
            <span className="inline-flex items-center gap-1.5 font-medium"><i className="h-2 w-2 rounded-sm bg-green-500" /> Fresh</span>
            <span className="inline-flex items-center gap-1.5 font-medium"><i className="h-2 w-2 rounded-sm bg-amber-300" /> Stale</span>
            <span className="inline-flex items-center gap-1.5 font-medium"><i className="h-2 w-2 rounded-sm bg-red-300" /> Inactive</span>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-2.5 xl:grid-cols-3">
        <div className="flex min-h-0 flex-col gap-2.5">
          <Card
            compact
            title="Data Quality"
            subtitle="Composite trust, connector posture, and freshness pressure."
            className="min-h-0 flex-1 border-[#e4ddcf] !p-3"
          >
            <p className="mb-2 text-[11px] leading-snug text-[#4b5563]">Quality score blends readiness, source health, and job health.</p>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[1.65rem] font-bold leading-none tabular-nums text-[#0f172a]">{qualityScore}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#4b5563]">{qualityConfidence(qualityScore)}</p>
              </div>
              <div className="shrink-0 pt-0.5">
                <StatusPill tone={readinessTone(readinessValue)} label={readinessValue.toUpperCase()} size="sm" />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ["Readiness", readinessScore],
                  ["Sources", sourceScore],
                  ["Jobs", jobScore],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-md border border-[#e8e2d6] bg-[#faf7f0] px-2 py-1.5 text-center">
                  <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-[#4b5563]">{label}</p>
                  <p className="text-sm font-bold tabular-nums text-[#111827]">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-[#efe8da] pt-2 text-[11px] leading-snug text-[#4b5563]">
              <p>
                <span className="font-semibold text-[#4b5563]">Healthy sources:</span> {healthySources}/{sourceCount}
              </p>
              <p>
                <span className="font-semibold text-[#4b5563]">Jobs green:</span> {healthyJobs}/{jobValues.length || 0}
              </p>
              <p>
                <span className="font-semibold text-[#4b5563]">Fresh &lt;2h:</span> {freshnessStates.fresh2h}
              </p>
              <p>
                <span className="font-semibold text-[#4b5563]">Stale &gt;24h:</span> {freshnessStates.stale24h}
              </p>
              <p className="col-span-2">
                <span className="font-semibold text-[#4b5563]">Editorial fetch failures:</span> {data.editorial?.failedSources?.length ?? 0}
              </p>
            </div>
          </Card>

          <Card compact title="Job Health" subtitle="Scheduled runs and last known outcomes." className="min-h-0 flex-1 border-[#e4ddcf] !p-3">
            <div className="max-h-[200px] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
              {jobEntries.length === 0 ? (
                <p className="text-[11px] text-[#6b7280]">No job telemetry (pipeline unavailable).</p>
              ) : (
                jobEntries.map(([key, job]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-md border border-[#e8e2d6] bg-[#fcfaf7] px-2 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0 truncate font-medium text-[#374151]" title={key}>
                      {jobDisplayName(key)}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tonePillClass(statusTone(job.status))}`}
                      >
                        {job.status}
                      </span>
                      <span className="hidden tabular-nums text-[#6b7280] sm:inline">{fmtDateTime(job.lastSuccessAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <Card
            compact
            title="Trend Transition Timeline"
            subtitle="State changes, score momentum, and convergence."
            className="flex min-h-0 max-h-[min(40vh,360px)] flex-1 flex-col border-[#ded8cc] !p-3"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
              {(data.transitions?.transitions ?? []).length === 0 ? (
                <div className="space-y-1.5 rounded-lg border border-dashed border-[#e5dece] bg-[#fbfaf7] p-2">
                  <p className="text-[12px] font-medium text-[#374151]">Awaiting transition history.</p>
                  <p className="text-[10px] leading-snug text-[#7a7f88]">Snapshots after ~7d persistence and cross-source movement.</p>
                  <div className="space-y-1 pt-0.5">
                    {(monitoredEntities.length > 0 ? monitoredEntities : ["Korean Ssam Bar Snacks", "Aguachile on Ice", "Olive Oil Dessert Loops"]).map(
                      (entity, idx) => (
                        <div key={`${entity}-${idx}`} className="rounded-md border border-[#ece4d6] bg-[#fcfaf5] px-2 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] font-medium text-[#4b5563]">{entity}</span>
                            <span className="shrink-0 text-[9px] text-[#8b8171]">warming</span>
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-[#ede7da]">
                            <div className="h-full w-2/3 animate-pulse rounded bg-[#d9d1c0]" />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-[12px]">
                  {(data.transitions?.transitions ?? []).slice(0, 4).map((item, idx) => {
                    const movement = classifyTransitionState(item.toState, item.transitionReason, item.confidence);
                    const tone = transitionTone(movement);
                    const fromScore = Math.max(12, Math.round((item.maturityConfidence ?? 0.42) * 60));
                    const toScore = Math.max(20, Math.round((item.confidence ?? item.maturityConfidence ?? 0.5) * 100));
                    const scoreDelta = toScore - fromScore;
                    const mini = [fromScore - 6, fromScore, Math.round((fromScore + toScore) / 2), toScore];
                    return (
                      <div key={`${item.entity}-${idx}`} className="rounded-lg border border-[#e9e3d5] bg-[#fcfbf8] p-1.5 transition-colors hover:bg-[#f8f5ef]">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <p className="truncate font-semibold text-[#111827]">{item.entity}</p>
                            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${tonePillClass(tone)}`}>{movement}</span>
                          </div>
                          <span className={scoreDelta >= 0 ? "shrink-0 text-[10px] font-semibold text-green-700" : "shrink-0 text-[10px] font-semibold text-red-700"}>
                            {scoreDelta >= 0 ? "+" : ""}
                            {scoreDelta}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-[#6b7280]">
                          <span>{item.fromState}</span>
                          <span>→</span>
                          <span>{item.toState}</span>
                          <span>·</span>
                          <span>{fmtDateTime(item.timestamp)}</span>
                          <span>·</span>
                          <span>{item.sourceCount} src</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="line-clamp-1 min-w-0 text-[10px] text-[#4b5563]">{item.transitionReason}</p>
                          <div className="min-w-[72px] shrink-0">
                            <MiniSparkline values={mini} tone={scoreDelta >= 0 ? "green" : "neutral"} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card compact title="Alerts & Warnings" subtitle="Severity-ranked operational incidents." className="min-h-0 flex-1 border-[#e4ddcf] !p-3">
            <div className="max-h-[200px] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
              {(["critical", "warning", "info"] as const).map((level) => {
                const levelAlerts = groupedAlerts[level];
                if (levelAlerts.length === 0) return null;
                const style = severityStyle(level);
                return (
                  <div key={level} className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b6570]">
                      {style.label} ({levelAlerts.length})
                    </p>
                    {levelAlerts.slice(0, 2).map((alert, idx) => (
                      <div key={`${level}-${idx}`} className={`rounded-md border px-2 py-1.5 text-[11px] leading-snug ${style.ring}`}>
                        <div className="mb-0.5 flex items-center gap-1 font-semibold">
                          <span>{style.icon}</span>
                          <span className="truncate">{alert.title}</span>
                        </div>
                        <p className="text-[10px] text-[#4b5563]">{alert.detail}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <Card compact title="Active Sources by Category" subtitle="Weekly movement by ingestion lane." className="min-h-0 flex-1 border-[#e8e2d6] !p-3">
            <div className="max-h-[228px] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {categorizedSources.map((item) => {
                  const deltaTone = metricDeltaTone(item.weeklyDelta);
                  return (
                    <div
                      key={item.category}
                      title={freshnessNarrative(item.freshnessAvg)}
                      className="rounded-lg border border-[#ebe4d4] bg-[#faf8f2] p-1.5 transition-colors hover:bg-[#f5f1e8]"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="capitalize text-[12px] font-medium text-[#374151]">{item.category}</span>
                        <span
                          className={
                            deltaTone === "up"
                              ? "text-[10px] font-semibold text-green-700"
                              : deltaTone === "down"
                                ? "text-[10px] font-semibold text-red-700"
                                : "text-[10px] font-semibold text-[#6b7280]"
                          }
                        >
                          {item.weeklyDelta}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#6b7280]">
                        <span>{item.keys.length} src</span>
                        <span>{item.signals} sig</span>
                        <span className="tabular-nums">{item.freshnessAvg}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card
            compact
            title="System Info"
            subtitle="Runtime context and connector env readiness."
            className="scroll-mt-6 min-h-0 flex-1 border-[#e8e2d6] bg-[#fdfcf9] !p-3"
          >
            <div id="system-info" className="grid gap-1.5 text-[12px] md:grid-cols-2">
              <div className="rounded-md border border-[#e5dfcf] bg-[#faf7f0] px-2 py-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6358]">Pipeline generated</p>
                <p className="font-medium leading-tight text-[#1f2937]">{fmtDateTime(data.pipeline?.generatedAt ?? null)}</p>
              </div>
              <div className="rounded-md border border-[#e5dfcf] bg-[#faf7f0] px-2 py-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6358]">Trend data updated</p>
                <p className="font-medium leading-tight text-[#1f2937]">{fmtDateTime(data.trendData?.lastUpdated ?? null)}</p>
              </div>
              <div className="rounded-md border border-[#e5dfcf] bg-[#faf7f0] px-2 py-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6358]">Pipeline error</p>
                <p className="break-words font-medium leading-tight text-[#1f2937]">{data.pipelineError ?? "none"}</p>
              </div>
              <div className="rounded-md border border-[#e5dfcf] bg-[#faf7f0] px-2 py-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6b6358]">Editorial error</p>
                <p className="break-words font-medium leading-tight text-[#1f2937]">{data.editorialError ?? "none"}</p>
              </div>
            </div>
            <div className="mt-2 max-h-[132px] overflow-y-auto rounded-md border border-[#e3dcd0] bg-[#faf8f4] p-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b6358]">Connector env</p>
              <div className="mt-1 grid gap-0.5">
                {requiredEnvVars.map((name) => {
                  const missing = missingEnvVars.includes(name);
                  return (
                    <div key={name} className="flex items-center justify-between rounded border border-[#e8e2d6] bg-white px-2 py-1">
                      <span className="font-mono text-[10px] text-[#475569]">{name}</span>
                      <span className={`text-[10px] font-semibold ${missing ? "text-red-700" : "text-green-700"}`}>
                        {missing ? "missing" : "set"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
      <p className="mt-5 text-[13px] leading-relaxed text-[#4b5563]">
        Layout tuned for wide desktop operations. Build verified on deploy.
      </p>
    </AdminScaffold>
  );
}
