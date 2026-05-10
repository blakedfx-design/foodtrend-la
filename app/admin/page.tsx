import Link from "next/link";
import { AdminScaffold, Card, StatusPill } from "@/components/admin/AdminUi";
import { computeReadiness, fmtDateTime, loadAdminDataBundle } from "@/lib/admin/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const data = await loadAdminDataBundle();
  const readiness = computeReadiness(data.pipeline, data.editorial);
  const readinessTone = readiness.verdict === "Ready" ? "green" : readiness.verdict === "Caution" ? "yellow" : "red";
  const sourceCount = Object.keys(data.pipeline?.sources ?? {}).length;
  const jobCount = Object.keys(data.pipeline?.jobs ?? {}).length;

  return (
    <AdminScaffold
      navKey="overview"
      breadcrumb="ADMIN / OVERVIEW"
      title="Foodtrend LA Admin"
      subtitle="Central access point for editorial curation and analytics health."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Editorial Control Center" subtitle="Preview, curate, and prep this week's publish package.">
          <div className="space-y-2 text-sm text-[#4b5563]">
            <p>Review Top 5 trend cards, candidate queue, readiness checks, and preview actions.</p>
            <Link
              href="/admin/editorial"
              className="inline-flex rounded-lg border border-[#d8d0be] bg-white px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              Open Editorial Dashboard
            </Link>
          </div>
        </Card>

        <Card title="Analytics & Pipeline Health" subtitle="Data freshness, source health, jobs, and system diagnostics.">
          <div className="space-y-2 text-sm text-[#4b5563]">
            <p>Monitor ingestion quality, alerts, transitions, and runtime system status.</p>
            <Link
              href="/admin/analytics"
              className="inline-flex rounded-lg border border-[#d8d0be] bg-white px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              Open Analytics Dashboard
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Update Readiness">
          <div className="space-y-2">
            <StatusPill tone={readinessTone} label={readiness.verdict} />
            <p className="text-sm text-[#4b5563]">{readiness.reasons.join(" · ")}</p>
          </div>
        </Card>
        <Card title="Pipeline Snapshot">
          <div className="space-y-1 text-sm text-[#4b5563]">
            <p>
              Sources: <span className="font-semibold text-[#1f2937]">{sourceCount}</span>
            </p>
            <p>
              Jobs: <span className="font-semibold text-[#1f2937]">{jobCount}</span>
            </p>
            <p>
              Generated: <span className="font-semibold text-[#1f2937]">{fmtDateTime(data.pipeline?.generatedAt ?? null)}</span>
            </p>
          </div>
        </Card>
        <Card title="Report Preview">
          <div className="space-y-2 text-sm text-[#4b5563]">
            <p>Open the current public report draft for editorial QA.</p>
            <Link
              href="/la-food"
              className="inline-flex rounded-lg border border-[#d8d0be] bg-white px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              View Public Report Preview
            </Link>
          </div>
        </Card>
      </div>
    </AdminScaffold>
  );
}
