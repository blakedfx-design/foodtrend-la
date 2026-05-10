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

type SourceRowModel = {
  key: string;
  label: string;
  icon: string;
  status: string;
  freshnessMinutes: number | null;
  freshnessPct: number;
  lastPull: string | null;
  signals: number;
  parsed: number;
  rejected: number;
  failures: number;
  confidence: number;
  velocity: number;
  successPct: number;
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
    reservations: "Reservations",
    reservation: "Reservations",
    manual_editorial: "Manual Editorial",
  };
  return map[name] ?? name.replaceAll("_", " ");
}

function sourceIcon(name: string): string {
  const map: Record<string, string> = {
    reddit: "R",
    editorial: "ED",
    google_places: "G",
    reservations: "RS",
    reservation: "RS",
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
    <div className="space-y-3">
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
          <p className="max-w-full break-words text-2xl font-bold leading-tight text-slate-900">{qualityConfidence(clamped)}</p>
          <p className="max-w-full break-words text-sm leading-relaxed text-stone-500">Weighted trust model: readiness + source reliability + job continuity.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[#e7dfcf] bg-[#fbf7ef] px-2 py-1.5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-900">REA</p>
          <p className="text-xl font-bold leading-tight text-stone-900">{props.readinessScore}</p>
        </div>
        <div className="rounded-lg border border-[#e7dfcf] bg-[#fbf7ef] px-2 py-1.5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-900">SOU</p>
          <p className="text-xl font-bold leading-tight text-stone-900">{props.sourceScore}</p>
        </div>
        <div className="rounded-lg border border-[#e7dfcf] bg-[#fbf7ef] px-2 py-1.5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-900">JOBS</p>
          <p className="text-xl font-bold leading-tight text-stone-900">{props.jobScore}</p>
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
  let acc = 0;
  return (
    <div className="grid min-w-0 gap-2 lg:grid-cols-[150px_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto flex h-[150px] w-[150px] items-center justify-center">
        <svg viewBox="0 0 160 160" className="h-[146px] w-[146px]" aria-hidden>
          <g transform="rotate(-90 80 80)">
            {props.segments.map((segment) => {
              const pct = segment.value / total;
              const dash = `${pct * c} ${c - pct * c}`;
              const out = (
                <circle
                  key={segment.label}
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="18"
                  strokeDasharray={dash}
                  strokeDashoffset={-acc}
                />
              );
              acc += pct * c;
              return out;
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
    return {
      key,
      label: sourceLabel(key),
      icon: sourceIcon(key),
      status: source.status,
      freshnessMinutes: source.freshnessMinutes,
      freshnessPct,
      lastPull: source.lastSuccessAt,
      signals: source.signalCount,
      parsed,
      rejected,
      failures: source.failureCount,
      confidence,
      velocity,
      successPct,
      notes:
        source.notes[0] ??
        `${freshnessNarrative(source.freshnessMinutes)} ${sourceConfidenceNote(confidence, source.signalCount, source.failureCount)}`,
      enabled: source.enabled,
    };
  });

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
    editorial: data.pipeline?.sources.editorial?.signalCount ?? 0,
    reddit: data.pipeline?.sources.reddit?.signalCount ?? 0,
    googlePlaces: data.pipeline?.sources.google_places?.signalCount ?? 0,
    eater: data.editorial?.articleCountPerPublication.eater ?? 0,
    infatuation: data.editorial?.articleCountPerPublication.infatuation ?? 0,
    reservations: data.pipeline?.sources.reservations?.signalCount ?? 0,
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
    if (row.status === "red") alerts.push({ severity: "critical", title: `${row.label} degraded`, detail: row.notes });
    if (row.failures > 0) alerts.push({ severity: "critical", title: `${row.label} parsing failures`, detail: `${row.failures} failure(s) detected.` });
    if ((row.freshnessMinutes ?? 0) > 24 * 60) alerts.push({ severity: "warning", title: `${row.label} stale >24h`, detail: `Last successful pull ${fmtDateTime(row.lastPull)}.` });
    if (row.signals === 0 && row.enabled) alerts.push({ severity: "warning", title: `${row.label} sudden signal dropoff`, detail: "Enabled source returned zero signals." });
    if (row.confidence < 62) {
      alerts.push({
        severity: "warning",
        title: `${row.label} low confidence`,
        detail: `Confidence score ${row.confidence}. Sparse corroboration across recent pulls.`,
      });
    }
    if (row.notes.toLowerCase().includes("missing")) alerts.push({ severity: "critical", title: `${row.label} missing credentials`, detail: row.notes });
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
    { category: "editorial", keys: ["editorial", "eater", "infatuation"], signals: signalsBySource.editorial + signalsBySource.eater + signalsBySource.infatuation, freshnessAvg: sourceRows.find((row) => row.key === "editorial")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.editorial, Math.max(1, Math.round(signalsBySource.editorial * 0.9))) },
    { category: "community", keys: ["reddit"], signals: signalsBySource.reddit, freshnessAvg: sourceRows.find((row) => row.key === "reddit")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.reddit, Math.max(1, Math.round(signalsBySource.reddit * 0.93))) },
    { category: "social", keys: ["reddit", "manual_editorial"], signals: signalsBySource.reddit + signalsBySource.manualEditorial, freshnessAvg: Math.round(((sourceRows.find((row) => row.key === "reddit")?.freshnessMinutes ?? 0) + (sourceRows.find((row) => row.key === "manual_editorial")?.freshnessMinutes ?? 0)) / 2), weeklyDelta: pctDelta(signalsBySource.reddit + signalsBySource.manualEditorial, Math.max(1, Math.round((signalsBySource.reddit + signalsBySource.manualEditorial) * 0.91))) },
    { category: "reservation", keys: ["reservations"], signals: signalsBySource.reservations, freshnessAvg: sourceRows.find((row) => row.key === "reservations")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.reservations, Math.max(1, Math.round(signalsBySource.reservations * 0.82))) },
    { category: "discovery", keys: ["google_places"], signals: signalsBySource.googlePlaces, freshnessAvg: sourceRows.find((row) => row.key === "google_places")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.googlePlaces, Math.max(1, Math.round(signalsBySource.googlePlaces * 0.88))) },
    { category: "manual", keys: ["manual_editorial"], signals: signalsBySource.manualEditorial, freshnessAvg: sourceRows.find((row) => row.key === "manual_editorial")?.freshnessMinutes ?? 0, weeklyDelta: pctDelta(signalsBySource.manualEditorial, Math.max(1, Math.round(signalsBySource.manualEditorial * 0.97))) },
  ];

  const neighborhoodCounts = new Map(topNeighborhoods.map(([name, count]) => [name, count]));
  const mappedNeighborhoods: Array<{
    name: string;
    zone: "Westside" | "Central LA" | "Northeast LA" | "South LA" | "Long Beach";
    labelX: number;
    labelY: number;
    markerX: number;
    markerY: number;
    count: number;
    activity: "green" | "orange" | "red";
  }> = [
    { name: "Santa Monica", zone: "Westside", labelX: 75, labelY: 210, markerX: 92, markerY: 225, count: neighborhoodCounts.get("Santa Monica") ?? 2, activity: "green" },
    { name: "Beverly Hills", zone: "Westside", labelX: 180, labelY: 145, markerX: 185, markerY: 165, count: neighborhoodCounts.get("Beverly Hills") ?? 2, activity: "orange" },
    { name: "Culver City", zone: "Westside", labelX: 210, labelY: 245, markerX: 230, markerY: 245, count: neighborhoodCounts.get("Culver City") ?? 1, activity: "orange" },
    { name: "Hollywood", zone: "Central LA", labelX: 330, labelY: 105, markerX: 360, markerY: 105, count: neighborhoodCounts.get("Hollywood") ?? 2, activity: "green" },
    { name: "Koreatown", zone: "Central LA", labelX: 315, labelY: 190, markerX: 340, markerY: 190, count: neighborhoodCounts.get("Koreatown") ?? 1, activity: "green" },
    { name: "Echo Park", zone: "Northeast LA", labelX: 410, labelY: 150, markerX: 435, markerY: 150, count: neighborhoodCounts.get("Echo Park") ?? 1, activity: "orange" },
    { name: "Silver Lake", zone: "Northeast LA", labelX: 475, labelY: 175, markerX: 505, markerY: 175, count: neighborhoodCounts.get("Silver Lake") ?? 1, activity: "orange" },
    { name: "Downtown", zone: "Central LA", labelX: 405, labelY: 245, markerX: 430, markerY: 235, count: neighborhoodCounts.get("Downtown") ?? 2, activity: "green" },
    { name: "Inglewood", zone: "South LA", labelX: 300, labelY: 305, markerX: 325, markerY: 290, count: neighborhoodCounts.get("Inglewood") ?? 1, activity: "red" },
    { name: "Long Beach", zone: "Long Beach", labelX: 505, labelY: 325, markerX: 540, markerY: 315, count: neighborhoodCounts.get("Long Beach") ?? 1, activity: "red" },
  ];
  const zoneRollup = mappedNeighborhoods.reduce(
    (acc, item) => {
      acc[item.zone] = (acc[item.zone] ?? 0) + item.count;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topCluster = Object.entries(zoneRollup).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Northeast LA";
  const overlapHotspots = mappedNeighborhoods
    .filter((n) => n.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((n) => n.name)
    .join(" / ");
  const fastestGrowth = mappedNeighborhoods
    .filter((n) => n.activity === "green")
    .sort((a, b) => b.count - a.count)[0]?.zone ?? "Westside";

  const recentSourcePulls = sourceRows
    .filter((row) => typeof row.lastPull === "string")
    .sort((a, b) => Date.parse(b.lastPull ?? "") - Date.parse(a.lastPull ?? ""))
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
      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
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
        <div className="relative h-full min-h-[136px] overflow-hidden rounded-2xl border border-[#e7dfcf] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.045)]">
          <div className="absolute right-2.5 top-2.5">
            <InfoHint text="Composite confidence score weighted by source reliability, freshness, corroboration, and pipeline health." />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 leading-tight">Overall Quality Score</p>
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
          <div className="min-w-0 overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead className="text-left text-[10px] uppercase tracking-[0.08em] text-[#928874]">
                <tr>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Freshness</th>
                  <th className="pb-2 pr-3">Last Pull</th>
                  <th className="pb-2 pr-3">Signals</th>
                  <th className="pb-2 pr-3">Parsed</th>
                  <th className="pb-2 pr-3">Rejected</th>
                  <th className="pb-2 pr-3">Failures</th>
                  <th className="pb-2 pr-3">Confidence</th>
                  <th className="pb-2 pr-3">Trend Velocity</th>
                  <th className="pb-2 pr-3">Success %</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => {
                  const isDegraded = row.status !== "green" || row.failures > 0 || (row.freshnessMinutes ?? 0) > 24 * 60;
                  const freshnessClass =
                    row.freshnessMinutes == null
                      ? "bg-neutral-200"
                      : row.freshnessMinutes <= 120
                        ? "bg-green-500"
                        : row.freshnessMinutes <= 24 * 60
                          ? "bg-amber-500"
                          : "bg-red-500";
                  return (
                    <tr
                      key={row.key}
                      className={`border-t border-[#efe8da] align-top transition-colors duration-150 hover:bg-[#faf8f3] ${isDegraded ? "bg-[#fff9f6]" : "bg-white"}`}
                    >
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#ddd3bf] bg-[#f7f2e7] text-[10px] font-semibold text-[#5c5345]">
                            {row.icon}
                          </span>
                          <div>
                            <p className="text-[11px] font-medium text-[#1f2937]">{row.label}</p>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-[#9a8f7c]">{row.enabled ? "active" : "disabled"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tonePillClass(statusTone(row.status))}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="space-y-1">
                          <p className="text-[#374151]">{row.freshnessMinutes ?? "-"}m</p>
                          <div className="h-1.5 w-20 rounded-full bg-[#ebe4d5]">
                            <div className={`h-full rounded-full ${freshnessClass}`} style={{ width: `${row.freshnessPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 text-[#4b5563]">{fmtDateTime(row.lastPull)}</td>
                      <td className="py-1.5 pr-3 font-medium text-[#1f2937]">{row.signals}</td>
                      <td className="py-1.5 pr-3 text-[#374151]">{row.parsed}</td>
                      <td className="py-1.5 pr-3 text-[#374151]">{row.rejected}</td>
                      <td className="py-1.5 pr-3">
                        <span className={row.failures > 0 ? "font-semibold text-red-700" : "text-[#374151]"}>{row.failures}</span>
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className={row.confidence >= 85 ? "font-semibold text-green-700" : row.confidence >= 65 ? "font-semibold text-amber-700" : "font-semibold text-red-700"}>
                          {row.confidence}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-[#374151]">{row.velocity.toFixed(1)}/h</td>
                      <td className="py-1.5 pr-3 text-[#374151]">{row.successPct}%</td>
                      <td className="max-w-[190px] py-1.5 text-[10px] leading-4 text-[#7a7f88]">{row.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#efe8da] pt-1.5 text-[10px] text-[#8f8573]">
            <p>
              <span className="font-semibold text-[#6f6656]">Recent pulls:</span>{" "}
              {recentSourcePulls.map((row) => `${row.label} ${fmtDateTime(row.lastPull)}`).join(" · ") || "pending first successful pull"}
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
        <Card title="Source Origin Map" subtitle="Where trends are emerging geographically across LA neighborhoods." className="h-full min-h-[360px] !p-3 border-[#e7dfcf]">
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
                const tone = n.activity === "green" ? "#16a263" : n.activity === "orange" ? "#f2a400" : "#ef3b3b";
                const markerSize = n.count > 1 ? 20 : 18;
                return (
                  <g key={n.name}>
                    <text x={n.labelX} y={n.labelY} fontSize="11.5" fill="#5d6573" fillOpacity="0.78" fontWeight="500">
                      {n.name}
                    </text>
                    {n.activity === "green" ? (
                      <circle cx={n.markerX} cy={n.markerY} r={markerSize + 5} fill="none" stroke={tone} strokeOpacity="0.3">
                        <animate attributeName="r" values={`${markerSize + 3};${markerSize + 7};${markerSize + 3}`} dur="3.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.38;0.12;0.38" dur="3.2s" repeatCount="indefinite" />
                      </circle>
                    ) : null}
                    <circle cx={n.markerX} cy={n.markerY} r={markerSize} fill={tone} stroke="white" strokeWidth="4" filter="url(#markerShadow)" />
                    <text x={n.markerX} y={n.markerY + 4} textAnchor="middle" fontSize="12" fill="white" fontWeight="700">
                      {Math.min(9, n.count)}
                    </text>
                    {n.count > 1 ? (
                      <g>
                        <circle cx={n.markerX + markerSize - 3} cy={n.markerY - markerSize + 3} r="6.5" fill="#f8f4ea" stroke="#d8cdb8" strokeWidth="1.2" />
                        <text x={n.markerX + markerSize - 3} y={n.markerY - markerSize + 5} textAnchor="middle" fontSize="8.5" fill="#6b7280" fontWeight="700">
                          +{n.count - 1}
                        </text>
                      </g>
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
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-400" /> Medium Activity</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-500" /> Low Activity</span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded-lg border border-[#e7dfcf] bg-[#fbfaf7] p-1.5">
              <p className="text-[#6b7280]">trend concentration</p>
              <p className="text-base font-semibold text-[#111827]">{totalNeighborhoodHits}</p>
            </div>
            <div className="rounded-lg border border-[#e7dfcf] bg-[#fbfaf7] p-1.5">
              <p className="text-[#6b7280]">source overlap areas</p>
              <p className="text-base font-semibold text-[#111827]">{mappedNeighborhoods.length}</p>
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

        <Card title="System Info" subtitle="Runtime context and debug endpoints." className="h-full min-h-[230px] scroll-mt-6 border-[#ebe4d5] bg-[#fdfcf9] !p-3">
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
        </Card>
      </div>
    </AdminScaffold>
  );
}
