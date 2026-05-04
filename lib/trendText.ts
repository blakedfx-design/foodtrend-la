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
