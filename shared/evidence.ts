export const OUTCOME_SCHEMA = "intentseal.outcome.v1" as const;

export type CriterionStatus = "SATISFIED" | "PARTIAL" | "NOT_FOUND";

export interface EvidenceReference {
  path: string;
  startLine: number;
  endLine: number;
  excerpt: string;
}

export interface EvidenceSnippet extends EvidenceReference {
  reason: string;
}

export interface CriterionEvaluation {
  criterionIndex: number;
  criterion: string;
  status: CriterionStatus;
  explanation: string;
  evidence: EvidenceReference[];
}

export interface OutcomeDraft {
  schema: typeof OUTCOME_SCHEMA;
  intentId: string;
  source: {
    type: "github";
    repository: string;
    commit: string;
    commitUrl: string;
  };
  evaluations: CriterionEvaluation[];
}

export interface EvidenceAnalysisResult {
  outcomeDraft: OutcomeDraft;
  analyzedAt: string;
  evidenceFileCount: number;
}

export interface EvaluateEvidenceRequest {
  intentId: string;
  title: string;
  goal: string;
  criteria: string[];
  repositoryUrl: string;
  ref?: string;
}

export interface EvidenceProviderInput {
  intentId: string;
  title: string;
  goal: string;
  criteria: string[];
  repository: string;
  commit: string;
  evidence: EvidenceSnippet[];
  signal?: AbortSignal;
}
