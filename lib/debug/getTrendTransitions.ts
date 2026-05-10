import fs from "node:fs/promises";
import path from "node:path";

const TREND_TRANSITIONS_FILE = path.join(process.cwd(), "data", "trend-transitions.json");

export type TrendTransitionRecord = {
  entity: string;
  fromState: string;
  toState: string;
  week: string | null;
  timestamp: string | null;
  confidence: number | null;
  sourceCount: number;
  sourceTypes: string[];
  transitionReason: string;
  stage: string | null;
  maturityState: string | null;
  maturityConfidence: number | null;
};

export type TrendTransitionSummary = {
  transitionsThisWeek: number;
  acceleratingCount: number;
  blockedCount: number;
  promotedToTop5Count: number;
  fadingCount: number;
};

export type TrendTransitionTimelinePayload = {
  generatedAt: string;
  summary: TrendTransitionSummary;
  transitions: TrendTransitionRecord[];
};

function asRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function sourceCountFromRow(row: Record<string, unknown>, sourceTypes: string[]): number {
  const explicit = row.sourceCount;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  if (sourceTypes.length > 0) return sourceTypes.length;
  const sourceMix = row.sourceMix;
  if (asRecord(sourceMix)) {
    return Object.values(sourceMix as Record<string, unknown>).reduce((sum: number, n: unknown) => {
      if (typeof n === "number" && Number.isFinite(n)) return sum + n;
      return sum;
    }, 0);
  }
  return 0;
}

function toTransitionRecord(row: Record<string, unknown>): TrendTransitionRecord | null {
  const entity = typeof row.entity === "string" ? row.entity : null;
  const fromState = typeof row.fromState === "string" ? row.fromState : null;
  const toState = typeof row.toState === "string" ? row.toState : null;
  if (!entity || !fromState || !toState) return null;

  const sourceTypes = asStringArray(row.sourceTypes);
  const supportTypes = asStringArray(row.supportTypes);
  const mergedSourceTypes = sourceTypes.length > 0 ? sourceTypes : supportTypes;

  const confidenceValue =
    typeof row.confidence === "number"
      ? row.confidence
      : typeof row.maturityConfidence === "number"
        ? row.maturityConfidence
        : null;

  return {
    entity,
    fromState,
    toState,
    week: typeof row.week === "string" ? row.week : null,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
    confidence: confidenceValue,
    sourceCount: sourceCountFromRow(row, mergedSourceTypes),
    sourceTypes: mergedSourceTypes,
    transitionReason:
      typeof row.transitionReason === "string"
        ? row.transitionReason
        : typeof row.reason === "string"
          ? row.reason
          : "transition detected",
    stage: typeof row.stage === "string" ? row.stage : null,
    maturityState: typeof row.maturityState === "string" ? row.maturityState : null,
    maturityConfidence: typeof row.maturityConfidence === "number" ? row.maturityConfidence : null,
  };
}

function compareTransitions(a: TrendTransitionRecord, b: TrendTransitionRecord): number {
  const ta = a.timestamp ? Date.parse(a.timestamp) : NaN;
  const tb = b.timestamp ? Date.parse(b.timestamp) : NaN;
  const taOk = Number.isFinite(ta);
  const tbOk = Number.isFinite(tb);
  if (taOk && tbOk) return tb - ta;
  if (taOk) return -1;
  if (tbOk) return 1;
  const wa = a.week ?? "";
  const wb = b.week ?? "";
  return wb.localeCompare(wa);
}

export async function getTrendTransitionTimelinePayload(): Promise<TrendTransitionTimelinePayload> {
  const generatedAt = new Date().toISOString();
  let transitions: TrendTransitionRecord[] = [];
  try {
    const raw = await fs.readFile(TREND_TRANSITIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      transitions = parsed
        .filter(asRecord)
        .map(toTransitionRecord)
        .filter((x): x is TrendTransitionRecord => x !== null)
        .sort(compareTransitions);
    }
  } catch {
    transitions = [];
  }

  const currentWeek = transitions.find((t) => t.week)?.week ?? null;
  const thisWeek = currentWeek ? transitions.filter((t) => t.week === currentWeek) : [];

  const summary: TrendTransitionSummary = {
    transitionsThisWeek: thisWeek.length,
    acceleratingCount: thisWeek.filter((t) => t.toState === "accelerating").length,
    blockedCount: thisWeek.filter((t) => t.toState === "blocked").length,
    promotedToTop5Count: thisWeek.filter(
      (t) =>
        (t.fromState === "about_to_hit" && t.toState === "top5") ||
        t.transitionReason.toLowerCase().includes("top 5"),
    ).length,
    fadingCount: thisWeek.filter((t) => t.toState === "fading").length,
  };

  return {
    generatedAt,
    summary,
    transitions,
  };
}
