import { describe, expect, it } from "vitest";

import { hashOutcome } from "../../src/lib/canonical/outcome";
import type { EvidenceProviderInput } from "../../shared/evidence";
import { evaluateEvidenceDeterministically } from "./evaluator";
import { goldenFiles } from "./fixtures/golden";
import { extractEvidenceSnippets } from "./selection";

const criteria = [
  "Maximum 5 login attempts per minute per IP",
  "Return HTTP 429 when the limit is exceeded",
  "Add automated tests for rate limiting",
];

function input(overrides: Partial<EvidenceProviderInput> = {}): EvidenceProviderInput {
  return {
    intentId: "6",
    title: "Add API rate limiting",
    goal: "Implement login endpoint rate limiting before completing the task.",
    criteria,
    repository: "demo/rate-limit-app",
    commit: "a".repeat(40),
    evidence: extractEvidenceSnippets(goldenFiles, criteria),
    ...overrides,
  };
}

const source = {
  type: "github" as const,
  repository: "demo/rate-limit-app",
  commit: "a".repeat(40),
  commitUrl: `https://github.com/demo/rate-limit-app/commit/${"a".repeat(40)}`,
};

describe("deterministic evidence evaluator", () => {
  it("finds numeric, HTTP 429, and automated-test evidence", () => {
    const draft = evaluateEvidenceDeterministically(input(), source);
    expect(draft.evaluations.map((item) => item.status)).toEqual([
      "PARTIAL", "SATISFIED", "SATISFIED",
    ]);
    expect(draft.evaluations[0]?.explanation).toContain("does not clearly establish per-IP handling");
    expect(draft.evaluations[1]?.evidence.some((item) => item.excerpt.includes("429"))).toBe(true);
    expect(draft.evaluations[2]?.evidence.some((item) => item.path.includes(".test."))).toBe(true);
  });

  it("returns NOT_FOUND when evidence is insufficient", () => {
    const draft = evaluateEvidenceDeterministically(input({
      criteria: ["Encrypt stored backups with AES-256"],
      evidence: input().evidence,
    }), source);
    expect(draft.evaluations[0]).toMatchObject({ status: "NOT_FOUND", evidence: [] });
  });

  it("is stable for identical input and changes the hash when evidence changes", () => {
    const first = evaluateEvidenceDeterministically(input(), source);
    const second = evaluateEvidenceDeterministically(input(), source);
    expect(second).toEqual(first);
    const changed = evaluateEvidenceDeterministically(input({
      evidence: input().evidence.map((item) => ({ ...item, excerpt: `${item.excerpt}\n// changed` })),
    }), source);
    expect(hashOutcome(changed)).not.toBe(hashOutcome(first));
  });
});
