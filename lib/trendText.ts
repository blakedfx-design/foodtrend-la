/** Split prose into sentence chunks (period + space). */
export function splitWhy(text: string, max = 3): string[] {
  const t = text.trim();
  if (!t) return ["—"];
  const chunks = t
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : `${s}.`));
  return chunks.slice(0, max).length ? chunks.slice(0, max) : [t];
}

const MAX_WORDS_PER_LINE = 12;

function scrubLeadingNoise(s: string): string {
  return s
    .trim()
    .replace(/^[\-\u2022•*\s]+/, "")
    .replace(/^why\s+it's\s+hitting\s*[—:-]\s*/i, "")
    .replace(/^why\s+it's\s+everywhere\s*[—:-]\s*/i, "")
    .replace(/^why\s+it\s+works\s*[—:-]\s*/i, "")
    .trim();
}

/** Short clause for card UI — observation-first: strip filler, word cap. */
export function compactWhyLine(line: string): string {
  let s = scrubLeadingNoise(line).replace(/\.+$/, "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  s = s.replace(/\b(sort of|kind of)\s+/gi, "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  s = s.charAt(0).toUpperCase() + s.slice(1);
  const words = s.split(/\s+/);
  if (words.length > MAX_WORDS_PER_LINE) {
    return `${words.slice(0, MAX_WORDS_PER_LINE).join(" ")}…`;
  }
  return s;
}

function flattenLongEmDashChunks(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const cleaned = scrubLeadingNoise(line).replace(/\.+$/, "").trim();
    if (cleaned.length > 72 && /\s[—–]\s/.test(cleaned)) {
      const parts = cleaned.split(/\s*[—–]\s+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        out.push(...parts);
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

function roughlyDuplicates(existing: string, candidate: string): boolean {
  const c = candidate.toLowerCase().replace(/\s+/g, " ").trim();
  if (c.length < 14) return false;
  const prefix = c.slice(0, 22);
  return existing.toLowerCase().includes(prefix);
}

/**
 * Max 3 punchy, standalone lines for the editorial card ("Why it's hitting").
 * Prefers newline-authored bullets in source text; otherwise splits sentences and compacts.
 */
export function whyLinesForEditorialCard(
  whyItsEverywhere: string,
  whyItWorks?: string | undefined,
  maxLines = 3,
): string[] {
  const raw = whyItsEverywhere.trim();
  if (!raw) return ["—"];

  const authoredMultiline = /\r?\n/.test(raw);
  let lines: string[];

  if (authoredMultiline) {
    lines = raw
      .split(/\r?\n/)
      .map((l) => compactWhyLine(l))
      .filter(Boolean);
  } else {
    let chunks = splitWhy(raw, maxLines * 3).map((c) => scrubLeadingNoise(c));
    chunks = flattenLongEmDashChunks(chunks);

    lines = chunks.map((c) => compactWhyLine(c)).filter(Boolean);

    const works = scrubLeadingNoise(String(whyItWorks ?? "").trim());
    if (works) {
      const compactWorks = compactWhyLine(works);
      if (
        compactWorks &&
        !lines.some((ln) => roughlyDuplicates(ln, compactWorks) || roughlyDuplicates(compactWorks, ln))
      ) {
        lines.push(compactWorks);
      }
    }

    lines = lines.map((l) => compactWhyLine(l)).filter(Boolean);
  }

  const capped = lines.slice(0, maxLines);
  return capped.length ? capped : ["—"];
}
