export const MAX_ROUGH_INTENT_LENGTH = 4_000;
export const MAX_STRUCTURED_CRITERIA = 6;
export const MIN_AI_SERVER_TIMEOUT_MS = 1_000;
export const DEFAULT_AI_SERVER_TIMEOUT_MS = 15_000;
export const MAX_AI_SERVER_TIMEOUT_MS = 30_000;

export interface StructureIntentInput {
  text: string;
  signal?: AbortSignal;
}

export interface StructuredIntent {
  title: string;
  goal: string;
  criteria: string[];
}
