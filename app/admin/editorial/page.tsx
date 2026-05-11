import Link from "next/link";
import {
  AdminScaffold,
  Card,
  DonutChart,
  StatusPill,
  statusTone,
  tonePillClass,
  type HealthTone,
} from "@/components/admin/AdminUi";
import {
  computeReadiness,
  fmtDateTime,
  loadAdminDataBundle,
  sourceMixLabel,
  topTrendCards,
} from "@/lib/admin/dashboard";

export const dynamic = "force-dynamic";

function checklistTone(ok: boolean): HealthTone {
  return ok ? "green" : "yellow";
}

export default async function AdminEditorialPage() {
  const data = await loadAdminDataBundle();
  const trends = topTrendCards(data.trendData);
  const candidates = data.editorial?.convergenceCandidateDebug ?? [];
  const leadTrend = trends[0];
  const leadCandidate = candidates[0];
  const readiness = computeReadiness(data.pipeline, data.editorial);

  const sourceMixSegments = leadCandidate
    ? Object.entries(leadCandidate.sourceMix).map(([label, value], idx) => ({
        label,
        value,
        color: ["#2f8f5b", "#84cc16", "#d97706", "#2563eb", "#dc2626"][idx % 5],
      }))
    : [{ label: "No data", value: 1, color: "#9ca3af" }];

  const imageStatus = trends.map((trend) => ({
    name: trend.name,
    hasImage: Boolean(trend.heroImageUrl),
    hasDescriptor: Boolean(trend.description?.trim()),
    hasOrderLine: trend.menuItems.length > 0,
  }));

  const notes = [
    ...(data.editorial?.failedSources ?? []).map((x) => `Source fetch issue: ${x}`),
    ...candidates.slice(0, 4).flatMap((c) => c.riskFlags.map((flag) => `${c.entity}: ${flag}`)),
  ];

  const previewActions = [
    { label: "Preview Full Report", href: "/la-food" },
    { label: "Open in New Tab", href: "/la-food" },
    { label: "Download PDF", href: "#", disabled: true, note: "Not implemented yet" },
    { label: "Share Preview Link", href: "#", disabled: true, note: "Guarded until sharing flow exists" },
  ];

  const publishChecklist = [
    { label: "Pipeline health green/yellow", ok: data.pipeline?.overallStatus !== "red" },
    { label: "Top 5 trend cards available", ok: trends.length >= 5 },
    { label: "No editorial feed failures", ok: (data.editorial?.failedSources.length ?? 0) === 0 },
    { label: "Candidate queue loaded", ok: candidates.length > 0 },
    { label: "Storage readable", ok: Boolean(data.pipeline?.storage.foodTrendData.readable) },
  ];

  return (
    <AdminScaffold
      navKey="editorial"
      breadcrumb="ADMIN / EDITORIAL"
      title="Editorial Control Center"
      subtitle="Preview, curate and publish this week's Top 5 trends."
      actions={
        <>
          <Link
            href="/la-food"
            className="rounded-lg border border-[#d8d0be] bg-white px-3 py-2 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Preview Full Report
          </Link>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-[#94d3b0] bg-[#dff5e7] px-3 py-2 text-xs font-semibold text-[#2f8f5b] opacity-80"
            title="Publish, Commit & Push is guarded until release automation is wired."
          >
            Publish, Commit & Push
          </button>
        </>
      }
    >
      <Card title="Top 5 Trends Preview" subtitle="Editorial card preview with current curated dish imagery.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trends.map((trend, index) => (
            <article key={trend.id} className="rounded-xl border border-[#e7dfcf] bg-[#fcfbf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b8171]">Rank {index + 1}</p>
                <StatusPill tone={trend.confidence === "high" ? "green" : trend.confidence === "medium" ? "yellow" : "red"} label={trend.confidence} />
              </div>
              <div className="overflow-hidden rounded-lg border border-[#e6dfcf] bg-[#f3efe6]">
                {trend.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={trend.heroImageUrl} alt={trend.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="grid h-40 place-items-center text-xs text-[#8b8171]">No image available</div>
                )}
              </div>
              <h3 className="mt-2 text-base font-semibold tracking-tight text-[#1f2937]">{trend.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-[#6b7280]">{trend.description}</p>
              <p className="mt-2 text-xs text-[#4b5563]">
                <span className="font-semibold">Most spotted:</span> {trend["MOST SPOTTED"].split("\n")[0] ?? "-"}
              </p>
            </article>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Candidate Queue" subtitle="Scored candidates pending final editorial curation.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-[#6b7280]">
                <tr>
                  <th className="pb-2 pr-3">Entity</th>
                  <th className="pb-2 pr-3">Score</th>
                  <th className="pb-2 pr-3">Maturity</th>
                  <th className="pb-2 pr-3">Editorial %</th>
                  <th className="pb-2 pr-3">Primary</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 10).map((candidate) => (
                  <tr key={candidate.entity} className="border-t border-[#eee8db]">
                    <td className="py-2 pr-3 font-medium text-[#1f2937]">{candidate.entity}</td>
                    <td className="py-2 pr-3 text-[#374151]">{candidate.score}</td>
                    <td className="py-2 pr-3 text-[#374151]">{candidate.maturityState}</td>
                    <td className="py-2 pr-3 text-[#374151]">{candidate.editorialContributionPct}%</td>
                    <td className="py-2 pr-3 text-[#374151]">{String(candidate.primaryEligible)}</td>
                    <td className="py-2 text-[#6b7280]">{candidate.eligibilityReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Trend Details" subtitle="Focused inspection of the lead trend and candidate metadata.">
          {leadTrend ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
                <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Trend</p>
                <p className="font-semibold text-[#1f2937]">{leadTrend.name}</p>
              </div>
              <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
                <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Signal</p>
                <p className="font-semibold text-[#1f2937]">{leadTrend.signalScore}</p>
              </div>
              <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
                <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Updated</p>
                <p className="font-semibold text-[#1f2937]">{fmtDateTime(leadTrend.lastUpdated)}</p>
              </div>
              <div className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
                <p className="text-xs uppercase tracking-[0.1em] text-[#8b8171]">Lead candidate source mix</p>
                <p className="font-semibold text-[#1f2937]">{leadCandidate ? sourceMixLabel(leadCandidate.sourceMix) : "-"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6b7280]">Trend payload unavailable.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Source Mix" subtitle="Current source composition for the lead candidate.">
          <DonutChart
            segments={sourceMixSegments}
            centerLabel={leadCandidate ? `${leadCandidate.score}` : "-"}
          />
        </Card>

        <Card title="Image & Content Status" subtitle="Editorial checklist for card readiness.">
          <div className="space-y-2">
            {imageStatus.map((item) => {
              const rowOk = item.hasImage && item.hasDescriptor && item.hasOrderLine;
              return (
                <div key={item.name} className="rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] p-2">
                  <p className="text-sm font-medium text-[#1f2937]">{item.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <StatusPill tone={checklistTone(item.hasImage)} label={item.hasImage ? "Image" : "Missing image"} />
                    <StatusPill tone={checklistTone(item.hasDescriptor)} label={item.hasDescriptor ? "Descriptor" : "Missing descriptor"} />
                    <StatusPill tone={checklistTone(item.hasOrderLine)} label={item.hasOrderLine ? "Order line" : "Missing order"} />
                    {rowOk ? <StatusPill tone="green" label="Ready" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Recent Editorial Notes" subtitle="Latest warnings and flags from diagnostics.">
          <div className="space-y-2 text-sm">
            {notes.length === 0 ? (
              <p className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700">
                No recent editorial warnings from the current payload.
              </p>
            ) : (
              notes.slice(0, 8).map((note, idx) => (
                <p key={idx} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">
                  {note}
                </p>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Publish Readiness" subtitle="Guardrails before committing and pushing report output.">
          <div className="space-y-2">
            {publishChecklist.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#ebe4d4] bg-[#fbfaf7] px-3 py-2">
                <span className="text-sm text-[#374151]">{item.label}</span>
                <StatusPill tone={item.ok ? "green" : "yellow"} label={item.ok ? "Pass" : "Review"} />
              </div>
            ))}
            <div className={`mt-2 rounded-lg border px-3 py-2 text-xs font-medium ${tonePillClass(readiness.verdict === "Ready" ? "green" : readiness.verdict === "Caution" ? "yellow" : "red")}`}>
              {readiness.verdict}: {readiness.reasons.join(" · ")}
            </div>
          </div>
        </Card>

        <Card title="Preview Actions" subtitle="Share and inspect this week's report draft.">
          <div className="grid gap-2">
            {previewActions.map((action) =>
              action.disabled ? (
                <button
                  key={action.label}
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border border-[#e7dfcf] bg-[#f8f6f1] px-3 py-2 text-left text-sm text-[#8b8171]"
                >
                  {action.label}
                  {action.note ? <span className="ml-1 text-xs">({action.note})</span> : null}
                </button>
              ) : (
                <a
                  key={action.label}
                  href={action.href}
                  target={action.label === "Open in New Tab" ? "_blank" : undefined}
                  rel={action.label === "Open in New Tab" ? "noreferrer" : undefined}
                  className="rounded-lg border border-[#d8d0be] bg-white px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
                >
                  {action.label}
                </a>
              ),
            )}
          </div>
          <p className="mt-3 text-xs text-[#8b8171]">
            Publish, Commit & Push stays disabled until release automation is implemented with confirmation safeguards.
          </p>
        </Card>
      </div>
    </AdminScaffold>
  );
}
