import { describe, expect, it, vi } from "vitest";

import {
  GITHUB_LIMITS,
  GitHubClient,
  GitHubClientError,
  isExcludedPath,
  normalizeGitHubRepository,
} from "./github";

function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(value, { status, headers });
}

describe("GitHub client", () => {
  it("normalizes only public github.com repository URLs", () => {
    expect(normalizeGitHubRepository("https://github.com/Owner/repo.git")).toEqual({
      owner: "Owner",
      repo: "repo",
      repository: "Owner/repo",
    });
    for (const value of ["http://github.com/a/b", "https://evil.example/a/b", "https://github.com/a/b/tree/main", "not-a-url"]) {
      expect(() => normalizeGitHubRepository(value)).toThrow(GitHubClientError);
    }
  });

  it("resolves the default branch to an exact SHA, reads the tree, and skips large/binary/excluded files", async () => {
    const sha = "a".repeat(40);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ default_branch: "main", private: false }))
      .mockResolvedValueOnce(json({ sha }))
      .mockResolvedValueOnce(json({ tree: [
        { path: "src/login.ts", type: "blob", size: 30 },
        { path: "dist/bundle.js", type: "blob", size: 30 },
        { path: "image.png", type: "blob", size: 30 },
        { path: "src/huge.ts", type: "blob", size: GITHUB_LIMITS.maxFileBytes + 1 },
      ] }))
      .mockResolvedValueOnce(json({ type: "file", size: 18, encoding: "base64", content: Buffer.from("return status(429)").toString("base64") }));
    const client = new GitHubClient(undefined, fetcher as unknown as typeof fetch);
    const result = await client.resolveAndCollect("https://github.com/demo/app", undefined, (paths) => paths);

    expect(result.commit).toBe(sha);
    expect(result.commitUrl).toBe(`https://github.com/demo/app/commit/${sha}`);
    expect(result.files).toEqual([{ path: "src/login.ts", content: "return status(429)" }]);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("/commits/main");
    expect(String(fetcher.mock.calls[2]?.[0])).toContain(`/git/trees/${sha}?recursive=1`);
  });

  it("resolves an explicit ref and handles not found, rate limits, and network failure", async () => {
    const sha = "b".repeat(40);
    const explicitFetcher = vi.fn()
      .mockResolvedValueOnce(json({ default_branch: "main", private: false }))
      .mockResolvedValueOnce(json({ sha }))
      .mockResolvedValueOnce(json({ tree: [{ path: "README.md", type: "blob", size: 4 }] }))
      .mockResolvedValueOnce(json({ type: "file", size: 4, encoding: "base64", content: Buffer.from("docs").toString("base64") }));
    const explicit = new GitHubClient(undefined, explicitFetcher as unknown as typeof fetch);
    expect((await explicit.resolveAndCollect("https://github.com/a/b", "release/v1", (paths) => paths)).commit).toBe(sha);
    expect(String(explicitFetcher.mock.calls[1]?.[0])).toContain("/commits/release%2Fv1");

    const notFound = new GitHubClient(undefined, vi.fn().mockResolvedValue(json({}, 404)) as unknown as typeof fetch);
    await expect(notFound.resolveAndCollect("https://github.com/a/b", "release", (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_NOT_FOUND" });

    const limited = new GitHubClient(undefined, vi.fn().mockResolvedValue(json({}, 403, { "x-ratelimit-remaining": "0" })) as unknown as typeof fetch);
    await expect(limited.resolveAndCollect("https://github.com/a/b", undefined, (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_RATE_LIMIT" });

    const limited429 = new GitHubClient(undefined, vi.fn().mockResolvedValue(json({}, 429)) as unknown as typeof fetch);
    await expect(limited429.resolveAndCollect("https://github.com/a/b", undefined, (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_RATE_LIMIT" });

    const offline = new GitHubClient(undefined, vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch);
    await expect(offline.resolveAndCollect("https://github.com/a/b", undefined, (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_UNAVAILABLE" });
  });

  it("recognizes excluded dependency and build directories", () => {
    expect(isExcludedPath("node_modules/pkg/index.js")).toBe(true);
    expect(isExcludedPath("vendor/pkg/file.go")).toBe(true);
    expect(isExcludedPath("src/index.ts")).toBe(false);
  });

  it("rejects private, empty, oversized, and binary-only repositories", async () => {
    const privateRepo = new GitHubClient(undefined, vi.fn().mockResolvedValue(json({ default_branch: "main", private: true })) as unknown as typeof fetch);
    await expect(privateRepo.resolveAndCollect("https://github.com/a/b", undefined, (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_PRIVATE_REPOSITORY" });

    const emptyFetcher = vi.fn()
      .mockResolvedValueOnce(json({ default_branch: "main", private: false }))
      .mockResolvedValueOnce(json({ sha: "c".repeat(40) }))
      .mockResolvedValueOnce(json({ tree: [] }));
    await expect(new GitHubClient(undefined, emptyFetcher as unknown as typeof fetch).resolveAndCollect("https://github.com/a/b", undefined, (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_EMPTY_REPOSITORY" });

    const oversizedFetcher = vi.fn()
      .mockResolvedValueOnce(json({ default_branch: "main", private: false }))
      .mockResolvedValueOnce(json({ sha: "d".repeat(40) }))
      .mockResolvedValueOnce(json({ tree: [], truncated: true }));
    await expect(new GitHubClient(undefined, oversizedFetcher as unknown as typeof fetch).resolveAndCollect("https://github.com/a/b", undefined, (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_REPOSITORY_TOO_LARGE" });

    const binaryFetcher = vi.fn()
      .mockResolvedValueOnce(json({ default_branch: "main", private: false }))
      .mockResolvedValueOnce(json({ sha: "e".repeat(40) }))
      .mockResolvedValueOnce(json({ tree: [{ path: "image.png", type: "blob", size: 4 }] }));
    await expect(new GitHubClient(undefined, binaryFetcher as unknown as typeof fetch).resolveAndCollect("https://github.com/a/b", undefined, (paths) => paths)).rejects.toMatchObject({ code: "GITHUB_NO_TEXT_EVIDENCE" });
  });
});
