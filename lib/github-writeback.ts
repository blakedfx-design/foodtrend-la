import {
  diffTrendSnapshots,
  snapshotFromParsed,
  type TrendsAuditDelta,
  type TrendsAuditSnapshot,
} from "@/lib/pipelineAudit";

const TRENDS_PATH = "data/la-food-trends.json";

function requireGitHubConfig(): {
  token: string;
  owner: string;
  repo: string;
  branch: string;
} {
  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const branch = process.env.GITHUB_BRANCH?.trim();
  if (!token || !owner || !repo || !branch) {
    throw new Error(
      "Missing GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, or GITHUB_BRANCH",
    );
  }
  return { token, owner, repo, branch };
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

type ContentsGetResponse = {
  content?: string;
  encoding?: string;
  sha?: string;
};

/** Fetch `data/la-food-trends.json` from GitHub Contents API (UTF-8 + blob sha). */
export async function fetchTrendsJsonFromGitHub(): Promise<{
  text: string;
  sha: string;
}> {
  const { token, owner, repo, branch } = requireGitHubConfig();
  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/contents/${TRENDS_PATH}`,
  );
  url.searchParams.set("ref", branch);

  const res = await fetch(url.toString(), {
    headers: githubHeaders(token),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET ${TRENDS_PATH} failed ${res.status}: ${body}`);
  }

  const data = (await res.json()) as ContentsGetResponse;
  const sha = data.sha?.trim();
  if (!sha) {
    throw new Error("GitHub response missing file sha");
  }
  const b64 = data.content?.replace(/\n/g, "") ?? "";
  const text = Buffer.from(b64, "base64").toString("utf8");
  return { text, sha };
}

/** Commit updated JSON via GitHub Contents API (requires current blob sha). */
export async function commitTrendsJsonToGitHub(opts: {
  text: string;
  sha: string;
  message: string;
}): Promise<{ commitSha: string | null }> {
  const { token, owner, repo, branch } = requireGitHubConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${TRENDS_PATH}`;

  const content = Buffer.from(opts.text, "utf8").toString("base64");

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: opts.message,
      content,
      sha: opts.sha,
      branch,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub PUT ${TRENDS_PATH} failed ${res.status}: ${body}`);
  }

  const body = (await res.json()) as { commit?: { sha?: string } };
  const commitSha = body.commit?.sha?.trim() ?? null;
  return { commitSha };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Weekly: adjust score by -2 .. +4 (inclusive). */
function jitterWeeklySignal(score: number): number {
  const delta = Math.floor(Math.random() * 7) - 2;
  return clampScore(score + delta);
}

/** Weekend: adjust score by -1 .. +2 (inclusive). */
function jitterWeekendSignal(score: number): number {
  const delta = Math.floor(Math.random() * 4) - 1;
  return clampScore(score + delta);
}

function readNumericScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mutateTrendSignalScores(
  parsed: Record<string, unknown>,
  keys: readonly ["trends", "aboutToHit"],
  now: string,
  jitter: (score: number) => number,
): void {
  for (const arrKey of keys) {
    const arr = parsed[arrKey];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const el of arr) {
      if (!isRecord(el)) {
        continue;
      }
      const current = readNumericScore(el.signalScore);
      if (current != null) {
        el.signalScore = jitter(current);
      }
      el.lastUpdated = now;
    }
  }
}

/**
 * Weekly: `lastUpdated`, `refreshType`, strip `weekendNote`, light score drift (-2..+4).
 * Does not alter editorial strings, names, restaurants, or menu fields.
 */
export function applyWeeklyRefreshToParsed(parsed: Record<string, unknown>): void {
  const now = new Date().toISOString();
  parsed.lastUpdated = now;
  parsed.refreshType = "weekly";
  delete parsed.weekendNote;
  mutateTrendSignalScores(parsed, ["trends", "aboutToHit"], now, jitterWeeklySignal);
}

/**
 * Weekend: `lastUpdated`, `refreshType`, score drift (-1..+2) only on trend rows.
 */
export function applyWeekendRefreshToParsed(parsed: Record<string, unknown>): void {
  const now = new Date().toISOString();
  parsed.lastUpdated = now;
  parsed.refreshType = "weekend";
  mutateTrendSignalScores(parsed, ["trends", "aboutToHit"], now, jitterWeekendSignal);
}

export type TrendsJsonWriteBackResult = {
  updatedAt: string;
  commitSha: string | null;
  wroteJson: boolean;
  before: TrendsAuditSnapshot;
  after: TrendsAuditSnapshot;
  changed: TrendsAuditDelta;
};

/**
 * Loads `data/la-food-trends.json` from GitHub, decodes it, runs `updater` on the
 * parsed object, commits the result using the previous file sha. No filesystem IO.
 */
export async function writeBackLaFoodTrendsJson(
  updater: (parsed: Record<string, unknown>) => void | Promise<void>,
  commitMessage: string,
): Promise<TrendsJsonWriteBackResult> {
  const { text, sha } = await fetchTrendsJsonFromGitHub();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("la-food-trends.json is not valid JSON");
  }
  if (!isRecord(parsed)) {
    throw new Error("la-food-trends.json root must be an object");
  }

  const before = snapshotFromParsed(parsed);
  await Promise.resolve(updater(parsed));
  const after = snapshotFromParsed(parsed);
  const changed = diffTrendSnapshots(before, after);
  const newText = `${JSON.stringify(parsed, null, 2)}\n`;
  const updatedAt =
    typeof parsed.lastUpdated === "string"
      ? parsed.lastUpdated
      : new Date().toISOString();

  const wroteJson = newText !== text;
  if (!wroteJson) {
    return { updatedAt, commitSha: null, wroteJson, before, after, changed };
  }

  const { commitSha } = await commitTrendsJsonToGitHub({
    text: newText,
    sha,
    message: commitMessage,
  });

  return { updatedAt, commitSha, wroteJson, before, after, changed };
}

export type GitHubWriteBackResult = TrendsJsonWriteBackResult;
