import { describe, expect, it } from "vitest";

import { OUTCOME_SCHEMA, type OutcomeDraft } from "../../../shared/evidence";
import { canonicalizeOutcome, hashOutcome } from "./outcome";

const draft: OutcomeDraft = {
  schema: OUTCOME_SCHEMA,
  intentId: "5",
  source: {
    type: "github",
    repository: "example/project",
    commit: "a".repeat(40),
    commitUrl: `https://github.com/example/project/commit/${"a".repeat(40)}`,
  },
  evaluations: [
    {
      criterionIndex: 0,
      criterion: "Requests return HTTP 429.",
      status: "SATISFIED",
      explanation: "The handler returns 429.",
      evidence: [
        { path: "src/login.ts", startLine: 10, endLine: 12, excerpt: "return res.status(429)" },
      ],
    },
  ],
};

describe("canonical outcome", () => {
  it("uses fixed key order and produces the same hash for the same draft", () => {
    const canonical = canonicalizeOutcome(draft);
    expect(canonical.indexOf('"schema"')).toBeLessThan(canonical.indexOf('"intentId"'));
    expect(canonical.indexOf('"intentId"')).toBeLessThan(canonical.indexOf('"source"'));
    expect(hashOutcome(draft)).toBe(hashOutcome(structuredClone(draft)));
  });

  it.each([
    ["status", { evaluations: [{ ...draft.evaluations[0]!, status: "PARTIAL" as const }] }],
    ["evidence", { evaluations: [{ ...draft.evaluations[0]!, evidence: [{ ...draft.evaluations[0]!.evidence[0]!, excerpt: "different" }] }] }],
    ["commit", { source: { ...draft.source, commit: "b".repeat(40) } }],
    ["line range", { evaluations: [{ ...draft.evaluations[0]!, evidence: [{ ...draft.evaluations[0]!.evidence[0]!, endLine: 13 }] }] }],
  ])("changes the hash when %s changes", (_name, change) => {
    expect(hashOutcome({ ...draft, ...change })).not.toBe(hashOutcome(draft));
  });

  it("preserves evaluation and evidence order", () => {
    const second = { ...draft.evaluations[0]!, criterionIndex: 1, criterion: "Tests exist." };
    const canonical = canonicalizeOutcome({ ...draft, evaluations: [second, draft.evaluations[0]!] });
    expect(canonical.indexOf("Tests exist.")).toBeLessThan(canonical.indexOf("Requests return"));
  });

  it("includes the schema version in the canonical payload", () => {
    expect(canonicalizeOutcome(draft)).toContain(`"schema":"${OUTCOME_SCHEMA}"`);
  });
});
