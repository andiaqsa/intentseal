import { keccak256, toUtf8Bytes } from "ethers";

import type { CanonicalIntent, IntentInput } from "../../types/intent";

export const INTENT_SCHEMA = "intentseal.intent.v1" as const;

export class InvalidIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIntentError";
  }
}

export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function toCanonicalIntent(input: IntentInput): CanonicalIntent {
  const title = normalizeText(input.title);
  const goal = normalizeText(input.goal);
  const criteria = input.criteria.map(normalizeText);

  if (!title) throw new InvalidIntentError("Add a title for this intent.");
  if (!goal) throw new InvalidIntentError("Describe the goal for this intent.");
  if (criteria.length === 0) {
    throw new InvalidIntentError("Add at least one measurable criterion.");
  }
  if (criteria.some((criterion) => !criterion)) {
    throw new InvalidIntentError("Every criterion must contain text.");
  }

  return { schema: INTENT_SCHEMA, title, goal, criteria };
}

/** Serializes keys explicitly in schema/title/goal/criteria order. */
export function canonicalizeIntent(input: IntentInput): string {
  const intent = toCanonicalIntent(input);
  return `{"schema":${JSON.stringify(intent.schema)},"title":${JSON.stringify(intent.title)},"goal":${JSON.stringify(intent.goal)},"criteria":${JSON.stringify(intent.criteria)}}`;
}

export function hashCanonicalPayload(canonicalPayload: string): string {
  return keccak256(toUtf8Bytes(canonicalPayload));
}

export function hashIntent(input: IntentInput): string {
  return hashCanonicalPayload(canonicalizeIntent(input));
}

export function parseCanonicalIntent(canonicalPayload: string): CanonicalIntent {
  let value: unknown;
  try {
    value = JSON.parse(canonicalPayload) as unknown;
  } catch {
    throw new InvalidIntentError("The stored intent payload is invalid.");
  }
  if (typeof value !== "object" || value === null) {
    throw new InvalidIntentError("The stored intent payload is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (
    record.schema !== INTENT_SCHEMA ||
    typeof record.title !== "string" ||
    typeof record.goal !== "string" ||
    !Array.isArray(record.criteria) ||
    !record.criteria.every((criterion) => typeof criterion === "string")
  ) {
    throw new InvalidIntentError("The stored intent payload is invalid.");
  }
  const canonical = toCanonicalIntent({
    title: record.title,
    goal: record.goal,
    criteria: record.criteria,
  });
  if (canonicalizeIntent(canonical) !== canonicalPayload) {
    throw new InvalidIntentError("The stored intent payload is not canonical.");
  }
  return canonical;
}
