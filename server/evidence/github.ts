export const GITHUB_LIMITS = Object.freeze({
  maxTreeEntries: 5_000,
  maxCandidateFiles: 20,
  maxFileBytes: 100_000,
  maxTotalTextBytes: 120_000,
  requestTimeoutMs: 10_000,
});

const excludedSegments = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  ".next",
]);
const binaryExtensions = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|woff2?|ttf|eot|mp[34]|mov|avi|exe|dll|so|dylib|wasm)$/i;

export type GitHubErrorCode =
  | "INVALID_GITHUB_URL"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_PRIVATE_REPOSITORY"
  | "GITHUB_RATE_LIMIT"
  | "GITHUB_REF_NOT_FOUND"
  | "GITHUB_EMPTY_REPOSITORY"
  | "GITHUB_REPOSITORY_TOO_LARGE"
  | "GITHUB_NO_TEXT_EVIDENCE"
  | "GITHUB_TIMEOUT"
  | "GITHUB_UNAVAILABLE";

export class GitHubClientError extends Error {
  constructor(readonly code: GitHubErrorCode) {
    super(code);
    this.name = "GitHubClientError";
  }
}

export interface GitHubRepositoryIdentity {
  owner: string;
  repo: string;
  repository: string;
}

interface GitHubRepositoryResponse {
  default_branch?: unknown;
  private?: unknown;
}

interface GitHubCommitResponse {
  sha?: unknown;
}

interface GitHubTreeEntry {
  path?: unknown;
  type?: unknown;
  size?: unknown;
}

interface GitHubTreeResponse {
  tree?: unknown;
  truncated?: unknown;
}

interface GitHubContentResponse {
  type?: unknown;
  size?: unknown;
  encoding?: unknown;
  content?: unknown;
}

export interface GitHubTextFile {
  path: string;
  content: string;
}

export interface ResolvedGitHubRepository extends GitHubRepositoryIdentity {
  commit: string;
  commitUrl: string;
  files: GitHubTextFile[];
}

export function normalizeGitHubRepository(value: string): GitHubRepositoryIdentity {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new GitHubClientError("INVALID_GITHUB_URL");
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new GitHubClientError("INVALID_GITHUB_URL");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || url.search || url.hash) {
    throw new GitHubClientError("INVALID_GITHUB_URL");
  }
  const owner = segments[0]!;
  const repo = segments[1]!.replace(/\.git$/i, "");
  if (!isGitHubName(owner) || !isGitHubName(repo)) {
    throw new GitHubClientError("INVALID_GITHUB_URL");
  }
  return { owner, repo, repository: `${owner}/${repo}` };
}

function isGitHubName(value: string): boolean {
  return /^[A-Za-z0-9_.-]{1,100}$/.test(value) && value !== "." && value !== "..";
}

