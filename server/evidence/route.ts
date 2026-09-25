import type { EvidenceAnalysisResult, EvidenceProviderInput, OutcomeDraft } from "../../shared/evidence";
import { evaluateEvidenceDeterministically } from "./evaluator";
import { GitHubClient, GitHubClientError } from "./github";
import { evidenceAnalysisRequestSchema } from "./schema";
import { extractEvidenceSnippets, selectCandidatePaths } from "./selection";

interface EvidenceRouteDependencies {
  github?: GitHubClient;
  evaluator?: (input: EvidenceProviderInput, source: OutcomeDraft["source"]) => OutcomeDraft;
  timeoutMs?: number;
  now?: () => Date;
}

class EvidenceAnalysisTimeoutError extends Error {
  constructor() {
    super("EVIDENCE_ANALYSIS_TIMEOUT");
    this.name = "EvidenceAnalysisTimeoutError";
  }
}

const DEFAULT_EVIDENCE_TIMEOUT_MS = 30_000;
const MIN_EVIDENCE_TIMEOUT_MS = 5_000;
const MAX_EVIDENCE_TIMEOUT_MS = 60_000;

export function getEvidenceTimeoutMs(
  environment: Record<string, string | undefined> = process.env,
): number {
  const configured = Number(environment.EVIDENCE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= MIN_EVIDENCE_TIMEOUT_MS && configured <= MAX_EVIDENCE_TIMEOUT_MS
    ? configured
    : DEFAULT_EVIDENCE_TIMEOUT_MS;
}

export async function handleEvidenceAnalysis(
  request: Request,
  dependencies: EvidenceRouteDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST to analyze repository evidence.", { Allow: "POST" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Send a valid JSON request body.");
  }
  const requestResult = evidenceAnalysisRequestSchema.safeParse(body);
  if (!requestResult.success) {
    return errorResponse(400, "INVALID_REQUEST", "Check the intent, GitHub URL, and ref.");
  }

  const controller = new AbortController();
  const timeoutMs = dependencies.timeoutMs ?? getEvidenceTimeoutMs();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new EvidenceAnalysisTimeoutError());
      }, timeoutMs);
    });
    const analysis = analyze(requestResult.data, dependencies, controller.signal);
    return jsonResponse(200, await Promise.race([analysis, timeout]));
  } catch (error) {
    if (error instanceof EvidenceAnalysisTimeoutError || controller.signal.aborted || isAbortOrTimeoutError(error)) {
      return errorResponse(
        504,
        "EVIDENCE_TIMEOUT",
        "Repository evidence analysis timed out. Your intent is unchanged. Try again.",
      );
    }
    if (error instanceof GitHubClientError) return githubErrorResponse(error.code);
    if (process.env.NODE_ENV !== "production") {
      console.error("[IntentSeal Evidence] Analysis failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }
    return errorResponse(500, "EVIDENCE_ANALYSIS_FAILED", "Repository evidence could not be analyzed.");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function analyze(
  request: ReturnType<typeof evidenceAnalysisRequestSchema.parse>,
  dependencies: EvidenceRouteDependencies,
  signal: AbortSignal,
): Promise<EvidenceAnalysisResult> {
  const github = dependencies.github ?? new GitHubClient();
  const repository = await github.resolveAndCollect(
    request.repositoryUrl,
    request.ref,
    (paths) => selectCandidatePaths(paths, request.criteria),
    signal,
  );
  const evidence = extractEvidenceSnippets(repository.files, request.criteria);
  if (evidence.length === 0) throw new GitHubClientError("GITHUB_NO_TEXT_EVIDENCE");
  throwIfAborted(signal);

  const source = {
    type: "github" as const,
    repository: repository.repository,
    commit: repository.commit,
    commitUrl: repository.commitUrl,
  };
  const evaluator = dependencies.evaluator ?? evaluateEvidenceDeterministically;
  const outcomeDraft = evaluator({
    intentId: request.intentId,
    title: request.title,
    goal: request.goal,
    criteria: request.criteria,
    repository: repository.repository,
    commit: repository.commit,
    evidence,
    signal,
  }, source);

  return {
    outcomeDraft,
    analyzedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    evidenceFileCount: new Set(evidence.map((item) => item.path)).size,
  };
}

function githubErrorResponse(code: GitHubClientError["code"]): Response {
  const responses: Record<GitHubClientError["code"], [number, string]> = {
    INVALID_GITHUB_URL: [400, "Enter a public GitHub repository URL."],
    GITHUB_NOT_FOUND: [404, "The GitHub repository was not found."],
    GITHUB_PRIVATE_REPOSITORY: [400, "Private repositories are not supported."],
    GITHUB_RATE_LIMIT: [429, "GitHub rate limit reached. Try again later."],
    GITHUB_REF_NOT_FOUND: [404, "The requested branch, ref, or commit was not found."],
    GITHUB_EMPTY_REPOSITORY: [422, "The repository is empty."],
    GITHUB_REPOSITORY_TOO_LARGE: [413, "The repository is too large for this analysis."],
    GITHUB_NO_TEXT_EVIDENCE: [422, "No suitable text evidence was found in the repository."],
    GITHUB_TIMEOUT: [504, "GitHub took too long to respond."],
    GITHUB_UNAVAILABLE: [502, "GitHub is currently unavailable."],
  };
  const [status, message] = responses[code];
  return errorResponse(status, code, message);
}

function isAbortOrTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Evidence analysis request was aborted.", "AbortError");
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>,
): Response {
  return jsonResponse(status, { error: { code, message } }, headers);
}
