import type { StructureIntentInput, StructuredIntent } from "../../shared/intent-structure";

export interface IntentStructuringProvider {
  structureIntent(input: StructureIntentInput): Promise<StructuredIntent>;
}

export class AiConfigurationError extends Error {
  constructor(readonly code: "AI_NOT_CONFIGURED" | "AI_PROVIDER_UNSUPPORTED") {
    super(code);
    this.name = "AiConfigurationError";
  }
}

export class AiProviderResponseError extends Error {
  constructor() {
    super("AI_PROVIDER_RESPONSE_INVALID");
    this.name = "AiProviderResponseError";
  }
}
