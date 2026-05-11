import { clusterKeyForEntity } from "@/lib/signals/normalizeEntity";
import type { SignalSource, TrendSignal } from "@/lib/signals/types";

export type AggregatedEntitySignal = {
  entity: string;
  normalizedEntity: string;
  score: number;
  sourceDiversity: number;
  mentionCount: number;
  restaurants: string[];
  neighborhoods: string[];
  sources: SignalSource[];
  supportingSignals: TrendSignal[];
  metrics: {
    sourceDiversityScore: number;
    recencyScore: number;
    velocityScore: number;
    repetitionScore: number;
    restaurantDiversityScore: number;
    neighborhoodSpreadScore: number;
  };
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function parseIso(ts: string): number | null {
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : null;
}

function recencyWeight(signal: TrendSignal, nowMs: number): number {
  const ts = parseIso(signal.timestamp);
  if (ts == null) return 0.65;
  const ageDays = Math.max(0, (nowMs - ts) / 86_400_000);
  return clamp(Math.exp(-ageDays / 12), 0.2, 1);
}

function collectTextList(signal: TrendSignal, key: string): string[] {
  const metadata = signal.metadata ?? {};
  const value = metadata[key];
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
}

const SOURCE_BASE_WEIGHTS: Record<SignalSource, number> = {
  reddit: 0.2,
  google_places: 0.24,
  eater: 0.25,
  infatuation: 0.22,
  latimes: 0.3,
  resy_la: 0.2,
  timeout_la: 0.2,
  bonappetit: 0.19,
  manual_editorial: 0.18,
  reservation: 0.2,
  instagram_reference: 0.1,
};

function sourceWeightForSignal(signal: TrendSignal): number {
  const fromMeta = signal.metadata?.sourceWeight;
  const metaWeight = typeof fromMeta === "number" && Number.isFinite(fromMeta) ? fromMeta : null;
  const baseWeight = metaWeight ?? SOURCE_BASE_WEIGHTS[signal.source] ?? 0.18;
  const confidence = clamp(signal.confidence, 0.05, 1);
  const aboutToHitBoost = signal.metadata?.aboutToHit ? 1.12 : 1;
  return clamp(baseWeight * confidence * aboutToHitBoost, 0.02, 1);
}

function scoreAggregatedSignals(
  mentionCount: number,
  sources: Set<SignalSource>,
  weightedSourceDiversity: number,
  weightedMentions: number,
  restaurantCount: number,
  neighborhoodCount: number,
  avgVelocity: number,
  avgRecency: number,
): AggregatedEntitySignal["metrics"] & { total: number } {
  const sourceDiversityScore = clamp((weightedSourceDiversity / 1.5) * 34, 0, 34);
  const recencyScore = clamp(avgRecency * 16, 0, 16);
  const velocityScore = clamp(avgVelocity * 14, 0, 14);
  const repetitionScore = clamp(Math.log1p(mentionCount + weightedMentions * 2.8) * 9, 0, 12);
  const restaurantDiversityScore = clamp(Math.log1p(restaurantCount) * 8, 0, 12);
  const neighborhoodSpreadScore = clamp(Math.log1p(neighborhoodCount) * 8, 0, 12);
  const total = clamp(
    sourceDiversityScore +
      recencyScore +
      velocityScore +
      repetitionScore +
      restaurantDiversityScore +
      neighborhoodSpreadScore,
  );

  return {
    sourceDiversityScore,
    recencyScore,
    velocityScore,
    repetitionScore,
    restaurantDiversityScore,
    neighborhoodSpreadScore,
    total,
  };
}

export function aggregateSignals(
  signals: TrendSignal[],
  opts?: { nowIso?: string },
): AggregatedEntitySignal[] {
  const nowMs = parseIso(opts?.nowIso ?? "") ?? Date.now();
  const grouped = new Map<string, TrendSignal[]>();

  for (const signal of signals) {
    const key = clusterKeyForEntity(signal.entity);
    if (!key) continue;
    const arr = grouped.get(key) ?? [];
    arr.push(signal);
    grouped.set(key, arr);
  }

  const out: AggregatedEntitySignal[] = [];
  for (const [normalizedEntity, group] of grouped.entries()) {
    const sourceSet = new Set<SignalSource>();
    const sourceWeightByType = new Map<SignalSource, number>();
    const restaurants = new Set<string>();
    const neighborhoods = new Set<string>();
    let recencyTotal = 0;
    let velocityTotal = 0;
    let weightedMentionTotal = 0;
    let weightTotal = 0;

    for (const signal of group) {
      const signalWeight = sourceWeightForSignal(signal);
      sourceSet.add(signal.source);
      const previousSourceWeight = sourceWeightByType.get(signal.source) ?? 0;
      if (signalWeight > previousSourceWeight) sourceWeightByType.set(signal.source, signalWeight);
      recencyTotal += recencyWeight(signal, nowMs);
      velocityTotal += clamp(signal.velocity ?? 0, 0, 1.5) * signalWeight;
      weightedMentionTotal += signalWeight;
      weightTotal += signalWeight;
      for (const name of collectTextList(signal, "restaurant")) restaurants.add(name);
      for (const name of collectTextList(signal, "restaurants")) restaurants.add(name);
      for (const name of collectTextList(signal, "neighborhood")) neighborhoods.add(name);
      for (const name of collectTextList(signal, "neighborhoods")) neighborhoods.add(name);
    }
    const weightedSourceDiversity = [...sourceWeightByType.values()].reduce((sum, v) => sum + v, 0);

    const metrics = scoreAggregatedSignals(
      group.length,
      sourceSet,
      weightedSourceDiversity,
      weightedMentionTotal,
      restaurants.size,
      neighborhoods.size,
      weightTotal > 0 ? velocityTotal / weightTotal : 0,
      group.length > 0 ? recencyTotal / group.length : 0,
    );
    out.push({
      entity: group[0]?.entity ?? normalizedEntity,
      normalizedEntity,
      score: metrics.total,
      sourceDiversity: sourceSet.size,
      mentionCount: group.length,
      restaurants: [...restaurants],
      neighborhoods: [...neighborhoods],
      sources: [...sourceSet],
      supportingSignals: group,
      metrics: {
        sourceDiversityScore: metrics.sourceDiversityScore,
        recencyScore: metrics.recencyScore,
        velocityScore: metrics.velocityScore,
        repetitionScore: metrics.repetitionScore,
        restaurantDiversityScore: metrics.restaurantDiversityScore,
        neighborhoodSpreadScore: metrics.neighborhoodSpreadScore,
      },
    });
  }

  return out.sort((a, b) => b.score - a.score || b.sourceDiversity - a.sourceDiversity);
}
