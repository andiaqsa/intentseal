import { describe, expect, it, vi } from "vitest";

import { goldenFiles, goldenIntent } from "./fixtures/golden";
import { GitHubClient, GitHubClientError } from "./github";
import { getEvidenceTimeoutMs, handleEvidenceAnalysis } from "./route";

const repository = {
  owner: "demo",
  repo: "rate-limit-app",
  repository: "demo/rate-limit-app",
  commit: "a".repeat(40),
  commitUrl: `https://github.com/demo/rate-limit-app/commit/${"a".repeat(40)}`,
  files: goldenFiles,
};

const body = {
  ...goldenIntent,
  repositoryUrl: "https://github.com/demo/rate-limit-app",
  ref: "main",
};

function request(value: unknown): Request {
  return new Request("http://localhost/api/evidence/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

function github(value: unknown = repository): GitHubClient {
  return { resolveAndCollect: vi.fn().mockResolvedValue(value) } as unknown as GitHubClient;
}

describe("POST /api/evidence/analyze", () => {
  it("uses an evidence-specific bounded timeout", () => {
    expect(getEvidenceTimeoutMs({})).toBe(30_000);
    expect(getEvidenceTimeoutMs({ EVIDENCE_TIMEOUT_MS: "20000" })).toBe(20_000);
    expect(getEvidenceTimeoutMs({ EVIDENCE_TIMEOUT_MS: "60000" })).toBe(60_000);
    expect(getEvidenceTimeoutMs({ EVIDENCE_TIMEOUT_MS: "70000" })).toBe(30_000);
  });

  it("produces a deterministic draft locked to the exact commit with no AI configuration", async () => {
    const fakeGitHub = github();
    const response = await handleEvidenceAnalysis(request(body), {
      github: fakeGitHub,
      timeoutMs: 1_000,
      now: () => new Date("2026-01-02T03:04:05.000Z"),
    });
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.outcomeDraft.evaluations).toHaveLength(3);
    expect(result.outcomeDraft.source.commit).toBe(repository.commit);
    expect(result.analyzedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(fakeGitHub.resolveAndCollect).toHaveBeenCalledWith(
      body.repositoryUrl, "main", expect.any(Function), expect.any(AbortSignal),
    );
  });

  it("rejects malformed input without contacting GitHub", async () => {
    const fakeGitHub = github();
    const response = await handleEvidenceAnalysis(request({ ...body, intentId: "0" }), { github: fakeGitHub });
    expect(response.status).toBe(400);
    expect(fakeGitHub.resolveAndCollect).not.toHaveBeenCalled();
  });

  it.each([
    ["GITHUB_NOT_FOUND", 404], ["GITHUB_RATE_LIMIT", 429], ["GITHUB_REF_NOT_FOUND", 404],
    ["GITHUB_REPOSITORY_TOO_LARGE", 413], ["GITHUB_NO_TEXT_EVIDENCE", 422], ["GITHUB_UNAVAILABLE", 502],
  ] as const)("maps %s safely", async (code, status) => {
    const fakeGitHub = {
      resolveAndCollect: vi.fn().mockRejectedValue(new GitHubClientError(code)),
    } as unknown as GitHubClient;
    const response = await handleEvidenceAnalysis(request(body), { github: fakeGitHub, timeoutMs: 1_000 });
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("token");
  });

  it("aborts a stalled pipeline at the route deadline", async () => {
    let signal: AbortSignal | undefined;
    const stalled = {
      resolveAndCollect: vi.fn().mockImplementation((_url, _ref, _select, capturedSignal) => {
        signal = capturedSignal;
        return new Promise(() => undefined);
      }),
    } as unknown as GitHubClient;
    const response = await handleEvidenceAnalysis(request(body), {
      github: stalled,
      timeoutMs: 5,
    });
    expect(response.status).toBe(504);
    expect(signal?.aborted).toBe(true);
    expect(await response.json()).toEqual({
      error: {
        code: "EVIDENCE_TIMEOUT",
        message: "Repository evidence analysis timed out. Your intent is unchanged. Try again.",
      },
    });
  });
});
