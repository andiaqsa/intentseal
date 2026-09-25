import { describe, expect, it } from "vitest";

import { goldenFiles, goldenIntent } from "./fixtures/golden";
import { extractCriterionKeywords, extractEvidenceSnippets, selectCandidatePaths } from "./selection";

describe("evidence selection", () => {
  it("selects rate limiting, HTTP status, tests, configuration, and documentation deterministically", () => {
    const paths = [
      "docs/rate-limits.md",
      "src/routes/login.ts",
      "config/security.ts",
      "tests/login.spec.ts",
      "README.md",
      "assets/logo.png",
    ];
    const first = selectCandidatePaths(paths, goldenIntent.criteria);
    const second = selectCandidatePaths([...paths].reverse(), goldenIntent.criteria);
    expect(first).toEqual(second);
    expect(first).toEqual(expect.arrayContaining([
      "docs/rate-limits.md",
      "src/routes/login.ts",
      "tests/login.spec.ts",
      "README.md",
    ]));
  });

  it("expands generic criterion terms without overfitting one path", () => {
    const keywords = extractCriterionKeywords(goldenIntent.criteria);
    expect(keywords).toEqual(expect.arrayContaining(["ratelimit", "throttle", "status(429", "spec"]));
  });

  it("extracts concise snippets with real line ranges", () => {
    const evidence = extractEvidenceSnippets(goldenFiles, goldenIntent.criteria);
    expect(evidence.map((item) => item.path)).toEqual(expect.arrayContaining(goldenFiles.map((file) => file.path)));
    for (const item of evidence) {
      const file = goldenFiles.find((candidate) => candidate.path === item.path)!;
      expect(item.startLine).toBeGreaterThanOrEqual(1);
      expect(item.endLine).toBeLessThanOrEqual(file.content.split("\n").length);
      expect(item.excerpt.length).toBeGreaterThan(0);
    }
  });
});
