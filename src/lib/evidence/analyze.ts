import type { EvidenceAnalysisResult, EvaluateEvidenceRequest } from "../../../shared/evidence";

export class EvidenceAnalysisError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
    this.name = "EvidenceAnalysisError";
  }
}

export async function analyzeEvidence(input: EvaluateEvidenceRequest): Promise<EvidenceAnalysisResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 70_000);
  try {
    const response = await fetch("/api/evidence/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new EvidenceAnalysisError(readErrorMessage(payload) ?? "Evidence analysis failed.");
    if (!isAnalysisResult(payload)) throw new EvidenceAnalysisError("The evidence result was invalid.");
    return payload;
  } catch (error) {
    if (error instanceof EvidenceAnalysisError) throw error;
    if (isAbortError(error)) throw new EvidenceAnalysisError("Evidence analysis took too long. Try again.");
    throw new EvidenceAnalysisError("Evidence analysis failed. Check your connection and try again.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function isAnalysisResult(value: unknown): value is EvidenceAnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const draft = record.outcomeDraft;
  return (
    typeof record.analyzedAt === "string" &&
    typeof record.evidenceFileCount === "number" &&
    typeof draft === "object" &&
    draft !== null &&
    (draft as Record<string, unknown>).schema === "intentseal.outcome.v1" &&
    Array.isArray((draft as Record<string, unknown>).evaluations)
  );
}

function readErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" && message.length <= 240 ? message : null;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