export class GitHubClient {
  constructor(
    private readonly token = process.env.GITHUB_TOKEN?.trim(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async resolveAndCollect(
    repositoryUrl: string,
    requestedRef: string | undefined,
    selectPaths: (paths: string[]) => string[],
    signal?: AbortSignal,
  ): Promise<ResolvedGitHubRepository> {
    const identity = normalizeGitHubRepository(repositoryUrl);
    const metadata = await this.get<GitHubRepositoryResponse>(
      `/repos/${identity.owner}/${identity.repo}`,
      "GITHUB_NOT_FOUND",
      signal,
    );
    if (metadata.private === true) throw new GitHubClientError("GITHUB_PRIVATE_REPOSITORY");
    const defaultBranch = typeof metadata.default_branch === "string" ? metadata.default_branch : null;
    const ref = requestedRef?.trim() || defaultBranch;
    if (!ref) throw new GitHubClientError("GITHUB_EMPTY_REPOSITORY");

    const commitResponse = await this.get<GitHubCommitResponse>(
      `/repos/${identity.owner}/${identity.repo}/commits/${encodeURIComponent(ref)}`,
      "GITHUB_REF_NOT_FOUND",
      signal,
    );
    const commit = typeof commitResponse.sha === "string" ? commitResponse.sha : "";
    if (!/^[0-9a-f]{40}$/i.test(commit)) throw new GitHubClientError("GITHUB_REF_NOT_FOUND");

    const tree = await this.get<GitHubTreeResponse>(
      `/repos/${identity.owner}/${identity.repo}/git/trees/${commit}?recursive=1`,
      "GITHUB_EMPTY_REPOSITORY",
      signal,
    );
    if (tree.truncated === true) throw new GitHubClientError("GITHUB_REPOSITORY_TOO_LARGE");
    if (!Array.isArray(tree.tree) || tree.tree.length === 0) {
      throw new GitHubClientError("GITHUB_EMPTY_REPOSITORY");
    }
    if (tree.tree.length > GITHUB_LIMITS.maxTreeEntries) {
      throw new GitHubClientError("GITHUB_REPOSITORY_TOO_LARGE");
    }

    const eligible = (tree.tree as GitHubTreeEntry[])
      .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
      .filter((entry) => !isExcludedPath(entry.path as string))
      .filter((entry) => !binaryExtensions.test(entry.path as string))
      .filter(
        (entry) =>
          typeof entry.size !== "number" || entry.size <= GITHUB_LIMITS.maxFileBytes,
      )
      .map((entry) => entry.path as string);
    const paths = selectPaths(eligible).slice(0, GITHUB_LIMITS.maxCandidateFiles);

    const files: GitHubTextFile[] = [];
    let totalBytes = 0;
    for (const path of paths) {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const value = await this.get<GitHubContentResponse>(
        `/repos/${identity.owner}/${identity.repo}/contents/${encodedPath}?ref=${commit}`,
        "GITHUB_UNAVAILABLE",
        signal,
      );
      if (
        value.type !== "file" ||
        value.encoding !== "base64" ||
        typeof value.content !== "string" ||
        (typeof value.size === "number" && value.size > GITHUB_LIMITS.maxFileBytes)
      ) {
        continue;
      }
      const bytes = Buffer.from(value.content.replace(/\s/g, ""), "base64");
      if (bytes.byteLength > GITHUB_LIMITS.maxFileBytes || bytes.includes(0)) continue;
      if (totalBytes + bytes.byteLength > GITHUB_LIMITS.maxTotalTextBytes) continue;
      const content = bytes.toString("utf8");
      if (content.includes("\uFFFD")) continue;
      files.push({ path, content });
      totalBytes += bytes.byteLength;
    }

    if (files.length === 0) throw new GitHubClientError("GITHUB_NO_TEXT_EVIDENCE");
    return {
      ...identity,
      commit,
      commitUrl: `https://github.com/${identity.owner}/${identity.repo}/commit/${commit}`,
      files,
    };
  }

  private async get<T>(
    path: string,
    notFoundCode: GitHubErrorCode,
    signal?: AbortSignal,
  ): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(GITHUB_LIMITS.requestTimeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    let response: Response;
    try {
      response = await this.fetcher(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "IntentSeal-Evidence-Engine",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        signal: combinedSignal,
      });
    } catch {
      if (combinedSignal.aborted) throw new GitHubClientError("GITHUB_TIMEOUT");
      throw new GitHubClientError("GITHUB_UNAVAILABLE");
    }

    if (response.status === 404) throw new GitHubClientError(notFoundCode);
    if (
      response.status === 429 ||
      (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")
    ) {
      throw new GitHubClientError("GITHUB_RATE_LIMIT");
    }
    if (!response.ok) throw new GitHubClientError("GITHUB_UNAVAILABLE");
    return (await response.json()) as T;
  }
}

export function isExcludedPath(path: string): boolean {
  return path.split("/").some((segment) => excludedSegments.has(segment.toLowerCase()));
}
