"use client";

import { useEffect, useState } from "react";

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
};

function statusColor(status: Status): string {
  if (status === "green") return "#22c55e";
  if (status === "yellow") return "#f59e0b";
  return "#ef4444";
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

export default function PipelineDebugPage() {
  const [health, setHealth] = useState<PipelineHealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/debug/pipeline-health", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as PipelineHealthPayload;
        if (!cancelled) setHealth(payload);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <main style={{ padding: 24, fontFamily: "system-ui" }}>Unable to load pipeline health: {error}</main>;
  }
  if (!health) {
    return <main style={{ padding: 24, fontFamily: "system-ui" }}>Loading pipeline health…</main>;
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>Pipeline Health</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <span
          style={{
            background: statusColor(health.overallStatus),
            color: "#111",
            borderRadius: 999,
            padding: "4px 10px",
            fontWeight: 700,
          }}
        >
          {health.overallStatus.toUpperCase()}
        </span>
        <span>Generated: {fmt(health.generatedAt)}</span>
      </div>

      <h2>Sources</h2>
      <ul>
        {Object.entries(health.sources).map(([name, source]) => (
          <li key={name} style={{ marginBottom: 8 }}>
            <strong>{name}</strong>{" "}
            <span style={{ color: statusColor(source.status), fontWeight: 700 }}>{source.status}</span> · enabled:{" "}
            {String(source.enabled)} · freshness: {source.freshnessMinutes ?? "—"}m · signals: {source.signalCount}
          </li>
        ))}
      </ul>

      <h2>Jobs</h2>
      <ul>
        {Object.entries(health.jobs).map(([name, job]) => (
          <li key={name} style={{ marginBottom: 8 }}>
            <strong>{name}</strong>{" "}
            <span style={{ color: statusColor(job.status), fontWeight: 700 }}>{job.status}</span> · last run:{" "}
            {fmt(job.lastRunAt)} · last success: {fmt(job.lastSuccessAt)}
          </li>
        ))}
      </ul>
    </main>
  );
}
