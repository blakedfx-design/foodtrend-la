function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickVariant(trendId: string, options: string[]): string {
  if (options.length === 0) return "Start here.";
  return options[hashString(trendId) % options.length];
}

/** One-line casual CTA for THE MOVE; deterministic per trend id. */
export function editorialMoveCopy(
  trendId: string,
  mealScanLabel: string | undefined,
  explicit?: string | undefined,
): string {
  if (explicit?.trim()) return explicit.trim();

  const L = (mealScanLabel ?? "").toUpperCase();

  if (L.includes("TABLE STARTER") || L.includes("STARTER")) {
    return pickVariant(trendId, ["Start here.", "Get this first."]);
  }
  if (L.includes("LUNCH")) {
    return pickVariant(trendId, ["Easy lunch.", "Go-to order."]);
  }
  if (L.includes("DINNER SNACK") || L.includes("SNACK")) {
    return pickVariant(trendId, ["Order with drinks.", "Share this."]);
  }
  if (L.includes("APERITIVO")) {
    return pickVariant(trendId, ["Pre-dinner move.", "Start the night here."]);
  }
  if (L.includes("BREAKFAST")) {
    return pickVariant(trendId, ["Morning go-to.", "Grab this early."]);
  }
  if (L.includes("DESSERT")) {
    return pickVariant(trendId, ["Save room.", "Sweet stop."]);
  }

  return pickVariant(trendId, ["Start here.", "Try this first."]);
}
