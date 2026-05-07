function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickVariant(trendId: string, options: string[]): string {
  if (options.length === 0) return "Worth ordering once, at least.";
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
    return pickVariant(trendId, ["Before the mains land.", "Open with this."]);
  }
  if (L.includes("LUNCH")) {
    return pickVariant(trendId, ["Counter energy.", "Middle-of-the-day fuel."]);
  }
  if (L.includes("DINNER SNACK") || L.includes("SNACK")) {
    return pickVariant(trendId, ["Park this mid-table.", "Glass in one hand, bite in the other."]);
  }
  if (L.includes("APERITIVO")) {
    return pickVariant(trendId, ["Golden-hour pour.", "Sip before the reservation."]);
  }
  if (L.includes("BREAKFAST")) {
    return pickVariant(trendId, ["Morning rig, handheld.", "First-thing worthy."]);
  }
  if (L.includes("DESSERT")) {
    return pickVariant(trendId, ["Save stomach real estate.", "Sweet finish, zero shame."]);
  }

  return pickVariant(trendId, ["Order one for the table.", "Low-drama, high-reward."]);
}
