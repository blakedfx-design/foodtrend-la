import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Status = "green" | "yellow" | "red";

type PipelineHealthPayload = {
  generatedAt: string;
  overallStatus: Status;
  jobs: Record<
    string,
    {
      lastRunAt: string | null;
      lastSuccessAt: string | null;
      durationMs: number | null;
      status: Status;
      errorMessage: string | null;
    }
  >;
  sources: Record<
    string,
    {
      status: Status;
      enabled: boolean;
      lastSuccessAt: string | null;
      freshnessMinutes: number | null;
      signalCount: number;
      parseCount: number;
      failureCount: number;
      stale: boolean;
      notes: string[];
    }
  >;
  storage: Record<
    string,
    {
      exists: boolean;
      readable: boolean;
      lastModified: string | null;
      entryCount: number;
      stale: boolean;
      status: Status;
      notes: string[];
    }
  >;
  error?: string;
};

type EditorialPayload = {
  now: string;
  feedStatus: Record<string, "green" | "red" | "yellow">;
  articleCountPerPublication: Record<string, number>;
  topMatchedDishes: Array<{ entity: string; count: number }>;
  topCandidateOnlyEntities: Array<{ entity: string; mentions: number }>;
  suppressedNeighborhoodCandidates: Array<unknown>;
  failedSources: Array<unknown>;
  convergenceCandidateDebug: Array<{
    entity: string;
    score: number;
    maturityState?: string;
    maturityConfidence?: number;
    candidateOnly: boolean;
    editorialContributionPct: number;
    supportingPublicationCount: number;
    primaryEligible: boolean;
    aboutToHitEligible: boolean;
    eligibilityReason: string;
    sourceMix: Record<string, number>;
  }>;
  error?: string;
};

type FetchResult<T> = {
  data: T | null;
  error: string | null;
};

