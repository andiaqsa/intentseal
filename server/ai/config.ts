export type SupportedAiProvider = "gemini" | "openai";

export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

type ServerEnvironment = Record<string, string | undefined>;

export function getConfiguredAiProvider(
  environment: ServerEnvironment = process.env,
): string | null {
  return environment.AI_PROVIDER?.trim().toLowerCase() || null;
}

export function getConfiguredAiModel(
  environment: ServerEnvironment = process.env,
): string | null {
  const configured = environment.AI_MODEL?.trim();
  if (configured) return configured;
  return getConfiguredAiProvider(environment) === "gemini" ? DEFAULT_GEMINI_MODEL : null;
}

export function isConfiguredProviderKeyPresent(
  environment: ServerEnvironment = process.env,
): boolean {
  return getConfiguredAiProvider(environment) === "gemini"
    ? Boolean(environment.GEMINI_API_KEY?.trim())
    : Boolean(environment.AI_API_KEY?.trim());
}
