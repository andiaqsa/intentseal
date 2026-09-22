import {
  DEFAULT_AI_SERVER_TIMEOUT_MS,
  MAX_AI_SERVER_TIMEOUT_MS,
  MIN_AI_SERVER_TIMEOUT_MS,
} from "../../shared/intent-structure";
import { getConfiguredAiModel, getConfiguredAiProvider } from "./config";
import { GeminiIntentStructuringProvider } from "./gemini";
import { OpenAiIntentStructuringProvider } from "./openai";
import { AiConfigurationError, type IntentStructuringProvider } from "./provider";

type ServerEnvironment = Record<string, string | undefined>;

export function createIntentStructuringProvider(
  environment: ServerEnvironment = process.env,
): IntentStructuringProvider {
  const provider = getConfiguredAiProvider(environment);
  if (!provider) throw new AiConfigurationError("AI_NOT_CONFIGURED");
  const model = getConfiguredAiModel(environment);

  if (provider === "gemini") {
    const apiKey = environment.GEMINI_API_KEY?.trim();
    if (!apiKey || !model) throw new AiConfigurationError("AI_NOT_CONFIGURED");
    return new GeminiIntentStructuringProvider(apiKey, model);
  }

  if (provider === "openai") {
    const apiKey = environment.AI_API_KEY?.trim();
    if (!apiKey || !model) throw new AiConfigurationError("AI_NOT_CONFIGURED");
    return new OpenAiIntentStructuringProvider(apiKey, model);
  }

  throw new AiConfigurationError("AI_PROVIDER_UNSUPPORTED");
}

export function getAiTimeoutMs(environment: ServerEnvironment = process.env): number {
  const configured = Number(environment.AI_TIMEOUT_MS);
  return Number.isFinite(configured) &&
    configured >= MIN_AI_SERVER_TIMEOUT_MS &&
    configured <= MAX_AI_SERVER_TIMEOUT_MS
    ? configured
    : DEFAULT_AI_SERVER_TIMEOUT_MS;
}