function statusPillClass(status: string): string {
  if (status === "green") return "bg-green-100 text-green-800 border-green-200";
  if (status === "yellow") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

function sourceMixLabel(sourceMix: Record<string, number>): string {
  const parts = Object.entries(sourceMix).map(([k, v]) => `${k}:${v}`);
  return parts.length > 0 ? parts.join(", ") : "-";
}

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchJson<T>(url: string): Promise<FetchResult<T>> {
  const previewSecret = process.env.NEXT_PUBLIC_ADMIN_PREVIEW_SECRET ?? "";
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "x-admin-preview": previewSecret,
      },
    });
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function computeReadiness(
  pipeline: PipelineHealthPayload | null,
  editorial: EditorialPayload | null,
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

export default async function AdminPage() {
  const baseUrl = await getBaseUrl();
  const [pipelineRes, editorialRes] = await Promise.all([
    fetchJson<PipelineHealthPayload>(`${baseUrl}/api/debug/pipeline-health`),
    fetchJson<EditorialPayload>(`${baseUrl}/api/debug/editorial-signals`),
  ]);

  const pipeline = pipelineRes.data;
  const editorial = editorialRes.data;
  const readiness = computeReadiness(pipeline, editorial);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Foodtrend LA Admin</h1>
        <p className="mt-1 text-sm text-neutral-600">Internal read-only monitoring for pipeline and trend intelligence.</p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Update Readiness</h2>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(
            readiness.verdict === "Ready" ? "green" : readiness.verdict === "Caution" ? "yellow" : "red",
          )}`}>
            {readiness.verdict}
          </span>
          <span className="text-sm text-neutral-600">{readiness.reasons.join(" | ")}</span>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">System Status</h2>
        {pipelineRes.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Failed to load pipeline health: {pipelineRes.error}
          </div>
        ) : pipeline ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm text-neutral-600">Overall</div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClass(pipeline.overallStatus)}`}>
                  {pipeline.overallStatus}
                </span>
                <span className="text-sm text-neutral-700">Generated {fmtDate(pipeline.generatedAt)}</span>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(pipeline.storage ?? {}).map(([key, storage]) => (
                <div key={key} className="rounded-md border border-neutral-200 p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{key}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClass(storage.status)}`}>
                      {storage.status}
                    </span>
                  </div>
                  <div className="mt-1 text-neutral-600">
                    readable: {String(storage.readable)} | entries: {storage.entryCount} | last modified:{" "}
                    {fmtDate(storage.lastModified)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Source Health</h2>
        {pipelineRes.error ? (
          <div className="text-sm text-neutral-600">Unavailable while pipeline health is unreachable.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Enabled</th>
                  <th className="pb-2 pr-3">Last Success</th>
                  <th className="pb-2 pr-3">Freshness (m)</th>
                  <th className="pb-2 pr-3">Signals</th>
                  <th className="pb-2 pr-3">Parsed</th>
                  <th className="pb-2 pr-3">Failures</th>
                  <th className="pb-2 pr-3">Stale</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pipeline?.sources ?? {}).map(([name, source]) => (
                  <tr key={name} className="border-t border-neutral-100 align-top">
                    <td className="py-2 pr-3 font-medium">{name}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClass(source.status)}`}>
                        {source.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{String(source.enabled)}</td>
                    <td className="py-2 pr-3">{fmtDate(source.lastSuccessAt)}</td>
                    <td className="py-2 pr-3">{source.freshnessMinutes ?? "-"}</td>
                    <td className="py-2 pr-3">{source.signalCount}</td>
                    <td className="py-2 pr-3">{source.parseCount}</td>
                    <td className="py-2 pr-3">{source.failureCount}</td>
                    <td className="py-2 pr-3">{String(source.stale)}</td>
                    <td className="py-2 text-neutral-600">{source.notes.join(" | ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Job Health</h2>
        {pipelineRes.error ? (
          <div className="text-sm text-neutral-600">Unavailable while pipeline health is unreachable.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(pipeline?.jobs ?? {}).map(([name, job]) => (
              <div key={name} className="rounded-md border border-neutral-200 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClass(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <div className="text-neutral-600">
                  last run: {fmtDate(job.lastRunAt)} | last success: {fmtDate(job.lastSuccessAt)} | duration:{" "}
                  {job.durationMs ?? "-"}ms
                </div>
                {job.errorMessage ? <div className="mt-1 text-red-700">error: {job.errorMessage}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Editorial Signals</h2>
        {editorialRes.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Failed to load editorial signals: {editorialRes.error}
          </div>
        ) : editorial ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {Object.entries(editorial.feedStatus ?? {}).map(([source, status]) => (
                <span key={source} className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClass(status)}`}>
                  {source}: {status}
                </span>
              ))}
            </div>
            <div className="text-neutral-700">
              articleCountPerPublication:{" "}
              {Object.entries(editorial.articleCountPerPublication ?? {})
                .map(([k, v]) => `${k}:${v}`)
                .join(" | ") || "-"}
            </div>
            <div className="text-neutral-700">
              topMatchedDishes:{" "}
              {(editorial.topMatchedDishes ?? []).map((d) => `${d.entity} (${d.count})`).join(", ") || "-"}
            </div>
            <div className="text-neutral-700">
              topCandidateOnlyEntities:{" "}
              {(editorial.topCandidateOnlyEntities ?? [])
                .map((d) => `${d.entity} (${d.mentions})`)
                .join(", ") || "-"}
            </div>
            <div className="text-neutral-700">
              suppressedNeighborhoodCandidates: {editorial.suppressedNeighborhoodCandidates?.length ?? 0} | failedSources:{" "}
              {editorial.failedSources?.length ?? 0}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Candidate Debug Table</h2>
        {editorialRes.error ? (
          <div className="text-sm text-neutral-600">Unavailable while editorial signals are unreachable.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="pb-2 pr-3">Entity</th>
                  <th className="pb-2 pr-3">Score</th>
                  <th className="pb-2 pr-3">Maturity</th>
                  <th className="pb-2 pr-3">Confidence</th>
                  <th className="pb-2 pr-3">Candidate Only</th>
                  <th className="pb-2 pr-3">Editorial %</th>
                  <th className="pb-2 pr-3">Pub Support</th>
                  <th className="pb-2 pr-3">Primary</th>
                  <th className="pb-2 pr-3">About-to-Hit</th>
                  <th className="pb-2 pr-3">Eligibility Reason</th>
                  <th className="pb-2">Source Mix</th>
                </tr>
              </thead>
              <tbody>
                {(editorial?.convergenceCandidateDebug ?? []).map((c) => (
                  <tr key={c.entity} className="border-t border-neutral-100 align-top">
                    <td className="py-2 pr-3 font-medium">{c.entity}</td>
                    <td className="py-2 pr-3">{c.score}</td>
                    <td className="py-2 pr-3">{c.maturityState ?? "-"}</td>
                    <td className="py-2 pr-3">{typeof c.maturityConfidence === "number" ? c.maturityConfidence : "-"}</td>
                    <td className="py-2 pr-3">{String(c.candidateOnly)}</td>
                    <td className="py-2 pr-3">{c.editorialContributionPct}%</td>
                    <td className="py-2 pr-3">{c.supportingPublicationCount}</td>
                    <td className="py-2 pr-3">{String(c.primaryEligible)}</td>
                    <td className="py-2 pr-3">{String(c.aboutToHitEligible)}</td>
                    <td className="py-2 pr-3 text-neutral-600">{c.eligibilityReason}</td>
                    <td className="py-2 text-neutral-600">{sourceMixLabel(c.sourceMix)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
