import {
  MAX_ROUGH_INTENT_LENGTH,
  type StructuredIntent,
} from "../../../shared/intent-structure";
import { AI_REQUEST_TIMEOUT_MS } from "../../config/ai";

export class IntentStructuringError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
    this.name = "IntentStructuringError";
  }
}

export async function structureIntent(text: string): Promise<StructuredIntent> {
  const normalized = text.trim();
  if (!normalized) throw new IntentStructuringError("Describe your intent first.");
  if (normalized.length > MAX_ROUGH_INTENT_LENGTH) {
    throw new IntentStructuringError(
      `Keep the description under ${MAX_ROUGH_INTENT_LENGTH.toLocaleString()} characters.`,
    );
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    if (import.meta.env.DEV) console.warn("[IntentSeal AI] Request safety timeout");
    controller.abort();
  }, AI_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/intent/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: normalized }),
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = readErrorMessage(payload) ?? "AI couldn't structure this intent.";
      throw new IntentStructuringError(message);
    }
    if (!isStructuredIntent(payload)) {
      throw new IntentStructuringError("AI returned an invalid draft. Write manually or try again.");
    }
    return payload;
  } catch (error) {
    if (error instanceof IntentStructuringError) throw error;
    if (isAbortError(error)) {
      throw new IntentStructuringError("AI took too long to respond. Write manually or try again.");
    }
    throw new IntentStructuringError("AI couldn't structure this intent.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function isStructuredIntent(value: unknown): value is StructuredIntent {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    typeof record.goal === "string" &&
    Array.isArray(record.criteria) &&
    record.criteria.length > 0 &&
    record.criteria.every((criterion) => typeof criterion === "string")
  );
}

function readErrorMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" && message.length <= 200 ? message : null;
}
