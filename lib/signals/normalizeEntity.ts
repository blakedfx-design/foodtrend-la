const NON_WORD_RE = /[^a-z0-9\s]/g;
const MULTI_SPACE_RE = /\s+/g;

const TOKEN_REPLACEMENTS: Record<string, string> = {
  "&": "and",
};

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bsingapore(?:an)?\s+chicken\s+rice\b/g, "hainan chicken rice"],
  [/\bhainanese\s+chicken\s+rice\b/g, "hainan chicken rice"],
  [/\bhainan\s+chicken\s+rice\b/g, "hainan chicken rice"],
  [/\bhainan\s+chicken\b/g, "hainan chicken rice"],
  [/\bssam\s+bar\s+snacks?\b/g, "korean ssam"],
  [/\bsonoran(?:-style)?\s+breakfast\s+burritos?\b/g, "sonoran breakfast burrito"],
  [/\bube\s+basque\s+cheesecake(?:\s+slices?)?\b/g, "ube cheesecake"],
];

function singularizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ss")) return token;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function applyTokenRules(value: string): string {
  const cleaned = value
    .split("")
    .map((ch) => TOKEN_REPLACEMENTS[ch] ?? ch)
    .join("");
  return cleaned
    .toLowerCase()
    .replace(NON_WORD_RE, " ")
    .replace(MULTI_SPACE_RE, " ")
    .trim();
}

function applyPhraseRules(value: string): string {
  let out = value;
  for (const [matcher, replacement] of PHRASE_REPLACEMENTS) {
    out = out.replace(matcher, replacement);
  }
  return out;
}

export function normalizeEntity(raw: string): string {
  const tokenReady = applyTokenRules(raw);
  const phraseReady = applyPhraseRules(tokenReady);
  const singularized = phraseReady
    .split(" ")
    .map((t) => singularizeToken(t))
    .filter(Boolean)
    .join(" ");
  return singularized;
}

export function clusterKeyForEntity(raw: string): string {
  return normalizeEntity(raw);
}
