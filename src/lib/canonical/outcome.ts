import { keccak256, toUtf8Bytes } from "ethers";

import { OUTCOME_SCHEMA, type OutcomeDraft } from "../../../shared/evidence";

/** Serializes fixed schema/intentId/source/evaluations and reference key order. */
export function canonicalizeOutcome(outcome: OutcomeDraft): string {
  if (outcome.schema !== OUTCOME_SCHEMA) throw new Error("INVALID_OUTCOME_SCHEMA");

  return JSON.stringify({
    schema: OUTCOME_SCHEMA,
    intentId: outcome.intentId,
    source: {
      type: "github",
      repository: outcome.source.repository,
      commit: outcome.source.commit,
      commitUrl: outcome.source.commitUrl,
    },
    evaluations: outcome.evaluations.map((evaluation) => ({
      criterionIndex: evaluation.criterionIndex,
      criterion: evaluation.criterion,
      status: evaluation.status,
      explanation: evaluation.explanation,
      evidence: evaluation.evidence.map((reference) => ({
        path: reference.path,
        startLine: reference.startLine,
        endLine: reference.endLine,
        excerpt: reference.excerpt,
      })),
    })),
  });
}

export function hashOutcome(outcome: OutcomeDraft): string {
  return keccak256(toUtf8Bytes(canonicalizeOutcome(outcome)));
}
