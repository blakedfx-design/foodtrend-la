import type { TrendTransitionTimelinePayload } from "@/lib/debug/getTrendTransitions";

type Props = {
  payload: TrendTransitionTimelinePayload | null;
  error: string | null;
};

function stateColorClass(state: string): string {
  if (state === "emerging" || state === "accelerating" || state === "peak") {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (state === "stabilizing") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (state === "fading" || state === "blocked") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  return "bg-neutral-100 text-neutral-700 border-neutral-200";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

function confidenceLabel(conf: number | null): string {
  if (typeof conf !== "number" || !Number.isFinite(conf)) return "-";
  return conf.toFixed(2);
}

export function TrendTransitionTimeline({ payload, error }: Props) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-medium">Trend Transition Timeline</h2>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load transition timeline: {error}
        </div>
      ) : null}

      {!error && payload ? (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="text-neutral-500">Transitions this week</div>
              <div className="mt-1 text-xl font-semibold">{payload.summary.transitionsThisWeek}</div>
            </div>
            <div className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="text-neutral-500">Accelerating</div>
              <div className="mt-1 text-xl font-semibold text-green-700">{payload.summary.acceleratingCount}</div>
            </div>
            <div className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="text-neutral-500">Blocked</div>
              <div className="mt-1 text-xl font-semibold text-red-700">{payload.summary.blockedCount}</div>
            </div>
            <div className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="text-neutral-500">Promoted to Top5</div>
              <div className="mt-1 text-xl font-semibold">{payload.summary.promotedToTop5Count}</div>
            </div>
            <div className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="text-neutral-500">Fading</div>
              <div className="mt-1 text-xl font-semibold text-red-700">{payload.summary.fadingCount}</div>
            </div>
          </div>

          {payload.transitions.length === 0 ? (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
              No transition records found in `data/trend-transitions.json` yet.
            </div>
          ) : (
            <div className="space-y-3">
              {payload.transitions.map((t, idx) => (
                <article key={`${t.entity}-${t.week ?? "wk"}-${t.fromState}-${t.toState}-${idx}`} className="rounded-md border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{t.entity}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${stateColorClass(t.toState)}`}>
                      {t.toState}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-neutral-700">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${stateColorClass(t.fromState)}`}>
                      {t.fromState}
                    </span>{" "}
                    <span className="mx-1">{"->"}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${stateColorClass(t.toState)}`}>
                      {t.toState}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-neutral-600">
                    Week: {t.week ?? "-"} | Time: {fmtDate(t.timestamp)} | Confidence: {confidenceLabel(t.confidence)} | Sources:{" "}
                    {t.sourceCount} ({t.sourceTypes.join(", ") || "-"})
                  </div>
                  <div className="mt-1 text-sm text-neutral-700">Reason: {t.transitionReason}</div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
