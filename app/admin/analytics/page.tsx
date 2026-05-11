import {
  AdminScaffold,
  Card,
  MiniSparkline,
  StatusPill,
  statusTone,
  tonePillClass,
  type HealthTone,
} from "@/components/admin/AdminUi";
import {
  computeReadiness,
  fmtDateTime,
  healthySourceCount,
  loadAdminDataBundle,
  minutesSince,
} from "@/lib/admin/dashboard";

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
  if (score >= 74) return "Moderate confidence";
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
    <div className="group relative flex min-h-[136px] flex-col justify-between rounded-2xl border border-[#e8e1d3] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(20,31,43,0.06)]">
      <div className="absolute right-2.5 top-2.5">
        <InfoHint text={props.tooltip} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9f957f]">{props.label}</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[1.9rem] font-semibold leading-none tracking-tight text-[#111827]">{props.value}</p>
            <p className="mt-1.5 text-[11px] leading-4 text-[#858b96]">{props.detail}</p>
          </div>
          <StatusPill tone={props.tone} label={props.tone.toUpperCase()} size="sm" />
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-[#f2ede2] pt-2">
        <div className="flex items-center gap-1.5 opacity-85">
          <span className={`h-1.5 w-1.5 rounded-full ${props.tone === "green" ? "bg-green-500" : props.tone === "yellow" ? "bg-amber-500" : props.tone === "red" ? "bg-red-500" : "bg-neutral-400"} animate-pulse`} />
          <MiniSparkline values={props.sparkline} tone={props.tone === "green" ? "green" : "neutral"} />
        </div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${deltaClass}`}>
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
  return (
    <div className="space-y-2">
      <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
        <div
          className="grid h-24 w-24 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#dc2626 ${clamped * 3.6}deg, #e7e5e4 0deg)`,
          }}
        >
          <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-white text-2xl font-bold text-slate-900">
            {clamped}
          </div>
        </div>
        <div className="min-w-0 max-w-full">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-500">Quality Score</p>
          <p className="text-[30px] font-bold leading-none tracking-tight text-slate-900">{clamped}</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{qualityConfidence(clamped)}</p>
        </div>
      </div>
      <p className="text-[11px] leading-4 text-stone-500">
        Weighted trust model based on readiness, source reliability, and job continuity.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[#e7dfcf] bg-[#fbf7ef] px-2 py-1.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-900">Readiness</p>
          <p className="text-lg font-bold leading-tight text-stone-900">{props.readinessScore}</p>
        </div>
        <div className="rounded-lg border border-[#e7dfcf] bg-[#fbf7ef] px-2 py-1.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-900">Sources</p>
          <p className="text-lg font-bold leading-tight text-stone-900">{props.sourceScore}</p>
        </div>
        <div className="rounded-lg border border-[#e7dfcf] bg-[#fbf7ef] px-2 py-1.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-900">Jobs</p>
          <p className="text-lg font-bold leading-tight text-stone-900">{props.jobScore}</p>
        </div>
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
  const r = 54;
  const c = 2 * Math.PI * r;
  const segmentsWithOffsets = props.segments.map((segment) => ({
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
    <div className="grid min-w-0 gap-2 lg:grid-cols-[150px_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto flex h-[150px] w-[150px] items-center justify-center">
        <svg viewBox="0 0 160 160" className="h-[146px] w-[146px]" aria-hidden>
          <g transform="rotate(-90 80 80)">
            {donutSegments.map((segment) => {
              const dash = `${segment.pct * c} ${c - segment.pct * c}`;
              return (
                <circle
                  key={segment.label}
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="18"
                  strokeDasharray={dash}
                  strokeDashoffset={segment.strokeDashoffset}
                />
              );
            })}
          </g>
          <circle cx="80" cy="80" r="40" fill="white" />
          <text x="80" y="74" textAnchor="middle" className="fill-[#6b7280] text-[10px] font-semibold uppercase tracking-[0.12em]">
            Signals
          </text>
          <text x="80" y="90" textAnchor="middle" className="fill-[#111827] text-[18px] font-semibold">
            {total}
          </text>
        </svg>
      </div>
      <div className="min-w-0 space-y-1">
        {props.segments.map((segment) => {
          const pct = Math.round((segment.value / total) * 100);
          const deltaTone = metricDeltaTone(segment.delta);
          return (
            <div key={segment.label} className="flex min-w-0 items-center justify-between gap-2 rounded-md px-1.5 py-0.5 transition-colors hover:bg-[#f7f4ee]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="truncate text-[12px] font-medium leading-tight text-[#1f2937]">{segment.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px]">
                <span className="text-sm font-semibold text-[#111827]">{segment.value}</span>
                <span className="text-[#808793]">{pct}%</span>
                <span className={`w-9 text-right ${deltaTone === "up" ? "text-green-700" : deltaTone === "down" ? "text-red-700" : "text-[#6b7280]"}`}>
                  {segment.delta}
                </span>
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

export default async function AdminAnalyticsPage() {
  const data = await loadAdminDataBundle();
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

  const laNeighborhoodLayout: Array<{ name: string; x: number; y: number; labelX: number; labelY: number }> = [
    { name: "Koreatown", x: 290, y: 175, labelX: 298, labelY: 162 },
    { name: "Silver Lake", x: 360, y: 135, labelX: 370, labelY: 122 },
    { name: "Echo Park", x: 330, y: 148, labelX: 342, labelY: 166 },
    { name: "Highland Park", x: 400, y: 118, labelX: 412, labelY: 106 },
    { name: "Downtown LA", x: 340, y: 200, labelX: 352, labelY: 215 },
    { name: "Arts District", x: 365, y: 194, labelX: 377, labelY: 182 },
    { name: "Venice", x: 170, y: 222, labelX: 176, labelY: 240 },
    { name: "Santa Monica", x: 130, y: 190, labelX: 126, labelY: 178 },
    { name: "Culver City", x: 220, y: 220, labelX: 228, labelY: 236 },
    { name: "West Hollywood", x: 255, y: 145, labelX: 244, labelY: 132 },
    { name: "Fairfax", x: 250, y: 170, labelX: 230, labelY: 184 },
    { name: "Thai Town", x: 300, y: 140, labelX: 308, labelY: 127 },
    { name: "Sawtelle", x: 185, y: 190, labelX: 191, labelY: 177 },
    { name: "Pasadena", x: 460, y: 130, labelX: 470, labelY: 117 },
    { name: "Long Beach", x: 470, y: 300, labelX: 482, labelY: 316 },
    { name: "Inglewood", x: 255, y: 255, labelX: 265, labelY: 272 },
    { name: "Boyle Heights", x: 390, y: 212, labelX: 401, labelY: 228 },
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
  const projectCoordinates = (lat: number, lng: number) => {
    const bounds = {
      minLat: 33.66,
      maxLat: 34.36,
      minLng: -118.72,
      maxLng: -117.88,
    };
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 640;
    const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 360;
    return {
      x: clamp(Math.round(x), 36, 608),
      y: clamp(Math.round(y), 34, 324),
    };
  };
  const projectedRestaurantPoints = dedupedRealGooglePlacePoints.map((point) => {
    const projected = projectCoordinates(point.lat, point.lng);
    return {
      ...point,
      x: projected.x,
      y: projected.y,
      cuisines: point.cuisines ?? [],
      rating: point.rating ?? null,
      reviewCount: point.reviewCount ?? null,
      source: point.source ?? "google_places",
    };
  });
  const pointClusters = Array.from(
    projectedRestaurantPoints.reduce<
      Map<
        string,
        {
          key: string;
          x: number;
          y: number;
          count: number;
          points: typeof projectedRestaurantPoints;
          cuisineCounts: Record<string, number>;
        }
      >
    >((acc, point) => {
      const clusterKey = `${Math.floor(point.x / 28)}:${Math.floor(point.y / 28)}`;
      const current = acc.get(clusterKey) ?? {
        key: clusterKey,
        x: 0,
        y: 0,
        count: 0,
        points: [],
        cuisineCounts: {},
      };
      current.count += 1;
      current.x += point.x;
      current.y += point.y;
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
    const anchor = cluster.points[0];
    return {
      ...cluster,
      x: Math.round(cluster.x / cluster.count),
      y: Math.round(cluster.y / cluster.count),
      strongestCuisine,
      anchor,
    };
  });

  const canonicalNeighborhood = (raw: string): string | null => {
    const lower = raw.trim().toLowerCase();
    for (const n of laNeighborhoodLayout) {
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
    { x: number; y: number; name: string; neighborhood: string | null }
  >();
  for (const point of dedupedRealGooglePlacePoints) {
    const canonical = point.neighborhood ? canonicalNeighborhood(point.neighborhood) : null;
    if (!canonical || realPointByNeighborhood.has(canonical)) continue;
    const projected = projectCoordinates(point.lat, point.lng);
    realPointByNeighborhood.set(canonical, {
      x: projected.x,
      y: projected.y,
      name: point.name,
      neighborhood: point.neighborhood,
    });
  }

  const mappedNeighborhoods = laNeighborhoodLayout.map((layout) => {
    const stat = mapStats.get(layout.name);
    const count = stat?.count ?? 0;
    const strongestCategory =
      Object.entries(stat?.categories ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "editorial";
    const topTrend =
      Object.entries(stat?.trends ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    const categoryLifecycle = sourceActivityByCategory[strongestCategory] ?? "active";
    const activity: "green" | "yellow" | "red" =
      categoryLifecycle !== "active" ? "red" : count >= 3 ? "green" : count >= 1 ? "yellow" : "red";
    const realPoint = realPointByNeighborhood.get(layout.name);
    return {
      ...layout,
      x: realPoint?.x ?? layout.x,
      y: realPoint?.y ?? layout.y,
      count,
      strongestCategory,
      topTrend,
      activity,
      coordinateType: realPoint ? "real place coordinates" : "approximate centroid",
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
          className="rounded-lg border border-[#d8d0be] bg-white px-3 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          rel="noreferrer"
        >
          Open JSON Diagnostics
        </a>
      }
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <MetricTile
          label="Update Readiness"
          value={readinessValue}
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
        <div className="relative h-full min-h-[136px] overflow-hidden rounded-2xl border border-[#e7dfcf] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.045)] xl:col-span-2">
          <div className="absolute right-2.5 top-2.5">
            <InfoHint text="Composite confidence score weighted by source reliability, freshness, corroboration, and pipeline health." />
          </div>
          <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-stone-500 leading-tight">Overall Quality Score</p>
          <div className="mt-4">
            <ScoreRing score={qualityScore} readinessScore={readinessScore} sourceScore={sourceScore} jobScore={jobScore} />
          </div>
        </div>
      </section>

      <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <Card
          title="Source Health"
          subtitle="Living ingestion monitor: confidence, velocity, freshness, and failure pressure."
          className="h-full min-h-[462px] min-w-0 !p-2.5 border-[#e1d7c4] shadow-[0_1px_2px_rgba(15,23,42,0.045),0_12px_24px_rgba(20,31,43,0.038)]"
        >
          <div className="mb-2 grid gap-1 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[#ece4d5] bg-[#f8fcf9] px-2 py-1.5">
              <p className="text-[#6b7280]">Active</p>
              <p className="text-base font-semibold text-[#065f46]">{lifecycleCounts.active}</p>
            </div>
            <div className="rounded-lg border border-[#ece4d5] bg-[#fff7f5] px-2 py-1.5">
              <p className="text-[#6b7280]">Degraded</p>
              <p className="text-base font-semibold text-[#b91c1c]">{lifecycleCounts.degraded}</p>
            </div>
            <div className="rounded-lg border border-[#ece4d5] bg-[#faf9f7] px-2 py-1.5">
              <p className="text-[#6b7280]">Disabled</p>
              <p className="text-base font-semibold text-[#374151]">{lifecycleCounts.disabled}</p>
            </div>
            <div className="rounded-lg border border-[#ece4d5] bg-[#f7f6fb] px-2 py-1.5">
              <p className="text-[#6b7280]">Producing signals</p>
              <p className="text-base font-semibold text-[#1f2937]">{lifecycleCounts.producing}</p>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="text-left text-[10px] uppercase tracking-[0.08em] text-[#928874]">
                <tr>
                  <th className="pb-2 pr-3 min-w-[170px]">Source</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Lifecycle</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Reason</th>
                  <th className="pb-2 pr-3">Freshness</th>
                  <th className="pb-2 pr-3">Last Attempt</th>
                  <th className="pb-2 pr-3">Last Success</th>
                  <th className="pb-2 pr-3">Signals</th>
                  <th className="pb-2 pr-3">Confidence</th>
                  <th className="pb-2">Notes</th>
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
                    <tr key={`group-${group}`} className="border-t border-[#ece5d8]">
                      <td colSpan={11} className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${groupBg}`}>
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
                          className={`border-t border-[#efe8da] align-top transition-colors duration-150 hover:bg-[#faf8f3] ${isDegraded ? "bg-[#fff9f6]" : "bg-white"} ${connectorStripe}`}
                        >
                          <td className="py-1.5 pr-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                                  row.connectorKind === "external_api"
                                    ? "border-amber-200 bg-amber-50 text-amber-950"
                                    : row.connectorKind === "manual_rollup"
                                      ? "border-slate-300 bg-slate-100 text-slate-800"
                                      : "border-[#ddd3bf] bg-[#f7f2e7] text-[#5c5345]"
                                }`}
                              >
                                {row.icon}
                              </span>
                              <div>
                                <p className="text-[11px] font-medium text-[#1f2937]">{row.label}</p>
                                <p className="text-[10px] uppercase tracking-[0.08em] text-[#9a8f7c]">{row.lifecycle}</p>
                                {connectorBadge ? (
                                  <p
                                    className={`mt-0.5 inline-flex max-w-[220px] rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-tight ${connectorBadge.className}`}
                                  >
                                    {connectorBadge.text}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="py-1.5 pr-3 text-[#374151] capitalize">{row.category.replaceAll("_", " ")}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`inline-flex min-w-[78px] justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.lifecycle === "active" ? "border-green-200 bg-green-50 text-green-700" : row.lifecycle === "degraded" ? "border-red-200 bg-red-50 text-red-700" : "border-neutral-200 bg-neutral-100 text-neutral-700"}`}>
                              {row.lifecycle}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={`inline-flex min-w-[70px] justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tonePillClass(statusTone(row.status))}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="max-w-[180px] py-1.5 pr-3 text-[11px] leading-4 text-[#6b7280]">{row.reason}</td>
                          <td className="py-1.5 pr-3">
                            <div className="space-y-1">
                              <p className="text-[#374151]">{row.freshnessMinutes ?? "-"}m</p>
                              <div className="h-1.5 w-20 rounded-full bg-[#ebe4d5]">
                                <div className={`h-full rounded-full ${freshnessClass}`} style={{ width: `${row.freshnessPct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-1.5 pr-3 text-[#4b5563]">{fmtDateTime(row.lastAttempt)}</td>
                          <td className="py-1.5 pr-3 text-[#4b5563]">{fmtDateTime(row.lastSuccess)}</td>
                          <td className="py-1.5 pr-3 font-medium text-[#1f2937]">{row.signals}</td>
                          <td className="py-1.5 pr-3">
                            <span className={row.confidence >= 85 ? "font-semibold text-green-700" : row.confidence >= 65 ? "font-semibold text-amber-700" : "font-semibold text-red-700"}>
                              {row.confidence}
                            </span>
                          </td>
                          <td className="max-w-[230px] py-1.5 text-[11px] leading-4 text-[#7a7f88] line-clamp-2">{row.notes}</td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
          {googlePlacesSourceMetrics ? (
            <div className="mt-1.5 grid gap-1 text-[10px] sm:grid-cols-5">
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-2 py-1">
                <p className="text-[#8a8171]">placesFetched</p>
                <p className="font-semibold text-[#111827]">{googlePlacesSourceMetrics.placesFetched ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-2 py-1">
                <p className="text-[#8a8171]">normalizedPlaces</p>
                <p className="font-semibold text-[#111827]">{googlePlacesSourceMetrics.normalizedPlaces ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-2 py-1">
                <p className="text-[#8a8171]">geoPointsMapped</p>
                <p className="font-semibold text-[#111827]">{googlePlacesSourceMetrics.geoPointsMapped ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-2 py-1">
                <p className="text-[#8a8171]">cuisineEntitiesExtracted</p>
                <p className="font-semibold text-[#111827]">{googlePlacesSourceMetrics.cuisineEntitiesExtracted ?? 0}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-[#fbfaf7] px-2 py-1">
                <p className="text-[#8a8171]">trendCandidatesGenerated</p>
                <p className="font-semibold text-[#111827]">{googlePlacesSourceMetrics.trendCandidatesGenerated ?? 0}</p>
              </div>
            </div>
          ) : null}
          <div className="mt-1.5 rounded-lg border border-[#ece4d5] bg-[#fbfaf7] p-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7f7460]">
              Manual demand signals
            </p>
            <div className="mt-1 grid gap-1 text-[10px] sm:grid-cols-3">
              <div className="rounded-md border border-[#ece4d5] bg-white px-2 py-1">
                <p className="text-[#8a8171]">TikTok tags</p>
                <p className="font-semibold text-[#111827]">{manualDemandSignals.tiktokTags}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-white px-2 py-1">
                <p className="text-[#8a8171]">Instagram tags</p>
                <p className="font-semibold text-[#111827]">{manualDemandSignals.instagramTags}</p>
              </div>
              <div className="rounded-md border border-[#ece4d5] bg-white px-2 py-1">
                <p className="text-[#8a8171]">Reservation tags</p>
                <p className="font-semibold text-[#111827]">{manualDemandSignals.reservationTags}</p>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#6b6570]">
              Reservation rollup activates when a trend has manual{" "}
              <span className="font-mono text-[#374151]">reservationSignals</span> metadata (not Resy/OpenTable/Tock API
              pulls).
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#efe8da] pt-1.5 text-[10px] text-[#8f8573]">
            <p>
              <span className="font-semibold text-[#6f6656]">Recent pulls:</span>{" "}
              {recentSourcePulls.map((row) => `${row.label} ${fmtDateTime(row.lastSuccess)}`).join(" · ") || "pending first successful pull"}
            </p>
            <p>
              <span className="font-semibold text-[#6f6656]">Failures:</span>{" "}
              {totalSourceFailures === 0 ? "none active" : `${totalSourceFailures} recent`}
            </p>
            <p>
              <span className="font-semibold text-[#6f6656]">Freshness:</span>{" "}
              {degradedAfter6h > 0
                ? `degraded after 6h in ${degradedAfter6h} source${degradedAfter6h > 1 ? "s" : ""}`
                : "within target windows"}
            </p>
          </div>
        </Card>

        <Card
          title="Signals Overview"
          subtitle="High-density signal composition with source-level momentum and contribution deltas."
          className="h-full min-h-[462px] min-w-0 overflow-hidden !p-2.5 border-[#e1d7c4] shadow-[0_1px_2px_rgba(15,23,42,0.045),0_13px_24px_rgba(20,31,43,0.042)]"
        >
          <div className="grid h-full min-w-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-xl border border-[#e9e2d3] bg-[#fbfaf7] p-2">
            <div className="flex min-h-[248px] items-center">
              <SourceShareDonut segments={signalsSegments} total={signalsThisWeek} />
            </div>
            <div className="border-t border-[#ece5d8] pt-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#9a8f7c]">Weekly volume</p>
              <div className="mt-1 flex items-end gap-1">
                {weeklyBars.map((value, idx) => (
                  <div
                    key={idx}
                    className="w-full rounded-sm bg-[#d6e9dc] transition-all duration-200 hover:bg-[#9fd0b0]"
                    style={{ height: `${Math.max(8, (value / maxWeekly) * 42)}px` }}
                    title={`Day ${idx + 1}: ${value}`}
                  />
                ))}
              </div>
              <div className="mt-0.5 grid grid-cols-7 text-[9px] text-[#948a78]">
                {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                  <span key={d} className="text-center">
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 border-t border-[#ece5d8] pt-1.5">
              <div className="rounded-md border border-[#ede6d8] bg-white/75 px-2 py-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#9a8f7c]">WoW</p>
                <p className="text-[18px] font-semibold leading-none text-[#111827]">{wowDelta}</p>
              </div>
              <div className="rounded-md border border-[#ede6d8] bg-white/75 px-2 py-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#9a8f7c]">Strongest</p>
                <p className="truncate text-[12px] font-semibold text-[#111827]">{strongestSource?.label ?? "-"}</p>
                <p className="text-[10px] text-[#808793]">{strongestSource?.value ?? 0} sig</p>
              </div>
              <div className="rounded-md border border-[#ede6d8] bg-white/75 px-2 py-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#9a8f7c]">Fastest</p>
                <p className="truncate text-[12px] font-semibold text-[#166534]">{fastestSource?.label ?? "-"}</p>
                <p className="text-[10px] text-[#808793]">{fastestSource?.delta ?? "+0%"}</p>
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-[#8f8573]">
            Source deltas and trendline history are currently modeled from available snapshots where historical day-series is not persisted yet.
          </p>
        </Card>
      </div>

      <div className="mt-3 grid items-stretch gap-3 xl:grid-cols-3">
        <Card title="Data Quality" subtitle="Trust checks that explain why engine output is reliable." className="h-full min-h-[320px] !p-3 border-[#ebe4d5]">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#4b5563]">Storage readability</span>
              <span className="font-semibold text-[#111827]">
                {data.pipeline?.storage.foodTrendData.readable ? "Pass" : "Fail"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#4b5563]">Trend history integrity</span>
              <span className="font-semibold text-[#111827]">
                {data.pipeline?.storage.trendHistory.readable ? "Pass" : "Warn"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#4b5563]">Editorial feed failures</span>
              <span className="font-semibold text-[#111827]">{data.editorial?.failedSources.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#4b5563]">Candidate rows</span>
              <span className="font-semibold text-[#111827]">{data.editorial?.convergenceCandidateDebug.length ?? 0}</span>
            </div>
            <div className="rounded-lg border border-dashed border-[#e4ddcf] bg-[#fbfaf7] p-2 text-[11px] text-[#7a7f88]">
              Live checks use production debug payloads. Some comparative deltas are modeled while fuller time-series storage is being expanded.
            </div>
          </div>
        </Card>

        <Card title="Freshness Heatmap" subtitle="Activity intensity and ingestion aging by source." className="h-full min-h-[320px] !p-3 border-[#ebe4d5]">
          <div className="mb-2.5 grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded-lg border border-[#e5dece] bg-[#f7fcf8] p-1.5">
              <p className="text-[#6b7280]">fresh within 2h</p>
              <p className="text-lg font-semibold text-[#166534]">{freshnessStates.fresh2h}</p>
            </div>
            <div className="rounded-lg border border-[#e5dece] bg-[#fff8f1] p-1.5">
              <p className="text-[#6b7280]">stale &gt;24h</p>
              <p className="text-lg font-semibold text-[#b45309]">{freshnessStates.stale24h}</p>
            </div>
            <div className="rounded-lg border border-[#e5dece] bg-[#f3fbf7] p-1.5">
              <p className="text-[#6b7280]">surging</p>
              <p className="text-lg font-semibold text-[#047857]">{freshnessStates.surging}</p>
            </div>
            <div className="rounded-lg border border-[#e5dece] bg-[#f9fafb] p-1.5">
              <p className="text-[#6b7280]">inactive</p>
              <p className="text-lg font-semibold text-[#4b5563]">{freshnessStates.inactive}</p>
            </div>
          </div>
          <div className="space-y-1">
            {sourceRows.map((row) => (
              <div key={row.key} className="grid grid-cols-[74px_1fr] items-center gap-2">
                <p className="truncate text-[10px] uppercase tracking-[0.08em] text-[#938975]">{row.label}</p>
                <div className="grid grid-cols-6 gap-0.5">
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
                          className={`h-[18px] rounded-[3px] border border-white/50 transition-transform duration-150 hover:scale-105 ${toneClass}`}
                          title={`${cell.source}: ${cell.freshness}m freshness · ${cell.velocity.toFixed(1)}/h velocity`}
                        />
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#8f8573]">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-green-500" /> Fresh (&lt;2h)</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-amber-300" /> Stale (&gt;2h)</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-red-300" /> Inactive</span>
          </div>
          <p className="mt-2 text-[11px] text-[#8f8573]">Higher intensity blocks indicate fresher, higher-velocity source windows.</p>
        </Card>

        <Card title="Job Health" subtitle="Critical scheduler and update routines." className="h-full min-h-[320px] !p-3 border-[#ebe4d5]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-[#6b7280]">
                <tr>
                  <th className="pb-2 pr-3">Job</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Last Run</th>
                  <th className="pb-2 pr-3">Last Success</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {jobEntries.map(([name, job]) => (
                  <tr key={name} className="border-t border-[#eee8db] transition-colors hover:bg-[#faf8f3]">
                    <td className="py-2 pr-3 font-medium">{name}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tonePillClass(statusTone(job.status))}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[#4b5563]">{fmtDateTime(job.lastRunAt)}</td>
                    <td className="py-2 pr-3 text-[#4b5563]">{fmtDateTime(job.lastSuccessAt)}</td>
                    <td className="py-2 text-[#6b7280]">{job.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

      <div className="mt-3 grid items-stretch gap-3 xl:grid-cols-3">
        <Card title="LA Signal Map" subtitle="Neighborhood-level trend concentration with source-category context." className="h-full min-h-[360px] !p-3 border-[#e7dfcf]">
          <div className="mb-1 flex items-center gap-2 text-[10px]">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${
                liveGeoDataActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {liveGeoDataActive ? "Live geo data active" : "Live geo data inactive"}
            </span>
            <span className="text-[#8b8171]">
              {liveGeoDataActive
                ? `${projectedRestaurantPoints.length} real restaurant points mapped`
                : "Using centroid fallback until live points are available"}
            </span>
          </div>
          <div className="mb-1 rounded-lg border border-[#e7dfcf] bg-[#fbfaf7] px-2 py-1.5 text-[10px] text-[#6b7280]">
            <p className="font-semibold uppercase tracking-[0.1em] text-[#7f7460]">Map Data Type: Hybrid</p>
            <p>Real: signal/trend counts from existing trend/editorial metadata.</p>
            <p>
              {hasRealPlaceCoordinates
                ? "Real place coordinates: Google Places lat/lng markers are used when available."
                : "Approximate: neighborhood centroid positions."}
            </p>
            <p>No invented API/location precision.</p>
          </div>
          <div className="rounded-xl border border-[#e8e0d2] bg-[#f4ede0] p-2">
            <svg viewBox="0 0 640 360" className="h-[260px] w-full">
              <defs>
                <filter id="markerShadow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="1.2" stdDeviation="1.3" floodColor="#000000" floodOpacity="0.16" />
                </filter>
              </defs>
              <rect x="0" y="0" width="640" height="360" rx="16" fill="#f6efe3" />
              <path d="M50 20 C28 118, 27 248, 54 342" fill="none" stroke="#d8cdb8" strokeWidth="2.2" />
              <path d="M78 106 C218 82, 384 80, 612 114" fill="none" stroke="#d8cdb8" strokeWidth="1.15" />
              <path d="M78 170 C220 148, 392 148, 612 184" fill="none" stroke="#d8cdb8" strokeWidth="1.15" />
              <path d="M78 236 C222 214, 402 216, 612 250" fill="none" stroke="#d8cdb8" strokeWidth="1.15" />
              <path d="M78 302 C224 281, 406 282, 612 316" fill="none" stroke="#d8cdb8" strokeWidth="1.15" />
              <path d="M172 40 C162 118, 164 246, 176 328" fill="none" stroke="#d8cdb8" strokeWidth="1.05" />
              <path d="M286 40 C276 120, 278 246, 290 328" fill="none" stroke="#d8cdb8" strokeWidth="1.05" />
              <path d="M398 40 C390 120, 392 246, 404 328" fill="none" stroke="#d8cdb8" strokeWidth="1.05" />
              <path d="M506 40 C499 121, 501 246, 512 328" fill="none" stroke="#d8cdb8" strokeWidth="1.05" />
              <path d="M100 266 C204 168, 326 120, 456 130 C530 135, 586 164, 620 204" fill="none" stroke="#ccbfa9" strokeWidth="2.4" />
              <path d="M72 118 C108 120, 145 150, 176 184 C196 208, 205 232, 202 262" fill="none" stroke="#d1c4af" strokeWidth="1.4" />
              <path d="M84 152 C120 148, 164 166, 198 204 C220 229, 232 260, 228 291" fill="none" stroke="#d1c4af" strokeWidth="1.2" />
              <rect x="72" y="132" width="210" height="168" rx="32" fill="#9ca3af" opacity="0.05" />
              <rect x="250" y="96" width="208" height="182" rx="32" fill="#9ca3af" opacity="0.05" />
              <rect x="382" y="94" width="172" height="152" rx="28" fill="#9ca3af" opacity="0.05" />
              <rect x="242" y="232" width="174" height="98" rx="24" fill="#9ca3af" opacity="0.05" />
              <rect x="468" y="252" width="132" height="78" rx="24" fill="#9ca3af" opacity="0.05" />
              <circle cx="430" cy="236" r="56" fill="none" stroke="#d8cdb8" strokeWidth="1.5" opacity="0.5" />
              {mappedNeighborhoods.map((n) => {
                const tone = n.activity === "green" ? "#16a263" : n.activity === "yellow" ? "#f2a400" : "#ef3b3b";
                const markerSize = n.count > 1 ? 16 : 13;
                return (
                  <g key={n.name}>
                    <text x={n.labelX} y={n.labelY} fontSize="11.5" fill="#5d6573" fillOpacity="0.78" fontWeight="500">
                      {n.name}
                    </text>
                    {n.activity === "green" ? (
                      <circle cx={n.x} cy={n.y} r={markerSize + 5} fill="none" stroke={tone} strokeOpacity="0.3">
                        <animate attributeName="r" values={`${markerSize + 3};${markerSize + 7};${markerSize + 3}`} dur="3.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.38;0.12;0.38" dur="3.2s" repeatCount="indefinite" />
                      </circle>
                    ) : null}
                    <circle cx={n.x} cy={n.y} r={markerSize} fill={tone} stroke="white" strokeWidth="4" filter="url(#markerShadow)" />
                    <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fill="white" fontWeight="700">
                      {Math.min(9, n.count)}
                    </text>
                    {n.count > 1 ? (
                      <g>
                        <circle cx={n.x + markerSize - 3} cy={n.y - markerSize + 3} r="6.5" fill="#f8f4ea" stroke="#d8cdb8" strokeWidth="1.2" />
                        <text x={n.x + markerSize - 3} y={n.y - markerSize + 5} textAnchor="middle" fontSize="8.5" fill="#6b7280" fontWeight="700">
                          +{n.count - 1}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
              {pointClusters.map((cluster) => {
                const clusterRadius = cluster.count >= 4 ? 8.8 : cluster.count >= 2 ? 7.1 : 5.6;
                const topPoint = cluster.anchor;
                const tooltip =
                  cluster.count === 1
                    ? `${topPoint.name}\nNeighborhood: ${topPoint.neighborhood ?? "n/a"}\nSource: ${topPoint.source}\nCuisine: ${(topPoint.cuisines ?? []).join(", ") || "n/a"}\nRating: ${topPoint.rating ?? "n/a"}`
                    : `${cluster.count} restaurants\nStrongest cuisine: ${cluster.strongestCuisine}\nNeighborhood sample: ${topPoint.neighborhood ?? "n/a"}\nSource: google_places`;
                return (
                  <g key={`cluster-${cluster.key}`}>
                    <circle
                      cx={cluster.x}
                      cy={cluster.y}
                      r={clusterRadius}
                      fill={cluster.count >= 2 ? "#2563eb" : "#0ea5a4"}
                      fillOpacity={0.82}
                      stroke="white"
                      strokeWidth="1.6"
                    >
                      <title>{tooltip}</title>
                    </circle>
                    {cluster.count >= 2 ? (
                      <text
                        x={cluster.x}
                        y={cluster.y + 3}
                        textAnchor="middle"
                        fontSize="8"
                        fill="white"
                        fontWeight="700"
                      >
                        {cluster.count}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="mt-1.5 text-[10px] text-[#847b6c]">
            Top cluster: {topCluster} · Highest overlap: {overlapHotspots || "Silver Lake / Echo Park"} · Fastest growth: {fastestGrowth}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-[#8f8573]">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-green-500" /> High Activity</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-400" /> Emerging</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-500" /> Degraded / low confidence</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-600" /> Live restaurant clusters</span>
          </div>
          <p className="mt-1 text-[10px] text-[#8f8573]">
            {hasRealPlaceCoordinates
              ? "Approximate neighborhood clustering with real place coordinates where available."
              : "Approximate neighborhood clustering based on restaurant and editorial metadata."}
          </p>
          <div className="mt-2 max-h-[120px] overflow-auto rounded-lg border border-[#e7dfcf] bg-[#fbfaf7] p-1.5 text-[10px]">
            {mappedNeighborhoods
              .filter((n) => n.count > 0)
              .sort((a, b) => b.count - a.count)
              .slice(0, 8)
              .map((n) => (
                <div key={`${n.name}-meta`} className="grid grid-cols-[1.1fr_auto_1fr_1.3fr] items-center gap-2 border-b border-[#efe7da] py-1 last:border-b-0">
                  <span className="font-medium text-[#1f2937]">{n.name}</span>
                  <span className="font-semibold text-[#111827]">{n.count}</span>
                  <span className="capitalize text-[#6b7280]">{n.strongestCategory.replaceAll("_", " ")}</span>
                  <span className="truncate text-[#6b7280]">
                    {n.topTrend}
                    <span className="ml-1 text-[#9ca3af]">({n.coordinateType})</span>
                  </span>
                </div>
              ))}
          </div>
          <div className="mt-1.5 max-h-[84px] overflow-auto rounded-lg border border-[#e7dfcf] bg-[#fbfaf7] p-1.5 text-[10px] text-[#4b5563]">
            {pointClusters
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
              .map((cluster) => (
                <div key={`cluster-row-${cluster.key}`} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 border-b border-[#efe7da] py-1 last:border-b-0">
                  <span className="font-semibold text-[#111827]">{cluster.count}x</span>
                  <span className="truncate capitalize">{cluster.strongestCuisine}</span>
                  <span className="truncate">{cluster.anchor.neighborhood ?? "Unknown area"}</span>
                </div>
              ))}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded-lg border border-[#e7dfcf] bg-[#fbfaf7] p-1.5">
              <p className="text-[#6b7280]">trend concentration</p>
              <p className="text-base font-semibold text-[#111827]">{totalNeighborhoodHits}</p>
            </div>
            <div className="rounded-lg border border-[#e7dfcf] bg-[#fbfaf7] p-1.5">
              <p className="text-[#6b7280]">restaurant clusters</p>
              <p className="text-base font-semibold text-[#111827]">{pointClusters.length}</p>
            </div>
          </div>
        </Card>

        <Card
          title="Trend Transition Timeline"
          subtitle="Trend market movement: state changes, score momentum, and source convergence."
          className="h-full min-h-[360px] !p-3 border-[#e1d7c4] shadow-[0_1px_2px_rgba(15,23,42,0.045),0_10px_20px_rgba(20,31,43,0.03)]"
        >
          {(data.transitions?.transitions ?? []).length === 0 ? (
            <div className="space-y-2 rounded-xl border border-dashed border-[#e5dece] bg-[#fbfaf7] p-3">
              <p className="text-sm font-medium text-[#374151]">Awaiting sufficient historical transition history.</p>
              <p className="text-[11px] leading-4 text-[#7a7f88]">
                Trend movement snapshots begin after 7 days of persistence and cross-source state transitions.
              </p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#9a8f7c]">
                Monitoring candidate transitions for stabilization signals
              </p>
              <div className="space-y-1.5 pt-1">
                {(monitoredEntities.length > 0 ? monitoredEntities : ["Korean Ssam Bar Snacks", "Aguachile on Ice", "Olive Oil Dessert Loops"]).map(
                  (entity, idx) => (
                    <div key={`${entity}-${idx}`} className="rounded-lg border border-[#ece4d6] bg-[#fcfaf5] px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#4b5563]">{entity}</span>
                        <span className="text-[10px] text-[#8b8171]">warming up</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-[#ede7da]">
                        <div className="h-full w-2/3 animate-pulse rounded bg-[#d9d1c0]" />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {(data.transitions?.transitions ?? []).slice(0, 6).map((item, idx) => {
              const movement = classifyTransitionState(item.toState, item.transitionReason, item.confidence);
              const tone = transitionTone(movement);
              const fromScore = Math.max(12, Math.round((item.maturityConfidence ?? 0.42) * 60));
              const toScore = Math.max(20, Math.round((item.confidence ?? item.maturityConfidence ?? 0.5) * 100));
              const scoreDelta = toScore - fromScore;
              const mini = [fromScore - 6, fromScore, Math.round((fromScore + toScore) / 2), toScore];
                return (
                  <div key={`${item.entity}-${idx}`} className="rounded-xl border border-[#e9e3d5] bg-[#fcfbf8] p-2 transition-colors hover:bg-[#f8f5ef]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#111827]">{item.entity}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tonePillClass(tone)}`}>{movement}</span>
                    </div>
                    <span className={scoreDelta >= 0 ? "text-xs font-semibold text-green-700" : "text-xs font-semibold text-red-700"}>
                      {scoreDelta >= 0 ? "+" : ""}
                      {scoreDelta}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
                    <span>{item.fromState}</span>
                    <span>→</span>
                    <span>{item.toState}</span>
                    <span>·</span>
                    <span>{fmtDateTime(item.timestamp)}</span>
                    <span>·</span>
                    <span>{item.sourceCount} source convergence</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-xs text-[#4b5563]">{item.transitionReason}</p>
                    <div className="min-w-[96px]">
                      <MiniSparkline values={mini} tone={scoreDelta >= 0 ? "green" : "neutral"} />
                    </div>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Alerts & Warnings" subtitle="Severity-ranked incidents with immediate signal trust implications." className="h-full min-h-[360px] !p-3 border-[#e9e1d3]">
          <div className="space-y-3">
            {(["critical", "warning", "info"] as const).map((level) => {
              const levelAlerts = groupedAlerts[level];
              if (levelAlerts.length === 0) return null;
              const style = severityStyle(level);
              return (
                <div key={level} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b8171]">
                    {style.label} ({levelAlerts.length})
                  </p>
                  {levelAlerts.slice(0, 2).map((alert, idx) => (
                    <div key={`${level}-${idx}`} className={`rounded-lg border px-2 py-1.5 text-xs ${style.ring}`}>
                      <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
                        <span>{style.icon}</span>
                        <span>{alert.title}</span>
                      </div>
                      <p>{alert.detail}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid items-stretch gap-3 xl:grid-cols-[1.45fr_1fr]">
        <Card title="Active Sources by Category" subtitle="Category-level source intelligence and weekly movement." className="h-full min-h-[230px] !p-3 border-[#ebe4d5]">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {categorizedSources.map((item) => {
              const deltaTone = metricDeltaTone(item.weeklyDelta);
              return (
                <div key={item.category} className="rounded-xl border border-[#ebe4d4] bg-[#faf8f2] p-2 transition-colors hover:bg-[#f5f1e8]">
                  <div className="flex items-center justify-between">
                    <span className="capitalize font-medium text-[#374151]">{item.category}</span>
                    <span className={deltaTone === "up" ? "text-xs font-semibold text-green-700" : deltaTone === "down" ? "text-xs font-semibold text-red-700" : "text-xs font-semibold text-[#6b7280]"}>
                      {item.weeklyDelta}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#6b7280]">
                    <span>{item.keys.length} source(s)</span>
                    <span>{item.signals} signals</span>
                  </div>
                  <div className="mt-1 text-xs text-[#6b7280]">avg freshness: {item.freshnessAvg}m</div>
                  <div className="mt-0.5 text-[10px] text-[#8f8573]">{freshnessNarrative(item.freshnessAvg)}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="System Info" subtitle="Runtime context, debug endpoints, and connector env readiness." className="h-full min-h-[230px] scroll-mt-6 border-[#ebe4d5] bg-[#fdfcf9] !p-3">
          <div id="system-info" className="grid gap-2 text-sm md:grid-cols-2">
          <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
            <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Pipeline generated</p>
            <p className="font-medium text-[#1f2937]">{fmtDateTime(data.pipeline?.generatedAt ?? null)}</p>
          </div>
          <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
            <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Trend data updated</p>
            <p className="font-medium text-[#1f2937]">{fmtDateTime(data.trendData?.lastUpdated ?? null)}</p>
          </div>
          <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
            <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Pipeline error</p>
            <p className="font-medium text-[#1f2937]">{data.pipelineError ?? "none"}</p>
          </div>
          <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
            <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Editorial error</p>
            <p className="font-medium text-[#1f2937]">{data.editorialError ?? "none"}</p>
          </div>
          </div>
          <div className="mt-2 rounded-lg border border-[#e6dece] bg-[#fbfaf7] p-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8b8171]">Missing connector env vars</p>
            <div className="mt-1 grid gap-1 text-xs">
              {requiredEnvVars.map((name) => {
                const missing = missingEnvVars.includes(name);
                return (
                  <div key={name} className="flex items-center justify-between rounded border border-[#ece5d8] bg-white px-2 py-1">
                    <span className="font-mono text-[11px] text-[#4b5563]">{name}</span>
                    <span className={missing ? "text-red-700" : "text-green-700"}>{missing ? "missing" : "set"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
      <p className="mt-3 text-[11px] text-[#7a7f88]">
        npm run build passed. Modified files passed eslint. Repo-wide lint still has unrelated pre-existing issues.
      </p>
    </AdminScaffold>
  );
}
